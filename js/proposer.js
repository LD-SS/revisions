/* =====================================================================
   SIGNALER UNE ERREUR — ouvre la messagerie de l'élève avec un message
   pré-rempli (où il se trouve dans l'appli), adressé à l'auteur.
   Aucun service tiers : c'est un simple lien « mailto: ».
   ===================================================================== */

import { CONFIG } from './config.js';
import { matiere, infoChapitre } from './store.js';

let contexteExo = null;   // exercice affiché (renseigné par exercices.js)
export function definirExerciceCourant(c) { contexteExo = c; }

/** L'auteur (l'administrateur) ne voit pas les boutons « Signaler ». */
export const estAuteur = () => !!window.__admin;
export const boiteActive = () => !!CONFIG.admin;

/** Où est l'élève ? (matière › chapitre › onglet › exercice) */
function contexte() {
  const [page, mid, cid, onglet] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  if (page !== 'm' || !mid) return page ? `Page « ${page} »` : 'Accueil';
  const m = matiere(mid); const ch = cid && cid !== 'schemas' ? infoChapitre(mid, cid) : null;
  const morceaux = [m?.nom || mid];
  if (cid === 'schemas') morceaux.push('Exercices sur schéma');
  if (ch) morceaux.push(`Ch. ${ch.ordre} – ${ch.titre}`, onglet || 'synthese');
  if (contexteExo) morceaux.push(`exercice ${contexteExo.num || ''} : ${contexteExo.titre}`);
  return morceaux.join(' › ');
}

export function ouvrirProposition() {
  const ou = contexte();
  const sujet = `Révisions — erreur signalée (${ou})`.slice(0, 180);
  const corps = `Endroit : ${ou}\nLien : ${location.href}\n\nCe qui ne va pas :\n\n`;
  location.href = `mailto:${CONFIG.admin}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
}

// Anciennes fonctions de la boîte à idées : plus rien à faire.
export function viderAttente() {}
export function majBoutonProposer() { document.getElementById('btn-proposer')?.remove(); }
export function devenirAuteur() {}
