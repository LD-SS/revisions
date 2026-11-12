/* =====================================================================
   EXERCICES DE CONSTRUCTIONS GÉOMÉTRIQUES (cahier de dessin)
   ---------------------------------------------------------------------
   Données (traits donnés) et solution calculée exactement, en mm réels
   dans la zone de dessin (0…190 × 0…158, valable sur la planche A4
   paysage comme sur la page imprimée). Figures inventées pour l'appli.
   ===================================================================== */

const r3 = (v) => Math.round(v * 1000) / 1000;
const L = (x1, y1, x2, y2, s = 'v') => ({ t: 'l', x1: r3(x1), y1: r3(y1), x2: r3(x2), y2: r3(y2), s });
const C = (cx, cy, r, s = 'v') => ({ t: 'c', cx: r3(cx), cy: r3(cy), r: r3(r), s });
const T = (x, y, txt, h = 4) => ({ t: 'x', x: r3(x), y: r3(y), txt, h, s: 'n' });
const deg = (a) => (a * 180) / Math.PI;
const ang = (c, p) => { let a = deg(Math.atan2(p[1] - c[1], p[0] - c[0])); if (a < 0) a += 360; return a; };
/** Arc de centre c, rayon r, de p (début) à q (fin) en tournant dans le sens anti-horloger. */
const arc = (c, r, p, q, s = 'v') => { const a0 = ang(c, p); let a1 = ang(c, q); if (a1 <= a0) a1 += 360; return { t: 'a', cx: r3(c[0]), cy: r3(c[1]), r: r3(r), a0: r3(a0), a1: r3(a1), s }; };

/* 29 — médiatrices d'un triangle */
function mediatrices() {
  const A = [40, 30], B = [150, 42], Cc = [88, 128];
  const cote = [[A, B], [B, Cc], [Cc, A]];
  // centre du cercle circonscrit
  const d = 2 * (A[0] * (B[1] - Cc[1]) + B[0] * (Cc[1] - A[1]) + Cc[0] * (A[1] - B[1]));
  const n2 = (p) => p[0] ** 2 + p[1] ** 2;
  const M = [(n2(A) * (B[1] - Cc[1]) + n2(B) * (Cc[1] - A[1]) + n2(Cc) * (A[1] - B[1])) / d, (n2(A) * (Cc[0] - B[0]) + n2(B) * (A[0] - Cc[0]) + n2(Cc) * (B[0] - A[0])) / d];
  const solution = cote.map(([p, q]) => {
    const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; let u = [M[0] - m[0], M[1] - m[1]]; const l = Math.hypot(...u) || 1; u = u.map((v) => v / l);
    return L(m[0], m[1], M[0] + u[0] * 10, M[1] + u[1] * 10, 'n');
  });
  return { donnees: [L(...A, ...B), L(...B, ...Cc), L(...Cc, ...A), T(A[0] - 7, A[1] - 6, 'A'), T(B[0] + 3, B[1] - 6, 'B'), T(Cc[0] - 2, Cc[1] + 4, 'C')], solution };
}
/* 30 — parallèles à la distance R */
function paralleles() {
  const R = 20, d1 = [[25, 30], [165, 70]], d2 = [[30, 150], [170, 105]];
  const par = ([p, q], sgn) => { let n = [-(q[1] - p[1]), q[0] - p[0]]; const l = Math.hypot(...n); n = n.map((v) => (v / l) * R * sgn); return L(p[0] + n[0], p[1] + n[1], q[0] + n[0], q[1] + n[1], 'n'); };
  return {
    donnees: [L(...d1[0], ...d1[1]), L(...d2[0], ...d2[1]), T(d1[1][0] + 2, d1[1][1], '(D1)'), T(d2[1][0] + 2, d2[1][1], '(D2)'), T(95, 95, 'R = 20')],
    solution: [par(d1, 1), par(d2, -1)],   // du côté intérieur (entre D1 et D2)
  };
}
/* 31 — raccordement de deux droites (coin à 90° + angle aigu) */
function raccordDroites() {
  const R = 15;
  // L : horizontale (20,30)-(150,30) et oblique (20,30)… on raccorde le coin (150,30)-(150,130) ? : coin droit en (150,30)
  const P0 = [20, 30], K = [150, 30], P1 = [110, 135];
  // centre : à R des deux droites, du côté intérieur de l'angle
  const u1 = [P0[0] - K[0], P0[1] - K[1]].map((v, _, a) => v / Math.hypot(...a)), u2 = [P1[0] - K[0], P1[1] - K[1]].map((v, _, a) => v / Math.hypot(...a));
  const bis = [u1[0] + u2[0], u1[1] + u2[1]]; const lb = Math.hypot(...bis); const b = bis.map((v) => v / lb);
  const demi = Math.acos(u1[0] * u2[0] + u1[1] * u2[1]) / 2;
  const dc = R / Math.sin(demi), O = [K[0] + b[0] * dc, K[1] + b[1] * dc];
  const t = R / Math.tan(demi), T1 = [K[0] + u1[0] * t, K[1] + u1[1] * t], T2 = [K[0] + u2[0] * t, K[1] + u2[1] * t];
  // arc du côté du coin : de T1 à T2 en passant près de K
  const a = arc(O, R, T1, T2), a2 = arc(O, R, T2, T1);
  const mid = (e) => { const m = ((e.a0 + e.a1) / 2) * (Math.PI / 180); return [O[0] + R * Math.cos(m), O[1] + R * Math.sin(m)]; };
  const bon = Math.hypot(...mid(a).map((v, i) => v - K[i])) < Math.hypot(...mid(a2).map((v, i) => v - K[i])) ? a : a2;
  return { donnees: [L(...P0, ...K), L(...K, ...P1), T(60, 18, 'R = 15')], solution: [bon] };
}
/* 32 — raccordement droite / cercle */
function raccordDroiteCercle() {
  const R = 20, yD = 40, Cc = [100, 95], rc = 25;
  const O = [Cc[0] - Math.sqrt((rc + R) ** 2 - (Cc[1] - (yD + R)) ** 2), yD + R];
  const T1 = [O[0], yD], k = rc / (rc + R), T2 = [Cc[0] + (O[0] - Cc[0]) * k, Cc[1] + (O[1] - Cc[1]) * k];
  return { donnees: [L(20, yD, 170, yD), C(...Cc, rc), L(Cc[0] - rc - 3, Cc[1], Cc[0] + rc + 3, Cc[1], 'a'), L(Cc[0], Cc[1] - rc - 3, Cc[0], Cc[1] + rc + 3, 'a'), T(120, 25, 'R = 20 (à gauche du cercle)')], solution: [arc(O, R, T1, T2)] };
}
/* 33 — raccordement de deux cercles (extérieur, au-dessus) */
function raccordCercles() {
  const R = 30, A = [55, 70], ra = 20, B = [140, 75], rb = 25;
  const da = ra + R, db = rb + R, dd = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const a = (da * da - db * db + dd * dd) / (2 * dd), h = Math.sqrt(da * da - a * a);
  const u = [(B[0] - A[0]) / dd, (B[1] - A[1]) / dd], n = [-u[1], u[0]];
  const O = [A[0] + u[0] * a + n[0] * h, A[1] + u[1] * a + n[1] * h];   // centre au-dessus
  const Ta = [A[0] + (O[0] - A[0]) * (ra / da), A[1] + (O[1] - A[1]) * (ra / da)], Tb = [B[0] + (O[0] - B[0]) * (rb / db), B[1] + (O[1] - B[1]) * (rb / db)];
  const ax = (c, r) => [L(c[0] - r - 3, c[1], c[0] + r + 3, c[1], 'a'), L(c[0], c[1] - r - 3, c[0], c[1] + r + 3, 'a')];
  return { donnees: [C(...A, ra), C(...B, rb), ...ax(A, ra), ...ax(B, rb), T(80, 135, 'R = 30 (au-dessus)')], solution: [arc(O, R, Ta, Tb)] };
}
/* 34 — tangentes extérieures à deux cercles */
function tangentes() {
  const A = [55, 75], ra = 28, B = [145, 85], rb = 16;
  const dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy), base = Math.atan2(dy, dx), phi = Math.acos((ra - rb) / d);
  const sol = [1, -1].map((s) => { const t = base + s * phi; const n = [Math.cos(t), Math.sin(t)]; return L(A[0] + n[0] * ra, A[1] + n[1] * ra, B[0] + n[0] * rb, B[1] + n[1] * rb); });
  const ax = (c, r) => [L(c[0] - r - 3, c[1], c[0] + r + 3, c[1], 'a'), L(c[0], c[1] - r - 3, c[0], c[1] + r + 3, 'a')];
  return { donnees: [C(...A, ra), C(...B, rb), ...ax(A, ra), ...ax(B, rb)], solution: sol };
}

export const CONSTRUCTIONS = { mediatrices, paralleles, raccordDroites, raccordDroiteCercle, raccordCercles, tangentes };
