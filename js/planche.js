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
   Aides selon le niveau (facile / moyen / difficile) : guides de correspondance,
   ligne à 45°, traits d'aide, « où j'en suis ? ».
   Tracé : glisser, ou toucher deux points (enchaînement de contour) ; loupe au doigt ;
   sélection pour changer le type ou déplacer un trait ; plein écran ; raccourcis clavier.
   ===================================================================== */

import { stockage } from './utils.js';
import { icone } from './icones.js';
import { toast } from './utils.js';

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
  if (e[0] === 'h') return e[1].some(([x, y]) => p[0] >= x && p[0] <= x + 0.5 && p[1] >= y && p[1] <= y + 0.5) ? 0 : 9;
  if (e[0] !== 'l' && e[0] !== 'c') return 9;
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
  const traits = eleve.filter((u) => u[u.length - 1] !== 'n' && (u[0] === 'l' || u[0] === 'c'));
  const hach = eleve.filter((u) => u[0] === 'h');
  const hUser = new Set(hach.flatMap((u) => u[1].map((c) => c.join(','))));
  const solLignes = solution.filter((x) => x[0] === 'l' || x[0] === 'c');
  const donLignes = donnees.filter((x) => x[0] === 'l' || x[0] === 'c');
  const hSol = new Set(solution.filter((x) => x[0] === 'h').flatMap((x) => x[1].map((c) => c.join(','))));
  const res = solution.map((s) => {
    if (s[0] === 'h') {
      const S = s[1].map((c) => c.join(','));
      const rec = S.length ? S.filter((k) => hUser.has(k)).length / S.length : 1;
      return { s, etat: rec >= 0.9 ? 'ok' : 'manque' };
    }
    const type = s[s.length - 1];
    const memes = traits.filter((u) => u[u.length - 1] === type);
    const seuil = type === 'a' ? 0.6 : 0.85;
    if (couverture(s, memes) >= seuil) return { s, etat: 'ok' };
    if (couverture(s, traits) >= seuil) return { s, etat: 'type' };
    return { s, etat: 'manque' };
  });
  const enTrop = traits.filter((u) => {
    const pts = echantillons(u);
    const bons = pts.filter((p) => proche(p, solLignes) || proche(p, donLignes)).length;
    return bons / pts.length < 0.6;
  });
  for (const u of hach) {   // hachures sur du vide ou hors de la coupe
    const hors = u[1].filter((c) => !hSol.has(c.join(','))).length;
    if (hors > Math.max(3, 0.1 * u[1].length)) enTrop.push(u);
  }
  const lignesPoids = res.filter((r) => r.s[0] !== 'h').reduce((a, r) => a + longueur(r.s) * (r.s[r.s.length - 1] === 'a' ? 0.5 : 1), 0);
  const poids = (r) => (r.s[0] === 'h' ? Math.max(4, 0.3 * lignesPoids) : longueur(r.s) * (r.s[r.s.length - 1] === 'a' ? 0.5 : 1));
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

/* ---------- niveaux d'aide ---------- */
export const AIDES = {
  facile: { nom: 'Facile', guides: true, l45: true, indices: Infinity, bilans: Infinity, rotation: true, boutonsVues: true, penalite: 3 },
  moyen: { nom: 'Moyen', guides: true, l45: true, indices: 3, bilans: 3, rotation: true, boutonsVues: false, penalite: 5 },
  difficile: { nom: 'Difficile', guides: false, l45: false, indices: 0, bilans: 0, rotation: false, boutonsVues: false, penalite: 0 },
};
export const niveauAide = () => (AIDES[stockage.lire('dessin.aide', 'facile')] ? stockage.lire('dessin.aide', 'facile') : 'facile');
export const choisirAide = (n) => stockage.ecrire('dessin.aide', n);

/* ---------- rendu SVG ---------- */
const MOTIFS = ['eleve', 'ok', 'manque', 'type', 'trop', 'indice', 'donne'];
const motif = (cls) => MOTIFS.find((m) => cls.includes(`pl-${m}`)) || 'eleve';
const DEFS = `<defs>${MOTIFS.map((m) => `<pattern id="ph-${m}" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)"><line class="ph ph-${m}" x1="0" y1="0" x2="0" y2="8"/></pattern>`).join('')}</defs>`;
function svgEl(e, cls, extra = '') {
  if (e[0] === 'h') return `<g class="pl-h ${cls}">${e[1].map(([x, y]) => `<rect x="${r2(x * K)}" y="${r2(y * K)}" width="${K / 2 + 0.4}" height="${K / 2 + 0.4}" fill="url(#ph-${motif(cls)})"/>`).join('')}</g>`;
  if (e[0] === 't') return `<text class="pl-txt" x="${r2(e[1] * K)}" y="${r2(e[2] * K)}" text-anchor="middle">${e[3]}</text>`;
  if (e[0] === 'f') {
    const [, x1, y1, x2, y2] = e; const a = Math.atan2(y2 - y1, x2 - x1); const t = 0.35;
    return `<line class="tf pl-donne" x1="${r2(x1 * K)}" y1="${r2(y1 * K)}" x2="${r2(x2 * K)}" y2="${r2(y2 * K)}"/><polygon class="pl-fl" points="${r2(x2 * K)},${r2(y2 * K)} ${r2((x2 - t * Math.cos(a - 0.4)) * K)},${r2((y2 - t * Math.sin(a - 0.4)) * K)} ${r2((x2 - t * Math.cos(a + 0.4)) * K)},${r2((y2 - t * Math.sin(a + 0.4)) * K)}"/>`;
  }
  const s = e[e.length - 1];
  if (e[0] === 'l') return `<line class="${CLASSE[s]} ${cls}" x1="${r2(e[1] * K)}" y1="${r2(e[2] * K)}" x2="${r2(e[3] * K)}" y2="${r2(e[4] * K)}" ${extra}/>`;
  return `<circle class="${CLASSE[s]} ${cls}" cx="${r2(e[1] * K)}" cy="${r2(e[2] * K)}" r="${r2(e[3] * K)}" fill="none" ${extra}/>`;
}
const memeElement = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

let instance = null;   // une seule planche active (raccourcis clavier)

/**
 * Monte une planche interactive dans « el ».
 * @param {object} ex  exercice de type « dessin » (planche, donnees, solution, expl)
 * @param {{cle: string, correction?: boolean, aide?: string, indices?: number[],
 *          onExpliquer?: (i: number) => void, onPlein?: (b: boolean) => void}} opts
 */
export function monterPlanche(el, ex, opts) {
  instance?.detruire();
  const P = ex.planche;
  const A = AIDES[opts.aide || 'facile'];
  const W = P.w * K, H = P.h * K;
  const etat = {
    els: dessinSauve(opts.cle).map((e) => [...e]),
    style: 'v', outil: 'ligne', zoom: 1, cours: null, chaine: null, chaineDebut: null, enchainer: stockage.lire('dessin.enchainer', false) === true, sel: -1, deplace: null,
    historique: [], refaire: [], guides: [], loupe: null,
    correction: !!opts.correction, voirCorr: true, focus: -1,
    indices: opts.indices || [],
  };
  const resultat = etat.correction ? corriger(ex.solution, etat.els, ex.donnees) : null;

  el.innerHTML = `
    <div class="pl-outils" role="toolbar" aria-label="Outils de dessin">
      <div class="pl-groupe" role="group" aria-label="Type de trait">
        ${['v', 'c', 'a', 'n'].map((s) => `<button class="btn pl-b" type="button" data-style="${s}" title="${TITRE[s]} (touche ${{ v: 'F', c: 'C', a: 'A', n: 'N' }[s]})"><svg viewBox="0 0 34 10" class="pl-ech"><line class="${CLASSE[s]}" x1="2" y1="5" x2="32" y2="5"/></svg>${NOM[s]}</button>`).join('')}
      </div>
      <div class="pl-groupe" role="group" aria-label="Outil">
        <button class="btn pl-b" type="button" data-outil="ligne" title="Ligne (L) : glisser, ou toucher 2 points (les traits s'enchaînent)"><svg viewBox="0 0 24 24" class="ic"><path d="M4 20 20 4" stroke="currentColor" stroke-width="2"/><circle cx="4" cy="20" r="2" fill="currentColor"/><circle cx="20" cy="4" r="2" fill="currentColor"/></svg>Ligne</button>
        <button class="btn pl-b" type="button" data-outil="cercle" title="Cercle (O) : du centre vers le bord"><svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>Cercle</button>
        <button class="btn pl-b" type="button" data-outil="selection" title="Sélection (S) : toucher un trait pour changer son type, le déplacer ou le supprimer"><svg viewBox="0 0 24 24" class="ic"><path d="M5 3l14 8-6 2-3 6z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>Sélection</button>
        ${ex.solution.some((x) => x[0] === 'h') ? `<button class="btn pl-b" type="button" data-outil="hachures" title="Hachures (H) : toucher l'intérieur d'une zone fermée par des traits forts (toucher une zone hachurée l'efface)"><svg viewBox="0 0 24 24" class="ic"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M3 15 15 3M3 21 21 3M9 21 21 9" stroke="currentColor" stroke-width="1.6"/></svg>Hachures</button>` : ''}
        <button class="btn pl-b" type="button" data-outil="gomme" title="Gomme (G) : toucher un trait pour l'effacer"><svg viewBox="0 0 24 24" class="ic"><path d="M7 21h10M5 15l9-11 6 5-9 11H8z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>Gomme</button>
        <button class="btn pl-b" type="button" data-outil="main" title="Déplacer la planche (quand elle est agrandie)"><svg viewBox="0 0 24 24" class="ic"><path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>Déplacer</button>
        <button class="btn pl-b" type="button" data-act="chaine" title="Enchaîner les traits : chaque clic continue le contour depuis le point précédent. Pour arrêter : clic droit, Échap, bouton « Terminer » ou revenir au point de départ."><svg viewBox="0 0 24 24" class="ic"><path d="M4 18 9 8l6 8 5-10" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>Enchaîner</button>
      </div>
      <div class="pl-groupe">
        <button class="btn icon" type="button" data-act="annuler" title="Annuler (Ctrl+Z)">↶</button>
        <button class="btn icon" type="button" data-act="refaire" title="Rétablir (Ctrl+Y)">↷</button>
        <button class="btn icon" type="button" data-act="moins" title="Réduire">−</button>
        <button class="btn icon" type="button" data-act="plus" title="Agrandir">+</button>
        <button class="btn icon" type="button" data-act="plein" title="Plein écran">⛶</button>
        <button class="btn" type="button" data-act="effacer" title="Tout effacer">${icone('croix')}<span>Effacer</span></button>
      </div>
      <div class="pl-chainbar" hidden>
        <span>Contour en cours…</span>
        <button class="btn pl-b primary" type="button" data-act="stop" title="Arrêter le contour (clic droit ou Échap)">✓ Terminer</button>
        <span class="muted">ou clic droit / Échap / reviens au point de départ</span>
      </div>
      <div class="pl-selbar" hidden>
        <span>Trait sélectionné :</span>
        ${['v', 'c', 'a', 'n'].map((s) => `<button class="btn pl-b" type="button" data-chg="${s}">${NOM[s]}</button>`).join('')}
        <button class="btn pl-b bad" type="button" data-act="suppr" title="Supprimer (Suppr)">${icone('croix')}Supprimer</button>
      </div>
    </div>
    <div class="pl-cadre fig">
      <svg class="pl-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Planche de dessin"></svg>
      <div class="pl-loupe" hidden><svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"></svg></div>
    </div>
    <p class="pl-aide muted">Glisse pour tracer, ou clique deux points pour un trait. Avec « Enchaîner », les traits se suivent jusqu'à « Terminer » (ou clic droit / Échap).
      Accrochage tous les 5 mm · 1 carreau = 10 mm${A.guides ? ' · les pointillés bleus sont des lignes de rappel' : ''}.</p>`;
  const svg = el.querySelector('svg.pl-svg');
  const cadre = el.querySelector('.pl-cadre');
  const loupe = el.querySelector('.pl-loupe');
  const selbar = el.querySelector('.pl-selbar');
  const chainbar = el.querySelector('.pl-chainbar');
  const stopChaine = () => { etat.chaine = null; etat.chaineDebut = null; dessiner(); };

  /* ----- points remarquables pour les guides ----- */
  function pointsCles() {
    const pts = [];
    for (const e of [...ex.donnees, ...etat.els]) {
      if (e[e.length - 1] === 'n' || (e[0] !== 'l' && e[0] !== 'c')) continue;
      if (e[0] === 'l') pts.push([e[1], e[2]], [e[3], e[4]]);
      else pts.push([e[1], e[2]], [e[1] - e[3], e[2]], [e[1] + e[3], e[2]], [e[1], e[2] - e[3]], [e[1], e[2] + e[3]]);
    }
    return pts;
  }
  const dans = (p, c, m = 0.6) => c && p[0] >= c[0] - m && p[0] <= c[0] + c[2] + m && p[1] >= c[1] - m && p[1] <= c[1] + c[3] + m;

  /** Accroche un point : grille ½ carreau, puis lignes de rappel (aide). */
  function accroche(brut, avecGuides = true) {
    let x = Math.round(brut[0] / PAS) * PAS, y = Math.round(brut[1] / PAS) * PAS;
    const guides = [];
    if (A.guides && avecGuides) {
      const T = 0.3; const cd = P.cadres || {};
      let bx = null, by = null;
      for (const q of pointsCles()) {
        if (Math.abs(q[0] - brut[0]) < T && (bx === null || Math.abs(q[0] - brut[0]) < Math.abs(bx.q[0] - brut[0])) && Math.abs(q[1] - brut[1]) > 0.4) bx = { q, x: q[0], via: null };
        if (Math.abs(q[1] - brut[1]) < T && (by === null || Math.abs(q[1] - brut[1]) < Math.abs(by.q[1] - brut[1])) && Math.abs(q[0] - brut[0]) > 0.4) by = { q, y: q[1], via: null };
        if (P.l45) {  // report par la ligne à 45° (dessus ↔ gauche)
          const cx = P.l45[1], cy = P.l45[2];
          if (dans(q, cd.dessus, 0.05) && dans(brut, cd.gauche)) {
            const xx = cx + (q[1] - cy);
            if (Math.abs(xx - brut[0]) < T && (bx === null || Math.abs(xx - brut[0]) < Math.abs(bx.x - brut[0]))) bx = { q, x: xx, via: [xx, q[1]] };
          }
          if (dans(q, cd.gauche, 0.05) && dans(brut, cd.dessus)) {
            const yy = cy + (q[0] - cx);
            if (Math.abs(yy - brut[1]) < T && (by === null || Math.abs(yy - brut[1]) < Math.abs(by.y - brut[1]))) by = { q, y: yy, via: [q[0], yy] };
          }
        }
      }
      if (bx) { x = bx.x; guides.push(bx.via ? [bx.q, bx.via, 'x'] : [bx.q, null, 'x']); }
      if (by) { y = by.y; guides.push(by.via ? [by.q, by.via, 'y'] : [by.q, null, 'y']); }
    }
    x = Math.max(0, Math.min(P.w, x)); y = Math.max(0, Math.min(P.h, y));
    etat.guides = guides.map(([q, via, ax]) => ({ q, via, ax, p: [x, y] }));
    return [x, y];
  }

  function fond() {
    let g = '';
    for (let x = 0; x <= P.w; x += 1) g += `<line class="pl-grille" x1="${x * K}" y1="0" x2="${x * K}" y2="${H}"/>`;
    for (let y = 0; y <= P.h; y += 1) g += `<line class="pl-grille" x1="0" y1="${y * K}" x2="${W}" y2="${y * K}"/>`;
    const noms = { face: 'Vue de face', gauche: 'Vue de gauche', dessus: 'Vue de dessus' };
    for (const [v, [x, y]] of Object.entries(P.cadres || {})) g += `<text class="pl-nom" x="${x * K}" y="${(y - 0.35) * K}">${(P.noms && P.noms[v]) || noms[v] || v}</text>`;
    if (P.cible) {
      const [x, y, w, h] = P.cible; const m = 0.5;
      g += `<rect class="pl-cible" x="${(x - m) * K}" y="${(y - m) * K}" width="${(w + 2 * m) * K}" height="${(h + 2 * m) * K}" rx="6"/>`;
    }
    if (P.l45 && A.l45) g += svgEl(P.l45, 'pl-45');
    return g;
  }

  function contenu(apercu = '') {
    let s = DEFS + fond() + ex.donnees.map((e) => svgEl(e, 'pl-donne')).join('');
    if (etat.correction && resultat && etat.voirCorr) {
      const trop = new Set(resultat.enTrop);
      s += etat.els.map((e) => svgEl(e, trop.has(e) ? 'pl-trop' : 'pl-eleve pl-pale')).join('');
      s += resultat.res.map((r, i) => svgEl(r.s, `pl-${r.etat}${i === etat.focus ? ' pl-focus' : ''}`)).join('');
    } else {
      s += etat.indices.map((i) => svgEl(ex.solution[i], 'pl-indice')).join('');
      s += etat.els.map((e, i) => svgEl(e, `pl-eleve${i === etat.sel ? ' pl-sel' : ''}`)).join('');
    }
    for (const g of etat.guides) {
      const pts = g.via ? [g.q, g.via, g.p] : [g.q, g.p];
      s += `<polyline class="pl-guide" points="${pts.map((p) => `${p[0] * K},${p[1] * K}`).join(' ')}"/>`;
    }
    if (etat.chaine) s += `<circle class="pl-pt pl-attente" cx="${etat.chaine[0] * K}" cy="${etat.chaine[1] * K}" r="6"/>`;
    return s + apercu;
  }
  function dessiner(apercu = '') {
    chainbar.hidden = !(etat.chaine && etat.enchainer && etat.outil === 'ligne');
    const s = contenu(apercu);
    svg.innerHTML = s;
    if (etat.loupe) {
      const [x, y] = etat.loupe; const r = 1.7 * K;
      const ls = loupe.querySelector('svg');
      ls.setAttribute('viewBox', `${x * K - r} ${y * K - r} ${2 * r} ${2 * r}`);
      ls.innerHTML = s + `<circle class="pl-mire" cx="${x * K}" cy="${y * K}" r="5"/>`;
    }
  }

  function maj() {
    el.querySelectorAll('[data-style]').forEach((b) => b.classList.toggle('actif', b.dataset.style === etat.style));
    el.querySelectorAll('[data-outil]').forEach((b) => b.classList.toggle('actif', b.dataset.outil === etat.outil));
    el.querySelector('[data-act=chaine]')?.classList.toggle('actif', etat.enchainer);
    svg.style.width = `${Math.round(100 * etat.zoom)}%`;
    svg.style.maxWidth = 'none';
    svg.style.touchAction = etat.outil === 'main' ? 'auto' : 'none';
    cadre.classList.toggle('pl-pan', etat.outil === 'main');
    el.querySelector('[data-act=annuler]').disabled = !etat.historique.length;
    el.querySelector('[data-act=refaire]').disabled = !etat.refaire.length;
    selbar.hidden = etat.sel < 0;
    if (etat.sel >= 0) selbar.querySelectorAll('[data-chg]').forEach((b) => b.classList.toggle('actif', etat.els[etat.sel]?.at(-1) === b.dataset.chg));
    if (etat.correction) el.querySelectorAll('.pl-outils button').forEach((b) => { b.disabled = !(b.dataset.act === 'plus' || b.dataset.act === 'moins' || b.dataset.act === 'plein' || b.dataset.outil === 'main'); });
    svg.style.cursor = etat.correction ? 'pointer' : '';
  }

  const pointUnite = (ev) => {
    const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [p.x / K, p.y / K];
  };

  function changer(nouveaux, garderSel = false) {
    etat.historique.push(etat.els.map((e) => [...e]));
    if (etat.historique.length > 200) etat.historique.shift();
    etat.refaire = [];
    etat.els = nouveaux;
    if (!garderSel) etat.sel = -1;
    sauver(opts.cle, etat.els);
    dessiner(); maj();
  }
  const plusProche = (p, liste, max = 0.45) => {
    let m = -1, d = max;
    liste.forEach((e, i) => { const di = distance(p, e); if (di < d) { d = di; m = i; } });
    return m;
  };
  const forme = (a, b) => (etat.outil === 'cercle'
    ? ['c', a[0], a[1], Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / PAS) * PAS, etat.style]
    : ['l', a[0], a[1], b[0], b[1], etat.style]);
  const vide = (e) => (e[0] === 'l' ? (e[1] === e[3] && e[2] === e[4]) : e[3] === 0);

  function apercu() {
    const { a, b } = etat.cours;
    const de = etat.chaine && !etat.cours.glisse ? etat.chaine : a;
    const e = forme(de, b);
    const mm = etat.outil === 'cercle' ? `Ø ${Math.round(e[3] * 20)} mm` : `${Math.round(Math.hypot(b[0] - de[0], b[1] - de[1]) * 10)} mm`;
    dessiner(`${vide(e) ? '' : svgEl(e, 'pl-apercu')}<circle class="pl-pt" cx="${de[0] * K}" cy="${de[1] * K}" r="4"/><circle class="pl-pt" cx="${b[0] * K}" cy="${b[1] * K}" r="4"/>
      ${vide(e) ? '' : `<text class="pl-mesure" x="${b[0] * K + 8}" y="${b[1] * K - 8}">${mm}</text>`}`);
  }
  function placerLoupe(ev, p) {
    if (ev.pointerType !== 'touch') { loupe.hidden = true; etat.loupe = null; return; }
    etat.loupe = p;
    const r = cadre.getBoundingClientRect();
    loupe.hidden = false;
    loupe.style.left = `${ev.clientX - r.left + cadre.scrollLeft - 55}px`;
    loupe.style.top = `${ev.clientY - r.top + cadre.scrollTop - 140}px`;
  }

  svg.addEventListener('contextmenu', (ev) => ev.preventDefault());
  svg.addEventListener('pointerdown', (ev) => {
    if (etat.outil === 'main') return;
    ev.preventDefault();
    if (ev.button === 2) { etat.cours = null; stopChaine(); return; }   // clic droit : arrêter le contour
    const p = pointUnite(ev);
    if (etat.correction) {  // correction expliquée : toucher un trait de la solution
      const i = plusProche(p, ex.solution, 0.5);
      if (i >= 0) { etat.focus = i; dessiner(); opts.onExpliquer?.(i); }
      return;
    }
    if (etat.outil === 'hachures') { hachurer(p); return; }
    if (etat.outil === 'gomme') {
      const i = plusProche(p, etat.els);
      if (i >= 0) changer(etat.els.filter((_, k) => k !== i));
      return;
    }
    if (etat.outil === 'selection') {
      const i = plusProche(p, etat.els);
      etat.sel = i; maj();
      if (i >= 0 && etat.els[i][0] !== 'h') { etat.deplace = { depart: accroche(p, false), origine: [...etat.els[i]], bouge: false }; try { svg.setPointerCapture(ev.pointerId); } catch { /* rien */ } }
      dessiner();
      return;
    }
    try { svg.setPointerCapture(ev.pointerId); } catch { /* rien */ }
    const a = accroche(p);
    etat.cours = { a, b: a, glisse: false };
    placerLoupe(ev, a);
    apercu();
  });
  svg.addEventListener('pointermove', (ev) => {
    if (etat.deplace) {
      const q = accroche(pointUnite(ev), false);
      const dx = q[0] - etat.deplace.depart[0], dy = q[1] - etat.deplace.depart[1];
      if (!dx && !dy && !etat.deplace.bouge) return;
      etat.deplace.bouge = true;
      const o = etat.deplace.origine;
      etat.els[etat.sel] = o[0] === 'l' ? ['l', o[1] + dx, o[2] + dy, o[3] + dx, o[4] + dy, o[5]] : ['c', o[1] + dx, o[2] + dy, o[3], o[4]];
      dessiner();
      return;
    }
    if (!etat.cours) {   // survol (souris) : montrer le point accroché et les guides
      if (ev.pointerType === 'mouse' && !etat.correction && (etat.outil === 'ligne' || etat.outil === 'cercle')) {
        const b = accroche(pointUnite(ev));
        const de = etat.chaine;
        const e = de ? forme(de, b) : null;
        dessiner(`${e && !vide(e) ? svgEl(e, 'pl-apercu') : ''}<circle class="pl-pt pl-survol" cx="${b[0] * K}" cy="${b[1] * K}" r="4"/>`);
      }
      return;
    }
    const b = accroche(pointUnite(ev));
    if (b[0] !== etat.cours.a[0] || b[1] !== etat.cours.a[1]) etat.cours.glisse = true;
    etat.cours.b = b;
    placerLoupe(ev, b);
    apercu();
  });
  function finir() {
    loupe.hidden = true; etat.loupe = null; etat.guides = [];
    if (etat.deplace) {
      const bouge = etat.deplace.bouge; const o = etat.deplace.origine; const n = etat.els[etat.sel];
      etat.deplace = null;
      if (bouge) { etat.els[etat.sel] = o; changer(etat.els.map((e, i) => (i === etat.sel ? n : [...e])), true); }
      return;
    }
    if (!etat.cours) return;
    const { a, b, glisse } = etat.cours;
    etat.cours = null;
    if (glisse) {                       // tracé en glissant
      const e = forme(a, b); etat.chaine = null;
      if (!vide(e)) changer([...etat.els, e]); else dessiner();
      return;
    }
    // toucher : premier point, puis point suivant (contour enchaîné)
    if (!etat.chaine) { etat.chaine = a; etat.chaineDebut = a; dessiner(); return; }
    if (etat.chaine[0] === a[0] && etat.chaine[1] === a[1]) { stopChaine(); return; }  // 2e toucher au même endroit : fin
    const e = forme(etat.chaine, a);
    const ferme = etat.chaineDebut && etat.chaineDebut[0] === a[0] && etat.chaineDebut[1] === a[1];   // retour au départ : contour fermé
    if (etat.outil === 'cercle' || !etat.enchainer || ferme) { etat.chaine = null; etat.chaineDebut = null; } else etat.chaine = a;
    changer([...etat.els, e]);
  }
  svg.addEventListener('pointerup', finir);
  svg.addEventListener('pointercancel', () => { etat.cours = null; etat.deplace = null; loupe.hidden = true; etat.loupe = null; dessiner(); });
  svg.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse' && !etat.cours) { etat.guides = []; dessiner(); } });

  /** Remplit (cellules de ½ carreau) la zone fermée par des traits forts autour du point touché. */
  function hachurer(p) {
    const k = (x, y) => `${x},${y}`;
    const c0 = [Math.floor(p[0] * 2) / 2, Math.floor(p[1] * 2) / 2];
    const existant = etat.els.findIndex((e) => e[0] === 'h' && e[1].some(([x, y]) => x === c0[0] && y === c0[1]));
    if (existant >= 0) { changer(etat.els.filter((_, i) => i !== existant)); return; }
    const zone = P.cible && dans(p, P.cible, 0) ? P.cible : Object.values(P.cadres || {}).find((c) => dans(p, c, 0));
    if (!zone) { toast('Touche l\'intérieur d\'une vue pour hachurer.'); return; }
    const [bx, by, bw, bh] = zone;
    const murs = [...ex.donnees, ...etat.els].filter((e) => (e[0] === 'l' || e[0] === 'c') && e[e.length - 1] === 'v');
    const bloque = (m) => murs.some((e) => distance(m, e) < 0.06);
    const vus = new Set([k(...c0)]); const file = [c0]; const cells = [];
    while (file.length) {
      const [x, y] = file.pop(); cells.push([x, y]);
      if (cells.length > 4 * bw * bh + 8) break;
      for (const [dx, dy, mx, my] of [[0.5, 0, x + 0.5, y + 0.25], [-0.5, 0, x, y + 0.25], [0, 0.5, x + 0.25, y + 0.5], [0, -0.5, x + 0.25, y]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < bx - 1e-9 || ny < by - 1e-9 || nx + 0.5 > bx + bw + 1e-9 || ny + 0.5 > by + bh + 1e-9) continue;
        if (vus.has(k(nx, ny)) || bloque([mx, my])) continue;
        vus.add(k(nx, ny)); file.push([nx, ny]);
      }
    }
    if (cells.length >= 4 * bw * bh) { toast('Zone non fermée : trace d\'abord tout le contour en trait fort.', 4000); return; }
    changer([...etat.els, ['h', cells, 'h']]);
  }

  function annuler() { if (!etat.historique.length) return; etat.refaire.push(etat.els); etat.els = etat.historique.pop(); etat.sel = -1; sauver(opts.cle, etat.els); dessiner(); maj(); }
  function refaire() { if (!etat.refaire.length) return; etat.historique.push(etat.els); etat.els = etat.refaire.pop(); etat.sel = -1; sauver(opts.cle, etat.els); dessiner(); maj(); }
  function supprimerSel() { if (etat.sel >= 0) changer(etat.els.filter((_, k) => k !== etat.sel)); }
  function changerType(s) { if (etat.sel < 0 || etat.els[etat.sel][0] === 'h') return; const e = [...etat.els[etat.sel]]; e[e.length - 1] = s; changer(etat.els.map((x, i) => (i === etat.sel ? e : x)), true); }
  function pleinEcran(force) {
    const on = force ?? !el.classList.contains('pl-plein');
    el.classList.toggle('pl-plein', on);
    document.body.classList.toggle('pl-plein-ouvert', on);
    el.querySelector('[data-act=plein]').textContent = on ? '✕' : '⛶';
    el.querySelector('[data-act=plein]').title = on ? 'Quitter le plein écran (Échap)' : 'Plein écran';
    opts.onPlein?.(on);
  }

  el.querySelector('.pl-outils').addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.style) {
      etat.style = b.dataset.style;
      if (etat.sel >= 0) changerType(b.dataset.style);
      else if (etat.outil !== 'ligne' && etat.outil !== 'cercle') etat.outil = 'ligne';
    } else if (b.dataset.chg) changerType(b.dataset.chg);
    else if (b.dataset.outil) { etat.outil = b.dataset.outil; etat.chaine = null; etat.chaineDebut = null; if (etat.outil !== 'selection') etat.sel = -1; dessiner(); }
    else if (b.dataset.act === 'stop') stopChaine();
    else if (b.dataset.act === 'chaine') { etat.enchainer = !etat.enchainer; stockage.ecrire('dessin.enchainer', etat.enchainer); stopChaine(); }
    else if (b.dataset.act === 'annuler') annuler();
    else if (b.dataset.act === 'refaire') refaire();
    else if (b.dataset.act === 'suppr') supprimerSel();
    else if (b.dataset.act === 'effacer') { if (etat.els.length) changer([]); }
    else if (b.dataset.act === 'plus') etat.zoom = Math.min(3, etat.zoom * 1.3);
    else if (b.dataset.act === 'moins') etat.zoom = Math.max(1, etat.zoom / 1.3);
    else if (b.dataset.act === 'plein') pleinEcran();
    maj();
  });

  function clavier(e) {
    const t = e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || document.querySelector('.prop-fond, .visio-fond:not(.prop-fond)')) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey) { e.preventDefault(); annuler(); return; }
    if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); refaire(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === 'escape') {
      if (etat.chaine || etat.sel >= 0) { etat.chaine = null; etat.chaineDebut = null; etat.sel = -1; dessiner(); maj(); e.preventDefault(); }
      else if (el.classList.contains('pl-plein')) { pleinEcran(false); maj(); e.preventDefault(); }
      return;
    }
    if (etat.correction) return;
    const styles = { f: 'v', c: 'c', a: 'a', n: 'n' }; const outils = { l: 'ligne', o: 'cercle', s: 'selection', g: 'gomme', ...(ex.solution.some((x) => x[0] === 'h') ? { h: 'hachures' } : {}) };
    if (styles[k]) { etat.style = styles[k]; if (etat.sel >= 0) changerType(styles[k]); }
    else if (outils[k]) { etat.outil = outils[k]; etat.chaine = null; etat.chaineDebut = null; if (etat.outil !== 'selection') etat.sel = -1; dessiner(); }
    else if ((k === 'delete' || k === 'backspace') && etat.sel >= 0) { e.preventDefault(); supprimerSel(); }
    else return;
    maj();
  }
  document.addEventListener('keydown', clavier);

  dessiner(); maj();
  instance = {
    resultat,
    elements: () => etat.els,
    basculer(v) { etat.voirCorr = v; dessiner(); },
    focus(i) { etat.focus = i; dessiner(); },
    detruire() { document.removeEventListener('keydown', clavier); document.body.classList.remove('pl-plein-ouvert'); if (instance === this) instance = null; },
  };
  return instance;
}

/** Premier trait de la solution que l'élève n'a pas encore (pour un trait d'aide). */
export function prochainManquant(ex, eleve, deja = []) {
  const r = corriger(ex.solution, eleve, ex.donnees);
  const i = r.res.findIndex((x, k) => x.etat !== 'ok' && !deja.includes(k));
  return i;
}
