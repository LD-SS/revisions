/* =====================================================================
   DAO — GÉOMÉTRIE : entités, points d'accroche, intersections
   ---------------------------------------------------------------------
   Toutes les coordonnées sont en mm « réels » (repère y vers le haut).
   Entités :
     { t: 'l', x1, y1, x2, y2, s }            segment
     { t: 'c', cx, cy, r, s }                 cercle
     { t: 'a', cx, cy, r, a0, a1, s }         arc, de a0 à a1 (degrés) dans le
                                              sens anti-horloger, a0 < a1 ≤ a0 + 360
   s = type de trait : 'v' fort (arête vue), 'n' fin, 'c' interrompu (caché),
       'a' mixte (axe).
   ===================================================================== */

export const EPS = 1e-6;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const arrondi = (v, n = 3) => Math.round(v * 10 ** n) / 10 ** n;

/** Angle (degrés, 0 à 360) du point p vu depuis le centre c. */
export const angleDe = (c, p) => { const a = deg(Math.atan2(p[1] - c[1], p[0] - c[0])); return a < 0 ? a + 360 : a; };
/** Point du cercle (c, r) à l'angle a (degrés). */
export const surCercle = (cx, cy, r, a) => [cx + r * Math.cos(rad(a)), cy + r * Math.sin(rad(a))];

/** Normalise un arc : a0 dans [0, 360[, a1 dans ]a0, a0 + 360]. */
export function arcNormal(e) {
  let a0 = ((e.a0 % 360) + 360) % 360;
  let a1 = e.a1 - (e.a0 - a0);
  while (a1 <= a0 + EPS) a1 += 360;
  while (a1 > a0 + 360 + EPS) a1 -= 360;
  return { ...e, a0: arrondi(a0, 4), a1: arrondi(a1, 4) };
}
/** L'angle a (degrés) est-il sur l'arc ? */
export function angleSurArc(e, a) {
  let x = ((a - e.a0) % 360 + 360) % 360;
  return x <= e.a1 - e.a0 + 1e-7;
}

/** Points d'accroche propres à une entité : [x, y, type]. */
export function pointsAccroche(e) {
  if (e.t === 'l') return [[e.x1, e.y1, 'ext'], [e.x2, e.y2, 'ext'], [(e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2, 'mil']];
  if (e.t === 'c') return [[e.cx, e.cy, 'cen'], ...[0, 90, 180, 270].map((a) => [...surCercle(e.cx, e.cy, e.r, a), 'qua'])];
  if (e.t === 'a') {
    const pts = [[e.cx, e.cy, 'cen'], [...surCercle(e.cx, e.cy, e.r, e.a0), 'ext'], [...surCercle(e.cx, e.cy, e.r, e.a1), 'ext'], [...surCercle(e.cx, e.cy, e.r, (e.a0 + e.a1) / 2), 'mil']];
    for (const a of [0, 90, 180, 270, 360, 450, 540, 630]) if (a > e.a0 + EPS && a < e.a1 - EPS) pts.push([...surCercle(e.cx, e.cy, e.r, a), 'qua']);
    return pts;
  }
  return [];
}

/* ----- intersections ----- */
function interLL(a, b) {
  const d1x = a.x2 - a.x1, d1y = a.y2 - a.y1, d2x = b.x2 - b.x1, d2y = b.y2 - b.y1;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < EPS) return [];
  const t = ((b.x1 - a.x1) * d2y - (b.y1 - a.y1) * d2x) / den;
  const u = ((b.x1 - a.x1) * d1y - (b.y1 - a.y1) * d1x) / den;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return [];
  return [[a.x1 + t * d1x, a.y1 + t * d1y]];
}
/** Intersections de la droite (segment l) avec le cercle (cx, cy, r) ; seg = limiter au segment. */
export function interLC(l, cx, cy, r, seg = true) {
  const dx = l.x2 - l.x1, dy = l.y2 - l.y1, fx = l.x1 - cx, fy = l.y1 - cy;
  const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - r * r;
  const D = B * B - 4 * A * C;
  if (A < EPS || D < -EPS) return [];
  const s = Math.sqrt(Math.max(0, D));
  const ts = D < EPS ? [-B / (2 * A)] : [(-B - s) / (2 * A), (-B + s) / (2 * A)];
  return ts.filter((t) => !seg || (t >= -EPS && t <= 1 + EPS)).map((t) => [l.x1 + t * dx, l.y1 + t * dy]);
}
function interCC(a, b) {
  const d = Math.hypot(b.cx - a.cx, b.cy - a.cy);
  if (d < EPS || d > a.r + b.r + EPS || d < Math.abs(a.r - b.r) - EPS) return [];
  const x = (d * d + a.r * a.r - b.r * b.r) / (2 * d);
  const h = Math.sqrt(Math.max(0, a.r * a.r - x * x));
  const ux = (b.cx - a.cx) / d, uy = (b.cy - a.cy) / d;
  const px = a.cx + x * ux, py = a.cy + x * uy;
  return h < EPS ? [[px, py]] : [[px - h * uy, py + h * ux], [px + h * uy, py - h * ux]];
}
const garderSurArc = (e, pts) => (e.t === 'a' ? pts.filter((p) => angleSurArc(e, angleDe([e.cx, e.cy], p))) : pts);

/** Intersections entre deux entités. */
export function intersections(a, b) {
  if (a.t === 'l' && b.t === 'l') return interLL(a, b);
  if (a.t === 'l') return garderSurArc(b, interLC(a, b.cx, b.cy, b.r));
  if (b.t === 'l') return garderSurArc(a, interLC(b, a.cx, a.cy, a.r));
  return garderSurArc(b, garderSurArc(a, interCC(a, b)));
}

/** Tous les points d'accroche du dessin (entités + intersections). */
export function tousLesPoints(tout) {
  const entites = tout.filter((e) => e.t === 'l' || e.t === 'c' || e.t === 'a');   // cotes, hachures, textes : pas d'accroche
  const pts = tout.filter((e) => e.t === 'p').map((e) => [e.cx, e.cy, 'ext']);    // points de repère
  for (const e of entites) pts.push(...pointsAccroche(e));
  for (let i = 0; i < entites.length; i++) {
    for (let j = i + 1; j < entites.length; j++) for (const p of intersections(entites[i], entites[j])) pts.push([p[0], p[1], 'int']);
  }
  return pts;
}

/** Point accroché le plus proche de p (tolérance tol en mm réels), ou null. Priorité : intersection, extrémité, centre, milieu, quadrant. */
const PRIO = { int: 0, ext: 1, cen: 2, mil: 3, qua: 4 };
export function accrocher(p, pts, tol) {
  let best = null, bd = Infinity;
  for (const q of pts) {
    const d = dist(p, q);
    if (d > tol) continue;
    const score = d + PRIO[q[2]] * tol * 0.08;
    if (score < bd) { bd = score; best = q; }
  }
  return best;
}

/** Contrainte orthogonale : garde la plus grande composante depuis o. */
export function ortho(o, p) {
  return Math.abs(p[0] - o[0]) >= Math.abs(p[1] - o[1]) ? [p[0], o[1]] : [o[0], p[1]];
}

/** Lit une saisie clavier : « 50 », « 50<30 », « 20;-10 », « Ø40 ». Renvoie {lg, ang?} ou {dx, dy} ou {diam} ou null. */
export function lireSaisie(txt) {
  const t = String(txt).trim().replace(/,/g, '.').replace(/\s+/g, '');
  let m;
  if ((m = /^(?:ø|Ø|d)(\d*\.?\d+)$/i.exec(t))) return { diam: +m[1] };
  if ((m = /^(-?\d*\.?\d+)<(-?\d*\.?\d+)$/.exec(t))) return { lg: +m[1], ang: +m[2] };
  if ((m = /^(-?\d*\.?\d+);(-?\d*\.?\d+)$/.exec(t))) return { dx: +m[1], dy: +m[2] };
  if ((m = /^(-?\d*\.?\d+)$/.exec(t))) return { lg: +m[1] };
  return null;
}

/** Longueur affichable d'une entité (pour la barre d'état). */
export function mesure(e) {
  if (e.t === 'l') return `L ${arrondi(Math.hypot(e.x2 - e.x1, e.y2 - e.y1), 2)} mm`;
  if (e.t === 'c') return `Ø ${arrondi(2 * e.r, 2)} mm`;
  return `R ${arrondi(e.r, 2)} mm · ${arrondi(e.a1 - e.a0, 1)}°`;
}
