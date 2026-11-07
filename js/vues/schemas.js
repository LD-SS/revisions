/* =====================================================================
   VUE EXERCICES SUR SCHÉMA — tous les exercices d'une matière qui se font
   sur un schéma électrique, rangés selon ce qu'on y demande
   ---------------------------------------------------------------------
   #/m/<matière>/schemas            galerie par catégorie
   #/m/<matière>/schemas/<exercice> lecteur (exercices de la même catégorie)
   ===================================================================== */

import { esc, stockage, pluriel } from '../utils.js';
import { icone } from '../icones.js';
import { styleMatiere } from '../matieres.js';
import { matiere, chargerSchemas } from '../store.js';
import { sourcesDe, rendreBloc } from '../synthese.js';
import { lecteurExercices, noteExo } from '../exercices.js';
import { monterCircuit } from '../circuit.js';
import { memoriserVisite } from '../suivi.js';

const NOTES = { ok: ['Réussi', 'ok'], mid: ['Presque', 'mid'], ko: ['À refaire', 'ko'] };

/** Onglets « Chapitres | Exercices sur schéma » en tête de la page matière. */
const SANS_GENERATEUR = ['dessin'];   // matières sans (presque) aucune formule
export function ongletsMatiere(m, actif) {
  const atelier = m.id === 'dessin';   // l'atelier de dessin est rangé dans la matière Dessin
  const generateur = !SANS_GENERATEUR.includes(m.id);
  return `<nav class="m-onglets" aria-label="Sections">
    <a class="m-onglet ${actif === 'chapitres' ? 'actif' : ''}" href="#/m/${esc(m.id)}">${icone('synthese')} Chapitres</a>
    ${m.schemas ? `<a class="m-onglet ${actif === 'schemas' ? 'actif' : ''}" href="#/m/${esc(m.id)}/schemas">${icone('eclair')} Exercices sur schéma <span class="badge">${m.schemas.nb || ''}</span></a>` : ''}
    ${atelier ? `<a class="m-onglet ${actif === 'atelier' ? 'actif' : ''}" href="#/dessin">${icone('crayon')} Atelier de dessin</a>` : ''}
    ${generateur ? `<a class="m-onglet ${actif === 'generateur' ? 'actif' : ''}" href="#/m/${esc(m.id)}/generateur">${icone('liste')} Générateur de synthèse</a>` : ''}
  </nav>`;
}

export async function vueSchemas(el, mid, eid) {
  const m = matiere(mid);
  if (!m) throw new Error(`Matière inconnue : « ${mid} ».`);
  const d = await chargerSchemas(mid);
  const docs = sourcesDe(d);
  const pref = `${mid}/schemas`;
  const exos = d.exercices.map((e) => ({ ...e, _cle: `${pref}/${e.id}`, _docs: docs }));
  const cats = d.categories.filter((c) => exos.some((e) => e.cat === c.id));
  const tete = (fin) => `<div class="crumb"><a href="#/">Accueil</a><span class="crumb-sep">›</span><a href="#/m/${esc(m.id)}">${esc(m.nom)}</a><span class="crumb-sep">›</span>${fin}</div>`;

  if (eid) {   // ---------- lecteur
    const e = exos.find((x) => x.id === eid);
    if (!e) { location.hash = `#/m/${mid}/schemas`; return null; }
    const cat = cats.find((c) => c.id === e.cat);
    const liste = exos.filter((x) => x.cat === e.cat);
    memoriserVisite(`#/m/${mid}/schemas/${eid}`, e.titre, `${m.court || m.nom} · Exercices sur schéma`);
    el.innerHTML = `
      <div class="mc" ${styleMatiere(m)}>
        ${tete(`<a href="#/m/${esc(m.id)}/schemas">Exercices sur schéma</a><span class="crumb-sep">›</span><span>${esc(cat?.titre || '')}</span>`)}
        <div class="atelier-retour"><a class="btn" href="#/m/${esc(m.id)}/schemas">${icone('fleche-g')} Tous les schémas</a>
          <span class="muted">${esc(cat?.titre || '')} · ${pluriel(liste.length, 'exercice')}</span></div>
        <div id="sch-lecteur"></div>
      </div>`;
    lecteurExercices(el.querySelector('#sch-lecteur'), liste, { prefixe: pref, debut: e._cle, docs });
    return null;
  }

  // ---------- galerie
  const filtre = stockage.lire('schemas.filtre', 'tous');
  const notes = Object.fromEntries(exos.map((e) => [e.id, noteExo(e._cle)]));
  const faits = Object.values(notes).filter(Boolean);
  const reussis = faits.filter((n) => n.r === 'ok').length;
  const garde = (e) => ({ afaire: !notes[e.id], refaire: notes[e.id] && notes[e.id].r !== 'ok', annoter: !!e.solution }[filtre] ?? true);
  const FILTRES = [['tous', 'Tous'], ['afaire', 'Pas encore faits'], ['refaire', 'À refaire'], ['annoter', 'À annoter sur le schéma']];
  const origine = (e) => (e.origine?.labo ? 'Labo simulateur' : `Feuille d'exercices p. ${e.page}`);

  const carte = (e) => {
    const n = notes[e.id];
    const et = '★'.repeat(e.niveau || 1) + '☆'.repeat(3 - (e.niveau || 1));
    return `<a class="panel at-carte" href="#/m/${esc(m.id)}/schemas/${esc(e.id)}">
      <div class="at-img sch-mini" data-mini="${esc(e.id)}"></div>
      <div class="at-txt">
        <div class="at-l1"><span class="ex-niv">${et}</span>${n ? `<span class="badge ex-${NOTES[n.r][1]}">${NOTES[n.r][0]}</span>` : '<span class="badge">À faire</span>'}</div>
        <b>${esc(e.titre)}</b>
        <span class="muted">${esc(origine(e))}${e.solution ? ' · à annoter' : ''}</span>
      </div></a>`;
  };
  const ouverts = new Set(stockage.lire('schemas.ouverts', []));
  const sections = cats.map((c) => {
    const l = exos.filter((e) => e.cat === c.id && garde(e));
    if (!l.length) return '';
    const fc = exos.filter((e) => e.cat === c.id);
    const ok = fc.filter((e) => notes[e.id]?.r === 'ok').length;
    const ko = fc.filter((e) => notes[e.id] && notes[e.id].r !== 'ok').length;
    return `<details class="panel sch-cat" data-cat="${esc(c.id)}" ${ouverts.has(c.id) || filtre !== 'tous' ? 'open' : ''}>
      <summary><span class="sch-cat-t"><b>${esc(c.titre)}</b><span class="muted">${ok} / ${fc.length} réussis${ko ? ` · ${ko} à refaire` : ''}</span></span>
        <span class="prog"><span style="width:${Math.round(100 * ok / fc.length)}%"></span></span></summary>
      <p class="muted">${esc(c.desc || '')}</p>
      <div class="at-grille">${l.map(carte).join('')}</div></details>`;
  }).join('');
  const prochaine = exos.find((e) => !notes[e.id]) || exos.find((e) => notes[e.id]?.r !== 'ok');

  el.innerHTML = `
    <div class="mc" ${styleMatiere(m)}>
      ${tete('<span>Exercices sur schéma</span>')}
      <div class="page-head">
        <span class="m-ic">${icone(m.icone)}</span>
        <div><h1>${esc(m.nom)}</h1><p class="muted">${esc(d.intro || '')}</p></div>
      </div>
      ${ongletsMatiere(m, 'schemas')}
      <div class="at-stats">
        <div class="panel"><div class="big">${exos.length}</div>exercices</div>
        <div class="panel"><div class="big">${exos.filter((e) => e.solution).length}</div>à annoter</div>
        <div class="panel"><div class="big">${faits.length}</div>faits</div>
        <div class="panel"><div class="big ok">${reussis}</div>réussis</div>
      </div>
      ${d.synthese?.length ? `<details class="panel sch-methode"><summary><b>${icone('ampoule')} Méthode et conventions</b> <span class="muted">(appareils de mesure, sens des flèches)</span></summary>
        ${d.synthese.map((s) => `<h4>${esc(s.titre)}</h4>${(s.blocs || []).map((b) => rendreBloc({ ...b, pages: null, doc: null })).join('')}`).join('')}</details>` : ''}
      <div class="at-barre"><div class="at-filtres" role="radiogroup" aria-label="Filtrer">
        ${FILTRES.map(([v, l]) => `<label class="chip"><input type="radio" name="schf" value="${v}" ${v === filtre ? 'checked' : ''}><span>${l}</span></label>`).join('')}
      </div></div>
      ${prochaine ? `<a class="btn primary at-go" href="#/m/${esc(m.id)}/schemas/${esc(prochaine.id)}">${icone('exercices')} ${faits.length ? 'Continuer' : 'Commencer'} : ${esc(prochaine.titre)}</a>` : '<p class="notice info">Tous les exercices sont réussis, bravo !</p>'}
      ${sections || '<p class="muted">Aucun exercice pour ce filtre.</p>'}
    </div>`;

  const miniatures = (racine) => {
    for (const z of racine.querySelectorAll('[data-mini]:not([data-fait])')) {
      const e = exos.find((x) => x.id === z.dataset.mini); z.dataset.fait = '1';
      try { monterCircuit(z, e, { apercu: true }); } catch (err) { console.warn(err); }
    }
  };
  el.querySelectorAll('.sch-cat[open]').forEach(miniatures);
  el.querySelectorAll('.sch-cat').forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) miniatures(d);
    const o = new Set(stockage.lire('schemas.ouverts', [])); d.open ? o.add(d.dataset.cat) : o.delete(d.dataset.cat);
    stockage.ecrire('schemas.ouverts', [...o]);
  }));
  el.querySelector('.at-filtres').addEventListener('change', (ev) => {
    stockage.ecrire('schemas.filtre', ev.target.value); vueSchemas(el, mid);
  });
  return null;
}
