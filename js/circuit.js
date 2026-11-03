/* =====================================================================
   CIRCUIT — schéma électrique à annoter (sens + valeur des courants et tensions)
   ---------------------------------------------------------------------
   schema = { w, h, fils: [[x,y, x,y, …], …], points: [[x,y]], textes: [[x,y,'txt']],
              masses: [[x,y]], bornes: [[x,y,'−12 V']],
              comps: [{ id, t: 'R'|'A'|'V'|'G', a:[x,y], b:[x,y], nom, val, plus: 'a'|'b' }] }
   solution = { id: { I, U } }   I : courant de a vers b (A, signé) ; U = V(a) − V(b) (V, signé)
   L'élève touche un composant, choisit le sens des flèches et tape les valeurs.
   Convention du cours : la flèche de tension pointe vers le point au potentiel le plus haut
   (pointe sur a ⇒ U_ab).
   ===================================================================== */

import { stockage, esc } from './utils.js';

const K = 46;                    // pixels par unité de grille
const LONG = { R: 1.4, A: 0.84, V: 0.84, G: 0.5 };
const UNITES = { I: [['A', 1], ['mA', 1e-3], ['µA', 1e-6]], U: [['V', 1], ['mV', 1e-3], ['kV', 1e3]] };

const lire = () => stockage.lire('circuits', {});
const sauver = (cle, v) => { const t = lire(); t[cle] = v; stockage.ecrire('circuits', t); };

/** 0,00375 A → « 3,75 mA » */
export function joli(v, unite) {
  const a = Math.abs(v);
  let f = 1, p = '';
  if (a !== 0 && a < 1e-3) { f = 1e-6; p = 'µ'; } else if (a !== 0 && a < 1) { f = 1e-3; p = 'm'; } else if (a >= 1e4) { f = 1e3; p = 'k'; }
  const x = v / f;
  const s = Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2);
  return `${String(+s).replace('.', ',')} ${p}${unite}`;
}
const nombre = (s) => { const x = parseFloat(String(s ?? '').replace(',', '.').replace(/\s/g, '')); return Number.isFinite(x) ? x : null; };
const proche = (x, y) => Math.abs(x - y) <= Math.max(0.02 * Math.abs(y), 1e-9);

/** Flèche (caractère) qui pointe dans la direction écran du vecteur (dx, dy). */
function fleche(dx, dy) {
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;
  const t = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
  return t[((Math.round(ang / 45) % 8) + 8) % 8];
}

export function monterCircuit(el, ex, opts = {}) {
  const S = ex.schema; const sol = ex.solution || {};
  const W = S.w * K, H = S.h * K;
  const comps = Object.fromEntries(S.comps.map((c) => [c.id, c]));
  const etat = { notes: lire()[opts.cle] || {}, sel: null, verif: null, voirSol: false };

  el.innerHTML = `
    <div class="ci">
      <div class="ci-cadre"><svg class="ci-svg" viewBox="-${K * 1.4} -${K * 0.6} ${W + K * 2.8} ${H + K * 1.2}" role="img" aria-label="Schéma à annoter"></svg></div>
      <p class="ci-aide muted">👆 Touche un composant pour dessiner le <b>sens du courant</b> et le <b>vecteur tension</b>, et écrire leurs valeurs.</p>
      <div class="ci-panneau" hidden></div>
      <div class="ci-actions">
        <button class="btn primary" type="button" data-ci="verifier">✓ Vérifier mes annotations</button>
        <button class="btn" type="button" data-ci="sol" hidden>Voir la solution sur le schéma</button>
        <button class="btn" type="button" data-ci="effacer">Effacer</button>
      </div>
      <div class="ci-res" hidden></div>
    </div>`;
  const svg = el.querySelector('svg');
  svg.style.minWidth = `${Math.round((S.w + 2.8) * K * 0.68)}px`;   // lisible au téléphone (on fait défiler)
  const pan = el.querySelector('.ci-panneau'); const res = el.querySelector('.ci-res');

  const geo = (c) => {
    const [x1, y1] = c.a, [x2, y2] = c.b; const L = Math.hypot(x2 - x1, y2 - y1);
    const u = [(x2 - x1) / L, (y2 - y1) / L]; const n = [-u[1], u[0]];
    const m = [(x1 + x2) / 2, (y1 + y2) / 2]; const h = LONG[c.t] / 2;
    return { u, n, m, L, p: [m[0] - u[0] * h, m[1] - u[1] * h], q: [m[0] + u[0] * h, m[1] + u[1] * h] };
  };
  const anc = (vx) => (vx > 0.3 ? 'start' : vx < -0.3 ? 'end' : 'middle');
  const P = (x, y) => `${(x * K).toFixed(1)},${(y * K).toFixed(1)}`;
  const ligne = (a, b, cls = '') => `<line class="${cls}" x1="${a[0] * K}" y1="${a[1] * K}" x2="${b[0] * K}" y2="${b[1] * K}"/>`;

  function symbole(c) {
    const { u, n, m, p, q } = geo(c);
    let s = ligne(c.a, p, 'ci-fil') + ligne(q, c.b, 'ci-fil');
    const ang = Math.atan2(u[1], u[0]) * 180 / Math.PI;
    if (c.t === 'R') {
      s += `<rect class="ci-r" x="${-0.7 * K}" y="${-0.22 * K}" width="${1.4 * K}" height="${0.44 * K}" transform="translate(${P(...m)}) rotate(${ang})"/>`;
    } else if (c.t === 'A' || c.t === 'V') {
      s += `<circle class="ci-m" cx="${m[0] * K}" cy="${m[1] * K}" r="${0.42 * K}"/><text class="ci-ml" x="${m[0] * K}" y="${m[1] * K + 6}">${c.t}</text>`;
    } else if (c.t === 'G') {   // pile : grand trait = +
      const plusA = c.plus === 'a'; const g = plusA ? p : q, k = plusA ? q : p;
      s += ligne([g[0] + n[0] * 0.5, g[1] + n[1] * 0.5], [g[0] - n[0] * 0.5, g[1] - n[1] * 0.5], 'ci-pl');
      s += ligne([k[0] + n[0] * 0.25, k[1] + n[1] * 0.25], [k[0] - n[0] * 0.25, k[1] - n[1] * 0.25], 'ci-pc');
      const t = [g[0] - u[0] * (plusA ? 0.3 : -0.3) + n[0] * 0.55, g[1] - u[1] * (plusA ? 0.3 : -0.3) + n[1] * 0.55];
      s += `<text class="ci-plus" x="${t[0] * K}" y="${t[1] * K + 5}">+</text>`;
    }
    // étiquette (nom, valeur) du côté −n
    const lab = c.t === 'R' ? 0.4 : c.t === 'G' ? 0.62 : 0.55; const e = [m[0] - n[0] * lab, m[1] - n[1] * lab];
    const txt = [c.nom, c.val].filter(Boolean).join(' ');
    if (txt) s += `<text class="ci-lab" style="text-anchor:${anc(-n[0])}" x="${e[0] * K}" y="${e[1] * K + 5}">${esc(txt)}</text>`;
    // zone tactile
    s += `<rect class="ci-hit" data-comp="${c.id}" x="${-0.9 * K}" y="${-0.55 * K}" width="${1.8 * K}" height="${1.1 * K}" rx="8" transform="translate(${P(...m)}) rotate(${ang})"/>`;
    return s;
  }

  /** Flèches d'un composant : courant (sur le fil) et tension (parallèle, côté +n). */
  function fleches(c, a, cls) {
    const { u, n, m, p, L } = geo(c); let s = '';
    if (a?.i?.txt) {
      const d = a.i.d || 1; const off = Math.min(0.45, (L - LONG[c.t]) / 4 + 0.1);
      const c0 = [p[0] - u[0] * off, p[1] - u[1] * off];          // sur le fil côté a
      const t = [c0[0] + u[0] * 0.17 * d, c0[1] + u[1] * 0.17 * d];
      const b1 = [c0[0] - u[0] * 0.17 * d + n[0] * 0.13, c0[1] - u[1] * 0.17 * d + n[1] * 0.13];
      const b2 = [c0[0] - u[0] * 0.17 * d - n[0] * 0.13, c0[1] - u[1] * 0.17 * d - n[1] * 0.13];
      if (a.i.d) s += `<polygon class="ci-fi ${cls}" points="${P(...t)} ${P(...b1)} ${P(...b2)}"/>`;
      const lt = [c0[0] + n[0] * 0.3, c0[1] + n[1] * 0.3];
      s += `<text class="ci-vi ${cls}" style="text-anchor:${anc(n[0])}" x="${lt[0] * K}" y="${lt[1] * K + 4}">${esc(a.i.txt || '')}</text>`;
    }
    if (a?.u?.txt) {
      const d = a.u.d || 1; const h = Math.max(0.55, LONG[c.t] / 2 + 0.05); const o = c.t === 'R' ? 0.52 : 0.66;
      const tip = [m[0] - u[0] * h * d + n[0] * o, m[1] - u[1] * h * d + n[1] * o];   // d = 1 : pointe vers a
      const queue = [m[0] + u[0] * h * d + n[0] * o, m[1] + u[1] * h * d + n[1] * o];
      if (a.u.d) s += ligne(queue, tip, `ci-fu ${cls}`);
      const b1 = [tip[0] + u[0] * 0.2 * d + n[0] * 0.11, tip[1] + u[1] * 0.2 * d + n[1] * 0.11];
      const b2 = [tip[0] + u[0] * 0.2 * d - n[0] * 0.11, tip[1] + u[1] * 0.2 * d - n[1] * 0.11];
      if (a.u.d) s += `<polygon class="ci-fut ${cls}" points="${P(...tip)} ${P(...b1)} ${P(...b2)}"/>`;
      const lt = [m[0] + n[0] * (o + 0.22), m[1] + n[1] * (o + 0.22)];
      s += `<text class="ci-vu ${cls}" style="text-anchor:${anc(n[0])}" x="${lt[0] * K}" y="${lt[1] * K + 4}">${esc(a.u.txt || '')}</text>`;
    }
    return s;
  }
  /** Annotation « solution » : flèches orientées pour que la valeur soit positive. */
  function solA(id) {
    const s = sol[id]; if (!s) return null; const o = {};
    if (s.I != null) o.i = Math.abs(s.I) < 1e-12 ? { d: 1, v: 0, txt: '0 A' } : { d: Math.sign(s.I), v: 1, txt: joli(Math.abs(s.I), 'A') };
    if (s.U != null) o.u = Math.abs(s.U) < 1e-12 ? { d: 1, v: 0, txt: '0 V' } : { d: Math.sign(s.U), v: 1, txt: joli(Math.abs(s.U), 'V') };
    if (o.i?.v === 0) o.i = { ...o.i, d: 0 }; if (o.u?.v === 0) o.u = { ...o.u, d: 0 };
    return o;
  }
  const texteNote = (x, g) => (!x ? '' : x.v !== '' && x.v != null ? `${String(x.v).replace('.', ',')} ${x.unite || (g === 'i' ? 'A' : 'V')}` : '?');

  function dessiner() {
    let s = '';
    for (const f of S.fils || []) { let d = ''; for (let i = 0; i < f.length; i += 2) d += `${i ? 'L' : 'M'}${f[i] * K} ${f[i + 1] * K} `; s += `<path class="ci-fil" d="${d}"/>`; }
    for (const [x, y] of S.points || []) s += `<circle class="ci-pt" cx="${x * K}" cy="${y * K}" r="4.5"/>`;
    for (const [x, y] of S.masses || []) s += `<path class="ci-fil" d="M${x * K} ${y * K}v8M${x * K - 14} ${y * K + 8}h28M${x * K - 9} ${y * K + 14}h18M${x * K - 4} ${y * K + 20}h8"/>`;
    for (const [x, y, t] of S.bornes || []) s += `<circle class="ci-borne" cx="${x * K}" cy="${y * K}" r="5"/><text class="ci-lab" x="${x * K + 10}" y="${y * K - 10}" text-anchor="start">${esc(t)}</text>`;
    for (const [x, y, t] of S.textes || []) s += `<text class="ci-lab" x="${x * K}" y="${y * K}">${esc(t)}</text>`;
    for (const c of S.comps) {
      const v = etat.verif?.[c.id];
      s += `<g class="ci-c ${etat.sel === c.id ? 'sel' : ''} ${v ? `v-${v}` : ''}">${symbole(c)}</g>`;
    }
    for (const c of S.comps) {
      const a = etat.notes[c.id];
      if (a) s += fleches(c, { i: a.i && { ...a.i, txt: texteNote(a.i, 'i') }, u: a.u && { ...a.u, txt: texteNote(a.u, 'u') } }, 'eleve');
      if (etat.voirSol) { const o = solA(c.id); if (o) s += fleches(c, o, 'sol'); }
    }
    svg.innerHTML = s;
  }

  function panneau() {
    const c = comps[etat.sel]; if (!c) { pan.hidden = true; return; }
    const a = etat.notes[c.id] || {}; const { u } = geo(c); const s = sol[c.id] || {};
    const f1 = fleche(u[0], u[1]), f2 = fleche(-u[0], -u[1]);
    const ligneG = (g, lib, aide) => {
      const x = a[g] || {}; const un = UNITES[g === 'i' ? 'I' : 'U'];
      return `<div class="ci-l"><b>${lib}</b><span class="muted">${aide}</span>
        <div class="ci-sens">
          <button class="btn ${x.d === (g === 'i' ? 1 : -1) ? 'actif' : ''}" type="button" data-g="${g}" data-d="${g === 'i' ? 1 : -1}" title="Flèche ${f1}">${f1}</button>
          <button class="btn ${x.d === (g === 'i' ? -1 : 1) ? 'actif' : ''}" type="button" data-g="${g}" data-d="${g === 'i' ? -1 : 1}" title="Flèche ${f2}">${f2}</button>
          <input class="field" inputmode="decimal" data-gv="${g}" value="${esc(x.v ?? '')}" placeholder="valeur" aria-label="${lib} : valeur">
          <select class="field" data-gu="${g}">${un.map(([n]) => `<option ${(x.unite || un[0][0]) === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <button class="btn icon" type="button" data-g="${g}" data-d="0" title="Retirer">✕</button>
        </div></div>`;
    };
    pan.hidden = false;
    pan.innerHTML = `<div class="ci-t"><b>${esc([c.nom || ({ R: 'Résistance', A: 'Ampèremètre', V: 'Voltmètre', G: 'Générateur' })[c.t], c.val].filter(Boolean).join(' '))}</b>
        <button class="btn icon" type="button" data-ci="fermer" title="Fermer">✕</button></div>
      ${s.I !== undefined || !Object.keys(sol).length ? ligneG('i', 'Courant I', 'sens de la flèche sur le fil') : ''}
      ${s.U !== undefined || !Object.keys(sol).length ? ligneG('u', 'Tension U', 'la pointe du vecteur = côté +') : ''}`;
  }

  function maj(g, champ, val) {
    const c = etat.sel; const a = etat.notes[c] || (etat.notes[c] = {});
    const x = a[g] || (a[g] = { d: g === 'i' ? 1 : -1, v: '', unite: g === 'i' ? 'A' : 'V' });
    x[champ] = val;
    if (champ === 'd' && val === 0) delete a[g];
    sauver(opts.cle, etat.notes); etat.verif = null; res.hidden = true;
  }

  function verifier() {
    const v = {}; let ok = 0, tot = 0; const fautes = [];
    for (const [id, s] of Object.entries(sol)) {
      const c = comps[id]; const a = etat.notes[id] || {}; let bon = true, vide = false;
      for (const [g, k] of [['i', 'I'], ['u', 'U']]) {
        if (s[k] === undefined) continue; tot++;
        const x = a[g]; const val = x ? nombre(x.v) : null;
        if (val === null) { vide = true; bon = false; continue; }
        const f = (UNITES[k].find(([n]) => n === x.unite) || [0, 1])[1];
        const signe = x.d;            // I : d = 1 ⇒ de a vers b ; U : d = 1 ⇒ pointe vers a ⇒ U_ab > 0
        const lu = Math.abs(s[k]) < 1e-12 ? val * f : signe * val * f;
        if (proche(lu, s[k]) || (Math.abs(s[k]) < 1e-12 && Math.abs(val) < 1e-12)) ok++;
        else { bon = false; fautes.push(`${c.nom || c.id} : ${k === 'I' ? 'courant' : 'tension'} ${Math.abs(Math.abs(lu) - Math.abs(s[k])) <= Math.max(0.02 * Math.abs(s[k]), 1e-9) ? '— bonne valeur mais <b>mauvais sens</b>' : 'faux'}`); }
      }
      v[id] = bon ? 'ok' : vide && !(a.i || a.u) ? 'vide' : 'ko';
    }
    etat.verif = v; dessiner();
    const pct = tot ? Math.round(100 * ok / tot) : 0;
    res.hidden = false;
    res.innerHTML = `<div class="ci-score ${pct === 100 ? 'ok' : pct >= 50 ? 'mid' : 'ko'}"><b>${pct} %</b> · ${ok} / ${tot} valeurs justes (sens + valeur)</div>
      ${fautes.length ? `<ul class="ci-fautes">${fautes.slice(0, 8).map((f) => `<li>${f}</li>`).join('')}</ul>` : ''}
      <p class="muted">Vert : juste · rouge : à revoir · gris : pas encore annoté.</p>`;
    el.querySelector('[data-ci=sol]').hidden = false;
    opts.onVerifier?.(pct);
  }

  svg.addEventListener('click', (ev) => {
    const h = ev.target.closest('[data-comp]'); if (!h) return;
    etat.sel = etat.sel === h.dataset.comp ? null : h.dataset.comp; dessiner(); panneau();
    if (etat.sel) pan.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  pan.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.ci === 'fermer') { etat.sel = null; dessiner(); panneau(); return; }
    if (b.dataset.g) {
      const g = b.dataset.g, d = +b.dataset.d;
      maj(g, 'd', d); dessiner(); panneau();
      if (d) pan.querySelector(`[data-gv=${g}]`)?.focus();
    }
  });
  pan.addEventListener('input', (ev) => { const t = ev.target; if (t.dataset.gv) { maj(t.dataset.gv, 'v', t.value); dessiner(); } });
  pan.addEventListener('change', (ev) => { const t = ev.target; if (t.dataset.gu) { maj(t.dataset.gu, 'unite', t.value); dessiner(); } });
  el.querySelector('.ci-actions').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-ci]'); if (!b) return;
    if (b.dataset.ci === 'verifier') verifier();
    if (b.dataset.ci === 'sol') { etat.voirSol = !etat.voirSol; b.textContent = etat.voirSol ? 'Masquer la solution' : 'Voir la solution sur le schéma'; dessiner(); }
    if (b.dataset.ci === 'effacer') { etat.notes = {}; etat.verif = null; sauver(opts.cle, {}); res.hidden = true; etat.sel = null; dessiner(); panneau(); }
  });
  if (opts.solutionVisible) el.querySelector('[data-ci=sol]').hidden = false;
  dessiner();
  return { verifier };
}
