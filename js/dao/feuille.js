/* =====================================================================
   DAO — FEUILLE DE DESSIN EN MILLIMÈTRES (socle du nouveau moteur)
   ---------------------------------------------------------------------
   Une planche = { format, orientation, echelle, grille, cartouche, entites }.
   Repères :
   - « papier » : mm sur la feuille, origine en haut à gauche, y vers le bas
     (c'est aussi le repère du SVG : 1 unité = 1 mm de papier).
   - « réel » : mm de la pièce, origine en bas à gauche de la zone de dessin
     (coin intérieur du cadre), y vers le haut. papier = réel × facteur d'échelle.
   Les entités (morceaux suivants) seront stockées en mm réels.
   La feuille reste blanche avec des traits noirs, même en thème sombre.
   ===================================================================== */

export const FORMATS = { A4: [210, 297], A3: [297, 420] };
export const ECHELLES = ['5:1', '2:1', '1:1', '1:2', '1:5', '1:10'];
export const MARGE = { g: 20, h: 10, d: 10, b: 10 };     // cadre (côté gauche : reliure)
export const CARTOUCHE = { l: 180, h: 32 };               // en bas à droite, dans le cadre

const NS = 'http://www.w3.org/2000/svg';
const PAS_GRILLE = [1, 2, 5, 10, 20, 50, 100, 200, 500];

/** Facteur papier / réel : '1:2' → 0,5 ; '2:1' → 2. */
export function facteur(echelle) {
  const [a, b] = String(echelle).split(':').map(Number);
  return a > 0 && b > 0 ? a / b : 1;
}

/** Planche vide par défaut. */
export function nouvellePlanche() {
  return {
    v: 1, format: 'A4', orientation: 'paysage', echelle: '1:1', grille: true,
    cartouche: { titre: '', auteur: '', classe: '', numero: '' },
    entites: [],
  };
}

/** Dimensions de la feuille [largeur, hauteur] en mm. */
export function taille(p) {
  const [a, b] = FORMATS[p.format] || FORMATS.A4;
  return p.orientation === 'portrait' ? [a, b] : [b, a];
}

/** Zone de dessin (intérieur du cadre) en mm papier. */
export function zone(p) {
  const [W, H] = taille(p);
  return { x: MARGE.g, y: MARGE.h, w: W - MARGE.g - MARGE.d, h: H - MARGE.h - MARGE.b };
}

/** Conversions papier ↔ réel. */
export function versReel(p, xp, yp) {
  const z = zone(p); const k = facteur(p.echelle);
  return [(xp - z.x) / k, (z.y + z.h - yp) / k];
}
export function versPapier(p, xr, yr) {
  const z = zone(p); const k = facteur(p.echelle);
  return [z.x + xr * k, z.y + z.h - yr * k];
}

/** Pas de grille en mm réels : le plus petit qui donne au moins 5 mm sur le papier. */
export function pasGrille(p) {
  const k = facteur(p.echelle);
  return PAS_GRILLE.find((s) => s * k >= 5) || PAS_GRILLE[PAS_GRILLE.length - 1];
}

const r = (v) => Math.round(v * 100) / 100;
const echapper = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Grille d'aide (masquable) : traits fins tous les pas, plus marqués tous les 5 pas. */
function svgGrille(p) {
  const z = zone(p); const k = facteur(p.echelle); const s = pasGrille(p) * k;
  let fins = '', forts = '';
  for (let i = 0, x = z.x; x <= z.x + z.w + 0.01; i++, x = z.x + i * s) (i % 5 ? (fins += `M${r(x)} ${z.y}V${z.y + z.h}`) : (forts += `M${r(x)} ${z.y}V${z.y + z.h}`));
  for (let i = 0, y = z.y + z.h; y >= z.y - 0.01; i++, y = z.y + z.h - i * s) (i % 5 ? (fins += `M${z.x} ${r(y)}H${z.x + z.w}`) : (forts += `M${z.x} ${r(y)}H${z.x + z.w}`));
  // sous-grille de 1 pas d'accroche (1 mm à 1:1), très légère : visible en zoomant
  let mm = ''; const sm = s / 5;
  for (let i = 1, x = z.x + sm; x < z.x + z.w; i++, x = z.x + i * sm) if (i % 5) mm += `M${r(x)} ${z.y}V${z.y + z.h}`;
  for (let i = 1, y = z.y + z.h - sm; y > z.y; i++, y = z.y + z.h - i * sm) if (i % 5) mm += `M${z.x} ${r(y)}H${z.x + z.w}`;
  return `<path class="dao-gr dao-gr-mm" d="${mm}"/><path class="dao-gr" d="${fins}"/><path class="dao-gr dao-gr-f" d="${forts}"/>`;
}

/** Cadre + cartouche (dimensions et textes d'après ISO 5457 / ISO 7200, simplifiés). */
function svgCadre(p) {
  const z = zone(p); const [W, H] = taille(p);
  const L = Math.min(CARTOUCHE.l, z.w), Hc = CARTOUCHE.h;
  const x0 = z.x + z.w - L, y0 = z.y + z.h - Hc;
  const c = p.cartouche || {};
  const date = new Date().toLocaleDateString('fr-BE');
  const col = [0, 0.42, 0.7, 1].map((f) => x0 + f * L);     // colonnes
  const lig = [y0, y0 + 8, y0 + 16, y0 + 24, y0 + Hc];          // lignes de 8 mm
  const champ = (x, y, etiquette, valeur, grand = false) => `<text class="dao-ct-e" x="${r(x + 1.5)}" y="${r(y + 2.8)}">${etiquette}</text>`
    + `<text class="dao-ct-v${grand ? ' dao-ct-g' : ''}" x="${r(x + 1.5)}" y="${r(y + (grand ? 13.5 : 6.8))}">${echapper(valeur)}</text>`;
  // repères de centrage au milieu de chaque côté
  const cx = W / 2, cy = H / 2;
  const centrage = `M${cx} 0V${MARGE.h + 5}M${cx} ${H}V${H - MARGE.b - 5}M0 ${cy}H${MARGE.g + 5}M${W} ${cy}H${W - MARGE.d - 5}`;
  return `<rect class="dao-cadre" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}"/>
    <path class="dao-centrage" d="${centrage}"/>
    <g class="dao-cartouche">
      <rect class="dao-ct-cadre" x="${r(x0)}" y="${r(y0)}" width="${r(L)}" height="${Hc}"/>
      <path class="dao-ct-trait" d="M${r(col[1])} ${r(y0)}V${r(y0 + Hc)}M${r(col[2])} ${r(y0)}V${r(y0 + Hc)}M${r(col[1])} ${r(lig[1])}H${r(col[3])}M${r(col[1])} ${r(lig[2])}H${r(col[3])}M${r(col[1])} ${r(lig[3])}H${r(col[3])}M${r(col[0])} ${r(lig[2])}H${r(col[1])}"/>
      ${champ(col[0], lig[0], 'Titre', c.titre || 'Sans titre', true)}
      ${champ(col[0], lig[2], 'Dessiné par', c.auteur)}
      ${champ(col[0], lig[3], '', c.classe ? `Classe : ${c.classe}` : '')}
      ${champ(col[1], lig[0], 'Échelle', p.echelle)}
      ${champ(col[2], lig[0], 'Format', `${p.format} ${p.orientation === 'portrait' ? 'portrait' : 'paysage'}`)}
      ${champ(col[1], lig[1], 'Date', date)}
      ${champ(col[2], lig[1], 'N°', c.numero)}
      ${champ(col[1], lig[2], 'Unités', 'mm')}
      ${champ(col[2], lig[2], 'Projection', 'européenne')}
      ${champ(col[1], lig[3], 'Cours', 'Dessin technique')}
      ${symboleProjection(col[2] + (col[3] - col[2]) / 2, lig[3] + 4)}
    </g>`;
}

/** Symbole de la méthode de projection européenne (cône tronqué). */
function symboleProjection(x, y) {
  return `<g class="dao-ct-sym" transform="translate(${r(x)} ${r(y)})">
    <path d="M-9 -2.2L-3 -3.2V3.2L-9 2.2Z"/><circle cx="3.5" cy="0" r="3.2"/><circle cx="3.5" cy="0" r="1.6"/><path class="dao-ct-axe" d="M-10.5 0H8M3.5 -4.2V4.2"/>
  </g>`;
}

/* =====================================================================
   Montage interactif : zoom (molette, 2 doigts, boutons), déplacement
   (glisser avec la main, clic du milieu, espace + glisser, 1 doigt),
   position du curseur en mm réels.
   ===================================================================== */

/**
 * @param {HTMLElement} el  conteneur (vidé)
 * @param {object} planche  planche (lue, jamais modifiée ici)
 * @param {{surCurseur?: (pos: number[]|null) => void, surZoom?: (z: number) => void}} opts
 */
export function monterFeuille(el, planche, opts = {}) {
  let p = planche;
  el.innerHTML = `<svg class="dao-svg" xmlns="${NS}" role="img" aria-label="Feuille de dessin">
    <g class="dao-papier"></g><g class="dao-grille"></g><g class="dao-cadre-g"></g>
    <g class="dao-dessin"></g><g class="dao-correction"></g><g class="dao-apercu"></g><g class="dao-curseur"></g></svg>
    <div class="dao-loupe" hidden><svg class="dao-svg" xmlns="${NS}"></svg></div>`;
  const svg = el.querySelector('svg');
  const loupe = el.querySelector('.dao-loupe'), loupeSvg = loupe.querySelector('svg');
  const calque = (n) => svg.querySelector(`.dao-${n}`);
  const vb = { x: 0, y: 0, w: 100, h: 100 };   // fenêtre visible, en mm papier
  let espace = false;

  const echelleEcran = () => (svg.clientWidth || 1) / vb.w;   // pixels par mm papier
  const appliquer = () => {
    svg.setAttribute('viewBox', `${r(vb.x)} ${r(vb.y)} ${r(vb.w)} ${r(vb.h)}`);
    opts.surZoom?.(zoomPct());
  };
  // zoom 100 % = taille réelle approximative (96 px par pouce → 3,78 px/mm)
  const zoomPct = () => Math.round((echelleEcran() / (96 / 25.4)) * 100);

  function dessinerFond() {
    const [W, H] = taille(p);
    calque('papier').innerHTML = `<rect class="dao-ombre" x="1.2" y="1.6" width="${W}" height="${H}"/><rect class="dao-feuille" x="0" y="0" width="${W}" height="${H}"/>`;
    calque('grille').innerHTML = p.grille ? svgGrille(p) : '';
    calque('cadre-g').innerHTML = svgCadre(p);
  }

  /** Toute la feuille visible, centrée. */
  function ajuster() {
    const [W, H] = taille(p);
    const cw = svg.clientWidth || 800, ch = svg.clientHeight || 600;
    const m = 8;   // marge autour de la feuille (mm)
    const k = Math.min(cw / (W + 2 * m), ch / (H + 2 * m));
    vb.w = cw / k; vb.h = ch / k;
    vb.x = (W - vb.w) / 2; vb.y = (H - vb.h) / 2;
    appliquer();
  }

  /** Zoom d'un facteur f autour d'un point écran (px, py) relatif au SVG. */
  function zoomer(f, px = svg.clientWidth / 2, py = svg.clientHeight / 2) {
    const [W, H] = taille(p);
    const nw = Math.min(Math.max(vb.w / f, 8), Math.max(W, H) * 4);
    const g = nw / vb.w;
    const mx = vb.x + (px / svg.clientWidth) * vb.w, my = vb.y + (py / svg.clientHeight) * vb.h;
    vb.x = mx - (mx - vb.x) * g; vb.y = my - (my - vb.y) * g;
    vb.w = nw; vb.h *= g;
    appliquer();
  }

  const deplacer = (dxPx, dyPx) => { const k = echelleEcran(); vb.x -= dxPx / k; vb.y -= dyPx / k; appliquer(); };

  /** Point écran (événement) → mm papier. */
  function versPapierEcran(ev) {
    const b = svg.getBoundingClientRect();
    return [vb.x + ((ev.clientX - b.left) / b.width) * vb.w, vb.y + ((ev.clientY - b.top) / b.height) * vb.h];
  }

  /** Réticule au point papier pt (ou caché), position réelle transmise à surCurseur. */
  function curseur(pt) {
    const z = zone(p);
    if (!pt || pt[0] < z.x - 0.01 || pt[0] > z.x + z.w + 0.01 || pt[1] < z.y - 0.01 || pt[1] > z.y + z.h + 0.01) {
      calque('curseur').innerHTML = ''; opts.surCurseur?.(null); return;
    }
    const [xp, yp] = pt;
    const t = 6 / echelleEcran();   // réticule de ±6 px
    calque('curseur').innerHTML = `<path class="dao-reticule" d="M${r(xp - t)} ${r(yp)}H${r(xp + t)}M${r(xp)} ${r(yp - t)}V${r(yp + t)}"/>`;
    opts.surCurseur?.(versReel(p, xp, yp));
  }
  /** Transmet un geste de tracé à l'outil ; l'outil peut renvoyer le point (accroché) du réticule. */
  function versOutil(type, ev) {
    const pt = ev ? versPapierEcran(ev) : null;
    const res = opts.surPointeur?.(type, ev, pt);
    if (type !== 'haut') curseur(Array.isArray(res) ? res : pt);
    // loupe au-dessus du doigt (le doigt cache le point visé)
    if (ev?.pointerType === 'touch' && (type === 'bas' || type === 'bouge')) montrerLoupe(ev, Array.isArray(res) ? res : pt);
    else loupe.hidden = true;
  }
  function montrerLoupe(ev, pt) {
    const T = 132, G = 3;                       // taille (px) et grossissement
    const b = el.getBoundingClientRect();
    const w = T / G / Math.max(echelleEcran(), 1e-6);
    loupeSvg.setAttribute('viewBox', `${r(pt[0] - w / 2)} ${r(pt[1] - w / 2)} ${r(w)} ${r(w)}`);
    loupeSvg.innerHTML = svg.innerHTML;
    let x = ev.clientX - b.left - T / 2, y = ev.clientY - b.top - T - 40;
    if (y < 4) y = ev.clientY - b.top + 40;
    loupe.style.left = `${Math.max(4, Math.min(b.width - T - 4, x))}px`; loupe.style.top = `${y}px`;
    loupe.hidden = false;
  }

  /* ----- pointeurs : souris, stylet, doigts ----- */
  const doigts = new Map();      // pointerId → {x, y}
  let pan = null;                // {x, y} dernier point du glisser
  let pince = null;              // {d, cx, cy} distance et centre précédents
  let traceDoigt = null;         // pointerId du doigt qui trace (outil actif)
  const outilActif = () => (opts.outil?.() || 'main') !== 'main';

  const capturer = (ev) => { try { svg.setPointerCapture(ev.pointerId); } catch { /* pointeur déjà relâché */ } };
  const centreDoigts = () => {
    const [a, b] = [...doigts.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  };

  svg.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'touch') {
      doigts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      capturer(ev);
      if (doigts.size === 2) {
        if (traceDoigt != null) { versOutil('annule', null); traceDoigt = null; }
        pan = null; pince = centreDoigts();
      } else if (doigts.size === 1) {
        // « stylet seulement » : le doigt déplace la feuille, seul le stylet dessine
        if (outilActif() && !opts.styletSeul?.()) { traceDoigt = ev.pointerId; versOutil('bas', ev); } else pan = { x: ev.clientX, y: ev.clientY };
      }
      ev.preventDefault();
      return;
    }
    // souris / stylet : déplacer avec le clic du milieu, espace + clic, ou l'outil « main »
    if (ev.button === 1 || (ev.button === 0 && (espace || !outilActif()))) {
      pan = { x: ev.clientX, y: ev.clientY };
      capturer(ev);
      svg.classList.add('dao-pan-actif');
      ev.preventDefault();
      return;
    }
    if (ev.button === 2) { ev.preventDefault(); versOutil('droit', ev); return; }
    if (ev.button === 0) { capturer(ev); versOutil('bas', ev); ev.preventDefault(); }
  });

  svg.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'touch' && doigts.has(ev.pointerId)) {
      doigts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (doigts.size === 2 && pince) {
        const n = centreDoigts(); const b = svg.getBoundingClientRect();
        if (pince.d > 0 && n.d > 0) zoomer(n.d / pince.d, n.cx - b.left, n.cy - b.top);
        deplacer(n.cx - pince.cx, n.cy - pince.cy);
        pince = n;
      } else if (traceDoigt === ev.pointerId) versOutil('bouge', ev);
      else if (pan) { deplacer(ev.clientX - pan.x, ev.clientY - pan.y); pan = { x: ev.clientX, y: ev.clientY }; }
      return;
    }
    if (pan) { deplacer(ev.clientX - pan.x, ev.clientY - pan.y); pan = { x: ev.clientX, y: ev.clientY }; curseur(versPapierEcran(ev)); return; }
    if (outilActif()) versOutil('bouge', ev); else curseur(versPapierEcran(ev));
  });

  const fin = (ev) => {
    if (ev.pointerType === 'touch') {
      if (traceDoigt === ev.pointerId) { traceDoigt = null; if (ev.type === 'pointerup') versOutil('haut', ev); else versOutil('annule', null); }
      doigts.delete(ev.pointerId);
      pince = null;
      loupe.hidden = true;
      pan = doigts.size === 1 && (!outilActif() || opts.styletSeul?.()) ? (() => { const [d] = doigts.values(); return { x: d.x, y: d.y }; })() : null;
      return;
    }
    if (pan) { pan = null; svg.classList.remove('dao-pan-actif'); return; }
    if (ev.type === 'pointerup' && ev.button === 0 && outilActif()) versOutil('haut', ev);
  };
  svg.addEventListener('pointerup', fin);
  svg.addEventListener('pointercancel', fin);
  svg.addEventListener('pointerleave', (ev) => { if (ev.pointerType !== 'touch' && !pan) curseur(null); });
  svg.addEventListener('contextmenu', (ev) => ev.preventDefault());

  svg.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const b = svg.getBoundingClientRect();
    if (ev.ctrlKey || !ev.shiftKey) zoomer(Math.exp(-ev.deltaY * (ev.deltaMode ? 0.05 : 0.0015)), ev.clientX - b.left, ev.clientY - b.top);
    else deplacer(-ev.deltaY, 0);
  }, { passive: false });
  svg.addEventListener('auxclick', (ev) => ev.preventDefault());

  const clavier = (ev) => {
    if (ev.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (ev.code === 'Space') { espace = ev.type === 'keydown'; svg.classList.toggle('dao-pan', espace); if (espace) ev.preventDefault(); }
  };
  window.addEventListener('keydown', clavier);
  window.addEventListener('keyup', clavier);

  // garder la même zone visible quand la taille de l'écran change
  let dernier = null;
  const ro = new ResizeObserver(() => {
    const cw = svg.clientWidth, ch = svg.clientHeight;
    if (!cw || !ch) return;
    if (!dernier) { ajuster(); } else {
      const k = dernier.cw / vb.w;     // garder l'échelle à l'écran
      const cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
      vb.w = cw / k; vb.h = ch / k; vb.x = cx - vb.w / 2; vb.y = cy - vb.h / 2;
      appliquer();
    }
    dernier = { cw, ch };
  });
  ro.observe(svg);

  dessinerFond();
  ajuster();

  return {
    svg,
    calque,
    /** Remplace la planche (format, échelle, cartouche, grille…) et redessine. */
    maj(nouvelle, { recadrer = false } = {}) { p = nouvelle; dessinerFond(); if (recadrer) ajuster(); },
    ajuster,
    zoomer,
    zoomPct,
    versPapierEcran,
    curseur,
    /** Pixels écran par mm papier (pour les tolérances d'accrochage). */
    pxParMm: echelleEcran,
    planche: () => p,
    detruire() { ro.disconnect(); window.removeEventListener('keydown', clavier); window.removeEventListener('keyup', clavier); },
  };
}

/**
 * Impression de la planche à l'échelle réelle (1 mm du dessin = 1 mm sur le papier, à imprimer « taille réelle / 100 % »).
 * On copie le SVG à l'écran sans la grille, le curseur, l'aperçu ni la correction, au format de la feuille.
 * @param {SVGSVGElement} svg  SVG affiché (monterFeuille)
 * @param {object} p           planche (format, orientation)
 */
export function imprimerPlanche(svg, p) {
  const [W, H] = taille(p);
  const copie = svg.cloneNode(true);
  for (const n of ['grille', 'curseur', 'apercu', 'correction']) copie.querySelector(`.dao-${n}`)?.remove();
  copie.querySelector('.dao-ombre')?.remove();
  copie.setAttribute('viewBox', `0 0 ${W} ${H}`);
  copie.setAttribute('style', `width:${W}mm;height:${H}mm`);
  const boite = document.createElement('div');
  boite.id = 'impr-dao';
  boite.appendChild(copie);
  const page = document.createElement('style');
  page.id = 'impr-dao-page';
  page.textContent = `@media print{@page{size:${p.format || 'A4'} ${p.orientation === 'portrait' ? 'portrait' : 'landscape'};margin:0}}`;
  document.getElementById('impr-dao')?.remove(); document.getElementById('impr-dao-page')?.remove();
  document.head.appendChild(page); document.body.appendChild(boite); document.body.classList.add('impr-dao-on');
  const fin = () => { boite.remove(); page.remove(); document.body.classList.remove('impr-dao-on'); window.removeEventListener('afterprint', fin); };
  window.addEventListener('afterprint', fin);
  window.print();
}
