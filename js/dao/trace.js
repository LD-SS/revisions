/* =====================================================================
   DAO — OUTILS DE TRACÉ (ligne enchaînée, rectangle, cercle, arc)
   ---------------------------------------------------------------------
   Gestes : cliquer/toucher point par point, ou glisser pour le 1er trait.
   Accroches : extrémités, milieux, centres, quadrants, intersections,
   puis grille (si visible) ou le millimètre. Mode orthogonal (F8 / Maj).
   Saisie au clavier (puis Entrée) :
     1er point : « x;y » (coordonnées réelles en mm)
     ligne     : « 50 » (longueur vers le curseur), « 50<30 » (longueur<angle),
                 « 20;-10 » (déplacement relatif)
     rectangle : « 40;20 » (largeur;hauteur) ou « 30 » (carré)
     cercle    : « 15 » (rayon) ou « Ø30 » / « d30 » (diamètre)
     arc       : centre, puis début (« 20<0 »), puis angle balayé (« 90 »)
   Annuler / rétablir : Ctrl+Z / Ctrl+Y (historique de 100 étapes).
   ===================================================================== */

import { versReel, versPapier, facteur, pasGrille } from './feuille.js';
import { tousLesPoints, accrocher, ortho, lireSaisie, angleDe, surCercle, arcNormal, dist, arrondi, mesure, EPS } from './geom.js';

export const STYLES = {
  v: { nom: 'Fort', titre: 'Trait fort : arête vue (F)', touche: 'f' },
  n: { nom: 'Fin', titre: 'Trait fin : construction, cotes (N)', touche: 'n' },
  c: { nom: 'Interrompu', titre: 'Trait interrompu fin : arête cachée (C)', touche: 'c' },
  a: { nom: 'Mixte', titre: 'Trait mixte fin : axe (A)', touche: 'a' },
};
export const OUTILS = {
  main: { nom: 'Déplacer', touche: 'm', aide: 'Glisse pour déplacer la feuille, molette ou 2 doigts pour zoomer.' },
  ligne: { nom: 'Ligne', touche: 'l', aide: ['Ligne : clique le 1er point (ou tape x;y puis Entrée).', 'Ligne : clique le point suivant, ou tape une longueur (50), longueur<angle (50<30) ou dx;dy. Clic droit / Échap pour finir.'] },
  rect: { nom: 'Rectangle', touche: 'r', aide: ['Rectangle : clique un 1er coin (ou tape x;y).', 'Rectangle : clique le coin opposé, ou tape largeur;hauteur (40;20).'] },
  cercle: { nom: 'Cercle', touche: 'o', aide: ['Cercle : clique le centre (ou tape x;y).', 'Cercle : clique un point du cercle, ou tape le rayon (15) ou le diamètre (Ø30).'] },
  arc: { nom: 'Arc', touche: 'k', aide: ['Arc : clique le centre.', 'Arc : clique le point de départ (ou tape rayon<angle, ex. 20<0).', 'Arc : clique le point d\'arrivée (sens anti-horloger) ou tape l\'angle balayé (90).'] },
};

const f2 = (v) => Math.round(v * 100) / 100;

/** SVG (en mm papier) d'une entité. */
export function svgEntite(p, e, cls = '') {
  const k = facteur(p.echelle);
  const c = `dao-t dao-t-${e.s || 'v'}${cls ? ` ${cls}` : ''}`;
  if (e.t === 'l') {
    const [a, b] = [versPapier(p, e.x1, e.y1), versPapier(p, e.x2, e.y2)];
    return `<path class="${c}" d="M${f2(a[0])} ${f2(a[1])}L${f2(b[0])} ${f2(b[1])}"/>`;
  }
  const [cx, cy] = versPapier(p, e.cx, e.cy);
  if (e.t === 'c') return `<circle class="${c}" cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(e.r * k)}"/>`;
  const a = versPapier(p, ...surCercle(e.cx, e.cy, e.r, e.a0)), b = versPapier(p, ...surCercle(e.cx, e.cy, e.r, e.a1));
  const grand = e.a1 - e.a0 > 180 ? 1 : 0;
  if (e.a1 - e.a0 >= 359.999) return `<circle class="${c}" cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(e.r * k)}"/>`;
  return `<path class="${c}" d="M${f2(a[0])} ${f2(a[1])}A${f2(e.r * k)} ${f2(e.r * k)} 0 ${grand} 0 ${f2(b[0])} ${f2(b[1])}"/>`;
}

/** Symbole d'accroche (taille constante à l'écran). */
function svgAccroche(p, q, t) {
  const [x, y] = versPapier(p, q[0], q[1]);
  const s = t;
  const d = {
    ext: `M${x - s} ${y - s}h${2 * s}v${2 * s}h${-2 * s}z`,
    mil: `M${x} ${y - s * 1.2}L${x + s * 1.1} ${y + s * 0.8}H${x - s * 1.1}z`,
    cen: '',
    qua: `M${x} ${y - s * 1.2}L${x + s * 1.2} ${y}L${x} ${y + s * 1.2}L${x - s * 1.2} ${y}z`,
    int: `M${x - s} ${y - s}L${x + s} ${y + s}M${x + s} ${y - s}L${x - s} ${y + s}`,
  }[q[2]];
  return q[2] === 'cen' ? `<circle class="dao-acc" cx="${f2(x)}" cy="${f2(y)}" r="${f2(s * 1.1)}"/>` : `<path class="dao-acc" d="${d}"/>`;
}
const NOM_ACC = { ext: 'extrémité', mil: 'milieu', cen: 'centre', qua: 'quadrant', int: 'intersection' };

/**
 * @param {object} o
 * @param {object} o.feuille   instance de monterFeuille
 * @param {() => object} o.planche      planche courante
 * @param {(entites: object[]) => void} o.enregistrer  sauvegarde des entités
 * @param {(info: {aide: string, saisie: string, mesure: string, accroche: string, ortho: boolean}) => void} o.surEtat
 */
export function creerTraceur(o) {
  const st = {
    outil: 'ligne', style: 'v', ortho: false, maj: false,
    pts: [], cur: null, acc: null, saisie: '',
    bas: null,                    // {px:[x,y] écran, pt} au moment de l'appui
    hist: [], refaire: [],
    cache: null,                  // points d'accroche du dessin
  };
  const P = () => o.planche();
  const entites = () => P().entites || [];

  const toleranceReel = (px) => px / Math.max(o.feuille.pxParMm(), 1e-6) / facteur(P().echelle);
  function pointsDuDessin() {
    if (!st.cache) st.cache = tousLesPoints(entites());
    return st.cache;
  }

  /** Point réel visé (accroches, grille, ortho) à partir d'un point papier. */
  function viser(pp) {
    const p = P();
    let q = versReel(p, pp[0], pp[1]);
    const tol = toleranceReel(12);
    const origine = st.outil === 'ligne' || st.outil === 'rect' ? st.pts[st.pts.length - 1] : null;
    const orth = (st.ortho || st.maj) && origine && st.outil === 'ligne';
    const pts = [...pointsDuDessin(), ...st.pts.map((x) => [x[0], x[1], 'ext'])];
    if (orth) q = ortho(origine, q);
    let a = accrocher(q, orth ? pts.filter((x) => Math.abs(x[0] - origine[0]) < EPS || Math.abs(x[1] - origine[1]) < EPS) : pts, tol);
    if (a) { st.acc = a; return [a[0], a[1]]; }
    st.acc = null;
    const pas = p.grille ? pasGrille(p) : 1;
    const g = (v) => Math.round(v / pas) * pas;
    if (orth) return Math.abs(q[0] - origine[0]) < EPS ? [q[0], g(q[1])] : [g(q[0]), q[1]];
    return [g(q[0]), g(q[1])];
  }

  /* ----- historique ----- */
  function changer(nouvelles) {
    st.hist.push(JSON.stringify(entites()));
    if (st.hist.length > 100) st.hist.shift();
    st.refaire = [];
    o.enregistrer(nouvelles);
    st.cache = null;
    redessiner();
  }
  const ajouter = (...es) => changer([...entites(), ...es.map((e) => ({ ...e, s: e.s || st.style }))]);
  function annuler() {
    if (st.pts.length) { st.pts = []; apercu(); return; }
    if (!st.hist.length) return;
    st.refaire.push(JSON.stringify(entites()));
    o.enregistrer(JSON.parse(st.hist.pop())); st.cache = null; redessiner();
  }
  function retablir() {
    if (!st.refaire.length) return;
    st.hist.push(JSON.stringify(entites()));
    o.enregistrer(JSON.parse(st.refaire.pop())); st.cache = null; redessiner();
  }

  /* ----- construction des entités ----- */
  function poser(q) {
    const pts = st.pts;
    const der = pts[pts.length - 1];
    if (st.outil === 'ligne') {
      if (der && dist(der, q) < EPS) { finir(); return; }       // même point : fin du contour
      if (der) ajouter({ t: 'l', x1: der[0], y1: der[1], x2: q[0], y2: q[1] });
      if (pts.length > 1 && dist(pts[0], q) < EPS) { finir(); return; }   // contour fermé
      pts.push(q);
    } else if (st.outil === 'rect') {
      if (!der) { pts.push(q); } else {
        const [a, b] = [der, q];
        if (Math.abs(a[0] - b[0]) > EPS && Math.abs(a[1] - b[1]) > EPS) {
          ajouter({ t: 'l', x1: a[0], y1: a[1], x2: b[0], y2: a[1] }, { t: 'l', x1: b[0], y1: a[1], x2: b[0], y2: b[1] },
            { t: 'l', x1: b[0], y1: b[1], x2: a[0], y2: b[1] }, { t: 'l', x1: a[0], y1: b[1], x2: a[0], y2: a[1] });
        }
        st.pts = [];
      }
    } else if (st.outil === 'cercle') {
      if (!der) pts.push(q); else { const r = dist(der, q); if (r > EPS) ajouter({ t: 'c', cx: der[0], cy: der[1], r: arrondi(r, 4) }); st.pts = []; }
    } else if (st.outil === 'arc') {
      if (pts.length < 2) { if (pts.length === 1 && dist(pts[0], q) < EPS) return; pts.push(q); } else {
        const [c, d] = pts; const r = dist(c, d);
        const a0 = angleDe(c, d); let a1 = angleDe(c, q);
        if (a1 <= a0 + EPS) a1 += 360;
        ajouter(arcNormal({ t: 'a', cx: c[0], cy: c[1], r: arrondi(r, 4), a0, a1 }));
        st.pts = [];
      }
    }
    apercu();
  }
  function finir() { st.pts = []; st.saisie = ''; apercu(); }

  /** Applique la saisie clavier (Entrée). */
  function appliquerSaisie() {
    const v = lireSaisie(st.saisie);
    st.saisie = '';
    if (!v) { apercu('Saisie non comprise : exemples 50 · 50<30 · 20;-10 · Ø30'); return; }
    const der = st.pts[st.pts.length - 1];
    const cur = st.cur || der;
    if (!der) {                                     // 1er point : x;y
      if (v.dx != null) poser([v.dx, v.dy]); else apercu('Pour le 1er point, tape x;y (ex. 20;30).');
      return;
    }
    const dirVers = (lg) => {
      let c = cur && dist(cur, der) > EPS ? cur : [der[0] + 1, der[1]];
      if (st.ortho || st.maj) c = ortho(der, c);
      const d = dist(der, c) || 1;
      return [der[0] + ((c[0] - der[0]) / d) * lg, der[1] + ((c[1] - der[1]) / d) * lg];
    };
    const polaire = (lg, ang) => [der[0] + lg * Math.cos((ang * Math.PI) / 180), der[1] + lg * Math.sin((ang * Math.PI) / 180)];
    if (st.outil === 'ligne') {
      if (v.dx != null) poser([der[0] + v.dx, der[1] + v.dy]);
      else if (v.lg != null) poser(v.ang != null ? polaire(v.lg, v.ang) : dirVers(v.lg));
    } else if (st.outil === 'rect') {
      if (v.dx != null) poser([der[0] + v.dx, der[1] + v.dy]);
      else if (v.lg != null) {
        const sx = cur && cur[0] < der[0] ? -1 : 1, sy = cur && cur[1] < der[1] ? -1 : 1;
        poser([der[0] + sx * v.lg, der[1] + sy * v.lg]);
      }
    } else if (st.outil === 'cercle') {
      const r = v.diam != null ? v.diam / 2 : v.lg;
      if (r > 0) poser([der[0] + r, der[1]]);
    } else if (st.outil === 'arc') {
      if (st.pts.length === 1) {
        if (v.lg != null) poser(v.ang != null ? polaire(v.lg, v.ang) : dirVers(v.lg));
      } else if (v.lg != null && Math.abs(v.lg) > EPS) {
        const [c, d] = st.pts;
        const a0 = angleDe(c, d);
        const r = dist(c, d);
        const a1 = a0 + v.lg;
        const e = v.lg > 0 ? { a0, a1 } : { a0: a1, a1: a0 };
        ajouter(arcNormal({ t: 'a', cx: c[0], cy: c[1], r: arrondi(r, 4), ...e }));
        st.pts = []; apercu();
      }
    }
  }

  /* ----- affichage ----- */
  function redessiner() {
    const p = P();
    o.feuille.calque('dessin').innerHTML = entites().map((e) => svgEntite(p, e)).join('');
    apercu();
  }

  /** Entité en cours de construction (aperçu), ou null. */
  function enCours() {
    const der = st.pts[st.pts.length - 1], q = st.cur;
    if (!der || !q) return null;
    if (st.outil === 'ligne') return { t: 'l', x1: der[0], y1: der[1], x2: q[0], y2: q[1], s: st.style };
    if (st.outil === 'rect') return { t: 'r', a: der, b: q };
    if (st.outil === 'cercle') return { t: 'c', cx: der[0], cy: der[1], r: dist(der, q), s: st.style };
    if (st.outil === 'arc') {
      const c = st.pts[0];
      if (st.pts.length === 1) return { t: 'l', x1: c[0], y1: c[1], x2: q[0], y2: q[1], s: 'n', aide: true };
      const a0 = angleDe(c, st.pts[1]); let a1 = angleDe(c, q); if (a1 <= a0 + EPS) a1 += 360;
      return { t: 'a', cx: c[0], cy: c[1], r: dist(c, st.pts[1]), a0, a1, s: st.style };
    }
    return null;
  }

  function apercu(message) {
    const p = P();
    const t = 5 / Math.max(o.feuille.pxParMm(), 1e-6);    // ±5 px en mm papier
    let svg = '';
    const e = enCours();
    let info = '';
    if (e?.t === 'r') {
      const [a, b] = [e.a, e.b];
      const ls = [[a[0], a[1], b[0], a[1]], [b[0], a[1], b[0], b[1]], [b[0], b[1], a[0], b[1]], [a[0], b[1], a[0], a[1]]];
      svg += ls.map(([x1, y1, x2, y2]) => svgEntite(p, { t: 'l', x1, y1, x2, y2, s: st.style }, 'dao-ap')).join('');
      info = `${arrondi(Math.abs(b[0] - a[0]), 2)} × ${arrondi(Math.abs(b[1] - a[1]), 2)} mm`;
    } else if (e) {
      svg += svgEntite(p, e, e.aide ? 'dao-ap dao-ap-aide' : 'dao-ap');
      if (e.t === 'l' && !e.aide) {
        const ang = arrondi(angleDe([e.x1, e.y1], [e.x2, e.y2]), 1);
        info = `${mesure(e)} · ${ang}°`;
      } else if (e.t === 'l') info = `R ${arrondi(dist([e.x1, e.y1], [e.x2, e.y2]), 2)} mm`;
      else info = mesure(e);
    }
    for (const q of st.pts) { const [x, y] = versPapier(p, q[0], q[1]); svg += `<circle class="dao-pt" cx="${f2(x)}" cy="${f2(y)}" r="${f2(t * 0.45)}"/>`; }
    if (st.acc) svg += svgAccroche(p, st.acc, t);
    o.feuille.calque('apercu').innerHTML = svg;
    const aide = OUTILS[st.outil].aide;
    o.surEtat({
      aide: message || (Array.isArray(aide) ? aide[Math.min(st.pts.length, aide.length - 1)] : aide),
      saisie: st.saisie, mesure: info, accroche: st.acc ? NOM_ACC[st.acc[2]] : '', ortho: st.ortho,
      annuler: st.hist.length > 0 || st.pts.length > 0, retablir: st.refaire.length > 0,
    });
  }

  /* ----- événements venant de la feuille ----- */
  function surPointeur(type, ev, pp) {
    if (st.outil === 'main') return pp;
    if (type === 'annule') { st.bas = null; apercu(); return null; }
    if (type === 'droit') { finir(); return pp; }
    st.maj = !!ev?.shiftKey;
    const q = viser(pp);
    st.cur = q;
    if (type === 'bas') st.bas = { x: ev.clientX, y: ev.clientY, q };
    if (type === 'haut' && st.bas) {
      const glisse = Math.hypot(ev.clientX - st.bas.x, ev.clientY - st.bas.y) > 8;
      if (glisse && !st.pts.length) poser(st.bas.q);
      poser(q);
      st.bas = null;
    }
    apercu();
    return versPapier(P(), q[0], q[1]);
  }

  /** Clavier (renvoie true si la touche a été utilisée). */
  function clavier(ev) {
    if (ev.ctrlKey || ev.metaKey) {
      const k = ev.key.toLowerCase();
      if (k === 'z' && !ev.shiftKey) { annuler(); return true; }
      if (k === 'y' || (k === 'z' && ev.shiftKey)) { retablir(); return true; }
      return false;
    }
    if (ev.key === 'F8') { st.ortho = !st.ortho; apercu(); return true; }
    if (ev.key === 'Escape') { if (st.saisie) st.saisie = ''; else finir(); apercu(); return true; }
    if (ev.key === 'Enter' && st.saisie) { appliquerSaisie(); return true; }
    if (ev.key === 'Backspace' && st.saisie) { st.saisie = st.saisie.slice(0, -1); apercu(); return true; }
    const enSaisie = st.saisie.length > 0;
    if (/^[0-9.,;<\-]$/.test(ev.key) || (/^[dDøØ]$/.test(ev.key) && !enSaisie && st.outil === 'cercle' && st.pts.length)) {
      if (st.outil === 'main') return false;
      st.saisie += ev.key; apercu(); return true;
    }
    if (enSaisie) return false;
    const k = ev.key.toLowerCase();
    const s = Object.keys(STYLES).find((x) => STYLES[x].touche === k);
    if (s) { choisirStyle(s); return true; }
    const t = Object.keys(OUTILS).find((x) => OUTILS[x].touche === k);
    if (t) { choisirOutil(t); return true; }
    return false;
  }

  function choisirOutil(t) { st.outil = t; st.pts = []; st.saisie = ''; st.acc = null; o.surOutil?.(t); apercu(); }
  function choisirStyle(s) { st.style = s; o.surStyle?.(s); apercu(); }

  redessiner();
  return {
    surPointeur, clavier, annuler, retablir, redessiner,
    outil: () => st.outil, style: () => st.style,
    choisirOutil, choisirStyle,
    basculerOrtho() { st.ortho = !st.ortho; apercu(); return st.ortho; },
    toutEffacer() { if (entites().length) changer([]); },
    /** À appeler quand l'échelle ou le format change (les entités restent en mm réels). */
    rafraichir() { st.cache = null; redessiner(); },
  };
}
