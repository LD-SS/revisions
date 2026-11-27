/* =====================================================================
   VUE MATIÈRE — liste des chapitres d'une matière
   ===================================================================== */

import { esc, pluriel, formatDate } from '../utils.js';
import { icone } from '../icones.js';
import { styleMatiere, profilDe } from '../matieres.js';
import { matiere, totaux } from '../store.js';
import { bilanChapitre } from '../suivi.js';

export function vueMatiere(el, mid) {
  const m = matiere(mid);
  if (!m) throw new Error(`Matière inconnue : « ${mid} ».`);
  const t = totaux(m);

  const chapitres = m.chapitres.map((c, i) => `
    <a class="panel chap" href="#/m/${esc(m.id)}/${esc(c.id)}">
      <span class="chap-num">${i + 1}</span>
      <div class="chap-body">
        <h3>${esc(c.titre)}</h3>
        ${(() => {
          const b = bilanChapitre(m, c); const n = c.nb || {}; const nbEx = (n.exercices || 0) + (n.schemas || 0);
          const pct = nbEx ? Math.round(100 * Math.min(b.reussis, nbEx) / nbEx) : 0;
          return `<p class="chap-meta-t muted">${pluriel(n.sections || 0, 'section')}${nbEx ? ` · ${pluriel(nbEx, 'exercice')}` : ''}${c.exemple ? ' · <span class="badge warn">Exemple</span>' : ''}</p>
            ${nbEx ? `<div class="prog"><div style="width:${pct}%"></div></div>` : ''}
            ${b.faits ? `<p class="prog-t">${nbEx ? `${Math.min(b.reussis, nbEx)} / ${nbEx} réussis` : ''}${b.aRefaire ? ` · <b>${b.aRefaire} à refaire</b>` : ''}</p>` : ''}`;
        })()}
      </div>
      <span class="chev">${icone('fleche-d')}</span>
    </a>`).join('');

  el.innerHTML = `
    <div class="mc" ${styleMatiere(m)}>
      <div class="crumb"><a href="#/">Accueil</a><span class="crumb-sep">›</span><span>${esc(m.nom)}</span></div>
      <div class="page-head">
        <span class="m-ic">${icone(m.icone)}</span>
        <div>
          <h1>${esc(m.nom)}</h1>
          <p class="muted">${pluriel(t.chapitres, 'chapitre')} · chaque chapitre : Cours → Synthèse → Exercices</p>
        </div>
      </div>
      ${m.chapitres.length
        ? `<div class="chap-list">${chapitres}</div>`
        : `<div class="panel empty"><div class="m-ic">${icone('synthese')}</div><h3>Aucun chapitre pour l'instant</h3>
           <p class="muted">Les chapitres apparaîtront ici dès qu'ils seront publiés.</p></div>`}
    </div>`;
}
