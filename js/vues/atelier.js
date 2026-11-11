/* =====================================================================
   VUE ATELIER DE DESSIN — tous les exercices « à dessiner » réunis
   ---------------------------------------------------------------------
   #/dessin                       galerie (filtres, progression)
   #/dessin/<chapitre>/<exercice> planche de l'exercice (lecteur commun)
   #/dessin/hasard/<type>-<niveau>-<graine>  pièce générée au hasard (vue ou coupe)
   #/dessin/libre                 planche libre (nouveau moteur en mm, js/dao/)
   Les notes sont les mêmes que dans l'onglet Exercices du chapitre.
   ===================================================================== */

import { ongletsMatiere } from './schemas.js';
import { esc, stockage } from '../utils.js';
import { icone } from '../icones.js';
import { styleMatiere } from '../matieres.js';
import { matiere, chargerChapitre } from '../store.js';
import { sourcesDe } from '../synthese.js';
import { svgSur } from '../rendu.js';
import { lecteurExercices, noteExo, preparerDessin } from '../exercices.js';
import { pieceAuHasard, CONSIGNES } from '../geometrie.js';
import { monterPiece3D } from '../piece3d.js';
import { niveauAide, AIDES } from '../planche.js';
import { vuePlancheLibre, grainePiece } from './planche-libre.js';
import { graineTrouVertical } from '../dao/pieces.js';

const MID = 'dessin';
const NOTES = { ok: ['Réussi', 'ok'], mid: ['Presque', 'mid'], ko: ['À refaire', 'ko'] };

/** Tous les exercices de dessin de la matière, dans l'ordre des chapitres. */
async function tousLesExercices() {
  const m = matiere(MID);
  if (!m) return { m: null, exos: [] };
  const exos = [];
  for (const c of m.chapitres) {
    if (!c.nb?.exercices) continue;
    let ch;
    try { ch = await chargerChapitre(MID, c.id); } catch { continue; }
    const docs = sourcesDe(ch);
    for (const e of ch.exercices) {
      if (e.type !== 'dessin') continue;
      exos.push({ ...preparerDessin(e), _cle: `${MID}/${c.id}/${e.id}`, _docs: docs, _chap: c, _num: m.chapitres.indexOf(c) + 1 });
    }
  }
  return { m, exos };
}

const NOM_TACHE = { face: 'Vue de face', gauche: 'Vue de gauche', dessus: 'Vue de dessus', caches: 'Arêtes cachées', coupe: 'Coupe A-A' };
const tacheDe = (e) => NOM_TACHE[e.tache ? (e.tache.type === 'vue' ? e.tache.vue : e.tache.type) : (e.piece?.vue || 'caches')];
const nouvelleGraine = () => 1 + Math.floor(Math.random() * 99999);
const lienHasard = (type, niv, g = nouvelleGraine()) => `#/dessin/hasard/${type}-${niv}-${g}`;

/** Exercice construit à partir d'une graine (toujours la même pièce pour une même graine). */
function exerciceAuHasard(code) {
  const [, type, niv, g] = /^(vue|coupe)-([123])-(\d{1,6})$/.exec(code || '') || [];
  if (!type) return null;
  const r = pieceAuHasard(+g, +niv, type);
  if (!r) return null;
  const nomT = r.tache.type === 'vue' ? r.tache.vue : r.tache.type;
  return preparerDessin({
    id: `h-${code}`, _cle: `${MID}/hasard/${code}`, type: 'dessin', niveau: +niv, complement: true,
    titre: `Pièce n° ${g} · ${NOM_TACHE[nomT]}`, consigne: CONSIGNES[nomT],
    indice: type === 'coupe' ? 'Le plan A-A (vue de dessus) passe par l\'axe du trou. On enlève la partie **avant** de la pièce, on dessine ce qu\'on voit **derrière** le plan et on **hachure** la matière coupée.'
      : 'Repère d\'abord les formes (entailles, marches, rainures, trous) sur la pièce 3D, puis reporte hauteurs et profondeurs avec les lignes de rappel et la ligne à 45°.',
    piece: r.piece, tache: r.tache, _type: type,
  });
}

/** Examens rendus (planche libre), du plus récent au plus ancien. */
function examensFaits() {
  const t = stockage.lire('planches', {}) || {};
  return Object.values(t).filter((pl) => pl?.exo?.examen?.fini).sort((a, b) => (b.exo.examen.fin || 0) - (a.exo.examen.fin || 0));
}

/** Exercices corrigés dans la planche libre (mode 'vues' ou 'cotes') : nombre et moyenne des meilleurs scores. */
function statsVues(mode = 'vues') {
  const t = stockage.lire('planches', {}) || {};
  const s = Object.values(t).filter((pl) => pl?.exo && (pl.exo.mode || 'vues') === mode).map((pl) => pl.exo.score).filter((v) => typeof v === 'number');
  return { n: s.length, moy: s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : 0 };
}

export async function vueAtelier(el, params = []) {
  const { m, exos } = await tousLesExercices();
  if (!m) throw new Error('Matière « dessin » introuvable.');
  const [cid, eid] = params;
  if (cid === 'libre') return vuePlancheLibre(el, eid);

  if (cid === 'hasard') {   // ---------- pièce au hasard
    const e = exerciceAuHasard(eid);
    if (!e) { location.hash = '#/dessin'; return null; }
    el.innerHTML = `
      <div class="mc" ${styleMatiere(m)}>
        <div class="crumb"><a href="#/">Accueil</a><span class="crumb-sep">›</span><a href="#/dessin">Atelier de dessin</a><span class="crumb-sep">›</span><span>Pièce au hasard</span></div>
        <div class="atelier-retour">
          <a class="btn" href="#/dessin">${icone('fleche-g')} Toutes les planches</a>
          <a class="btn primary" href="${lienHasard(e._type, e.niveau)}" title="Une autre pièce du même niveau">${icone('melanger')} Nouvelle pièce</a>
          <span class="muted">Note le n° ${esc(eid.split('-')[2])} pour la retrouver (même n° = même pièce).</span>
        </div>
        <div id="atelier-lecteur"></div>
      </div>`;
    lecteurExercices(el.querySelector('#atelier-lecteur'), [e], { prefixe: MID });
    return null;
  }

  if (cid && eid) {   // ---------- planche d'un exercice
    el.innerHTML = `
      <div class="mc" ${styleMatiere(m)}>
        <div class="crumb"><a href="#/">Accueil</a><span class="crumb-sep">›</span><a href="#/dessin">Atelier de dessin</a><span class="crumb-sep">›</span><span>Exercice</span></div>
        <div class="atelier-retour"><a class="btn" href="#/dessin">${icone('fleche-g')} Toutes les planches</a></div>
        <div id="atelier-lecteur"></div>
      </div>`;
    lecteurExercices(el.querySelector('#atelier-lecteur'), exos, { prefixe: MID, debut: `${MID}/${cid}/${eid}` });
    return null;
  }

  // ---------- galerie
  const filtre = stockage.lire('atelier.filtre', 'tous');
  const notes = exos.map((e) => noteExo(e._cle));
  const faits = notes.filter(Boolean);
  const reussis = faits.filter((n) => n.r === 'ok').length;
  const moyenne = faits.length ? Math.round(faits.reduce((s, n) => s + (n.pct ?? { ok: 100, mid: 50, ko: 0 }[n.r]), 0) / faits.length) : null;
  const FILTRES = [['tous', 'Toutes'], ['afaire', 'Pas encore faites'], ['refaire', 'À refaire'], ['reussi', 'Réussies'], ['n1', '★'], ['n2', '★★'], ['n3', '★★★']];
  const garde = (e, n) => ({
    afaire: !n, refaire: n && n.r !== 'ok', reussi: n?.r === 'ok',
    n1: (e.niveau || 1) === 1, n2: e.niveau === 2, n3: e.niveau === 3,
  }[filtre] ?? true);

  const carte = (e, i) => {
    const n = notes[i];
    const etoiles = '★'.repeat(e.niveau || 1) + '☆'.repeat(3 - (e.niveau || 1));
    const tache = tacheDe(e);
    return `<a class="panel at-carte" href="#/dessin/${esc(e._chap.id)}/${esc(e.id)}">
      <div class="at-img fig" ${e.piece ? `data-mini="${i}"` : ''}>${!e.piece && e.perspective ? svgSur(e.perspective) : ''}</div>
      <div class="at-txt">
        <div class="at-l1"><span class="ex-niv">${etoiles}</span>${n ? `<span class="badge ex-${NOTES[n.r][1]}">${NOTES[n.r][0]}${n.pct != null ? ` · ${n.pct} %` : ''}</span>` : '<span class="badge">À faire</span>'}</div>
        <b>${esc(e.titre)}</b>
        <span class="muted">${tache} · ch. ${e._num}</span>
        ${n?.aide ? `<span class="muted at-aide">aides : ${esc(AIDES[n.aide]?.nom || n.aide)}</span>` : ''}
      </div></a>`;
  };
  const nbHasard = Object.keys(stockage.lire('exos', {})).filter((k) => k.startsWith(`${MID}/hasard/`)).length;
  const visibles = exos.map((e, i) => [e, i]).filter(([e, i]) => garde(e, notes[i]));

  el.innerHTML = `
    <div class="mc" ${styleMatiere(m)}>
      <div class="crumb"><a href="#/">Accueil</a><span class="crumb-sep">›</span><a href="#/m/${esc(m.id)}">${esc(m.nom)}</a><span class="crumb-sep">›</span><span>Atelier de dessin</span></div>
      <div class="page-head">
        <span class="m-ic">${icone('crayon')}</span>
        <div><h2>Atelier de dessin</h2><p class="muted">Dessine les vues directement dans l'appli : correction automatique et expliquée.</p></div>
      </div>
      ${ongletsMatiere(m, 'atelier')}
      <div class="at-stats">
        <div class="panel"><div class="big">${exos.length}</div>planches</div>
        <div class="panel"><div class="big">${faits.length}</div>faites</div>
        <div class="panel"><div class="big ok">${reussis}</div>réussies</div>
        <div class="panel"><div class="big">${moyenne == null ? '–' : `${moyenne} %`}</div>score moyen</div>
      </div>
      <div class="at-barre">
        <div class="at-filtres" role="radiogroup" aria-label="Filtrer">
          ${FILTRES.map(([v, l]) => `<label class="chip"><input type="radio" name="atf" value="${v}" ${v === filtre ? 'checked' : ''}><span>${l}</span></label>`).join('')}
        </div>
        <span class="muted">Niveau d'aide actuel : <b>${AIDES[niveauAide()].nom}</b> (modifiable dans chaque planche)</span>
      </div>
      ${(() => {
        const prochaine = exos.find((e, i) => !notes[i]) || exos.find((e, i) => notes[i]?.r !== 'ok');
        return prochaine ? `<a class="btn primary at-go" href="#/dessin/${esc(prochaine._chap.id)}/${esc(prochaine.id)}">${icone('crayon')} ${faits.length ? 'Continuer' : 'Commencer'} : ${esc(prochaine.titre)}</a>` : '<p class="notice info">Toutes les planches sont réussies, bravo ! Essaie-les en aides « Difficile ».</p>';
      })()}
      <section class="panel at-hasard">
        <div><h3>${icone('melanger')} Pièces au hasard</h3>
          <p class="muted">Une nouvelle pièce à chaque fois, corrigée automatiquement : pour s'entraîner sans fin.${nbHasard ? ` Tu en as déjà fait <b>${nbHasard}</b>.` : ''}</p></div>
        <div class="at-hasard-b">
          <span class="at-hl">Vues</span>
          ${[1, 2, 3].map((n) => `<a class="btn" href="${lienHasard('vue', n)}">${'★'.repeat(n)}</a>`).join('')}
          <span class="at-hl">Coupes</span>
          ${[1, 2, 3].map((n) => `<a class="btn" href="${lienHasard('coupe', n)}">${'★'.repeat(n)}</a>`).join('')}
        </div>
      </section>
      <section class="panel at-hasard">
        <div><h3>${icone('regle')} Planche libre (mini-DAO)</h3>
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
      <div class="at-grille">${visibles.length ? visibles.map(([e, i]) => carte(e, i)).join('') : '<p class="muted">Aucune planche pour ce filtre.</p>'}</div>
      <p class="muted at-note">D'autres planches (plans inclinés, cylindres, cotation) viendront s'ajouter ici.</p>
    </div>`;
  el.querySelectorAll('[data-mini]').forEach((z) => { const e = exos[+z.dataset.mini]; if (e?.piece) monterPiece3D(z, e.piece, { rotation: false }); });
  el.querySelector('.at-exam-f')?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target), n = +f.get('niv');
    let type = f.get('type');
    if (type === 'hasard') { const t = ['vues', 'cotes', 'coupe', 'demi', 'section', 'locale', 'iso', 'cav']; type = t[Math.floor(Math.random() * t.length)]; }
    const id = type === 'demi' ? `s${n}-${grainePiece()}` : type === 'locale' ? `h${n}-${graineTrouVertical(n)}` : `h${n}-${grainePiece()}`;
    location.hash = `#/dessin/libre/exam-${f.get('duree')}-${type}-${id}`;
  });
  el.querySelectorAll('input[name=atf]').forEach((r) => r.addEventListener('change', () => { stockage.ecrire('atelier.filtre', r.value); vueAtelier(el, params); }));
  return null;
}
