/* =====================================================================
   VUE SIMULATEUR DE CIRCUITS — #/simu
   ---------------------------------------------------------------------
   Dessiner librement un circuit et le voir fonctionner (courant continu, diodes).
   Palette à gauche, grille au centre, panneau des valeurs à droite.
   Calcul : js/simu/moteur.js. Circuits enregistrés dans « simu »
   (synchronisé avec le compte, js/synchro.js).
   Symboles européens, comme dans le cours (résistance = rectangle).
   Convention de l'appli : la flèche de tension pointe vers le potentiel
   le plus haut ; la flèche de courant suit le sens conventionnel.
   ===================================================================== */

import { esc, stockage, toast } from '../utils.js';
import { icone } from '../icones.js';
import { matieres } from '../store.js';
import { styleMatiere } from '../matieres.js';
import { joli } from '../circuit.js';
import { resoudre, bornes, resistanceLampe, LONG, LED, seuil } from '../simu/moteur.js';

const K = 24;                                   // px par carreau
const TYPES = {
  V: { nom: 'Pile', unite: 'V', defaut: 12, pre: 'E', touche: 'e', aide: 'Borne + du côté du grand trait.' },
  R: { nom: 'Résistance', unite: 'Ω', defaut: 100, pre: 'R', touche: 'r' },
  L: { nom: 'Lampe', pre: 'L', touche: 'l' },
  S: { nom: 'Interrupteur', pre: 'K', touche: 'k', aide: 'Clique dessus pour l\'ouvrir ou le fermer.' },
  A: { nom: 'Ampèremètre', pre: 'A', touche: 'a', aide: 'Se branche en série.' },
  U: { nom: 'Voltmètre', pre: 'V', touche: 'v', aide: 'Se branche en parallèle.' },
  W: { nom: 'Générateur réglable', unite: 'V', defaut: 12, pre: 'G', touche: 'g', aide: 'Tension réglable : tape une valeur ou glisse le curseur. Borne + du côté du grand trait.' },
  I: { nom: 'Source de courant', unite: 'A', defaut: 0.01, pre: 'I', touche: 'i' },
  G: { nom: 'Masse', pre: 'M', touche: 'm', aide: 'Potentiel de référence (0 V).' },
  D: { nom: 'Diode', pre: 'D', touche: 'd', aide: 'Anode côté triangle, cathode côté barre. Passante si U(anode→cathode) atteint le seuil, sinon bloquée.' },
  Z: { nom: 'Zener', pre: 'DZ', touche: 'z', aide: 'Dans le sens direct : comme une diode. En inverse : bloquée jusqu\'à Vz, puis la tension reste à Vz.' },
  H: { nom: 'LED', pre: 'D', touche: 'h', aide: 'S\'allume dans le sens direct. Toujours avec une résistance en série (environ 10 à 20 mA).' },
};
const FAMILLES = [['Sources', ['V', 'W', 'I']], ['Récepteurs', ['R', 'L', 'S']], ['Diodes', ['D', 'Z', 'H']], ['Mesure', ['A', 'U']], ['Référence', ['G']]];
const AFF = { val: 'Valeurs des composants', ui: 'Tensions et courants', anim: 'Courant animé', coul: 'Couleurs des tensions' };

/* ---------- valeurs : lecture « 4,7k », « 100 mA »… et affichage ---------- */
export function lireValeur(s) {
  const t = String(s ?? '').trim().replace(',', '.').replace(/\s+/g, '').replace(/(ohms?|Ω|V|A|W)$/i, '');
  const m = t.match(/^(-?\d*\.?\d+(?:e-?\d+)?)([GMkmuµn]?)$/);
  if (!m) return null;
  const f = { G: 1e9, M: 1e6, k: 1e3, m: 1e-3, u: 1e-6, µ: 1e-6, n: 1e-9, '': 1 }[m[2]];
  const v = parseFloat(m[1]) * f;
  return Number.isFinite(v) ? v : null;
}
export function fmt(v, u) {
  if (u === 'Ω') { const a = Math.abs(v); if (a >= 1e6) return `${String(+(v / 1e6).toPrecision(3)).replace('.', ',')} MΩ`; if (a >= 1e3) return `${String(+(v / 1e3).toPrecision(3)).replace('.', ',')} kΩ`; return `${String(+v.toPrecision(3)).replace('.', ',')} Ω`; }
  if (Math.abs(v) < (u === 'V' ? 1e-6 : 1e-9)) return `0 ${u}`;   // fuites de calcul minuscules : 0
  return joli(v, u);
}
const valeurTexte = (c) => (c.t === 'R' ? fmt(c.val, 'Ω') : c.t === 'V' || c.t === 'W' ? fmt(c.val, 'V') : c.t === 'I' ? fmt(c.val, 'A') : c.t === 'L' ? `${fmt(c.un || 12, 'V')} · ${fmt(c.pn || 6, 'W')}`
  : c.t === 'D' ? `seuil ${vc(c.vs ?? 0.7)}` : c.t === 'Z' ? `Vz ${vc(c.vz ?? 5.1)}` : c.t === 'H' ? `${c.coul || 'rouge'} · ${vc(seuil(c))}` : '');
const vc = (v) => `${String(+(+v).toPrecision(3)).replace('.', ',')} V`;
export const ETAT = { fwd: 'Passante', off: 'Bloquée', rev: 'Conduit en inverse (tension Vz)' };

/* ---------- enregistrement ---------- */
/* « simu » = { id: circuit } (chaque circuit est synchronisé à part) ; le circuit ouvert : « simu.courant » (cet appareil). */
const lire = () => ({ courant: stockage.lire('simu.courant', null), liste: stockage.lire('simu', null) || {} });
const ecrire = (d) => { stockage.ecrire('simu', d.liste); stockage.ecrire('simu.courant', d.courant); };
const nouvelId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/* ---------- exemples ---------- */
const EXEMPLES = {
  serie: { nom: 'Série : pile, 2 résistances, ampèremètre', comps: [
    { id: 'e1', t: 'V', x: 2, y: 8, rot: 3, val: 12, nom: 'E' }, { id: 'r1', t: 'R', x: 4, y: 4, rot: 0, val: 100, nom: 'R1' },
    { id: 'a1', t: 'A', x: 8, y: 4, rot: 0, nom: 'A' }, { id: 'r2', t: 'R', x: 12, y: 4, rot: 1, val: 200, nom: 'R2' },
    { id: 'k1', t: 'S', x: 12, y: 8, rot: 1, ferme: true, nom: 'K' }],
    fils: [[2, 6, 2, 4], [2, 4, 4, 4], [6, 4, 8, 4], [10, 4, 12, 4], [12, 6, 12, 8], [12, 10, 2, 10], [2, 10, 2, 8]] },
  parallele: { nom: 'Parallèle : 2 lampes et leurs interrupteurs', comps: [
    { id: 'e1', t: 'V', x: 2, y: 8, rot: 3, val: 12, nom: 'E' }, { id: 'k1', t: 'S', x: 6, y: 4, rot: 0, ferme: true, nom: 'K1' },
    { id: 'l1', t: 'L', x: 10, y: 6, rot: 1, un: 12, pn: 6, nom: 'L1' }, { id: 'k2', t: 'S', x: 12, y: 4, rot: 0, ferme: false, nom: 'K2' },
    { id: 'l2', t: 'L', x: 16, y: 6, rot: 1, un: 12, pn: 12, nom: 'L2' }],
    fils: [[2, 6, 2, 4], [2, 4, 6, 4], [8, 4, 10, 4], [10, 4, 10, 6], [10, 4, 12, 4], [14, 4, 16, 4], [16, 4, 16, 6], [10, 8, 10, 10], [16, 8, 16, 10], [16, 10, 2, 10], [2, 10, 2, 8]] },
  diviseur: { nom: 'Pont diviseur de tension et voltmètre', comps: [
    { id: 'e1', t: 'V', x: 2, y: 8, rot: 3, val: 10, nom: 'E' }, { id: 'r1', t: 'R', x: 8, y: 4, rot: 1, val: 4700, nom: 'R1' },
    { id: 'r2', t: 'R', x: 8, y: 8, rot: 1, val: 2200, nom: 'R2' }, { id: 'v1', t: 'U', x: 12, y: 8, rot: 1, nom: 'V' }, { id: 'g1', t: 'G', x: 8, y: 12, rot: 0, nom: 'M' }],
    fils: [[2, 6, 2, 4], [2, 4, 8, 4], [8, 6, 8, 8], [8, 6, 12, 6], [12, 6, 12, 8], [8, 10, 8, 12], [12, 10, 12, 12], [12, 12, 2, 12], [2, 12, 2, 8]] },
  mixte: { nom: 'Montage mixte', comps: [
    { id: 'e1', t: 'V', x: 2, y: 8, rot: 3, val: 24, nom: 'E' }, { id: 'r1', t: 'R', x: 4, y: 4, rot: 0, val: 100, nom: 'R1' },
    { id: 'r2', t: 'R', x: 10, y: 6, rot: 1, val: 300, nom: 'R2' }, { id: 'r3', t: 'R', x: 14, y: 6, rot: 1, val: 150, nom: 'R3' },
    { id: 'a1', t: 'A', x: 6, y: 4, rot: 0, nom: 'A' }],
    fils: [[2, 6, 2, 4], [8, 4, 14, 4], [10, 4, 10, 6], [14, 4, 14, 6], [10, 8, 10, 10], [14, 8, 14, 10], [14, 10, 2, 10], [2, 10, 2, 8]] },
  diodes: { nom: 'Diodes : une LED allumée, une diode bloquée', comps: [
    { id: 'e1', t: 'V', x: 2, y: 8, rot: 3, val: 9, nom: 'E' }, { id: 'r1', t: 'R', x: 4, y: 4, rot: 0, val: 470, nom: 'R1' },
    { id: 'h1', t: 'H', x: 8, y: 6, rot: 1, coul: 'rouge', nom: 'D1' }, { id: 'd2', t: 'D', x: 16, y: 6, rot: 3, vs: 0.7, nom: 'D2' },
    { id: 'h3', t: 'H', x: 16, y: 6, rot: 1, coul: 'vert', nom: 'D3' }],
    fils: [[2, 6, 2, 4], [2, 4, 4, 4], [6, 4, 8, 4], [8, 4, 16, 4], [8, 4, 8, 6], [8, 8, 8, 10], [16, 8, 16, 10], [16, 10, 2, 10], [2, 10, 2, 8]] },
};

/* ---------- dessin SVG ---------- */
const STYLE = `
.sg{stroke:#d9dee6;stroke-width:1}
.sf{stroke:#1b1f24;stroke-width:2.2;fill:none;stroke-linecap:round}
.sc{stroke:#1b1f24;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sc-b{fill:#fff}
.st{font:600 12px "Segoe UI",Arial,sans-serif;fill:#1b1f24}
.st-v{font:500 11.5px "Segoe UI",Arial,sans-serif;fill:#475263}
.st-u{font:600 11.5px "Segoe UI",Arial,sans-serif;fill:#1d5fd1}
.st-i{font:600 11.5px "Segoe UI",Arial,sans-serif;fill:#c0392b}
.su{stroke:#1d5fd1;stroke-width:1.4;fill:none}.su-f{fill:#1d5fd1}
.si{fill:#c0392b}
.sm{fill:#fffbe6;stroke:#1b1f24;stroke-width:1}.sm-t{font:700 12px "Segoe UI",Arial,sans-serif;fill:#1b1f24}
.sj{fill:#1b1f24}
.sel .sc,.sel.sf{stroke:#1d5fd1}
.sp{fill:#fff;stroke:#1d5fd1;stroke-width:1.5}
.sx{stroke:transparent;stroke-width:14;fill:none;cursor:pointer}
.sx:hover{stroke:rgba(29,95,209,.12)}
.sfl{stroke:#f2b705;stroke-width:4.5;fill:none;stroke-linecap:round;stroke-dasharray:0 16;animation:simf 1s linear infinite;pointer-events:none}
@keyframes simf{from{stroke-dashoffset:16}to{stroke-dashoffset:0}}
.sgh{opacity:.45;pointer-events:none}
`;

/** Symbole d'un composant, dessiné de (0,0) à (2K,0) (la masse : vers le bas). */
function symbole(c, res) {
  const L = LONG * K, m = L / 2;
  const fil = (x1, x2) => `<path class="sc" d="M${x1} 0H${x2}"/>`;
  const rond = (txt) => `${fil(0, m - 12)}${fil(m + 12, L)}<circle class="sc sc-b" cx="${m}" cy="0" r="12"/>${txt ? `<text class="sm-t" x="${m}" y="4.5" text-anchor="middle" transform="rotate(${-(c.rot || 0) * 90} ${m} 0)">${txt}</text>` : ''}`;
  switch (c.t) {
    case 'R': return `${fil(0, m - 13)}${fil(m + 13, L)}<rect class="sc sc-b" x="${m - 13}" y="-6" width="26" height="12"/>`;
    case 'V': return `${fil(0, m - 3)}${fil(m + 3, L)}<path class="sc" style="stroke-width:5" d="M${m - 3} -6V6"/><path class="sc" d="M${m + 3} -12V12"/><text class="st" x="${m + 10}" y="-9" text-anchor="middle" transform="rotate(${-(c.rot || 0) * 90} ${m + 10} -12)">+</text>`;
    case 'W': return `${symbole({ ...c, t: 'V' })}<path class="sc" style="stroke-width:1.4" d="M${m - 13} 13L${m + 12} -12"/><path class="sj" d="M${m + 15} -15L${m + 6} -12L${m + 12} -6Z"/>`;
    case 'I': return `${rond('')}<path class="sc" d="M${m - 7} 0H${m + 6}M${m + 1} -4L${m + 7} 0L${m + 1} 4"/>`;
    case 'A': return rond('A');
    case 'U': return rond('V');
    case 'L': {
      const r = res?.comps.get(c.id); const pn = c.pn || 6;
      const lum = r ? Math.min(1, r.p / pn) : 0;
      return `${fil(0, m - 12)}${fil(m + 12, L)}<circle cx="${m}" cy="0" r="12" fill="rgba(255,205,40,${(lum * 0.95).toFixed(2)})" stroke="none"/><circle class="sc" cx="${m}" cy="0" r="12"/><path class="sc" d="M${m - 8.5} -8.5L${m + 8.5} 8.5M${m - 8.5} 8.5L${m + 8.5} -8.5"/>`;
    }
    case 'S': return `${fil(0, m - 10)}${fil(m + 10, L)}<circle class="sj" cx="${m - 10}" cy="0" r="2.6"/><circle class="sj" cx="${m + 10}" cy="0" r="2.6"/><path class="sc" d="M${m - 10} 0L${m + 11} ${c.ferme ? 0 : -11}"/>`;
    case 'G': return `<path class="sc" d="M0 0V12M-11 12H11M-7 17H7M-3 22H3"/>`;
    case 'D': case 'Z': case 'H': {             // anode (0) → cathode (L) : triangle puis barre
      const tri = `M${m - 8} -9L${m + 8} 0L${m - 8} 9Z`;
      const barre = c.t === 'Z' ? `M${m + 3} -13L${m + 8} -9V9L${m + 13} 13` : `M${m + 8} -9V9`;
      let fond = '', rayons = '';
      if (c.t === 'H') {
        const [, col] = LED[c.coul] || LED.rouge; const r = res?.comps.get(c.id);
        const lum = r && r.i > 0 ? Math.min(1, r.i / 0.02) : 0;
        if (lum > 0.02) fond = `<circle cx="${m}" cy="0" r="16" fill="${col}" opacity="${(lum * 0.45).toFixed(2)}" stroke="none"/>`;
        fond += `<path d="${tri}" fill="${col}" opacity="${(0.25 + lum * 0.75).toFixed(2)}" stroke="none"/>`;
        rayons = `<path class="sc" style="stroke-width:1.3" d="M${m - 3} 10l5 6M${m + 4} 10l5 6"/><path class="sj" d="M${m + 3} 17L${m - 0.6} 14.4L${m + 2.1} 12.1ZM${m + 10} 17L${m + 6.4} 14.4L${m + 9.1} 12.1Z"/>`;
      }
      return `${fil(0, m - 8)}${fil(m + 8, L)}${fond}<path class="sc" d="${tri}"/><path class="sc" d="${barre}"/>${rayons}`;
    }
    default: return '';
  }
}

/** Couleur d'un potentiel (vert = positif, rouge = négatif, gris = 0 V). */
function couleurV(v, vmax) {
  if (!vmax) return '#8a94a3';
  const t = Math.max(-1, Math.min(1, v / vmax));
  if (Math.abs(t) < 0.02) return '#8a94a3';
  return t > 0 ? `hsl(135 ${40 + 45 * t}% ${42 - 12 * t}%)` : `hsl(0 ${40 - 45 * t}% ${46 + 8 * t}%)`;
}
const vitesse = (i) => { const a = Math.abs(i); if (a < 1e-7) return 0; return 12 + 46 * Math.log10(1 + a * 1e4) / 4; };   // px/s

/** Distance d'un point à un segment (en carreaux). */
const dSeg = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};

/** Fils, raccords, composants, courant animé et étiquettes (sans grille ni outils d'édition). */
function corpsCircuit(C, res, aff, sel0 = null) {
  let s = '';
  const vmax = Math.max(1e-9, ...[...res.V.values()].map(Math.abs));
  const Vde = (x, y) => res.V.get(`${x},${y}`) ?? 0;
  // fils
  C.fils.forEach((f, i) => {
    const sel = sel0?.type === 'f' && sel0.i === i;
    const col = aff.coul && res.ok ? couleurV((Vde(f[0], f[1]) + Vde(f[2], f[3])) / 2, vmax) : null;
    s += `<path class="sf${sel ? ' sel' : ''}" d="M${f[0] * K} ${f[1] * K}L${f[2] * K} ${f[3] * K}"${col && !sel ? ` style="stroke:${col}"` : ''}/>`;
  });
  // points de raccord (3 branches ou plus)
  const nb = new Map(); const ajn = (x, y) => { const k = `${x},${y}`; nb.set(k, (nb.get(k) || 0) + 1); };
  for (const f of C.fils) { ajn(f[0], f[1]); ajn(f[2], f[3]); }
  for (const c of C.comps) for (const b of bornes(c)) ajn(b[0], b[1]);
  for (const f of C.fils) for (const [x, y] of [[f[0], f[1]], [f[2], f[3]]]) {   // T : bout de fil au milieu d'un autre fil
    for (const g of C.fils) if (g !== f && dSeg([x, y], [g[0], g[1]], [g[2], g[3]]) < 1e-6 && !((g[0] === x && g[1] === y) || (g[2] === x && g[3] === y))) ajn(x, y), ajn(x, y);
  }
  for (const [k, n] of nb) if (n >= 3) { const [x, y] = k.split(',').map(Number); s += `<circle class="sj" cx="${x * K}" cy="${y * K}" r="3.6"/>`; }
  // composants
  for (const c of C.comps) {
    const sel = sel0?.type === 'c' && sel0.id === c.id;
    s += `<g class="${sel ? 'sel' : ''}" transform="translate(${c.x * K} ${c.y * K})${c.t === 'G' ? '' : ` rotate(${(c.rot || 0) * 90})`}">${symbole(c, res)}</g>`;
  }
  // courant animé
  if (aff.anim && res.ok && !res.court) {
    for (const { seg, i } of res.fils) {
      const v = vitesse(i); if (!v) continue;
      const [a, b] = i > 0 ? [[seg[0], seg[1]], [seg[2], seg[3]]] : [[seg[2], seg[3]], [seg[0], seg[1]]];
      s += `<path class="sfl" style="animation-duration:${(16 / v).toFixed(2)}s" d="M${a[0] * K} ${a[1] * K}L${b[0] * K} ${b[1] * K}"/>`;
    }
    for (const c of C.comps) {
      const r = res.comps.get(c.id); if (!r || c.t === 'G') continue;
      const v = vitesse(r.i); if (!v) continue;
      const [a, b] = bornes(c); const [p, q] = r.i > 0 ? [a, b] : [b, a];
      s += `<path class="sfl" style="animation-duration:${(16 / v).toFixed(2)}s" d="M${p[0] * K} ${p[1] * K}L${q[0] * K} ${q[1] * K}"/>`;
    }
  }
  // étiquettes, flèches, appareils de mesure
  for (const c of C.comps) s += etiquettes(c, res, aff);
  return s;
}

/** Nom, valeur, tension (flèche vers le +) et courant d'un composant. */
function etiquettes(c, res, aff) {
  if (c.t === 'G') return aff.val ? '' : '';
  const [a, b] = bornes(c); const r = res.ok ? res.comps.get(c.id) : null;
  const hor = a[1] === b[1];
  const mx = (a[0] + b[0]) / 2 * K, my = (a[1] + b[1]) / 2 * K;
  let s = '';
  // côté « étiquette » : au-dessus (horizontal) ou à droite (vertical)
  const lig = [];
  if (aff.val) { lig.push([c.nom || '', 'st']); const v = valeurTexte(c); if (v) lig.push([v, 'st-v']); }
  if (c.t === 'A' || c.t === 'U') {           // appareil de mesure : sa lecture, toujours visible
    const val = r ? (c.t === 'A' ? fmt(Math.abs(r.i) < 1e-9 ? 0 : r.i, 'A') : fmt(Math.abs(r.u) < 1e-9 ? 0 : r.u, 'V')) : '—';
    const w = val.length * 7.4 + 12;
    const bx = hor ? mx - w / 2 : mx + 18, by = hor ? my - 38 : my - 10;
    s += `<rect class="sm" x="${bx}" y="${by}" width="${w}" height="20" rx="4"/><text class="sm-t" x="${bx + w / 2}" y="${by + 14}" text-anchor="middle">${esc(val)}</text>`;
    return s;
  }
  if (aff.ui && r && c.t !== 'S') lig.push([`I = ${fmt(Math.abs(r.i) < 1e-12 ? 0 : Math.abs(r.i), 'A')}`, 'st-i']);
  if (aff.ui && r && c.t === 'S' && !c.ferme && Math.abs(r.u) > 1e-6) lig.push([`U = ${fmt(Math.abs(r.u), 'V')}`, 'st-u']);
  lig.forEach(([t, cl], k) => {
    if (hor) s += `<text class="${cl}" x="${mx}" y="${my - 18 - (lig.length - 1 - k) * 13}" text-anchor="middle">${esc(t)}</text>`;
    else s += `<text class="${cl}" x="${mx + 18}" y="${my - (lig.length - 1) * 6.5 + k * 13 + 4}">${esc(t)}</text>`;
  });
  if (!aff.ui || !r || c.t === 'S') return s;
  // flèche de tension, de l'autre côté, vers le potentiel le plus haut
  if (Math.abs(r.u) > 1e-6) {
    const [lo, hi] = r.u > 0 ? [b, a] : [a, b];          // u = V(a) − V(b)
    const off = 22, nx = hor ? 0 : -off, ny = hor ? off : 0;
    const p1 = [lo[0] * K + nx, lo[1] * K + ny], p2 = [hi[0] * K + nx, hi[1] * K + ny];
    const ux = Math.sign(p2[0] - p1[0]), uy = Math.sign(p2[1] - p1[1]);
    const q1 = [p1[0] + ux * 6, p1[1] + uy * 6], q2 = [p2[0] - ux * 6, p2[1] - uy * 6];
    s += `<path class="su" d="M${q1[0]} ${q1[1]}L${q2[0]} ${q2[1]}"/><path class="su-f" d="M${q2[0]} ${q2[1]}l${-ux * 7 - uy * 3.5} ${-uy * 7 + ux * 3.5}l${uy * 7} ${-ux * 7}z"/>`;
    const t = `U = ${fmt(Math.abs(r.u), 'V')}`;
    s += hor ? `<text class="st-u" x="${mx}" y="${my + off + 15}" text-anchor="middle">${esc(t)}</text>` : `<text class="st-u" x="${mx - off - 6}" y="${my + 4}" text-anchor="end">${esc(t)}</text>`;
  }
  // flèche de courant, sur le fil d'arrivée
  if (Math.abs(r.i) > 1e-9) {
    const [p, q] = r.i > 0 ? [a, b] : [b, a];
    const ux = Math.sign(q[0] - p[0]), uy = Math.sign(q[1] - p[1]);
    const cx = p[0] * K + ux * 8, cy = p[1] * K + uy * 8;
    s += `<path class="si" d="M${cx + ux * 5} ${cy + uy * 5}l${-ux * 8 - uy * 4.5} ${-uy * 8 + ux * 4.5}l${uy * 9} ${-ux * 9}z"/>`;
  }
  return s;
}

/** Schéma figé d'un circuit résolu (cours interactif, aperçus) : SVG complet. */
export function svgCircuit(C, res, aff = { val: true, ui: true, anim: true, coul: false }, marge = 2) {
  const pts = [];
  for (const c of C.comps) for (const b of bornes(c)) pts.push(b);
  for (const f of C.fils) pts.push([f[0], f[1]], [f[2], f[3]]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = (Math.min(...xs) - marge) * K, y0 = (Math.min(...ys) - marge) * K, w = (Math.max(...xs) - Math.min(...xs) + 2 * marge) * K, h = (Math.max(...ys) - Math.min(...ys) + 2 * marge) * K;
  return `<svg class="sim-apercu" viewBox="${x0} ${y0} ${w} ${h}" width="${w}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Schéma du circuit"><style>${STYLE}</style><rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#fff"/>${corpsCircuit(C, res, aff)}</svg>`;
}

/* ============================== la vue ============================== */
export async function vueSimulateur(el) {
  const m = matieres().find((x) => x.schemas) || null;
  let D = lire();
  let C = D.courant && D.liste[D.courant] ? structuredClone(D.liste[D.courant]) : null;
  if (!C) { C = { id: nouvelId(), nom: 'Mon circuit', comps: [], fils: [] }; }
  const aff = { val: true, ui: true, anim: true, coul: false, ...(stockage.lire('simu.aff', {}) || {}) };
  const st = { mode: 'sel', place: null, rot: 0, sel: null, filPts: [], cur: null, drag: null, pan: null, hist: [], refaire: [], res: null };
  let vb = { x: -2 * K, y: -2 * K, w: 30 * K, h: 18 * K };

  el.innerHTML = `
  <div class="mc" ${m ? styleMatiere(m) : ''}>
    <div class="crumb"><a href="#/">Accueil</a><span class="crumb-sep">›</span>${m ? `<a href="#/m/${esc(m.id)}">${esc(m.nom)}</a><span class="crumb-sep">›</span>` : ''}<span>Simulateur de circuits</span></div>
    <div class="sim-barre">
      <a class="btn sim-retour" hidden>${icone('fleche-g')} Retour à l'exercice</a>
      <select class="sim-liste" aria-label="Mes circuits"></select>
      <button class="btn" data-a="nouveau" type="button">+ Nouveau</button>
      <button class="btn" data-a="renommer" type="button">Renommer</button>
      <button class="btn" data-a="supprimer-c" type="button">${icone('croix')} Supprimer</button>
      <select class="sim-ex" aria-label="Exemples"><option value="">Exemples…</option>${Object.entries(EXEMPLES).map(([k, x]) => `<option value="${k}">${esc(x.nom)}</option>`).join('')}</select>
      <span class="sim-sep"></span>
      <button class="btn icon" data-a="annuler" type="button" title="Annuler (Ctrl+Z)">↶</button>
      <button class="btn icon" data-a="retablir" type="button" title="Rétablir (Ctrl+Y)">↷</button>
      <button class="btn icon" data-a="zm" type="button" title="Dézoomer">−</button>
      <button class="btn icon" data-a="zp" type="button" title="Zoomer">+</button>
      <button class="btn" data-a="voir" type="button" title="Voir tout le circuit">Tout voir</button>
      <button class="btn" data-a="image" type="button" title="Télécharger le schéma (image SVG)">${icone('telecharger')} Image</button>
      <button class="btn" data-a="plein" type="button" title="Plein écran (P)">⛶ <span class="sim-plein-t">Plein écran</span></button>
    </div>
    <div class="sim-aff">${Object.entries(AFF).map(([k, t]) => `<label class="sim-ch"><input type="checkbox" data-aff="${k}"${aff[k] ? ' checked' : ''}> ${t}</label>`).join('')}</div>
    <div class="sim-wrap">
      <aside class="sim-pal panel" aria-label="Composants">
        <button class="sim-outil" data-mode="sel" type="button"><b>Sélection</b><span>Échap</span></button>
        <button class="sim-outil" data-mode="fil" type="button"><b>Fil</b><span>F</span></button>
        ${FAMILLES.map(([f, ts]) => `<div class="sim-fam">${f}</div>${ts.map((t) => `<button class="sim-outil sim-comp" data-place="${t}" type="button" title="${esc(TYPES[t].nom)}"><svg viewBox="-8 -26 64 52" width="54" height="40" aria-hidden="true"><style>${STYLE}</style>${t === 'G' ? `<g transform="translate(24 -12)">${symbole({ t })}</g>` : symbole({ t, rot: 0, ferme: false })}</svg><b>${TYPES[t].nom}</b><span>${TYPES[t].touche.toUpperCase()}</span></button>`).join('')}`).join('')}
      </aside>
      <div class="sim-zone panel">
        <svg class="sim-svg" xmlns="http://www.w3.org/2000/svg" tabindex="0" aria-label="Schéma du circuit"></svg>
        <div class="sim-msg" hidden></div>
        <div class="sim-aide muted"></div>
      </div>
      <aside class="sim-prop panel" aria-label="Propriétés"></aside>
    </div>
  </div>`;
  const svg = el.querySelector('.sim-svg'), prop = el.querySelector('.sim-prop'), msg = el.querySelector('.sim-msg'), aide = el.querySelector('.sim-aide');

  /* ----- enregistrement et historique ----- */
  function sauver() {
    C.maj = Date.now();
    D = lire(); D.liste[C.id] = structuredClone(C); D.courant = C.id; ecrire(D);
  }
  function changer(fn) {
    st.hist.push(JSON.stringify(C)); if (st.hist.length > 100) st.hist.shift(); st.refaire = [];
    fn(); sauver(); calculer(); dessiner(); panneau();
  }
  function annuler() { if (!st.hist.length) return; st.refaire.push(JSON.stringify(C)); C = JSON.parse(st.hist.pop()); st.sel = null; sauver(); calculer(); dessiner(); panneau(); }
  function retablir() { if (!st.refaire.length) return; st.hist.push(JSON.stringify(C)); C = JSON.parse(st.refaire.pop()); st.sel = null; sauver(); calculer(); dessiner(); panneau(); }
  function listeCircuits() {
    D = lire();
    const ls = Object.values(D.liste).sort((a, b) => (b.maj || 0) - (a.maj || 0));
    if (!ls.find((x) => x.id === C.id)) ls.unshift(C);
    el.querySelector('.sim-liste').innerHTML = ls.map((x) => `<option value="${esc(x.id)}"${x.id === C.id ? ' selected' : ''}>${esc(x.nom || 'Sans nom')}</option>`).join('');
    majRetour();
  }
  function majRetour() {                    // circuit ouvert depuis un exercice : lien de retour
    const r = stockage.lire('simu.retour', null); const a = el.querySelector('.sim-retour');
    a.hidden = !(r && r.id === C.id); if (!a.hidden) { a.href = r.h; a.title = r.t || ''; }
  }
  function ouvrir(c) { C = structuredClone(c); st.sel = null; st.hist = []; st.refaire = []; st.filPts = []; sauver(); listeCircuits(); calculer(); toutVoir(); panneau(); }

  /* ----- calcul ----- */
  function calculer() {
    try { st.res = resoudre(C); } catch (e) { console.error(e); st.res = { ok: false, msg: 'Erreur de calcul.', comps: new Map(), fils: [], V: new Map() }; }
    const t = !st.res.ok ? st.res.msg : st.res.court ? st.res.msg : '';
    msg.hidden = !t; msg.textContent = t;
  }

  /* ----- géométrie écran ----- */
  function versGrille(ev) {
    const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [p.x / K, p.y / K];
  }
  const accroche = (p) => [Math.round(p[0]), Math.round(p[1])];
  function toucher(p) {
    for (let k = C.comps.length - 1; k >= 0; k--) {
      const c = C.comps[k]; const bs = bornes(c);
      const d = c.t === 'G' ? dSeg(p, bs[0], [bs[0][0], bs[0][1] + 0.9]) : dSeg(p, bs[0], bs[1]);
      if (d < 0.55) return { type: 'c', id: c.id };
    }
    for (let i = C.fils.length - 1; i >= 0; i--) { const f = C.fils[i]; if (dSeg(p, [f[0], f[1]], [f[2], f[3]]) < 0.3) return { type: 'f', i }; }
    return null;
  }
  const compSel = () => (st.sel?.type === 'c' ? C.comps.find((c) => c.id === st.sel.id) : null);

  /* ----- rendu ----- */
  function dessiner() {
    svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    const res = st.res || { comps: new Map(), fils: [], V: new Map() };
    let s = `<style>${STYLE}</style><rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="#fff"/>`;
    // grille (points)
    const gx0 = Math.floor(vb.x / K), gx1 = Math.ceil((vb.x + vb.w) / K), gy0 = Math.floor(vb.y / K), gy1 = Math.ceil((vb.y + vb.h) / K);
    if ((gx1 - gx0) * (gy1 - gy0) < 12000) {
      let d = '';
      for (let x = gx0; x <= gx1; x++) for (let y = gy0; y <= gy1; y++) d += `M${x * K} ${y * K}h.01`;
      s += `<path d="${d}" stroke="#c3cad6" stroke-width="2.4" stroke-linecap="round"/>`;
    }
    s += corpsCircuit(C, res, aff, st.sel);
    // zones cliquables
    for (const c of C.comps) { const bs = bornes(c); const b2 = c.t === 'G' ? [bs[0][0], bs[0][1] + 0.9] : bs[1]; s += `<path class="sx" data-c="${esc(c.id)}" d="M${bs[0][0] * K} ${bs[0][1] * K}L${b2[0] * K} ${b2[1] * K}"/>`; }
    // aperçus (placement, fil en cours)
    if (st.mode === 'place' && st.cur) {
      const g = { t: st.place, x: st.cur[0], y: st.cur[1], rot: st.rot, val: TYPES[st.place].defaut, ferme: false };
      s += `<g class="sgh" transform="translate(${g.x * K} ${g.y * K})${g.t === 'G' ? '' : ` rotate(${g.rot * 90})`}">${symbole(g, null)}</g>`;
    }
    if (st.mode === 'fil') {
      if (st.cur) s += `<circle class="sp" cx="${st.cur[0] * K}" cy="${st.cur[1] * K}" r="4"/>`;
      if (st.filPts.length && st.cur) for (const f of trajet(st.filPts[st.filPts.length - 1], st.cur)) s += `<path class="sf sgh" style="opacity:.7;stroke:#1d5fd1" d="M${f[0] * K} ${f[1] * K}L${f[2] * K} ${f[3] * K}"/>`;
    }
    if (st.mode !== 'sel') for (const c of C.comps) for (const b of bornes(c)) s += `<circle class="sp" cx="${b[0] * K}" cy="${b[1] * K}" r="2.8"/>`;
    svg.innerHTML = s;
  }

  /** Fil en L entre deux points (horizontal puis vertical, ou l'inverse). */
  function trajet(a, b) {
    if (a[0] === b[0] || a[1] === b[1]) return [[a[0], a[1], b[0], b[1]]];
    const h = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
    const c = h ? [b[0], a[1]] : [a[0], b[1]];
    return [[a[0], a[1], c[0], c[1]], [c[0], c[1], b[0], b[1]]];
  }

  /* ----- panneau de droite ----- */
  function panneau() {
    const c = compSel(); const res = st.res;
    if (st.sel?.type === 'f') {
      prop.innerHTML = `<h3>Fil</h3><p class="muted">Touche Suppr pour l'effacer.</p><button class="btn" data-a="supprimer" type="button">${icone('croix')} Supprimer le fil</button>`;
      return;
    }
    if (!c) {
      prop.innerHTML = `<h3>${esc(C.nom || 'Circuit')}</h3>
        <ol class="sim-mode">
          <li>Choisis un composant à gauche (ou sa lettre au clavier), puis clique sur la grille pour le poser. <b>R</b> le fait tourner.</li>
          <li>Outil <b>Fil</b> (F) : clique une borne, puis le point suivant ; le fil fait l'angle droit tout seul. Échap ou double-clic pour finir.</li>
          <li>Clique un composant pour changer sa valeur ; glisse-le pour le déplacer (ses fils suivent).</li>
          <li>Clique un interrupteur pour l'ouvrir ou le fermer.</li>
        </ol>
        <p class="muted">${C.comps.length} composant${C.comps.length > 1 ? 's' : ''} · ${C.fils.length} fil${C.fils.length > 1 ? 's' : ''}</p>`;
      return;
    }
    const T = TYPES[c.t]; const r = res?.ok ? res.comps.get(c.id) : null;
    const champ = (k, lab, val, u) => `<label class="sim-f"><span>${lab}</span><input data-k="${k}" value="${esc(val)}" inputmode="decimal" autocomplete="off"><em>${u}</em></label>`;
    let f = `<label class="sim-f"><span>Nom</span><input data-k="nom" value="${esc(c.nom || '')}" maxlength="12"></label>`;
    if (c.t === 'R') f += champ('val', 'Résistance', fmt(c.val, 'Ω').replace(/\s?[kM]?Ω$/, (x) => x.trim().replace('Ω', '')), 'Ω');
    if (c.t === 'V') f += champ('val', 'Tension', String(c.val).replace('.', ','), 'V');
    if (c.t === 'W') {
      const vmax = c.vmax || 30, vmin = c.vmin || 0;
      f += champ('val', 'Tension', String(+(+c.val).toFixed(2)).replace('.', ','), 'V')
        + `<input class="sim-curseur" type="range" min="${vmin}" max="${vmax}" step="${(vmax - vmin) / 300}" value="${Math.min(vmax, Math.max(vmin, c.val || 0))}" aria-label="Régler la tension"><div class="sim-bornes"><span>${String(vmin).replace('.', ',')} V</span><span>${String(vmax).replace('.', ',')} V</span></div>`
        + champ('vmin', 'Minimum du curseur', String(vmin).replace('.', ','), 'V')
        + champ('vmax', 'Maximum du curseur', String(vmax).replace('.', ','), 'V');
    }
    if (c.t === 'I') f += champ('val', 'Courant', fmt(c.val, 'A').replace(/\s?[mµ]?A$/, (x) => x.trim().replace('A', '')), 'A');
    if (c.t === 'L') f += champ('un', 'Tension nominale', String(c.un || 12).replace('.', ','), 'V') + champ('pn', 'Puissance nominale', String(c.pn || 6).replace('.', ','), 'W') + `<p class="muted small">Résistance : ${fmt(resistanceLampe(c), 'Ω')}</p>`;
    if (c.t === 'D' || c.t === 'Z') f += champ('vs', 'Seuil (sens direct)', String(c.vs ?? 0.7).replace('.', ','), 'V');
    if (c.t === 'Z') f += champ('vz', 'Tension Zener Vz', String(c.vz ?? 5.1).replace('.', ','), 'V');
    if (c.t === 'H') f += champ('vs', 'Seuil', String(seuil(c)).replace('.', ','), 'V');
    if (c.t === 'H') f += `<label class="sim-f"><span>Couleur</span><select data-coul>${Object.entries(LED).map(([k, [v]]) => `<option value="${k}"${(c.coul || 'rouge') === k ? ' selected' : ''}>${k} · ${String(v).replace('.', ',')} V</option>`).join('')}</select></label>`;
    if (c.t === 'S') f += `<button class="btn ${c.ferme ? 'primary' : ''}" data-a="basculer" type="button">${c.ferme ? 'Fermé : cliquer pour ouvrir' : 'Ouvert : cliquer pour fermer'}</button>`;
    const resuDe = () => { const r = st.res?.ok ? st.res.comps.get(c.id) : null; return !r ? '' : c.t === 'A' ? `<div class="sim-lec">${esc(fmt(Math.abs(r.i) < 1e-9 ? 0 : r.i, 'A'))}</div>`
      : c.t === 'U' ? `<div class="sim-lec">${esc(fmt(Math.abs(r.u) < 1e-9 ? 0 : r.u, 'V'))}</div>`
      : c.t === 'G' ? '' : `<dl class="sim-res"><dt>Tension</dt><dd>${esc(fmt(Math.abs(r.u), 'V'))}</dd><dt>Courant</dt><dd>${esc(fmt(Math.abs(r.i) < 1e-12 ? 0 : Math.abs(r.i), 'A'))}</dd>${c.t !== 'S' ? `<dt>Puissance</dt><dd>${esc(fmt(r.p, 'W'))}</dd>` : ''}${c.t === 'L' ? `<dt>Éclat</dt><dd>${Math.round(Math.min(1, r.p / (c.pn || 6)) * 100)} %</dd>` : ''}${r.etat ? `<dt>État</dt><dd>${ETAT[r.etat]}</dd>` : ''}</dl>${c.t === 'H' && r.i > 0.03 ? '<p class="sim-alerte">⚠ Plus de 30 mA : une vraie LED grillerait. Ajoute ou augmente la résistance en série.</p>' : ''}`; };
    const resu = resuDe();
    prop.innerHTML = `<h3>${esc(T.nom)}</h3>${T.aide ? `<p class="muted small">${esc(T.aide)}</p>` : ''}
      <div class="sim-champs">${f}</div><div class="sim-resu">${resu}</div>
      <div class="sim-btns"><button class="btn" data-a="tourner" type="button" title="Tourner (R)">↻ Tourner</button><button class="btn" data-a="supprimer" type="button">${icone('croix')} Supprimer</button></div>`;
    const cur = prop.querySelector('.sim-curseur');
    if (cur) {
      let avant = null;
      cur.addEventListener('input', () => {                 // en direct pendant qu'on glisse
        if (avant == null) avant = JSON.stringify(C);
        c.val = +(+cur.value).toFixed(2); calculer(); dessiner();
        const iv = prop.querySelector('input[data-k="val"]'); if (iv) iv.value = String(c.val).replace('.', ',');
        prop.querySelector('.sim-resu').innerHTML = resuDe();
      });
      cur.addEventListener('change', () => {                // lâché : une seule étape d'historique
        if (avant != null) { st.hist.push(avant); if (st.hist.length > 100) st.hist.shift(); st.refaire = []; avant = null; }
        sauver();
      });
    }
    prop.querySelector('select[data-coul]')?.addEventListener('change', (ev) => changer(() => { c.coul = ev.target.value; c.vs = LED[c.coul][0]; }));
    prop.querySelectorAll('input[data-k]').forEach((inp) => inp.addEventListener('change', () => {
      const k = inp.dataset.k;
      if (k === 'nom') { changer(() => { c.nom = inp.value.trim().slice(0, 12); }); return; }
      const v = lireValeur(inp.value);
      if (v == null || (k !== 'val' && k !== 'vmin' && v <= 0) || (k === 'vmin' && v >= (c.vmax || 30)) || (c.t === 'R' && v <= 0)) { toast('Valeur non comprise : exemples 100 · 4,7k · 2,2M · 20m'); panneau(); return; }
      changer(() => { c[k] = v; if (c.t === 'W') { if (k === 'val' && v > (c.vmax || 30)) c.vmax = v; if (k === 'val' && v < (c.vmin || 0)) c.vmin = v; if (k === 'vmax' && c.val > v) c.val = v; if (k === 'vmin' && c.val < v) c.val = v; } });
    }));
  }

  /* ----- actions ----- */
  function setMode(mode, place) {
    st.mode = mode; st.place = place || null; st.filPts = []; if (mode !== 'place') st.rot = 0;
    el.querySelectorAll('.sim-outil').forEach((b) => b.classList.toggle('actif', mode === 'place' ? b.dataset.place === place : b.dataset.mode === mode));
    aide.textContent = mode === 'fil' ? 'Fil : clique un point de départ, puis le point suivant (angle droit automatique). Échap ou double-clic pour finir.'
      : mode === 'place' ? `${TYPES[place].nom} : clique sur la grille pour le poser · R pour tourner · Échap pour arrêter.`
      : 'Sélection : clique un composant ou un fil ; glisse un composant pour le déplacer ; glisse le fond pour déplacer la vue ; molette pour zoomer.';
    dessiner();
  }
  function poser(p) {
    const t = st.place, T = TYPES[t];
    const n = C.comps.filter((c) => c.t === t).length + 1;
    const c = { id: nouvelId(), t, x: p[0], y: p[1], rot: st.rot, nom: `${T.pre}${n}` };
    if (T.defaut != null) c.val = T.defaut;
    if (t === 'L') { c.un = 12; c.pn = 6; }
    if (t === 'S') c.ferme = true;
    if (t === 'W') c.vmax = 30;
    if (t === 'D' || t === 'Z') c.vs = 0.7;
    if (t === 'Z') c.vz = 5.1;
    if (t === 'H') c.coul = 'rouge';
    changer(() => { C.comps.push(c); });
    st.sel = { type: 'c', id: c.id }; panneau(); dessiner();
  }
  function ajouterFil(a, b) {
    const segs = trajet(a, b).filter((f) => !(f[0] === f[2] && f[1] === f[3]));
    if (!segs.length) return;
    changer(() => { for (const s of segs) if (!C.fils.some((g) => (g[0] === s[0] && g[1] === s[1] && g[2] === s[2] && g[3] === s[3]) || (g[0] === s[2] && g[1] === s[3] && g[2] === s[0] && g[3] === s[1]))) C.fils.push(s); });
  }
  function supprimerSel() {
    if (!st.sel) return;
    if (st.sel.type === 'c') { const id = st.sel.id; changer(() => { C.comps = C.comps.filter((c) => c.id !== id); }); }
    else { const i = st.sel.i; changer(() => { C.fils.splice(i, 1); }); }
    st.sel = null; panneau(); dessiner();
  }
  function tourner() {
    if (st.mode === 'place') { st.rot = (st.rot + 1) % 4; dessiner(); return; }
    const c = compSel(); if (!c || c.t === 'G') return;
    changer(() => { c.rot = ((c.rot || 0) + 1) % 4; });
  }
  function toutVoir() {
    const pts = [...C.comps.flatMap(bornes), ...C.fils.flatMap((f) => [[f[0], f[1]], [f[2], f[3]]])];
    if (!pts.length) { vb = { x: -2 * K, y: -2 * K, w: 30 * K, h: 18 * K }; dessiner(); return; }
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs) - 4, x1 = Math.max(...xs) + 4, y0 = Math.min(...ys) - 3, y1 = Math.max(...ys) + 3;
    const r = svg.clientWidth / Math.max(svg.clientHeight, 1) || 1.6;
    let w = (x1 - x0) * K, h = (y1 - y0) * K;
    if (w / h < r) w = h * r; else h = w / r;
    vb = { x: ((x0 + x1) / 2) * K - w / 2, y: ((y0 + y1) / 2) * K - h / 2, w, h }; dessiner();
  }
  function zoom(f, centre) {
    const c = centre || [vb.x + vb.w / 2, vb.y + vb.h / 2];
    const w = Math.min(Math.max(vb.w * f, 8 * K), 400 * K), h = vb.h * (w / vb.w);
    vb = { x: c[0] - (c[0] - vb.x) * (w / vb.w), y: c[1] - (c[1] - vb.y) * (w / vb.w), w, h }; dessiner();
  }
  function exporterImage() {
    const s = svg.cloneNode(true);
    s.querySelectorAll('.sx,.sfl,.sp,.sgh').forEach((n) => n.remove());
    s.setAttribute('width', vb.w); s.setAttribute('height', vb.h);
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${s.outerHTML}`], { type: 'image/svg+xml' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${(C.nom || 'circuit').replace(/[^\w-]+/g, '_')}.svg`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ----- souris ----- */
  svg.addEventListener('pointerdown', (ev) => {
    if (ev.button === 2) return;
    svg.focus({ preventScroll: true });
    const g = versGrille(ev), p = accroche(g);
    if (st.mode === 'place') { poser(p); if (!ev.shiftKey) setMode('sel'); return; }
    if (st.mode === 'fil') {
      const der = st.filPts[st.filPts.length - 1];
      if (der && der[0] === p[0] && der[1] === p[1]) { st.filPts = []; dessiner(); return; }
      if (der) ajouterFil(der, p);
      st.filPts.push(p); dessiner(); return;
    }
    const t = toucher(g);
    if (t?.type === 'c') {
      const c = C.comps.find((x) => x.id === t.id);
      st.drag = { id: c.id, debut: p, orig: [c.x, c.y], bouge: false, avant: JSON.stringify(C), pins: bornes(c).map((b) => b.slice()) };
      st.sel = t; panneau(); dessiner();
      svg.setPointerCapture(ev.pointerId);
    } else if (t?.type === 'f') { st.sel = t; panneau(); dessiner(); }
    else { st.sel = null; panneau(); st.pan = { x: ev.clientX, y: ev.clientY, vb: { ...vb } }; svg.setPointerCapture(ev.pointerId); dessiner(); }
  });
  svg.addEventListener('pointermove', (ev) => {
    const g = versGrille(ev), p = accroche(g);
    if (st.pan) {
      const sx = vb.w / svg.clientWidth;
      vb = { ...st.pan.vb, x: st.pan.vb.x - (ev.clientX - st.pan.x) * sx, y: st.pan.vb.y - (ev.clientY - st.pan.y) * sx };
      svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`); return;
    }
    if (st.drag) {
      const c = C.comps.find((x) => x.id === st.drag.id); if (!c) return;
      const dx = p[0] - st.drag.debut[0], dy = p[1] - st.drag.debut[1];
      if (!dx && !dy && !st.drag.bouge) return;
      st.drag.bouge = true;
      const nx = st.drag.orig[0] + dx, ny = st.drag.orig[1] + dy;
      const ddx = nx - c.x, ddy = ny - c.y; if (!ddx && !ddy) return;
      const anciens = bornes(c);
      c.x = nx; c.y = ny;
      // les fils accrochés aux bornes suivent
      for (const f of C.fils) for (const [ix, iy] of [[0, 1], [2, 3]]) if (anciens.some((b) => b[0] === f[ix] && b[1] === f[iy])) { f[ix] += ddx; f[iy] += ddy; }
      calculer(); dessiner(); return;
    }
    if (st.mode !== 'sel') { st.cur = p; dessiner(); }
  });
  const fin = (ev) => {
    if (st.pan) { st.pan = null; return; }
    if (st.drag) {
      const d = st.drag; st.drag = null;
      const c = C.comps.find((x) => x.id === d.id);
      if (d.bouge) {
        C.fils = C.fils.filter((f) => !(f[0] === f[2] && f[1] === f[3]));
        st.hist.push(d.avant); st.refaire = []; sauver(); calculer(); dessiner(); panneau();
      } else if (c?.t === 'S') { changer(() => { c.ferme = !c.ferme; }); }
      try { svg.releasePointerCapture(ev.pointerId); } catch { /* rien */ }
    }
  };
  svg.addEventListener('pointerup', fin);
  svg.addEventListener('pointercancel', fin);
  svg.addEventListener('dblclick', () => { if (st.mode === 'fil') { st.filPts = []; dessiner(); } });
  svg.addEventListener('contextmenu', (ev) => { ev.preventDefault(); if (st.mode === 'fil' && st.filPts.length) { st.filPts = []; dessiner(); } else setMode('sel'); });
  svg.addEventListener('pointerleave', () => { if (st.mode !== 'sel') { st.cur = null; dessiner(); } });
  svg.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const g = versGrille(ev); zoom(ev.deltaY > 0 ? 1.15 : 1 / 1.15, [g[0] * K, g[1] * K]);
  }, { passive: false });

  /* ----- clavier ----- */
  const clavier = (ev) => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    const k = ev.key;
    if ((ev.ctrlKey || ev.metaKey) && k.toLowerCase() === 'z') { ev.preventDefault(); if (ev.shiftKey) retablir(); else annuler(); return; }
    if ((ev.ctrlKey || ev.metaKey) && k.toLowerCase() === 'y') { ev.preventDefault(); retablir(); return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (k === 'Escape') { if (st.mode === 'fil' && st.filPts.length) { st.filPts = []; dessiner(); } else if (st.mode !== 'sel') setMode('sel'); else { st.sel = null; panneau(); dessiner(); } return; }
    if (k === 'Delete' || k === 'Backspace') { if (st.sel) { ev.preventDefault(); supprimerSel(); } return; }
    if (k === 'f' || k === 'F' || k === 'w' || k === 'W') { setMode('fil'); return; }
    if (k === 'p' || k === 'P') { pleinEcran(); return; }
    if (k === ' ' && st.mode === 'place') { ev.preventDefault(); tourner(); return; }
    if ((k === 'r' || k === 'R') && (st.mode === 'place' || compSel())) { tourner(); return; }
    const t = Object.entries(TYPES).find(([, T]) => T.touche === k.toLowerCase());
    if (t) setMode('place', t[0]);
  };
  document.addEventListener('keydown', clavier);

  /* ----- barre et palette ----- */
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.mode) { setMode(b.dataset.mode); return; }
    if (b.dataset.place) { setMode('place', b.dataset.place); return; }
    const a = b.dataset.a;
    if (a === 'annuler') annuler(); else if (a === 'retablir') retablir();
    else if (a === 'zm') zoom(1.25); else if (a === 'zp') zoom(0.8); else if (a === 'voir') toutVoir(); else if (a === 'plein') pleinEcran();
    else if (a === 'image') exporterImage();
    else if (a === 'tourner') tourner(); else if (a === 'supprimer') supprimerSel();
    else if (a === 'basculer') { const c = compSel(); if (c) changer(() => { c.ferme = !c.ferme; }); }
    else if (a === 'nouveau') { ouvrir({ id: nouvelId(), nom: `Circuit ${Object.keys(lire().liste).length + 1}`, comps: [], fils: [] }); }
    else if (a === 'renommer') { const n = prompt('Nom du circuit :', C.nom || ''); if (n != null && n.trim()) { C.nom = n.trim().slice(0, 60); sauver(); listeCircuits(); panneau(); } }
    else if (a === 'supprimer-c') {
      if (!confirm(`Supprimer « ${C.nom || 'ce circuit'} » ?`)) return;
      D = lire(); delete D.liste[C.id]; D.courant = null; ecrire(D);
      const reste = Object.values(D.liste).sort((x, y) => (y.maj || 0) - (x.maj || 0));
      ouvrir(reste[0] || { id: nouvelId(), nom: 'Mon circuit', comps: [], fils: [] });
    }
  });
  el.querySelector('.sim-liste').addEventListener('change', (ev) => { const c = lire().liste[ev.target.value]; if (c) ouvrir(c); });
  el.querySelector('.sim-ex').addEventListener('change', (ev) => {
    const x = EXEMPLES[ev.target.value]; ev.target.value = ''; if (!x) return;
    ouvrir({ id: nouvelId(), nom: x.nom, comps: structuredClone(x.comps), fils: structuredClone(x.fils) });
  });
  el.querySelectorAll('[data-aff]').forEach((cb) => cb.addEventListener('change', () => { aff[cb.dataset.aff] = cb.checked; stockage.ecrire('simu.aff', aff); dessiner(); }));

  // premier affichage
  sauver(); listeCircuits(); calculer(); setMode('sel'); panneau();
  requestAnimationFrame(() => { if (C.comps.length || C.fils.length) toutVoir(); else dessiner(); });
  /* ----- place à l'écran et plein écran ----- */
  const wrap = el.querySelector('.sim-wrap'); const mc = el.querySelector('.mc');
  document.body.classList.add('sim-large');            // la page prend toute la largeur
  function ajuster() {                                  // la zone de dessin descend jusqu'au bas de la fenêtre
    if (window.innerWidth <= 900) { wrap.style.height = ''; return; }
    const haut = wrap.getBoundingClientRect().top + window.scrollY;
    wrap.style.height = `${Math.max(420, window.innerHeight - (mc.classList.contains('sim-plein') ? wrap.getBoundingClientRect().top : haut) - 10)}px`;
  }
  const surTaille = () => { ajuster(); dessiner(); };
  function majPlein() {
    const on = mc.classList.contains('sim-plein');
    el.querySelector('.sim-plein-t').textContent = on ? 'Quitter' : 'Plein écran';
    requestAnimationFrame(() => { ajuster(); toutVoir(); });
  }
  function pleinEcran() {
    const on = !mc.classList.contains('sim-plein');
    mc.classList.toggle('sim-plein', on);
    try {
      if (on && mc.requestFullscreen && !document.fullscreenElement) mc.requestFullscreen().catch(() => {});
      else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch { /* navigateur sans plein écran : la classe suffit (fenêtre entière) */ }
    majPlein();
  }
  const surPlein = () => { if (!document.fullscreenElement && mc.classList.contains('sim-plein')) { mc.classList.remove('sim-plein'); majPlein(); } };
  document.addEventListener('fullscreenchange', surPlein);
  window.addEventListener('resize', surTaille);
  ajuster(); toutVoir();
  return () => {
    document.removeEventListener('keydown', clavier); window.removeEventListener('resize', surTaille);
    document.removeEventListener('fullscreenchange', surPlein); document.body.classList.remove('sim-large');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
}
