/* =====================================================================
   CAHIER D'EXERCICES DE DESSIN (Atelier + version imprimable)
   ---------------------------------------------------------------------
   Exercices du même TYPE que ceux des cahiers d'exercices rapides
   (vues incomplètes à terminer, rectangle capable, arête repérée…),
   mais toutes les pièces, cotes et énoncés ont été inventés pour l'appli.
   Exercice : { n, titre, type, matiere, echelle, piece (prisme),
                donne: { face, dessus, gauche } : 'complet' | 'contour' | 'rien',
                donnees: [..], exercice: [..] }
   ===================================================================== */

import { prisme } from './prisme.js';
import { ARETES } from './cahier-aretes.js';

export const TYPES = {
  terminer: { titre: 'Vues incomplètes à terminer', intro: 'La vue de face est complète, les autres vues sont seulement esquissées (leur contour). Termine-les : arêtes vues en trait fort, cachées en interrompu, axes en mixte.' },
  rectangle: { titre: 'Rectangle capable', intro: 'Une vue manque entièrement : esquisse son rectangle capable (encombrement, avec les lignes de rappel), puis les détails, puis fais la mise au net.' },
};

const P = (id, nom, def) => prisme({ id: `cah-${id}`, nom, ...def });
const vue = { face: 'vue de face', dessus: 'vue de dessus', gauche: 'vue de gauche' };

/** Textes types (données / exercice) selon ce qui est donné. */
function textes(ex) {
  const d = ex.donne, nom = ex.piece.nom.toLowerCase();
  const complets = Object.keys(d).filter((k) => d[k] === 'complet').map((k) => vue[k]);
  const contours = Object.keys(d).filter((k) => d[k] === 'contour').map((k) => vue[k]);
  const manque = Object.keys(d).filter((k) => d[k] === 'rien').map((k) => vue[k]);
  const liste = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} et ${a[a.length - 1]}` : a[0]);
  const donnees = [];
  if (complets.length) donnees.push(`la ${liste(complets)} complète${complets.length > 1 ? 's' : ''} ;`);
  if (contours.length) donnees.push(`le contour de la ${liste(contours)} (vue${contours.length > 1 ? 's' : ''} incomplète${contours.length > 1 ? 's' : ''}) d'un${/^(bride|butée|chape|semelle|équerre)/.test(nom) ? 'e' : ''} ${nom} ;`);
  if (manque.length) donnees.push(`la perspective cotée de la pièce.`);
  else donnees.push('la perspective cotée de la pièce.');
  const exercice = [];
  if (ex.type === 'rectangle') {
    exercice.push(`Esquisser le rectangle capable de la ${liste(manque)}.`, 'Esquisser les détails sur toutes les vues.', 'Faire la mise au net.');
  } else {
    exercice.push('Reconnaître les vues dessinées.', `Terminer la ${liste(contours)} (arêtes vues, arêtes cachées, axes).`);
  }
  if (ex.piece.arete) exercice.push('Repasser en rouge, sur toutes les vues, l\'arête repérée sur la perspective.');
  return { donnees, exercice };
}

const EX = [
  { n: 1, titre: 'ENTAILLES ET RAINURE', type: 'terminer', matiere: 'Acier S235', echelle: '1:1', donne: { face: 'complet', dessus: 'contour', gauche: 'contour' },
    piece: P('1', 'Bloc entaillé rainuré', { L: 60, P: 30, H: 45, fxz: [[0, 0], [60, 0], [60, 30], [45, 30], [45, 45], [0, 45]], fxy: [[0, 0], [22, 0], [22, 10], [38, 10], [38, 0], [60, 0], [60, 30], [0, 30]], arete: [[22, 10, 0], [22, 10, 45]] }) },
  { n: 2, titre: 'ÉQUERRE À TALON', type: 'rectangle', matiere: 'Acier C35', echelle: '1:1', donne: { face: 'complet', dessus: 'rien', gauche: 'complet' },
    piece: P('2', 'Équerre à talon', { L: 70, P: 40, H: 55, fxz: [[0, 0], [70, 0], [70, 12], [14, 12], [14, 55], [0, 55]], fyz: [[0, 0], [40, 0], [40, 12], [30, 12], [30, 55], [10, 55], [10, 12], [0, 12]], arete: [[14, 10, 12], [14, 30, 12]] }) },
  { n: 3, titre: 'BRIDE À ENCOCHE', type: 'terminer', matiere: 'Acier C45', echelle: '1:1', donne: { face: 'complet', dessus: 'contour', gauche: 'contour' },
    piece: P('3', 'Bride à encoche', { L: 80, P: 30, H: 25, fxz: [[0, 0], [80, 0], [80, 10], [60, 25], [0, 25]], fxy: [[0, 0], [80, 0], [80, 30], [0, 30], [0, 20], [25, 20], [25, 10], [0, 10]], trous: [{ axe: 'z', x: 45, y: 15, d: 8 }] }) },
  { n: 4, titre: 'BUTÉE À GRADINS', type: 'rectangle', matiere: 'Acier S275', echelle: '1:1', donne: { face: 'complet', dessus: 'complet', gauche: 'rien' },
    piece: P('4', 'Butée à gradins', { L: 60, P: 40, H: 40, fxz: [[0, 0], [60, 0], [60, 15], [40, 15], [40, 28], [20, 28], [20, 40], [0, 40]], fyz: [[0, 0], [40, 0], [40, 25], [25, 40], [0, 40]], arete: [[0, 25, 40], [20, 25, 40]] }) },
  { n: 5, titre: 'PORTE-OUTIL', type: 'terminer', matiere: 'Acier 42CrMo4', echelle: '1:1', donne: { face: 'complet', dessus: 'contour', gauche: 'contour' },
    piece: P('5', 'Porte-outil', { L: 80, P: 35, H: 30, fxz: [[0, 0], [80, 0], [80, 30], [55, 30], [55, 18], [0, 18]], fxy: [[0, 0], [80, 0], [80, 35], [0, 35], [0, 25], [10, 25], [10, 10], [0, 10]], fyz: [[0, 0], [35, 0], [35, 24], [29, 30], [6, 30], [0, 24]] }) },
  { n: 6, titre: 'BRIDE DE SERRAGE', type: 'rectangle', matiere: 'Acier C35', echelle: '1:1', donne: { face: 'complet', dessus: 'complet', gauche: 'rien' },
    piece: P('6', 'Bride de serrage', { L: 90, P: 30, H: 25, fxz: [[0, 0], [90, 0], [90, 15], [70, 25], [0, 25]], fxy: [[0, 0], [90, 0], [90, 10], [75, 10], [75, 20], [90, 20], [90, 30], [0, 30]], trous: [{ axe: 'z', x: 30, y: 15, d: 10 }], arete: [[70, 0, 25], [70, 30, 25]] }) },
  { n: 7, titre: 'VÉ DE SERRAGE', type: 'rectangle', matiere: 'Acier S235', echelle: '1:1', donne: { face: 'complet', dessus: 'complet', gauche: 'rien' },
    piece: P('7', 'Vé de serrage', { L: 60, P: 40, H: 40, fxz: [[0, 0], [60, 0], [60, 40], [45, 40], [30, 25], [15, 40], [0, 40]], fyz: [[0, 0], [15, 0], [15, 6], [25, 6], [25, 0], [40, 0], [40, 40], [0, 40]], arete: [[30, 0, 25], [30, 40, 25]] }) },
  { n: 8, titre: 'COULISSEAU', type: 'terminer', matiere: 'Fonte EN-GJL-250', echelle: '1:1', donne: { face: 'complet', dessus: 'contour', gauche: 'contour' },
    piece: P('8', 'Coulisseau', { L: 70, P: 40, H: 30, fxz: [[0, 0], [70, 0], [70, 20], [55, 20], [55, 30], [15, 30], [15, 20], [0, 20]], fyz: [[0, 0], [12, 0], [12, 8], [28, 8], [28, 0], [40, 0], [40, 30], [0, 30]], trous: [{ axe: 'z', x: 35, y: 20, d: 10 }] }) },
  { n: 9, titre: 'CHAPE', type: 'terminer', matiere: 'Acier C45', echelle: '1:1', donne: { face: 'complet', dessus: 'contour', gauche: 'contour' },
    piece: P('9', 'Chape', { L: 50, P: 40, H: 50, fxz: [[0, 0], [50, 0], [50, 50], [38, 50], [38, 18], [12, 18], [12, 50], [0, 50]], fyz: [[0, 0], [40, 0], [40, 32], [30, 50], [10, 50], [0, 32]], trous: [{ axe: 'x', y: 20, z: 36, d: 10 }] }) },
  { n: 10, titre: 'SEMELLE', type: 'rectangle', matiere: 'Acier S275', echelle: '1:1', donne: { face: 'complet', dessus: 'rien', gauche: 'complet' },
    piece: P('10', 'Semelle', { L: 90, P: 50, H: 20, fxz: [[0, 0], [30, 0], [30, 6], [60, 6], [60, 0], [90, 0], [90, 20], [0, 20]], fxy: [[8, 0], [82, 0], [90, 8], [90, 42], [82, 50], [8, 50], [0, 42], [0, 8]], trous: [{ axe: 'z', x: 15, y: 25, d: 10 }, { axe: 'z', x: 75, y: 25, d: 10 }] }) },
  { n: 11, titre: 'COULISSEAU ORIENTABLE', type: 'rectangle', matiere: 'Fonte EN-GJS-400', echelle: '1:1', donne: { face: 'complet', dessus: 'complet', gauche: 'rien' },
    piece: P('11', 'Coulisseau orientable', { L: 70, P: 40, H: 35, fyz: [[0, 0], [40, 0], [40, 35], [28, 35], [28, 20], [12, 20], [12, 35], [0, 35]], fxy: [[0, 0], [55, 0], [70, 15], [70, 40], [0, 40]], arete: [[55, 0, 0], [55, 0, 35]] }) },
  { n: 12, titre: 'ENTAILLE ET PLAN INCLINÉ', type: 'rectangle', matiere: 'Acier S235', echelle: '1:1', donne: { face: 'complet', dessus: 'rien', gauche: 'complet' },
    piece: P('12', 'Bloc à plan incliné', { L: 70, P: 40, H: 40, fxz: [[0, 0], [70, 0], [70, 20], [40, 40], [0, 40]], fyz: [[0, 0], [40, 0], [40, 40], [25, 40], [25, 28], [0, 28]], arete: [[40, 25, 40], [58, 25, 28]] }) },
  { n: 13, titre: 'ÉLÉMENT D\'ÉTAU', type: 'terminer', matiere: 'Acier X5CrNi18-10', echelle: '1:1', donne: { face: 'complet', dessus: 'contour', gauche: 'contour' },
    piece: P('13', 'Élément d\'étau', { L: 80, P: 40, H: 40, fxz: [[0, 0], [80, 0], [80, 15], [60, 15], [60, 40], [20, 40], [20, 15], [0, 15]], fyz: [[0, 0], [40, 0], [40, 40], [15, 40], [0, 25]], fxy: [[0, 0], [30, 0], [30, 8], [50, 8], [50, 0], [80, 0], [80, 40], [0, 40]] }) },
  { n: 14, titre: 'BRIDE COUDÉE', type: 'terminer', matiere: 'Acier C35', echelle: '1:1', donne: { face: 'complet', dessus: 'contour', gauche: 'contour' },
    piece: P('14', 'Bride coudée', { L: 80, P: 30, H: 35, fxz: [[0, 0], [45, 0], [45, 23], [80, 23], [80, 35], [33, 35], [33, 12], [0, 12]], trous: [{ axe: 'z', x: 15, y: 15, d: 8 }, { axe: 'z', x: 65, y: 15, d: 8 }], arete: [[45, 0, 23], [45, 30, 23]] }) },
  { n: 16, titre: 'COULISSEAU DE MORS', type: 'terminer', matiere: 'Fonte EN-GJMW-350', echelle: '1:1', donne: { face: 'complet', dessus: 'contour', gauche: 'contour' },
    piece: P('16', 'Coulisseau de mors', { L: 75, P: 45, H: 30, fyz: [[0, 0], [45, 0], [45, 18], [38, 18], [42, 30], [3, 30], [7, 18], [0, 18]], trous: [{ axe: 'z', x: 20, y: 22.5, d: 10 }] }) },
];

for (const ex of EX) {
  const pre = ARETES[ex.piece.id];   // arêtes précalculées : l'Atelier s'affiche tout de suite
  if (pre) ex.piece._a = pre.map((r) => ({ a: r.slice(0, 3), b: r.slice(3, 6), vis: [...r[6]].map((c) => c === '1') }));
  const t = textes(ex); ex.donnees = t.donnees; ex.exercice = t.exercice; ex.id = `c${ex.n}`; ex.mode = 'completer'; ex.niveau = ex.type === 'rectangle' ? 2 : 1; ex.titreCourt = ex.titre.charAt(0) + ex.titre.slice(1).toLowerCase(); }
export const CAHIER = EX;

/** Séries de l'Atelier (exercices regroupés par type). */
export const SERIES_CAHIER = Object.entries(TYPES).map(([id, t]) => ({ id: `cahier-${id}`, titre: t.titre, intro: t.intro, exos: EX.filter((e) => e.type === id).map((e) => ({ ...e, titre: `${e.n}. ${e.titreCourt}` })) })).filter((s) => s.exos.length);
