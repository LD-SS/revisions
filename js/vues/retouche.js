/* =====================================================================
   VUE — RETOUCHE DE LA COTATION D'UNE PERSPECTIVE (admin)
   ---------------------------------------------------------------------
   #/dessin/retouche/<id pièce>
   La perspective est affichée sans cotes ; la cotation (automatique ou
   déjà retouchée) devient une liste d'objets modifiables (js/dao/retouches.js) :
     Sélection : glisser un chiffre (le déplace), une ligne de cote (la
       rapproche / l'éloigne de la pièce), un renvoi (son coude ; près du
       point d'attache : le point). Suppr : supprimer.
     Cote : point 1, point 2 (accroche sur les sommets et les trous), puis
       la position de la ligne de cote ; le chiffre proposé est la vraie
       longueur (3D) quand les deux points sont des sommets.
     Renvoi : point visé, puis coude ; texte proposé « Øx » sur un trou.
     Texte : texte libre.  Gomme : toucher un objet le supprime.
   Enregistrer : Firestore (content/dessin/retouches-cotes.json), pour tous.
   Automatique : supprime la retouche de cette pièce.
   ===================================================================== */

import { esc, toast } from '../utils.js';
import { icone } from '../icones.js';
import { CAHIER } from '../dao/cahier.js';
import { svgPrisme } from '../dao/prisme.js';
import { flecheFace } from '../dao/perspective.js';
import { svgObjet, boiteTexte, bornesObjet, definirRetouches, toutesRetouches, CHEMIN_RETOUCHES } from '../dao/retouches.js';

const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
// directions des lignes d'attache : les 3 axes de la perspective (et leurs opposés)
const AXES = [[C30, -S30], [-C30, -S30], [0, -1], [-C30, S30], [C30, S30], [0, 1]];
const r2 = (v) => Math.round(v * 100) / 100;
const nb = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const len = (a) => Math.hypot(a[0], a[1]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const distSeg = (p, a, b) => { const d = sub(b, a), L2 = dot(d, d), t = L2 ? Math.max(0, Math.min(1, dot(sub(p, a), d) / L2)) : 0; return len(sub(p, add(a, mul(d, t)))); };
const angleAligne = (A, B) => { let a = (Math.atan2(B[1] - A[1], B[0] - A[0]) * 180) / Math.PI; if (a > 90) a -= 180; if (a < -90) a += 180; return a; };

export async function vueRetouche(el, id) {
  const compte = await import('../compte.js');
  if (!compte.estAdmin()) { el.innerHTML = '<div class="error-box">Réservé à l\'administrateur.</div>'; return null; }
  const ex = CAHIER.find((e) => e.piece?.id === id);
  const pc = ex?.piece;
  if (!pc || !pc.p3) {
    el.innerHTML = `<div class="error-box">Pièce « ${esc(id)} » introuvable, ou pas encore retouchable (seules les pièces prismatiques du cahier le sont pour l'instant).</div><p><a class="btn" href="#/dessin">Retour</a></p>`;
    return null;
  }
  // relire les retouches (un autre appareil a pu enregistrer entre-temps)
  try { definirRetouches(await compte.lireContenu(CHEMIN_RETOUCHES)); } catch { /* pas encore de fichier */ }
  const base = svgPrisme(pc, { brut: true, fleche: flecheFace });
  let objs = JSON.parse(JSON.stringify(base.objs));
  const dejaRetouchee = !!toutesRetouches()[id];
  const hist = [], refaire = [];
  let outil = 'sel', sel = -1, etape = [], survol = null, drag = null, modifie = false;

  el.innerHTML = `
    <div class="rt">
      <div class="rt-tete">
        <button class="btn" data-a="retour">${icone('fleche-g')} Retour</button>
        <h2>Cotation : ${esc(ex.n)}. ${esc(ex.titre)}</h2>
        <span class="muted rt-etat">${dejaRetouchee ? 'Cotation retouchée' : 'Cotation automatique'}</span>
      </div>
      <div class="rt-barre">
        ${[['sel', 'Sélection'], ['cote', 'Cote'], ['renvoi', 'Renvoi'], ['texte', 'Texte'], ['gomme', 'Gomme']].map(([k, n]) => `<button class="btn" data-o="${k}">${n}</button>`).join('')}
        <span class="rt-sep"></span>
        <button class="btn" data-a="annuler" title="Ctrl+Z">↶</button>
        <button class="btn" data-a="refaire" title="Ctrl+Y">↷</button>
        <button class="btn" data-a="suppr" title="Suppr">Supprimer</button>
        <span class="rt-sep"></span>
        <button class="btn" data-a="zm" title="Dézoomer">−</button>
        <button class="btn" data-a="zp" title="Zoomer">+</button>
        <button class="btn" data-a="z0" title="Revoir toute la pièce">⤢</button>
        <span class="rt-sep"></span>
        <button class="btn" data-a="auto" title="Abandonner la retouche de cette pièce">Automatique</button>
        <button class="btn primary" data-a="enreg">Enregistrer</button>
      </div>
      <div class="rt-prop" hidden>
        <label>Texte <input type="text" class="rt-txt" size="14"></label>
        <button class="btn" data-a="horiz">Chiffre horizontal / aligné</button>
        <button class="btn" data-a="cote-r">Renvoi : gauche / droite</button>
      </div>
      <p class="muted rt-aide"></p>
      <div class="rt-zone"><svg class="rt-svg" xmlns="http://www.w3.org/2000/svg"></svg></div>
    </div>`;
  const svg = el.querySelector('.rt-svg'), aide = el.querySelector('.rt-aide'), prop = el.querySelector('.rt-prop'), champ = el.querySelector('.rt-txt');

  // cadre : la pièce et la cotation, avec une marge pour pouvoir éloigner les cotes
  const pts = [...base.corpsBornes, ...objs.flatMap(bornesObjet)];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), M = 40;
  let vb = [Math.min(...xs) - M, Math.min(...ys) - M, Math.max(...xs) - Math.min(...xs) + 2 * M, Math.max(...ys) - Math.min(...ys) + 2 * M];
  const vb0 = [...vb];
  const appliquerVb = () => svg.setAttribute('viewBox', vb.map(r2).join(' '));
  appliquerVb();
  const echelle = () => { const m = svg.getScreenCTM(); return m && m.a ? 1 / m.a : vb[2] / Math.max(svg.clientWidth, 1); };   // unités dessin par pixel écran

  const AIDES = {
    sel: 'Glisse un chiffre pour le déplacer, une ligne de cote pour la rapprocher ou l\'éloigner, un renvoi par son coude. Glisse le fond pour te déplacer, molette pour zoomer.',
    cote: ['Cote : clique le 1er point (sommet ou trou).', 'Cote : clique le 2e point.', 'Cote : place la ligne de cote (clic). Échap pour annuler.'],
    renvoi: ['Renvoi : clique le point visé (un trou par exemple).', 'Renvoi : clique la position du coude.'],
    texte: 'Texte : clique où placer le texte, puis tape-le dans la case « Texte ».',
    gomme: 'Gomme : touche une cote, un renvoi ou un texte pour le supprimer.',
  };
  const majAide = () => { const a = AIDES[outil]; aide.textContent = Array.isArray(a) ? a[Math.min(etape.length, a.length - 1)] : a; };

  function memoriser() { hist.push(JSON.stringify(objs)); if (hist.length > 100) hist.shift(); refaire.length = 0; modifie = true; }
  function majProp() {
    const o = objs[sel];
    prop.hidden = !o;
    if (!o) return;
    if (document.activeElement !== champ) champ.value = o.txt ?? '';
    prop.querySelector('[data-a="horiz"]').hidden = o.t !== 'q';
    prop.querySelector('[data-a="cote-r"]').hidden = o.t !== 'r';
  }

  /** Point accroché (sommet ou centre de trou) le plus proche, sinon le point lui-même. */
  function accroche(p) {
    const tol = 10 * echelle();
    let best = null, bd = tol;
    for (const s of base.sommets) { const d = Math.hypot(s[0] - p[0], s[1] - p[1]); if (d < bd) { bd = d; best = s; } }
    return best ? { p: [best[0], best[1]], p3: best[2], d: best[3] } : { p, p3: null };
  }
  /** Objet sous le point (indice) et partie touchée. */
  function toucher(p) {
    const tol = 7 * echelle();
    let best = -1, bd = tol, partie = null;
    objs.forEach((o, i) => {
      const b = boiteTexte(o);
      if (b && p[0] >= b[0] - 2 && p[0] <= b[2] + 2 && p[1] >= b[1] - 2 && p[1] <= b[3] + 2) { if (bd > 0) { bd = 0; best = i; partie = 'texte'; } return; }
      const segs = o.t === 'q' ? [['ligne', o.d], ['ligne', o.e1], ['ligne', o.e2]] : o.t === 'r' ? [['coude', [o.c, o.q]]] : [];
      for (const [nom, s] of segs) {
        if (!s) continue;
        const d = distSeg(p, s[0], s[1]);
        if (d < bd) { bd = d; best = i; partie = nom; }
      }
      if (o.t === 'r') { const d = len(sub(p, o.c)); if (d < tol * 1.2 && d <= bd) { bd = d; best = i; partie = 'point'; } }
    });
    return best < 0 ? null : { i: best, partie };
  }

  /** Cote provisoire de A à B, ligne passant par le point m. */
  function coteVers(A, B, m, valeur) {
    const mil = mul(add(A, B), 0.5), v = sub(m, mil), ab = unit(sub(B, A));
    let dir = AXES[0], bs = -Infinity;
    for (const ax of AXES) { if (Math.abs(dot(ax, ab)) > 0.95) continue; const s = dot(ax, unit(v)); if (s > bs) { bs = s; dir = ax; } }
    const k = Math.max(dot(v, dir), 4);
    const Ao = add(A, mul(dir, k)), Bo = add(B, mul(dir, k));
    const nrm = dir, mt = add(mul(add(Ao, Bo), 0.5), mul(nrm, 4));
    return { t: 'q', e1: [A, Ao], e2: [B, Bo], d: [Ao, Bo], txt: valeur, m: [mt[0], mt[1] + 3], ang: angleAligne(Ao, Bo), an: 'middle' };
  }

  function dessiner() {
    let s = `<rect x="${vb0[0] - 2000}" y="${vb0[1] - 2000}" width="${vb0[2] + 4000}" height="${vb0[3] + 4000}" fill="#fff"/>` + base.corps + base.vf;
    objs.forEach((o, i) => { s += svgObjet(o, `data-i="${i}" class="rt-obj${i === sel ? ' rt-sel' : ''}"`); });
    // tracé en cours
    if (outil === 'cote' && etape.length === 2 && survol) s += svgObjet(coteVers(etape[0].p, etape[1].p, survol, '…'), 'class="rt-prov"');
    if (outil === 'renvoi' && etape.length === 1 && survol) s += svgObjet({ t: 'r', c: etape[0].p, q: survol, sg: survol[0] < etape[0].p[0] ? -1 : 1, txt: '…' }, 'class="rt-prov"');
    for (const e of etape) s += `<circle cx="${r2(e.p[0])}" cy="${r2(e.p[1])}" r="${r2(3 * echelle())}" fill="#e11d48"/>`;
    if (survol && ['cote', 'renvoi'].includes(outil)) { const a = accroche(survol); if (a.p3) s += `<circle cx="${r2(a.p[0])}" cy="${r2(a.p[1])}" r="${r2(5 * echelle())}" fill="none" stroke="#e11d48" stroke-width="${r2(1.2 * echelle())}"/>`; }
    svg.innerHTML = s;
    el.querySelectorAll('[data-o]').forEach((b) => b.classList.toggle('primary', b.dataset.o === outil));
    majProp(); majAide();
  }

  const versDessin = (ev) => { const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const q = pt.matrixTransform(svg.getScreenCTM().inverse()); return [q.x, q.y]; };

  function choisirOutil(o) { outil = o; etape = []; if (o !== 'sel') sel = -1; dessiner(); }

  svg.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    const p = versDessin(ev);
    if (outil === 'sel') {
      const t = toucher(p);
      if (t) {
        sel = t.i;   // l'historique est mémorisé seulement si on bouge (voir pointermove)
        drag = { i: t.i, partie: t.partie, depart: p, avant: JSON.stringify(objs), bouge: false };
      } else { sel = -1; drag = { fond: true, depart: [ev.clientX, ev.clientY], vb: [...vb] }; }
      svg.setPointerCapture(ev.pointerId); dessiner(); return;
    }
    if (outil === 'gomme') { const t = toucher(p); if (t) { memoriser(); objs.splice(t.i, 1); sel = -1; dessiner(); } return; }
    if (outil === 'texte') { memoriser(); objs.push({ t: 'x', m: p, txt: 'texte', ang: 0, an: 'middle' }); sel = objs.length - 1; outil = 'sel'; dessiner(); champ.focus(); champ.select(); return; }
    if (outil === 'cote') {
      if (etape.length < 2) { etape.push(accroche(p)); dessiner(); return; }
      const [a, b] = etape;
      const val = a.p3 && b.p3 ? nb(Math.hypot(a.p3[0] - b.p3[0], a.p3[1] - b.p3[1], a.p3[2] - b.p3[2])) : '';
      memoriser(); objs.push(coteVers(a.p, b.p, p, val)); sel = objs.length - 1; etape = []; dessiner();
      champ.focus(); champ.select(); return;
    }
    if (outil === 'renvoi') {
      if (!etape.length) { etape.push(accroche(p)); dessiner(); return; }
      const a = etape[0];
      memoriser(); objs.push({ t: 'r', c: a.p, q: p, sg: p[0] < a.p[0] ? -1 : 1, txt: a.d ? `Ø${nb(a.d)}` : '' }); sel = objs.length - 1; etape = []; dessiner();
      champ.focus(); champ.select();
    }
  });
  svg.addEventListener('pointermove', (ev) => {
    const p = versDessin(ev);
    if (!drag) { if (outil !== 'sel' && outil !== 'gomme') { survol = p; dessiner(); } return; }
    if (drag.fond) {
      const k = echelle();
      vb[0] = drag.vb[0] - (ev.clientX - drag.depart[0]) * k; vb[1] = drag.vb[1] - (ev.clientY - drag.depart[1]) * k; appliquerVb(); return;
    }
    const o0 = JSON.parse(drag.avant)[drag.i], o = objs[drag.i];
    const delta = sub(p, drag.depart);
    if (!drag.bouge && len(delta) < 2 * echelle()) return;
    if (!drag.bouge) { hist.push(drag.avant); refaire.length = 0; modifie = true; drag.bouge = true; }
    const tr = (pt, v) => add(pt, v);
    if (o.t === 'q') {
      if (drag.partie === 'texte') { o.m = tr(o0.m, delta); if (o0.rp) o.rp = [o0.rp[0], tr(o0.rp[1], delta)]; }
      else {
        // la ligne de cote glisse le long des lignes d'attache
        const dir = len(sub(o0.e1[1], o0.e1[0])) > 0.5 ? unit(sub(o0.e1[1], o0.e1[0])) : unit([-(o0.d[1][1] - o0.d[0][1]), o0.d[1][0] - o0.d[0][0]]);
        const v = mul(dir, dot(delta, dir));
        o.e1 = [o0.e1[0], tr(o0.e1[1], v)]; o.e2 = [o0.e2[0], tr(o0.e2[1], v)];
        if (o0.d) o.d = [tr(o0.d[0], v), tr(o0.d[1], v)];
        if (o0.m) o.m = tr(o0.m, v);
        if (o0.rp) o.rp = [tr(o0.rp[0], v), tr(o0.rp[1], v)];
      }
    } else if (o.t === 'r') {
      if (drag.partie === 'point') o.c = accroche(tr(o0.c, delta)).p;
      else { o.q = tr(o0.q, delta); }
    } else o.m = tr(o0.m, delta);
    dessiner();
  });
  const finDrag = () => { drag = null; };
  svg.addEventListener('pointerup', finDrag);
  svg.addEventListener('pointercancel', finDrag);
  svg.addEventListener('pointerleave', () => { if (!drag && survol) { survol = null; dessiner(); } });
  svg.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const p = versDessin(ev), k = ev.deltaY > 0 ? 1.15 : 1 / 1.15;
    vb = [p[0] - (p[0] - vb[0]) * k, p[1] - (p[1] - vb[1]) * k, vb[2] * k, vb[3] * k]; appliquerVb(); dessiner();
  }, { passive: false });

  champ.addEventListener('focus', () => { if (objs[sel]) memoriser(); });
  champ.addEventListener('input', () => { const o = objs[sel]; if (!o) return; o.txt = champ.value; dessiner(); });

  async function enregistrer(suppr = false) {
    const arrondir = (v) => (Array.isArray(v) ? v.map(arrondir) : typeof v === 'number' ? r2(v) : v);
    let tout = {};
    try { tout = await compte.lireContenu(CHEMIN_RETOUCHES); } catch { tout = {}; }
    if (suppr) delete tout[id];
    else tout[id] = { objs: objs.map((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, arrondir(v)]))), maj: Date.now() };
    await compte.publierContenu(CHEMIN_RETOUCHES, JSON.stringify(tout));
    definirRetouches(tout);
    modifie = false;
  }

  el.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.o) { choisirOutil(b.dataset.o); return; }
    const a = b.dataset.a;
    if (a === 'retour') { if (modifie && !confirm('Quitter sans enregistrer ?')) return; history.length > 1 ? history.back() : (location.hash = '#/dessin'); }
    else if (a === 'zm' || a === 'zp') { const k = a === 'zp' ? 1 / 1.25 : 1.25, c = [vb[0] + vb[2] / 2, vb[1] + vb[3] / 2]; vb = [c[0] - (vb[2] * k) / 2, c[1] - (vb[3] * k) / 2, vb[2] * k, vb[3] * k]; appliquerVb(); dessiner(); }
    else if (a === 'z0') { vb = [...vb0]; appliquerVb(); dessiner(); }
    else if (a === 'annuler') { if (hist.length) { refaire.push(JSON.stringify(objs)); objs = JSON.parse(hist.pop()); sel = -1; dessiner(); } }
    else if (a === 'refaire') { if (refaire.length) { hist.push(JSON.stringify(objs)); objs = JSON.parse(refaire.pop()); sel = -1; dessiner(); } }
    else if (a === 'suppr') { if (objs[sel]) { memoriser(); objs.splice(sel, 1); sel = -1; dessiner(); } }
    else if (a === 'horiz') { const o = objs[sel]; if (o?.t === 'q') { memoriser(); o.ang = o.ang ? 0 : (o.d ? angleAligne(o.d[0], o.d[1]) : 0); o.an = 'middle'; dessiner(); } }
    else if (a === 'cote-r') { const o = objs[sel]; if (o?.t === 'r') { memoriser(); o.sg = -o.sg; dessiner(); } }
    else if (a === 'enreg') {
      b.disabled = true;
      try { await enregistrer(); el.querySelector('.rt-etat').textContent = 'Cotation retouchée'; toast('Cotation enregistrée pour tout le monde.'); }
      catch (e) { toast(`Échec de l'enregistrement : ${e.message}`, 5000); }
      b.disabled = false;
    } else if (a === 'auto') {
      if (!confirm('Revenir à la cotation automatique pour cette pièce ? La retouche sera effacée.')) return;
      try { await enregistrer(true); objs = JSON.parse(JSON.stringify(svgPrisme(pc, { brut: true, fleche: flecheFace }).auto)); hist.length = 0; sel = -1; el.querySelector('.rt-etat').textContent = 'Cotation automatique'; dessiner(); toast('Cotation automatique rétablie.'); }
      catch (e) { toast(`Échec : ${e.message}`, 5000); }
    }
  });
  const clavier = (ev) => {
    if (/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) { if (ev.key === 'Enter') document.activeElement.blur(); return; }
    if (ev.key === 'Escape') { etape = []; if (outil !== 'sel') choisirOutil('sel'); else { sel = -1; dessiner(); } }
    else if (ev.key === 'Delete' || ev.key === 'Backspace') { if (objs[sel]) { ev.preventDefault(); memoriser(); objs.splice(sel, 1); sel = -1; dessiner(); } }
    else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); el.querySelector('[data-a="annuler"]').click(); }
    else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') { ev.preventDefault(); el.querySelector('[data-a="refaire"]').click(); }
  };
  document.addEventListener('keydown', clavier);
  const avantQuitter = (ev) => { if (modifie) { ev.preventDefault(); ev.returnValue = ''; } };
  window.addEventListener('beforeunload', avantQuitter);
  new ResizeObserver(() => dessiner()).observe(svg);
  dessiner();
  return () => { document.removeEventListener('keydown', clavier); window.removeEventListener('beforeunload', avantQuitter); };
}
