/* =====================================================================
   PLANCHE — dessiner dans l'appli (exercices de dessin technique)
   ---------------------------------------------------------------------
   Une planche quadrillée (1 carreau = 10 mm) avec les vues données ; l'élève
   trace des segments et des cercles, accrochés tous les ½ carreau (5 mm),
   en choisissant le type de trait : fort (arête vue), interrompu (cachée),
   mixte (axe) ou fin (construction, jamais corrigé).
   Élément : ['l', x1, y1, x2, y2, s] ou ['c', cx, cy, r, s]   (s = v | c | a | n)
   Correction automatique : chaque élément de la solution est-il recouvert par
   un trait du même type ? Les traits de l'élève hors solution sont « en trop ».
   Le dessin est gardé dans ce navigateur (clé « dessins »).
   ===================================================================== */

import { stockage } from './utils.js';
import { icone } from './icones.js';

const K = 30;                 // pixels SVG par carreau
const PAS = 0.5;              // accrochage
const TOL = 0.22;             // tolérance de recouvrement (carreaux)
const CLASSE = { v: 'tf', c: 'ti', a: 'tm', n: 'tn' };
const NOM = { v: 'Fort', c: 'Caché', a: 'Axe', n: 'Fin' };
const TITRE = { v: 'Trait fort : arête vue', c: 'Trait interrompu : arête cachée', a: 'Trait mixte : axe', n: 'Trait fin : construction (non corrigé)' };

const lireTous = () => stockage.lire('dessins', {});
export function dessinSauve(cle) { return lireTous()[cle] || []; }
function sauver(cle, els) { const t = lireTous(); if (els.length) t[cle] = els; else delete t[cle]; stockage.ecrire('dessins', t); }

/* ---------- géométrie ---------- */
const r2 = (v) => Math.round(v * 1000) / 1000;
function echantillons(e, pas = 0.25) {
  if (e[0] === 'l') {
    const [, x1, y1, x2, y2] = e; const L = Math.hypot(x2 - x1, y2 - y1); const n = Math.max(1, Math.ceil(L / pas));
    return Array.from({ length: n + 1 }, (_, i) => [x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n]);
  }
  const [, cx, cy, r] = e; const n = Math.max(12, Math.ceil(2 * Math.PI * r / pas));
  return Array.from({ length: n }, (_, i) => [cx + r * Math.cos(2 * Math.PI * i / n), cy + r * Math.sin(2 * Math.PI * i / n)]);
}
function distance(p, e) {
  if (e[0] === 'c') return Math.abs(Math.hypot(p[0] - e[1], p[1] - e[2]) - e[3]);
  const [, x1, y1, x2, y2] = e; const dx = x2 - x1, dy = y2 - y1; const L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - x1) * dx + (p[1] - y1) * dy) / L2)) : 0;
  return Math.hypot(p[0] - x1 - t * dx, p[1] - y1 - t * dy);
}
const longueur = (e) => (e[0] === 'l' ? Math.hypot(e[3] - e[1], e[4] - e[2]) : 2 * Math.PI * e[3]);
const proche = (p, els) => els.some((u) => distance(p, u) < TOL);
const couverture = (e, els) => { const pts = echantillons(e); return pts.filter((p) => proche(p, els)).length / pts.length; };

/** Compare le dessin de l'élève à la solution. */
export function corriger(solution, eleve, donnees = []) {
  const traits = eleve.filter((u) => u[u.length - 1] !== 'n');
  const res = solution.map((s) => {
    const type = s[s.length - 1];
    const memes = traits.filter((u) => u[u.length - 1] === type);
    const seuil = type === 'a' ? 0.6 : 0.85;
    if (couverture(s, memes) >= seuil) return { s, etat: 'ok' };
    if (couverture(s, traits) >= seuil) return { s, etat: 'type' };
    return { s, etat: 'manque' };
  });
  const enTrop = traits.filter((u) => {
    const pts = echantillons(u);
    const bons = pts.filter((p) => proche(p, solution) || proche(p, donnees)).length;
    return bons / pts.length < 0.6;
  });
  const poids = (r) => longueur(r.s) * (r.s[r.s.length - 1] === 'a' ? 0.5 : 1);
  const total = res.reduce((a, r) => a + poids(r), 0) || 1;
  const bon = res.filter((r) => r.etat === 'ok').reduce((a, r) => a + poids(r), 0);
  const pct = Math.max(0, Math.round(100 * bon / total) - 5 * enTrop.length);
  return {
    res, enTrop, pct,
    ok: res.filter((r) => r.etat === 'ok').length,
    manque: res.filter((r) => r.etat === 'manque').length,
    type: res.filter((r) => r.etat === 'type').length,
    n: res.length,
  };
}

/* ---------- rendu SVG ---------- */
function svgEl(e, cls, extra = '') {
  const s = e[e.length - 1];
  if (e[0] === 'l') return `<line class="${CLASSE[s]} ${cls}" x1="${r2(e[1] * K)}" y1="${r2(e[2] * K)}" x2="${r2(e[3] * K)}" y2="${r2(e[4] * K)}" ${extra}/>`;
  return `<circle class="${CLASSE[s]} ${cls}" cx="${r2(e[1] * K)}" cy="${r2(e[2] * K)}" r="${r2(e[3] * K)}" fill="none" ${extra}/>`;
}

/**
 * Monte une planche interactive dans « el ».
 * @param {object} ex  exercice de type « dessin » (planche, donnees, solution)
 * @param {{cle: string, correction?: boolean, solutionSeule?: boolean}} opts
 * @returns {{ resultat: object|null }}
 */
export function monterPlanche(el, ex, opts) {
  const P = ex.planche;
  const W = P.w * K, H = P.h * K;
  const etat = {
    els: dessinSauve(opts.cle).map((e) => [...e]),
    style: 'v', outil: 'ligne', zoom: 1, cours: null, historique: [],
    correction: !!opts.correction, voirCorr: true,
  };
  let resultat = etat.correction ? corriger(ex.solution, etat.els, ex.donnees) : null;

  el.innerHTML = `
    <div class="pl-outils" role="toolbar" aria-label="Outils de dessin">
      <div class="pl-groupe" role="group" aria-label="Type de trait">
        ${['v', 'c', 'a', 'n'].map((s) => `<button class="btn pl-b" data-style="${s}" title="${TITRE[s]}"><svg viewBox="0 0 34 10" class="pl-ech"><line class="${CLASSE[s]}" x1="2" y1="5" x2="32" y2="5"/></svg>${NOM[s]}</button>`).join('')}
      </div>
      <div class="pl-groupe" role="group" aria-label="Outil">
        <button class="btn pl-b" data-outil="ligne" title="Tracer un segment (glisser d'un point à l'autre)"><svg viewBox="0 0 24 24" class="ic"><path d="M4 20 20 4" stroke="currentColor" stroke-width="2"/><circle cx="4" cy="20" r="2" fill="currentColor"/><circle cx="20" cy="4" r="2" fill="currentColor"/></svg>Ligne</button>
        <button class="btn pl-b" data-outil="cercle" title="Tracer un cercle (glisser du centre vers le bord)"><svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>Cercle</button>
        <button class="btn pl-b" data-outil="gomme" title="Gomme : toucher un trait pour l'effacer"><svg viewBox="0 0 24 24" class="ic"><path d="M7 21h10M5 15l9-11 6 5-9 11H8z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>Gomme</button>
        <button class="btn pl-b" data-outil="main" title="Déplacer la planche (quand elle est agrandie)"><svg viewBox="0 0 24 24" class="ic"><path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>Déplacer</button>
      </div>
      <div class="pl-groupe">
        <button class="btn icon" data-act="annuler" title="Annuler le dernier trait">${icone('recommencer')}</button>
        <button class="btn icon" data-act="moins" title="Réduire">−</button>
        <button class="btn icon" data-act="plus" title="Agrandir">+</button>
        <button class="btn" data-act="effacer" title="Tout effacer">${icone('croix')}<span>Effacer</span></button>
      </div>
    </div>
    <div class="pl-cadre fig"><svg class="pl-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Planche de dessin"></svg></div>
    <p class="pl-aide muted">Glisse pour tracer · les points s'accrochent tous les 5 mm (½ carreau) · 1 carreau = 10 mm</p>`;
  const svg = el.querySelector('svg.pl-svg');
  const cadre = el.querySelector('.pl-cadre');

  function fond() {
    let g = '';
    for (let x = 0; x <= P.w; x += 1) g += `<line class="pl-grille" x1="${x * K}" y1="0" x2="${x * K}" y2="${H}"/>`;
    for (let y = 0; y <= P.h; y += 1) g += `<line class="pl-grille" x1="0" y1="${y * K}" x2="${W}" y2="${y * K}"/>`;
    const noms = { face: 'Vue de face', gauche: 'Vue de gauche', dessus: 'Vue de dessus' };
    for (const [v, [x, y]] of Object.entries(P.cadres || {})) g += `<text class="pl-nom" x="${x * K}" y="${(y - 0.35) * K}">${noms[v] || v}</text>`;
    if (P.cible) {
      const [x, y, w, h] = P.cible; const m = 0.5;
      g += `<rect class="pl-cible" x="${(x - m) * K}" y="${(y - m) * K}" width="${(w + 2 * m) * K}" height="${(h + 2 * m) * K}" rx="6"/>`;
    }
    if (P.l45) g += svgEl(P.l45, 'pl-45');
    return g;
  }

  function dessiner(apercu = '') {
    let s = fond() + ex.donnees.map((e) => svgEl(e, 'pl-donne')).join('');
    if (etat.correction && resultat && etat.voirCorr) {
      const trop = new Set(resultat.enTrop);
      s += etat.els.map((e) => svgEl(e, trop.has(e) ? 'pl-trop' : 'pl-eleve pl-pale')).join('');
      s += resultat.res.map((r) => svgEl(r.s, `pl-${r.etat}`)).join('');
    } else if (opts.solutionSeule) {
      s += ex.solution.map((e) => svgEl(e, 'pl-ok')).join('');
    } else {
      s += etat.els.map((e) => svgEl(e, 'pl-eleve')).join('');
    }
    svg.innerHTML = s + apercu;
  }

  function maj() {
    el.querySelectorAll('[data-style]').forEach((b) => b.classList.toggle('actif', b.dataset.style === etat.style));
    el.querySelectorAll('[data-outil]').forEach((b) => b.classList.toggle('actif', b.dataset.outil === etat.outil));
    svg.style.width = `${Math.round(100 * etat.zoom)}%`;
    svg.style.maxWidth = 'none';
    svg.style.touchAction = etat.outil === 'main' ? 'auto' : 'none';
    cadre.classList.toggle('pl-pan', etat.outil === 'main');
    el.querySelectorAll('.pl-outils button').forEach((b) => { b.disabled = etat.correction && !b.dataset.act?.match(/plus|moins/) && b.dataset.outil !== 'main'; });
  }

  const pointUnite = (ev) => {
    const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [p.x / K, p.y / K];
  };
  const accroche = ([x, y]) => [Math.max(0, Math.min(P.w, Math.round(x / PAS) * PAS)), Math.max(0, Math.min(P.h, Math.round(y / PAS) * PAS))];

  function changer(nouveaux) {
    etat.historique.push(etat.els.map((e) => [...e]));
    if (etat.historique.length > 100) etat.historique.shift();
    etat.els = nouveaux;
    sauver(opts.cle, etat.els);
    dessiner();
  }

  svg.addEventListener('pointerdown', (ev) => {
    if (etat.correction || etat.outil === 'main' || opts.solutionSeule) return;
    ev.preventDefault();
    const p = pointUnite(ev);
    if (etat.outil === 'gomme') {
      let meilleur = -1, d = 0.45;
      etat.els.forEach((e, i) => { const di = distance(p, e); if (di < d) { d = di; meilleur = i; } });
      if (meilleur >= 0) changer(etat.els.filter((_, i) => i !== meilleur));
      return;
    }
    svg.setPointerCapture(ev.pointerId);
    etat.cours = { a: accroche(p), b: accroche(p) };
    apercu();
  });
  svg.addEventListener('pointermove', (ev) => {
    if (!etat.cours) return;
    etat.cours.b = accroche(pointUnite(ev));
    apercu();
  });
  function apercu() {
    const { a, b } = etat.cours;
    const e = forme(a, b);
    const mm = etat.outil === 'cercle' ? `Ø ${Math.round(e[3] * 20)} mm` : `${Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) * 10)} mm`;
    dessiner(`${e[0] === 'c' && e[3] === 0 ? '' : svgEl(e, 'pl-apercu')}<circle class="pl-pt" cx="${a[0] * K}" cy="${a[1] * K}" r="4"/><circle class="pl-pt" cx="${b[0] * K}" cy="${b[1] * K}" r="4"/>
      <text class="pl-mesure" x="${b[0] * K + 8}" y="${b[1] * K - 8}">${mm}</text>`);
  }
  const forme = (a, b) => (etat.outil === 'cercle'
    ? ['c', a[0], a[1], Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / PAS) * PAS, etat.style]
    : ['l', a[0], a[1], b[0], b[1], etat.style]);
  function finir() {
    if (!etat.cours) return;
    const e = forme(etat.cours.a, etat.cours.b);
    etat.cours = null;
    const vide = e[0] === 'l' ? (e[1] === e[3] && e[2] === e[4]) : e[3] === 0;
    if (vide) { dessiner(); return; }
    changer([...etat.els, e]);
  }
  svg.addEventListener('pointerup', finir);
  svg.addEventListener('pointercancel', () => { etat.cours = null; dessiner(); });

  el.querySelector('.pl-outils').addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.style) { etat.style = b.dataset.style; if (etat.outil !== 'ligne' && etat.outil !== 'cercle') etat.outil = 'ligne'; }
    else if (b.dataset.outil) etat.outil = b.dataset.outil;
    else if (b.dataset.act === 'annuler') { if (etat.historique.length) { etat.els = etat.historique.pop(); sauver(opts.cle, etat.els); dessiner(); } }
    else if (b.dataset.act === 'effacer') { if (etat.els.length) changer([]); }
    else if (b.dataset.act === 'plus') etat.zoom = Math.min(3, etat.zoom * 1.3);
    else if (b.dataset.act === 'moins') etat.zoom = Math.max(1, etat.zoom / 1.3);
    maj();
  });

  dessiner(); maj();
  return {
    resultat,
    basculer(v) { etat.voirCorr = v; dessiner(); },
  };
}
