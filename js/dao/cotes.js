/* =====================================================================
   DAO — COTATION (ISO 129, simplifiée)
   ---------------------------------------------------------------------
   Entité cote, en mm réels :
     { t: 'q', k: 'h' | 'v' | 'al', x1, y1, x2, y2, d, s: 'n' }
         h  : horizontale, d = ordonnée de la ligne de cote
         v  : verticale,   d = abscisse de la ligne de cote
         al : alignée,     d = décalage (signé) perpendiculaire à P1P2
     { t: 'q', k: 'd' | 'r', cx, cy, r, a, s: 'n' }   diamètre / rayon,
         a = angle (degrés) de la ligne de cote
     { t: 'q', k: 'ang', cx, cy, a0, a1, r, s: 'n' }  angle (de a0 à a1,
         sens anti-horloger), r = rayon de l'arc de cote
   Valeur affichée calculée (mm, 0,1 près) ; txt (facultatif) la remplace.
   Rendu sur le papier : traits fins, flèches de 3 mm, chiffres de 3,5 mm.
   ===================================================================== */

import { versPapier, facteur } from './feuille.js';
import { surCercle, arrondi } from './geom.js';

const FL = 3;          // longueur des flèches (mm papier)
const DEB = 2;         // dépassement des lignes d'attache
const JEU = 1;         // jeu entre la pièce et la ligne d'attache
const H = 3.5;         // hauteur des chiffres
const f2 = (v) => Math.round(v * 100) / 100;
const nombre = (v) => String(arrondi(v, 1)).replace('.', ',');

/** Valeur (texte) d'une cote. */
export function valeur(e) {
  if (e.txt) return e.txt;
  if (e.k === 'h') return nombre(Math.abs(e.x2 - e.x1));
  if (e.k === 'v') return nombre(Math.abs(e.y2 - e.y1));
  if (e.k === 'al') return nombre(Math.hypot(e.x2 - e.x1, e.y2 - e.y1));
  if (e.k === 'd') return `Ø${nombre(2 * e.r)}`;
  if (e.k === 'r') return `R${nombre(e.r)}`;
  return `${nombre(e.a1 - e.a0)}°`;
}

/** Flèche (pointe en t, dirigée selon u unitaire, vers la pointe). */
function fleche(t, u) {
  const b = [t[0] - u[0] * FL, t[1] - u[1] * FL], n = [-u[1] * FL * 0.18, u[0] * FL * 0.18];
  return `<path class="dao-fl" d="M${f2(t[0])} ${f2(t[1])}L${f2(b[0] + n[0])} ${f2(b[1] + n[1])}L${f2(b[0] - n[0])} ${f2(b[1] - n[1])}z"/>`;
}
const seg = (a, b) => `M${f2(a[0])} ${f2(a[1])}L${f2(b[0])} ${f2(b[1])}`;
/** Texte centré en m, orienté selon l'angle ang (degrés papier), toujours lisible (du bas ou de la droite). */
function texte(m, ang, txt) {
  let a = ((ang % 360) + 360) % 360;
  if (a >= 90 && a < 270) a -= 180;      // texte jamais à l'envers : lisible du bas ou de la droite
  else if (a >= 270) a -= 360;
  return `<text class="dao-cote-t" x="${f2(m[0])}" y="${f2(m[1])}" transform="rotate(${f2(a)} ${f2(m[0])} ${f2(m[1])})" text-anchor="middle">${txt.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
}

/** Points caractéristiques en mm réels (pour la sélection et les boîtes). */
export function pointsCote(e) {
  if (e.k === 'h') return [[e.x1, e.y1], [e.x2, e.y2], [e.x1, e.d], [e.x2, e.d]];
  if (e.k === 'v') return [[e.x1, e.y1], [e.x2, e.y2], [e.d, e.y1], [e.d, e.y2]];
  if (e.k === 'al') {
    const L = Math.hypot(e.x2 - e.x1, e.y2 - e.y1) || 1, nx = -(e.y2 - e.y1) / L, ny = (e.x2 - e.x1) / L;
    return [[e.x1, e.y1], [e.x2, e.y2], [e.x1 + nx * e.d, e.y1 + ny * e.d], [e.x2 + nx * e.d, e.y2 + ny * e.d]];
  }
  if (e.k === 'd') return [surCercle(e.cx, e.cy, e.r, e.a), surCercle(e.cx, e.cy, e.r, e.a + 180)];
  if (e.k === 'r') return [[e.cx, e.cy], surCercle(e.cx, e.cy, e.r, e.a)];
  return [[e.cx, e.cy], surCercle(e.cx, e.cy, e.r, e.a0), surCercle(e.cx, e.cy, e.r, (e.a0 + e.a1) / 2), surCercle(e.cx, e.cy, e.r, e.a1)];
}

/** SVG (mm papier) d'une cote. */
export function svgCote(p, e, cls = '') {
  const P = (x, y) => versPapier(p, x, y);
  const k = facteur(p.echelle);
  let d = '', svg = '';
  const txt = valeur(e);
  if (e.k === 'h' || e.k === 'v' || e.k === 'al') {
    const A = P(e.x1, e.y1), B = P(e.x2, e.y2);
    let A2, B2;
    if (e.k === 'h') { const y = P(0, e.d)[1]; A2 = [A[0], y]; B2 = [B[0], y]; }
    else if (e.k === 'v') { const x = P(e.d, 0)[0]; A2 = [x, A[1]]; B2 = [x, B[1]]; }
    else {
      const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
      const n = [(B[1] - A[1]) / L, -(B[0] - A[0]) / L];       // normale papier (= normale réelle, y inversé)
      A2 = [A[0] + n[0] * e.d * k, A[1] + n[1] * e.d * k]; B2 = [B[0] + n[0] * e.d * k, B[1] + n[1] * e.d * k];
    }
    // lignes d'attache
    for (const [o, q] of [[A, A2], [B, B2]]) {
      const L = Math.hypot(q[0] - o[0], q[1] - o[1]);
      if (L < 0.01) continue;
      const u = [(q[0] - o[0]) / L, (q[1] - o[1]) / L];
      d += seg([o[0] + u[0] * Math.min(JEU, L / 2), o[1] + u[1] * Math.min(JEU, L / 2)], [q[0] + u[0] * DEB, q[1] + u[1] * DEB]);
    }
    const L = Math.hypot(B2[0] - A2[0], B2[1] - A2[1]);
    if (L > 0.01) {
      const u = [(B2[0] - A2[0]) / L, (B2[1] - A2[1]) / L];
      const dehors = L < 2.4 * FL;           // cote trop courte : flèches à l'extérieur
      d += dehors ? seg([A2[0] - u[0] * 2 * FL, A2[1] - u[1] * 2 * FL], [B2[0] + u[0] * 2 * FL, B2[1] + u[1] * 2 * FL]) : seg(A2, B2);
      svg += dehors ? fleche(A2, u) + fleche(B2, [-u[0], -u[1]]) : fleche(A2, [-u[0], -u[1]]) + fleche(B2, u);
      let ang = (Math.atan2(u[1], u[0]) * 180) / Math.PI;
      // texte au-dessus de la ligne (ou à gauche si verticale)
      let nrm = [u[1], -u[0]];
      if (nrm[1] > 0.01 || (Math.abs(nrm[1]) <= 0.01 && nrm[0] > 0)) nrm = [-nrm[0], -nrm[1]];
      const m = [(A2[0] + B2[0]) / 2 + nrm[0] * 1, (A2[1] + B2[1]) / 2 + nrm[1] * 1];
      svg += texte(m, ang, txt);
    }
  } else if (e.k === 'd' || e.k === 'r') {
    const C = P(e.cx, e.cy), R = e.r * k;
    const u = [Math.cos((e.a * Math.PI) / 180), -Math.sin((e.a * Math.PI) / 180)];
    const T = [C[0] + u[0] * R, C[1] + u[1] * R];
    const A = e.k === 'd' ? [C[0] - u[0] * R, C[1] - u[1] * R] : C;
    d += seg(A, T);
    svg += fleche(T, u) + (e.k === 'd' ? fleche(A, [-u[0], -u[1]]) : '');
    const ang = (Math.atan2(u[1], u[0]) * 180) / Math.PI;
    let nrm = [u[1], -u[0]];
    if (nrm[1] > 0.01 || (Math.abs(nrm[1]) <= 0.01 && nrm[0] > 0)) nrm = [-nrm[0], -nrm[1]];
    const pos = e.k === 'd' ? 0.45 : 0.5;
    const m = [C[0] + u[0] * R * pos + nrm[0] * 1, C[1] + u[1] * R * pos + nrm[1] * 1];
    svg += texte(m, ang, txt);
  } else {
    const C = P(e.cx, e.cy), R = e.r * k;
    const pt = (a) => [C[0] + R * Math.cos((a * Math.PI) / 180), C[1] - R * Math.sin((a * Math.PI) / 180)];
    const A = pt(e.a0), B = pt(e.a1);
    d += `M${f2(A[0])} ${f2(A[1])}A${f2(R)} ${f2(R)} 0 ${e.a1 - e.a0 > 180 ? 1 : 0} 0 ${f2(B[0])} ${f2(B[1])}`;
    // lignes d'attache depuis le sommet (prolongement des côtés)
    for (const a of [e.a0, e.a1]) { const q = pt(a); const u = [(q[0] - C[0]) / (R || 1), (q[1] - C[1]) / (R || 1)]; d += seg([C[0] + u[0] * Math.min(R, 2), C[1] + u[1] * Math.min(R, 2)], [q[0] + u[0] * DEB, q[1] + u[1] * DEB]); }
    const tg = (a, s) => [-Math.sin((a * Math.PI) / 180) * s, -Math.cos((a * Math.PI) / 180) * s];   // tangente papier (sens anti-horloger réel)
    svg += fleche(A, tg(e.a0, -1)) + fleche(B, tg(e.a1, 1));
    const am = (e.a0 + e.a1) / 2;
    const m = [C[0] + (R + 2.5) * Math.cos((am * Math.PI) / 180), C[1] - (R + 2.5) * Math.sin((am * Math.PI) / 180)];
    svg += texte(m, -(am - 90), txt);
  }
  return `<g class="dao-cote${cls ? ` ${cls}` : ''}"><path class="dao-cote-l" d="${d}"/>${svg}</g>`;
}

/** Translation / symétrie (mm réels). */
export function translaterCote(e, dx, dy) {
  const r = (v) => arrondi(v, 4);
  if (e.k === 'h') return { ...e, x1: r(e.x1 + dx), y1: r(e.y1 + dy), x2: r(e.x2 + dx), y2: r(e.y2 + dy), d: r(e.d + dy) };
  if (e.k === 'v') return { ...e, x1: r(e.x1 + dx), y1: r(e.y1 + dy), x2: r(e.x2 + dx), y2: r(e.y2 + dy), d: r(e.d + dx) };
  if (e.k === 'al') return { ...e, x1: r(e.x1 + dx), y1: r(e.y1 + dy), x2: r(e.x2 + dx), y2: r(e.y2 + dy) };
  return { ...e, cx: r(e.cx + dx), cy: r(e.cy + dy) };
}
export function symetrieCote(e, refl, phi) {
  if (e.k === 'h' || e.k === 'v' || e.k === 'al') {
    const [p1, p2] = [refl([e.x1, e.y1]), refl([e.x2, e.y2])];
    const pts = pointsCote(e); const q1 = refl(pts[2]);
    const base = { ...e, x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] };
    // l'orientation peut changer (miroir à 45°…) : on repasse en cote alignée si besoin
    if (e.k === 'h' && Math.abs(p1[1] - p2[1]) < 1e-6 && Math.abs(p1[0] - p2[0]) > 1e-6) return { ...base, d: q1[1] };
    if (e.k === 'v' && Math.abs(p1[0] - p2[0]) < 1e-6 && Math.abs(p1[1] - p2[1]) > 1e-6) return { ...base, d: q1[0] };
    if (e.k === 'h' && Math.abs(p1[0] - p2[0]) < 1e-6) return { ...base, k: 'v', d: q1[0] };
    if (e.k === 'v' && Math.abs(p1[1] - p2[1]) < 1e-6) return { ...base, k: 'h', d: q1[1] };
    const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1, nx = -(p2[1] - p1[1]) / L, ny = (p2[0] - p1[0]) / L;
    return { ...base, k: e.k === 'al' ? 'al' : e.k, d: (q1[0] - p1[0]) * nx + (q1[1] - p1[1]) * ny };
  }
  const [cx, cy] = refl([e.cx, e.cy]);
  if (e.k === 'd' || e.k === 'r') return { ...e, cx, cy, a: arrondi(2 * phi - e.a, 4) };
  let a0 = 2 * phi - e.a1, a1 = 2 * phi - e.a0;
  a0 = ((a0 % 360) + 360) % 360; a1 = a0 + (e.a1 - e.a0);
  return { ...e, cx, cy, a0: arrondi(a0, 4), a1: arrondi(a1, 4) };
}
