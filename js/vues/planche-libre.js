/* =====================================================================
   VUE PLANCHE LIBRE — #/dessin/libre
   ---------------------------------------------------------------------
   Feuille blanche A4/A3 avec cadre et cartouche, échelle au choix,
   grille d'aide masquable, zoom et déplacement (souris, stylet, doigts).
   Les outils de tracé arrivent avec le moteur (morceaux suivants).
   La planche est gardée sur l'appareil (clé « dao.planche »).
   ===================================================================== */

import { esc, stockage } from '../utils.js';
import { icone } from '../icones.js';
import { styleMatiere } from '../matieres.js';
import { matiere } from '../store.js';
import { monterFeuille, nouvellePlanche, ECHELLES, FORMATS, pasGrille } from '../dao/feuille.js';

const CLE = 'dao.planche';

function lirePlanche() {
  const d = nouvellePlanche();
  const s = stockage.lire(CLE, null);
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

const fmt = (v) => (Math.round(v * 10) / 10).toLocaleString('fr-BE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function vuePlancheLibre(el) {
  const m = matiere('dessin');
  let p = lirePlanche();
  const sauver = () => stockage.ecrire(CLE, p);
  const choix = (nom, valeurs, actuel, etiquette) => `<label class="dao-choix"><span>${etiquette}</span>
    <select class="field" data-p="${nom}">${valeurs.map(([v, l]) => `<option value="${esc(v)}" ${v === actuel ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;

  el.innerHTML = `
    <div class="mc" ${m ? styleMatiere(m) : ''}>
      <div class="crumb"><a href="#/">Accueil</a><span class="crumb-sep">›</span><a href="#/dessin">Atelier de dessin</a><span class="crumb-sep">›</span><span>Planche libre</span></div>
      <div class="atelier-retour">
        <a class="btn" href="#/dessin">${icone('fleche-g')} Atelier</a>
        <span class="badge">En construction</span>
        <span class="muted">Feuille, échelle et cartouche sont prêts ; les outils de tracé arrivent à la prochaine mise à jour.</span>
      </div>
      <div class="dao" data-plein="0">
        <div class="dao-barre" role="toolbar" aria-label="Réglages de la feuille">
          ${choix('format', Object.keys(FORMATS).map((f) => [f, f]), p.format, 'Format')}
          ${choix('orientation', [['paysage', 'Paysage'], ['portrait', 'Portrait']], p.orientation, 'Sens')}
          ${choix('echelle', ECHELLES.map((e) => [e, e]), p.echelle, 'Échelle')}
          <label class="chip dao-chip"><input type="checkbox" data-p="grille" ${p.grille ? 'checked' : ''}><span>Grille d'aide</span></label>
          <span class="dao-sep"></span>
          <button class="btn" type="button" data-act="cartouche" aria-expanded="false">${icone('crayon')} Cartouche</button>
          <span class="dao-sep"></span>
          <button class="btn icon" type="button" data-act="moins" title="Réduire (molette ou 2 doigts)">−</button>
          <span class="dao-zoom muted" title="100 % ≈ taille réelle à l'écran">100 %</span>
          <button class="btn icon" type="button" data-act="plus" title="Agrandir (molette ou 2 doigts)">+</button>
          <button class="btn" type="button" data-act="ajuster" title="Voir toute la feuille">Feuille entière</button>
          <button class="btn primary" type="button" data-act="plein" title="Plein écran">⛶ <span>Plein écran</span></button>
        </div>
        <form class="panel dao-cartouche-f" hidden>
          <label>Titre <input class="field" name="titre" maxlength="40" value="${esc(p.cartouche.titre)}" placeholder="Ex. : Support en équerre"></label>
          <label>Dessiné par <input class="field" name="auteur" maxlength="30" value="${esc(p.cartouche.auteur)}" placeholder="Prénom Nom"></label>
          <label>Classe <input class="field" name="classe" maxlength="12" value="${esc(p.cartouche.classe)}"></label>
          <label>N° <input class="field" name="numero" maxlength="10" value="${esc(p.cartouche.numero)}"></label>
          <p class="muted">La date, l'échelle et le format se remplissent tout seuls.</p>
        </form>
        <div class="dao-cadre-ecran"></div>
        <div class="dao-etat muted">
          <span class="dao-pos">X — · Y —</span>
          <span class="dao-pas"></span>
          <span class="dao-astuce">Molette : zoom · glisser : déplacer · tablette : 2 doigts pour zoomer</span>
        </div>
      </div>
    </div>`;

  const bloc = el.querySelector('.dao');
  const pos = el.querySelector('.dao-pos');
  const zoomTxt = el.querySelector('.dao-zoom');
  const pasTxt = el.querySelector('.dao-pas');
  const majPas = () => { pasTxt.textContent = p.grille ? `grille : ${pasGrille(p)} mm (réels)` : ''; };

  const feuille = monterFeuille(el.querySelector('.dao-cadre-ecran'), p, {
    outil: () => 'main',
    surZoom: (z) => { zoomTxt.textContent = `${z} %`; },
    surCurseur: (c) => { pos.textContent = c ? `X ${fmt(c[0])} · Y ${fmt(c[1])} mm` : 'X — · Y —'; },
  });
  majPas();

  el.querySelectorAll('[data-p]').forEach((c) => c.addEventListener('change', () => {
    const k = c.dataset.p;
    p = { ...p, [k]: c.type === 'checkbox' ? c.checked : c.value };
    sauver(); majPas();
    feuille.maj(p, { recadrer: k === 'format' || k === 'orientation' });
  }));

  const form = el.querySelector('.dao-cartouche-f');
  form.addEventListener('input', () => {
    const f = new FormData(form);
    p = { ...p, cartouche: { ...p.cartouche, ...Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v).trim()])) } };
    sauver(); feuille.maj(p);
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
  return () => { feuille.detruire(); window.removeEventListener('keydown', echap); document.body.classList.remove('pl-plein-ouvert'); };
}
