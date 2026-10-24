/* =====================================================================
   PROPOSER — boîte à idées : chacun peut proposer une correction ou une
   amélioration ; l'auteur de l'appli reçoit la proposition et décide seul.
   ---------------------------------------------------------------------
   Envoi au formulaire Formspree configuré dans config.js (pas de compte à créer
   pour les élèves). Hors ligne, la proposition est gardée et renvoyée plus tard.
   Rien d'autre n'est envoyé : ni la progression, ni la clé, ni le mot de passe.
   ===================================================================== */

import { esc, toast, stockage } from './utils.js';
import { icone } from './icones.js';
import { CONFIG } from './config.js';
import { matiere, infoChapitre } from './store.js';

const TYPES = [
  ['erreur', 'Erreur à corriger'], ['amelioration', 'Amélioration'],
  ['exercice', 'Nouvel exercice'], ['autre', 'Autre idée'],
];
let contexteExo = null;   // exercice affiché (renseigné par exercices.js)
export function definirExerciceCourant(c) { contexteExo = c; }

export const estAuteur = () => stockage.lire('auteur', false) === true;
export const boiteActive = () => !!CONFIG.formulaire;

/** Où est l'élève ? (matière, chapitre, onglet, exercice) */
function contexte() {
  const [page, mid, cid, onglet] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const c = { lien: location.href, resume: 'Général' };
  if (page === 'dessin') {
    c.matiere = 'Dessin technique'; c.onglet = 'atelier';
    c.resume = contexteExo && mid ? `Atelier dessin › ${contexteExo.titre} (${mid}/${cid})` : 'Atelier dessin';
    if (contexteExo && mid) c.exercice = `${contexteExo.titre} (${mid}/${cid})`;
    return c;
  }
  if (page !== 'm' || !mid) return c;
  const m = matiere(mid); const ch = cid ? infoChapitre(mid, cid) : null;
  c.matiere = m?.nom || mid;
  const morceaux = [m?.court || m?.nom || mid];
  if (ch) {
    c.chapitre = `${ch.ordre}. ${ch.titre}`;
    c.onglet = onglet || 'synthese';
    morceaux.push(`Ch. ${ch.ordre} – ${ch.titre}`, { synthese: 'Synthèse', flashcards: 'Flashcards', exercices: 'Exercices' }[c.onglet] || c.onglet);
    if (c.onglet === 'exercices' && contexteExo) { c.exercice = `${contexteExo.num}. ${contexteExo.titre} (${contexteExo.id})`; morceaux.push(`Exercice ${contexteExo.num} : ${contexteExo.titre}`); }
  }
  c.resume = morceaux.join(' › ');
  return c;
}

async function envoyer(donnees) {
  const rep = await fetch(CONFIG.formulaire, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(donnees),
  });
  if (!rep.ok) throw new Error(`erreur ${rep.status}`);
}

/** Renvoie les propositions restées en attente (hors ligne). */
export async function viderAttente() {
  const attente = stockage.lire('propositions.attente', []);
  if (!attente.length || !navigator.onLine || !boiteActive()) return;
  const restantes = [];
  for (const d of attente) { try { await envoyer(d); } catch { restantes.push(d); } }
  stockage.ecrire('propositions.attente', restantes);
  if (restantes.length < attente.length) toast(`${attente.length - restantes.length} proposition(s) en attente envoyée(s). Merci !`, 4000);
}
window.addEventListener('online', viderAttente);

export function ouvrirProposition(typeParDefaut = 'erreur') {
  document.querySelector('.prop-fond')?.remove();
  const c = contexte();
  const moi = stockage.lire('propositions.moi', { nom: '', contact: '' });
  const fond = document.createElement('div');
  fond.className = 'visio-fond prop-fond';
  fond.innerHTML = `
    <form class="panel prop" role="dialog" aria-modal="true" aria-labelledby="prop-titre" novalidate>
      <div class="prop-tete">
        <h3 id="prop-titre">${icone('ampoule')} Proposer une amélioration</h3>
        <button class="btn icon" type="button" data-p="fermer" title="Fermer">${icone('croix')}</button>
      </div>
      ${!boiteActive() ? `<p class="notice">${icone('info')} La boîte à idées n'est pas encore activée.</p>` : ''}
      <p class="muted">Une erreur, un exercice à ajouter, une idée ? Ta proposition est envoyée à <b>${esc(CONFIG.auteur)}</b>,
        qui la relit et décide de ce qui sera intégré dans l'appli.</p>
      <div class="prop-ctx">
        <label><input type="checkbox" name="ici" checked> Concerne : <b>${esc(c.resume)}</b></label>
      </div>
      <fieldset class="prop-types"><legend>C'est…</legend>
        ${TYPES.map(([v, l]) => `<label class="chip"><input type="radio" name="type" value="${v}" ${v === typeParDefaut ? 'checked' : ''}><span>${l}</span></label>`).join('')}
      </fieldset>
      <label class="prop-l">Ta proposition <span class="muted">(sois précis : où, quoi, et ce qu'il faudrait mettre)</span>
        <textarea class="field" name="message" rows="6" maxlength="4000" required placeholder="Ex. : exercice 4, item c) : la réponse devrait être 2√3 et pas 3√2, car…"></textarea></label>
      <div class="prop-2">
        <label class="prop-l">Prénom <span class="muted">(facultatif)</span><input class="field" name="nom" maxlength="60" value="${esc(moi.nom)}" autocomplete="given-name"></label>
        <label class="prop-l">E-mail pour te répondre <span class="muted">(facultatif)</span><input class="field" name="contact" type="email" maxlength="120" value="${esc(moi.contact)}" autocomplete="email"></label>
      </div>
      <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" class="prop-piege" aria-hidden="true">
      <p class="prop-err notice" hidden></p>
      <div class="prop-actions">
        <button class="btn" type="button" data-p="fermer">Annuler</button>
        <button class="btn primary" type="submit" ${boiteActive() ? '' : 'disabled'}>${icone('check')} Envoyer</button>
      </div>
    </form>`;
  document.body.appendChild(fond);
  document.body.classList.add('visio-ouverte');
  const form = fond.querySelector('form');
  const err = fond.querySelector('.prop-err');
  const fermer = () => { fond.remove(); document.body.classList.remove('visio-ouverte'); document.removeEventListener('keydown', clavier, true); };
  const clavier = (e) => { if (e.key === 'Escape') { e.preventDefault(); fermer(); } };
  document.addEventListener('keydown', clavier, true);
  fond.addEventListener('click', (e) => { if (e.target === fond || e.target.closest('[data-p=fermer]')) fermer(); });
  form.message.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = form.message.value.trim();
    if (message.length < 10) { err.hidden = false; err.textContent = 'Écris au moins quelques mots pour expliquer ta proposition.'; form.message.focus(); return; }
    if (form._gotcha.value) { fermer(); return; } // robot
    const nom = form.nom.value.trim(); const contact = form.contact.value.trim();
    stockage.ecrire('propositions.moi', { nom, contact });
    const ici = form.ici.checked;
    const type = TYPES.find(([v]) => v === form.type.value)?.[1] || 'Autre';
    const donnees = {
      _subject: `[Révisions] ${type}${ici ? ` — ${c.resume}` : ''}`,
      type, message, prenom: nom || '(anonyme)', ...(contact ? { email: contact } : {}),
      ...(ici ? { concerne: c.resume, matiere: c.matiere, chapitre: c.chapitre, onglet: c.onglet, exercice: c.exercice, lien: c.lien } : {}),
      envoye_le: new Date().toLocaleString('fr-BE'),
    };
    const bouton = form.querySelector('[type=submit]');
    bouton.disabled = true; bouton.textContent = 'Envoi…';
    try {
      await envoyer(donnees);
      fermer(); toast(`Merci ! Ta proposition a été envoyée à ${CONFIG.auteur}.`, 4500);
    } catch (ex) {
      if (!navigator.onLine || ex instanceof TypeError) {
        const attente = stockage.lire('propositions.attente', []); attente.push(donnees);
        stockage.ecrire('propositions.attente', attente);
        fermer(); toast('Pas de connexion : ta proposition est gardée et partira automatiquement plus tard.', 5000);
      } else {
        err.hidden = false; err.textContent = `L'envoi a échoué (${ex.message}). Réessaie dans un moment.`;
        bouton.disabled = false; bouton.innerHTML = `${icone('check')} Envoyer`;
      }
    }
  });
}

/** Bouton « Proposer » de la barre du haut (caché pour l'auteur). */
export function majBoutonProposer() {
  let b = document.getElementById('btn-proposer');
  if (!b) {
    b = document.createElement('button');
    b.id = 'btn-proposer'; b.type = 'button'; b.className = 'btn btn-proposer';
    b.title = 'Proposer une correction ou une amélioration';
    b.innerHTML = `${icone('ampoule')}<span>Proposer</span>`;
    b.addEventListener('click', () => ouvrirProposition());
    document.querySelector('.top-actions')?.prepend(b);
  }
  b.hidden = estAuteur() || !boiteActive();
}

export function devenirAuteur(oui) { stockage.ecrire('auteur', !!oui); majBoutonProposer(); }
