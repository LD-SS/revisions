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
import { revolution } from './revolution.js';
import { SERIES_CAHIER } from './cahier.js';

const P = (id, nom, prof, profil, trous = []) => ({ id: `cat-${id}`, nom, prof, profil, trous });
const RV = (id, nom, etages, trous = []) => revolution({ id: `cat-${id}`, nom, etages, trous });

export const SERIES = [
  {
    id: 'cylindres', titre: 'Cylindres et intersections cylindre / plan',
    intro: 'Un cylindre se voit en rectangle d\'un côté et en cercle de l\'autre, toujours avec son axe. Un méplat (plan qui coupe le cylindre) donne une ligne droite dans une vue et une corde dans la vue de gauche. « méplat à 24 » : hauteur restante depuis le dessous ; « plats 14 » : distance entre les deux plats.',
    exos: [
      { titre: 'Axe épaulé', niveau: 1, mode: 'vues', piece: RV('axe-epaule', 'Axe épaulé', [{ l: 25, d: 30 }, { l: 40, d: 20 }]) },
      { titre: 'Arbre à collerette', niveau: 1, mode: 'vues', piece: RV('collerette', 'Arbre à collerette', [{ l: 25, d: 20 }, { l: 12, d: 36 }, { l: 35, d: 24 }]) },
      { titre: 'Axe à méplat', niveau: 2, mode: 'vues', piece: RV('meplat', 'Axe à méplat', [{ l: 45, d: 30 }, { l: 25, d: 30, plat: 24 }]) },
      { titre: 'Tenon à deux plats', niveau: 2, mode: 'vues', piece: RV('tenon', 'Tenon à deux plats', [{ l: 20, d: 24, plats: 14 }, { l: 45, d: 24 }]) },
      { titre: 'Axe percé', niveau: 2, mode: 'vues', piece: RV('axe-perce', 'Axe percé', [{ l: 30, d: 32 }, { l: 45, d: 20 }], [{ axe: 'z', x: 55, d: 6 }]) },
      { titre: 'Arbre à plats et goupille', niveau: 3, mode: 'vues', piece: RV('arbre-plats', 'Arbre à plats et goupille', [{ l: 18, d: 22, platsY: 16 }, { l: 30, d: 34 }, { l: 40, d: 26 }], [{ axe: 'y', x: 70, d: 6 }]) },
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

// ids d'exercice : <série>-<n°> ; les séries du cahier (exercices par type) passent en premier
for (const s of SERIES) s.exos.forEach((e, i) => { e.id = `${s.id}-${i + 1}`; e.serie = s.id; });
for (const s of SERIES_CAHIER) for (const e of s.exos) e.serie = s.id;
SERIES.unshift(...SERIES_CAHIER);
export const EXERCICES = SERIES.flatMap((s) => s.exos);
enregistrerPieces(EXERCICES.map((e) => e.piece));

export const NOMS_MODES = { completer: 'Vues à compléter', vues: '3 vues', cotes: 'Cotation', coupe: 'Coupe A-A', demi: 'Demi-coupe', section: 'Section B-B', locale: 'Coupe locale', iso: 'Isométrique', cav: 'Cavalière' };
