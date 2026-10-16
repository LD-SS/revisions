/* =====================================================================
   FLASHCARDS — lecteur de cartes question / réponse
   ---------------------------------------------------------------------
   Carte : { id, recto, verso, tags?: [..], page?, doc?, complement? }
   Utilisation : const fin = lecteurFlashcards(conteneur, cartes, options)
                 fin() retire les raccourcis clavier quand on quitte la page.
   Commandes : clic / Espace = retourner ; ← → = carte précédente / suivante ;
               1 = « À revoir », 2 = « Je savais » ; glisser sur tablette.
   Étape 4 : les réponses « Je savais / À revoir » alimenteront les boîtes de
   Leitner (révision espacée) via le module leitner.js. Pour l'instant, le
   score de la séance reste en mémoire.
   ===================================================================== */

import { esc, melanger, pluriel } from './utils.js';
import { icone } from './icones.js';
import { texte } from './rendu.js';
import { badgeSource } from './synthese.js';

export function lecteurFlashcards(conteneur, toutesLesCartes, options = {}) {
  const etat = {
    filtre: '',            // étiquette choisie ('' = toutes)
    paquet: [],            // cartes de la séance, dans l'ordre de passage
    pos: 0,                // index de la carte affichée
    verso: false,          // carte retournée ?
    reponses: new Map(),   // id → 'ok' | 'ko'
    termine: false,
  };
  const etiquettes = [...new Set(toutesLesCartes.flatMap((c) => c.tags || []))].sort((a, b) => a.localeCompare(b, 'fr'));
  const anime = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function nouvelleSeance(cartes) {
    etat.paquet = cartes;
    etat.pos = 0;
    etat.verso = false;
    etat.reponses = new Map();
    etat.termine = false;
    afficher();
  }
  const cartesFiltrees = () => toutesLesCartes.filter((c) => !etat.filtre || (c.tags || []).includes(etat.filtre));

  /* ---------- affichage ---------- */
  function afficher() {
    if (!toutesLesCartes.length) {
      conteneur.innerHTML = `<div class="panel empty"><div class="m-ic">${icone('cartes')}</div>
        <h3>Pas encore de flashcards</h3><p class="muted">Les flashcards de ce chapitre n'ont pas encore été générées.</p></div>`;
      return;
    }
    const n = etat.paquet.length;
    const barre = `
      <div class="fc-bar">
        <strong>${etat.termine ? 'Séance terminée' : `Carte ${etat.pos + 1} / ${n}`}</strong>
        <span class="grow"></span>
        ${etiquettes.length ? `<select class="field" data-action="filtre" aria-label="Filtrer par thème">
          <option value="">Tous les thèmes (${toutesLesCartes.length})</option>
          ${etiquettes.map((t) => `<option value="${esc(t)}" ${t === etat.filtre ? 'selected' : ''}>${esc(t)} (${toutesLesCartes.filter((c) => (c.tags || []).includes(t)).length})</option>`).join('')}
        </select>` : ''}
        <button class="btn" data-action="melanger" title="Mélanger les cartes">${icone('melanger')}<span>Mélanger</span></button>
        <button class="btn" data-action="recommencer" title="Recommencer dans l'ordre">${icone('recommencer')}<span>Recommencer</span></button>
      </div>
      <div class="fc-progress" aria-hidden="true"><div style="width:${n ? Math.round(100 * etat.reponses.size / n) : 0}%"></div></div>`;
    conteneur.innerHTML = `<div class="fc-wrap">${barre}${etat.termine ? ecranFin() : ecranCarte()}</div>`;
  }

  function ecranCarte() {
    const c = etat.paquet[etat.pos];
    const face = etat.verso ? c.verso : c.recto;
    return `
      <div class="fc-stage">
        <div class="panel fc-card ${etat.verso ? 'verso' : ''}" data-action="retourner" tabindex="0" role="button"
             aria-label="${etat.verso ? 'Réponse' : 'Question'} — cliquer pour retourner">
          <span class="fc-side">${etat.verso ? 'Réponse' : 'Question'}</span>
          <div class="fc-text">${texte(face)}</div>
          ${etat.verso && c.tags?.length ? `<div class="fc-tags">${c.tags.map((t) => `<span class="badge">${esc(t)}</span>`).join('')}</div>` : ''}
          ${etat.verso ? `<div class="fc-source">${badgeSource(c, options.docs)}</div>` : ''}
          <div class="fc-hint">${etat.verso ? '' : 'Clique sur la carte pour voir la réponse'}</div>
        </div>
      </div>
      <div class="fc-actions">
        <button class="btn icon" data-action="precedente" title="Carte précédente (←)" ${etat.pos === 0 ? 'disabled' : ''}>${icone('fleche-g')}</button>
        ${etat.verso
          ? `<button class="btn bad" data-action="ko">${icone('croix')} À revoir</button>
             <button class="btn ok" data-action="ok">${icone('check')} Je savais</button>`
          : `<button class="btn primary" data-action="retourner">${icone('retourner')} Voir la réponse</button>`}
        <button class="btn icon" data-action="suivante" title="Carte suivante (→)" ${etat.pos >= etat.paquet.length - 1 ? 'disabled' : ''}>${icone('fleche-d')}</button>
      </div>
      <p class="fc-keys"><kbd>Espace</kbd> retourner · <kbd>←</kbd> <kbd>→</kbd> naviguer · <kbd>1</kbd> à revoir · <kbd>2</kbd> je savais</p>`;
  }

  function ecranFin() {
    const ok = [...etat.reponses.values()].filter((v) => v === 'ok').length;
    const ko = etat.reponses.size - ok;
    const pct = etat.reponses.size ? Math.round(100 * ok / etat.reponses.size) : 0;
    return `
      <div class="panel empty">
        <div class="m-ic">${icone('check')}</div>
        <h3>Bravo, séance terminée !</h3>
        <p class="muted">Tu as répondu « Je savais » à ${pct} % des cartes.</p>
        <div class="fc-score">
          <div class="panel"><div class="big ok">${ok}</div>${ok >= 2 ? 'sues' : 'sue'}</div>
          <div class="panel"><div class="big bad">${ko}</div>à revoir</div>
        </div>
        <div class="fc-actions">
          ${ko ? `<button class="btn primary" data-action="revoir">${icone('recommencer')} Revoir les ${pluriel(ko, 'carte')} ratée${ko >= 2 ? 's' : ''}</button>` : ''}
          <button class="btn" data-action="recommencer">${icone('recommencer')} Tout recommencer</button>
          <button class="btn" data-action="melanger">${icone('melanger')} Recommencer mélangé</button>
        </div>
      </div>`;
  }

  /* ---------- actions ---------- */
  function retourner() {
    if (etat.termine) return;
    const carte = conteneur.querySelector('.fc-card');
    if (!anime || !carte) { etat.verso = !etat.verso; afficher(); focusCarte(); return; }
    carte.classList.add('flip-out');
    setTimeout(() => { etat.verso = !etat.verso; afficher(); focusCarte(); }, 160);
  }
  function aller(delta) {
    const p = etat.pos + delta;
    if (etat.termine || p < 0 || p >= etat.paquet.length) return;
    etat.pos = p; etat.verso = false; afficher(); focusCarte();
  }
  function repondre(resultat) {
    if (etat.termine || !etat.verso) return;
    etat.reponses.set(etat.paquet[etat.pos].id, resultat);
    options.onReponse?.(etat.paquet[etat.pos], resultat); // branché à l'étape 4 (Leitner)
    // Carte suivante sans réponse, sinon fin de séance.
    const restante = etat.paquet.findIndex((c, i) => i > etat.pos && !etat.reponses.has(c.id));
    const avant = etat.paquet.findIndex((c) => !etat.reponses.has(c.id));
    const prochaine = restante >= 0 ? restante : avant;
    if (prochaine < 0) { etat.termine = true; afficher(); return; }
    etat.pos = prochaine; etat.verso = false; afficher(); focusCarte();
  }
  const focusCarte = () => conteneur.querySelector('.fc-card')?.focus({ preventScroll: true });

  const actions = {
    retourner,
    precedente: () => aller(-1),
    suivante: () => aller(1),
    ok: () => repondre('ok'),
    ko: () => repondre('ko'),
    melanger: () => nouvelleSeance(melanger(cartesFiltrees())),
    recommencer: () => nouvelleSeance(cartesFiltrees()),
    revoir: () => nouvelleSeance(etat.paquet.filter((c) => etat.reponses.get(c.id) === 'ko')),
  };

  /* ---------- évènements ---------- */
  let swipe = null;
  let ignorerClic = false;
  conteneur.addEventListener('click', (e) => {
    if (ignorerClic) { ignorerClic = false; return; }
    if (e.target.closest('.pg')) return; // la pastille de source affiche son détail (app.js)
    const cible = e.target.closest('[data-action]');
    if (!cible || cible.tagName === 'SELECT' || cible.disabled) return;
    actions[cible.dataset.action]?.();
  });
  conteneur.addEventListener('change', (e) => {
    if (e.target.dataset.action === 'filtre') { etat.filtre = e.target.value; nouvelleSeance(cartesFiltrees()); }
  });
  // Glisser horizontalement sur la carte (tablette) : carte suivante / précédente.
  conteneur.addEventListener('touchstart', (e) => {
    if (e.target.closest('.fc-card')) swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  conteneur.addEventListener('touchend', (e) => {
    if (!swipe) return;
    const dx = e.changedTouches[0].clientX - swipe.x;
    const dy = e.changedTouches[0].clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { ignorerClic = true; aller(dx < 0 ? 1 : -1); }
  });

  function clavier(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return; // laisse le bouton agir
    const k = e.key;
    if (k === ' ' || k === 'Enter') { e.preventDefault(); retourner(); }
    else if (k === 'ArrowRight') { e.preventDefault(); aller(1); }
    else if (k === 'ArrowLeft') { e.preventDefault(); aller(-1); }
    else if (k === '1') repondre('ko');
    else if (k === '2') repondre('ok');
  }
  document.addEventListener('keydown', clavier);

  nouvelleSeance(cartesFiltrees());
  return () => document.removeEventListener('keydown', clavier);
}
