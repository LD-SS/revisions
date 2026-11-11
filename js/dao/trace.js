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
   Sélection (S) : clic, Maj+clic, cadre ; puis Déplacer, Copier, Miroir,
   Supprimer (Suppr) ou changer le type de trait. Gomme (E) : toucher un trait.
   Cote (Q) : linéaire (horizontale/verticale selon la souris), alignée,
   diamètre, rayon, angle (voir js/dao/cotes.js).
   Construction : Ajuster (T), Prolonger (X), Chanfrein, Congé, Rappel (H :
   trait fin horizontal/vertical), 45° (trait fin à 45°) — js/dao/construction.js.
   ===================================================================== */

import { versReel, versPapier, facteur, pasGrille } from './feuille.js';
import { toucher, dansRectangle, translater, symetrie, distanceA } from './edition.js';
import { svgCote } from './cotes.js';
import { ajuster, prolonger, chanfrein, conge } from './construction.js';
import { regionAutour, svgHachure, svgTexte } from './hachures.js';
import { tousLesPoints, accrocher, ortho, lireSaisie, angleDe, surCercle, arcNormal, dist, arrondi, mesure, EPS } from './geom.js';

export const STYLES = {
  v: { nom: 'Fort', titre: 'Trait fort : arête vue (F)', touche: 'f' },
  n: { nom: 'Fin', titre: 'Trait fin : construction, cotes (N)', touche: 'n' },
  c: { nom: 'Interrompu', titre: 'Trait interrompu fin : arête cachée (C)', touche: 'c' },
  a: { nom: 'Mixte', titre: 'Trait mixte fin : axe (A)', touche: 'a' },
};
export const OUTILS = {
  main: { nom: 'Déplacer', touche: 'm', aide: 'Glisse pour déplacer la feuille, molette ou 2 doigts pour zoomer.' },
  selection: { nom: 'Sélection', touche: 's', aide: 'Sélection : touche un trait (Maj pour en ajouter) ou glisse un cadre : vers la droite = entièrement dedans, vers la gauche = qui touchent.' },
  ligne: { nom: 'Ligne', touche: 'l', aide: ['Ligne : clique le 1er point (ou tape x;y puis Entrée).', 'Ligne : clique le point suivant, ou tape une longueur (50), longueur<angle (50<30) ou dx;dy. Clic droit / Échap pour finir.'] },
  rect: { nom: 'Rectangle', touche: 'r', aide: ['Rectangle : clique un 1er coin (ou tape x;y).', 'Rectangle : clique le coin opposé, ou tape largeur;hauteur (40;20).'] },
  cercle: { nom: 'Cercle', touche: 'o', aide: ['Cercle : clique le centre (ou tape x;y).', 'Cercle : clique un point du cercle, ou tape le rayon (15) ou le diamètre (Ø30).'] },
  arc: { nom: 'Arc', touche: 'k', aide: ['Arc : clique le centre.', 'Arc : clique le point de départ (ou tape rayon<angle, ex. 20<0).', 'Arc : clique le point d\'arrivée (sens anti-horloger) ou tape l\'angle balayé (90).'] },
  cote: { nom: 'Cote', touche: 'q', aide: '' },
  point: { nom: 'Point de repère', touche: 'p', aide: ['Point de repère : clique le point de départ de la mesure (une accroche), ou tape x;y.', 'Point de repère : clique où le poser, ou tape le décalage dx;dy (30;15) ou distance<angle (25<45), puis Entrée. Il servira d\'accroche.'] },
  rappel: { nom: 'Rappel', touche: 'h', aide: ['Ligne de rappel : clique le point de départ.', 'Ligne de rappel : clique le point d\'arrivée (horizontal ou vertical, trait fin).'] },
  l45: { nom: '45°', touche: '', aide: ['Ligne à 45° : clique le point de départ.', 'Ligne à 45° : clique le point d\'arrivée (trait fin).'] },
  ajuster: { nom: 'Ajuster', touche: 't', aide: 'Ajuster : touche le morceau de trait à enlever (il est coupé aux intersections).' },
  prolonger: { nom: 'Prolonger', touche: 'x', aide: 'Prolonger : touche une ligne près du bout à allonger jusqu\'au trait suivant.' },
  chanfrein: { nom: 'Chanfrein', touche: '', aide: ['Chanfrein : touche la 1re ligne, du côté à garder.', 'Chanfrein : touche la 2e ligne, du côté à garder.'] },
  conge: { nom: 'Congé', touche: '', aide: ['Congé : touche la 1re ligne, du côté à garder.', 'Congé : touche la 2e ligne, du côté à garder.'] },
  hachures: { nom: 'Hachures', touche: 'w', aide: 'Hachures : touche l\'intérieur d\'une zone fermée par des traits.' },
  texte: { nom: 'Texte', touche: 'g', aide: 'Texte : écris le texte dans la barre, puis clique où le poser (point en bas à gauche du texte).' },
  gomme: { nom: 'Gomme', touche: 'e', aide: 'Gomme : touche un trait pour l\'effacer (Ctrl+Z pour le récupérer).' },
};
export const COTES = {
  lin: { nom: 'Linéaire', aide: ['Cote linéaire : clique le 1er point mesuré.', 'Cote : clique le 2e point mesuré.', 'Cote : place la ligne de cote (aimantée à 8 mm, puis tous les 7 mm) ou tape son écart, ex. 8 ↵.'] },
  al: { nom: 'Alignée', aide: ['Cote alignée : clique le 1er point.', 'Cote alignée : clique le 2e point.', 'Cote alignée : place la ligne de cote.'] },
  d: { nom: 'Diamètre', aide: ['Cote de diamètre : touche un cercle.', 'Cote de diamètre : choisis la direction de la ligne de cote.'] },
  r: { nom: 'Rayon', aide: ['Cote de rayon : touche un arc ou un cercle.', 'Cote de rayon : choisis la direction de la ligne de cote.'] },
  ang: { nom: 'Angle', aide: ['Cote d\'angle : clique le sommet.', 'Cote d\'angle : clique un point du 1er côté.', 'Cote d\'angle : clique un point du 2e côté.', 'Cote d\'angle : place l\'arc de cote.'] },
};
export const OPERATIONS = {
  deplacer: { nom: 'Déplacer', aide: ['Déplacer : clique le point de base.', 'Déplacer : clique la destination, ou tape dx;dy, longueur ou longueur<angle.'] },
  copier: { nom: 'Copier', aide: ['Copier : clique le point de base.', 'Copier : clique où poser la copie (ou tape dx;dy). Plusieurs copies possibles ; Échap pour finir.'] },
  miroir: { nom: 'Miroir', aide: ['Miroir : clique le 1er point de l\'axe de symétrie.', 'Miroir : clique le 2e point de l\'axe (les originaux sont gardés).'] },
};

const f2 = (v) => Math.round(v * 100) / 100;

/** SVG (en mm papier) d'une entité. */
export function svgEntite(p, e, cls = '') {
  if (e.t === 'q') return svgCote(p, e, cls);
  if (e.t === 'h') return svgHachure(p, e, cls);
  if (e.t === 'x') return svgTexte(p, e, cls);
  const k = facteur(p.echelle);
  const c = `dao-t dao-t-${e.s || 'v'}${cls ? ` ${cls}` : ''}`;
  if (e.t === 'p') {   // point de repère : petite croix (1,5 mm sur le papier)
    const [x, y] = versPapier(p, e.cx, e.cy), s = 1.5;
    return `<path class="${c} dao-repere-pt" d="M${f2(x - s)} ${f2(y)}H${f2(x + s)}M${f2(x)} ${f2(y - s)}V${f2(y + s)}"/>`;
  }
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

/**
 * Angle de la ligne en cours : horizontale de référence (tirets) + arc de 0° à l'angle + valeur.
 * t = 5 px écran en mm papier.
 */
function svgAngle(p, e, t) {
  const a = versPapier(p, e.x1, e.y1), b = versPapier(p, e.x2, e.y2);
  const Lp = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (Lp < t * 2) return '';
  const ang = angleDe([e.x1, e.y1], [e.x2, e.y2]), rad = (ang * Math.PI) / 180;
  const r = Math.min(Lp * 0.6, t * 9);
  const ref = `M${f2(a[0])} ${f2(a[1])}H${f2(a[0] + Math.max(r * 1.5, Math.min(Lp, t * 12)))}`;
  let arc = '';
  if (ang > 0.05 && ang < 359.95) {
    const ex = a[0] + r * Math.cos(rad), ey = a[1] - r * Math.sin(rad);
    arc = `M${f2(a[0] + r)} ${f2(a[1])}A${f2(r)} ${f2(r)} 0 ${ang > 180 ? 1 : 0} 0 ${f2(ex)} ${f2(ey)}`;
  }
  const m = (ang / 2) * (Math.PI / 180), rt = r + t * 1.2;
  const tx = a[0] + rt * Math.cos(m), ty = a[1] - rt * Math.sin(m) + t * 0.8 * (1 - Math.sin(m));
  const anc = Math.cos(m) > 0.3 ? 'start' : Math.cos(m) < -0.3 ? 'end' : 'middle';
  const v = Math.round(ang * 10) / 10;
  return `<g class="dao-angle"><path class="dao-angle-ref" d="${ref}"/>${arc ? `<path d="${arc}"/>` : ''}<text x="${f2(tx)}" y="${f2(ty)}" text-anchor="${anc}" style="font-size:${f2(t * 2.4)}px">${String(v).replace('.', ',')}°</text></g>`;
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
    sel: new Set(), op: null,     // sélection (indices) et opération en cours
    coteK: 'lin', cible: null,    // type de cote, cercle visé (Ø, R)
    ecartCote: null,              // écart tapé pour la ligne de cote (mm papier)
    param: { chanfrein: 5, conge: 5, texte: '', h: 3.5, pas: 3 }, choix: null,   // chanfrein, congé, texte, hachures
    cadre: null, survol: -1,      // cadre de sélection, trait sous la gomme
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
    const origine = ['ligne', 'rect', 'rappel', 'l45', 'point'].includes(st.outil) || st.op ? st.pts[st.pts.length - 1] : null;
    const orth = origine && (st.outil === 'rappel' || ((st.ortho || st.maj) && (st.outil === 'ligne' || st.outil === 'point' || st.op)));
    if (origine && st.outil === 'l45') {      // ligne à 45° : projection sur la diagonale la plus proche
      const dx = q[0] - origine[0], dy = q[1] - origine[1];
      const s = Math.sign(dx) === Math.sign(dy) ? 1 : -1;
      const m = (dx + s * dy) / 2;
      return [arrondi(origine[0] + m, 3), arrondi(origine[1] + s * m, 3)];
    }
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
    o.enregistrer(JSON.parse(st.hist.pop())); st.cache = null; st.sel.clear(); st.op = null; redessiner();
  }
  function retablir() {
    if (!st.refaire.length) return;
    st.hist.push(JSON.stringify(entites()));
    o.enregistrer(JSON.parse(st.refaire.pop())); st.cache = null; st.sel.clear(); st.op = null; redessiner();
  }

  /* ----- construction des entités ----- */
  /** Point posé pendant une opération sur la sélection. */
  function poserOp(q) {
    st.pts.push(q);
    if (st.pts.length < 2) { apercu(); return; }
    const [a, b] = st.pts; const es = entites(); const idx = [...st.sel];
    if (st.op === 'deplacer') {
      changer(es.map((e, i) => (st.sel.has(i) ? translater(e, b[0] - a[0], b[1] - a[1]) : e)));
      st.op = null; st.pts = [];
    } else if (st.op === 'copier') {
      changer([...es, ...idx.map((i) => translater(es[i], b[0] - a[0], b[1] - a[1]))]);
      st.pts = [a];
    } else if (st.op === 'miroir') {
      if (dist(a, b) > EPS) changer([...es, ...idx.map((i) => symetrie(es[i], a, b))]);
      st.op = null; st.pts = [];
    }
    apercu();
  }

  /** Position de la ligne de cote à « ecart » mm (papier) des points mesurés, du côté de la souris. */
  function ecartVersD(a, b, h, q, ecart) {
    const e = ecart / facteur(P().echelle);
    const lo = h ? Math.min(a[1], b[1]) : Math.min(a[0], b[0]), hi = h ? Math.max(a[1], b[1]) : Math.max(a[0], b[0]);
    const v = q ? (h ? q[1] : q[0]) : hi + 1;
    return v < (lo + hi) / 2 ? lo - e : hi + e;
  }
  /**
   * Aimant de la ligne de cote : à 8 mm (papier) des points mesurés, puis tous les 7 mm au-delà
   * (lignes de cote parallèles bien espacées), si la souris en est à moins de 2,5 mm.
   */
  function aimanterCote(a, b, h, v) {
    const k = facteur(P().echelle), tol = 2.5 / k;
    const lo = h ? Math.min(a[1], b[1]) : Math.min(a[0], b[0]), hi = h ? Math.max(a[1], b[1]) : Math.max(a[0], b[0]);
    const cands = [];
    for (let n = 0; n < 6; n++) { cands.push(hi + (8 + 7 * n) / k, lo - (8 + 7 * n) / k); }
    let best = v, bd = tol;
    for (const c of cands) if (Math.abs(c - v) < bd) { bd = Math.abs(c - v); best = c; }
    return best;
  }

  /** Cote en cours d'après les points posés et le point visé q (ou null). */
  function coteAvec(q) {
    const [a, b, c] = st.pts;
    if (st.coteK === 'lin' || st.coteK === 'al') {
      if (!a || !b || !q || dist(a, b) < EPS) return null;
      if (st.coteK === 'al') {
        const L = dist(a, b), nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
        return { t: 'q', k: 'al', x1: a[0], y1: a[1], x2: b[0], y2: b[1], d: arrondi((q[0] - a[0]) * nx + (q[1] - a[1]) * ny, 3), s: 'n' };
      }
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const h = Math.abs(a[0] - b[0]) < EPS ? false : Math.abs(a[1] - b[1]) < EPS ? true : Math.abs(q[1] - my) >= Math.abs(q[0] - mx);
      const d = st.ecartCote != null ? ecartVersD(a, b, h, q, st.ecartCote) : aimanterCote(a, b, h, h ? q[1] : q[0]);
      return h ? { t: 'q', k: 'h', x1: a[0], y1: a[1], x2: b[0], y2: b[1], d: arrondi(d, 3), s: 'n' } : { t: 'q', k: 'v', x1: a[0], y1: a[1], x2: b[0], y2: b[1], d: arrondi(d, 3), s: 'n' };
    }
    if (st.coteK === 'd' || st.coteK === 'r') {
      if (!st.cible || !q) return null;
      const e = st.cible;
      return { t: 'q', k: st.coteK, cx: e.cx, cy: e.cy, r: e.r, a: arrondi(angleDe([e.cx, e.cy], q), 3), s: 'n' };
    }
    if (st.coteK === 'ang') {
      if (!c || !q) return null;
      let a0 = angleDe(a, b), a1 = angleDe(a, c);
      if (((a1 - a0 + 360) % 360) > 180) [a0, a1] = [a1, a0];
      if (a1 <= a0) a1 += 360;
      const r = dist(a, q);
      return r > EPS ? { t: 'q', k: 'ang', cx: a[0], cy: a[1], a0: arrondi(a0, 4), a1: arrondi(a1, 4), r: arrondi(r, 3), s: 'n' } : null;
    }
    return null;
  }

  function poserCote(q) {
    const k = st.coteK;
    if (k === 'd' || k === 'r') {
      if (!st.cible) {
        const tol = toleranceReel(12);
        let best = null, bd = tol;
        for (const e of entites()) if ((e.t === 'c' || e.t === 'a') && distanceA(e, q) <= bd) { bd = distanceA(e, q); best = e; }
        if (!best) { apercu(k === 'd' ? 'Touche le bord d\'un cercle.' : 'Touche le bord d\'un arc ou d\'un cercle.'); return; }
        st.cible = best; apercu(); return;
      }
      const e = coteAvec(q); st.cible = null; if (e) ajouter(e); apercu(); return;
    }
    const n = k === 'ang' ? 3 : 2;
    if (st.pts.length < n) { st.pts.push(q); apercu(); return; }
    const e = coteAvec(q); st.pts = []; if (e) ajouter(e); apercu();
  }

  function poser(q) {
    if (st.op) { poserOp(q); return; }
    if (st.outil === 'cote') { poserCote(q); return; }
    if (st.outil === 'texte') {
      const txt = String(st.param.texte || '').trim();
      if (!txt) { apercu('Écris d\'abord le texte dans la barre au-dessus de la feuille.'); return; }
      ajouter({ t: 'x', x: arrondi(q[0], 3), y: arrondi(q[1], 3), txt, h: st.param.h, hr: arrondi(st.param.h / facteur(P().echelle), 3), s: 'n' });
      return;
    }
    if (st.outil === 'point') {
      if (!st.pts.length) st.pts.push(q); else { ajouter({ t: 'p', cx: arrondi(q[0], 4), cy: arrondi(q[1], 4), s: 'n' }); st.pts = []; }
      apercu(); return;
    }
    if (st.outil === 'rappel' || st.outil === 'l45') {
      const der0 = st.pts[0];
      if (!der0) { st.pts.push(q); } else { if (dist(der0, q) > EPS) ajouter({ t: 'l', x1: der0[0], y1: der0[1], x2: q[0], y2: q[1], s: 'n' }); st.pts = []; }
      apercu(); return;
    }
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
  function finir() { st.pts = []; st.saisie = ''; st.op = null; st.cible = null; st.choix = null; apercu(); }

  /** Applique la saisie clavier (Entrée). */
  function appliquerSaisie() {
    const v = lireSaisie(st.saisie);
    st.saisie = '';
    if (!v) { apercu('Saisie non comprise : exemples 50 · 50<30 · 20;-10 · Ø30'); return; }
    if (st.outil === 'cote') {                      // cote : écart de la ligne de cote (mm papier), du côté de la souris
      if ((st.coteK === 'lin' || st.coteK === 'al') && st.pts.length === 2 && v.lg != null && v.lg > 0) {
        const [a, b] = st.pts;
        let e;
        if (st.coteK === 'al') {
          const L = dist(a, b), nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L, q = st.cur || [a[0] + nx, a[1] + ny];
          const sgn = (q[0] - a[0]) * nx + (q[1] - a[1]) * ny < 0 ? -1 : 1;
          e = { t: 'q', k: 'al', x1: a[0], y1: a[1], x2: b[0], y2: b[1], d: arrondi(sgn * v.lg / facteur(P().echelle), 3), s: 'n' };
        } else { st.ecartCote = v.lg; e = coteAvec(st.cur || [b[0] + 1, b[1] + 1]); st.ecartCote = null; }
        st.pts = []; if (e) ajouter(e); apercu(); return;
      }
      apercu('Cote : après les 2 points, tape l\'écart de la ligne de cote (ex. 8) puis Entrée.'); return;
    }
    const der = st.pts[st.pts.length - 1];
    const cur = st.cur || der;
    if (!der) {                                     // 1er point : x;y
      if (v.dx != null) poser([v.dx, v.dy]); else apercu('Pour le 1er point, tape x;y (ex. 20;30).');
      return;
    }
    const dirVers = (lg) => {
      let c = cur && dist(cur, der) > EPS ? cur : [der[0] + 1, der[1]];
      if (st.ortho || st.maj || st.outil === 'rappel') c = ortho(der, c);
      const d = dist(der, c) || 1;
      return [der[0] + ((c[0] - der[0]) / d) * lg, der[1] + ((c[1] - der[1]) / d) * lg];
    };
    const polaire = (lg, ang) => [der[0] + lg * Math.cos((ang * Math.PI) / 180), der[1] + lg * Math.sin((ang * Math.PI) / 180)];
    if (st.outil === 'l45' && v.lg != null && v.dx == null) {
      const c = cur || [der[0] + 1, der[1] + 1]; const sx = Math.sign(c[0] - der[0]) || 1, sy = Math.sign(c[1] - der[1]) || 1;
      const m = v.lg / Math.SQRT2; poser([der[0] + sx * m, der[1] + sy * m]); return;
    }
    if (st.outil === 'ligne' || st.outil === 'rappel' || st.outil === 'point' || st.op) {
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
    const es = entites();   // hachures dessous, puis le reste
    o.feuille.calque('dessin').innerHTML = es.filter((e) => e.t === 'h').map((e) => svgEntite(p, e)).join('') + es.filter((e) => e.t !== 'h').map((e) => svgEntite(p, e)).join('');
    apercu();
  }

  /** Entité en cours de construction (aperçu), ou null. */
  function enCours() {
    if (st.outil === 'cote' && st.cible && st.cur) return coteAvec(st.cur);
    const der = st.pts[st.pts.length - 1], q = st.cur;
    if (!der || !q) return null;
    if (st.op) return { t: 'l', x1: der[0], y1: der[1], x2: q[0], y2: q[1], s: 'n', aide: true };
    if (st.outil === 'rappel' || st.outil === 'l45') return { t: 'l', x1: der[0], y1: der[1], x2: q[0], y2: q[1], s: 'n' };
    if (st.outil === 'point') return { t: 'l', x1: der[0], y1: der[1], x2: q[0], y2: q[1], s: 'n', aide: true, pt: true };
    if (st.outil === 'cote') return coteAvec(q) || { t: 'l', x1: der[0], y1: der[1], x2: q[0], y2: q[1], s: 'n', aide: true };
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

  /**
   * Valeur qu'on peut taper maintenant (pour la case de saisie) : null si rien,
   * sinon { titre, exemple }.
   */
  function attente() {
    if (st.op) return st.pts.length ? { titre: 'Déplacement', exemple: '20;0 ou 15<90' } : null;
    const n = st.pts.length;
    switch (st.outil) {
      case 'ligne': return n ? { titre: 'Longueur', exemple: '50', angle: true } : { titre: '1er point x;y', exemple: '20;30', premier: true };
      case 'rappel': return n ? { titre: 'Longueur', exemple: '15 · 40<30 · 20;-10' } : { titre: '1er point x;y', exemple: '20;30', premier: true };
      case 'l45': return n ? { titre: 'Longueur', exemple: '25' } : null;
      case 'point': return n ? { titre: 'Décalage', exemple: '30;15 · 25<45' } : { titre: 'Départ x;y', exemple: '20;30', premier: true };
      case 'rect': return n ? { titre: 'Côtés', exemple: '40;25 ou 30' } : { titre: '1er coin x;y', exemple: '20;30', premier: true };
      case 'cercle': return n ? { titre: 'Rayon (ou Ø)', exemple: '10 ou Ø20' } : { titre: 'Centre x;y', exemple: '50;40', premier: true };
      case 'arc': return n === 1 ? { titre: 'Rayon', exemple: '15 ou 15<90' } : n === 2 ? { titre: 'Angle (°)', exemple: '90 ou -90' } : { titre: 'Centre x;y', exemple: '50;40', premier: true };
      case 'cote': return (st.coteK === 'lin' || st.coteK === 'al') && n === 2 ? { titre: 'Écart de la ligne de cote', exemple: '8' } : null;
      default: return null;
    }
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
      if (e.t === 'q') info = '';
      else if (e.t === 'l' && !e.aide) {
        const ang = arrondi(angleDe([e.x1, e.y1], [e.x2, e.y2]), 1);
        info = `${mesure(e)} · ${ang}°${ang > 180 ? ` (−${arrondi(360 - ang, 1)}°)` : ''}`;
        svg += svgAngle(p, e, t);
      } else if (e.pt) {
        const dx = arrondi(e.x2 - e.x1, 2), dy = arrondi(e.y2 - e.y1, 2);
        info = `dx ${dx} · dy ${dy} · ${arrondi(dist([e.x1, e.y1], [e.x2, e.y2]), 2)} mm`;
        svg += svgEntite(p, { t: 'p', cx: e.x2, cy: e.y2, s: 'n' }, 'dao-ap');
      } else if (e.t === 'l') info = `R ${arrondi(dist([e.x1, e.y1], [e.x2, e.y2]), 2)} mm`;
      else info = mesure(e);
    }
    const es = entites();
    for (const i of st.sel) if (es[i]) svg += svgEntite(p, es[i], 'dao-sel');
    if (st.survol >= 0 && es[st.survol]) svg += svgEntite(p, es[st.survol], st.outil === 'gomme' || st.outil === 'ajuster' ? 'dao-gomme' : 'dao-sel');
    if (st.choix && es[st.choix.i]) svg += svgEntite(p, es[st.choix.i], 'dao-sel');
    if (st.op && st.pts.length && st.cur) {
      const [a, b] = [st.pts[0], st.cur];
      for (const i of st.sel) {
        if (!es[i]) continue;
        const g = st.op === 'miroir' ? (dist(a, b) > EPS ? symetrie(es[i], a, b) : null) : translater(es[i], b[0] - a[0], b[1] - a[1]);
        if (g) svg += svgEntite(p, g, 'dao-ap');
      }
    }
    if (st.cadre) {
      const [a, b] = st.cadre.map((q) => versPapier(p, q[0], q[1]));
      const fen = st.cadre[1][0] >= st.cadre[0][0];
      svg += `<rect class="dao-cadre-sel${fen ? '' : ' dao-cadre-tch'}" x="${f2(Math.min(a[0], b[0]))}" y="${f2(Math.min(a[1], b[1]))}" width="${f2(Math.abs(b[0] - a[0]))}" height="${f2(Math.abs(b[1] - a[1]))}"/>`;
    }
    for (const q of st.pts) { const [x, y] = versPapier(p, q[0], q[1]); svg += `<circle class="dao-pt" cx="${f2(x)}" cy="${f2(y)}" r="${f2(t * 0.45)}"/>`; }
    if (st.acc) {   // accroche : symbole + son nom à côté
      svg += svgAccroche(p, st.acc, t * 1.4);
      const [x, y] = versPapier(p, st.acc[0], st.acc[1]);
      svg += `<text class="dao-acc-t" x="${f2(x + t * 2.2)}" y="${f2(y - t * 1.8)}" style="font-size:${f2(t * 2.4)}px">${NOM_ACC[st.acc[2]] || ''}</text>`;
    }
    if (info && st.cur && e && (!e.aide || e.pt)) {   // mesure en direct, à côté du curseur
      const [x, y] = versPapier(p, st.cur[0], st.cur[1]);
      const h = t * 2.4;    // ≈ 12 px à l'écran
      svg += `<g class="dao-bulle"><rect x="${f2(x + t * 3)}" y="${f2(y + t * 2.4)}" width="${f2(info.length * h * 0.56 + h)}" height="${f2(h * 1.55)}" rx="${f2(h * 0.35)}"/><text x="${f2(x + t * 3 + h * 0.5)}" y="${f2(y + t * 2.4 + h * 1.12)}" style="font-size:${f2(h)}px">${info.replace(/</g, '&lt;')}</text></g>`;
    }
    o.feuille.calque('apercu').innerHTML = svg;
    const aide = st.op ? OPERATIONS[st.op].aide : st.outil === 'cote' ? COTES[st.coteK].aide : OUTILS[st.outil].aide;
    const etape = (st.outil === 'cote' && st.cible) || st.choix ? 1 : st.pts.length;
    if (st.outil === 'cote' && st.cible) info = 'cercle choisi';
    o.surEtat({
      aide: message || (Array.isArray(aide) ? aide[Math.min(etape, aide.length - 1)] : aide),
      saisie: st.saisie, mesure: info, accroche: st.acc ? NOM_ACC[st.acc[2]] : '', ortho: st.ortho,
      annuler: st.hist.length > 0 || st.pts.length > 0, retablir: st.refaire.length > 0,
      sel: st.sel.size, op: st.op, coteK: st.coteK, param: st.param,
      attente: attente(),
      enCours: st.pts.length > 0 || !!st.cible || !!st.op,
    });
  }

  /* ----- événements venant de la feuille ----- */
  function surPointeur(type, ev, pp) {
    if (st.outil === 'main') return pp;
    if (type === 'annule') { st.bas = null; st.cadre = null; apercu(); return null; }
    if (type === 'droit') { finir(); return pp; }
    st.maj = !!ev?.shiftKey;
    if (['gomme', 'ajuster', 'prolonger', 'chanfrein', 'conge', 'hachures'].includes(st.outil) || (st.outil === 'selection' && !st.op)) return pointerSansAccroche(type, ev, pp);
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

  /** Sélection et gomme : point brut (sans accroche). */
  function pointerSansAccroche(type, ev, pp) {
    const p = P();
    const q = versReel(p, pp[0], pp[1]);
    const tol = toleranceReel(9);
    st.acc = null; st.cur = q;
    const es = entites();
    if (st.outil === 'gomme') {
      st.survol = toucher(es, q, tol);
      if (type === 'haut' && st.survol >= 0) { const i = st.survol; st.survol = -1; changer(es.filter((_, k) => k !== i)); return pp; }
      apercu(); return pp;
    }
    if (st.outil === 'hachures') {
      if (type === 'haut') {
        const z = regionAutour(es, q);
        if (!z) apercu('Pas de zone fermée ici : vérifie que le contour est bien fermé (traits qui se touchent).');
        else changer([...es, { t: 'h', pts: z.pts, ...(z.trous.length ? { trous: z.trous } : {}), ang: 45, pas: st.param.pas, s: 'n' }]);
      } else apercu();
      return pp;
    }
    if (st.outil !== 'selection') {           // ajuster, prolonger, chanfrein, congé
      const traits = es.map((e, k) => (e.t === 'l' || e.t === 'c' || e.t === 'a' ? k : null)).filter((k) => k != null);
      const k = toucher(traits.map((x) => es[x]), q, tol);
      st.survol = k >= 0 ? traits[k] : -1;
      if (type !== 'haut' || st.survol < 0) { apercu(); return pp; }
      const i = st.survol; st.survol = -1;
      let res;
      if (st.outil === 'ajuster') res = ajuster(es, i, q);
      else if (st.outil === 'prolonger') res = prolonger(es, i, q);
      else if (!st.choix) { if (es[i].t !== 'l') { apercu('Choisis une ligne droite.'); return pp; } st.choix = { i, c: q }; apercu(); return pp; }
      else {
        res = st.outil === 'chanfrein' ? chanfrein(es, st.choix.i, st.choix.c, i, q, st.param.chanfrein) : conge(es, st.choix.i, st.choix.c, i, q, st.param.conge);
        st.choix = null;
      }
      if (typeof res === 'string') apercu(res); else changer(res);
      return pp;
    }
    if (type === 'bas') st.bas = { x: ev.clientX, y: ev.clientY, q };
    if (type === 'bouge' && st.bas && Math.hypot(ev.clientX - st.bas.x, ev.clientY - st.bas.y) > 8) st.cadre = [st.bas.q, q];
    if (type === 'haut' && st.bas) {
      const ajout = ev.shiftKey || ev.ctrlKey;
      if (st.cadre) {
        const fen = st.cadre[1][0] >= st.cadre[0][0];
        const trouves = dansRectangle(es, st.cadre[0], st.cadre[1], fen);
        if (!ajout) st.sel.clear();
        trouves.forEach((i) => st.sel.add(i));
      } else {
        const i = toucher(es, q, tol);
        if (i < 0) { if (!ajout) st.sel.clear(); } else if (ajout) { st.sel.has(i) ? st.sel.delete(i) : st.sel.add(i); } else { st.sel = new Set([i]); }
      }
      st.cadre = null; st.bas = null;
    }
    apercu(); return pp;
  }

  function supprimerSelection() {
    if (!st.sel.size) return;
    const s = st.sel; st.sel = new Set(); st.op = null;
    changer(entites().filter((_, i) => !s.has(i)));
  }
  function lancerOp(op) { if (!st.sel.size) return; st.op = op; st.pts = []; st.saisie = ''; apercu(); }

  /** Clavier (renvoie true si la touche a été utilisée). */
  function clavier(ev) {
    if (ev.ctrlKey || ev.metaKey) {
      const k = ev.key.toLowerCase();
      if (k === 'z' && !ev.shiftKey) { annuler(); return true; }
      if (k === 'y' || (k === 'z' && ev.shiftKey)) { retablir(); return true; }
      if (k === 'a') { choisirOutil('selection'); st.sel = new Set(entites().map((_, i) => i)); apercu(); return true; }
      return false;
    }
    if (ev.key === 'F8') { st.ortho = !st.ortho; apercu(); return true; }
    if (ev.key === 'Escape') { if (st.saisie) st.saisie = ''; else if (st.op || st.pts.length) finir(); else st.sel.clear(); apercu(); return true; }
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && !st.saisie && st.sel.size && !st.op) { supprimerSelection(); return true; }
    if (ev.key === 'Enter' && st.saisie) { appliquerSaisie(); return true; }
    if (ev.key === 'Backspace' && st.saisie) { st.saisie = st.saisie.slice(0, -1); apercu(); return true; }
    const enSaisie = st.saisie.length > 0;
    if (/^[0-9.,;<\-]$/.test(ev.key) || (/^[dDøØ]$/.test(ev.key) && !enSaisie && st.outil === 'cercle' && st.pts.length)) {
      if (!attente()) return false;
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

  function choisirOutil(t) {
    st.outil = t; st.pts = []; st.saisie = ''; st.acc = null; st.op = null; st.survol = -1; st.cadre = null; st.cible = null; st.choix = null;
    if (t !== 'selection') st.sel.clear();
    o.surOutil?.(t); apercu();
  }
  function choisirStyle(s) {
    if (st.outil === 'selection' && st.sel.size) { changer(entites().map((e, i) => (st.sel.has(i) ? { ...e, s } : e))); return; }
    st.style = s; o.surStyle?.(s); apercu();
  }

  redessiner();
  return {
    surPointeur, clavier, annuler, retablir, redessiner,
    outil: () => st.outil, style: () => st.style,
    choisirOutil, choisirStyle,
    basculerOrtho() { st.ortho = !st.ortho; apercu(); return st.ortho; },
    toutEffacer() { st.sel.clear(); st.op = null; if (entites().length) changer([]); },
    /** Ajoute des entités toutes faites (ex. vues d'une pièce) ; annulable. */
    inserer(es) { if (es.length) changer([...entites(), ...es]); },
    supprimerSelection, lancerOp,
    reglerParam(nom, v) { if (nom === 'texte') st.param.texte = v; else if (v > 0) st.param[nom] = v; },
    /** Saisie venant de la case à l'écran (tablette) : comme taper la valeur puis Entrée. */
    /** Termine le tracé en cours (comme Échap ou le clic droit) : utile au stylet. */
    terminer() { finir(); },
        saisir(txt) { st.saisie = String(txt || ''); if (st.saisie) appliquerSaisie(); else apercu(); },
        choisirCote(k) { st.coteK = k; st.pts = []; st.cible = null; if (st.outil !== 'cote') choisirOutil('cote'); else apercu(); },
    /** À appeler quand l'échelle ou le format change (les entités restent en mm réels). */
    rafraichir() { st.cache = null; redessiner(); },
  };
}
