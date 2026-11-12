/* =====================================================================
   VUE ATELIER DE DESSIN — tout se dessine dans le nouveau logiciel (js/dao/)
   ---------------------------------------------------------------------
   #/dessin              catalogue : séries d'exercices (js/dao/catalogue.js),
                         pièces au hasard, planche libre, mode examen
   #/dessin/libre[/…]    planche (js/vues/planche-libre.js)
   L'ancien dessin sur grille (lecteur, pièces en cubes) a été retiré le 11/11/2026.
   ===================================================================== */

import { ongletsMatiere } from './schemas.js';
import { esc, stockage } from '../utils.js';
import { icone } from '../icones.js';
import { styleMatiere } from '../matieres.js';
import { matiere } from '../store.js';
import { vuePlancheLibre, grainePiece } from './planche-libre.js';
import { graineTrouVertical, vues } from '../dao/pieces.js';
import { svgPerspective } from '../dao/perspective.js';
import { SERIES, EXERCICES, NOMS_MODES } from '../dao/catalogue.js';
import { imprimerCahier } from '../dao/cahier-impr.js';
import { CAHIER } from '../dao/cahier.js';

const MID = 'dessin';
const REUSSI = 80;   // score à partir duquel un exercice est « réussi »

/** Remise à zéro des résultats de l'ancien dessin (une seule fois, demandée par Logan le 11/11/2026). */
function razAncien() {
  if (stockage.lire('dessin.raz', 0) >= 1) return;
  const ex = stockage.lire('exos', {}) || {};
  const garde = Object.fromEntries(Object.entries(ex).filter(([k]) => !k.startsWith(`${MID}/`)));
  if (Object.keys(garde).length !== Object.keys(ex).length) stockage.ecrire('exos', garde);
  stockage.ecrire('dessin.raz', 1);
}

/** Planche (et meilleur score) d'un exercice du catalogue. */
function etatExo(id) {
  const t = stockage.lire('planches', {}) || {};
  const pl = Object.values(t).find((x) => x?.exo?.cat === id);
  return pl ? { score: pl.exo.score ?? null } : null;
}

/** Vignette : la perspective de la pièce, ou ses 3 vues pour les exercices de perspective (sinon on verrait la réponse). */
function vignette(e) {
  if (e.mode === 'construction') {   // figure de construction : les données
    const es = e.cons.donnees.filter((x) => x.t === 'l' || x.t === 'c');
    const trait = (x) => (x.s === 'a' ? 'stroke-dasharray="6 1.5 1 1.5" stroke-width="0.6"' : 'stroke-width="1.4"');
    return `<svg viewBox="0 -160 190 160" width="180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Figure">${es.map((x) => (x.t === 'l' ? `<line x1="${x.x1}" y1="${-x.y1}" x2="${x.x2}" y2="${-x.y2}" stroke="#111" ${trait(x)}/>` : `<circle cx="${x.cx}" cy="${-x.cy}" r="${x.r}" fill="none" stroke="#111" ${trait(x)}/>`)).join('')}</svg>`;
  }
  if (e.mode !== 'iso' && e.mode !== 'cav') return svgPerspective(e.piece, { cotes: false, largeur: 180 });
  const v = vues(e.piece, [0, 0], 10), ls = [...v.face, ...v.dessus, ...v.gauche].filter((x) => x.t === 'l' || x.t === 'c');
  const xs = ls.flatMap((x) => (x.t === 'l' ? [x.x1, x.x2] : [x.cx - x.r, x.cx + x.r])), ys = ls.flatMap((x) => (x.t === 'l' ? [x.y1, x.y2] : [x.cy - x.r, x.cy + x.r]));
  const x0 = Math.min(...xs) - 4, x1 = Math.max(...xs) + 4, y0 = Math.min(...ys) - 4, y1 = Math.max(...ys) + 4;
  const trait = (x) => (x.s === 'c' ? 'stroke-dasharray="3 1.5" stroke-width="0.8"' : x.s === 'a' ? 'stroke-dasharray="6 1.5 1 1.5" stroke-width="0.5"' : 'stroke-width="1.4"');
  return `<svg viewBox="${x0} ${-y1} ${x1 - x0} ${y1 - y0}" width="180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="3 vues">${ls.map((x) => (x.t === 'l' ? `<line x1="${x.x1}" y1="${-x.y1}" x2="${x.x2}" y2="${-x.y2}" stroke="#111" ${trait(x)}/>` : `<circle cx="${x.cx}" cy="${-x.cy}" r="${x.r}" fill="none" stroke="#111" ${trait(x)}/>`)).join('')}</svg>`;
}

/** Examens rendus (planche libre), du plus récent au plus ancien. */
function examensFaits() {
  const t = stockage.lire('planches', {}) || {};
  return Object.values(t).filter((pl) => pl?.exo?.examen?.fini).sort((a, b) => (b.exo.examen.fin || 0) - (a.exo.examen.fin || 0));
}

/** Exercices corrigés dans la planche libre (mode 'vues' ou 'cotes') : nombre et moyenne des meilleurs scores. */
function statsVues(mode = 'vues') {
  const t = stockage.lire('planches', {}) || {};
  const s = Object.values(t).filter((pl) => pl?.exo && !pl.exo.cat && (pl.exo.mode || 'vues') === mode).map((pl) => pl.exo.score).filter((v) => typeof v === 'number');
  return { n: s.length, moy: s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : 0 };
}

export async function vueAtelier(el, params = []) {
  const m = matiere(MID);
  if (!m) throw new Error('Matière « dessin » introuvable.');
  const [cid, eid] = params;
  if (cid === 'libre') return vuePlancheLibre(el, eid);
  if (cid) { location.replace('#/dessin'); return null; }   // anciennes adresses (ancien dessin sur grille)
  razAncien();

  const etats = EXERCICES.map((e) => etatExo(e.id));
  const faits = etats.filter((x) => x?.score != null);
  const reussis = faits.filter((x) => x.score >= REUSSI).length;
  const moyenne = faits.length ? Math.round(faits.reduce((a, x) => a + x.score, 0) / faits.length) : null;
  const prochaine = EXERCICES.find((e, i) => !(etats[i]?.score >= REUSSI));
  const carte = (e) => {
    const st = etats[EXERCICES.indexOf(e)];
    const badge = st?.score != null ? `<span class="badge ex-${st.score >= REUSSI ? 'ok' : st.score >= 50 ? 'mid' : 'ko'}">${st.score >= REUSSI ? 'Réussi' : 'À reprendre'} · ${st.score} %</span>` : st ? '<span class="badge">Commencé</span>' : '<span class="badge">À faire</span>';
    return `<a class="panel at-carte" href="#/dessin/libre/cat-${esc(e.id)}">
      <div class="at-img fig">${vignette(e)}</div>
      <div class="at-txt">
        <div class="at-l1"><span class="ex-niv">${'★'.repeat(e.niveau)}${'☆'.repeat(3 - e.niveau)}</span>${badge}</div>
        <b>${esc(e.titre)}</b>
        <span class="muted">${esc(NOMS_MODES[e.mode])}</span>
      </div></a>`;
  };

  el.innerHTML = `
    <div class="mc" ${styleMatiere(m)}>
      <div class="crumb"><a href="#/">Accueil</a><span class="crumb-sep">›</span><a href="#/m/${esc(m.id)}">${esc(m.nom)}</a><span class="crumb-sep">›</span><span>Atelier de dessin</span></div>
      <div class="page-head">
        <span class="m-ic">${icone('crayon')}</span>
        <div><h2>Atelier de dessin</h2><p class="muted">Dessine sur une vraie planche en mm (logiciel de DAO de l'appli) : correction automatique, solution, impression à l'échelle.</p></div>
      </div>
      ${ongletsMatiere(m, 'atelier')}
      <div class="at-stats">
        <div class="panel"><div class="big">${EXERCICES.length}</div>exercices</div>
        <div class="panel"><div class="big">${faits.length}</div>corrigés</div>
        <div class="panel"><div class="big ok">${reussis}</div>réussis (≥ ${REUSSI} %)</div>
        <div class="panel"><div class="big">${moyenne == null ? '–' : `${moyenne} %`}</div>score moyen</div>
      </div>
      ${prochaine ? `<a class="btn primary at-go" href="#/dessin/libre/cat-${esc(prochaine.id)}">${icone('crayon')} ${faits.length ? 'Continuer' : 'Commencer'} : ${esc(prochaine.titre)}</a>` : '<p class="notice info">Tous les exercices sont réussis, bravo ! Entraîne-toi avec les pièces au hasard ou le mode examen.</p>'}
      ${SERIES.map((sr, n) => `<section class="at-serie">
        <h3>${n + 1}. ${esc(sr.titre)}</h3>
        <p class="muted">${esc(sr.intro)}</p>
        <div class="at-grille">${sr.exos.map(carte).join('')}</div>
      </section>`).join('')}
      <section class="panel at-cahier">
        <div><h3>Cahier imprimable</h3>
          <p class="muted">Les ${CAHIER.length} exercices ci-dessus en version papier (A4, un exercice par page, écriture normalisée au début), pour toi ou pour la classe. À l'impression, choisis <b>« Taille réelle » / « 100 % »</b> (pas « Ajuster à la page ») : les cotes mesurent alors leur vraie longueur. Choisis « Enregistrer en PDF » pour obtenir le fichier.</p></div>
        <div class="at-hasard-b">
          <button class="btn primary" type="button" data-cahier="ex">Imprimer le cahier</button>
          <button class="btn" type="button" data-cahier="cor">Imprimer les corrigés</button>
        </div>
      </section>
      <section class="panel at-hasard">
        <div><h3>${icone('melanger')} Pièces au hasard et planche libre</h3>
          <p class="muted">Feuille A4 ou A3 en mm, avec cadre, cartouche, cotes, hachures… Exercices corrigés automatiquement : dessiner les 3 vues d'une pièce vue en perspective (au ½ mm près), les coter, dessiner une coupe (entière, demi, locale), une section ou une perspective.${(() => { const t = [['vues', 'vues'], ['cotes', 'cotation'], ['coupe', 'coupe'], ['demi', 'demi-coupe'], ['section', 'section'], ['locale', 'coupe locale'], ['iso', 'isométrique'], ['cav', 'cavalière']].map(([m, l]) => { const r = statsVues(m); return r.n ? `${l} : <b>${r.n}</b> exercice${r.n > 1 ? 's' : ''}, moyenne <b>${r.moy} %</b>` : ''; }).filter(Boolean); return t.length ? ` Tes scores — ${t.join(' · ')}.` : ''; })()}</p></div>
        <div class="at-hasard-b">
          <a class="btn primary" href="#/dessin/libre">${icone('crayon')} Ouvrir la planche</a>
          <span class="at-hl">3 vues</span>
          ${[1, 2, 3].map((n) => `<a class="btn" href="#/dessin/libre/h${n}-${grainePiece()}" title="Dessine les 3 vues d'une pièce au hasard, niveau ${n}">${'★'.repeat(n)}</a>`).join('')}
          <span class="at-hl">Cotation</span>
          ${[1, 2, 3].map((n) => `<a class="btn" href="#/dessin/libre/cotes-h${n}-${grainePiece()}" title="Cote les 3 vues d'une pièce au hasard, niveau ${n}">${'★'.repeat(n)}</a>`).join('')}
          <span class="at-hl">Coupe A-A</span>
          ${[1, 2, 3].map((n) => `<a class="btn" href="#/dessin/libre/coupe-h${n}-${grainePiece()}" title="Dessine la vue de face coupée (A-A) d'une pièce au hasard, niveau ${n}">${'★'.repeat(n)}</a>`).join('')}
          <span class="at-hl">Demi-coupe</span>
          ${[1, 2, 3].map((n) => `<a class="btn" href="#/dessin/libre/demi-s${n}-${grainePiece()}" title="Demi-coupe A-A d'une pièce symétrique au hasard, niveau ${n}">${'★'.repeat(n)}</a>`).join('')}
          <span class="at-hl">Section</span>
          ${[1, 2, 3].map((n) => `<a class="btn" href="#/dessin/libre/section-h${n}-${grainePiece()}" title="Section sortie B-B d'une pièce au hasard, niveau ${n}">${'★'.repeat(n)}</a>`).join('')}
          <span class="at-hl">Isométrique</span>
          ${[1, 2, 3].map((n) => `<a class="btn" href="#/dessin/libre/iso-h${n}-${grainePiece()}" title="Perspective isométrique d'une pièce au hasard, niveau ${n}">${'★'.repeat(n)}</a>`).join('')}
          <span class="at-hl">Cavalière</span>
          ${[1, 2, 3].map((n) => `<a class="btn" href="#/dessin/libre/cav-h${n}-${grainePiece()}" title="Perspective cavalière d'une pièce au hasard, niveau ${n}">${'★'.repeat(n)}</a>`).join('')}
          <span class="at-hl">Coupe locale</span>
          ${[1, 2, 3].map((n) => `<a class="btn" href="#/dessin/libre/locale-h${n}-${graineTrouVertical(n)}" title="Coupe locale autour d'un trou, pièce au hasard, niveau ${n}">${'★'.repeat(n)}</a>`).join('')}
        </div>
      </section>
      <section class="panel at-hasard at-exam">
        <div><h3>${icone('chrono')} Mode examen</h3>
          <p class="muted">Un exercice tiré au hasard, chronométré, sans solution ni correction avant d'avoir rendu la copie. La première correction donne la note.</p>
          ${(() => { const h = examensFaits(); return h.length ? `<ul class="at-exam-h">${h.slice(0, 5).map((pl) => `<li>${esc(pl.cartouche?.titre || '')} — <b>${pl.exo.examen.note ?? '?'} %</b> · ${pl.exo.examen.temps} / ${pl.exo.examen.duree} min · ${new Date(pl.exo.examen.fin).toLocaleDateString('fr-BE')}</li>`).join('')}</ul>` : ''; })()}</div>
        <form class="at-hasard-b at-exam-f">
          <select class="field" name="type" aria-label="Type d'exercice">
            <option value="hasard">Type au hasard</option><option value="vues">3 vues</option><option value="cotes">Cotation</option><option value="coupe">Coupe A-A</option><option value="demi">Demi-coupe</option><option value="section">Section</option><option value="locale">Coupe locale</option><option value="iso">Isométrique</option><option value="cav">Cavalière</option>
          </select>
          <select class="field" name="niv" aria-label="Niveau"><option value="1">★</option><option value="2" selected>★★</option><option value="3">★★★</option></select>
          <select class="field" name="duree" aria-label="Durée"><option value="20">20 min</option><option value="30" selected>30 min</option><option value="45">45 min</option><option value="60">60 min</option></select>
          <button class="btn primary" type="submit">Commencer</button>
        </form>
      </section>
    </div>`;
  el.querySelectorAll('[data-cahier]').forEach((b) => b.addEventListener('click', () => imprimerCahier({ corriges: b.dataset.cahier === 'cor' })));
  el.querySelector('.at-exam-f')?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target), n = +f.get('niv');
    let type = f.get('type');
    if (type === 'hasard') { const t = ['vues', 'cotes', 'coupe', 'demi', 'section', 'locale', 'iso', 'cav']; type = t[Math.floor(Math.random() * t.length)]; }
    const id = type === 'demi' ? `s${n}-${grainePiece()}` : type === 'locale' ? `h${n}-${graineTrouVertical(n)}` : `h${n}-${grainePiece()}`;
    location.hash = `#/dessin/libre/exam-${f.get('duree')}-${type}-${id}`;
  });
  return null;
}
