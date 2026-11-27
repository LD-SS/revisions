/* =====================================================================
   VUE CHAPITRE — en-tête + onglets, toujours dans le même ordre :
   Cours (apprendre) → Synthèse (réviser) → Exercices (s'entraîner)
   ---------------------------------------------------------------------
   Adresse : #/m/<matière>/<chapitre>/<onglet>   (par défaut : Cours s'il existe, sinon Synthèse)
   Les exercices sur schéma (fichier « schemas » de la matière) sont rangés dans leur chapitre
   d'origine (origine.chap) ; leur clé de progression reste « <matière>/schemas/<id> ».
   Pour ajouter un onglet : une entrée dans ONGLETS + son affichage dans afficherOnglet().
   ===================================================================== */

import { esc } from '../utils.js';
import { icone } from '../icones.js';
import { styleMatiere } from '../matieres.js';
import { matiere, infoChapitre, chargerChapitre, chargerSchemas, voisins } from '../store.js';
import { rendreSynthese, activerSynthese, sourcesDe, rendreBloc } from '../synthese.js';
import { lecteurExercices } from '../exercices.js';
import { memoriserVisite } from '../suivi.js';

const ONGLETS = [
  { id: 'cours', libelle: 'Cours', icone: 'livre', siCours: true },   // seulement si le chapitre a un cours interactif
  { id: 'synthese', libelle: 'Synthèse', icone: 'synthese' },
  { id: 'exercices', libelle: 'Exercices', icone: 'exercices' },
];

/** Chapitre où ranger un exercice sur schéma : origine.chap, ou le chapitre qui a le même numéro (ch09-labo → ch09-…). */
export function chapitreDe(m, e) {
  const c = e.origine?.chap || ''; if (!c) return null;
  if (m.chapitres.some((x) => x.id === c)) return c;
  const num = c.match(/^ch\d+/)?.[0];
  return (num && m.chapitres.find((x) => x.id.startsWith(`${num}-`))?.id) || null;
}
/** Exercices sur schéma d'un chapitre (+ la méthode commune), ou rien. */
async function schemasDu(m, cid) {
  if (!m.schemas) return { exos: [], d: null };
  try {
    const d = await chargerSchemas(m.id); const docs = sourcesDe(d);
    const exos = d.exercices.filter((e) => chapitreDe(m, e) === cid).map((e) => ({ ...e, _cle: `${m.id}/schemas/${e.id}`, _docs: docs }));
    return { exos, d };
  } catch { return { exos: [], d: null }; }
}

export async function vueChapitre(el, mid, cid, onglet = '', extra = '') {
  const m = matiere(mid);
  const info = infoChapitre(mid, cid);
  if (!m || !info) throw new Error(`Chapitre introuvable : « ${mid}/${cid} ».`);
  const ch = await chargerChapitre(mid, cid);
  const onglets = ONGLETS.filter((o) => !o.siCours || ch.cours?.lecons?.length);
  if (!onglets.some((o) => o.id === onglet)) onglet = onglets[0].id;
  const sch = await schemasDu(m, cid);

  const base = `#/m/${esc(m.id)}/${esc(info.id)}`;
  const num = m.chapitres.indexOf(info) + 1;
  const compte = { cours: ch.cours?.lecons?.length || 0, synthese: ch.synthese.sections.length, exercices: ch.exercices.length + sch.exos.length };
  memoriserVisite(`${base}/${onglet}`, ch.titre || info.titre, `${m.court || m.nom} · ${onglets.find((o) => o.id === onglet).libelle}`);
  const { precedent, suivant } = voisins(mid, cid);

  el.innerHTML = `
    <div class="mc" ${styleMatiere(m)}>
      <div class="crumb">
        <a href="#/">Accueil</a><span class="crumb-sep">›</span>
        <a href="#/m/${esc(m.id)}">${esc(m.nom)}</a><span class="crumb-sep">›</span>
        <span>Chapitre ${num}</span>
      </div>
      <div class="page-head chap-head">
        <span class="m-ic">${icone(m.icone)}</span>
        <div><h2>${esc(ch.titre || info.titre)}</h2><p class="muted">${esc(m.nom)} · chapitre ${num}</p></div>
      </div>
      ${ch.exemple || info.exemple ? `<div class="notice">${icone('info')}<div><b>Contenu d'exemple.</b>
        Ce chapitre a été rédigé pour tester l'appli : il ne provient pas d'un PDF de cours. Les numéros de page sont fictifs.</div></div>` : ''}
      <nav class="seg" aria-label="Contenu du chapitre">
        ${onglets.map((o) => `<a href="${base}/${o.id}" class="${o.id === onglet ? 'active' : ''}" ${o.id === onglet ? 'aria-current="page"' : ''}>
          ${icone(o.icone)}<span class="seg-t">${o.libelle}</span><span class="count">${compte[o.id]}</span></a>`).join('')}
      </nav>
      <div id="onglet"></div>
      <div class="chap-nav">
        ${precedent ? `<a class="btn" href="#/m/${esc(m.id)}/${esc(precedent.id)}/${onglet}">${icone('fleche-g')} ${esc(precedent.titre)}</a>` : '<span></span>'}
        ${suivant ? `<a class="btn" href="#/m/${esc(m.id)}/${esc(suivant.id)}/${onglet}">${esc(suivant.titre)} ${icone('fleche-d')}</a>` : ''}
      </div>
    </div>`;

  const zone = el.querySelector('#onglet');
  return afficherOnglet(zone, onglet, ch, `${base}/${onglet}`, extra, sch);
}

/** Affiche le contenu de l'onglet ; renvoie une fonction de nettoyage. */
function afficherOnglet(zone, onglet, ch, adresse, extra, sch) {
  const prefixe = `${ch.matiere}/${ch.id}`;
  switch (onglet) {
    case 'cours':
      return import('../cours.js').then(({ lecteurCours }) => lecteurCours(zone, ch.cours, { docs: sourcesDe(ch), prefixe }));
    case 'exercices': {
      const debut = extra?.startsWith('sch-') ? `${ch.matiere}/schemas/${extra.slice(4)}` : (extra || undefined);
      const methode = sch.exos.length && sch.d?.synthese?.length
        ? `<details class="panel sch-methode"><summary><b>${icone('ampoule')} Méthode et conventions</b> <span class="muted">(appareils de mesure, sens des flèches)</span></summary>
          ${sch.d.synthese.map((s) => `<h4>${esc(s.titre)}</h4>${(s.blocs || []).map((b) => rendreBloc({ ...b, pages: null, doc: null })).join('')}`).join('')}</details>` : '';
      zone.innerHTML = `${methode}<div></div>`;
      return lecteurExercices(zone.lastElementChild, [...ch.exercices, ...sch.exos], { docs: sourcesDe(ch), prefixe, debut });
    }
    default:
      zone.innerHTML = rendreSynthese(ch, adresse);
      return activerSynthese(zone);
  }
}
