/* =====================================================================
   SYNTHÈSE — affichage d'une synthèse de chapitre
   ---------------------------------------------------------------------
   Structure attendue (fichier chapitre) :
     synthese: { intro, sections: [ { id, titre, blocs: [ bloc, … ] } ] }
   Types de blocs (voir TYPES_BLOCS dans matieres.js) :
     texte | definition | point-cle | piege | exemple  → { contenu }
     formule → { latex, legende?, variables?: [{ symbole, nom, unite }] }
     liste   → { items: [..], ordonnee?: true }
     tableau → { entetes: [..], lignes: [[..], ..] }
   Tous les blocs : titre? (facultatif) et pages: [n, …] (page(s) du PDF source).
   Pour ajouter un type de bloc : une entrée dans TYPES_BLOCS + un « case » dans corpsBloc().
   ===================================================================== */

import { esc, pagesTxt, formatDate, $$ } from './utils.js';
import { icone } from './icones.js';
import { TYPES_BLOCS } from './matieres.js';
import { texte, enLigne, math } from './rendu.js';

/** Pastille « p. 4 » renvoyant à la page du PDF de cours. */
export function badgePage(pages) {
  const p = pagesTxt(pages ?? []);
  if (!p) return '';
  const pluriel = /[–,]/.test(p);
  return `<span class="pg" title="Voir ${pluriel ? 'pages' : 'page'} ${p} du PDF de cours">${icone('page')}p. ${p}</span>`;
}

/** HTML complet de l'onglet Synthèse. */
export function rendreSynthese(ch, base) {
  const sections = ch.synthese.sections;
  if (!sections.length) {
    return `<div class="panel empty">
      <div class="m-ic">${icone('synthese')}</div>
      <h3>Pas encore de synthèse</h3>
      <p class="muted">La synthèse de ce chapitre n'a pas encore été générée.</p></div>`;
  }
  const sommaire = sections.map((s, i) =>
    `<li><a href="${base}" data-cible="sec-${esc(s.id || i)}">${esc(s.titre)}</a></li>`).join('');

  const source = [];
  if (ch.source.pdf) source.push(`<span class="badge">${icone('page')} ${esc(ch.source.pdf)}${ch.source.pages ? ` · ${ch.source.pages} p.` : ''}</span>`);
  if (ch.source.genereLe) source.push(`<span class="muted">Généré le ${esc(formatDate(ch.source.genereLe))}</span>`);

  const corps = sections.map((s, i) => `
    <section class="panel syn-section" id="sec-${esc(s.id || i)}">
      <h2><span class="num">${i + 1}</span>${esc(s.titre)}</h2>
      ${(s.blocs || []).map(rendreBloc).join('')}
    </section>`).join('');

  return `
    <div class="syn-layout">
      <nav class="panel syn-toc" aria-label="Sommaire"><h3>Sommaire</h3><ol>${sommaire}</ol></nav>
      <div class="syn-contenu">
        ${ch.synthese.intro || source.length ? `<div class="panel syn-section">
          ${ch.synthese.intro ? `<p class="syn-intro">${enLigne(ch.synthese.intro)}</p>` : ''}
          ${source.length ? `<p class="syn-source">${source.join(' ')}</p>` : ''}
        </div>` : ''}
        ${corps}
      </div>
    </div>`;
}

/** Un bloc de synthèse (encadré). */
export function rendreBloc(b) {
  const type = TYPES_BLOCS[b.type] ? b.type : 'texte';
  const def = TYPES_BLOCS[type];
  const libelle = b.titre
    ? `${def.libelle ? `${def.libelle} · ` : ''}<span class="t">${enLigne(b.titre)}</span>`
    : def.libelle;
  const tete = libelle && type !== 'texte'
    ? `<div class="bloc-head">${def.icone ? icone(def.icone) : ''}${libelle}</div>` : '';
  const pg = badgePage(b.pages);
  // Pour le texte et les tableaux, la pastille de page est placée en ligne / en dessous.
  if (type === 'texte') {
    let html = texte(b.contenu);
    const fin = html.lastIndexOf('</p>');
    html = !pg ? html : fin >= 0 ? `${html.slice(0, fin)} ${pg}${html.slice(fin)}` : `${html}<p>${pg}</p>`;
    return `<div class="bloc texte">${html}</div>`;
  }
  if (type === 'tableau') return `<div class="bloc tableau">${tete}${corpsBloc(type, b)}${pg ? `<div class="pg-row">${pg}</div>` : ''}</div>`;
  return `<div class="bloc ${type}">${pg}${tete}${corpsBloc(type, b)}</div>`;
}

function corpsBloc(type, b) {
  switch (type) {
    case 'formule': {
      const vars = Array.isArray(b.variables) && b.variables.length
        ? `<div class="vars">${b.variables.map((v) =>
          `<span>${math(v.symbole)}</span><span>${esc(v.nom)}</span><span class="u">${v.unite ? `en ${esc(v.unite)}` : ''}</span>`).join('')}</div>`
        : '';
      return `<div class="formule-math">${math(b.latex, true)}</div>
        ${b.legende ? `<div class="formule-legende">${enLigne(b.legende)}</div>` : ''}${vars}`;
    }
    case 'liste': {
      const tag = b.ordonnee ? 'ol' : 'ul';
      return `<${tag}>${(b.items || []).map((it) => `<li>${enLigne(it)}</li>`).join('')}</${tag}>`;
    }
    case 'tableau': {
      const entetes = (b.entetes || []).map((h) => `<th>${enLigne(h)}</th>`).join('');
      const lignes = (b.lignes || []).map((l) => `<tr>${l.map((c) => `<td>${enLigne(c)}</td>`).join('')}</tr>`).join('');
      return `<div class="tbl-wrap"><table class="tbl">${entetes ? `<thead><tr>${entetes}</tr></thead>` : ''}<tbody>${lignes}</tbody></table></div>`;
    }
    default:
      return texte(b.contenu);
  }
}

/** Comportements de la synthèse : clic dans le sommaire + section active en surbrillance.
    Renvoie une fonction de nettoyage appelée quand on quitte la page. */
export function activerSynthese(racine) {
  const liens = $$('.syn-toc a', racine);
  liens.forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById(a.dataset.cible)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  if (!('IntersectionObserver' in window) || !liens.length) return () => {};
  const obs = new IntersectionObserver((entrees) => {
    const visibles = entrees.filter((e) => e.isIntersecting);
    if (!visibles.length) return;
    const id = visibles[0].target.id;
    liens.forEach((a) => a.classList.toggle('active', a.dataset.cible === id));
  }, { rootMargin: '-80px 0px -60% 0px' });
  $$('section.syn-section[id]', racine).forEach((s) => obs.observe(s));
  return () => obs.disconnect();
}
