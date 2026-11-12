/* =====================================================================
   CAHIER IMPRIMABLE (A4 portrait, à imprimer en « taille réelle 100 % »)
   ---------------------------------------------------------------------
   Pages d'écriture normalisée, puis un exercice par page : titre, matière,
   échelle, vues données à l'échelle (1 mm du dessin = 1 mm sur papier),
   données, exercice et perspective cotée. Corrigés en option.
   Tout le contenu est créé pour l'appli.
   ===================================================================== */

import { CAHIER } from './cahier.js';
import { vues, coupeA } from './pieces.js';
import { svgPerspective, perspectiveEntites } from './perspective.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f2 = (v) => Math.round(v * 100) / 100;
const ZW = 190, ZH = 158;   // zone des vues sur la page (mm)

const SYMBOLE = '<svg viewBox="0 0 22 10" style="width:17mm;height:7.5mm;vertical-align:middle"><path d="M1 3.2 L8 1 L8 9 L1 6.8 Z M1 5 H8" fill="none" stroke="#000" stroke-width="0.5"/><circle cx="15.5" cy="5" r="4" fill="none" stroke="#000" stroke-width="0.5"/><circle cx="15.5" cy="5" r="2" fill="none" stroke="#000" stroke-width="0.5"/><path d="M10.5 5H20.5M15.5 0V10" stroke="#000" stroke-width="0.25" stroke-dasharray="2 0.6 0.4 0.6"/></svg>';

function svgEnt(e) {
  const Y = (y) => f2(ZH - y);
  const st = e.s === 'v' ? 'stroke-width="0.5"' : e.s === 'c' ? 'stroke-width="0.25" stroke-dasharray="2 1"' : e.s === 'a' ? 'stroke-width="0.25" stroke-dasharray="7 1.2 1 1.2"' : 'stroke-width="0.25"';
  if (e.t === 'l') return `<line x1="${f2(e.x1)}" y1="${Y(e.y1)}" x2="${f2(e.x2)}" y2="${Y(e.y2)}" stroke="#000" ${st} stroke-linecap="round"/>`;
  if (e.t === 'c') return `<circle cx="${f2(e.cx)}" cy="${Y(e.cy)}" r="${f2(e.r)}" fill="none" stroke="#000" ${st}/>`;
  if (e.t === 'a') {
    const p = (a) => [e.cx + e.r * Math.cos((a * Math.PI) / 180), e.cy + e.r * Math.sin((a * Math.PI) / 180)];
    const [x0, y0] = p(e.a0), [x1, y1] = p(e.a1);
    return `<path d="M${f2(x0)} ${Y(y0)}A${f2(e.r)} ${f2(e.r)} 0 ${e.a1 - e.a0 > 180 ? 1 : 0} 0 ${f2(x1)} ${Y(y1)}" fill="none" stroke="#000" ${st}/>`;
  }
  if (e.t === 'x') return `<text x="${f2(e.x)}" y="${Y(e.y)}" font-size="${f2(e.h || 3.5)}" font-family="Segoe UI,Arial,sans-serif">${esc(e.txt)}</text>`;
  if (e.t === 'h') {   // hachures fines à 45° (contour moins les trous, règle pair-impair)
    const ring = (q) => `M${q.map(([x, y]) => `${f2(x)} ${Y(y)}`).join('L')}Z`;
    const id = `h${Math.random().toString(36).slice(2, 8)}`, xs = e.pts.map((q) => q[0]), ys = e.pts.map((q) => q[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    let d = ''; for (let k = x0 - (y1 - y0); k < x1; k += 3) d += `M${f2(k)} ${Y(y0)}L${f2(k + (y1 - y0))} ${Y(y1)}`;
    return `<clipPath id="${id}"><path clip-rule="evenodd" d="${[e.pts, ...(e.trous || [])].map(ring).join('')}"/></clipPath><path d="${d}" stroke="#000" stroke-width="0.25" clip-path="url(#${id})"/>`;
  }
  return '';
}

/** Entités de la page : données (exercice) ou solution complète (corrigé). */
function entitesPage(ex, corrige) {
  const pc = ex.piece;
  if (ex.mode === 'construction') return corrige ? [...ex.cons.donnees, ...ex.cons.solution.map((e) => ({ ...e, s: e.s === 'n' ? 'v' : e.s }))] : ex.cons.donnees;
  if (ex.mode === 'iso' || ex.mode === 'cav') {   // 3 vues en haut à gauche, perspective à droite (repère ✚)
    const H = pc.profil.reduce((m, q) => Math.max(m, q[1]), 0), W = pc.profil.reduce((m, q) => Math.max(m, q[0]), 0), P = pc.prof;
    const o = [4, ZH - 4 - H], v = vues(pc, o, 10);
    const r = ex.mode === 'iso' ? [ZW - 6 - W * 0.866, 8 + P * 0.5] : [ZW - 8 - W - P * 0.354, 8];
    const croix = [{ t: 'l', x1: r[0] - 4, y1: r[1], x2: r[0] + 4, y2: r[1], s: 'n' }, { t: 'l', x1: r[0], y1: r[1] - 4, x2: r[0], y2: r[1] + 4, s: 'n' }];
    const base = [...v.face, ...v.dessus, ...v.gauche, ...croix];
    return corrige ? [...base, ...perspectiveEntites(pc, r, ex.mode).traits] : base;
  }
  const cd = vues(pc, [0, 0], 0).cadres, L = cd.face.w, H = cd.face.h, P = cd.dessus.h;   // valable pour toutes les sortes de pièces
  const ex1 = Math.floor((ZW - L - P) / 3), ey = Math.floor((ZH - H - P) / 3);
  const v = vues(pc, [ex1, ey + P + ey], [ex1, ey]);
  if (ex.mode === 'coupe' || ex.mode === 'demi') { const cp = coupeA(pc, [ex1, ey + P + ey], [ex1, ey], { demi: ex.mode === 'demi' }); return corrige ? [...(cp.hachures || [cp.hachure]), ...cp.dessus, ...cp.face, { t: 'x', x: ex1 + L / 2 - 4, y: ey + P + ey + H + 4, txt: 'A-A', h: 5 }] : cp.dessus; }
  if (corrige) return [...v.face, ...v.dessus, ...v.gauche];
  const out = [];
  for (const k of ['face', 'dessus', 'gauche']) {
    const d = ex.donne[k];
    if (d === 'complet') out.push(...v[k]);
    else if (d === 'contour') { const q = v.cadres[k]; out.push(...[[q.x, q.y, q.x + q.w, q.y], [q.x + q.w, q.y, q.x + q.w, q.y + q.h], [q.x + q.w, q.y + q.h, q.x, q.y + q.h], [q.x, q.y + q.h, q.x, q.y]].map(([x1, y1, x2, y2]) => ({ t: 'l', x1, y1, x2, y2, s: 'v' }))); }
  }
  return out;
}

function pageExercice(ex, corrige) {
  const ents = entitesPage(ex, corrige);
  return `<section class="cah-page">
    <h1>${ex.n}. ${esc(ex.titre)}${corrige ? ' <small>— corrigé</small>' : ''}</h1>
    <div class="cah-tete"><span>Nom : ..............................................</span><span>${esc(ex.matiere)} — Échelle ${esc(ex.echelle)} ${SYMBOLE}</span></div>
    <svg class="cah-vues" viewBox="0 0 ${ZW} ${ZH}" style="width:${ZW}mm;height:${ZH}mm">${ents.map(svgEnt).join('')}</svg>
    <div class="cah-bas">
      <div class="cah-txt">
        <h2>□ Données :</h2><ul>${ex.donnees.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
        <h2>□ EXERCICE :</h2><ol>${ex.exercice.map((d) => `<li>${esc(d)}</li>`).join('')}</ol>
      </div>
      ${ex.mode === 'construction' || ex.mode === 'iso' || ex.mode === 'cav' ? '' : `<div class="cah-persp">${svgPerspective(ex.piece, { largeur: 360 })}</div>`}
    </div>
    <div class="cah-pied">Cahier de dessin — exercices créés pour l'appli Révisions · imprimer en taille réelle (100 %) · page ${ex.n}</div>
  </section>`;
}

/** Pages d'écriture normalisée (ISO 3098, type B). */
function pagesEcriture() {
  const lignes = (h, n, modele = '') => Array.from({ length: n }, (_, i) => `<div class="cah-ligne" style="height:${h * 1.9}mm"><div class="cah-g" style="height:${h}mm;border-top:0.2mm solid #9ab;border-bottom:0.2mm solid #9ab"><div style="height:${h * 0.3}mm;border-bottom:0.15mm dashed #bcd"></div></div>${i === 0 && modele ? `<span class="cah-mod" style="font-size:${h * 1.36}mm;line-height:${h}mm">${modele}</span>` : ''}</div>`).join('');
  return `<section class="cah-page">
    <h1>ÉCRITURE NORMALISÉE</h1>
    <div class="cah-tete"><span>Nom : ..............................................</span><span>Norme ISO 3098 — écriture type B</span></div>
    <div class="cah-ecr">
      <p><b>Règles :</b> hauteur des majuscules <b>h</b> = 3,5 · 5 · 7 · 10 mm ; minuscules = 0,7 h ; épaisseur du trait = 0,1 h ; espace entre lettres ≈ 0,2 h ; entre mots ≈ 0,6 h ; entre lignes ≥ 1,4 h. Écriture droite ou penchée à 75°. Repasse chaque modèle puis recopie-le sur les lignes guides.</p>
      <h2>Majuscules — h = 10 mm</h2>${lignes(10, 2, 'ABCDEFGHIJKLM')}${lignes(10, 2, 'NOPQRSTUVWXYZ')}
      <h2>Chiffres — h = 7 mm</h2>${lignes(7, 2, '0123456789 Ø R ± ° %')}
      <h2>Minuscules — h = 7 mm</h2>${lignes(7, 2, 'abcdefghijklmnopqrstuvwxyz')}
    </div>
    <div class="cah-pied">Cahier de dessin — imprimer en taille réelle (100 %) · écriture 1</div>
  </section>
  <section class="cah-page">
    <h1>ÉCRITURE NORMALISÉE — MOTS TECHNIQUES</h1>
    <div class="cah-tete"><span>Nom : ..............................................</span><span>h = 5 mm puis 3,5 mm</span></div>
    <div class="cah-ecr">
      <h2>h = 5 mm</h2>${['ÉCHELLE 1:1 — ACIER S235', 'VUE DE FACE — VUE DE DESSUS', 'COUPE A-A — DEMI-COUPE B-B', 'Ø20 — R5 — 2 x 45° — M10'].map((m) => lignes(5, 2, m)).join('')}
      <h2>h = 3,5 mm</h2>${['Cartouche : titre, nom, date, échelle, format A4', 'Projection européenne — tolérance ± 0,1', 'Chanfrein 1 x 45° — congé R2 — trou Ø8 traversant'].map((m) => lignes(3.5, 3, m)).join('')}
    </div>
    <div class="cah-pied">Cahier de dessin — imprimer en taille réelle (100 %) · écriture 2</div>
  </section>`;
}

const STYLE = `
@page{size:A4 portrait;margin:0}
#impr-cah{font-family:"Segoe UI",Arial,sans-serif;color:#000;background:#fff}
#impr-cah .cah-page{width:210mm;height:297mm;box-sizing:border-box;padding:10mm 10mm 8mm;position:relative;page-break-after:always;break-after:page;overflow:hidden;background:#fff}
#impr-cah h1{font-size:7mm;text-align:center;margin:0 0 2mm;letter-spacing:.3mm;border-bottom:.4mm solid #000;padding-bottom:1.5mm}
#impr-cah h1 small{font-size:4mm;font-weight:400}
#impr-cah .cah-tete{display:flex;justify-content:space-between;align-items:center;font-size:3.6mm;margin-bottom:2mm}
#impr-cah .cah-vues{display:block}
#impr-cah .cah-bas{display:flex;gap:4mm;margin-top:2mm}
#impr-cah .cah-txt{flex:1;font-size:3.3mm;line-height:1.35}
#impr-cah .cah-txt h2{font-size:3.8mm;margin:1.5mm 0 1mm}
#impr-cah .cah-txt ul,#impr-cah .cah-txt ol{margin:0;padding-left:5mm}
#impr-cah .cah-persp{width:105mm;height:100mm;display:flex;align-items:center;justify-content:center}
#impr-cah .cah-persp svg{width:105mm;height:100mm}
#impr-cah .cah-pied{position:absolute;bottom:5mm;left:10mm;right:10mm;font-size:2.6mm;color:#666;text-align:center}
#impr-cah .cah-ecr{font-size:3.4mm}
#impr-cah .cah-ecr h2{font-size:4mm;margin:3mm 0 1mm}
#impr-cah .cah-ligne{position:relative;display:flex;align-items:flex-start}
#impr-cah .cah-g{flex:1}
#impr-cah .cah-mod{position:absolute;left:1mm;top:0;font-family:"Arial Narrow","Liberation Sans Narrow","Segoe UI",Arial,sans-serif;font-style:italic;color:#aab;letter-spacing:.6mm}
@media screen{#impr-cah .cah-page{margin:0 auto 8mm;box-shadow:0 1px 6px rgba(0,0,0,.25)}}
`;

/** HTML complet du cahier (pages). */
export function htmlCahier({ corriges = false } = {}) {
  return (corriges ? '' : pagesEcriture()) + CAHIER.map((ex) => pageExercice(ex, corriges)).join('');
}
export const STYLE_CAHIER = STYLE;

/** Ouvre l'impression du cahier (ou des corrigés) : choisir « taille réelle / 100 % » ou « Enregistrer en PDF ». */
export function imprimerCahier({ corriges = false } = {}) {
  const boite = document.createElement('div');
  boite.id = 'impr-cah';
  boite.innerHTML = htmlCahier({ corriges });
  const st = document.createElement('style');
  st.id = 'impr-cah-style';
  st.textContent = `${STYLE}@media print{body.impr-cah-on > *:not(#impr-cah){display:none!important}body.impr-cah-on{margin:0;padding:0;background:#fff}#impr-cah svg{-webkit-print-color-adjust:exact;print-color-adjust:exact}}@media screen{body.impr-cah-on > #impr-cah{display:none}}`;
  document.getElementById('impr-cah')?.remove(); document.getElementById('impr-cah-style')?.remove();
  document.head.appendChild(st); document.body.appendChild(boite); document.body.classList.add('impr-cah-on');
  const fin = () => { boite.remove(); st.remove(); document.body.classList.remove('impr-cah-on'); window.removeEventListener('afterprint', fin); };
  window.addEventListener('afterprint', fin);
  setTimeout(() => window.print(), 50);
}
