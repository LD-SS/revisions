/* =====================================================================
   EXERCICES — « sur papier + auto-correction »
   ---------------------------------------------------------------------
   On résout sur sa feuille (comme à l'examen), puis on dévoile la correction
   étape par étape et on se note : Juste / Presque / Faux.
   Exercice : { id, titre, consigne, niveau (1-3), tags?, page, doc?, complement?,
                indice?, items: [{ q, r, etapes?: [..] }] }
     q / r / etapes : texte enrichi ($formule$, **gras**…), voir rendu.js.
   Les notes sont gardées dans ce navigateur (clé « exos »), pour la progression.
   Score en % : Juste = 1, Presque = ½, Faux = 0 (dernière note de chaque exercice).
   ===================================================================== */

import { esc, melanger, stockage, pluriel } from './utils.js';
import { icone } from './icones.js';
import { texte, enLigne } from './rendu.js';
import { badgeSource } from './synthese.js';
import { monterPlanche } from './planche.js';
import { definirExerciceCourant, ouvrirProposition, estAuteur, boiteActive } from './proposer.js';
import { svgSur } from './rendu.js';

const NOTES = { ok: { lib: 'Juste', val: 1 }, mid: { lib: 'Presque', val: 0.5 }, ko: { lib: 'Faux', val: 0 } };
const LETTRES = 'abcdefghijklmnopqrstuvwxyz';

const lireNotes = () => stockage.lire('exos', {});
export function noteExo(cle) { return lireNotes()[cle] || null; }
function noter(cle, r) {
  const t = lireNotes();
  const avant = t[cle];
  t[cle] = { r, n: (avant?.n || 0) + 1, d: new Date().toISOString().slice(0, 10) };
  stockage.ecrire('exos', t);
}

/** Score (%) d'une liste d'exercices déjà notés, ou null. */
export function scoreExos(prefixe, exos) {
  const t = lireNotes();
  const notes = exos.map((e) => t[`${prefixe}/${e.id}`]).filter(Boolean);
  if (!notes.length) return null;
  return { pct: Math.round(100 * notes.reduce((s, n) => s + NOTES[n.r].val, 0) / notes.length), faits: notes.length };
}

export function lecteurExercices(conteneur, tous, options = {}) {
  const prefixe = options.prefixe || '';
  const cle = (e) => `${prefixe}/${e.id}`;
  const etat = { filtre: 'tous', liste: [], pos: 0, vus: 0, indice: false };

  const FILTRES = [
    ['tous', 'Tous'], ['afaire', 'Pas encore faits'], ['refaire', 'À refaire (faux / presque)'],
    ['cours', 'Du cours'], ['complement', 'Compléments'],
    ['n1', 'Niveau ★'], ['n2', 'Niveau ★★'], ['n3', 'Niveau ★★★'],
  ];
  function filtrer() {
    const t = lireNotes();
    return tous.filter((e) => {
      const n = t[cle(e)];
      switch (etat.filtre) {
        case 'afaire': return !n;
        case 'refaire': return n && n.r !== 'ok';
        case 'cours': return !e.complement;
        case 'complement': return !!e.complement;
        case 'n1': case 'n2': case 'n3': return (e.niveau || 1) === +etat.filtre[1];
        default: return true;
      }
    });
  }
  function nouvelleListe(liste) { etat.liste = liste; etat.pos = 0; reset(); afficher(); }
  function reset() { etat.vus = 0; etat.indice = false; }

  /* Étapes à dévoiler : pour chaque item, ses étapes puis sa réponse. */
  function etapes(e) {
    const out = [];
    e.items.forEach((it, i) => {
      const lettre = e.items.length > 1 ? `${LETTRES[i]}) ` : '';
      (it.etapes || []).forEach((s, k) => out.push({ i, html: texte(s), premiere: k === 0, lettre }));
      out.push({ i, html: texte(it.r), reponse: true, premiere: !(it.etapes || []).length, lettre });
    });
    return out;
  }

  function afficher() {
    if (!tous.length) {
      conteneur.innerHTML = `<div class="panel empty"><div class="m-ic">${icone('exercices')}</div>
        <h3>Pas encore d'exercices</h3><p class="muted">Les exercices de ce chapitre n'ont pas encore été préparés.</p></div>`;
      return;
    }
    const t = lireNotes();
    const sc = scoreExos(prefixe, tous);
    const n = etat.liste.length;
    const barre = `
      <div class="fc-bar">
        <strong>${n ? `Exercice ${etat.pos + 1} / ${n}` : 'Aucun exercice'}</strong>
        <span class="badge ${sc ? 'ok' : ''}" title="Juste = 1, Presque = ½, Faux = 0">${sc ? `Score ${sc.pct} % · ${sc.faits}/${tous.length} faits` : `${pluriel(tous.length, 'exercice')}`}</span>
        <span class="grow"></span>
        <select class="field" data-action="filtre" aria-label="Filtrer les exercices">
          ${FILTRES.map(([v, l]) => `<option value="${v}" ${v === etat.filtre ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <button class="btn" data-action="melanger" title="Mélanger">${icone('melanger')}<span>Mélanger</span></button>
      </div>
      <div class="ex-points" role="list" aria-label="Exercices">
        ${etat.liste.map((e, i) => {
          const note = t[cle(e)];
          return `<button class="ex-pt ${note ? note.r : ''} ${i === etat.pos ? 'actif' : ''}" data-action="aller" data-i="${i}"
            title="${esc(e.titre || `Exercice ${i + 1}`)}${note ? ` — ${NOTES[note.r].lib}` : ''}" role="listitem">${i + 1}</button>`;
        }).join('')}
      </div>`;
    conteneur.innerHTML = `<div class="fc-wrap ex-wrap">${barre}${n ? carte(etat.liste[etat.pos], t) : `
      <div class="panel empty"><p class="muted">Aucun exercice pour ce filtre.</p>
      <button class="btn" data-action="tous">Voir tous les exercices</button></div>`}</div>`;
    const ec = etat.liste[etat.pos];
    definirExerciceCourant(ec ? { id: ec.id, titre: ec.titre, num: tous.indexOf(ec) + 1 } : null);
    monter();
  }

  function carte(e, t) {
    if (e.type === 'dessin') return carteDessin(e, t);
    const note = t[cle(e)];
    const liste = etapes(e);
    const fini = etat.vus >= liste.length;
    const etoiles = '★'.repeat(e.niveau || 1) + '☆'.repeat(3 - (e.niveau || 1));
    const items = e.items.map((it, i) => `<li>${e.items.length > 1 ? `<span class="ex-l">${LETTRES[i]})</span>` : ''}<div>${texte(it.q)}</div></li>`).join('');
    let corr = '';
    if (etat.vus) {
      let html = ''; let item = -1;
      for (const s of liste.slice(0, etat.vus)) {
        if (s.i !== item) { if (item >= 0) html += '</div>'; item = s.i; html += `<div class="ex-sol">${s.lettre ? `<span class="ex-l">${s.lettre}</span>` : ''}`; }
        html += `<div class="ex-step ${s.reponse ? 'rep' : ''}">${s.reponse ? `<span class="ex-rep">${icone('check')} Réponse</span>` : ''}${s.html}</div>`;
      }
      corr = `<div class="ex-corr"><h4>${icone('crayon')} Correction</h4>${html}</div></div>`;
    }
    return `
      <div class="panel ex-card">
        <div class="ex-head">
          <span class="ex-niv" title="Niveau ${e.niveau || 1} sur 3">${etoiles}</span>
          <h3>${enLigne(e.titre || 'Exercice')}</h3>
          <span class="grow"></span>
          ${note ? `<span class="badge ex-${note.r}">${NOTES[note.r].lib}${note.n > 1 ? ` · ${note.n}×` : ''}</span>` : ''}
          ${badgeSource(e, options.docs)}
        </div>
        ${e.consigne ? `<div class="ex-consigne">${texte(e.consigne)}</div>` : ''}
        <ol class="ex-items ${e.items.length > 1 ? '' : 'seul'}">${items}</ol>
        ${!etat.vus ? `<p class="ex-papier">${icone('crayon')} Résous sur ta feuille, puis vérifie avec la correction.</p>` : ''}
        ${e.indice ? (etat.indice ? `<div class="ex-indice">${icone('ampoule')}<div>${texte(e.indice)}</div></div>`
          : (!etat.vus ? `<button class="btn" data-action="indice">${icone('ampoule')} Un indice</button>` : '')) : ''}
        ${corr}
        <div class="fc-actions">
          ${!fini ? `<button class="btn primary" data-action="etape">${icone('fleche-d')} ${etat.vus ? 'Étape suivante' : 'Voir la correction'}</button>
                     <button class="btn" data-action="tout">Tout afficher</button>` : ''}
          ${fini ? `
            <span class="ex-q">Comment ça s'est passé ?</span>
            <button class="btn ok" data-action="noter" data-r="ok">${icone('check')} Juste</button>
            <button class="btn ex-mid" data-action="noter" data-r="mid">≈ Presque</button>
            <button class="btn bad" data-action="noter" data-r="ko">${icone('croix')} Faux</button>` : ''}
        </div>
        <div class="fc-actions ex-nav">
          <button class="btn icon" data-action="prec" title="Exercice précédent" ${etat.pos === 0 ? 'disabled' : ''}>${icone('fleche-g')}</button>
          ${estAuteur() || !boiteActive() ? '' : `<button class="btn ex-prop" data-action="proposer" title="Signaler une erreur ou proposer une amélioration pour cet exercice">${icone('ampoule')}<span>Une erreur ? Une idée ?</span></button>`}
          <button class="btn" data-action="suiv" ${etat.pos >= etat.liste.length - 1 ? 'disabled' : ''}>Passer ${icone('fleche-d')}</button>
        </div>
      </div>`;
  }


  /* ---------- Exercice de dessin : planche interactive ---------- */
  function entete(e, note) {
    const etoiles = '★'.repeat(e.niveau || 1) + '☆'.repeat(3 - (e.niveau || 1));
    return `<div class="ex-head">
          <span class="ex-niv" title="Niveau ${e.niveau || 1} sur 3">${etoiles}</span>
          <h3>${enLigne(e.titre || 'Exercice')}</h3>
          <span class="grow"></span>
          ${note ? `<span class="badge ex-${note.r}">${NOTES[note.r].lib}${note.n > 1 ? ` · ${note.n}×` : ''}</span>` : ''}
          ${badgeSource(e, options.docs)}
        </div>`;
  }
  function carteDessin(e, t) {
    const note = t[cle(e)];
    const corrige = etat.vus > 0;
    return `
      <div class="panel ex-card ex-dessin">
        ${entete(e, note)}
        <div class="ex-dz">
          <div class="ex-consigne">${texte(e.consigne || '')}
            ${e.perspective ? `<figure class="fig ex-persp">${svgSur(e.perspective)}<figcaption>Perspective · F = sens de la vue de face</figcaption></figure>` : ''}
          </div>
        </div>
        ${e.indice ? (etat.indice ? `<div class="ex-indice">${icone('ampoule')}<div>${texte(e.indice)}</div></div>`
          : (!corrige ? `<button class="btn" data-action="indice">${icone('ampoule')} Un indice</button>` : '')) : ''}
        <div class="ex-planche" data-planche></div>
        ${corrige ? '<div class="ex-res" data-res></div>' : ''}
        <div class="fc-actions">
          ${!corrige ? `<button class="btn primary" data-action="verifier">${icone('check')} Vérifier mon dessin</button>` : `
            <span class="ex-q">Comment ça s'est passé ?</span>
            <button class="btn ok" data-action="noter" data-r="ok">${icone('check')} Juste</button>
            <button class="btn ex-mid" data-action="noter" data-r="mid">≈ Presque</button>
            <button class="btn bad" data-action="noter" data-r="ko">${icone('croix')} Faux</button>
            <button class="btn" data-action="retoucher">${icone('crayon')} Corriger mon dessin</button>`}
        </div>
        <div class="fc-actions ex-nav">
          <button class="btn icon" data-action="prec" title="Exercice précédent" ${etat.pos === 0 ? 'disabled' : ''}>${icone('fleche-g')}</button>
          ${estAuteur() || !boiteActive() ? '' : `<button class="btn ex-prop" data-action="proposer" title="Signaler une erreur ou proposer une amélioration pour cet exercice">${icone('ampoule')}<span>Une erreur ? Une idée ?</span></button>`}
          <button class="btn" data-action="suiv" ${etat.pos >= etat.liste.length - 1 ? 'disabled' : ''}>Passer ${icone('fleche-d')}</button>
        </div>
      </div>`;
  }
  function monter() {
    const zone = conteneur.querySelector('[data-planche]');
    if (!zone) return;
    const e = etat.liste[etat.pos];
    const p = monterPlanche(zone, e, { cle: cle(e), correction: etat.vus > 0 });
    const r = p.resultat; const res = conteneur.querySelector('[data-res]');
    if (r && res) {
      const verdict = r.pct >= 95 && !r.enTrop.length ? 'ok' : r.pct >= 70 ? 'mid' : 'ko';
      res.innerHTML = `<div class="ex-bilan ${verdict}"><b>${r.pct} %</b>
        <span>${r.ok} / ${r.n} traits justes</span>
        ${r.manque ? `<span class="pl-leg manque">${r.manque} manquant${r.manque > 1 ? 's' : ''}</span>` : ''}
        ${r.type ? `<span class="pl-leg type">${r.type} mauvais type de trait</span>` : ''}
        ${r.enTrop.length ? `<span class="pl-leg trop">${r.enTrop.length} en trop</span>` : ''}</div>
        <p class="muted pl-legende"><span class="pl-leg ok">vert</span> trouvé · <span class="pl-leg manque">rouge</span> manquant · <span class="pl-leg type">orange</span> bon tracé mais mauvais type de trait · <span class="pl-leg trop">violet</span> en trop.
        <label><input type="checkbox" checked data-action="voircorr"> Afficher la correction</label></p>`;
      res.querySelector('[data-action=voircorr]').addEventListener('change', (ev) => p.basculer(ev.target.checked));
    }
  }

  function aller(p) {
    if (p < 0 || p >= etat.liste.length) return;
    etat.pos = p; reset(); afficher();
    conteneur.querySelector('.ex-card')?.scrollIntoView({ block: 'nearest' });
  }

  const actions = {
    etape: () => { etat.vus++; afficher(); conteneur.querySelector('.ex-step:last-child')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); },
    verifier: () => { etat.vus = 1; afficher(); conteneur.querySelector('[data-res]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); },
    proposer: () => ouvrirProposition('erreur'),
    retoucher: () => { etat.vus = 0; afficher(); },
    tout: () => { etat.vus = etapes(etat.liste[etat.pos]).length; afficher(); },
    indice: () => { etat.indice = true; afficher(); },
    noter: (b) => {
      noter(cle(etat.liste[etat.pos]), b.dataset.r);
      options.onNote?.(etat.liste[etat.pos], b.dataset.r);
      if (etat.pos < etat.liste.length - 1) aller(etat.pos + 1); else afficher();
    },
    prec: () => aller(etat.pos - 1),
    suiv: () => aller(etat.pos + 1),
    aller: (b) => aller(+b.dataset.i),
    melanger: () => nouvelleListe(melanger(filtrer())),
    tous: () => { etat.filtre = 'tous'; nouvelleListe(filtrer()); },
  };
  conteneur.addEventListener('click', (e) => {
    if (e.target.closest('.pg')) return;
    const b = e.target.closest('[data-action]');
    if (!b || b.tagName === 'SELECT' || b.disabled) return;
    actions[b.dataset.action]?.(b);
  });
  conteneur.addEventListener('change', (e) => {
    if (e.target.dataset.action === 'filtre') { etat.filtre = e.target.value; nouvelleListe(filtrer()); }
  });

  nouvelleListe(filtrer());
  return null;
}
