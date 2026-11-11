/* =====================================================================
   VUE PLANCHE LIBRE — #/dessin/libre
   ---------------------------------------------------------------------
   Feuille blanche A4/A3 avec cadre et cartouche, échelle au choix,
   grille d'aide masquable, zoom et déplacement (souris, stylet, doigts).
   Outils de tracé : js/dao/trace.js (ligne, rectangle, cercle, arc, accroches).
   Plusieurs planches, rangées dans « planches » ({ id: planche }) :
   cette clé est synchronisée avec le compte (js/synchro.js), planche par planche.
   La planche ouverte sur cet appareil : « dao.courante » (non synchronisée).
   ===================================================================== */

import { esc, stockage } from '../utils.js';
import { icone } from '../icones.js';
import { styleMatiere } from '../matieres.js';
import { matiere } from '../store.js';
import { monterFeuille, nouvellePlanche, ECHELLES, FORMATS, pasGrille, zone, facteur, versPapier, imprimerPlanche, CARTOUCHE } from '../dao/feuille.js';
import { PIECES, vues, boite as boitePiece, trouverPiece, coupeA, estSymetrique, sectionB, coupeLocale, aTrouVertical, graineTrouVertical } from '../dao/pieces.js';
import { svgPerspective, perspectiveEntites } from '../dao/perspective.js';
import { monterPiece3D } from '../piece3d.js';
import { svgSur } from '../rendu.js';
import { creerTraceur, STYLES, OUTILS, COTES, svgEntite } from '../dao/trace.js';
import { corriger, corrigerCotes, corrigerCoupe, corrigerSection, corrigerAncien } from '../dao/correction.js';

const CLE = 'planches';
const CLE_COURANTE = 'dao.courante';
const nouvelId = () => `p${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
const toutes = () => { const t = stockage.lire(CLE, {}); return t && typeof t === 'object' ? t : {}; };
const nomDe = (pl) => pl.cartouche?.titre?.trim() || 'Sans titre';

/** Ancienne planche unique (v1.7–1.8, clé « dao.planche ») → liste des planches. */
function migrer() {
  const ancienne = stockage.lire('dao.planche', null);
  if (!ancienne || typeof ancienne !== 'object') return;
  const t = toutes(); const id = nouvelId();
  t[id] = { ...ancienne, maj: Date.now() };
  stockage.ecrire(CLE, t); stockage.ecrire(CLE_COURANTE, id); stockage.supprimer('dao.planche');
}

/** Id de la planche ouverte (créée si besoin). */
function idCourant() {
  migrer();
  const t = toutes();
  let id = stockage.lire(CLE_COURANTE, '');
  if (!t[id]) {
    id = Object.keys(t).sort((a, b) => (t[b].maj || 0) - (t[a].maj || 0))[0];
    if (!id) { id = nouvelId(); t[id] = { ...nouvellePlanche(), maj: Date.now() }; stockage.ecrire(CLE, t); }
    stockage.ecrire(CLE_COURANTE, id);
  }
  return id;
}

function normaliser(s) {
  const d = nouvellePlanche();
  if (!s || typeof s !== 'object') return d;
  return {
    ...d, ...s,
    format: FORMATS[s.format] ? s.format : d.format,
    orientation: s.orientation === 'portrait' ? 'portrait' : 'paysage',
    echelle: ECHELLES.includes(s.echelle) ? s.echelle : d.echelle,
    grille: s.grille !== false,
    cartouche: { ...d.cartouche, ...(s.cartouche || {}) },
    entites: Array.isArray(s.entites) ? s.entites : [],
  };
}

const ICONES_OUTILS = {
  main: '<svg viewBox="0 0 24 24" class="ic"><path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>',
  selection: '<svg viewBox="0 0 24 24" class="ic"><path d="M5 3l14 8-6 2-3 6z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>',
  cote: '<svg viewBox="0 0 24 24" class="ic"><path d="M4 6v12M20 6v12M4 12h16M4 12l3-2v4zM20 12l-3-2v4z" stroke="currentColor" stroke-width="1.6" fill="currentColor" stroke-linejoin="round"/></svg>',
  rappel: '<svg viewBox="0 0 24 24" class="ic"><path d="M3 8h18M3 16h18" stroke="currentColor" stroke-width="1.4" stroke-dasharray="3 2" fill="none"/><circle cx="6" cy="8" r="1.8" fill="currentColor"/></svg>',
  l45: '<svg viewBox="0 0 24 24" class="ic"><path d="M4 20 20 4M4 20h8" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M8 20a4 4 0 0 0-1.2-2.8" stroke="currentColor" fill="none"/></svg>',
  ajuster: '<svg viewBox="0 0 24 24" class="ic"><path d="M3 12h7M14 12h7M12 3v18" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 9l3 3-3 3" stroke="#d33" stroke-width="1.6" fill="none"/></svg>',
  prolonger: '<svg viewBox="0 0 24 24" class="ic"><path d="M3 12h10" stroke="currentColor" stroke-width="2"/><path d="M13 12h5" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2"/><path d="M21 4v16" stroke="currentColor" stroke-width="2"/></svg>',
  chanfrein: '<svg viewBox="0 0 24 24" class="ic"><path d="M4 20V10l6-6h10" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>',
  conge: '<svg viewBox="0 0 24 24" class="ic"><path d="M4 20v-8a8 8 0 0 1 8-8h8" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
  hachures: '<svg viewBox="0 0 24 24" class="ic"><rect x="4" y="4" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"/><path d="M4 12 12 4M4 20 20 4M12 20l8-8" stroke="currentColor" stroke-width="1.3"/></svg>',
  texte: '<svg viewBox="0 0 24 24" class="ic"><path d="M5 6V4h14v2M12 4v16M9 20h6" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
  gomme: '<svg viewBox="0 0 24 24" class="ic"><path d="M7 21h10M5 15l9-11 6 5-9 11H8z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>',
  ligne: '<svg viewBox="0 0 24 24" class="ic"><path d="M4 18 10 7l5 8 5-10" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>',
  rect: '<svg viewBox="0 0 24 24" class="ic"><rect x="4" y="6" width="16" height="12" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
  cercle: '<svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>',
  arc: '<svg viewBox="0 0 24 24" class="ic"><path d="M5 18A9 9 0 0 1 19 9" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="17" r="1.4" fill="currentColor"/></svg>',
};

/** Rendu de la page ; se remonte elle-même quand on change de planche. */
export function vuePlancheLibre(el, piece = null) {
  // #/dessin/libre/<id de pièce> : nouvel exercice, puis l'adresse redevient #/dessin/libre (un rechargement ne le recrée pas)
  if (piece) {
    // exam-<durée en min>-<type>-<id> : mode examen
    const ex = /^exam-(\d{1,3})-(vues|cotes|coupe|demi|section|locale|iso|cav)-(.+)$/.exec(String(piece));
    const m = ex ? [null, ex[2], ex[3]] : /^(cotes|coupe|demi|section|locale|iso|cav)-(.+)$/.exec(String(piece));
    const pc = trouverPiece(m ? m[2] : piece);
    if (pc) creerExo(pc, normaliser(toutes()[idCourant()]), m ? m[1] : 'vues', ex ? Math.min(240, Math.max(5, +ex[1])) : 0);
    history.replaceState(null, '', '#/dessin/libre');
  }
  let stop = null;
  const monter = () => { stop?.(); stop = monterPage(el, monter); };
  monter();
  return () => stop?.();
}

const boutonsOutils = (liste) => liste.map((k) => { const o = OUTILS[k]; return `<button class="btn dao-b" type="button" data-outil="${k}" title="${esc(o.nom)}${o.touche ? ` (${o.touche.toUpperCase()})` : ''}">${ICONES_OUTILS[k] || ''}<span>${esc(o.nom)}</span></button>`; }).join('');

const fmt = (v) => (Math.round(v * 10) / 10).toLocaleString('fr-BE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

let corrigerAuMontage = false;
const PERSP = ['iso', 'cav'];
/** Pièce de l'exercice (sans trous pour les perspectives). */
/** Pièce adaptée à l'exercice : en cavalière, seuls les trous de la face avant (cercles) sont gardés. */
const pourPersp = (pc, mode) => (pc && mode === 'cav' ? { ...pc, trous: (pc.trous || []).filter((t) => t.axe === 'y') } : pc);
const pieceDe = (exo) => pourPersp(trouverPiece(exo?.piece), exo?.mode);   // après « Rendre la copie » : corriger dès que la page est remontée

/**
 * Ancien exercice de l'Atelier (grille en « carreaux », y vers le bas : js/geometrie.js construire)
 * → planche du nouveau moteur en mm (1 carreau = 10 mm, ou 8 mm si la planche est grande).
 * Les données deviennent des entités de la planche ; la solution est gardée dans exo (pour la correction).
 */
export function creerAncien(e, depuis = null) {
  if (!e?.planche || !Array.isArray(e.solution)) return false;
  const np = nouvellePlanche();
  const base = { ...np, format: 'A4', orientation: 'paysage', echelle: '1:1', cartouche: { ...np.cartouche, titre: String(e.titre || 'Exercice').slice(0, 31), auteur: depuis?.cartouche?.auteur || np.cartouche.auteur, classe: depuis?.cartouche?.classe || np.cartouche.classe } };
  const z = zone(base);
  const U = e.planche.h * 10 <= z.h - CARTOUCHE.h - 8 ? 10 : 8;
  const X = (x) => Math.round(x * U * 1000) / 1000, Y = (y) => Math.round((z.h - y * U) * 1000) / 1000;
  const conv = (c) => {
    if (c[0] === 'l') return [{ t: 'l', x1: X(c[1]), y1: Y(c[2]), x2: X(c[3]), y2: Y(c[4]), s: c[5] || 'v' }];
    if (c[0] === 'c') return [{ t: 'c', cx: X(c[1]), cy: Y(c[2]), r: Math.round(c[3] * U * 1000) / 1000, s: c[4] || 'v' }];
    if (c[0] === 't') return [{ t: 'x', x: X(c[1]) - 2, y: Y(c[2]), txt: String(c[3]), h: 5, s: 'n' }];
    if (c[0] === 'f') {           // flèche : trait fin + pointe
      const [x1, y1, x2, y2] = [X(c[1]), Y(c[2]), X(c[3]), Y(c[4])], L = Math.hypot(x2 - x1, y2 - y1) || 1, u = [(x2 - x1) / L, (y2 - y1) / L], n = [-u[1], u[0]];
      return [{ t: 'l', x1, y1, x2, y2, s: 'n' }, ...[1, -1].map((k) => ({ t: 'l', x1: x2, y1: y2, x2: x2 - u[0] * 3.5 + n[0] * 1.2 * k, y2: y2 - u[1] * 3.5 + n[1] * 1.2 * k, s: 'n' }))];
    }
    return [];
  };
  const entites = [...e.donnees.flatMap(conv)];
  if (e.planche.l45) entites.push(...conv(e.planche.l45));
  const cb = e.planche.cible;
  if (cb) {                       // cadre de la zone à dessiner (trait fin)
    const [x, y, w, h] = cb;
    entites.push(...[[x, y, x + w, y], [x + w, y, x + w, y + h], [x + w, y + h, x, y + h], [x, y + h, x, y]].map(([a, b, c, d]) => ({ t: 'l', x1: X(a), y1: Y(b), x2: X(c), y2: Y(d), s: 'n' })));
  }
  const sol = e.solution.filter((c) => c[0] === 'l' || c[0] === 'c').flatMap(conv);
  const hach = e.solution.filter((c) => c[0] === 'h').flatMap((c) => c[1].map(([x, y]) => [X(x), Y(y + 0.5), Math.round(0.5 * U * 1000) / 1000]));   // carrés [x, y bas, côté]
  const cible = cb ? { x: X(cb[0]), y: Y(cb[1] + cb[3]), w: cb[2] * U, h: cb[3] * U } : null;
  const t = toutes(); const n = nouvelId();
  t[n] = { ...base, entites, exo: { mode: 'ancien', piece: '', u: U, ...(e.piece?.vox ? { vox: e.piece } : e.perspective ? { persp: String(e.perspective) } : {}), consigne: String(e.consigne || ''), sol, hach, cible, ref: e._cle || e.id || '' }, maj: Date.now() };
  stockage.ecrire(CLE, t); stockage.ecrire(CLE_COURANTE, n);
  return true;
}

/** Graine d'une nouvelle pièce au hasard (1 à 99 999). */
export const grainePiece = () => 1 + Math.floor(Math.random() * 99999);

/**
 * Crée une planche d'exercice pour la pièce pc et la rend courante.
 * mode 'vues' : dessine les 3 vues ; 'cotes' : les 3 vues sont données, cote-les.
 */
function creerExo(pc, depuis = null, mode = 'vues', examen = 0) {
  pc = pourPersp(pc, mode);
  const t = toutes(); const n = nouvelId();
  const np = nouvellePlanche();
  const titre = `${examen ? 'Examen – ' : ''}${{ cotes: 'Cotation', coupe: 'Coupe A-A', demi: 'Demi-coupe', section: 'Section B-B', locale: 'Coupe locale', iso: 'Isométrique', cav: 'Cavalière' }[mode] || 'Vues'} : ${pc.nom}`.slice(0, 31);
  const base = { ...np, format: PERSP.includes(mode) ? 'A3' : 'A4', orientation: 'paysage', echelle: '1:1', cartouche: { ...np.cartouche, titre, auteur: depuis?.cartouche?.auteur || np.cartouche.auteur, classe: depuis?.cartouche?.classe || np.cartouche.classe } };
  const b = boitePiece(pc), z = zone(base), k = facteur(base.echelle);
  const [ecart, marge] = mode === 'cotes' ? [30, 25] : [15, 15];
  const o = [marge, Math.round(Math.max(pc.prof + ecart + marge, z.h / k - marge - (b.z1 - b.z0)))];
  let r0 = null;
  if (PERSP.includes(mode)) {   // origine de la perspective : à droite des 3 vues, sommet aligné sur celui de la vue de face
    const W = b.x1 - b.x0, H = b.z1 - b.z0, P = pc.prof;
    const haut = mode === 'iso' ? (W + P) * 0.5 + H : H + P * 0.354;
    r0 = [Math.round(o[0] + W + ecart + P + 35 + (mode === 'iso' ? P * 0.866 : 0)), Math.round(Math.max(55, o[1] + H - haut))];
  }
  const exo = { piece: pc.id, o, ecart, ...(r0 ? { r: r0 } : {}), ...(mode !== 'vues' ? { mode } : {}), ...(examen ? { examen: { duree: examen, debut: Date.now() } } : {}) };
  let entites = [];
  if (mode === 'cotes') { const v = vues(pc, o, ecart); entites = [...v.face, ...v.dessus, ...v.gauche]; }
  if (mode === 'coupe' || mode === 'demi') entites = coupeA(pc, o, ecart, { demi: mode === 'demi' }).dessus;
  if (mode === 'section') entites = sectionB(pc, o, ecart).donnees;
  if (mode === 'locale') entites = coupeLocale(pc, o, ecart)?.donnees || [];
  if (PERSP.includes(mode)) { const v = vues(pc, o, ecart); entites = [...v.face, ...v.dessus, ...v.gauche]; }
  t[n] = { ...base, ...(examen ? { grille: false } : {}), entites, exo, maj: Date.now() };
  stockage.ecrire(CLE, t); stockage.ecrire(CLE_COURANTE, n);
}

function monterPage(el, remonter) {
  const m = matiere('dessin');
  const id = idCourant();
  let p = normaliser(toutes()[id]);
  const sauver = () => { const t = toutes(); t[id] = { ...p, maj: Date.now() }; stockage.ecrire(CLE, t); };
  const liste = Object.entries(toutes()).sort((a, b) => (b[1].maj || 0) - (a[1].maj || 0));
  const choix = (nom, valeurs, actuel, etiquette) => `<label class="dao-choix"><span>${etiquette}</span>
    <select class="field" data-p="${nom}">${valeurs.map(([v, l]) => `<option value="${esc(v)}" ${v === actuel ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;

  el.innerHTML = `
    <div class="mc" ${m ? styleMatiere(m) : ''}>
      <div class="crumb"><a href="#/">Accueil</a><span class="crumb-sep">›</span><a href="#/dessin">Atelier de dessin</a><span class="crumb-sep">›</span><span>Planche libre</span></div>
      <div class="atelier-retour">
        <a class="btn" href="#/dessin">${icone('fleche-g')} Atelier</a>
        <label class="dao-choix"><span>Planche</span>
          <select class="field" data-pl>${liste.map(([k, pl]) => `<option value="${esc(k)}" ${k === id ? 'selected' : ''}>${esc(nomDe(pl))}${pl.maj ? ` · ${new Date(pl.maj).toLocaleDateString('fr-BE')}` : ''}</option>`).join('')}</select></label>
        <button class="btn" type="button" data-pla="nouvelle">+ <span>Nouvelle</span></button>
        <button class="btn" type="button" data-pla="dupliquer" title="Faire une copie de cette planche">Dupliquer</button>
        <button class="btn" type="button" data-pla="supprimer" title="Supprimer cette planche">${icone('croix')}<span>Supprimer</span></button>
        <span class="muted dao-synchro" title="Tes planches suivent ton compte sur tous tes appareils">${liste.length} planche${liste.length > 1 ? 's' : ''} · enregistrées dans ton compte</span>
      </div>
      <div class="dao" data-plein="0">
        <div class="dao-barre" role="toolbar" aria-label="Réglages de la feuille">
          ${choix('format', Object.keys(FORMATS).map((f) => [f, f]), p.format, 'Format')}
          ${choix('orientation', [['paysage', 'Paysage'], ['portrait', 'Portrait']], p.orientation, 'Sens')}
          ${choix('echelle', ECHELLES.map((e) => [e, e]), p.echelle, 'Échelle')}
          <label class="chip dao-chip"><input type="checkbox" data-p="grille" ${p.grille ? 'checked' : ''}><span>Grille d'aide</span></label>
          <span class="dao-sep"></span>
          <label class="chip dao-chip dao-tactile" title="Sur tablette avec stylet : le doigt déplace la feuille, seul le stylet dessine"><input type="checkbox" data-stylet ${stockage.lire('dao.stylet', false) ? 'checked' : ''}><span>Stylet seul</span></label>
          <button class="btn" type="button" data-act="cartouche" aria-expanded="false">${icone('crayon')} Cartouche</button>
          <span class="dao-sep"></span>
          <button class="btn icon" type="button" data-act="moins" title="Réduire (molette ou 2 doigts)">−</button>
          <span class="dao-zoom muted" title="100 % ≈ taille réelle à l'écran">100 %</span>
          <button class="btn icon" type="button" data-act="plus" title="Agrandir (molette ou 2 doigts)">+</button>
          <button class="btn" type="button" data-act="ajuster" title="Voir toute la feuille">Feuille entière</button>
          <button class="btn primary" type="button" data-act="plein" title="Plein écran">⛶ <span>Plein écran</span></button>
        </div>
        <div class="dao-barre dao-outils" role="toolbar" aria-label="Outils de dessin">
          <div class="dao-groupe" role="group" aria-label="Outil">
            ${boutonsOutils(['main', 'selection', 'ligne', 'rect', 'cercle', 'arc', 'cote', 'hachures', 'texte', 'gomme'])}
          </div>
          <div class="dao-groupe" role="group" aria-label="Construction">
            ${boutonsOutils(['rappel', 'l45', 'ajuster', 'prolonger', 'chanfrein', 'conge'])}
          </div>
          <div class="dao-groupe" role="group" aria-label="Type de trait">
            ${Object.entries(STYLES).map(([k, o]) => `<button class="btn dao-b" type="button" data-style="${k}" title="${esc(o.titre)}"><svg viewBox="0 0 34 10" class="dao-ech"><line class="dao-ech-${k}" x1="2" y1="5" x2="32" y2="5"/></svg><span>${esc(o.nom)}</span></button>`).join('')}
          </div>
          <div class="dao-groupe">
            <button class="btn dao-b" type="button" data-act="ortho" title="Mode orthogonal : traits horizontaux ou verticaux seulement (F8, ou maintenir Maj)">⊾ <span>Ortho</span></button>
            <button class="btn icon" type="button" data-act="annuler" title="Annuler (Ctrl+Z)">↶</button>
            <button class="btn icon" type="button" data-act="retablir" title="Rétablir (Ctrl+Y)">↷</button>
            <button class="btn" type="button" data-act="effacer" title="Effacer tout le dessin">${icone('croix')}<span>Tout effacer</span></button>
            <button class="btn" type="button" data-act="imprimer" title="Imprimer la planche à l'échelle réelle : dans la fenêtre d'impression, choisis « Taille réelle » ou « 100 % » (pas « Ajuster à la page »)">🖨<span>Imprimer</span></button>
            <select class="field dao-exo-choix" title="Nouvel exercice sur une pièce vue en perspective cotée, corrigé automatiquement">
              <option value="">Exercice…</option>
              ${[['vues', 'Dessine les 3 vues'], ['cotes', 'Cote les 3 vues'], ['coupe', 'Coupe A-A'], ['demi', 'Demi-coupe A-A'], ['section', 'Section sortie B-B'], ['locale', 'Coupe locale'], ['iso', 'Perspective isométrique'], ['cav', 'Perspective cavalière']].map(([m, l]) => `<optgroup label="${l}">
                ${[1, 2, 3].map((n) => `<option value="${m}:${m === 'demi' ? 's' : 'h'}${n}">${l.split(' ')[0]} · pièce au hasard ${'★'.repeat(n)}</option>`).join('')}
                ${PIECES.filter((pc) => (m !== 'demi' || estSymetrique(pc)) && (m !== 'locale' || aTrouVertical(pc))).map((pc) => `<option value="${m}:${esc(pc.id)}">${l.split(' ')[0]} · ${esc(pc.nom)}</option>`).join('')}
              </optgroup>`).join('')}
            </select>
            <select class="field dao-exemple" ${p.exo?.examen && !p.exo.examen.fini ? 'disabled' : ''} title="Ajoute les 3 vues (face, dessus, gauche) d'une pièce d'exemple, pour observer la mise en page européenne">
              <option value="">Exemple : 3 vues d'une pièce…</option>
              ${PIECES.map((pc) => `<option value="${esc(pc.id)}">${esc(pc.nom)}</option>`).join('')}
            </select>
          </div>
        </div>
        <form class="panel dao-cartouche-f" hidden>
          <label>Titre <input class="field" name="titre" maxlength="40" value="${esc(p.cartouche.titre)}" placeholder="Ex. : Support en équerre"></label>
          <label>Dessiné par <input class="field" name="auteur" maxlength="30" value="${esc(p.cartouche.auteur)}" placeholder="Prénom Nom"></label>
          <label>Classe <input class="field" name="classe" maxlength="12" value="${esc(p.cartouche.classe)}"></label>
          <label>N° <input class="field" name="numero" maxlength="10" value="${esc(p.cartouche.numero)}"></label>
          <p class="muted">La date, l'échelle et le format se remplissent tout seuls.</p>
        </form>
        <div class="dao-barre dao-selbar dao-parambar" hidden>
          <label class="dao-choix"><span class="dao-param-nom">Distance</span>
            <input class="field dao-param" type="number" min="0.5" step="0.5" value="5" style="width:80px"> mm</label>
        </div>
        <div class="dao-barre dao-selbar dao-textebar" hidden>
          <label class="dao-choix"><span>Texte</span><input class="field dao-texte-in" type="text" maxlength="60" placeholder="Ex. : VUE DE FACE" style="width:200px"></label>
          <label class="dao-choix"><span>Hauteur</span><select class="field dao-texte-h">${[2.5, 3.5, 5, 7, 10].map((h) => `<option value="${h}" ${h === 3.5 ? 'selected' : ''}>${String(h).replace('.', ',')} mm</option>`).join('')}</select></label>
        </div>
        <div class="dao-barre dao-selbar dao-cotebar" hidden>
          <b>Cote :</b>
          ${Object.entries(COTES).map(([k, c]) => `<button class="btn dao-b" type="button" data-cote="${k}">${esc(c.nom)}</button>`).join('')}
        </div>
        <div class="dao-barre dao-selbar" hidden>
          <b class="dao-sel-n"></b>
          <button class="btn dao-b" type="button" data-op="deplacer" title="Déplacer la sélection (point de base, puis destination)">Déplacer</button>
          <button class="btn dao-b" type="button" data-op="copier" title="Copier la sélection (point de base, puis une ou plusieurs destinations)">Copier</button>
          <button class="btn dao-b" type="button" data-op="miroir" title="Symétrie de la sélection par rapport à un axe (2 points)">Miroir</button>
          <button class="btn dao-b bad" type="button" data-op="supprimer" title="Supprimer la sélection (Suppr)">${icone('croix')}<span>Supprimer</span></button>
          <span class="muted">Un type de trait choisi ci-dessus s'applique à la sélection.</span>
        </div>
        ${p.exo ? `<div class="panel dao-exobar">
          <b>Exercice :</b> <span>${p.exo.mode === 'ancien'
            ? `${esc(p.exo.consigne).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')} (Ancien exercice de l'Atelier, repris en mm : 1 carreau = ${p.exo.u || 10} mm ; dessine dans le cadre en trait fin.)`
            : p.exo.mode === 'iso'
            ? 'dessine la perspective isométrique de la pièce à partir de ses 3 vues, à l\'échelle 1:1 (mêmes longueurs sur les 3 axes) : largeur selon l\'axe à 30° vers la droite, profondeur selon l\'axe à 30° vers la gauche, hauteurs verticales. Le coin avant-bas-gauche est au repère ✚. Seules les arêtes vues, en traits forts. Trous : seulement le bord de l\'entrée, en ellipse tracée par la méthode des 4 centres (4 arcs). Astuce : saisie « longueur&lt;angle », ex. 40&lt;30 ou 25&lt;150.'
            : p.exo.mode === 'cav'
            ? 'dessine la perspective cavalière de la pièce à partir de ses 3 vues : face avant en vraie grandeur (1:1), fuyantes à 45° vers la droite et vers le haut, réduites de moitié (k = 0,5). Le coin avant-bas-gauche est au repère ✚. Seules les arêtes vues, en traits forts. Trous de la face avant : leur cercle d\'entrée. Astuce : saisie « longueur&lt;angle », ex. 15&lt;45.'
            : p.exo.mode === 'locale'
            ? 'dessine la vue de face avec une coupe locale autour du trou vertical : entre les deux traits ondulés (fins, déjà tracés), le trou est vu en coupe (traits forts) et la matière coupée est hachurée ; ailleurs, la vue reste normale (traits cachés compris). Le coin inférieur gauche de la vue de face est au repère ✚.'
            : p.exo.mode === 'section'
            ? 'dessine la section sortie B-B (plan tracé sur la vue de face, vue dans le sens des flèches) à la place de la vue de gauche : seule la surface coupée est dessinée, hachurée, avec les axes des trous coupés. Son coin inférieur gauche est au repère ✚.'
            : p.exo.mode === 'demi'
            ? 'la pièce est symétrique : dessine la vue de face en demi-coupe A-A. À droite de l\'axe de symétrie (trait mixte) : la coupe, avec la matière coupée hachurée ; à gauche : la vue extérieure, sans traits cachés. Le coin inférieur gauche de la vue de face est au repère ✚.'
            : p.exo.mode === 'coupe'
            ? 'dessine la vue de face en coupe A-A (le plan est tracé sur la vue de dessus, les flèches montrent le sens d\'observation) : la matière coupée est hachurée (outil Hachures), les trous restent vides, pas de traits cachés. Le coin inférieur gauche de la vue de face est au repère ✚.'
            : p.exo.mode === 'cotes'
            ? 'cote les 3 vues avec l\'outil Cote : chaque arête et chaque axe de trou doit être situé une seule fois (pas de chaîne fermée), avec les 3 cotes d\'encombrement et le Ø de chaque trou (sur son cercle). Mesures sur la perspective (bouton Pièce).'
            : `dessine la vue de face, la vue de dessus et la vue de gauche (projection européenne, échelle 1:1, écart de ${p.exo.ecart} mm entre les vues). Le coin inférieur gauche de la vue de face est au repère ✚.`}</span>
          <span class="dao-exo-btns">
            ${p.exo.examen && !p.exo.examen.fini
              ? `<button class="btn primary" type="button" data-exo="rendre">Rendre la copie</button> <span class="dao-chrono" title="Temps restant">⏱ ${p.exo.examen.duree}:00</span>`
              : `<button class="btn primary" type="button" data-exo="corriger">${icone('check')} Corriger</button>
            ${p.exo.mode === 'cotes' ? '' : '<button class="btn" type="button" data-exo="solution" aria-pressed="false">Voir la solution</button>'}`}
            ${PERSP.includes(p.exo.mode) || (p.exo.mode === 'ancien' && !p.exo.vox && !p.exo.persp) ? '' : '<button class="btn" type="button" data-exo="piece">Pièce</button>'}
          </span>
          <span class="dao-exo-res">${p.exo.examen && !p.exo.examen.fini ? '<b>Mode examen</b> : pas de correction ni de solution avant d\'avoir rendu la copie.' : p.exo.score != null ? `Meilleur score : <b>${p.exo.score} %</b>` : ''}</span>
          ${p.exo.examen?.note != null ? `<span class="dao-exam-note">Note d'examen : <b>${p.exo.examen.note} %</b> · rendu en ${p.exo.examen.temps} min sur ${p.exo.examen.duree}</span>` : ''}
        </div>` : ''}
        <div class="dao-zone">
        <div class="panel dao-piece" hidden>
          <div class="dao-piece-t"><b class="dao-piece-nom"></b><button class="btn icon" type="button" data-act="fermer-piece" title="Fermer">${icone('croix')}</button></div>
          <div class="dao-piece-fig"></div>
          <p class="muted">Perspective isométrique cotée (mm). Les 3 vues sont sur la feuille.</p>
        </div>
        <div class="dao-cadre-ecran"></div>
        </div>
        <div class="dao-etat muted">
          <span class="dao-pos">X — · Y —</span>
          <span class="dao-mes"></span>
          <span class="dao-acc-t"></span>
          <span class="dao-saisie" hidden></span>
          <span class="dao-pas"></span>
        </div>
        <div class="dao-aide muted">
          <span class="dao-aide-t"></span>
          <span class="dao-astuce">Molette ou 2 doigts : zoom · clic du milieu ou Espace + glisser : déplacer</span>
        </div>
      </div>
    </div>`;

  const bloc = el.querySelector('.dao');
  const pos = el.querySelector('.dao-pos');
  const zoomTxt = el.querySelector('.dao-zoom');
  const pasTxt = el.querySelector('.dao-pas');
  const majPas = () => { pasTxt.textContent = p.grille ? `grille : ${pasGrille(p)} mm (réels)` : ''; };

  const etat = {
    mes: el.querySelector('.dao-mes'), acc: el.querySelector('.dao-acc-t'), saisie: el.querySelector('.dao-saisie'),
    aide: el.querySelector('.dao-aide-t'), ortho: el.querySelector('[data-act=ortho]'),
    annuler: el.querySelector('[data-act=annuler]'), retablir: el.querySelector('[data-act=retablir]'),
  };
  let traceur = null;
  const selbar = el.querySelector('.dao-selbar:not(.dao-cotebar):not(.dao-parambar):not(.dao-textebar)'), selN = el.querySelector('.dao-sel-n');
  const textebar = el.querySelector('.dao-textebar');
  textebar.querySelector('.dao-texte-in').addEventListener('input', (ev) => traceur.reglerParam('texte', ev.target.value));
  textebar.querySelector('.dao-texte-h').addEventListener('change', (ev) => traceur.reglerParam('h', parseFloat(ev.target.value)));
  const parambar = el.querySelector('.dao-parambar'), paramIn = el.querySelector('.dao-param');
  paramIn.addEventListener('input', () => { const o = traceur.outil(); traceur.reglerParam(o, parseFloat(String(paramIn.value).replace(',', '.'))); });
  const cotebar = el.querySelector('.dao-cotebar');
  cotebar.addEventListener('click', (ev) => { const b = ev.target.closest('[data-cote]'); if (b) traceur.choisirCote(b.dataset.cote); });
  const feuille = monterFeuille(el.querySelector('.dao-cadre-ecran'), p, {
    outil: () => traceur?.outil() || 'main',
    styletSeul: () => stockage.lire('dao.stylet', false) === true,
    surPointeur: (...a) => traceur?.surPointeur(...a),
    surZoom: (z) => { zoomTxt.textContent = `${z} %`; },
    surCurseur: (c) => { pos.textContent = c ? `X ${fmt(c[0])} · Y ${fmt(c[1])} mm` : 'X — · Y —'; },
  });
  majPas();

  const marquer = (attr, v) => el.querySelectorAll(`[data-${attr}]`).forEach((b) => b.classList.toggle('on', b.dataset[attr] === v));
  traceur = creerTraceur({
    feuille,
    planche: () => p,
    enregistrer: (entites) => { p = { ...p, entites }; sauver(); if (p.exo) dessinerExo(null); },
    surOutil: (t) => { marquer('outil', t); stockage.ecrire('dao.outil', t); },
    surStyle: (s) => marquer('style', s),
    surEtat: (i) => {
      etat.aide.textContent = i.aide;
      etat.mes.textContent = i.mesure;
      etat.acc.textContent = i.accroche ? `accroche : ${i.accroche}` : '';
      etat.saisie.hidden = !i.saisie; etat.saisie.textContent = i.saisie ? `saisie : ${i.saisie} ↵` : '';
      etat.ortho.classList.toggle('on', i.ortho);
      etat.annuler.disabled = !i.annuler; etat.retablir.disabled = !i.retablir;
      cotebar.hidden = traceur?.outil() !== 'cote';
      textebar.hidden = traceur?.outil() !== 'texte';
      const po = traceur?.outil();
      const avecParam = po === 'chanfrein' || po === 'conge';
      parambar.hidden = !avecParam;
      if (avecParam && parambar.dataset.o !== po) { parambar.dataset.o = po; el.querySelector('.dao-param-nom').textContent = po === 'conge' ? 'Rayon du congé' : 'Chanfrein'; paramIn.value = i.param[po]; }
      if (!avecParam) parambar.dataset.o = '';
      cotebar.querySelectorAll('[data-cote]').forEach((b) => b.classList.toggle('on', b.dataset.cote === i.coteK));
      selbar.hidden = !i.sel; selN.textContent = `${i.sel} élément${i.sel > 1 ? 's' : ''} sélectionné${i.sel > 1 ? 's' : ''} :`;
      selbar.querySelectorAll('[data-op]').forEach((b) => b.classList.toggle('on', b.dataset.op === i.op));
    },
  });
  const outilMemo = stockage.lire('dao.outil', 'ligne');
  traceur.choisirOutil(OUTILS[outilMemo] ? outilMemo : 'ligne');
  traceur.choisirStyle('v');
  el.querySelector('.dao-outils').addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.outil) traceur.choisirOutil(b.dataset.outil);
    else if (b.dataset.style) traceur.choisirStyle(b.dataset.style);
    else if (b.dataset.act === 'ortho') traceur.basculerOrtho();
    else if (b.dataset.act === 'annuler') traceur.annuler();
    else if (b.dataset.act === 'retablir') traceur.retablir();
    else if (b.dataset.act === 'imprimer') imprimerPlanche(el.querySelector('.dao-cadre-ecran svg.dao-svg'), p);
    else if (b.dataset.act === 'effacer') {
      if (b.dataset.sur === '1') { traceur.toutEffacer(); b.dataset.sur = ''; b.querySelector('span').textContent = 'Tout effacer'; }
      else { b.dataset.sur = '1'; b.querySelector('span').textContent = 'Confirmer ?'; setTimeout(() => { if (b.isConnected) { b.dataset.sur = ''; b.querySelector('span').textContent = 'Tout effacer'; } }, 3000); }
    }
  });
  selbar.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-op]'); if (!b) return;
    if (b.dataset.op === 'supprimer') traceur.supprimerSelection(); else traceur.lancerOp(b.dataset.op);
  });
  const touches = (ev) => {
    if (ev.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (traceur.clavier(ev)) ev.preventDefault();
  };
  window.addEventListener('keydown', touches);

  /* ----- exercice « dessine les 3 vues » ----- */
  const montrerPiece = (pc) => {
    const pan = el.querySelector('.dao-piece');
    if (pc.ancien) {           // ancien exercice : pièce en cubes (vue 3D tournante) ou perspective du cours
      pan.querySelector('.dao-piece-nom').textContent = p.cartouche.titre || 'Pièce';
      const fig = pan.querySelector('.dao-piece-fig');
      if (p.exo.vox) { fig.innerHTML = ''; monterPiece3D(fig, p.exo.vox, { rotation: true }); } else fig.innerHTML = svgSur(p.exo.persp || '');
      pan.hidden = false; return;
    }
    pan.querySelector('.dao-piece-nom').textContent = pc.nom;
    pan.querySelector('.dao-piece-fig').innerHTML = svgPerspective(pc, { largeur: 300 });
    pan.hidden = false;
  };
  /** Correction de la cotation : positions non situées (tirets rouges), Ø manquants, cotes fausses / en double / surabondantes. */
  const svgCorrCotes = (pc, r) => {
    const b = boitePiece(pc), [ox, oy] = p.exo.o, W = b.x1 - b.x0, H = b.z1 - b.z0, D = 3;
    const yDessus = oy - p.exo.ecart - pc.prof;
    const L = (x1, y1, x2, y2) => svgEntite(p, { t: 'l', x1, y1, x2, y2, s: 'c' }, 'dao-cor-man');
    let svg = '';
    r.axes.x.pos.forEach((v, i) => { if (!r.axes.x.situees[i]) { const X = ox + v - b.x0; svg += L(X, oy - D, X, oy + H + D) + L(X, yDessus - D, X, yDessus + pc.prof + D); } });
    r.axes.z.pos.forEach((v, i) => { if (!r.axes.z.situees[i]) { const Y = oy + v - b.z0; svg += L(ox - D, Y, ox + W + D, Y); } });
    r.axes.y.pos.forEach((v, i) => { if (!r.axes.y.situees[i]) { const Y = yDessus + v; svg += L(ox - D, Y, ox + W + D, Y); } });
    svg += r.diam.manquants.map((t) => svgEntite(p, { t: 'c', cx: t.c[0], cy: t.c[1], r: t.d / 2 + 2, s: 'c' }, 'dao-cor-man')).join('');
    svg += [...r.fausses, ...r.surab].map((e) => svgEntite(p, e, 'dao-cor-trop')).join('');
    svg += [...r.double, ...r.regles.flatMap((x) => x.cotes)].map((e) => svgEntite(p, e, 'dao-cor-type')).join('');
    return svg;
  };
  let voirSolution = false, resultat = null;
  let minuteur = null;
  function dessinerExo(res) {
    resultat = res;
    if (p.exo.mode === 'ancien') {
      let svg = '';
      if (voirSolution) svg += [...(p.exo.sol || []), ...(p.exo.hach || []).map(([x, y, d]) => ({ t: 'h', pts: [[x, y], [x + d, y], [x + d, y + d], [x, y + d]], ang: 45, pas: 3, s: 'n' }))].map((e) => svgEntite(p, e, 'dao-cor-sol')).join('');
      if (res) {
        if (res.hach) svg += res.hach.manque.map((q) => { const [a, c] = versPapier(p, q[0], q[1]); return `<circle class="dao-pt-man" cx="${a}" cy="${c}" r="0.7"/>`; }).join('') + res.hach.trop.map((q) => { const [a, c] = versPapier(p, q[0], q[1]); return `<circle class="dao-pt-trop" cx="${a}" cy="${c}" r="0.7"/>`; }).join('');
        svg += res.manquants.map((e) => svgEntite(p, e, 'dao-cor-man')).join('') + res.type.map((e) => svgEntite(p, e, 'dao-cor-type')).join('') + res.trop.map((e) => svgEntite(p, e, 'dao-cor-trop')).join('');
      }
      feuille.calque('correction').innerHTML = svg;
      return;
    }
    const pc = pieceDe(p.exo);
    if (!pc) return;
    if (p.exo.mode === 'cotes') { feuille.calque('correction').innerHTML = res ? svgCorrCotes(pc, res) : ''; return; }
    const sb = p.exo.mode === 'section' ? sectionB(pc, p.exo.o, p.exo.ecart) : null;
    const [x, y] = versPapier(p, ...(sb ? sb.repere : p.exo.r || p.exo.o));
    let svg = `<path class="dao-repere" d="M${x - 4} ${y}H${x + 4}M${x} ${y - 4}V${y + 4}"/>`;
    const points = (r) => {
      const pt = (q, cls) => { const [a, c] = versPapier(p, q[0], q[1]); return `<circle class="${cls}" cx="${a}" cy="${c}" r="0.7"/>`; };
      return r.hach.manque.map((q) => pt(q, 'dao-pt-man')).join('') + r.hach.trop.map((q) => pt(q, 'dao-pt-trop')).join('');
    };
    if (PERSP.includes(p.exo.mode)) {
      if (voirSolution) svg += perspectiveEntites(pc, p.exo.r, p.exo.mode).traits.map((e) => svgEntite(p, e, 'dao-cor-sol')).join('');
    } else if (sb) {
      if (voirSolution) svg += [...sb.section, ...sb.hachures].map((e) => svgEntite(p, e, 'dao-cor-sol')).join('');
      if (res) svg += points(res);
    } else if (['coupe', 'demi', 'locale'].includes(p.exo.mode)) {
      const cp = p.exo.mode === 'locale' ? coupeLocale(pc, p.exo.o, p.exo.ecart) : coupeA(pc, p.exo.o, p.exo.ecart, { demi: p.exo.mode === 'demi' });
      if (voirSolution) svg += [...cp.face, cp.hachure].map((e) => svgEntite(p, e, 'dao-cor-sol')).join('');
      if (res) svg += points(res);
    } else {
      const sol = vues(pc, p.exo.o, p.exo.ecart);
      if (voirSolution) svg += [...sol.face, ...sol.dessus, ...sol.gauche].map((e) => svgEntite(p, e, 'dao-cor-sol')).join('');
    }
    if (res) {
      svg += res.manquants.map((e) => svgEntite(p, e, 'dao-cor-man')).join('');
      svg += res.type.map((e) => svgEntite(p, e, 'dao-cor-type')).join('');
      svg += res.trop.map((e) => svgEntite(p, e, 'dao-cor-trop')).join('');
    }
    feuille.calque('correction').innerHTML = svg;
  }
  if (p.exo) {
    const pc = p.exo.mode === 'ancien' ? { ancien: true } : pieceDe(p.exo);
    if (pc) { if (!PERSP.includes(p.exo.mode) && (!pc.ancien || p.exo.vox || p.exo.persp)) montrerPiece(pc); dessinerExo(null); }
    const resTxt = el.querySelector('.dao-exo-res');
    // mode examen : la 1re correction après avoir rendu la copie donne la note (elle ne change plus ensuite)
    const noterExamen = (score) => {
      const ex = p.exo.examen;
      if (ex?.fini && ex.note == null) { p = { ...p, exo: { ...p.exo, examen: { ...ex, note: score } } }; const s = el.querySelector('.dao-exam-note') || resTxt.insertAdjacentElement('afterend', Object.assign(document.createElement('span'), { className: 'dao-exam-note' })); s.innerHTML = `Note d'examen : <b>${score} %</b> · rendu en ${ex.temps} min sur ${ex.duree}`; }
    };
    const rendre = () => {
      const ex = p.exo.examen; if (!ex || ex.fini) return;
      const temps = Math.min(ex.duree, Math.max(1, Math.round((Date.now() - ex.debut) / 60000)));
      p = { ...p, exo: { ...p.exo, examen: { ...ex, fini: true, fin: Date.now(), temps } } }; sauver();
      corrigerAuMontage = true; remonter();
    };
    if (p.exo.examen && !p.exo.examen.fini) {
      const chrono = el.querySelector('.dao-chrono');
      const tic = () => {
        const reste = p.exo.examen.duree * 60000 - (Date.now() - p.exo.examen.debut);
        if (reste <= 0) { clearInterval(minuteur); rendre(); return; }
        const s = Math.ceil(reste / 1000);
        if (chrono) { chrono.textContent = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; chrono.classList.toggle('bad', s <= 300); }
      };
      minuteur = setInterval(tic, 1000); tic();
    }
    el.querySelector('.dao-exobar').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-exo]'); if (!b || !pc) return;
      if (b.dataset.exo === 'piece') { montrerPiece(pc); return; }
      if (b.dataset.exo === 'rendre') {
        if (!b.dataset.ok) { b.dataset.ok = '1'; b.textContent = 'Confirmer : rendre la copie'; setTimeout(() => { if (b.isConnected) { delete b.dataset.ok; b.textContent = 'Rendre la copie'; } }, 4000); return; }
        rendre(); return;
      }
      if (b.dataset.exo === 'solution') {
        voirSolution = !voirSolution; b.setAttribute('aria-pressed', String(voirSolution)); b.classList.toggle('on', voirSolution);
        dessinerExo(resultat); return;
      }
      const n = (k, s, pl) => `${k} ${k > 1 ? pl : s}`;
      if (p.exo.mode === 'cotes') {
        const r = corrigerCotes(pc, p.exo, p.entites || []);
        const meilleur = Math.max(r.score, p.exo.score ?? 0);
        p = { ...p, exo: { ...p.exo, score: meilleur } }; noterExamen(r.score); sauver();
        dessinerExo(r);
        const nonSit = Object.values(r.axes).reduce((s, a) => s + a.situees.filter((x) => !x).length, 0);
        const sansEnc = Object.values(r.axes).filter((a) => !a.encombrement).map((a) => a.nom);
        resTxt.innerHTML = `Score : <b>${r.score} %</b>${r.score === 100 ? ' — parfait !' : ''} · ${n(r.justes.length, 'cote juste', 'cotes justes')}`
          + (nonSit ? ` · <span class="dao-l-man">${n(nonSit, 'arête ou axe non situé', 'arêtes ou axes non situés')} (tirets rouges)</span>` : '')
          + (sansEnc.length ? ` · <span class="dao-l-man">encombrement manquant : ${sansEnc.join(', ')}</span>` : '')
          + (r.diam.manquants.length ? ` · <span class="dao-l-man">${n(r.diam.manquants.length, 'Ø manquant', 'Ø manquants')}</span>` : '')
          + (r.double.length ? ` · <span class="dao-l-type">${n(r.double.length, 'cote en double', 'cotes en double')}</span>` : '')
          + (r.surab.length ? ` · <span class="dao-l-trop">${n(r.surab.length, 'cote surabondante (chaîne fermée)', 'cotes surabondantes (chaînes fermées)')}</span>` : '')
          + (r.fausses.length ? ` · <span class="dao-l-trop">${n(r.fausses.length, 'cote mal placée', 'cotes mal placées')}</span>` : '')
          + ` · meilleur : ${meilleur} %`
          + (r.regles.length ? `<span class="dao-regles">Présentation (cotes en violet) : ${r.regles.map((x) => `<span class="dao-l-type">${esc(x.txt)}${x.cotes.length > 1 ? ` ×${x.cotes.length}` : ''}</span>`).join(' · ')}</span>` : '');
        return;
      }
      let r;
      if (p.exo.mode === 'ancien') r = corrigerAncien(p.exo, p.entites || []);
      else if (PERSP.includes(p.exo.mode)) {
        const sol = perspectiveEntites(pc, p.exo.r, p.exo.mode), c = sol.cadre, M = 6;
        const dans = (x, y) => x >= c.x - M && x <= c.x + c.w + M && y >= c.y - M && y <= c.y + c.h + M;
        r = corriger(sol.traits, (p.entites || []).filter((e) => (e.t === 'l' && dans((e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2)) || ((e.t === 'c' || e.t === 'a') && dans(e.cx, e.cy))));
      } else if (p.exo.mode === 'section') r = corrigerSection(pc, p.exo, p.entites || []);
      else if (['coupe', 'demi', 'locale'].includes(p.exo.mode)) r = corrigerCoupe(pc, p.exo, p.entites || []);
      else { const sol = vues(pc, p.exo.o, p.exo.ecart); r = corriger([...sol.face, ...sol.dessus, ...sol.gauche], p.entites || []); }
      const meilleur = Math.max(r.score, p.exo.score ?? 0);
      p = { ...p, exo: { ...p.exo, score: meilleur } }; noterExamen(r.score); sauver();
      dessinerExo(r);
      resTxt.innerHTML = `Score : <b>${r.score} %</b>${r.score === 100 ? ' — parfait !' : ''} · ${n(r.ok.length, 'trait juste', 'traits justes')}`
        + (r.manquants.length ? ` · <span class="dao-l-man">${n(r.manquants.length, 'manquant', 'manquants')}</span>` : '')
        + (r.type.length ? ` · <span class="dao-l-type">${n(r.type.length, 'mauvais type de trait', 'mauvais types de trait')}</span>` : '')
        + (r.trop.length ? ` · <span class="dao-l-trop">${n(r.trop.length, 'trait en trop', 'traits en trop')}</span>` : '')
        + (r.hach ? ` · hachures : <b>${r.hach.score} %</b>${r.hach.manque.length ? ' <span class="dao-l-man">(points rouges : matière non hachurée)</span>' : ''}${r.hach.trop.length ? ' <span class="dao-l-trop">(points orange : hachures dans un vide)</span>' : ''}` : '')
        + ` · meilleur : ${meilleur} %`;
    });
  }
  if (corrigerAuMontage) { corrigerAuMontage = false; el.querySelector('[data-exo=corriger]')?.click(); }
  el.querySelector('.dao-exo-choix').addEventListener('change', (ev) => {
    const [mode, v] = ev.target.value.split(':'); ev.target.value = '';
    const pc = /^[hs][123]$/.test(v) ? trouverPiece(`${v}-${mode === 'locale' ? graineTrouVertical(+v[1]) : grainePiece()}`) : trouverPiece(v);
    if (pc) { creerExo(pc, p, mode); remonter(); }
  });

  el.querySelector('.dao-exemple').addEventListener('change', (ev) => {
    const pc = PIECES.find((x) => x.id === ev.target.value); ev.target.value = '';
    if (!pc) return;
    const b = boitePiece(pc), z = zone(p), k = facteur(p.echelle);
    const H = b.z1 - b.z0, ecart = 15, marge = 15;
    const oy = Math.max(pc.prof + ecart + marge, z.h / k - marge - H);
    const v = vues(pc, [marge, oy], ecart);
    traceur.inserer([...v.face, ...v.dessus, ...v.gauche]);
    montrerPiece(pc);
  });
  el.querySelector('[data-act=fermer-piece]').addEventListener('click', () => { el.querySelector('.dao-piece').hidden = true; });
  el.querySelector('[data-stylet]').addEventListener('change', (ev) => stockage.ecrire('dao.stylet', ev.target.checked));
  el.querySelectorAll('[data-p]').forEach((c) => c.addEventListener('change', () => {
    const k = c.dataset.p;
    p = { ...p, [k]: c.type === 'checkbox' ? c.checked : c.value };
    sauver(); majPas();
    feuille.maj(p, { recadrer: k === 'format' || k === 'orientation' });
    traceur.rafraichir();
  }));

  const form = el.querySelector('.dao-cartouche-f');
  form.addEventListener('input', () => {
    const f = new FormData(form);
    p = { ...p, cartouche: { ...p.cartouche, ...Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v).trim()])) } };
    sauver(); feuille.maj(p);
    const opt = el.querySelector(`[data-pl] option[value="${id}"]`); if (opt) opt.textContent = nomDe(p);
  });
  form.addEventListener('submit', (ev) => ev.preventDefault());

  const plein = (on) => {
    bloc.classList.toggle('dao-plein', on);
    document.body.classList.toggle('pl-plein-ouvert', on);
    el.querySelector('[data-act=plein] span').textContent = on ? 'Quitter' : 'Plein écran';
    requestAnimationFrame(() => feuille.ajuster());
  };
  const echap = (ev) => { if (ev.key === 'Escape' && bloc.classList.contains('dao-plein')) plein(false); };
  window.addEventListener('keydown', echap);

  el.querySelector('[data-pl]').addEventListener('change', (ev) => { stockage.ecrire(CLE_COURANTE, ev.target.value); remonter(); });
  el.querySelectorAll('[data-pla]').forEach((b) => b.addEventListener('click', () => {
    const t = toutes(); const a = b.dataset.pla;
    if (a === 'nouvelle' || a === 'dupliquer') {
      const n = nouvelId();
      const base = a === 'nouvelle' ? { ...nouvellePlanche(), format: p.format, orientation: p.orientation, cartouche: { ...nouvellePlanche().cartouche, auteur: p.cartouche.auteur, classe: p.cartouche.classe } }
        : { ...p, cartouche: { ...p.cartouche, titre: `${nomDe(p)} (copie)` } };
      t[n] = { ...base, maj: Date.now() };
      stockage.ecrire(CLE, t); stockage.ecrire(CLE_COURANTE, n); remonter();
    } else if (a === 'supprimer') {
      if (b.dataset.sur !== '1') { b.dataset.sur = '1'; b.querySelector('span').textContent = `Supprimer « ${nomDe(p)} » ?`; setTimeout(() => { if (b.isConnected) { b.dataset.sur = ''; b.querySelector('span').textContent = 'Supprimer'; } }, 3500); return; }
      delete t[id]; stockage.ecrire(CLE, t); stockage.supprimer(CLE_COURANTE); remonter();
    }
  }));

  el.querySelector('.dao-barre').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'plus') feuille.zoomer(1.25);
    else if (a === 'moins') feuille.zoomer(0.8);
    else if (a === 'ajuster') feuille.ajuster();
    else if (a === 'plein') plein(!bloc.classList.contains('dao-plein'));
    else if (a === 'cartouche') { form.hidden = !form.hidden; b.setAttribute('aria-expanded', String(!form.hidden)); }
  });

  // appelé par le routeur avant de quitter la page
  return () => { clearInterval(minuteur); feuille.detruire(); window.removeEventListener('keydown', echap); window.removeEventListener('keydown', touches); document.body.classList.remove('pl-plein-ouvert'); };
}
