/* =====================================================================
   VUE CHAPITRE — en-tête + onglets Synthèse / Flashcards / Exercices
   ---------------------------------------------------------------------
   Adresse : #/m/<matière>/<chapitre>/<onglet>   (onglet par défaut : synthese)
   Pour ajouter un onglet : une entrée dans ONGLETS + son affichage dans afficherOnglet().
   ===================================================================== */

import { esc } from '../utils.js';
import { icone } from '../icones.js';
import { styleMatiere } from '../matieres.js';
import { matiere, infoChapitre, chargerChapitre, voisins } from '../store.js';
import { rendreSynthese, activerSynthese, sourcesDe } from '../synthese.js';
import { lecteurFlashcards } from '../flashcards.js';
import { lecteurExercices } from '../exercices.js';

const ONGLETS = [
  { id: 'synthese', libelle: 'Synthèse', icone: 'synthese' },
  { id: 'flashcards', libelle: 'Flashcards', icone: 'cartes' },
  { id: 'exercices', libelle: 'Exercices', icone: 'exercices' },
];

export async function vueChapitre(el, mid, cid, onglet = 'synthese') {
  const m = matiere(mid);
  const info = infoChapitre(mid, cid);
  if (!m || !info) throw new Error(`Chapitre introuvable : « ${mid}/${cid} ».`);
  if (!ONGLETS.some((o) => o.id === onglet)) onglet = 'synthese';

  const ch = await chargerChapitre(mid, cid);
  const base = `#/m/${esc(m.id)}/${esc(info.id)}`;
  const num = m.chapitres.indexOf(info) + 1;
  const compte = { synthese: ch.synthese.sections.length, flashcards: ch.flashcards.length, exercices: ch.exercices.length };
  const { precedent, suivant } = voisins(mid, cid);

  el.innerHTML = `
    <div class="mc" ${styleMatiere(m)}>
      <div class="crumb">
        <a href="#/">Accueil</a><span class="crumb-sep">›</span>
        <a href="#/m/${esc(m.id)}">${esc(m.nom)}</a><span class="crumb-sep">›</span>
        <span>Chapitre ${num}</span>
      </div>
      <div class="page-head">
        <span class="m-ic">${icone(m.icone)}</span>
        <div><h2>${esc(ch.titre || info.titre)}</h2><p class="muted">${esc(m.nom)} · chapitre ${num}</p></div>
      </div>
      ${ch.exemple || info.exemple ? `<div class="notice">${icone('info')}<div><b>Contenu d'exemple.</b>
        Ce chapitre a été rédigé pour tester l'appli : il ne provient pas d'un PDF de cours. Les numéros de page sont fictifs.</div></div>` : ''}
      <nav class="seg" aria-label="Contenu du chapitre">
        ${ONGLETS.map((o) => `<a href="${base}/${o.id}" class="${o.id === onglet ? 'active' : ''}" ${o.id === onglet ? 'aria-current="page"' : ''}>
          ${icone(o.icone)}${o.libelle}<span class="count">${compte[o.id]}</span></a>`).join('')}
      </nav>
      <div id="onglet"></div>
      <div class="chap-nav">
        ${precedent ? `<a class="btn" href="#/m/${esc(m.id)}/${esc(precedent.id)}/${onglet}">${icone('fleche-g')} ${esc(precedent.titre)}</a>` : '<span></span>'}
        ${suivant ? `<a class="btn" href="#/m/${esc(m.id)}/${esc(suivant.id)}/${onglet}">${esc(suivant.titre)} ${icone('fleche-d')}</a>` : ''}
      </div>
    </div>`;

  return afficherOnglet(el.querySelector('#onglet'), onglet, ch, `${base}/${onglet}`);
}

/** Affiche le contenu de l'onglet ; renvoie une fonction de nettoyage. */
function afficherOnglet(zone, onglet, ch, adresse) {
  switch (onglet) {
    case 'flashcards':
      return lecteurFlashcards(zone, ch.flashcards, { docs: sourcesDe(ch) });
    case 'exercices':
      return lecteurExercices(zone, ch.exercices, { docs: sourcesDe(ch), prefixe: `${ch.matiere}/${ch.id}` });
    default:
      zone.innerHTML = rendreSynthese(ch, adresse);
      return activerSynthese(zone);
  }
}
