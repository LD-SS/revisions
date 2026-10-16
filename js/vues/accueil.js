/* =====================================================================
   VUE ACCUEIL — tuiles des matières
   ===================================================================== */

import { esc, pluriel, formatDate } from '../utils.js';
import { icone } from '../icones.js';
import { styleMatiere, profilDe } from '../matieres.js';
import { matieres, totaux, dateContenu } from '../store.js';

export function vueAccueil(el) {
  const liste = matieres();
  const tuiles = liste.map((m) => {
    const t = totaux(m);
    const exemple = m.chapitres.length && m.chapitres.every((c) => c.exemple);
    return `
      <a class="panel tile mc" ${styleMatiere(m)} href="#/m/${esc(m.id)}">
        <span class="m-ic">${icone(m.icone)}</span>
        <div class="tile-body">
          <h3>${esc(m.nom)}</h3>
          <p>${esc(profilDe(m).description)}</p>
          <div class="tile-stats">
            <span class="badge">${pluriel(t.chapitres, 'chapitre')}</span>
            <span class="badge">${pluriel(t.flashcards, 'flashcard')}</span>
            ${t.exercices ? `<span class="badge">${pluriel(t.exercices, 'exercice')}</span>` : ''}
            ${exemple ? '<span class="badge warn">Exemple</span>' : ''}
          </div>
        </div>
      </a>`;
  }).join('');

  el.innerHTML = `
    <section class="hero">
      <h1>Mes révisions</h1>
      <p class="muted">Choisis une matière, puis un chapitre : synthèse du cours, flashcards et, bientôt,
      exercices corrigés, examens blancs et planning de révision.</p>
    </section>
    ${liste.length
      ? `<div class="tiles big">${tuiles}</div>`
      : `<div class="panel empty"><div class="m-ic">${icone('livre')}</div><h3>Aucune matière</h3>
         <p class="muted">Le fichier content/index.json ne contient encore aucune matière.</p></div>`}
    <div class="two-cols">
      <div class="panel">
        <h3>Comment réviser avec l'appli</h3>
        <ul>
          <li><b>Synthèse</b> : l'essentiel du chapitre, avec les définitions, formules et pièges fréquents.</li>
          <li><b>Flashcards</b> : retourne la carte, puis indique si tu savais. Les cartes ratées reviennent.</li>
          <li>La pastille <span class="badge">${icone('page')} p. 4</span> renvoie à la page du PDF de cours.</li>
        </ul>
      </div>
      <div class="panel">
        <h3>Bon à savoir</h3>
        <ul>
          <li>Le contenu est généré à partir des cours avec l'aide d'une IA. Il peut contenir des erreurs : en cas de doute, le cours du professeur fait foi.</li>
          <li>Ta progression reste dans ton navigateur, sur cet appareil.</li>
          ${dateContenu() ? `<li class="muted">Contenu mis à jour le ${esc(formatDate(dateContenu()))}.</li>` : ''}
        </ul>
      </div>
    </div>`;
}
