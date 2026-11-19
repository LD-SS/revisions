/* =====================================================================
   DAO — COTATION DES PERSPECTIVES : objets de cote et retouches admin
   ---------------------------------------------------------------------
   La cotation automatique d'une perspective (js/dao/prisme.js) est une
   liste d'objets, en unités du dessin SVG (y vers le bas) :
     { t: 'q', e1: [A, Ao], e2: [B, Bo], d: [Ao, Bo], txt, m: [x, y], ang, an, rp }
         cote : lignes d'attache A→Ao et B→Bo (tiretées), ligne de cote
         Ao→Bo avec flèches, chiffre en m (angle ang°, ancrage an =
         'start' | 'middle' | 'end'), trait de rappel rp = [P, Q] facultatif.
     { t: 'r', c: [x, y], q: [x, y], sg: ±1, txt }
         renvoi : du point c au coude q, palier de 16 vers la gauche (sg −1)
         ou la droite (sg 1), texte au-dessus du palier.
     { t: 'x', m: [x, y], txt, ang }   texte libre.
   L'admin peut redessiner cette cotation (js/vues/retouche.js) ; la liste
   retouchée est enregistrée dans Firestore (content/dessin/retouches-cotes.json,
   { "<id pièce>": { objs: [...] } }) et remplace alors l'automatique partout
   (appli, cahier imprimé).
   ===================================================================== */

export const CHEMIN_RETOUCHES = 'content/dessin/retouches-cotes.json';
const BLEU = '#1d5fd1';
const f2 = (v) => Math.round(v * 100) / 100;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const POLICE = 'font-size="9" font-family="Segoe UI,Arial,sans-serif"';

let RETOUCHES = {};
/** Retouches chargées au démarrage (objet { id: { objs } }). */
export function definirRetouches(r) { RETOUCHES = r && typeof r === 'object' ? r : {}; }
export const toutesRetouches = () => RETOUCHES;
export const retouche = (id) => (id && RETOUCHES[id]?.objs) || null;

/** Largeur approximative d'un texte de cote (police 9). */
export const largeurTexte = (txt) => String(txt).length * 5.5;

const fl = (t, u) => { const n = [-u[1], u[0]], Lf = 5; return `<path d="M${f2(t[0])} ${f2(t[1])}L${f2(t[0] - u[0] * Lf + n[0] * 1.6)} ${f2(t[1] - u[1] * Lf + n[1] * 1.6)}L${f2(t[0] - u[0] * Lf - n[0] * 1.6)} ${f2(t[1] - u[1] * Lf - n[1] * 1.6)}Z" fill="${BLEU}"/>`; };
const seg = (a, b) => `M${f2(a[0])} ${f2(a[1])}L${f2(b[0])} ${f2(b[1])}`;

/** SVG d'un objet de cote (attrs : attributs en plus sur le groupe, ex. data-i). */
export function svgObjet(o, attrs = '') {
  const fin = `stroke="${BLEU}" stroke-width="0.9"`;
  let s = '';
  if (o.t === 'q') {
    const e = [o.e1, o.e2].filter((x) => x && Math.hypot(x[1][0] - x[0][0], x[1][1] - x[0][1]) > 0.01);
    if (e.length) s += `<path d="${e.map(([a, b]) => seg(a, b)).join('')}" ${fin} stroke-dasharray="2 2" fill="none"/>`;
    if (o.d) {
      const [Ao, Bo] = o.d, Lg = Math.hypot(Bo[0] - Ao[0], Bo[1] - Ao[1]);
      if (Lg >= 1) {
        const u = [(Bo[0] - Ao[0]) / Lg, (Bo[1] - Ao[1]) / Lg];
        const demi = String(o.txt ?? '').length * 2.6 + 0.8, court = o.court ?? Lg < 2 * demi + 1;
        if (court) s += `<path d="${seg([Ao[0] - u[0] * 7, Ao[1] - u[1] * 7], [Bo[0] + u[0] * 7, Bo[1] + u[1] * 7])}" ${fin} fill="none"/>` + fl(Ao, u) + fl(Bo, [-u[0], -u[1]]);
        else s += `<path d="${seg(Ao, Bo)}" ${fin} fill="none"/>` + fl(Ao, [-u[0], -u[1]]) + fl(Bo, u);
      }
    }
    if (o.rp) s += `<path d="${seg(o.rp[0], o.rp[1])}" stroke="${BLEU}" stroke-width="0.5" fill="none"/>`;
    if (o.m && o.txt !== '' && o.txt != null) s += texte(o);
  } else if (o.t === 'r') {
    s += `<path d="M${f2(o.c[0])} ${f2(o.c[1])}L${f2(o.q[0])} ${f2(o.q[1])}h${o.sg * 16}" ${fin} fill="none"/><text x="${f2(o.q[0] + o.sg * 2)}" y="${f2(o.q[1] - 2)}" text-anchor="${o.sg < 0 ? 'end' : 'start'}" ${POLICE} fill="${BLEU}">${esc(o.txt)}</text>`;
  } else if (o.t === 'x') s += texte({ ...o, an: o.an || 'middle' });
  return `<g${attrs ? ` ${attrs}` : ''}>${s}</g>`;
}
function texte(o) {
  const rot = o.ang ? ` transform="rotate(${f2(o.ang)} ${f2(o.m[0])} ${f2(o.m[1])})"` : '';
  return `<text x="${f2(o.m[0])}" y="${f2(o.m[1])}"${rot} text-anchor="${o.an || 'middle'}" ${POLICE} fill="${BLEU}">${esc(o.txt)}</text>`;
}
export const svgObjets = (objs) => objs.map((o) => svgObjet(o)).join('');

/** Boîte [x0, y0, x1, y1] d'un texte d'objet (chiffre de cote ou texte de renvoi). */
export function boiteTexte(o) {
  if (o.t === 'r') { const w = largeurTexte(o.txt) + 2; return o.sg < 0 ? [o.q[0] - 18 - w, o.q[1] - 11, o.q[0] - 2, o.q[1]] : [o.q[0] + 2, o.q[1] - 11, o.q[0] + 18 + w, o.q[1]]; }
  if (!o.m) return null;
  const w = largeurTexte(o.txt), x0 = o.an === 'start' ? o.m[0] : o.an === 'end' ? o.m[0] - w : o.m[0] - w / 2;
  if (o.ang) { const r = Math.max(w / 2, 6); return [o.m[0] - r, o.m[1] - r, o.m[0] + r, o.m[1] + r]; }
  return [x0, o.m[1] - 9, x0 + w, o.m[1] + 2];
}

/** Points qui bornent un objet (pour la boîte du dessin). */
export function bornesObjet(o) {
  const pts = [];
  if (o.e1) pts.push(...o.e1); if (o.e2) pts.push(...o.e2); if (o.d) pts.push(...o.d); if (o.rp) pts.push(...o.rp);
  if (o.c) pts.push(o.c); if (o.q) pts.push(o.q);
  const b = boiteTexte(o); if (b) pts.push([b[0], b[1]], [b[2], b[3]]);
  return pts;
}
