/* =====================================================================
   SIMULATEUR — MOTEUR DE CALCUL (courant continu)
   ---------------------------------------------------------------------
   Méthode : analyse nodale modifiée (comme Falstad), écrite pour l'appli.
   Une inconnue par nœud (son potentiel) + une par source de tension ;
   lois de Kirchhoff → système linéaire, résolu par élimination de Gauss.
   Les fils, l'ampèremètre et l'interrupteur fermé sont de très petites
   résistances (RFIL) : on connaît ainsi le courant dans chaque fil
   (points animés). Le voltmètre est idéal (résistance infinie).

   circuit = { comps: [{ id, t, x, y, rot, val, ... }], fils: [[x1,y1,x2,y2], …] }
   (coordonnées en carreaux de grille). Types :
     V pile, W générateur réglable (val en V ; borne a = −, borne b = +)   I source de courant (val en A, de a vers b)
     R résistance (Ω)   L lampe (un : U nominale, pn : P nominale)   S interrupteur (ferme)
     A ampèremètre   U voltmètre   G masse (une seule borne, potentiel 0)
     D diode (vs : seuil)   Z Zener (vs, vz)   H LED (couleur → seuil) ; borne a = anode, b = cathode
   Diodes : modèle à seuil du cours (bloquée = circuit ouvert ; passante =
   source de tension vs + très petite résistance). On devine l'état de
   chaque diode, on résout, on corrige les diodes mal devinées, on recommence.
   ===================================================================== */

export const RFIL = 1e-4;            // Ω : fil, ampèremètre, interrupteur fermé
const GMIN = 1e-12;                  // S : fuite vers la masse (nœuds en l'air)
export const LONG = 2;               // longueur d'un composant (carreaux)
const DIR = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const RD = 0.05, GOFF = 1e-9;        // diode passante (Ω) ; diode bloquée (S)
export const LED = { rouge: [1.8, '#e53935'], orange: [1.9, '#fb8c00'], jaune: [2.0, '#fdd835'], vert: [2.2, '#43a047'], bleu: [3.0, '#1e88e5'], blanc: [3.2, '#cfd8dc'] };
export const seuil = (c) => (c.t === 'H' ? (LED[c.coul] || LED.rouge)[0] : (c.vs ?? 0.7));

/** Bornes [a, b] d'un composant (la masse n'en a qu'une). */
export function bornes(c) {
  const a = [c.x, c.y];
  if (c.t === 'G') return [a];
  const [dx, dy] = DIR[((c.rot || 0) % 4 + 4) % 4];
  return [a, [c.x + dx * LONG, c.y + dy * LONG]];
}
export const resistanceLampe = (c) => ((c.un || 12) ** 2) / (c.pn || 6);

/** Coupe les fils aux points où arrive une borne ou le bout d'un autre fil (raccord en T). */
export function fusionnerFils(circuit) {
  const pts = new Set();
  for (const c of circuit.comps) for (const p of bornes(c)) pts.add(`${p[0]},${p[1]}`);
  for (const f of circuit.fils) { pts.add(`${f[0]},${f[1]}`); pts.add(`${f[2]},${f[3]}`); }
  const P = [...pts].map((k) => k.split(',').map(Number));
  const out = [];
  for (const f of circuit.fils) {
    const [x1, y1, x2, y2] = f;
    if (x1 === x2 && y1 === y2) continue;
    const coupes = P.filter(([x, y]) => (x1 === x2 ? x === x1 && y > Math.min(y1, y2) && y < Math.max(y1, y2) : y1 === y2 && y === y1 && x > Math.min(x1, x2) && x < Math.max(x1, x2)))
      .sort((p, q) => (Math.abs(p[0] - x1) + Math.abs(p[1] - y1)) - (Math.abs(q[0] - x1) + Math.abs(q[1] - y1)));
    let d = [x1, y1];
    for (const c of coupes) { out.push([d[0], d[1], c[0], c[1], f]); d = c; }
    out.push([d[0], d[1], x2, y2, f]);
  }
  return out;
}

/** Résout le circuit. Renvoie { ok, msg, V: Map(nœud→potentiel), comps: Map(id→{u, i, p}), fils: [{seg, i}], court } */
export function resoudre(circuit) {
  const segs = fusionnerFils(circuit);
  const idx = new Map(); const cle = (p) => `${p[0]},${p[1]}`;
  const noeud = (p) => { const k = cle(p); if (!idx.has(k)) idx.set(k, idx.size); return idx.get(k); };
  const elems = [];                           // { k:'R'|'V'|'I', a, b, val, ref }
  for (const s of segs) elems.push({ k: 'R', a: noeud([s[0], s[1]]), b: noeud([s[2], s[3]]), val: RFIL, fil: s });
  let masse = false;
  for (const c of circuit.comps) {
    const bs = bornes(c).map(noeud);
    if (c.t === 'G') { elems.push({ k: 'V', a: -1, b: bs[0], val: 0, ref: c, masse: true }); masse = true; continue; }
    const [a, b] = bs;
    if (c.t === 'R') elems.push({ k: 'R', a, b, val: Math.max(Math.abs(c.val || 0), 1e-6), ref: c });
    else if (c.t === 'L') elems.push({ k: 'R', a, b, val: resistanceLampe(c), ref: c });
    else if (c.t === 'A') elems.push({ k: 'R', a, b, val: RFIL, ref: c });
    else if (c.t === 'S') { if (c.ferme) elems.push({ k: 'R', a, b, val: RFIL, ref: c }); else elems.push({ k: 'O', a, b, ref: c }); }
    else if (c.t === 'U') elems.push({ k: 'O', a, b, ref: c });
    else if (c.t === 'V' || c.t === 'W') elems.push({ k: 'V', a, b, val: c.val || 0, ref: c });
    else if (c.t === 'I') elems.push({ k: 'I', a, b, val: c.val || 0, ref: c });
    else if ('DZH'.includes(c.t)) elems.push({ k: 'D', a, b, vs: seuil(c), vz: c.t === 'Z' ? Math.abs(c.vz ?? 5.1) : null, etat: 'off', ref: c });
  }
  // sans masse : la borne − de la 1re pile sert de référence
  if (!masse) { const v = elems.find((e) => e.k === 'V'); if (v) elems.push({ k: 'V', a: -1, b: v.a, val: 0, masse: true }); }
  const n = idx.size; const sources = elems.filter((e) => e.k === 'V'); const N = n + sources.length;
  if (!n) return { ok: true, vide: true, V: new Map(), comps: new Map(), fils: [] };
  const diodes = elems.filter((e) => e.k === 'D');
  const construire = () => {
    const M = Array.from({ length: N }, () => new Float64Array(N + 1));
    const ajG = (a, b, g) => { if (a >= 0) M[a][a] += g; if (b >= 0) M[b][b] += g; if (a >= 0 && b >= 0) { M[a][b] -= g; M[b][a] -= g; } };
    const ajI = (a, b, i) => { if (a >= 0) M[a][N] -= i; if (b >= 0) M[b][N] += i; };   // courant i injecté de a vers b (sort par b)
    for (let i = 0; i < n; i++) M[i][i] += GMIN;
    for (const e of elems) {
      if (e.k === 'R') ajG(e.a, e.b, 1 / e.val);
      else if (e.k === 'I') ajI(e.a, e.b, e.val);
      else if (e.k === 'D') {
        if (e.etat === 'off') ajG(e.a, e.b, GOFF);
        else { const g = 1 / RD; ajG(e.a, e.b, g); ajI(e.a, e.b, -g * (e.etat === 'fwd' ? e.vs : -e.vz)); }
      }
    }
    sources.forEach((e, j) => {               // V(b) − V(a) = val ; inconnue : courant de a vers b dans la source
      const r = n + j; e.r = r;
      if (e.b >= 0) { M[r][e.b] += 1; M[e.b][r] += 1; }
      if (e.a >= 0) { M[r][e.a] -= 1; M[e.a][r] -= 1; }
      M[r][N] = e.val;
    });
    return gauss(M, N);
  };
  const courantD = (e, x) => {
    const u = (e.a < 0 ? 0 : x[e.a]) - (e.b < 0 ? 0 : x[e.b]);
    if (e.etat === 'off') return u * GOFF;
    return (u - (e.etat === 'fwd' ? e.vs : -e.vz)) / RD;
  };
  let x = null;
  for (let tour = 0; tour < 60; tour++) {
    x = construire();
    if (!x) break;
    // on corrige UNE diode à la fois (la plus « fausse ») : évite les oscillations
    let pire = null, ecart = 1e-9;
    for (const e of diodes) {
      const u = (e.a < 0 ? 0 : x[e.a]) - (e.b < 0 ? 0 : x[e.b]); const i = courantD(e, x);
      let nv = null, d = 0;
      if (e.etat === 'off' && u > e.vs + 1e-9) { nv = 'fwd'; d = u - e.vs; }
      else if (e.etat === 'off' && e.vz != null && -u > e.vz + 1e-9) { nv = 'rev'; d = -u - e.vz; }
      else if (e.etat === 'fwd' && i < -1e-9) { nv = 'off'; d = -i * RD; }
      else if (e.etat === 'rev' && i > 1e-9) { nv = 'off'; d = i * RD; }
      if (nv && d > ecart) { ecart = d; pire = [e, nv]; }
    }
    if (!pire) break;
    pire[0].etat = pire[1];
  }
  const Vn = (i) => (i < 0 ? 0 : x[i]);
  const V = new Map([...idx].map(([k, i]) => [k, Vn(i)]));
  const comps = new Map(); const fils = []; let court = false;
  for (const e of elems) {
    const u = Vn(e.a) - Vn(e.b);               // U = V(a) − V(b)
    let i = 0;
    if (e.k === 'R') i = u / e.val;
    else if (e.k === 'I') i = e.val;
    else if (e.k === 'D') i = courantD(e, x);
    else if (e.k === 'V') i = -x[e.r];           // courant de a vers b à travers la source (sens conventionnel : sort par +)
    if (e.fil) { fils.push({ seg: e.fil, i }); if (Math.abs(i) > 100) court = true; continue; }
    if (!e.ref) continue;
    if (e.k === 'V' && !e.masse && Math.abs(i) > 100) court = true;
    if (e.masse) continue;
    comps.set(e.ref.id, e.k === 'D' ? { u, i, p: Math.abs(u * i), etat: e.etat } : { u, i, p: Math.abs(u * i) });
  }
  return { ok: true, V, comps, fils, court, msg: court ? 'Court-circuit : un courant énorme traverse les fils. Vérifie le montage (un fil relie directement les bornes d\'une pile ?).' : '' };
}

/** Élimination de Gauss avec pivot partiel ; null si le système est singulier. */
function gauss(M, N) {
  for (let c = 0; c < N; c++) {
    let p = c, mx = Math.abs(M[c][c]);
    for (let r = c + 1; r < N; r++) if (Math.abs(M[r][c]) > mx) { mx = Math.abs(M[r][c]); p = r; }
    if (mx < 1e-15) return null;
    if (p !== c) [M[p], M[c]] = [M[c], M[p]];
    const pc = M[c][c];
    for (let r = c + 1; r < N; r++) {
      const f = M[r][c] / pc; if (!f) continue;
      const Rr = M[r], Rc = M[c];
      for (let k = c; k <= N; k++) Rr[k] -= f * Rc[k];
    }
  }
  const x = new Float64Array(N);
  for (let r = N - 1; r >= 0; r--) { let s = M[r][N]; for (let k = r + 1; k < N; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
  return x;
}
