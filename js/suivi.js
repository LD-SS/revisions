/* =====================================================================
   SUIVI — progression gardée dans ce navigateur (et synchronisée)
   ---------------------------------------------------------------------
   exos   : { "<matière>/<chapitre>/<exercice>": { r: ok|mid|ko, n, d, t?: titre } }  (exercices.js)
   cours  : { "<matière>/<chapitre>/<leçon>/<question>": 1 }                         (cours.js)
   dernier: { h: '#/…', t: titre, s: sous-titre, d: date }          (bouton « Reprendre »)
   Exercices à refaire (révision espacée) : un exercice Faux revient 1 jour après,
   un Presque 3 jours après ; Juste le retire de la liste.
   ===================================================================== */

import { stockage } from './utils.js';

export const notesExos = () => stockage.lire('exos', {});

export function memoriserVisite(h, t, s = '') {
  stockage.ecrire('dernier', { h, t, s, d: Date.now() });
}
export const derniereVisite = () => stockage.lire('dernier', null);

/* ---------- révision espacée ---------- */
const DELAI = { ko: 1, mid: 3 };   // jours
const jour = (d) => new Date(`${d}T00:00:00`).getTime();
const aujourdhui = () => jour(new Date().toISOString().slice(0, 10));
/** Date (ms) à laquelle l'exercice revient, ou null s'il est réussi. */
export function retour(n) {
  if (!n || n.r === 'ok' || !DELAI[n.r]) return null;
  return (jour(n.d) || 0) + DELAI[n.r] * 86400000;
}
/** Exercices à refaire : { maintenant: [[clé, note]], plusTard: [[clé, note, date]] } (plus anciens d'abord). */
export function aRefaire() {
  const t = aujourdhui(); const maintenant = []; const plusTard = [];
  for (const [k, n] of Object.entries(notesExos())) {
    const r = retour(n); if (r === null) continue;
    (r <= t ? maintenant : plusTard).push([k, n, r]);
  }
  maintenant.sort((a, b) => a[2] - b[2]); plusTard.sort((a, b) => a[2] - b[2]);
  return { maintenant, plusTard };
}

/** Résumé par préfixe (matière ou matière/chapitre) : exercices réussis / à refaire. */
export function bilan(prefixe) {
  const p = `${prefixe}/`;
  return compter(Object.entries(notesExos()).filter(([k]) => k.startsWith(p)));
}
const compter = (ex) => ({
  reussis: ex.filter(([, n]) => n.r === 'ok').length,
  aRefaire: ex.filter(([, n]) => n.r !== 'ok').length,
  faits: ex.length,
});

/** Numéro du chapitre d'un exercice sur schéma d'après son id (« ch02-ex-01 » → ch02 ; « labo-… » → ch09, le labo des diodes). */
const numSchema = (id) => (id.startsWith('labo-') ? 'ch09' : id.match(/^ch\d+/)?.[0] || '');
/** Bilan d'un chapitre : ses exercices + ses exercices sur schéma (clés « <matière>/schemas/chNN-… »). */
export function bilanChapitre(m, c) {
  const p = `${m.id}/${c.id}/`; const s = `${m.id}/schemas/`; const num = c.id.match(/^ch\d+/)?.[0];
  return compter(Object.entries(notesExos()).filter(([k]) => k.startsWith(p) || (num && k.startsWith(s) && numSchema(k.slice(s.length)) === num)));
}
/** Chapitre (id) d'une clé d'exercice sur schéma, pour les liens. */
export function chapitreSchema(m, id) {
  const num = numSchema(id); return m?.chapitres.find((c) => c.id.startsWith(`${num}-`))?.id || null;
}

/** Leçons du cours réussies dans un préfixe (nombre de questions réussies). */
export function questionsCoursReussies(prefixe) {
  const p = `${prefixe}/`; return Object.keys(stockage.lire('cours', {}) || {}).filter((k) => k.startsWith(p) && !k.includes('#')).length;
}
