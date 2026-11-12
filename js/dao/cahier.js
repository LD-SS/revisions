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
import { revolution } from './revolution.js';
import { CONSTRUCTIONS } from './constructions.js';
import { solide, E as Es, disque as Dq, rect as Rc, arc as Ar } from './solide.js';
import { ARETES } from './cahier-aretes.js';

export const TYPES = {
  terminer: { titre: 'Vues incomplètes à terminer', intro: 'La vue de face est complète, les autres vues sont seulement esquissées (leur contour). Termine-les : arêtes vues en trait fort, cachées en interrompu, axes en mixte.' },
  rectangle: { titre: 'Rectangle capable', intro: 'Une vue manque entièrement : esquisse son rectangle capable (encombrement, avec les lignes de rappel), puis les détails, puis fais la mise au net.' },
  intersection: { titre: 'Intersections, congés et raccordements', intro: 'Cylindres qui se coupent, rainures de clavetage, congés, nervures : repère les points particuliers (extrêmes, de tangence) sur les vues données, puis trace les courbes. Un raccordement tangent ne donne pas d\'arête.' },
  coupe: { titre: 'Coupes', intro: 'Le plan de coupe A-A est tracé sur la vue de dessus. Dessine la vue de face en coupe : on enlève la partie avant, la matière coupée est hachurée, les trous restent vides, pas de traits cachés.' },
  demicoupe: { titre: 'Demi-coupes', intro: 'Pièce symétrique : à droite de l\'axe, la moitié en coupe (hachures) ; à gauche, la moitié en vue extérieure, sans traits cachés. L\'axe de symétrie sépare les deux moitiés.' },
  cylindre: { titre: 'Cylindres, plats et perçages', intro: 'Pièces tournées : un cylindre se voit en rectangle d\'un côté et en cercle de l\'autre, toujours avec son axe ; un plat donne une droite dans une vue et une corde dans l\'autre.' },
  perspective: { titre: 'Perspectives', intro: 'À partir des 3 vues, dessine la perspective (cavalière : face en vraie grandeur, fuyantes à 45° réduites de moitié ; isométrique : axes à 30°, longueurs vraies). Seulement les arêtes vues.' },
  filetage: { titre: 'Filetages et taraudages', intro: 'Représentation normalisée : fond de filet en trait fin, sommet en trait fort ; vue de bout : 3/4 de cercle fin.' },
  geometrie: { titre: 'Constructions géométriques', intro: 'Perpendiculaires, parallèles, raccordements et tangentes : trace avec précision (centres et points de raccordement), en trait fin pour les constructions.' },
};

const P = (id, nom, def) => prisme({ id: `cah-${id}`, nom, ...def });
const PO = (id, nom, prof, profil, trous = []) => ({ id: `cah-${id}`, nom, prof, profil, trous });
const R = (id, nom, etages, trous = []) => revolution({ id: `cah-${id}`, nom, etages, trous });
const S = (id, nom, def) => solide({ id: `cah-${id}`, nom, ...def });
/** Contour de deux cercles reliés par leurs tangentes extérieures (levier, bielle). */
function levier(c1, r1, c2, r2) {
  const d = Math.hypot(c2[0] - c1[0], c2[1] - c1[1]), b = (Math.atan2(c2[1] - c1[1], c2[0] - c1[0]) * 180) / Math.PI, a = (Math.acos((r1 - r2) / d) * 180) / Math.PI;
  return [...Ar(c1[0], c1[1], r1, b + a, b + 360 - a), ...Ar(c2[0], c2[1], r2, b - a, b + a)];
}
/** Points de tangence des droites issues de p vers le cercle (c, r). */
function tangentes(p, c, r) {
  const d = Math.hypot(c[0] - p[0], c[1] - p[1]), b = Math.atan2(p[1] - c[1], p[0] - c[0]), a = Math.acos(r / d);
  return [b + a, b - a].map((x) => [c[0] + r * Math.cos(x), c[1] + r * Math.sin(x)]);
}
const vue = { face: 'vue de face', dessus: 'vue de dessus', gauche: 'vue de gauche' };

/** Textes types (données / exercice) selon ce qui est donné. */
function textes(ex) {
  const d = ex.donne, nom = ex.piece.nom.toLowerCase();
  const complets = Object.keys(d).filter((k) => d[k] === 'complet').map((k) => vue[k]);
  const contours = Object.keys(d).filter((k) => d[k] === 'contour').map((k) => vue[k]);
  const manque = Object.keys(d).filter((k) => d[k] === 'rien').map((k) => vue[k]);
  const liste0 = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} et ${a[a.length - 1]}` : a[0]);
  const liste = (a) => liste0(a.map((v, i) => (i ? `la ${v}` : v)));   // « la vue de face et la vue de gauche »
  if (ex.type === 'geometrie') return { donnees: ex.donneesTxt, exercice: ex.exerciceTxt };
  if (ex.type === 'perspective') return {
    donnees: ['les trois vues de la pièce ;', `le coin avant-bas-gauche de la perspective, au repère ✚.`],
    exercice: [ex.mode === 'cav' ? 'Dessiner la perspective cavalière (fuyantes à 45°, k = 0,5).' : 'Dessiner la perspective isométrique (axes à 30°, k = 1).', 'Ne représenter que les arêtes vues, en trait fort.', 'Les trous : bord de l\'entrée (cercle ou ellipse).'],
  };
  if (ex.type === 'filetage') return {
    donnees: ['les contours des trois vues de la pièce ;', 'la perspective cotée (M = diamètre nominal).'],
    exercice: ex.exerciceTxt,
  };
  if (ex.type === 'demicoupe') return {
    donnees: ['la vue de dessus de la pièce, avec le plan de coupe A-A ;', 'la perspective cotée de la pièce.'],
    exercice: ['Dessiner la vue de face en demi-vue, demi-coupe A-A : moitié droite en coupe, moitié gauche en vue extérieure.', 'Séparer les deux moitiés par l\'axe de symétrie (trait mixte fin).', 'Hachurer la matière coupée ; pas de traits cachés.'],
  };
  if (ex.type === 'coupe') return {
    donnees: ['la vue de dessus de la pièce, avec le plan de coupe A-A ;', 'la perspective cotée de la pièce.'],
    exercice: ['Dessiner la vue de face en coupe A-A (on regarde dans le sens des flèches).', 'Hachurer la matière coupée (hachures fines à 45°).', 'Ne pas dessiner de traits cachés ; les trous coupés restent vides.', 'Indiquer la désignation « A-A » de la vue en coupe.'],
  };
  const donnees = [];
  if (complets.length) donnees.push(`la ${liste(complets)} complète${complets.length > 1 ? 's' : ''} ;`);
  if (contours.length) donnees.push(`le contour de la ${liste0(contours.map((v, i) => (i ? `de la ${v}` : v)))} (vue${contours.length > 1 ? 's' : ''} incomplète${contours.length > 1 ? 's' : ''}) d'un${/^(bride|butée|chape|semelle|équerre|extrémité|coulisse)/.test(nom) ? 'e' : ''} ${nom} ;`);
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
  { n: 15, titre: 'ÉTRIER', type: 'coupe', mode: 'coupe', matiere: 'Acier X6CrMoTi17-12', echelle: '1:1', donne: {},
    piece: P('15', 'Étrier', { L: 70, P: 40, H: 45, fxz: [[0, 0], [70, 0], [70, 45], [56, 45], [56, 12], [14, 12], [14, 45], [0, 45]], trous: [{ axe: 'z', x: 35, y: 20, d: 12 }, { axe: 'x', y: 20, z: 32, d: 10 }] }) },
  { n: 17, titre: 'ÉQUERRE PORTE-BUTÉE', type: 'coupe', mode: 'coupe', matiere: 'Acier GE295', echelle: '1:1', donne: {},
    piece: P('17', 'Équerre porte-butée', { L: 70, P: 40, H: 50, fxz: [[0, 0], [70, 0], [70, 14], [16, 14], [16, 50], [0, 50]], trous: [{ axe: 'z', x: 45, y: 20, d: 10 }, { axe: 'x', y: 20, z: 36, d: 10 }] }) },
  { n: 18, titre: 'PALIER', type: 'coupe', mode: 'coupe', matiere: 'Fonte EN-GJL-200', echelle: '1:1', donne: {},
    piece: P('18', 'Palier', { L: 80, P: 36, H: 40, fxz: [[0, 0], [80, 0], [80, 12], [60, 12], [60, 40], [20, 40], [20, 12], [0, 12]], trous: [{ axe: 'z', x: 10, y: 18, d: 8 }, { axe: 'z', x: 70, y: 18, d: 8 }, { axe: 'y', x: 40, z: 26, d: 16 }] }) },
  { n: 19, titre: 'SOCLE DE CHARNIÈRE', type: 'coupe', mode: 'coupe', matiere: 'Acier 30CrNiMo8', echelle: '1:1', donne: {},
    piece: P('19', 'Socle de charnière', { L: 80, P: 40, H: 30, fxz: [[0, 0], [80, 0], [80, 10], [60, 10], [60, 30], [20, 30], [20, 10], [0, 10]], fyz: [[0, 0], [40, 0], [40, 30], [30, 30], [30, 22], [10, 22], [10, 30], [0, 30]], trous: [{ axe: 'z', x: 10, y: 20, d: 8 }, { axe: 'z', x: 70, y: 20, d: 8 }, { axe: 'x', y: 20, z: 16, d: 8 }] }) },
  { n: 20, titre: 'PLATS SUR CYLINDRE', type: 'cylindre', matiere: 'Acier C45', echelle: '1:1', donne: { face: 'contour', dessus: 'contour', gauche: 'complet' },
    piece: R('20', 'Axe à plats', [{ l: 30, d: 30 }, { l: 25, d: 30, plats: 20 }, { l: 20, d: 30, plat: 24 }]) },
  { n: 21, titre: 'ÉCROU CYLINDRIQUE', type: 'cylindre', matiere: 'Acier S355', echelle: '1:1', donne: { face: 'complet', dessus: 'contour', gauche: 'contour' },
    piece: R('21', 'Écrou cylindrique', [{ l: 12, d: 40 }, { l: 22, d: 28 }], [{ axe: 'y', x: 24, d: 8 }]) },
  { n: 22, titre: 'PIÈCE TOURNÉE ET FRAISÉE', type: 'cylindre', matiere: 'Acier 42CrMo4', echelle: '1:1', donne: { face: 'complet', dessus: 'contour', gauche: 'contour' },
    piece: R('22', 'Pièce tournée et fraisée', [{ l: 20, d: 24, platsY: 16 }, { l: 30, d: 36 }, { l: 25, d: 24 }], [{ axe: 'z', x: 62, d: 6 }]) },
  { n: 23, titre: 'SUPPORT ORIENTABLE', type: 'terminer', matiere: 'Acier S235', echelle: '1:1', donne: { face: 'complet', dessus: 'contour', gauche: 'contour' },
    piece: P('23', 'Support orientable', { L: 70, P: 40, H: 45, fxz: [[0, 0], [70, 0], [70, 12], [40, 12], [40, 45], [24, 45], [24, 12], [0, 12]], fyz: [[0, 0], [40, 0], [40, 12], [32, 12], [28, 45], [12, 45], [8, 12], [0, 12]], trous: [{ axe: 'x', y: 20, z: 34, d: 8 }, { axe: 'z', x: 10, y: 20, d: 6 }, { axe: 'z', x: 60, y: 20, d: 6 }] }) },
  { n: 24, titre: 'PERSPECTIVE CAVALIÈRE', type: 'perspective', mode: 'cav', matiere: 'Acier S235', echelle: '1:1', donne: {},
    piece: PO('24', 'Bloc chanfreiné entaillé', 30, [[0, 0], [60, 0], [60, 22], [48, 34], [24, 34], [24, 26], [0, 26]]) },
  { n: 25, titre: 'PERSPECTIVE ISOMÉTRIQUE. MAQUETTE', type: 'perspective', mode: 'iso', matiere: 'Bois (maquette)', echelle: '1:1', donne: {},
    piece: PO('25', 'Maquette à gradins', 30, [[0, 0], [50, 0], [50, 12], [34, 12], [34, 24], [16, 24], [16, 36], [0, 36]]) },
  { n: 26, titre: 'PERSPECTIVE ISOMÉTRIQUE. SUPPORT', type: 'perspective', mode: 'iso', matiere: 'Acier S275', echelle: '1:1', donne: {},
    piece: PO('26', 'Support à rainure', 35, [[0, 0], [60, 0], [60, 18], [52, 26], [38, 26], [38, 16], [22, 16], [22, 26], [8, 26], [0, 18]]) },
  { n: 27, titre: 'TROU TARAUDÉ DÉBOUCHANT', type: 'filetage', matiere: 'Acier C35', echelle: '1:1', donne: { face: 'contour', dessus: 'contour', gauche: 'contour' },
    piece: P('27', 'Bloc taraudé', { L: 60, P: 30, H: 25, trous: [{ axe: 'z', x: 30, y: 15, d: 8.5, M: 10 }] }),
    exerciceTxt: ['Représenter sur les trois vues le trou taraudé M10 débouchant (perçage Ø8,5).', 'Vue de dessus : cercle du perçage en trait fort, 3/4 de cercle Ø10 en trait fin.', 'Autres vues : traits cachés du perçage et du filet, axe.'] },
  { n: 28, titre: 'TIGE FILETÉE', type: 'filetage', matiere: 'Acier 8.8', echelle: '1:1', donne: { face: 'contour', dessus: 'contour', gauche: 'contour' },
    piece: R('28', 'Tige filetée', [{ l: 35, d: 16, filet: 13.8 }, { l: 25, d: 24 }]),
    exerciceTxt: ['Terminer la représentation de la tige filetée M16 (fond de filet Ø13,8).', 'Sommet du filet en trait fort, fond de filet en trait fin sur toute la longueur filetée.', 'Vue de gauche : cercle Ø16 en trait fort, 3/4 de cercle Ø13,8 en trait fin.'] },
  { n: 29, titre: 'PERPENDICULAIRES', type: 'geometrie', mode: 'construction', matiere: 'Tracé', echelle: '1:1', donne: {}, cons: CONSTRUCTIONS.mediatrices(),
    piece: { id: 'cah-29', nom: 'Perpendiculaires' }, donneesTxt: ['le triangle ABC.'], exerciceTxt: ['Tracer en trait fin les trois médiatrices du triangle ABC (perpendiculaires au milieu de chaque côté).', 'Vérifier qu\'elles se coupent en un même point M (centre du cercle passant par A, B et C).'] },
  { n: 30, titre: 'PARALLÈLES', type: 'geometrie', mode: 'construction', matiere: 'Tracé', echelle: '1:1', donne: {}, cons: CONSTRUCTIONS.paralleles(),
    piece: { id: 'cah-30', nom: 'Parallèles' }, donneesTxt: ['les droites (D1) et (D2) ;', 'la distance R = 20 mm.'], exerciceTxt: ['Tracer en trait fin, à la distance R = 20, une parallèle à (D1) et une parallèle à (D2), du côté intérieur (entre les deux droites).'] },
  { n: 31, titre: 'RACCORDEMENT DE DEUX DROITES', type: 'geometrie', mode: 'construction', matiere: 'Tracé', echelle: '1:1', donne: {}, cons: CONSTRUCTIONS.raccordDroites(),
    piece: { id: 'cah-31', nom: 'Raccordement de deux droites' }, donneesTxt: ['deux droites qui forment un angle ;', 'le rayon de raccordement R = 15 mm.'], exerciceTxt: ['Chercher le centre du raccordement (à 15 mm des deux droites).', 'Chercher les deux points de raccordement.', 'Tracer l\'arc de raccordement en trait fort (outil Arc ou Congé).'] },
  { n: 32, titre: 'RACCORDEMENT DROITE ET CERCLE', type: 'geometrie', mode: 'construction', matiere: 'Tracé', echelle: '1:1', donne: {}, cons: CONSTRUCTIONS.raccordDroiteCercle(),
    piece: { id: 'cah-32', nom: 'Raccordement droite et cercle' }, donneesTxt: ['une droite et un cercle Ø50 ;', 'le rayon de raccordement R = 20 mm, à gauche du cercle.'], exerciceTxt: ['Chercher le centre : à 20 mm de la droite et à 25 + 20 = 45 mm du centre du cercle.', 'Chercher les points de raccordement sur la droite et sur le cercle.', 'Tracer l\'arc de raccordement en trait fort.'] },
  { n: 33, titre: 'RACCORDEMENT DE DEUX CERCLES', type: 'geometrie', mode: 'construction', matiere: 'Tracé', echelle: '1:1', donne: {}, cons: CONSTRUCTIONS.raccordCercles(),
    piece: { id: 'cah-33', nom: 'Raccordement de deux cercles' }, donneesTxt: ['deux cercles Ø40 et Ø50 ;', 'le rayon de raccordement R = 30 mm, au-dessus des cercles.'], exerciceTxt: ['Chercher le centre : à 20 + 30 mm du 1er centre et à 25 + 30 mm du 2e.', 'Chercher les deux points de raccordement (sur les droites des centres).', 'Tracer l\'arc de raccordement en trait fort.'] },
  { n: 34, titre: 'TANGENTES À DEUX CERCLES', type: 'geometrie', mode: 'construction', matiere: 'Tracé', echelle: '1:1', donne: {}, cons: CONSTRUCTIONS.tangentes(),
    piece: { id: 'cah-34', nom: 'Tangentes à deux cercles' }, donneesTxt: ['deux cercles Ø56 et Ø32.'], exerciceTxt: ['Tracer les deux tangentes extérieures communes aux deux cercles, en trait fort, entre leurs points de contact.'] },
  { n: 16, titre: 'COULISSEAU DE MORS', type: 'terminer', matiere: 'Fonte EN-GJMW-350', echelle: '1:1', donne: { face: 'complet', dessus: 'contour', gauche: 'contour' },
    piece: P('16', 'Coulisseau de mors', { L: 75, P: 45, H: 30, fyz: [[0, 0], [45, 0], [45, 18], [38, 18], [42, 30], [3, 30], [7, 18], [0, 18]], trous: [{ axe: 'z', x: 20, y: 22.5, d: 10 }] }) },
  // ----- lot 3 (cahier 2, 1re partie) : plans inclinés, queues d'aronde, rainures en T, vés ; coupes de pièces percées -----
  { n: 35, titre: 'PLANS INCLINÉS', type: 'terminer', matiere: 'Acier C22', echelle: '1:1', donne: { face: 'contour', dessus: 'complet', gauche: 'contour' },
    piece: P('35', 'Bloc à plans inclinés', { L: 70, P: 40, H: 45, fxz: [[0, 0], [70, 0], [70, 20], [50, 45], [0, 45]], fyz: [[0, 0], [40, 0], [40, 30], [25, 45], [0, 45]], arete: [[50, 0, 45], [50, 25, 45]] }) },
  { n: 36, titre: 'RAINURE EN QUEUE D\'ARONDE', type: 'rectangle', matiere: 'Acier C22', echelle: '1:1', donne: { face: 'complet', dessus: 'complet', gauche: 'rien' },
    piece: P('36', 'Bloc à queue d\'aronde', { L: 60, P: 50, H: 35, fxz: [[0, 0], [60, 0], [60, 35], [20, 35], [0, 20]], fyz: [[0, 0], [50, 0], [50, 35], [35, 35], [40, 20], [10, 20], [15, 35], [0, 35]], arete: [[20, 10, 20], [60, 10, 20]] }) },
  { n: 37, titre: 'RAINURE EN T ET PLAN INCLINÉ', type: 'terminer', matiere: 'Acier GE295', echelle: '1:1', donne: { face: 'contour', dessus: 'contour', gauche: 'complet' },
    piece: P('37', 'Bloc à rainure en T', { L: 70, P: 60, H: 40, fxz: [[0, 0], [70, 0], [70, 40], [25, 40], [0, 15]], fyz: [[0, 0], [60, 0], [60, 40], [38, 40], [38, 26], [46, 26], [46, 14], [14, 14], [14, 26], [22, 26], [22, 40], [0, 40]] }) },
  { n: 38, titre: 'MORS MOBILE', type: 'terminer', matiere: 'Fonte EN-GJL-250', echelle: '1:1', donne: { face: 'complet', dessus: 'contour', gauche: 'contour' },
    piece: P('38', 'Mors mobile', { L: 60, P: 50, H: 50, fxz: [[0, 0], [60, 0], [60, 30], [40, 50], [0, 50]], fyz: [[0, 0], [15, 0], [15, 10], [35, 10], [35, 0], [50, 0], [50, 50], [0, 50]], trous: [{ axe: 'z', x: 15, y: 25, d: 10 }], arete: [[60, 0, 30], [60, 50, 30]] }) },
  { n: 39, titre: 'SOCLE À VÉ', type: 'rectangle', matiere: 'Fonte EN-GJL-200', echelle: '1:1', donne: { face: 'complet', dessus: 'rien', gauche: 'complet' },
    piece: P('39', 'Socle à vé', { L: 80, P: 45, H: 40, fxz: [[0, 0], [80, 0], [80, 40], [55, 40], [40, 22], [25, 40], [0, 40]], fxy: [[0, 0], [80, 0], [80, 45], [10, 45], [0, 35]], arete: [[40, 0, 22], [40, 45, 22]] }) },
  { n: 40, titre: 'ÉLÉMENT DE VÉ RÉGLABLE', type: 'terminer', matiere: 'Fonte EN-GJS-500', echelle: '1:1', donne: { face: 'contour', dessus: 'contour', gauche: 'complet' },
    piece: P('40', 'Élément de vé réglable', { L: 70, P: 40, H: 45, fxz: [[0, 10], [70, 0], [70, 45], [0, 45]], fyz: [[0, 0], [40, 0], [40, 45], [30, 45], [20, 32], [10, 45], [0, 45]] }) },
  { n: 41, titre: 'BRIDE À LUMIÈRE', type: 'rectangle', matiere: 'Acier C35', echelle: '1:1', donne: { face: 'complet', dessus: 'complet', gauche: 'rien' },
    piece: P('41', 'Bride à lumière', { L: 90, P: 40, H: 25, fxz: [[0, 0], [90, 0], [90, 25], [30, 25], [0, 15]], fxy: [[0, 0], [90, 0], [90, 40], [0, 40], [0, 26], [45, 26], [45, 14], [0, 14]], trous: [{ axe: 'z', x: 72, y: 20, d: 10 }], arete: [[30, 0, 25], [30, 14, 25]] }) },
  { n: 42, titre: 'EXTRÉMITÉ DE SOCLE', type: 'terminer', matiere: 'Fonte EN-GJMB-350', echelle: '1:1', donne: { face: 'contour', dessus: 'complet', gauche: 'contour' },
    piece: P('42', 'Extrémité de socle', { L: 60, P: 50, H: 40, fxz: [[0, 0], [60, 0], [60, 25], [40, 40], [0, 40]], fxy: [[0, 0], [60, 0], [60, 15], [45, 25], [60, 35], [60, 50], [0, 50]] }) },
  { n: 43, titre: 'COULISSE À QUEUE D\'ARONDE', type: 'rectangle', matiere: 'Fonte EN-GJL-250', echelle: '1:1', donne: { face: 'complet', dessus: 'rien', gauche: 'complet' },
    piece: P('43', 'Coulisse à queue d\'aronde', { L: 70, P: 50, H: 40, fxz: [[0, 0], [70, 0], [70, 20], [50, 40], [0, 40]], fyz: [[0, 0], [50, 0], [50, 20], [40, 20], [45, 40], [5, 40], [10, 20], [0, 20]], arete: [[50, 5, 40], [50, 45, 40]] }) },
  { n: 44, titre: 'GUIDE PERCÉ', type: 'coupe', mode: 'coupe', matiere: 'Acier S235', echelle: '1:1', donne: {},
    piece: P('44', 'Guide percé', { L: 80, P: 40, H: 35, fxz: [[0, 0], [80, 0], [80, 35], [60, 35], [60, 20], [20, 20], [20, 35], [0, 35]], trous: [{ axe: 'z', x: 10, y: 20, d: 8 }, { axe: 'z', x: 70, y: 20, d: 8 }, { axe: 'y', x: 40, z: 10, d: 10 }] }) },
  { n: 45, titre: 'PORTE-OUTIL PERCÉ', type: 'coupe', mode: 'coupe', matiere: 'Acier 30NiCrMo16', echelle: '1:1', donne: {},
    piece: P('45', 'Porte-outil percé', { L: 70, P: 50, H: 40, fyz: [[0, 0], [50, 0], [50, 40], [35, 40], [35, 25], [15, 25], [15, 40], [0, 40]], trous: [{ axe: 'z', x: 20, y: 25, d: 10 }, { axe: 'z', x: 50, y: 25, d: 10 }, { axe: 'x', y: 25, z: 12, d: 8 }] }) },
  { n: 46, titre: 'DOIGT RAINURÉ', type: 'coupe', mode: 'coupe', matiere: 'Acier X30Cr13', echelle: '1:1', donne: {},
    piece: P('46', 'Doigt rainuré', { L: 60, P: 40, H: 50, fyz: [[0, 0], [40, 0], [40, 50], [28, 50], [28, 30], [12, 30], [12, 50], [0, 50]], trous: [{ axe: 'z', x: 30, y: 20, d: 8 }, { axe: 'y', x: 30, z: 15, d: 12 }] }) },
  { n: 47, titre: 'CHAPE PERCÉE', type: 'coupe', mode: 'coupe', matiere: 'Bronze CuSn7Zn4Pb7', echelle: '1:1', donne: {},
    piece: P('47', 'Chape percée', { L: 70, P: 40, H: 45, fxz: [[0, 0], [70, 0], [70, 45], [55, 45], [55, 15], [15, 15], [15, 45], [0, 45]], trous: [{ axe: 'x', y: 20, z: 32, d: 10 }, { axe: 'z', x: 35, y: 20, d: 10 }] }) },
  // ----- lot 4 (cahier 2, 2e partie) : pièces « solides » (cylindres qui se coupent, congés, nervures, demi-coupes) -----
  { n: 48, titre: 'INTERSECTION DE CYLINDRES', type: 'intersection', matiere: 'Acier C35', echelle: '1:1', donne: { face: 'contour', dessus: 'complet', gauche: 'complet' },
    plusTxt: ['Vue de face : chercher les points extrêmes puis quelques points intermédiaires de la courbe d\'intersection des deux cylindres.'],
    piece: S('48', 'Té de cylindres', { L: 80, P: 40, H: 50, corps: [Es('x', 0, 80, Dq(20, 20, 20)), Es('z', 20, 50, Dq(40, 20, 12))], creux: [Es('z', 12, 51, Dq(40, 20, 6))],
      reperes: [{ p: [0, 5.86, 34.14], txt: 'Ø40', dx: -20 }, { p: [40, 8, 50], txt: 'Ø24' }, { p: [40, 20, 50], txt: 'Ø12 prof. 38', dx: 26, dy: 40 }] }) },
  { n: 49, titre: 'RACCORD EN TÉ', type: 'coupe', mode: 'coupe', matiere: 'Fonte EN-GJL-250', echelle: '1:1', donne: {},
    plusTxt: ['Tracer la courbe d\'intersection des deux alésages, vue derrière le plan de coupe.'],
    piece: S('49', 'Raccord en té', { L: 80, P: 40, H: 55, coupe: 20, corps: [Es('x', 0, 80, Dq(20, 20, 20)), Es('z', 20, 55, Dq(40, 20, 14))], creux: [Es('x', -1, 81, Dq(20, 20, 12)), Es('z', 20, 56, Dq(40, 20, 8))],
      reperes: [{ p: [0, 5.86, 34.14], txt: 'Ø40 / Ø24', dx: -20 }, { p: [40, 6, 55], txt: 'Ø28 / Ø16' }] }) },
  { n: 50, titre: 'PLATEAU À BOSSAGES', type: 'coupe', mode: 'coupe', matiere: 'Fonte EN-GJS-400', echelle: '1:1', donne: {},
    piece: S('50', 'Plateau à bossages', { L: 90, P: 60, H: 30, coupe: 30, corps: [Es('z', 0, 12, Rc(0, 0, 90, 60)), Es('z', 12, 30, Dq(20, 30, 12)), Es('z', 12, 30, Dq(70, 30, 12))], creux: [Es('z', -1, 31, Dq(20, 30, 6)), Es('z', -1, 31, Dq(70, 30, 6)), Es('y', -1, 61, Rc(38, -1, 52, 5))],
      cotes: [{ a: [38, 0, 0], b: [52, 0, 0], off: [0, 0, -24] }, { a: [0, 0, 12], b: [0, 0, 30], off: [-10, 0, 0], txt: '18' }],
      reperes: [{ p: [20, 18, 30], txt: 'Ø24 / Ø12', dx: -20 }, { p: [70, 18, 30], txt: 'Ø24 / Ø12' }] }) },
  { n: 51, titre: 'CHAPEAU DE PALIER', type: 'intersection', matiere: 'Fonte EN-GJL-200', echelle: '1:1', donne: { face: 'complet', dessus: 'contour', gauche: 'contour' },
    plusTxt: ['Vue de gauche : intersection du trou de graissage Ø6 avec l\'alésage Ø40 (traits cachés).'],
    piece: S('51', 'Chapeau de palier', { L: 80, P: 40, H: 42, corps: [Es('y', 0, 40, Rc(0, 0, 80, 35)), Es('z', 35, 42, Dq(40, 20, 8))], creux: [Es('y', -1, 41, Dq(40, 0, 20)), Es('z', -1, 36, Dq(10, 20, 5)), Es('z', -1, 36, Dq(70, 20, 5)), Es('z', 10, 43, Dq(40, 20, 3))],
      reperes: [{ p: [54.14, 0, 14.14], txt: 'R20', dx: 22, dy: 18 }, { p: [40, 12, 42], txt: 'Ø16 / Ø6', dx: -20 }, { p: [10, 20, 35], txt: '2 × Ø10', dx: -20 }] }) },
  { n: 52, titre: 'CLAVETAGE (FRAISE 2 TAILLES)', type: 'intersection', matiere: 'Acier C45', echelle: '1:1', donne: { face: 'contour', dessus: 'complet', gauche: 'contour' },
    plusTxt: ['La rainure (largeur 8, profondeur 4) est faite avec une fraise deux tailles : extrémités arrondies.'],
    piece: S('52', 'Arbre claveté', { L: 80, P: 30, H: 30, corps: [Es('x', 0, 80, Dq(15, 15, 15))], creux: [Es('z', 26, 31, [...Ar(29, 15, 4, 90, 270), ...Ar(51, 15, 4, -90, 90)])],
      cotes: [{ a: [25, 0, 30], b: [55, 0, 30], off: [0, 0, 10], txt: '30' }], reperes: [{ p: [0, 4.39, 25.61], txt: 'Ø30', dx: -20 }, { p: [40, 11, 30], txt: 'rainure 8 × 4' }] }) },
  { n: 53, titre: 'CLAVETAGE (FRAISE DISQUE)', type: 'intersection', matiere: 'Acier C45', echelle: '1:1', donne: { face: 'complet', dessus: 'contour', gauche: 'contour' },
    plusTxt: ['La rainure (largeur 8, profondeur 4) est faite avec une fraise disque Ø50 : fond en arc de cercle.'],
    piece: S('53', 'Arbre à rainure disque', { L: 80, P: 30, H: 30, corps: [Es('x', 0, 80, Dq(15, 15, 15))], creux: [Es('y', 11, 19, Dq(40, 51, 25))],
      reperes: [{ p: [0, 4.39, 25.61], txt: 'Ø30', dx: -20 }, { p: [40, 11, 26], txt: 'fraise Ø50, rainure 8 × 4' }] }) },
  { n: 54, titre: 'INTERSECTION DE CONGÉS', type: 'intersection', matiere: 'Acier S235', echelle: '1:1', donne: { face: 'complet', dessus: 'contour', gauche: 'contour' },
    plusTxt: ['Les deux congés R8 se rencontrent dans l\'angle : tracer leur intersection sur la vue de dessus.'],
    piece: S('54', 'Équerre à congés', { L: 70, P: 50, H: 45, corps: [Es('y', 0, 50, Rc(0, 0, 70, 10)), Es('y', 40, 50, Rc(0, 0, 70, 45)), Es('x', 0, 10, Rc(0, 0, 50, 45)), Es('x', 10, 70, [[32, 10], [40, 10], [40, 18], ...Ar(32, 18, 8, 0, -90)]), Es('y', 0, 40, [[10, 10], [18, 10], ...Ar(18, 18, 8, -90, -180), [10, 18]])],
      cotes: [{ a: [0, 0, 0], b: [10, 0, 0], off: [0, 0, -24] }, { a: [70, 0, 0], b: [70, 0, 10], off: [14, 0, 0], txt: '10' }], reperes: [{ p: [40, 34.3, 12.3], txt: 'congés R8' }] }) },
  { n: 55, titre: 'NERVURE TANGENTE', type: 'intersection', matiere: 'Fonte EN-GJL-250', echelle: '1:1', donne: { face: 'complet', dessus: 'contour', gauche: 'contour' },
    plusTxt: ['Les faces de la nervure sont tangentes au moyeu : pas d\'arête au raccordement ; chercher sur la vue de dessus où s\'arrêtent les traits de la nervure.'],
    piece: S('55', 'Palier à nervure', { L: 90, P: 40, H: 58, corps: [Es('y', 0, 40, Rc(0, 0, 90, 10)), Es('y', 0, 40, Dq(45, 40, 18)), Es('y', 15, 25, [[12, 10], [78, 10], tangentes([78, 10], [45, 40], 18)[0], [45, 40], tangentes([12, 10], [45, 40], 18)[1]])], creux: [Es('y', -1, 41, Dq(45, 40, 9))],
      reperes: [{ p: [45, 0, 58], txt: 'Ø36 / Ø18' }, { p: [30, 15, 15], txt: 'nervure ép. 10', dx: -20, dy: -10 }] }) },
  { n: 56, titre: 'PORTE-GALET', type: 'intersection', matiere: 'Acier 42CrMo4', echelle: '1:1', donne: { face: 'contour', dessus: 'contour', gauche: 'complet' },
    piece: S('56', 'Porte-galet', { L: 60, P: 40, H: 60, corps: [Es('y', 0, 40, Rc(0, 0, 60, 15)), Es('x', 0, 12, [[0, 15], [40, 15], [40, 40], ...Ar(20, 40, 20, 0, 180)]), Es('x', 48, 60, [[0, 15], [40, 15], [40, 40], ...Ar(20, 40, 20, 0, 180)])], creux: [Es('x', -1, 61, Dq(20, 40, 6)), Es('z', -1, 16, Dq(30, 20, 5))],
      cotes: [{ a: [0, 0, 60], b: [12, 0, 60], off: [0, 0, 10] }], reperes: [{ p: [0, 20, 60], txt: 'R20, Ø12', dx: -20 }, { p: [30, 20, 15], txt: 'Ø10' }] }) },
  { n: 57, titre: 'RONDELLE PIVOTANTE', type: 'intersection', matiere: 'Acier S355', echelle: '1:1', donne: { face: 'contour', dessus: 'complet', gauche: 'contour' },
    plusTxt: ['Les droites sont tangentes aux arcs : les traits s\'arrêtent aux points de tangence (contours apparents).'],
    piece: S('57', 'Rondelle pivotante', { L: 87, P: 44, H: 18, corps: [Es('z', 0, 8, levier([22, 22], 22, [75, 22], 12)), Es('z', 8, 18, Dq(22, 22, 15))], creux: [Es('z', -1, 19, Dq(22, 22, 8)), Es('z', -1, 9, Dq(75, 22, 4))],
      reperes: [{ p: [22, 7, 18], txt: 'Ø30 / Ø16', dx: -20 }, { p: [75, 22, 8], txt: 'R12, Ø8' }] }) },
  { n: 58, titre: 'BRIDE : DEMI-VUE, DEMI-COUPE', type: 'demicoupe', mode: 'demi', matiere: 'Fonte EN-GJL-200', echelle: '1:1', donne: {},
    piece: S('58', 'Bride ronde', { L: 80, P: 80, H: 30, coupe: 40, corps: [Es('z', 0, 10, Dq(40, 40, 40)), Es('z', 10, 30, Dq(40, 40, 20))], creux: [Es('z', -1, 31, Dq(40, 40, 10)), Es('z', 24, 31, Dq(40, 40, 14)), ...[[12, 40], [68, 40], [40, 12], [40, 68]].map(([x, y]) => Es('z', -1, 11, Dq(x, y, 4)))],
      cotes: [{ a: [40, 40, 24], b: [40, 40, 30], off: [0, -50, 0], txt: '6' }], reperes: [{ p: [40, 20, 30], txt: 'Ø40, lamage Ø28, alésage Ø20', dx: 24, dy: 34 }, { p: [12, 40, 10], txt: '4 × Ø8 sur Ø56', dx: -20 }] }) },
  { n: 59, titre: 'SUPPORT : NERVURES EN COUPE', type: 'coupe', mode: 'coupe', matiere: 'Fonte EN-GJMB-350', echelle: '1:1', donne: {},
    plusTxt: ['Les nervures coupées dans leur longueur ne sont pas hachurées (on trace seulement leur contour).'],
    piece: S('59', 'Support à nervures', { L: 80, P: 50, H: 50, coupe: 25, corps: [Es('y', 0, 50, Rc(0, 0, 80, 10)), Es('z', 10, 50, Dq(40, 25, 15)), Es('y', 22, 28, [[8, 10], [30, 10], [30, 45]], { nerv: true }), Es('y', 22, 28, [[50, 10], [72, 10], [50, 45]], { nerv: true })], creux: [Es('z', -1, 51, Dq(40, 25, 8)), ...[[10, 10], [70, 10], [10, 40], [70, 40]].map(([x, y]) => Es('z', -1, 11, Dq(x, y, 4)))],
      reperes: [{ p: [40, 10, 50], txt: 'Ø30 / Ø16' }, { p: [10, 10, 10], txt: '4 × Ø8', dx: -20 }, { p: [18, 22, 20], txt: 'nervures ép. 6', dx: -20, dy: 40 }] }) },
  { n: 60, titre: 'LEVIER À BOSSAGES', type: 'intersection', matiere: 'Acier C35', echelle: '1:1', donne: { face: 'contour', dessus: 'complet', gauche: 'contour' },
    plusTxt: ['Le bras (épaisseur 10) est tangent aux deux bossages : chercher où s\'arrêtent ses arêtes sur la vue de face.'],
    piece: S('60', 'Levier à bossages', { L: 100, P: 30, H: 20, corps: [Es('z', 0, 10, levier([15, 15], 15, [90, 15], 10)), Es('z', 0, 20, Dq(15, 15, 15)), Es('z', 0, 16, Dq(90, 15, 10))], creux: [Es('z', -1, 21, Dq(15, 15, 6)), Es('z', -1, 17, Dq(90, 15, 4))],
      cotes: [{ a: [15, 0, 0], b: [90, 0, 0], off: [0, 0, -24], txt: '75' }], reperes: [{ p: [15, 4, 20], txt: 'Ø30 / Ø12', dx: -20 }, { p: [90, 8, 16], txt: 'Ø20 / Ø8' }] }) },
];

EX.sort((a, b) => a.n - b.n);
for (const ex of EX) {
  const pre = ARETES[ex.piece.id];   // arêtes précalculées : l'Atelier s'affiche tout de suite
  if (pre) ex.piece._a = pre.map((r) => ({ a: r.slice(0, 3), b: r.slice(3, 6), vis: [...r[6]].map((c) => c === '1') }));
  const t = textes(ex); ex.donnees = t.donnees; ex.exercice = [...t.exercice, ...(ex.plusTxt || [])]; ex.id = `c${ex.n}`; ex.mode = ex.mode || 'completer'; ex.niveau = ex.type === 'rectangle' ? 2 : 1; ex.titreCourt = (ex.titre.charAt(0) + ex.titre.slice(1).toLowerCase()).replace(/ en t /, ' en T '); }
export const CAHIER = EX;

/** Séries de l'Atelier (exercices regroupés par type). */
export const SERIES_CAHIER = Object.entries(TYPES).map(([id, t]) => ({ id: `cahier-${id}`, titre: t.titre, intro: t.intro, exos: EX.filter((e) => e.type === id).map((e) => ({ ...e, titre: `${e.n}. ${e.titreCourt}` })) })).filter((s) => s.exos.length);
