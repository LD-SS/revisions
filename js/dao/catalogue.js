/* =====================================================================
   CATALOGUE D'EXERCICES DE L'ATELIER (nouveau logiciel de dessin)
   ---------------------------------------------------------------------
   Séries dans l'ordre de progression des cahiers d'exercices rapides
   de dessin industriel (thèmes seulement) : toutes les pièces ci-dessous
   ont été inventées pour l'appli, aucune n'est reprise d'un livre.
   Exercice : { id, titre, niveau 1-3, mode ('vues' | 'cotes' | 'coupe' |
   'demi' | 'section' | 'locale' | 'iso' | 'cav'), piece }.
   Pièce : profil extrudé (voir js/dao/pieces.js).
   ===================================================================== */

import { enregistrerPieces } from './pieces.js';

const P = (id, nom, prof, profil, trous = []) => ({ id: `cat-${id}`, nom, prof, profil, trous });

export const SERIES = [
  {
    id: 'lecture', titre: 'Lecture de dessin : entailles, chanfreins, trous',
    intro: 'Dessine les 3 vues (face, dessus, gauche) à partir de la perspective cotée. Les arêtes cachées en traits interrompus.',
    exos: [
      { titre: 'Bloc entaillé', niveau: 1, mode: 'vues', piece: P('bloc-entaille', 'Bloc entaillé', 30, [[0, 0], [60, 0], [60, 20], [35, 20], [35, 40], [0, 40]]) },
      { titre: 'Rainure en U', niveau: 1, mode: 'vues', piece: P('rainure-u', 'Rainure en U', 35, [[0, 0], [70, 0], [70, 30], [45, 30], [45, 18], [25, 18], [25, 30], [0, 30]]) },
      { titre: 'Chanfrein simple', niveau: 1, mode: 'vues', piece: P('chanfrein', 'Chanfrein simple', 30, [[0, 0], [70, 0], [70, 25], [55, 40], [0, 40]]) },
      { titre: 'Bloc percé vertical', niveau: 1, mode: 'vues', piece: P('perce-z', 'Bloc percé vertical', 40, [[0, 0], [60, 0], [60, 25], [0, 25]], [{ axe: 'z', x: 18, y: 20, d: 10 }, { axe: 'z', x: 44, y: 20, d: 8 }]) },
      { titre: 'Bloc percé horizontal', niveau: 1, mode: 'vues', piece: P('perce-y', 'Bloc percé horizontal', 30, [[0, 0], [50, 0], [50, 40], [0, 40]], [{ axe: 'y', x: 25, z: 20, d: 14 }]) },
      { titre: 'Double chanfrein percé', niveau: 2, mode: 'vues', piece: P('double-chanfrein', 'Double chanfrein percé', 30, [[0, 0], [70, 0], [70, 25], [58, 35], [12, 35], [0, 25]], [{ axe: 'y', x: 35, z: 15, d: 10 }]) },
      { titre: 'Équerre entaillée percée', niveau: 2, mode: 'vues', piece: P('entaille-percee', 'Équerre entaillée percée', 30, [[0, 0], [80, 0], [80, 15], [55, 15], [55, 35], [0, 35]], [{ axe: 'y', x: 25, z: 20, d: 10 }, { axe: 'z', x: 68, y: 15, d: 8 }]) },
      { titre: 'Support en T percé', niveau: 3, mode: 'vues', piece: P('te-perce', 'Support en T percé', 30, [[0, 0], [80, 0], [80, 12], [50, 12], [50, 45], [30, 45], [30, 12], [0, 12]], [{ axe: 'z', x: 12, y: 15, d: 8 }, { axe: 'z', x: 68, y: 15, d: 8 }, { axe: 'y', x: 40, z: 32, d: 10 }]) },
    ],
  },
  {
    id: 'plans', titre: 'Intersections de plans (faces inclinées)',
    intro: 'Une face inclinée se voit en vraie grandeur dans aucune vue : repère ses arêtes avec les lignes de rappel.',
    exos: [
      { titre: 'Bloc à pente', niveau: 2, mode: 'vues', piece: P('pente', 'Bloc à pente', 35, [[0, 0], [70, 0], [70, 15], [30, 40], [0, 40]]) },
      { titre: 'Bloc en toit', niveau: 2, mode: 'vues', piece: P('toit', 'Bloc en toit', 40, [[0, 0], [60, 0], [60, 25], [30, 40], [0, 25]]) },
      { titre: 'Pente et marche percées', niveau: 3, mode: 'vues', piece: P('pente-marche', 'Pente et marche percées', 30, [[0, 0], [80, 0], [80, 15], [60, 15], [40, 35], [0, 35]], [{ axe: 'z', x: 20, y: 15, d: 8 }]) },
      { titre: 'Glissière en queue d\'aronde', niveau: 3, mode: 'vues', piece: P('aronde', 'Glissière en queue d\'aronde', 40, [[0, 0], [70, 0], [70, 30], [55, 30], [50, 18], [20, 18], [15, 30], [0, 30]]) },
    ],
  },
  {
    id: 'coupes', titre: 'Les coupes',
    intro: 'Coupe : on enlève la partie avant, on hachure la matière coupée, les trous restent vides, pas de traits cachés.',
    exos: [
      { titre: 'Semelle percée', niveau: 1, mode: 'coupe', piece: P('semelle', 'Semelle percée', 40, [[0, 0], [70, 0], [70, 20], [0, 20]], [{ axe: 'z', x: 35, y: 20, d: 12 }]) },
      { titre: 'Palier à deux trous', niveau: 2, mode: 'coupe', piece: P('palier', 'Palier à deux trous', 30, [[0, 0], [80, 0], [80, 15], [55, 15], [55, 40], [25, 40], [25, 15], [0, 15]], [{ axe: 'z', x: 12, y: 15, d: 8 }, { axe: 'z', x: 68, y: 15, d: 8 }]) },
      { titre: 'Bloc en T (demi-coupe)', niveau: 2, mode: 'demi', piece: P('demi-te', 'Bloc en T', 30, [[0, 0], [70, 0], [70, 15], [45, 15], [45, 40], [25, 40], [25, 15], [0, 15]], [{ axe: 'z', x: 35, y: 15, d: 10 }]) },
      { titre: 'Palier percé (demi-coupe)', niveau: 3, mode: 'demi', piece: P('demi-palier', 'Palier percé', 30, [[0, 0], [80, 0], [80, 15], [55, 15], [55, 40], [25, 40], [25, 15], [0, 15]], [{ axe: 'z', x: 12, y: 15, d: 8 }, { axe: 'z', x: 68, y: 15, d: 8 }, { axe: 'z', x: 40, y: 15, d: 12 }]) },
      { titre: 'Barre percée (section sortie)', niveau: 2, mode: 'section', piece: P('section', 'Barre percée', 30, [[0, 0], [80, 0], [80, 20], [0, 20]], [{ axe: 'z', x: 40, y: 15, d: 10 }]) },
      { titre: 'Bloc percé (coupe locale)', niveau: 2, mode: 'locale', piece: P('locale', 'Bloc percé', 36, [[0, 0], [70, 0], [70, 30], [0, 30]], [{ axe: 'z', x: 50, y: 18, d: 10 }]) },
    ],
  },
  {
    id: 'cavaliere', titre: 'Perspective cavalière',
    intro: 'Face avant en vraie grandeur, fuyantes à 45° réduites de moitié (k = 0,5).',
    exos: [
      { titre: 'Équerre', niveau: 1, mode: 'cav', piece: P('cav-equerre', 'Équerre', 30, [[0, 0], [60, 0], [60, 12], [12, 12], [12, 40], [0, 40]]) },
      { titre: 'Marche percée', niveau: 2, mode: 'cav', piece: P('cav-marche', 'Marche percée', 30, [[0, 0], [70, 0], [70, 20], [40, 20], [40, 40], [0, 40]], [{ axe: 'y', x: 20, z: 25, d: 10 }]) },
      { titre: 'Bloc chanfreiné percé', niveau: 2, mode: 'cav', piece: P('cav-chanfrein', 'Bloc chanfreiné percé', 30, [[0, 0], [70, 0], [70, 25], [55, 40], [0, 40]], [{ axe: 'y', x: 25, z: 20, d: 12 }]) },
    ],
  },
  {
    id: 'isometrique', titre: 'Perspective isométrique',
    intro: 'Les 3 axes à 120°, mêmes longueurs ; les trous en ellipses (méthode des 4 centres).',
    exos: [
      { titre: 'Bloc percé', niveau: 1, mode: 'iso', piece: P('iso-bloc', 'Bloc percé', 40, [[0, 0], [50, 0], [50, 30], [0, 30]], [{ axe: 'z', x: 25, y: 20, d: 12 }]) },
      { titre: 'Marche percée', niveau: 2, mode: 'iso', piece: P('iso-marche', 'Marche percée', 30, [[0, 0], [60, 0], [60, 15], [30, 15], [30, 35], [0, 35]], [{ axe: 'y', x: 15, z: 20, d: 8 }]) },
      { titre: 'Semelle à rainure', niveau: 3, mode: 'iso', piece: P('iso-rainure', 'Semelle à rainure', 40, [[0, 0], [80, 0], [80, 25], [50, 25], [50, 15], [30, 15], [30, 25], [0, 25]], [{ axe: 'z', x: 12, y: 20, d: 8 }, { axe: 'z', x: 68, y: 20, d: 8 }]) },
    ],
  },
  {
    id: 'cotation', titre: 'Cotation',
    intro: 'Cote les 3 vues données : chaque arête et chaque axe une seule fois, les encombrements, le Ø des trous.',
    exos: [
      { titre: 'Équerre percée', niveau: 1, mode: 'cotes', piece: P('cot-equerre', 'Équerre percée', 30, [[0, 0], [60, 0], [60, 10], [12, 10], [12, 45], [0, 45]], [{ axe: 'z', x: 38, y: 15, d: 8 }]) },
      { titre: 'Bloc à marche percé', niveau: 2, mode: 'cotes', piece: P('cot-marche', 'Bloc à marche percé', 35, [[0, 0], [70, 0], [70, 20], [40, 20], [40, 40], [0, 40]], [{ axe: 'y', x: 18, z: 22, d: 10 }]) },
      { titre: 'Chape percée', niveau: 3, mode: 'cotes', piece: P('cot-chape', 'Chape percée', 30, [[0, 0], [60, 0], [60, 40], [45, 40], [45, 12], [15, 12], [15, 40], [0, 40]], [{ axe: 'z', x: 30, y: 15, d: 10 }]) },
    ],
  },
];

// ids d'exercice : <série>-<n°>
for (const s of SERIES) s.exos.forEach((e, i) => { e.id = `${s.id}-${i + 1}`; e.serie = s.id; });
export const EXERCICES = SERIES.flatMap((s) => s.exos);
enregistrerPieces(EXERCICES.map((e) => e.piece));

export const NOMS_MODES = { vues: '3 vues', cotes: 'Cotation', coupe: 'Coupe A-A', demi: 'Demi-coupe', section: 'Section B-B', locale: 'Coupe locale', iso: 'Isométrique', cav: 'Cavalière' };
