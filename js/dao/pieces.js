/* =====================================================================
   DAO — PIÈCES PARAMÉTRIQUES (en mm) ET LEURS VUES (projection européenne)
   ---------------------------------------------------------------------
   Repère pièce : x vers la droite, y vers l'arrière (y = 0 : face avant),
   z vers le haut.
   Pièce = profil extrudé :
     { nom, profil: [[x, z], …] (contour de la face avant, sens quelconque),
       prof: profondeur selon y,
       trous: [{ axe: 'y', x, z, d }   trou débouchant de l'avant vers l'arrière
               | { axe: 'z', x, y, d }  trou débouchant vertical (du dessus) ] }
   vues(piece, origine, ecart) → entités DAO (mm réels, repère de la feuille) :
     vue de face en haut à gauche, vue de dessus EN DESSOUS, vue de gauche
     À DROITE (européen : le côté de chaque vue tourné vers la vue de face
     représente l'arrière de la pièce).
   Toutes les pièces ont été créées pour l'appli (aucune ne vient d'un cours).
   ===================================================================== */

const EPS = 1e-6;
const r3 = (v) => Math.round(v * 1000) / 1000;
const L = (x1, y1, x2, y2, s) => ({ t: 'l', x1: r3(x1), y1: r3(y1), x2: r3(x2), y2: r3(y2), s });
const DEB_AXE = 3;   // dépassement des axes (mm)

/** Intervalles [zmin, zmax] du profil sur la verticale x (règle pair-impair). */
export function intervallesZ(profil, x) {
  const zs = [];
  for (let i = 0; i < profil.length; i++) {
    const [x1, z1] = profil[i], [x2, z2] = profil[(i + 1) % profil.length];
    if ((x1 <= x && x < x2) || (x2 <= x && x < x1)) zs.push(z1 + ((x - x1) * (z2 - z1)) / (x2 - x1));
  }
  zs.sort((a, b) => a - b);
  const out = [];
  for (let k = 0; k + 1 < zs.length; k += 2) out.push([zs[k], zs[k + 1]]);
  return out;
}
/** Intervalles [xmin, xmax] du profil sur l'horizontale z. */
export function intervallesX(profil, z) {
  return intervallesZ(profil.map(([x, zz]) => [zz, x]), z);
}
const matiereAuDessus = (profil, x, z) => intervallesZ(profil, x).some(([a, b]) => b > z + 1e-4 && a < b);
const matiereAGauche = (profil, x, z) => intervallesX(profil, z).some(([a]) => a < x - 1e-4);

export function boite(piece) {
  const xs = piece.profil.map((p) => p[0]), zs = piece.profil.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y0: 0, y1: piece.prof };
}

/** Lignes d'une vue « de côté » d'une extrusion : positions des arêtes, visibles ou cachées. */
function aretesVues(piece, sens) {
  // sens 'dessus' : positions x des sommets, vues d'en haut ; 'gauche' : positions z, vues de la gauche
  const res = new Map();   // position → 'v' | 'c'
  for (const [x, z] of piece.profil) {
    const pos = sens === 'dessus' ? x : z;
    let visible;
    if (sens === 'dessus') visible = !matiereAuDessus(piece.profil, x - 1e-3, z) || !matiereAuDessus(piece.profil, x + 1e-3, z);
    else visible = !matiereAGauche(piece.profil, x, z - 1e-3) || !matiereAGauche(piece.profil, x, z + 1e-3);
    const k = r3(pos);
    if (visible) res.set(k, 'v'); else if (!res.has(k)) res.set(k, 'c');
  }
  return res;
}

/**
 * Entités des 3 vues.
 * @param {object} piece
 * @param {number[]} origine  coin bas-gauche de la boîte de la vue de face, dans la feuille (mm réels)
 * @param {number} ecart      écart entre les vues (mm)
 * @returns {{ face: object[], dessus: object[], gauche: object[], cadres: object }}
 */
export function vues(piece, origine = [20, 90], ecart = 20) {
  const b = boite(piece);
  const W = b.x1 - b.x0, H = b.z1 - b.z0, P = piece.prof;
  const [ox, oy] = origine;
  // vue de face : (x, z) → (ox + x - x0, oy + z - z0)
  const F = (x, z) => [ox + x - b.x0, oy + z - b.z0];
  // vue de dessus (en dessous) : (x, y) → (ox + x - x0, oy - ecart - P + y)  (arrière contre la vue de face)
  const D = (x, y) => [ox + x - b.x0, oy - ecart - P + y];
  // vue de gauche (à droite) : (y, z) → (ox + W + ecart + P - y, oy + z - z0)  (arrière contre la vue de face)
  const G = (y, z) => [ox + W + ecart + P - y, oy + z - b.z0];
  const face = [], dessus = [], gauche = [];
  const seg = (arr, f, a, c, s) => { const p = f(...a), q = f(...c); arr.push(L(p[0], p[1], q[0], q[1], s)); };

  // --- vue de face : le contour du profil (face avant, tout est vu)
  piece.profil.forEach((p, i) => seg(face, F, p, piece.profil[(i + 1) % piece.profil.length], 'v'));
  // --- vue de dessus : rectangle extérieur + une ligne par arête (sommet du profil)
  for (const [x, s] of aretesVues(piece, 'dessus')) seg(dessus, D, [x, 0], [x, P], s);
  seg(dessus, D, [b.x0, 0], [b.x1, 0], 'v'); seg(dessus, D, [b.x0, P], [b.x1, P], 'v');
  // --- vue de gauche : rectangle + une ligne par niveau z
  for (const [z, s] of aretesVues(piece, 'gauche')) seg(gauche, G, [0, z], [P, z], s);
  seg(gauche, G, [0, b.z0], [0, b.z1], 'v'); seg(gauche, G, [P, b.z0], [P, b.z1], 'v');

  // --- trous
  for (const t of piece.trous || []) {
    const r = t.d / 2;
    if (t.axe === 'y') {
      const [cx, cz] = F(t.x, t.z);
      face.push({ t: 'c', cx: r3(cx), cy: r3(cz), r: r3(r), s: 'v' });
      face.push(L(cx - r - DEB_AXE, cz, cx + r + DEB_AXE, cz, 'a'), L(cx, cz - r - DEB_AXE, cx, cz + r + DEB_AXE, 'a'));
      for (const dx of [-r, r]) seg(dessus, D, [t.x + dx, 0], [t.x + dx, P], 'c');
      seg(dessus, D, [t.x, -DEB_AXE], [t.x, P + DEB_AXE], 'a');
      for (const dz of [-r, r]) seg(gauche, G, [0, t.z + dz], [P, t.z + dz], 'c');
      seg(gauche, G, [-DEB_AXE, t.z], [P + DEB_AXE, t.z], 'a');
    } else {
      const [cx, cy] = D(t.x, t.y);
      dessus.push({ t: 'c', cx: r3(cx), cy: r3(cy), r: r3(r), s: 'v' });
      dessus.push(L(cx - r - DEB_AXE, cy, cx + r + DEB_AXE, cy, 'a'), L(cx, cy - r - DEB_AXE, cx, cy + r + DEB_AXE, 'a'));
      const iv = intervallesZ(piece.profil, t.x);
      const zmin = Math.min(...iv.map((v) => v[0])), zmax = Math.max(...iv.map((v) => v[1]));
      for (const [a, c] of iv) {
        for (const dx of [-r, r]) seg(face, F, [t.x + dx, a], [t.x + dx, c], 'c');
        for (const dy of [-r, r]) seg(gauche, G, [t.y + dy, a], [t.y + dy, c], 'c');
      }
      seg(face, F, [t.x, zmin - DEB_AXE], [t.x, zmax + DEB_AXE], 'a');
      seg(gauche, G, [t.y, zmin - DEB_AXE], [t.y, zmax + DEB_AXE], 'a');
    }
  }
  const cadres = {
    face: { x: ox, y: oy, w: W, h: H },
    dessus: { x: ox, y: oy - ecart - P, w: W, h: P },
    gauche: { x: ox + W + ecart, y: oy, w: P, h: H },
  };
  return { face: nettoyer(face), dessus: nettoyer(dessus), gauche: nettoyer(gauche), cadres };
}

/** Retire les doublons (même segment) : le trait fort l'emporte sur le caché. */
function nettoyer(es) {
  const cle = (e) => (e.t === 'l' ? [Math.min(e.x1, e.x2), Math.min(e.y1, e.y2), Math.max(e.x1, e.x2), Math.max(e.y1, e.y2)].join(',') : `c${e.cx},${e.cy},${e.r}`);
  const rang = { v: 0, c: 1, a: 2, n: 3 };
  const m = new Map();
  for (const e of es) { const k = cle(e); if (!m.has(k) || rang[e.s] < rang[m.get(k).s]) m.set(k, e); }
  return [...m.values()];
}

/* ----- catalogue : pièces créées pour l'appli (mm) ----- */
export const PIECES = [
  { id: 'equerre', nom: 'Équerre percée', prof: 30, profil: [[0, 0], [60, 0], [60, 10], [12, 10], [12, 45], [0, 45]], trous: [{ axe: 'z', x: 38, y: 15, d: 8 }] },
  { id: 'marche', nom: 'Bloc à marche', prof: 35, profil: [[0, 0], [70, 0], [70, 20], [40, 20], [40, 40], [0, 40]], trous: [{ axe: 'y', x: 18, z: 22, d: 10 }] },
  { id: 'chape', nom: 'Chape en U', prof: 30, profil: [[0, 0], [60, 0], [60, 40], [45, 40], [45, 12], [15, 12], [15, 40], [0, 40]], trous: [{ axe: 'z', x: 30, y: 15, d: 10 }] },
  { id: 'chanfrein', nom: 'Support chanfreiné', prof: 40, profil: [[0, 0], [80, 0], [80, 25], [65, 40], [0, 40]], trous: [{ axe: 'y', x: 30, z: 20, d: 12 }] },
  { id: 'rainure', nom: 'Semelle à rainure', prof: 40, profil: [[0, 0], [80, 0], [80, 25], [50, 25], [50, 15], [30, 15], [30, 25], [0, 25]], trous: [{ axe: 'z', x: 12, y: 20, d: 8 }, { axe: 'z', x: 68, y: 20, d: 8 }] },
  { id: 'te', nom: 'Bloc en T', prof: 30, profil: [[0, 0], [70, 0], [70, 15], [45, 15], [45, 45], [25, 45], [25, 15], [0, 15]], trous: [{ axe: 'y', x: 35, z: 32, d: 10 }] },
];
