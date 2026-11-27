/* =====================================================================
   VUE ACCUEIL — reprendre, à revoir, matières avec progression
   ===================================================================== */

import { esc, pluriel, formatDate } from '../utils.js';
import { icone } from '../icones.js';
import { styleMatiere, profilDe } from '../matieres.js';
import { matieres, totaux, dateContenu } from '../store.js';
import { derniereVisite, bilan, aRefaire, chapitreSchema } from '../suivi.js';

const NOTE = { mid: ['Presque', 'mid'], ko: ['Faux', 'ko'] };

/** Lien vers un exercice à partir de sa clé « matière/chapitre/exercice ». */
function lienExo(cle) {
  const [mid, cid, ...r] = cle.split('/'); const eid = r.join('/');
  if (mid === 'dessin' && cid === 'hasard') return `#/dessin/hasard/${eid}`;
  if (cid === 'schemas') { const c = chapitreSchema(matieres().find((x) => x.id === mid), eid); return c ? `#/m/${mid}/${c}/exercices/sch-${encodeURIComponent(eid)}` : `#/m/${mid}/schemas/${eid}`; }
  if (cid === 'eval') return `#/examen/eval/${mid}/${eid}`;
  return `#/m/${mid}/${cid}/exercices/${eid}`;
}

export function vueAccueil(el) {
  const liste = matieres();
  const der = derniereVisite();
  const nomChap = (mid, cid, k3 = '') => {
    const m = liste.find((x) => x.id === mid);
    if (cid === 'schemas') { const c = chapitreSchema(m, k3); return [m, m?.chapitres.find((x) => x.id === c)?.titre || 'Exercice sur schéma']; }
    if (cid === 'hasard') return [m, 'Pièce au hasard'];
    if (cid === 'eval') return [m, 'Évaluation type'];
    return [m, m?.chapitres.find((c) => c.id === cid)?.titre || cid];
  };

  // ---- exercices à refaire (révision espacée : Faux → 1 jour, Presque → 3 jours)
  const { maintenant, plusTard } = aRefaire();
  const ligne = ([k, n]) => {
    const [mid, cid, evId] = k.split('/'); const [m, nom] = nomChap(mid, cid, evId);
    const nv = cid === 'eval' ? String(evId).match(/-(\d+)$/)?.[1] : null;   // « Évaluation type 2 »
    const ch = nv ? `${nom} ${nv}` : nom;
    return `<a class="rv-l mc" ${m ? styleMatiere(m) : ''} href="${lienExo(k)}">
        <span class="badge ex-${NOTE[n.r][1]}">${NOTE[n.r][0]}</span>
        <span><b>${esc(n.t || 'Exercice')}</b><span class="muted">${esc(m?.court || m?.nom || '')} · ${esc(ch)}</span></span>${icone('fleche-d')}</a>`;
  };
  const prochain = plusTard[0] ? new Date(plusTard[0][2]).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  const blocRefaire = `<section class="panel rv">
      <h3>${icone('revoir')} À refaire aujourd'hui ${maintenant.length ? `<span class="badge ex-ko">${maintenant.length}</span>` : ''}</h3>
      ${maintenant.length ? `<div class="rv-liste">${maintenant.slice(0, 8).map(ligne).join('')}</div>
        ${maintenant.length > 8 ? `<p class="muted">… et ${maintenant.length - 8} autres.</p>` : ''}`
        : `<p class="muted">${plusTard.length ? 'Rien pour aujourd\'hui.' : 'Rien à refaire : les exercices notés Faux reviennent ici 1 jour après, les Presque 3 jours après.'}</p>`}
      ${plusTard.length ? `<p class="muted rv-plus">${pluriel(plusTard.length, 'exercice')} reviendr${plusTard.length > 1 ? 'ont' : 'a'} plus tard (prochain : ${esc(prochain)}).</p>` : ''}
    </section>`;

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
          <p>${pluriel(t.chapitres, 'chapitre')} · ${pluriel(nbEx, 'exercice')}</p>
          <div class="prog" title="${b.reussis} exercices réussis sur ${nbEx}"><div style="width:${pct}%"></div></div>
          <p class="prog-t">${b.faits ? `${b.reussis} / ${nbEx} exercices réussis${b.aRefaire ? ` · <b>${b.aRefaire} à refaire</b>` : ''}` : 'Pas encore commencé'}</p>
        </div>
      </a>`;
  }).join('');

  el.innerHTML = `
    <section class="hero">
      <h1>Mes révisions</h1>
      <p class="muted">Pour chaque chapitre : le cours, la synthèse, puis les exercices corrigés.</p>
    </section>
    ${der ? `<a class="panel continuer" href="${esc(der.h)}">
      <span class="m-ic">${icone('fleche-d')}</span>
      <span><span class="muted">Reprendre où tu t'es arrêté</span><b>${esc(der.t)}</b>${der.s ? `<span class="muted">${esc(der.s)}</span>` : ''}</span></a>` : ''}
    ${blocRefaire}
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
          <li><b>1. Cours</b> : apprends pas à pas, avec des questions et des schémas à annoter.</li>
          <li><b>2. Synthèse</b> : l'essentiel du chapitre (définitions, formules, pièges fréquents).</li>
          <li><b>3. Exercices</b> : toujours les mêmes étapes (énoncé, schéma, questions, correction). Tape tes résultats dans les cases, vérifie, puis note-toi. Les exercices ratés reviennent dans « À refaire ».</li>
          <li>La pastille <span class="badge">${icone('page')} p. 4</span> renvoie à la page du PDF de cours.</li>
        </ul>
      </div>
      <div class="panel">
        <h3>Bon à savoir</h3>
        <ul>
          <li>Le contenu est généré à partir des cours avec l'aide d'une IA. Il peut contenir des erreurs : en cas de doute, le cours du professeur fait foi.</li>
          <li>Ta progression est gardée sur cet appareil et synchronisée avec ton compte.</li>
          ${dateContenu() ? `<li class="muted">Contenu mis à jour le ${esc(formatDate(dateContenu()))}.</li>` : ''}
        </ul>
      </div>
    </div>`;
}
