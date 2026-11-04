/* =====================================================================
   VUE ACCUEIL — reprendre, à revoir, matières avec progression
   ===================================================================== */

import { esc, pluriel, formatDate } from '../utils.js';
import { icone } from '../icones.js';
import { styleMatiere, profilDe } from '../matieres.js';
import { matieres, totaux, dateContenu } from '../store.js';
import { notesExos, notesCartes, derniereVisite, bilan } from '../suivi.js';

const NOTE = { mid: ['Presque', 'mid'], ko: ['Faux', 'ko'] };

/** Lien vers un exercice à partir de sa clé « matière/chapitre/exercice ». */
function lienExo(cle) {
  const [mid, cid, ...r] = cle.split('/'); const eid = r.join('/');
  if (mid === 'dessin' && cid === 'hasard') return `#/dessin/hasard/${eid}`;
  if (cid === 'schemas') return `#/m/${mid}/schemas/${eid}`;
  return `#/m/${mid}/${cid}/exercices/${eid}`;
}

export function vueAccueil(el) {
  const liste = matieres();
  const der = derniereVisite();
  const nomChap = (mid, cid) => {
    const m = liste.find((x) => x.id === mid);
    if (cid === 'schemas') return [m, 'Exercices sur schéma'];
    if (cid === 'hasard') return [m, 'Pièce au hasard'];
    return [m, m?.chapitres.find((c) => c.id === cid)?.titre || cid];
  };

  // ---- à revoir : exercices Faux / Presque (les plus récents d'abord) + flashcards ratées
  const ex = Object.entries(notesExos()).filter(([, n]) => n.r !== 'ok')
    .sort((a, b) => String(b[1].d).localeCompare(String(a[1].d))).slice(0, 8);
  const fc = {};
  for (const [k, n] of Object.entries(notesCartes())) {
    if (n.r !== 'ko') continue;
    const [mid, cid] = k.split('/'); const c = `${mid}/${cid}`; fc[c] = (fc[c] || 0) + 1;
  }
  const revoir = [
    ...ex.map(([k, n]) => {
      const [mid, cid] = k.split('/'); const [m, ch] = nomChap(mid, cid);
      return `<a class="rv-l mc" ${m ? styleMatiere(m) : ''} href="${lienExo(k)}">
        <span class="badge ex-${NOTE[n.r][1]}">${NOTE[n.r][0]}</span>
        <span><b>${esc(n.t || 'Exercice')}</b><span class="muted">${esc(m?.court || m?.nom || '')} · ${esc(ch)}</span></span>${icone('fleche-d')}</a>`;
    }),
    ...Object.entries(fc).map(([c, nb]) => {
      const [mid, cid] = c.split('/'); const [m, ch] = nomChap(mid, cid);
      return `<a class="rv-l mc" ${m ? styleMatiere(m) : ''} href="#/m/${esc(mid)}/${esc(cid)}/flashcards/revoir">
        <span class="badge ex-ko">${icone('cartes')} ${nb}</span>
        <span><b>${pluriel(nb, 'flashcard')} à revoir</b><span class="muted">${esc(m?.court || m?.nom || '')} · ${esc(ch)}</span></span>${icone('fleche-d')}</a>`;
    }),
  ];

  const tuiles = liste.map((m) => {
    const t = totaux(m);
    const nbEx = t.exercices + (m.schemas?.nb || 0);
    const b = bilan(m.id);
    const pct = nbEx ? Math.round(100 * b.reussis / nbEx) : 0;
    return `
      <a class="panel tile mc" ${styleMatiere(m)} href="#/m/${esc(m.id)}">
        <span class="m-ic">${icone(m.icone)}</span>
        <div class="tile-body">
          <h3>${esc(m.nom)}</h3>
          <p>${pluriel(t.chapitres, 'chapitre')} · ${pluriel(t.flashcards, 'flashcard')} · ${pluriel(nbEx, 'exercice')}</p>
          <div class="prog" title="${b.reussis} exercices réussis sur ${nbEx}"><div style="width:${pct}%"></div></div>
          <p class="prog-t">${b.faits ? `${b.reussis} / ${nbEx} exercices réussis${b.aRefaire ? ` · <b>${b.aRefaire} à refaire</b>` : ''}` : 'Pas encore commencé'}</p>
        </div>
      </a>`;
  }).join('');

  el.innerHTML = `
    <section class="hero">
      <h1>Mes révisions</h1>
      <p class="muted">Synthèses, flashcards et exercices corrigés pour chaque chapitre.</p>
    </section>
    ${der ? `<a class="panel continuer" href="${esc(der.h)}">
      <span class="m-ic">${icone('fleche-d')}</span>
      <span><span class="muted">Continuer où tu t'es arrêté</span><b>${esc(der.t)}</b>${der.s ? `<span class="muted">${esc(der.s)}</span>` : ''}</span></a>` : ''}
    ${revoir.length ? `<section class="panel rv">
      <h3>${icone('revoir')} À revoir</h3>
      <div class="rv-liste">${revoir.join('')}</div></section>` : ''}
    ${liste.length
      ? `<div class="tiles big">${tuiles}</div>`
      : `<div class="panel empty"><div class="m-ic">${icone('livre')}</div><h3>Aucune matière</h3>
         <p class="muted">Le fichier content/index.json ne contient encore aucune matière.</p></div>`}
    <a class="panel continuer exam-lien" href="#/examen"><span class="m-ic">${icone('examen')}</span>
      <span><b>Examen blanc</b><span class="muted">Exercices au hasard, chronométrés</span></span></a>
    <div class="two-cols">
      <div class="panel">
        <h3>Comment réviser avec l'appli</h3>
        <ul>
          <li><b>Synthèse</b> : l'essentiel du chapitre, avec les définitions, formules et pièges fréquents.</li>
          <li><b>Flashcards</b> : retourne la carte, puis indique si tu savais. Les cartes ratées reviennent dans « À revoir ».</li>
          <li><b>Exercices</b> : résous sur ta feuille, regarde la réponse et le développement, puis note-toi.</li>
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
