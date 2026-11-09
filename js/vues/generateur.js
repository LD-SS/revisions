/* =====================================================================
   GÉNÉRATEUR DE SYNTHÈSE — coche les formules, imprime ta fiche
   ---------------------------------------------------------------------
   Toutes les formules de la matière (blocs « formule » des synthèses),
   rangées par chapitre. Options : légende des variables, schémas
   explicatifs (la figure de la même section), version à compléter
   (formules masquées) et notes personnelles.
   Impression : window.print() → « Enregistrer en PDF » ou imprimante.
   Les choix sont gardés (et synchronisés) dans « fiches ».
   ===================================================================== */

import { esc, stockage, toast } from '../utils.js';
import { icone } from '../icones.js';
import { styleMatiere, TYPES_BLOCS } from '../matieres.js';
import { matiere, chargerChapitre } from '../store.js';
import { math, enLigne, svgSur } from '../rendu.js';
import { corpsBloc } from '../synthese.js';
import { ongletsMatiere } from './schemas.js';

const OPTIONS = [
  ['vars', 'Légende des variables et unités', true],
  ['schemas', 'Schémas explicatifs (quand il y en a)', true],
  ['vierge', 'Version à compléter (formules masquées, pour t\'entraîner)', false],
];

/* Matières sans (presque) aucune formule (dessin) : on choisit les encadrés de la synthèse
   (définitions, à retenir, tableaux, figures, listes, pièges) au lieu des formules. */
const MODE_FICHE = ['dessin'];
const TYPES_FICHE = ['definition', 'point-cle', 'tableau', 'figure', 'liste', 'piege', 'formule'];

/** Texte court pour reconnaître un encadré dans la liste. */
function apercuBloc(b) {
  const brut = b.contenu || b.legende || (b.entetes || []).join(' · ') || (b.items || [])[0] || b.latex || '';
  const t = String(brut).replace(/\$[^$]*\$/g, '…').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim();
  return t.length > 80 ? `${t.slice(0, 78)}…` : t;
}

/** Les encadrés d'une matière « fiche » : [{ info, items: [{ id, sec, b, fiche: true }] }] */
async function encadresDe(m) {
  const chapitres = await Promise.all(m.chapitres.map(async (c) => {
    const ch = await chargerChapitre(m.id, c.id).catch(() => null);
    if (!ch) return null;
    const items = [];
    for (const s of ch.synthese.sections) {
      s.blocs.forEach((b, i) => {
        if (!TYPES_FICHE.includes(b.type) || (b.type === 'figure' && !b.svg)) return;
        items.push({ id: `${c.id}/${s.id}/${i}`, sec: s.titre, b, fiche: true });
      });
    }
    return items.length ? { info: c, items } : null;
  }));
  return chapitres.filter(Boolean);
}

/** Toutes les formules d'une matière : [{ ch, items: [{ id, sec, b, fig }] }] */
async function formulesDe(m) {
  const chapitres = await Promise.all(m.chapitres.map(async (c) => {
    const ch = await chargerChapitre(m.id, c.id).catch(() => null);
    if (!ch) return null;
    const items = [];
    for (const s of ch.synthese.sections) {
      // schéma associé : la k-ième figure pour la k-ième formule s'il y en a autant, sinon la première
      const figs = s.blocs.filter((b) => b.type === 'figure' && b.svg);
      const nbF = s.blocs.filter((b) => b.type === 'formule' && b.latex).length;
      let k = 0;
      s.blocs.forEach((b, i) => {
        // schéma de référence proposé seul (ex. le cercle trigonométrique complet)
        if (b.type === 'figure' && b.generateur && b.svg) { items.push({ id: `${c.id}/${s.id}/${i}`, sec: s.titre, b, seule: true }); return; }
        if (b.type !== 'formule' || !b.latex) return;
        const fig = figs.length === nbF ? figs[k] : figs[0];
        k++;
        items.push({ id: `${c.id}/${s.id}/${i}`, sec: s.titre, b, fig });
      });
    }
    return items.length ? { info: c, items } : null;
  }));
  return chapitres.filter(Boolean);
}

/** Version à compléter d'un schéma de référence : on retire les valeurs marquées « acompl » */
function sansValeurs(svg) {
  const t = document.createElement('div');
  t.innerHTML = svgSur(svg);
  t.querySelectorAll('.acompl').forEach((n) => n.remove());
  return t.innerHTML;
}

const lireEtat = (mid) => {
  const e = stockage.lire('fiches', {})[mid] || {};
  return { sel: Array.isArray(e.sel) ? e.sel : null, opts: e.opts || {}, notes: e.notes || '' };
};
const ecrireEtat = (mid, etat) => {
  const tout = stockage.lire('fiches', {}); tout[mid] = etat; stockage.ecrire('fiches', tout);
};

export async function vueGenerateur(el, mid) {
  const m = matiere(mid);
  if (!m) throw new Error(`Matière inconnue : « ${mid} ».`);
  const fiche = MODE_FICHE.includes(mid);
  const mot = fiche ? 'élément' : 'formule';
  el.innerHTML = `<div class="mc" ${styleMatiere(m)}><p class="muted">Chargement de la synthèse…</p></div>`;
  const chapitres = await (fiche ? encadresDe(m) : formulesDe(m));
  const OPTS = fiche ? [] : OPTIONS;
  const tous = chapitres.flatMap((c) => c.items);
  const etat = lireEtat(mid);
  const sel = new Set(etat.sel ?? tous.map((x) => x.id));            // première visite : tout coché
  const opts = Object.fromEntries(OPTS.map(([k, , d]) => [k, etat.opts[k] ?? d]));
  let notes = etat.notes;
  const sauver = () => ecrireEtat(mid, { sel: [...sel], opts, notes });

  const ligne = (x) => x.fiche ? `<label class="gs-item"><input type="checkbox" data-id="${esc(x.id)}" ${sel.has(x.id) ? 'checked' : ''}>
    <span class="gs-f"><b>${esc(TYPES_BLOCS[x.b.type]?.libelle || (x.b.type === 'tableau' ? 'Tableau' : 'Liste'))}</b>${x.b.titre ? ` · ${enLigne(x.b.titre)}` : ''}</span>
    <span class="gs-l">${esc(apercuBloc(x.b))} <span class="muted">— ${enLigne(x.sec)}</span></span></label>`
    : `<label class="gs-item"><input type="checkbox" data-id="${esc(x.id)}" ${sel.has(x.id) ? 'checked' : ''}>
    <span class="gs-f">${x.seule ? `<b>${esc(x.b.titre || 'Schéma')}</b>` : math(x.b.latex)}</span><span class="gs-l">${enLigne(x.seule ? x.sec : (x.b.legende || x.sec))}${x.fig || x.seule ? ` <span class="gs-sch" title="Un schéma explicatif est disponible">${icone('eclair')} schéma</span>` : ''}</span></label>`;

  el.innerHTML = `
    <div class="mc gs" ${styleMatiere(m)}>
      <div class="crumb no-print"><a href="#/">Accueil</a><span class="crumb-sep">›</span><a href="#/m/${esc(m.id)}">${esc(m.nom)}</a><span class="crumb-sep">›</span><span>Générateur de synthèse</span></div>
      <div class="page-head no-print"><span class="m-ic">${icone('liste')}</span><div><h1>Générateur de synthèse</h1>
        <p class="muted">Coche ${fiche ? 'ce que tu veux garder (définitions, tableaux, schémas…)' : 'les formules'}, imprime ta fiche (ou enregistre-la en PDF).</p></div></div>
      <div class="no-print">${ongletsMatiere(m, 'generateur')}</div>
      ${tous.length ? `
      <div class="gs-grille no-print">
        <div class="panel gs-choix">
          <div class="gs-barre"><b><span data-nb></span> ${mot}(s) choisi${fiche ? '' : 'e'}(s)</b>
            <span><button class="btn" type="button" data-a="tout">Tout cocher</button>
            <button class="btn" type="button" data-a="rien">Tout décocher</button></span></div>
          ${chapitres.map((c) => `<details class="gs-ch" open><summary>
              <input type="checkbox" data-ch="${esc(c.info.id)}" aria-label="Tout le chapitre"> <b>Ch. ${esc(c.info.ordre ?? '')} · ${esc(c.info.titre)}</b>
              <span class="muted">(${c.items.length})</span></summary>
            ${c.items.map(ligne).join('')}</details>`).join('')}
        </div>
        <div class="panel gs-opts">
          <h3>Options</h3>
          ${OPTS.map(([k, l]) => `<label class="gs-opt"><input type="checkbox" data-opt="${k}" ${opts[k] ? 'checked' : ''}> ${esc(l)}</label>`).join('')}
          <label class="gs-notes-l">Mes notes <span class="muted">(ajoutées en fin de fiche)</span>
            <textarea class="field" rows="5" data-notes placeholder="${fiche ? 'Ex. : trait mixte fin = axe de symétrie.' : 'Ex. : pour passer de Ah en C, on multiplie par 3600.'}">${esc(notes)}</textarea></label>
          <button class="btn primary gs-impr" type="button" data-a="imprimer">${icone('telecharger')} Imprimer / PDF</button>
          <p class="muted gs-astuce">Dans la fenêtre d'impression, choisis « Enregistrer au format PDF » pour garder un fichier.</p>
        </div>
      </div>
      <h2 class="no-print gs-apercu-t">Aperçu</h2>
      <div class="gs-feuille" data-apercu></div>`
      : `<div class="panel empty"><h3>Aucun${fiche ? ' élément' : 'e formule'} dans cette matière</h3></div>`}
    </div>`;
  if (!tous.length) return null;

  const apercu = el.querySelector('[data-apercu]');
  const rendreApercu = () => {
    const parts = chapitres.map((c) => {
      const items = c.items.filter((x) => sel.has(x.id));
      if (!items.length) return '';
      const figs = new Set();
      return `<section class="gs-sec"><h3>Ch. ${esc(c.info.ordre ?? '')} · ${esc(c.info.titre)}</h3>
        ${items.map((x) => {
          const b = x.b;
          if (x.fiche) {
            const titre = b.titre ? enLigne(b.titre) : esc(TYPES_BLOCS[b.type]?.libelle || x.sec);
            const corps = b.type === 'figure'
              ? `<figure class="fig gs-fig">${svgSur(b.svg)}${b.legende ? `<figcaption>${enLigne(b.legende)}</figcaption>` : ''}</figure>`
              : corpsBloc(b.type, b);
            return `<div class="gs-bloc gs-fiche gs-${esc(b.type)}"><div class="gs-titre">${titre}</div>${corps}</div>`;
          }
          if (x.seule) {
            return `<div class="gs-bloc gs-large"><div class="gs-titre">${esc(b.titre || x.sec)}</div>
              <figure class="fig gs-fig">${opts.vierge ? sansValeurs(b.svg) : svgSur(b.svg)}</figure></div>`;
          }
          const vars = opts.vars && Array.isArray(b.variables) && b.variables.length
            ? `<div class="gs-vars">${b.variables.map((v) => `<span>${math(v.symbole)}</span><span>${enLigne(v.nom)}${v.unite ? ` <i>en ${esc(v.unite)}</i>` : ''}</span>`).join('')}</div>` : '';
          // un même schéma n'est montré qu'une fois par chapitre (ex. les 2 formules du parallèle)
          const fig = opts.schemas && x.fig && !figs.has(x.fig) ? (figs.add(x.fig), `<figure class="fig gs-fig">${svgSur(x.fig.svg)}</figure>`) : '';
          return `<div class="gs-bloc">
            <div class="gs-titre">${enLigne(b.legende || x.sec)}</div>
            ${opts.vierge ? '<div class="gs-vide"></div>' : `<div class="gs-math">${math(b.latex, true)}</div>`}
            ${vars}${fig}</div>`;
        }).join('')}</section>`;
    }).join('');
    apercu.innerHTML = `<header class="gs-entete"><b>${esc(m.nom)} — ${fiche ? 'synthèse' : 'formules'}</b><span>${opts.vierge ? 'À compléter' : ''}</span></header>
      ${parts || `<p class="muted">Coche au moins un${fiche ? ' élément' : 'e formule'}.</p>`}
      ${notes.trim() ? `<section class="gs-sec gs-mes-notes"><h3>Mes notes</h3>${notes.trim().split(/\n+/).map((l) => `<p>${esc(l)}</p>`).join('')}</section>` : ''}`;
  };

  const majCases = () => {
    el.querySelector('[data-nb]').textContent = sel.size;
    for (const c of chapitres) {
      const n = c.items.filter((x) => sel.has(x.id)).length;
      const cb = el.querySelector(`[data-ch="${CSS.escape(c.info.id)}"]`);
      cb.checked = n === c.items.length; cb.indeterminate = n > 0 && n < c.items.length;
    }
    el.querySelectorAll('[data-id]').forEach((cb) => { cb.checked = sel.has(cb.dataset.id); });
  };
  const changer = () => { majCases(); rendreApercu(); sauver(); };

  el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.id) { t.checked ? sel.add(t.dataset.id) : sel.delete(t.dataset.id); changer(); }
    else if (t.dataset.ch) {
      const c = chapitres.find((x) => x.info.id === t.dataset.ch);
      c.items.forEach((x) => (t.checked ? sel.add(x.id) : sel.delete(x.id))); changer();
    } else if (t.dataset.opt) { opts[t.dataset.opt] = t.checked; changer(); }
  });
  // la case du chapitre est dans le <summary> : ne pas replier le chapitre en la cochant
  el.querySelectorAll('[data-ch]').forEach((cb) => cb.addEventListener('click', (e) => e.stopPropagation()));
  el.querySelector('[data-notes]').addEventListener('input', (e) => { notes = e.target.value; rendreApercu(); sauver(); });
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'tout') { tous.forEach((x) => sel.add(x.id)); changer(); }
    else if (a === 'rien') { sel.clear(); changer(); }
    else if (a === 'imprimer') {
      if (!sel.size && !notes.trim()) { toast(`Coche au moins un${fiche ? ' élément' : 'e formule'}`); return; }
      document.body.classList.add('gs-impression');
      const fin = () => { document.body.classList.remove('gs-impression'); window.removeEventListener('afterprint', fin); };
      window.addEventListener('afterprint', fin);
      window.print();
      setTimeout(fin, 1000);   // certains navigateurs n'envoient pas « afterprint »
    }
  });
  majCases(); rendreApercu();
  return null;
}
