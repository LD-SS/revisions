/* =====================================================================
   DAO — PERSPECTIVE ISOMÉTRIQUE COTÉE d'une pièce (js/dao/pieces.js)
   ---------------------------------------------------------------------
   Vue de l'avant, de la gauche et du dessus (les faces visibles sont la
   face avant, le flanc gauche et le dessus, comme pour les 3 vues).
   Projection : u = (x − y)·cos 30°, v = (x + y)·sin 30° + z.
   Faces peintes de la plus lointaine à la plus proche (fond blanc).
   Cotation en série : abscisses sous la face avant, hauteurs à droite,
   profondeurs le long de l'arête inférieure gauche ; Ø des trous.
   Renvoie une chaîne SVG autonome (styles en attributs).
   ===================================================================== */

import { boite, intervallesZ } from './pieces.js';

const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
const f2 = (v) => Math.round(v * 100) / 100;
const nb = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

export function svgPerspective(piece, { cotes = true, largeur = 420 } = {}) {
  const b = boite(piece), P = piece.prof;
  const pr = ([x, y, z]) => [(x - y) * C30, -((x + y) * S30 + z)];   // y écran vers le bas
  const prof = piece.profil;
  const aire = prof.reduce((s, p, i) => { const q = prof[(i + 1) % prof.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  const sensDirect = aire > 0;
  const faces = [];
  const poly = (pts3) => pts3.map(pr);
  // face arrière (jamais vue) et avant
  faces.push({ pts: poly(prof.map(([x, z]) => [x, P, z])), d: Infinity, vue: false });
  // faces latérales (une par arête du profil), visibles si la normale regarde vers l'observateur
  prof.forEach(([x1, z1], i) => {
    const [x2, z2] = prof[(i + 1) % prof.length];
    let nx = z2 - z1, nz = -(x2 - x1);              // normale extérieure si le profil tourne dans le sens direct
    if (!sensDirect) { nx = -nx; nz = -nz; }
    const vis = (-nx + nz) > 1e-9;                 // visible si n·(−1, −1, 1) > 0
    const pts = [[x1, 0, z1], [x2, 0, z2], [x2, P, z2], [x1, P, z1]];
    const d = pts.reduce((s, p) => s + p[0] + p[1] - p[2], 0) / 4;
    if (vis) faces.push({ pts: poly(pts), d, vue: true });
  });
  faces.sort((a, c) => c.d - a.d);
  const avant = { pts: poly(prof.map(([x, z]) => [x, 0, z])), d: -Infinity, vue: true };
  let corps = '';
  const trait = 'stroke="#111" stroke-width="1.6" stroke-linejoin="round"';
  for (const f of [...faces.filter((x) => x.vue), avant]) corps += `<path d="M${f.pts.map((p) => `${f2(p[0])} ${f2(p[1])}`).join('L')}Z" fill="#fff" ${trait}/>`;

  // trous : ellipses sur la face d'entrée
  const ellipse = (centre, r, plan) => {
    const pts = [];
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * 2 * Math.PI;
      const p3 = plan === 'xz' ? [centre[0] + r * Math.cos(a), centre[1], centre[2] + r * Math.sin(a)] : [centre[0] + r * Math.cos(a), centre[1] + r * Math.sin(a), centre[2]];
      pts.push(pr(p3));
    }
    return `<path d="M${pts.map((p) => `${f2(p[0])} ${f2(p[1])}`).join('L')}Z" fill="#e9eef5" ${trait}/>`;
  };
  for (const t of piece.trous || []) {
    if (t.axe === 'y') corps += ellipse([t.x, 0, t.z], t.d / 2, 'xz');
    else { const iv = intervallesZ(prof, t.x); const zt = Math.max(...iv.map((v) => v[1])); corps += ellipse([t.x, t.y, zt], t.d / 2, 'xy'); }
  }

  // ----- cotes
  let cot = '';
  const fin = 'stroke="#1d5fd1" stroke-width="0.9"';
  const texteC = (p, ang, txt) => {
    let a = ang; if (a > 90) a -= 180; if (a < -90) a += 180;
    return `<text x="${f2(p[0])}" y="${f2(p[1])}" transform="rotate(${f2(a)} ${f2(p[0])} ${f2(p[1])})" text-anchor="middle" font-size="9" font-family="Segoe UI,Arial,sans-serif" fill="#1d5fd1">${txt}</text>`;
  };
  const fl = (t, u) => { const n = [-u[1], u[0]]; const L = 5; const b1 = [t[0] - u[0] * L + n[0] * 1.6, t[1] - u[1] * L + n[1] * 1.6], b2 = [t[0] - u[0] * L - n[0] * 1.6, t[1] - u[1] * L - n[1] * 1.6]; return `<path d="M${f2(t[0])} ${f2(t[1])}L${f2(b1[0])} ${f2(b1[1])}L${f2(b2[0])} ${f2(b2[1])}Z" fill="#1d5fd1"/>`; };
  /** Chaîne de cotes entre les valeurs vals le long de l'axe a ('x'|'y'|'z'), décalée selon off (vecteur 3D). */
  const chaine = (vals, pt3, off) => {
    const vs = [...new Set(vals.map((v) => Math.round(v * 1000) / 1000))].sort((p, q) => p - q);
    for (let k = 0; k + 1 < vs.length; k++) {
      const A3 = pt3(vs[k]), B3 = pt3(vs[k + 1]);
      const A = pr(A3), B = pr(B3);
      const Ao = pr([A3[0] + off[0], A3[1] + off[1], A3[2] + off[2]]), Bo = pr([B3[0] + off[0], B3[1] + off[1], B3[2] + off[2]]);
      cot += `<path d="M${f2(A[0])} ${f2(A[1])}L${f2(Ao[0])} ${f2(Ao[1])}M${f2(B[0])} ${f2(B[1])}L${f2(Bo[0])} ${f2(Bo[1])}" ${fin} stroke-dasharray="2 2" fill="none"/>`;
      const L = Math.hypot(Bo[0] - Ao[0], Bo[1] - Ao[1]); if (L < 1) continue;
      const u = [(Bo[0] - Ao[0]) / L, (Bo[1] - Ao[1]) / L];
      cot += `<path d="M${f2(Ao[0])} ${f2(Ao[1])}L${f2(Bo[0])} ${f2(Bo[1])}" ${fin} fill="none"/>` + fl(Ao, [-u[0], -u[1]]) + fl(Bo, u);
      const ang = (Math.atan2(u[1], u[0]) * 180) / Math.PI;
      const nrm = [u[1], -u[0]];   // côté du texte : vers le haut de l'écran
      const mm = nrm[1] < 0 ? [(Ao[0] + Bo[0]) / 2 + nrm[0] * 3, (Ao[1] + Bo[1]) / 2 + nrm[1] * 3] : [(Ao[0] + Bo[0]) / 2 - nrm[0] * 3, (Ao[1] + Bo[1]) / 2 - nrm[1] * 3];
      cot += texteC(mm, ang, nb(vs[k + 1] - vs[k]));
    }
  };
  if (cotes) {
    const D = 14;
    const xs = [...prof.map((p) => p[0]), ...(piece.trous || []).map((t) => t.x)];
    chaine(xs, (x) => [x, 0, b.z0], [0, 0, -D]);                                       // abscisses sous la face avant
    const zs = [...prof.map((p) => p[1]), ...(piece.trous || []).filter((t) => t.axe === 'y').map((t) => t.z)];
    chaine(zs, (z) => [b.x1, 0, z], [D, 0, 0]);                                        // hauteurs à droite
    const ys = [0, P, ...(piece.trous || []).filter((t) => t.axe === 'z').map((t) => t.y)];
    chaine(ys, (y) => [b.x0, y, b.z0], [-D * 0.7, 0, -D * 0.7]);                       // profondeurs
    for (const t of piece.trous || []) {
      const c = t.axe === 'y' ? pr([t.x, 0, t.z]) : pr([t.x, t.y, Math.max(...intervallesZ(prof, t.x).map((v) => v[1]))]);
      const q = [c[0] + 22, c[1] - 22];
      cot += `<path d="M${f2(c[0])} ${f2(c[1])}L${f2(q[0])} ${f2(q[1])}h16" ${fin} fill="none"/><text x="${f2(q[0] + 2)}" y="${f2(q[1] - 2)}" font-size="9" font-family="Segoe UI,Arial,sans-serif" fill="#1d5fd1">Ø${nb(t.d)}</text>`;
    }
  }
  // cadre de la figure
  const tous = [...faces.flatMap((f) => f.pts), ...avant.pts];
  const us = tous.map((p) => p[0]), vs = tous.map((p) => p[1]);
  const m = cotes ? 34 : 8;
  const x0 = Math.min(...us) - m, y0 = Math.min(...vs) - m, w = Math.max(...us) - Math.min(...us) + 2 * m, h = Math.max(...vs) - Math.min(...vs) + 2 * m;
  return `<svg viewBox="${f2(x0)} ${f2(y0)} ${f2(w)} ${f2(h)}" width="${largeur}" role="img" aria-label="Perspective isométrique de la pièce ${String(piece.nom || '').replace(/"/g, '')}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;background:#fff">${corps}${cot}</svg>`;
}
