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
import { monterFeuille, nouvellePlanche, ECHELLES, FORMATS, pasGrille, zone, facteur } from '../dao/feuille.js';
import { PIECES, vues, boite as boitePiece } from '../dao/pieces.js';
import { creerTraceur, STYLES, OUTILS, COTES } from '../dao/trace.js';

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
export function vuePlancheLibre(el) {
  let stop = null;
  const monter = () => { stop?.(); stop = monterPage(el, monter); };
  monter();
  return () => stop?.();
}

const boutonsOutils = (liste) => liste.map((k) => { const o = OUTILS[k]; return `<button class="btn dao-b" type="button" data-outil="${k}" title="${esc(o.nom)}${o.touche ? ` (${o.touche.toUpperCase()})` : ''}">${ICONES_OUTILS[k] || ''}<span>${esc(o.nom)}</span></button>`; }).join('');

const fmt = (v) => (Math.round(v * 10) / 10).toLocaleString('fr-BE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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
            <select class="field dao-exemple" title="Ajoute les 3 vues (face, dessus, gauche) d'une pièce d'exemple, pour observer la mise en page européenne">
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
        <div class="dao-cadre-ecran"></div>
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
    enregistrer: (entites) => { p = { ...p, entites }; sauver(); },
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

  el.querySelector('.dao-exemple').addEventListener('change', (ev) => {
    const pc = PIECES.find((x) => x.id === ev.target.value); ev.target.value = '';
    if (!pc) return;
    const b = boitePiece(pc), z = zone(p), k = facteur(p.echelle);
    const H = b.z1 - b.z0, ecart = 15, marge = 15;
    const oy = Math.max(pc.prof + ecart + marge, z.h / k - marge - H);
    const v = vues(pc, [marge, oy], ecart);
    traceur.inserer([...v.face, ...v.dessus, ...v.gauche]);
  });
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
  return () => { feuille.detruire(); window.removeEventListener('keydown', echap); window.removeEventListener('keydown', touches); document.body.classList.remove('pl-plein-ouvert'); };
}
