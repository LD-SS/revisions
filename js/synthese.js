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
     figure  → { svg: '<svg …>', legende? }  (schéma redessiné, couleurs via les classes .fig)
   Tous les blocs : titre? (facultatif), pages: [n, …] (page(s) du PDF source),
   doc? (id du PDF quand le chapitre en a plusieurs, voir source.pdfs),
   complement?: true (ajout qui ne figure pas dans le PDF : affiché comme tel).
   Pour ajouter un type de bloc : une entrée dans TYPES_BLOCS + un « case » dans corpsBloc().
   ===================================================================== */

import { esc, pagesTxt, formatDate, $$ } from './utils.js';
import { icone } from './icones.js';
import { TYPES_BLOCS } from './matieres.js';
import { texte, enLigne, math, svgSur } from './rendu.js';

/**
 * Pastille de source, affichée sur chaque bloc et chaque flashcard :
 *   « Ch. 3 – Racines · p. 5 »  (nom court du PDF + page)
 *   « Complément · Ch. 3 – Racines · p. 5 »  pour un ajout qui ne figure pas dans le PDF,
 *   en lien avec cette page.
 * Le nom complet du PDF apparaît au survol (ou au toucher, voir app.js).
 * @param {{pages?: number[], page?: number, doc?: string, complement?: boolean}} el  bloc ou flashcard
 * @param {{id: string, nom: string, court?: string}[]} docs  PDF sources du chapitre (source.pdfs)
 */
export function badgeSource(el, docs = []) {
  if (!el) return '';
  const p = pagesTxt(el.pages ?? (el.page != null ? [el.page] : []));
  const d = docs.find((x) => x.id === el.doc) || (docs.length === 1 ? docs[0] : null);
  if (!p && !d && !el.complement) return '';
  const ref = d ? `${p ? `${/[–,]/.test(p) ? 'pages' : 'page'} ${p} du` : 'le'} PDF « ${d.nom} »` : p ? `page ${p} du PDF de cours` : '';
  const titre = el.complement
    ? `Complément : ajouté pour aider, ne figure pas dans le PDF${ref ? ` (en lien avec la ${ref})` : ''}`
    : `Voir la ${ref}`;
  const morceaux = [el.complement ? 'Complément' : '', d ? esc(d.court || d.nom) : '', p ? `p. ${p}` : ''].filter(Boolean);
  return `<span class="pg${el.complement ? ' cplt' : ''}" title="${esc(titre)}" tabindex="0">${icone(el.complement ? 'info' : 'page')}${morceaux.join(' · ')}</span>`;
}

/** Ancienne forme, conservée : pastille à partir d'une simple liste de pages. */
export const badgePage = (pages) => badgeSource({ pages });

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

  const docs = sourcesDe(ch);
  const source = docs.map((d) => `<span class="badge" title="PDF source (non publié)">${icone('page')} ${esc(d.nom)}${d.pages ? ` · ${d.pages} p.` : ''}</span>`);
  if (ch.source.genereLe) source.push(`<span class="muted">Généré le ${esc(formatDate(ch.source.genereLe))}</span>`);

  const corps = sections.map((s, i) => `
    <section class="panel syn-section" id="sec-${esc(s.id || i)}">
      <h2><span class="num">${i + 1}</span>${esc(s.titre)}</h2>
      ${(s.blocs || []).map((b) => rendreBloc(b, docs)).join('')}
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
export function rendreBloc(b, docs = []) {
  const type = TYPES_BLOCS[b.type] ? b.type : 'texte';
  const def = TYPES_BLOCS[type];
  const libelle = b.titre
    ? `${def.libelle ? `${def.libelle} · ` : ''}<span class="t">${enLigne(b.titre)}</span>`
    : def.libelle;
  const pg = badgeSource(b, docs);
  // La pastille de source se place à droite du titre du bloc (ou en fin de texte).
  const tete = libelle && type !== 'texte'
    ? `<div class="bloc-head">${def.icone ? icone(def.icone) : ''}${libelle}${type !== 'formule' ? pg : ''}</div>` : '';
  if (type === 'texte' || !tete) {
    let html = type === 'texte' ? texte(b.contenu) : corpsBloc(type, b);
    const fin = html.lastIndexOf('</p>');
    html = !pg ? html : fin >= 0 ? `${html.slice(0, fin)} ${pg}${html.slice(fin)}` : `${html}<p>${pg}</p>`;
    return `<div class="bloc ${type}${b.complement ? ' cplt' : ''}">${html}</div>`;
  }
  return `<div class="bloc ${type}${b.complement ? ' cplt' : ''}">${type === 'formule' ? pg : ''}${tete}${corpsBloc(type, b)}</div>`;
}

/** Liste des PDF sources d'un chapitre (format à plusieurs PDF ou ancien format à un seul). */
export function sourcesDe(ch) {
  const s = ch.source || {};
  if (Array.isArray(s.pdfs)) return s.pdfs;
  return s.pdf ? [{ id: 'cours', nom: s.pdf, pages: s.pages }] : [];
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
    case 'figure':
      return `<figure class="fig">${svgSur(b.svg)}${b.legende ? `<figcaption>${enLigne(b.legende)}</figcaption>` : ''}</figure>`;
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
