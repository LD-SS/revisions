/* =====================================================================
   GÉOMÉTRIE — pièces en cubes de 10 mm (+ trous Ø) → vues européennes
   ---------------------------------------------------------------------
   Repère : x à droite, y vers l'arrière (y = 0 : face avant), z vers le haut.
   construire(piece, tache) → { planche, donnees, solution, expl }
     tache = { type: 'vue', vue: 'face'|'gauche'|'dessus' }
           | { type: 'caches' }                     ajouter les arêtes cachées
           | { type: 'coupe', plan: y }             coupe A-A (plan parallèle à la face, à y = plan)
   pieceAuHasard(graine, niveau, coupe) → { piece, tache, titre }
   Éléments : ['l', x1,y1,x2,y2,s] ['c', cx,cy,r,s] ['h', cellules, 'h'] (hachures, cellules ½ carreau)
              ['t', x, y, texte] et ['f', x1,y1,x2,y2] (texte, flèche : données seulement)
   (Même calcul que le générateur Python des planches fixes.)
   ===================================================================== */

const NOM_VUE = { face: 'vue de face', dessus: 'vue de dessus', gauche: 'vue de gauche' };
const r3 = (v) => Math.round(v * 1000) / 1000;

function dims(vox) {
  let X = 0, Y = 0, Z = 0;
  for (const [i, j, k] of vox) { X = Math.max(X, i + 1); Y = Math.max(Y, j + 1); Z = Math.max(Z, k + 1); }
  return [X, Y, Z];
}
function axes(vue, [X, Y, Z]) {
  if (vue === 'face') return { f: (i, j, k) => [i, k, j], n: [X, Z, Y] };
  if (vue === 'dessus') return { f: (i, j, k) => [i, j, Z - 1 - k], n: [X, Y, Z] };
  return { f: (i, j, k) => [Y - 1 - j, k, i], n: [Y, Z, X] };
}
function vers3d(vue, [X, Y, Z], u, w, d) {
  if (vue === 'face') return [u, d, w];
  if (vue === 'dessus') return [u, w, Z - d];
  return [d, Y - u, w];
}
function phrase(vue, d) {
  const mm = Math.round(d * 10);
  if (vue === 'face') return d === 0 ? 'sur la face avant' : `à ${mm} mm derrière la face avant`;
  if (vue === 'gauche') return d === 0 ? 'sur le flanc gauche' : `à ${mm} mm du flanc gauche`;
  return d === 0 ? 'sur le dessus de la pièce' : `${mm} mm plus bas que le dessus`;
}
/** Fusionne des segments unitaires horizontaux / verticaux. Entrée : [[a,b,c,d], …] */
function fusion(segs) {
  const h = new Map(), v = new Map(), out = [];
  for (const [a, b, c, d] of segs) {
    if (b === d) { if (!h.has(b)) h.set(b, []); h.get(b).push([Math.min(a, c), Math.max(a, c)]); }
    else { if (!v.has(a)) v.set(a, []); v.get(a).push([Math.min(b, d), Math.max(b, d)]); }
  }
  for (const [y, l] of h) {
    l.sort((p, q) => p[0] - q[0]); let [s, e] = l[0];
    for (const [a, b] of l.slice(1)) { if (a <= e) e = Math.max(e, b); else { out.push([s, y, e, y]); [s, e] = [a, b]; } }
    out.push([s, y, e, y]);
  }
  for (const [x, l] of v) {
    l.sort((p, q) => p[0] - q[0]); let [s, e] = l[0];
    for (const [a, b] of l.slice(1)) { if (a <= e) e = Math.max(e, b); else { out.push([x, s, x, e]); [s, e] = [a, b]; } }
    out.push([x, s, x, e]);
  }
  return out;
}
const cle = (...a) => a.join(',');

/** Arêtes vues / cachées d'une vue (repère u, w de la vue, w vers le haut), avec profondeur. */
function aretes(vox, D, vue) {
  const { f, n: [NU, NW, ND] } = axes(vue, D);
  const occ = new Set(); const prof = new Map();
  for (const v of vox) {
    const [u, w, d] = f(...v); occ.add(cle(u, w, d));
    const k = cle(u, w); prof.set(k, Math.min(prof.get(k) ?? 99, d));
  }
  const o = (u, w, d) => occ.has(cle(u, w, d));
  const p = (u, w) => prof.get(cle(u, w));
  const vis = new Map();
  const noteVis = (seg, a, b) => { const ds = [a, b].filter((x) => x !== undefined); vis.set(seg.join(','), { seg, d: Math.min(...ds), sil: a === undefined || b === undefined }); };
  for (let u = -1; u < NU; u++) for (let w = 0; w < NW; w++) if (p(u, w) !== p(u + 1, w)) noteVis([u + 1, w, u + 1, w + 1], p(u, w), p(u + 1, w));
  for (let w = -1; w < NW; w++) for (let u = 0; u < NU; u++) if (p(u, w) !== p(u, w + 1)) noteVis([u, w + 1, u + 1, w + 1], p(u, w), p(u, w + 1));
  const arete = (a, b, c, d) => { const n = a + b + c + d; return n === 1 || n === 3 || (n === 2 && a === c); };
  const ar = new Map();
  const ajout = (seg, d) => { const k = seg.join(','); if (!ar.has(k)) ar.set(k, { seg, ds: [] }); ar.get(k).ds.push(d); };
  for (let w = 0; w < NW; w++) for (let u = 0; u <= NU; u++) for (let d = 0; d <= ND; d++)
    if (arete(+o(u - 1, w, d - 1), +o(u, w, d - 1), +o(u, w, d), +o(u - 1, w, d))) ajout([u, w, u, w + 1], d);
  for (let u = 0; u < NU; u++) for (let w = 0; w <= NW; w++) for (let d = 0; d <= ND; d++)
    if (arete(+o(u, w - 1, d - 1), +o(u, w, d - 1), +o(u, w, d), +o(u, w - 1, d))) ajout([u, w, u + 1, w], d);
  const caches = new Map([...ar].filter(([k]) => !vis.has(k)));
  return { vis, caches, NU, NW };
}

function unitesDe([a, b, c, d], liste) {
  return liste.filter(({ seg: s }) => (s[1] === s[3] && s[1] === b && b === d && a <= Math.min(s[0], s[2]) && Math.max(s[0], s[2]) <= c)
    || (s[0] === s[2] && s[0] === a && a === c && b <= Math.min(s[1], s[3]) && Math.max(s[1], s[3]) <= d));
}

function cercle3d(t, s, n = 24) {
  const pts = [];
  for (let q = 0; q <= n; q++) {
    const th = 2 * Math.PI * q / n; const c1 = t.c[0] + t.r * Math.cos(th), c2 = t.c[1] + t.r * Math.sin(th);
    pts.push(t.axe === 'x' ? [s, c1, c2] : t.axe === 'y' ? [c1, s, c2] : [c1, c2, s]);
  }
  return pts.slice(0, -1).map((p, q) => [...p, ...pts[q + 1]].map(r3));
}
function cylindre3d(t) {
  const segs = [...cercle3d(t, t.de), ...cercle3d(t, t.a)];
  const [a, b] = t.c; const r = t.r;
  for (const [c1, c2] of [[a + r, b], [a - r, b], [a, b + r], [a, b - r]]) {
    const p = (s) => (t.axe === 'x' ? [s, c1, c2] : t.axe === 'y' ? [c1, s, c2] : [c1, c2, s]);
    segs.push([...p(t.de), ...p(t.a)]);
  }
  return segs;
}
/** Éléments d'un trou dans une vue (repère u, w). vu = true : génératrices visibles (coupe). */
function trouVue(D, t, vue, vu = false) {
  const [, Y] = D;
  const pt = (s) => (t.axe === 'x' ? [s, t.c[0], t.c[1]] : t.axe === 'y' ? [t.c[0], s, t.c[1]] : [t.c[0], t.c[1], s]);
  const proj = ([x, y, z]) => (vue === 'face' ? [x, z] : vue === 'dessus' ? [x, y] : [Y - y, z]);
  const regard = { face: 'y', dessus: 'z', gauche: 'x' }[vue];
  const el = []; const r = t.r;
  if (t.axe === regard) {
    const [u, w] = proj(pt(t.de)); const e = r + 0.4;
    el.push(['c', u, w, r, 'v'], ['l', u - e, w, u + e, w, 'a'], ['l', u, w - e, u, w + e, 'a']);
  } else {
    const [u1, w1] = proj(pt(t.de)); const [u2, w2] = proj(pt(t.a)); const e = 0.4; const s = vu ? 'v' : 'c';
    if (u1 === u2) {
      const lo = Math.min(w1, w2), hi = Math.max(w1, w2);
      el.push(['l', u1 - r, lo, u1 - r, hi, s], ['l', u1 + r, lo, u1 + r, hi, s], ['l', u1, lo - e, u1, hi + e, 'a']);
    } else {
      const lo = Math.min(u1, u2), hi = Math.max(u1, u2);
      el.push(['l', lo, w1 - r, hi, w1 - r, s], ['l', lo, w1 + r, hi, w1 + r, s], ['l', lo - e, w1, hi + e, w1, 'a']);
    }
  }
  return el;
}

/** Éléments + explications d'une vue normale. */
function vueMeta(piece, vue) {
  const D = piece.dim || dims(piece.vox);
  const { vis, caches, NU, NW } = aretes(piece.vox, D, vue);
  const out = [];
  for (const [typ, m] of [['v', vis], ['c', caches]]) {
    const liste = [...m.values()];
    for (const s of fusion(liste.map((x) => x.seg))) {
      const units = unitesDe(s, liste); const e3 = [];
      let t;
      if (typ === 'v') {
        const d0 = Math.min(...units.map((x) => x.d)); const sil = units.some((x) => x.sil);
        for (const x of units) e3.push([...vers3d(vue, D, x.seg[0], x.seg[1], x.d), ...vers3d(vue, D, x.seg[2], x.seg[3], x.d)]);
        t = sil ? `Contour extérieur de la pièce, ${phrase(vue, d0)} : arête vue, donc **trait fort**.`
          : `Arête vue, ${phrase(vue, d0)} : elle marque un changement de niveau (marche, entaille, rainure…) et rien ne la cache, donc **trait fort**.`;
      } else {
        const d0 = Math.min(...units.flatMap((x) => x.ds));
        for (const x of units) for (const d of x.ds) e3.push([...vers3d(vue, D, x.seg[0], x.seg[1], d), ...vers3d(vue, D, x.seg[2], x.seg[3], d)]);
        t = `Arête cachée, ${phrase(vue, d0)} : dans la ${NOM_VUE[vue]}, de la matière passe devant elle, donc **trait interrompu**.`;
      }
      out.push([['l', ...s, typ], { t, e3 }]);
    }
  }
  const regard = { face: 'y', dessus: 'z', gauche: 'x' }[vue];
  for (const t of piece.trous || []) {
    const Dm = Math.round(t.r * 20), L = Math.round(Math.abs(t.a - t.de) * 10); const cyl = cylindre3d(t);
    for (const e of trouVue(D, t, vue)) {
      const tx = e[0] === 'c' ? `Le trou Ø ${Dm} mm est vu dans l'axe : un **cercle en trait fort**, avec deux axes en trait mixte qui se croisent au centre.`
        : e[5] === 'c' ? `Génératrice (bord) du trou Ø ${Dm} mm, sur toute sa longueur (${L} mm) : elle est dans la matière, donc **trait interrompu**.`
          : (t.axe !== regard ? 'Axe du trou : **trait mixte**, qui dépasse de 2 à 5 mm.' : 'Axe du cercle : **trait mixte**, qui dépasse le cercle de 2 à 5 mm.');
      out.push([e, { t: tx, e3: cyl }]);
    }
  }
  return { el: out, NU, NW };
}

/** Coupe A-A : plan parallèle à la face, à y = plan, on regarde vers l'arrière. */
function coupeMeta(piece, plan) {
  const D = piece.dim || dims(piece.vox); const [X, , Z] = D;
  const reste = piece.vox.filter(([, j]) => j >= plan).map(([i, j, k]) => [i, j - plan, k]);
  const Dr = [X, D[1] - plan, Z];
  const { vis, NU, NW } = aretes(reste, Dr, 'face');
  const out = [];
  const liste = [...vis.values()];
  for (const s of fusion(liste.map((x) => x.seg))) {
    const units = unitesDe(s, liste); const d0 = Math.min(...units.map((x) => x.d));
    const e3 = units.map((x) => [x.seg[0], x.d + plan, x.seg[1], x.seg[2], x.d + plan, x.seg[3]]);
    const t = d0 === 0 ? 'Contour de la **section** (matière coupée par le plan A-A) : **trait fort**.'
      : `Arête vue **derrière** le plan de coupe, à ${Math.round(d0 * 10)} mm : on la dessine en **trait fort**.`;
    out.push([['l', ...s, 'v'], { t, e3 }]);
  }
  // section : cellules (½ carreau) de matière dans le plan, moins les trous coupés
  const cell = new Set();
  for (const [i, j, k] of piece.vox) if (j === plan) for (const a of [0, 0.5]) for (const b of [0, 0.5]) cell.add(cle(i + a, k + b));
  for (const t of piece.trous || []) {
    if (t.axe === 'z' && t.c[1] === plan) {
      const lo = Math.min(t.de, t.a), hi = Math.max(t.de, t.a);
      for (let x = t.c[0] - t.r; x < t.c[0] + t.r - 1e-9; x += 0.5) for (let z = lo; z < hi - 1e-9; z += 0.5) cell.delete(cle(x, z));
      const cyl = cylindre3d(t);
      out.push([['l', t.c[0] - t.r, lo, t.c[0] - t.r, hi, 'v'], { t: `Le trou Ø ${Math.round(t.r * 20)} mm est **coupé en deux** : ses bords deviennent visibles → **trait fort**, et on ne hachure pas le vide du trou.`, e3: cyl }]);
      out.push([['l', t.c[0] + t.r, lo, t.c[0] + t.r, hi, 'v'], { t: `Le trou Ø ${Math.round(t.r * 20)} mm est **coupé en deux** : ses bords deviennent visibles → **trait fort**, et on ne hachure pas le vide du trou.`, e3: cyl }]);
      out.push([['l', t.c[0], lo - 0.4, t.c[0], hi + 0.4, 'a'], { t: 'Axe du trou : on le garde en coupe, en **trait mixte**.', e3: cyl }]);
    } else if (t.axe === 'y' && t.de <= plan && t.a >= plan) {
      const r = t.r, [cx, cz] = t.c;
      for (const k of [...cell]) { const [x, z] = k.split(',').map(Number); if (Math.hypot(x + 0.25 - cx, z + 0.25 - cz) < r) cell.delete(k); }
      const cyl = cylindre3d(t);
      out.push([['c', cx, cz, r, 'v'], { t: 'Le trou traverse le plan de coupe : on voit son contour (cercle) en trait fort, sans hachures à l\'intérieur.', e3: cyl }]);
      out.push([['l', cx - r - 0.4, cz, cx + r + 0.4, cz, 'a'], { t: 'Axe du cercle : trait mixte.', e3: cyl }], [['l', cx, cz - r - 0.4, cx, cz + r + 0.4, 'a'], { t: 'Axe du cercle : trait mixte.', e3: cyl }]);
    }
  }
  const cells = [...cell].map((k) => k.split(',').map(Number));
  out.push([['h', cells, 'h'], { t: 'Matière **coupée** par le plan A-A : on la **hachure** (traits fins à 45°, régulièrement espacés). Les vides (trous, rainures) ne sont pas hachurés.', e3: [] }]);
  return { el: out, NU, NW };
}

/** Planche complète (3 vues placées, méthode européenne). */
export function construire(piece, tache, marge = 1.5, ecart = 2) {
  const [X, Y, Z] = piece.dim || dims(piece.vox);
  const pos = { face: [marge, marge, X, Z], gauche: [marge + X + ecart, marge, Y, Z], dessus: [marge, marge + Z + ecart, X, Y] };
  const donnees = [], solution = [], expl = [];
  for (const [vue, [ox, oy]] of Object.entries(pos)) {
    const coupe = tache.type === 'coupe' && vue === 'face';
    const { el, NW } = coupe ? coupeMeta(piece, tache.plan) : vueMeta(piece, vue);
    const vus = new Set();
    for (const [e, m] of el) {
      let c;
      if (e[0] === 'l') c = ['l', r3(ox + e[1]), r3(oy + NW - e[2]), r3(ox + e[3]), r3(oy + NW - e[4]), e[5]];
      else if (e[0] === 'c') c = ['c', r3(ox + e[1]), r3(oy + NW - e[2]), e[3], e[4]];
      else c = ['h', e[1].map(([x, z]) => [r3(ox + x), r3(oy + NW - z - 0.5)]), 'h'];
      const k = JSON.stringify(c); if (vus.has(k)) continue; vus.add(k);
      const aDessiner = tache.type === 'vue' ? vue === tache.vue : tache.type === 'caches' ? c[c.length - 1] === 'c' : coupe;
      if (aDessiner) { solution.push(c); expl.push({ t: m.t, v: vue, e3: m.e3 }); } else donnees.push(c);
    }
  }
  if (tache.type === 'coupe') {   // trace du plan A-A dans la vue de dessus, flèches vers l'arrière
    const [ox, oy] = pos.dessus; const y = oy + Y - tache.plan; const x0 = ox - 0.8, x1 = ox + X + 0.8;
    donnees.push(['l', x0, y, x1, y, 'a'], ['l', x0, y, x0 + 0.6, y, 'v'], ['l', x1 - 0.6, y, x1, y, 'v'],
      ['f', x0 + 0.25, y, x0 + 0.25, y - 1.1], ['f', x1 - 0.25, y, x1 - 0.25, y - 1.1],
      ['t', x0 - 0.15, y - 1.2, 'A'], ['t', x1 + 0.15, y - 1.2, 'A']);
  }
  const l45 = ['l', marge + X + ecart, marge + Z + ecart, marge + X + ecart + Y, marge + Z + ecart + Y, 'n'];
  const cible = tache.type === 'vue' ? pos[tache.vue] : tache.type === 'coupe' ? pos.face : null;
  return {
    planche: { w: marge + X + ecart + Y + marge, h: marge + Z + ecart + Y + marge, cadres: pos, cible, l45, noms: tache.type === 'coupe' ? { face: 'Coupe A-A' } : undefined },
    donnees, solution, expl,
  };
}

/* ================================================================ pièces au hasard */
export function hasard(graine) {
  let a = graine >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const entre = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));

/** Crée une pièce au hasard (bloc + entailles, marches, rainures, poches, trous Ø 10). */
export function pieceAuHasard(graine, niveau = 1, type = 'vue') {
  for (let essai = 0; essai < 50; essai++) {
    const rnd = hasard(graine * 97 + essai);
    const X = entre(rnd, niveau === 1 ? 4 : 5, niveau === 1 ? 6 : 7), Y = entre(rnd, 3, niveau === 1 ? 4 : 5), Z = entre(rnd, niveau === 1 ? 2 : 3, niveau === 1 ? 3 : 4);
    const vox = new Set();
    for (let i = 0; i < X; i++) for (let j = 0; j < Y; j++) for (let k = 0; k < Z; k++) vox.add(cle(i, j, k));
    const retirer = (x0, x1, y0, y1, z0, z1) => { for (let i = x0; i < x1; i++) for (let j = y0; j < y1; j++) for (let k = z0; k < z1; k++) vox.delete(cle(i, j, k)); };
    const nbOps = niveau === 1 ? 1 : niveau === 2 ? 2 : 3;
    const noms = [];
    const ops = ['entaille', 'marche', 'rainure', ...(niveau >= 2 ? ['entaille', 'marche'] : []), ...(niveau === 3 && type !== 'coupe' ? ['poche'] : [])];
    for (let n = 0; n < nbOps; n++) {
      const op = ops[Math.floor(rnd() * ops.length)];
      const h = entre(rnd, 1, Z - 1);
      if (op === 'marche') {      // marche sur toute la profondeur ou toute la largeur
        if (rnd() < 0.5) { const w = entre(rnd, 1, X - 2); const g = rnd() < 0.5; retirer(g ? 0 : X - w, g ? w : X, 0, Y, Z - h, Z); }
        else { const w = entre(rnd, 1, Y - 2); retirer(0, X, rnd() < 0.5 ? 0 : Y - w, rnd() < 0.5 ? w : Y, Z - h, Z); }
      } else if (op === 'entaille') { // entaille sur une arête du dessus, pas sur toute la longueur
        const w = entre(rnd, 1, X - 2), d = entre(rnd, 1, Y - 1); const x0 = entre(rnd, 0, X - w); const avant = rnd() < 0.6;
        retirer(x0, x0 + w, avant ? 0 : Y - d, avant ? d : Y, Z - h, Z);
      } else if (op === 'rainure') {  // rainure traversante sur le dessus
        if (rnd() < 0.5 && X >= 4) { const w = entre(rnd, 1, 2); const x0 = entre(rnd, 1, X - w - 1); retirer(x0, x0 + w, 0, Y, Z - 1, Z); }
        else if (Y >= 3) { const w = 1; const y0 = entre(rnd, 1, Y - 2); retirer(0, X, y0, y0 + w, Z - 1, Z); }
      } else if (op === 'poche' && X >= 4 && Y >= 3) {
        const x0 = entre(rnd, 1, X - 3), y0 = entre(rnd, 1, Y - 2); retirer(x0, x0 + 2, y0, y0 + 1, Z - h, Z);
      }
      noms.push(op);
    }
    const liste = [...vox].map((k) => k.split(',').map(Number));
    if (liste.length < X * Y * Z * 0.45) continue;
    const [X2, Y2, Z2] = dims(liste);
    if (X2 !== X || Y2 !== Y || Z2 !== Z) continue;
    // trous Ø 10 (r = 0,5) centrés sur un nœud de la grille, dans de la matière pleine
    const trous = [];
    const plein = (i, j, k) => vox.has(cle(i, j, k));
    const veutTrou = type === 'coupe' || (niveau >= 2 && rnd() < 0.75);
    if (veutTrou) {
      const cand = [];
      for (let cx = 1; cx < X; cx++) for (let cy = 1; cy < Y; cy++) {
        let H = 0; while (H < Z && plein(cx - 1, cy - 1, H) && plein(cx, cy - 1, H) && plein(cx - 1, cy, H) && plein(cx, cy, H)) H++;
        if (H < 1) continue;
        let dessusLibre = true;
        for (let k = H; k < Z; k++) for (const [i, j] of [[cx - 1, cy - 1], [cx, cy - 1], [cx - 1, cy], [cx, cy]]) if (plein(i, j, k)) dessusLibre = false;
        if (dessusLibre) cand.push({ axe: 'z', c: [cx, cy], r: 0.5, de: H, a: 0 });
      }
      if (type !== 'coupe') for (let cx = 1; cx < X; cx++) for (let cz = 1; cz < Z; cz++) {
        let ok = true;
        for (let j = 0; j < Y && ok; j++) for (const [i, k] of [[cx - 1, cz - 1], [cx, cz - 1], [cx - 1, cz], [cx, cz]]) if (!plein(i, j, k)) ok = false;
        if (ok) cand.push({ axe: 'y', c: [cx, cz], r: 0.5, de: 0, a: Y });
      }
      if (cand.length) trous.push(cand[Math.floor(rnd() * cand.length)]);
      else if (type === 'coupe') continue;
    }
    const piece = { vox: liste.sort(), trous, dim: [X, Y, Z] };
    let tache;
    if (type === 'coupe') {
      const t = trous[0];
      tache = { type: 'coupe', plan: t.c[1] };
    } else {
      const choix = niveau === 3 ? ['gauche', 'dessus', 'caches', 'gauche'] : ['gauche', 'dessus', 'gauche', 'face'];
      const v = choix[Math.floor(rnd() * choix.length)];
      tache = v === 'caches' ? { type: 'caches' } : { type: 'vue', vue: v };
    }
    const sol = construire(piece, tache).solution;
    if (tache.type === 'caches' && sol.length < 2) continue;
    if (sol.length < 4 && tache.type !== 'caches') continue;
    return { piece: { ...piece, vue: tache.vue || null }, tache, ops: noms };
  }
  return null;
}

export const CONSIGNES = {
  face: 'Dessine la **vue de face** (sens de la flèche F).',
  gauche: 'Dessine la **vue de gauche** (méthode européenne : à droite de la vue de face).',
  dessus: 'Dessine la **vue de dessus** (méthode européenne : sous la vue de face ; l\'avant de la pièce est en bas).',
  caches: 'Les arêtes **vues** sont dessinées. Ajoute toutes les arêtes **cachées** (traits interrompus).',
  coupe: 'Dessine la **coupe A-A** à la place de la vue de face : arêtes vues derrière le plan, **hachures** sur la matière coupée, pas d\'arêtes cachées.',
};
