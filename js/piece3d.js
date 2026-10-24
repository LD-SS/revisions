/* =====================================================================
   PIECE 3D — pièce en cubes de 10 mm (+ trous) qu'on fait tourner au doigt
   ---------------------------------------------------------------------
   Projection orthogonale, faces triées de l'arrière vers l'avant, ombrage doux.
   Boutons (selon le niveau d'aide) pour se placer exactement dans le sens d'une vue :
   face (on regarde vers l'arrière), gauche (on regarde depuis la gauche), dessus.
   surligner(segments3d) : met en rouge des arêtes (correction expliquée).
   ===================================================================== */

const K = 22;
const VUES = {
  face: { yaw: 0, pitch: 0, nom: 'Face' },
  gauche: { yaw: 90, pitch: 0, nom: 'Gauche' },
  dessus: { yaw: 0, pitch: 90, nom: 'Dessus' },
  iso: { yaw: 45, pitch: 35.26, nom: '3D' },
};
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

function preparer(piece) {
  const occ = new Set(piece.vox.map((v) => v.join(',')));
  const plein = (i, j, k) => occ.has(`${i},${j},${k}`);
  const faces = [];
  for (const [i, j, k] of piece.vox) {
    for (const n of DIRS) {
      if (plein(i + n[0], j + n[1], k + n[2])) continue;
      // axes tangents à la face
      const a = n[0] ? [0, 1, 0] : [1, 0, 0];
      const b = n[2] ? [0, 1, 0] : [0, 0, 1];
      const t2 = n[2] ? [1, 0, 0] : a; const t3 = n[2] ? [0, 1, 0] : b;
      // origine du carré : coin min du cube, décalé de 1 sur la normale si n positif
      const o = [i + (n[0] > 0 ? 1 : 0), j + (n[1] > 0 ? 1 : 0), k + (n[2] > 0 ? 1 : 0)];
      const add = (p, v, s = 1) => [p[0] + v[0] * s, p[1] + v[1] * s, p[2] + v[2] * s];
      const coins = [o, add(o, t2), add(add(o, t2), t3), add(o, t3)];
      // côtés à tracer : si le carré voisin dans le même plan n'existe pas
      const voisinPlan = (t) => plein(i + t[0], j + t[1], k + t[2]) && !plein(i + t[0] + n[0], j + t[1] + n[1], k + t[2] + n[2]);
      const neg = (v) => v.map((x) => -x);
      const cotes = [];
      if (!voisinPlan(neg(t3))) cotes.push([0, 1]);
      if (!voisinPlan(t2)) cotes.push([1, 2]);
      if (!voisinPlan(t3)) cotes.push([2, 3]);
      if (!voisinPlan(neg(t2))) cotes.push([3, 0]);
      faces.push({ n, coins, cotes, trous: [] });
    }
  }
  // Trous : chaque ouverture (cercle) est dessinée DANS les carrés de face qu'elle recouvre,
  // découpée à leur contour : elle est donc cachée/visible exactement comme ces faces.
  const AX = { x: 0, y: 1, z: 2 };
  for (const t of piece.trous || []) {
    const ax = AX[t.axe]; const [u, v] = [0, 1, 2].filter((i) => i !== ax);
    const L = Math.abs(t.a - t.de);
    for (const [s, sens] of [[Math.min(t.de, t.a), -1], [Math.max(t.de, t.a), 1]]) {
      const cercle = (plan) => {
        const pts = [];
        for (let q = 0; q < 36; q++) {
          const th = 2 * Math.PI * q / 36; const p = [0, 0, 0];
          p[ax] = plan; p[u] = t.c[0] + t.r * Math.cos(th); p[v] = t.c[1] + t.r * Math.sin(th);
          pts.push(p);
        }
        return pts;
      };
      const ouverture = cercle(s), fond = cercle(s - sens * L);   // fond = l'autre bout du trou (traversant)
      for (const f of faces) {
        if (f.n[ax] !== sens || f.coins[0][ax] !== s) continue;
        const mu = Math.min(...f.coins.map((c) => c[u])), Mu = Math.max(...f.coins.map((c) => c[u]));
        const mv = Math.min(...f.coins.map((c) => c[v])), Mv = Math.max(...f.coins.map((c) => c[v]));
        if (t.c[0] + t.r <= mu || t.c[0] - t.r >= Mu || t.c[1] + t.r <= mv || t.c[1] - t.r >= Mv) continue;
        f.trous.push({ ouverture, fond });
      }
    }
  }
  return { faces };
}

export function monterPiece3D(el, piece, opts = {}) {
  const [X, Y, Z] = piece.dim;
  const C = [X / 2, Y / 2, Z / 2];
  const R = Math.hypot(X, Y, Z) / 2 + 0.6;
  const { faces } = preparer(piece);
  const uid = `p3d${Math.random().toString(36).slice(2, 8)}`;
  const cam = { ...VUES.iso };
  let surbrillance = [];
  let anim = null;

  const boutons = opts.boutons !== false;
  el.innerHTML = `
    <div class="p3d ${opts.rotation === false ? 'fixe' : ''}">
      <svg viewBox="${-R * K} ${-R * K} ${2 * R * K} ${2 * R * K}" role="img" aria-label="Pièce en 3D${opts.rotation === false ? '' : ' (glisser pour tourner)'}"></svg>
      ${opts.rotation === false ? '' : `<div class="p3d-vues">
        ${Object.entries(VUES).filter(([k]) => boutons || k === 'iso').map(([k, v]) => `<button class="btn" type="button" data-v3="${k}" title="${k === 'iso' ? 'Revenir à la perspective' : `Regarder la pièce comme dans la vue de ${v.nom.toLowerCase()}`}">${v.nom}</button>`).join('')}
      </div>`}
      <p class="p3d-aide muted">${opts.rotation === false ? 'Perspective · F = sens de la vue de face' : 'Glisse sur la pièce pour la faire tourner'}</p>
    </div>`;
  const svg = el.querySelector('svg');

  function rot(p) {
    const y = cam.yaw * Math.PI / 180, q = cam.pitch * Math.PI / 180;
    const x = p[0] - C[0], yy = p[1] - C[1], z = p[2] - C[2];
    const x1 = x * Math.cos(y) - yy * Math.sin(y); const y1 = x * Math.sin(y) + yy * Math.cos(y);
    const y2 = y1 * Math.cos(q) - z * Math.sin(q); const z2 = y1 * Math.sin(q) + z * Math.cos(q);
    return [x1 * K, -z2 * K, y2];
  }
  const rotN = (n) => { const a = rot([n[0] + C[0], n[1] + C[1], n[2] + C[2]]); return [a[0] / K, -a[1] / K, a[2]]; };
  const lum = [-0.35, 0.75, -0.55]; // lumière (repère écran : x droite, y haut, profondeur)

  function dessiner() {
    const items = []; let nq = 0;
    for (const f of faces) {
      const nr = rotN(f.n);
      if (nr[2] > -1e-6) continue;
      const P = f.coins.map(rot);
      const prof = P.reduce((s, p) => s + p[2], 0) / 4;
      const l = Math.max(0, (nr[0] * lum[0] + nr[1] * lum[1] + nr[2] * lum[2]) / Math.hypot(...lum));
      const pct = Math.round(18 + 44 * (1 - l));
      const pts = P.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      let s = `<polygon points="${pts}" style="fill:color-mix(in srgb,#f2c94c ${pct}%,var(--panel));stroke:color-mix(in srgb,#f2c94c ${pct}%,var(--panel));stroke-width:.8"/>`;
      if (f.trous.length) {   // ouverture du trou, découpée au carré (légèrement agrandi pour éviter les joints)
        const cx = P.reduce((a, p) => a + p[0], 0) / 4, cy = P.reduce((a, p) => a + p[1], 0) / 4;
        const grand = P.map((p) => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return `${(p[0] + dx / l * 0.7).toFixed(1)},${(p[1] + dy / l * 0.7).toFixed(1)}`; }).join(' ');
        const id = `${uid}q${nq++}`;
        s += `<clipPath id="${id}"><polygon points="${grand}"/></clipPath><g clip-path="url(#${id})">`;
        f.trous.forEach((tr, k) => {
          const o = tr.ouverture.map(rot).map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
          const fd = tr.fond.map(rot).map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
          const ido = `${id}o${k}`;
          s += `<polygon class="p3d-paroi" points="${o}"/><clipPath id="${ido}"><polygon points="${o}"/></clipPath>
            <polygon class="p3d-jour" clip-path="url(#${ido})" points="${fd}"/><polygon class="p3d-bord" points="${o}"/>`;
        });
        s += '</g>';
      }
      for (const [a, b] of f.cotes) s += `<line class="p3d-ar" x1="${P[a][0].toFixed(1)}" y1="${P[a][1].toFixed(1)}" x2="${P[b][0].toFixed(1)}" y2="${P[b][1].toFixed(1)}"/>`;
      items.push([prof, s]);
    }
    items.sort((a, b) => b[0] - a[0]);
    let s = items.map((i) => i[1]).join('');
    // flèche F (sens de la vue de face) : de l'avant vers la pièce
    const f0 = rot([X / 2, -2.4, Z / 2]), f1 = rot([X / 2, -0.4, Z / 2]);
    if (Math.hypot(f1[0] - f0[0], f1[1] - f0[1]) > 8) {
      const a = Math.atan2(f1[1] - f0[1], f1[0] - f0[0]);
      s += `<line class="p3d-f" x1="${f0[0].toFixed(1)}" y1="${f0[1].toFixed(1)}" x2="${f1[0].toFixed(1)}" y2="${f1[1].toFixed(1)}"/>
        <polygon class="p3d-ft" points="${f1[0].toFixed(1)},${f1[1].toFixed(1)} ${(f1[0] - 10 * Math.cos(a - 0.45)).toFixed(1)},${(f1[1] - 10 * Math.sin(a - 0.45)).toFixed(1)} ${(f1[0] - 10 * Math.cos(a + 0.45)).toFixed(1)},${(f1[1] - 10 * Math.sin(a + 0.45)).toFixed(1)}"/>
        <text class="p3d-ft" x="${(f0[0] - 6 * Math.cos(a)).toFixed(1)}" y="${(f0[1] - 6 * Math.sin(a) + 4).toFixed(1)}" text-anchor="middle" font-weight="700">F</text>`;
    }
    for (const g of surbrillance) {
      const a = rot(g.slice(0, 3)), b = rot(g.slice(3));
      s += `<line class="p3d-hl" x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}"/>`;
    }
    svg.innerHTML = s;
    el.querySelectorAll('[data-v3]').forEach((b) => {
      const v = VUES[b.dataset.v3];
      b.classList.toggle('actif', Math.abs(((cam.yaw - v.yaw + 540) % 360) - 180) < 1 && Math.abs(cam.pitch - v.pitch) < 1);
    });
  }

  function aller(nom) {
    const v = VUES[nom]; if (!v) return;
    cancelAnimationFrame(anim);
    const y0 = cam.yaw, p0 = cam.pitch;
    let dy = ((v.yaw - y0 + 540) % 360) - 180;
    const t0 = performance.now(); const D = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450;
    const pas = (t) => {
      const k = D ? Math.min(1, (t - t0) / D) : 1; const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      cam.yaw = y0 + dy * e; cam.pitch = p0 + (v.pitch - p0) * e; dessiner();
      if (k < 1) anim = requestAnimationFrame(pas);
    };
    anim = requestAnimationFrame(pas);
  }

  if (opts.rotation !== false) {
    let dep = null;
    svg.addEventListener('pointerdown', (e) => { dep = { x: e.clientX, y: e.clientY, yaw: cam.yaw, pitch: cam.pitch }; try { svg.setPointerCapture(e.pointerId); } catch { /* rien */ } cancelAnimationFrame(anim); });
    svg.addEventListener('pointermove', (e) => {
      if (!dep) return;
      cam.yaw = dep.yaw + (e.clientX - dep.x) * 0.5;
      cam.pitch = Math.max(-89, Math.min(90, dep.pitch + (e.clientY - dep.y) * 0.5));
      dessiner();
    });
    const fin = () => { dep = null; };
    svg.addEventListener('pointerup', fin); svg.addEventListener('pointercancel', fin);
    el.querySelectorAll('[data-v3]').forEach((b) => b.addEventListener('click', () => aller(b.dataset.v3)));
  }
  dessiner();
  return {
    surligner(segs) { surbrillance = segs || []; dessiner(); },
    vue: aller,
  };
}
