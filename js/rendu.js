/* =====================================================================
   RENDU — texte enrichi et formules mathématiques
   ---------------------------------------------------------------------
   Syntaxe acceptée dans les champs de contenu (synthèse, flashcards…) :
     **gras**   *italique*   `code`
     $formule$ (dans le texte)   $$formule$$ (centrée)   \$ = dollar littéral
     Ligne commençant par « - »  → liste à puces
     Ligne commençant par « 1. » → liste numérotée
     Retour à la ligne (\n)      → nouveau paragraphe
   Les formules sont écrites en LaTeX et affichées par KaTeX (lib/katex/).
   ===================================================================== */

import { esc } from './utils.js';

/** Formule LaTeX → HTML (KaTeX). En cas d'erreur, affiche le code brut. */
export function math(latex, affichee = false) {
  const k = window.katex;
  if (!k) return `<code>${esc(latex)}</code>`;
  try {
    return k.renderToString(String(latex), {
      displayMode: affichee, throwOnError: false, strict: 'ignore', output: 'htmlAndMathml',
    });
  } catch {
    return `<code>${esc(latex)}</code>`;
  }
}

/** Mise en forme d'une ligne (sans les listes ni les paragraphes). */
export function enLigne(src) {
  const reserves = [];
  const garder = (html) => `\u0000${reserves.push(html) - 1}\u0000`;
  let s = String(src ?? '')
    .replace(/\\\$/g, () => garder('$'))
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, f) => garder(math(f, true)))
    .replace(/\$([^$\n]+?)\$/g, (_, f) => garder(math(f, false)))
    .replace(/`([^`\n]+)`/g, (_, c) => garder(`<code>${esc(c)}</code>`));
  s = esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => reserves[+i]);
}

/** Texte complet (plusieurs lignes) → paragraphes et listes. */
export function texte(src) {
  const lignes = String(src ?? '').split('\n');
  let html = '';
  let liste = null; // 'ul' ou 'ol' en cours
  const fermer = () => { if (liste) { html += `</${liste}>`; liste = null; } };
  for (const brute of lignes) {
    const l = brute.trim();
    const puce = /^[-•]\s+(.*)$/.exec(l);
    const num = /^\d+[.)]\s+(.*)$/.exec(l);
    if (puce || num) {
      const type = puce ? 'ul' : 'ol';
      if (liste !== type) { fermer(); html += `<${type}>`; liste = type; }
      html += `<li>${enLigne((puce || num)[1])}</li>`;
    } else {
      fermer();
      if (l) html += `<p>${enLigne(l)}</p>`;
    }
  }
  fermer();
  return html;
}

/**
 * Figure SVG d'une synthèse : on ne garde que du dessin (pas de script, pas
 * d'évènements, pas de liens externes), au cas où un contenu serait mal formé.
 */
export function svgSur(source) {
  try {
    const doc = new DOMParser().parseFromString(String(source || ''), 'image/svg+xml');
    const racine = doc.documentElement;
    if (!racine || racine.nodeName !== 'svg' || doc.querySelector('parsererror')) return '';
    racine.querySelectorAll('script, foreignObject, iframe, image, use, a, style').forEach((n) => n.remove());
    for (const n of [racine, ...racine.querySelectorAll('*')]) {
      for (const at of [...n.attributes]) {
        const nom = at.name.toLowerCase();
        if (nom.startsWith('on') || nom.includes('href') || /javascript:/i.test(at.value)) n.removeAttribute(at.name);
      }
    }
    return racine.outerHTML;
  } catch {
    return '';
  }
}
