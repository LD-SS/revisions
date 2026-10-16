/* =====================================================================
   STORE — chargement du contenu publié (dossier content/)
   ---------------------------------------------------------------------
   content/index.json         liste des matières et de leurs chapitres
   content/<matiere>/<ch>.json  un fichier par chapitre (synthèse, flashcards, exercices)
   Les chapitres sont chargés à la demande puis gardés en mémoire.
   Étape 2 : une couche « brouillons » (IndexedDB, mode créateur) viendra se
   superposer au contenu publié, sans changer l'interface de ce module.
   ===================================================================== */

const FORMAT_SUPPORTE = 1;
let index = null;
const chapitresEnMemoire = new Map();

/** Charge (une seule fois) content/index.json. */
export async function chargerIndex() {
  if (index) return index;
  const donnees = await lireJson('content/index.json');
  if (!donnees || !Array.isArray(donnees.matieres)) {
    throw new Error('content/index.json est mal formé (liste « matieres » absente).');
  }
  if ((donnees.format || 1) > FORMAT_SUPPORTE) {
    console.warn('content/index.json utilise un format plus récent que cette version de l\'appli.');
  }
  donnees.matieres.sort(parOrdre);
  for (const m of donnees.matieres) {
    m.chapitres = Array.isArray(m.chapitres) ? m.chapitres.sort(parOrdre) : [];
  }
  index = donnees;
  return index;
}

export const matieres = () => index?.matieres || [];
export const matiere = (mid) => matieres().find((m) => m.id === mid) || null;
export const infoChapitre = (mid, cid) => matiere(mid)?.chapitres.find((c) => c.id === cid) || null;
export const dateContenu = () => index?.maj || null;

/** Chapitre précédent et suivant dans la même matière (pour la navigation). */
export function voisins(mid, cid) {
  const liste = matiere(mid)?.chapitres || [];
  const i = liste.findIndex((c) => c.id === cid);
  return { precedent: liste[i - 1] || null, suivant: liste[i + 1] || null };
}

/** Totaux d'une matière (calculés à partir des compteurs « nb » de l'index). */
export function totaux(m) {
  return m.chapitres.reduce((t, c) => ({
    chapitres: t.chapitres + 1,
    flashcards: t.flashcards + (c.nb?.flashcards || 0),
    exercices: t.exercices + (c.nb?.exercices || 0),
  }), { chapitres: 0, flashcards: 0, exercices: 0 });
}

/** Charge le contenu complet d'un chapitre. */
export async function chargerChapitre(mid, cid) {
  const cle = `${mid}/${cid}`;
  if (chapitresEnMemoire.has(cle)) return chapitresEnMemoire.get(cle);
  const info = infoChapitre(mid, cid);
  if (!info) throw new Error(`Chapitre introuvable : ${cle}`);
  const ch = await lireJson(`content/${info.fichier}`);
  // Valeurs par défaut : l'affichage ne doit jamais planter sur un champ manquant.
  ch.synthese = ch.synthese || { sections: [] };
  ch.synthese.sections = Array.isArray(ch.synthese.sections) ? ch.synthese.sections : [];
  ch.flashcards = Array.isArray(ch.flashcards) ? ch.flashcards : [];
  ch.exercices = Array.isArray(ch.exercices) ? ch.exercices : [];
  ch.source = ch.source || {};
  chapitresEnMemoire.set(cle, ch);
  return ch;
}

/* ---------- interne ---------- */
function parOrdre(a, b) { return (a.ordre ?? 999) - (b.ordre ?? 999); }

async function lireJson(chemin) {
  let rep;
  try {
    rep = await fetch(chemin, { cache: 'no-cache' });
  } catch (e) {
    throw new Error(`Impossible de charger ${chemin} (pas de connexion et pas de copie hors ligne).`);
  }
  if (!rep.ok) throw new Error(`Impossible de charger ${chemin} (erreur ${rep.status}).`);
  try {
    return await rep.json();
  } catch (e) {
    throw new Error(`${chemin} n'est pas un JSON valide : ${e.message}`);
  }
}
