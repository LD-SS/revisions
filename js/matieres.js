/* =====================================================================
   MATIÈRES — profils de matière et types de blocs de synthèse
   ---------------------------------------------------------------------
   Une matière (dans content/index.json) a un « profil » qui décide :
     - des types d'exercices générés (étape 3),
     - du modèle de prompt envoyé à Claude (étape 2, js/ia/prompts.js).
   Pour un nouveau profil : ajouter une entrée dans PROFILS.
   Pour une nouvelle matière : il suffit d'utiliser un profil existant
   (« generique » si aucun ne convient).
   ===================================================================== */

export const PROFILS = {
  maths: {
    nom: 'Mathématiques',
    description: 'Calculs avec solution pas à pas, QCM, vrai/faux',
    typesExercices: ['calcul', 'qcm', 'vrai-faux'],
  },
  dessin: {
    nom: 'Dessin technique',
    description: 'Lecture de plan, vues, cotation, tolérances, normes, QCM',
    typesExercices: ['lecture-plan', 'qcm', 'vrai-faux', 'ouverte'],
  },
  electricite: {
    nom: 'Électricité',
    description: 'Calculs (lois, puissances, moteurs…), QCM, questions ouvertes',
    typesExercices: ['calcul', 'qcm', 'ouverte'],
  },
  generique: {
    nom: 'Général',
    description: 'QCM, vrai/faux, questions ouvertes',
    typesExercices: ['qcm', 'vrai-faux', 'ouverte'],
  },
};

/** Types de blocs d'une synthèse : libellé et icône affichés en tête du bloc. */
export const TYPES_BLOCS = {
  texte:       { libelle: '',               icone: null },
  definition:  { libelle: 'Définition',     icone: 'livre' },
  formule:     { libelle: 'Formule',        icone: 'fonction' },
  'point-cle': { libelle: 'À retenir',      icone: 'ampoule' },
  piege:       { libelle: 'Piège fréquent', icone: 'alerte' },
  exemple:     { libelle: 'Exemple',        icone: 'crayon' },
  liste:       { libelle: '',               icone: 'liste' },
  tableau:     { libelle: '',               icone: 'tableau' },
  figure:      { libelle: 'Figure',         icone: 'figure' },
};

export const profilDe = (matiere) => PROFILS[matiere?.profil] || PROFILS.generique;

/** Couleur de la matière, vérifiée (une couleur invalide ne doit pas casser le style). */
export function couleurDe(matiere) {
  const c = String(matiere?.couleur || '');
  return /^#[0-9a-f]{3,8}$/i.test(c) ? c : '#1d5fd1';
}

/** Attribut style à placer sur un élément .mc pour lui donner la couleur de la matière. */
export const styleMatiere = (matiere) => `style="--mc:${couleurDe(matiere)}"`;

/** Nom court pour les onglets (champ « court » facultatif dans index.json). */
export const nomCourt = (matiere) => matiere.court || matiere.nom;
