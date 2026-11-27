/* =====================================================================
   EXERCICES — « sur papier + auto-correction »
   ---------------------------------------------------------------------
   On résout sur sa feuille (comme à l'examen), puis on dévoile la correction
   étape par étape et on se note : Juste / Presque / Faux.
   Exercice : { id, titre, consigne, niveau (1-3), tags?, page, doc?, complement?,
                indice?, simu? (circuit du simulateur), items: [{ q, r, etapes?: [..] }] }
     q / r / etapes : texte enrichi ($formule$, **gras**…), voir rendu.js.
   Les notes sont gardées dans ce navigateur (clé « exos »), pour la progression.
   Score en % : Juste = 1, Presque = ½, Faux = 0 (dernière note de chaque exercice).
   ===================================================================== */

import { esc, melanger, stockage, pluriel } from './utils.js';
import { icone } from './icones.js';
import { texte, enLigne } from './rendu.js';
import { badgeSource } from './synthese.js';
import { monterPlanche, AIDES, niveauAide, choisirAide, corriger, prochainManquant } from './planche.js';
import { monterPiece3D } from './piece3d.js';
import { definirExerciceCourant, ouvrirProposition, estAuteur, boiteActive } from './proposer.js';
import { svgSur } from './rendu.js';
import { construire, CONSIGNES } from './geometrie.js';
import { monterCircuit } from './circuit.js';

const NOTES = { ok: { lib: 'Juste', val: 1 }, mid: { lib: 'Presque', val: 0.5 }, ko: { lib: 'Faux', val: 0 } };
const LETTRES = 'abcdefghijklmnopqrstuvwxyz';

const lireNotes = () => stockage.lire('exos', {});
export function noteExo(cle) { return lireNotes()[cle] || null; }
function noter(cle, r, plus = null) {
  const t = lireNotes();
  const avant = t[cle];
  t[cle] = { r, n: (avant?.n || 0) + 1, d: new Date().toISOString().slice(0, 10), ...(plus || {}) };
  stockage.ecrire('exos', t);
}

/** Score (%) d'une liste d'exercices déjà notés, ou null. */
export function scoreExos(prefixe, exos) {
  const t = lireNotes();
  const notes = exos.map((e) => t[e._cle || `${prefixe}/${e.id}`]).filter(Boolean);
  if (!notes.length) return null;
  return { pct: Math.round(100 * notes.reduce((s, n) => s + NOTES[n.r].val, 0) / notes.length), faits: notes.length };
}

/** Exercice de dessin décrit seulement par sa pièce et sa tâche : on calcule la planche. */
export function preparerDessin(e) {
  if (e.type !== 'dessin' || !e.piece || !e.tache || e.solution) return e;
  Object.assign(e, construire(e.piece, e.tache));
  if (!e.consigne) e.consigne = CONSIGNES[e.tache.type === 'vue' ? e.tache.vue : e.tache.type];
  if (!e.items) e.items = [{ q: e.consigne, r: 'Voir la correction sur la planche.' }];
  return e;
}

export function lecteurExercices(conteneur, tous, options = {}) {
  const prefixe = options.prefixe || '';
  const cle = (e) => e._cle || `${prefixe}/${e.id}`;
  for (const e of tous) preparerDessin(e);
  const etat = { filtre: 'tous', liste: [], pos: 0, vus: 0, indice: false };

  const avecCplt = tous.some((e) => e.complement);
  const FILTRES = [
    ['tous', 'Tous'], ['afaire', 'À faire'], ['refaire', 'À refaire'],
    ...(avecCplt ? [['cours', 'Du cours'], ['complement', 'Compléments']] : []),
    ['n1', '★'], ['n2', '★★'], ['n3', '★★★'],
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
  function nouvelleListe(liste, pos = 0) { etat.liste = liste; etat.pos = Math.max(0, Math.min(pos, liste.length - 1)); reset(); afficher(); }
  function reset() { etat.vus = 0; etat.indice = false; etat.rep = false; etat.dev = new Set(); etat.saisie = {}; etat.verif = new Set(); }

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
        <button class="btn" data-action="melanger" title="Mélanger">${icone('melanger')}<span>Mélanger</span></button>
      </div>
      <div class="ex-filtres" role="radiogroup" aria-label="Filtrer les exercices">
        ${FILTRES.map(([v, l]) => `<label class="chip"><input type="radio" name="exf" data-action="filtre" value="${v}" ${v === etat.filtre ? 'checked' : ''}><span>${l}</span></label>`).join('')}
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

  // Légende des schémas de correction en couleurs (trigonométrie : côtés vus depuis l'angle utilisé)
  const LEGENDE_TRIGO = '<b class="leg-opp">rouge</b> = côté opposé · <b class="leg-adj">bleu</b> = adjacent · <b class="leg-hyp">vert</b> = hypoténuse · <b>?</b> = ce qu\'on cherche';
  const imageOk = (x) => typeof x === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(x);

  /* ---------- Cases réponse : la valeur se tape dans l'exercice, la correction est immédiate ---------- */
  const lireNb = (x) => {
    let t = String(x || '').trim().replace(/\s+/g, '').replace(/[−–]/g, '-').replace(',', '.');
    const m = t.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([kmµu]?)/i);
    if (!m) return NaN;
    const f = { k: 1e3, K: 1e3, m: 1e-3, 'µ': 1e-6, u: 1e-6 }[m[2]] || 1;
    return parseFloat(m[1]) * f;
  };
  function jugerCase(v, b) {
    const x = lireNb(v);
    if (!Number.isFinite(x)) return { ok: false, msg: 'Écris un nombre' };
    const ans = +b.ans; const tol = b.tol ?? 0.02;
    const pres = (a, c) => Math.abs(a - c) <= Math.max(tol * Math.abs(c), 1e-9 + (c === 0 ? 0.01 : 0));
    if (pres(x, ans)) return { ok: true };
    if (ans !== 0 && pres(-x, ans)) return { ok: false, msg: 'Vérifie le signe' };
    if (ans !== 0 && (pres(x * 1000, ans) || pres(x / 1000, ans))) return { ok: false, msg: "Vérifie l'unité (×1000)" };
    return { ok: false, msg: 'Pas encore' };
  }
  function cases(it, i) {
    if (!Array.isArray(it.val) || !it.val.length) return '';
    const vu = etat.verif.has(i);
    const champs = it.val.map((b, k) => {
      const v = etat.saisie[`${i}/${k}`] ?? '';
      const j = vu ? jugerCase(v, b) : null;
      return `<label class="ex-case ${j ? (j.ok ? 'ok' : 'ko') : ''}"><span class="ex-case-l">${enLigne(b.lbl || '')}</span>
        <input type="text" inputmode="decimal" autocomplete="off" data-case="${i}/${k}" value="${esc(v)}" aria-label="${esc(String(b.lbl || 'valeur').replace(/[$\\{}_]/g, ''))}">
        ${b.unite ? `<span class="ex-case-u">${esc(b.unite)}</span>` : ''}
        ${j ? `<span class="ex-case-r">${j.ok ? icone('check') : `${icone('croix')} ${esc(j.msg)}`}</span>` : ''}</label>`;
    }).join('');
    const tout = vu && it.val.every((b, k) => jugerCase(etat.saisie[`${i}/${k}`], b).ok);
    return `<div class="ex-cases ${tout ? 'juste' : ''}">${champs}${tout ? `<span class="ex-case-bravo">${icone('check')} Juste !</span>` : ''}<button class="btn ex-case-b" data-action="verif" data-i="${i}">${icone('check')} Vérifier</button></div>`;
  }

  /* ---------- Modèle unique : 1 Énoncé · 2 Schéma · 3 Questions · 4 Correction (mêmes étapes partout) ---------- */
  const etape = (n, titre, corps, cls = '') => `<section class="ex-etape ${cls}"><h4 class="ex-et-t"><span class="ex-et-n">${n}</span>${titre}</h4>${corps}</section>`;
  /** Note proposée d'après les cases : toutes justes = Juste, au moins la moitié = Presque, sinon Faux. */
  function noteAuto(e) {
    const bs = e.items.flatMap((it, i) => (it.val || []).map((b, k) => [i, k, b]));
    if (!bs.length || bs.some(([i]) => !etat.verif.has(i))) return null;
    const ok = bs.filter(([i, k, b]) => jugerCase(etat.saisie[`${i}/${k}`], b).ok).length;
    return { r: ok === bs.length ? 'ok' : ok >= bs.length / 2 ? 'mid' : 'ko', ok, n: bs.length };
  }
  function boutonsNote(auto) {
    const b = (r, cls, ic, lib) => `<button class="btn ${cls} ${auto?.r === r ? 'conseil' : ''}" data-action="noter" data-r="${r}">${ic} ${lib}</button>`;
    return `<div class="fc-actions ex-noter">
      <span class="ex-q">${auto ? `D'après tes cases (${auto.ok} / ${auto.n} justes) : <b>${NOTES[auto.r].lib}</b>. Valide ou change :` : 'Comment ça s\'est passé ?'}</span>
      ${b('ok', 'ok', icone('check'), 'Juste')}${b('mid', 'ex-mid', '≈', 'Presque')}${b('ko', 'bad', icone('croix'), 'Faux')}</div>`;
  }
  function navEx() {
    return `<div class="fc-actions ex-nav">
          <button class="btn icon" data-action="prec" title="Exercice précédent" ${etat.pos === 0 ? 'disabled' : ''}>${icone('fleche-g')}</button>
          ${estAuteur() || !boiteActive() ? '' : `<button class="btn ex-prop" data-action="proposer" title="Signaler une erreur dans cet exercice (capture d'écran jointe)">${icone('alerte')}<span>Signaler une erreur</span></button>`}
          <button class="btn" data-action="suiv" ${etat.pos >= etat.liste.length - 1 ? 'disabled' : ''}>Passer ${icone('fleche-d')}</button>
        </div>`;
  }

  function carte(e, t) {
    if (e.type === 'dessin') return carteDessin(e, t);
    const note = t[cle(e)];
    const avecDev = e.items.map((it) => (it.etapes || []).length > 0);
    const avecCases = e.items.some((it) => it.val?.length);
    const items = e.items.map((it, i) => `<li>${e.items.length > 1 ? `<span class="ex-l">${LETTRES[i]})</span>` : ''}<div>${texte(it.q)}${cases(it, i)}</div></li>`).join('');
    let n = 0;
    // 1. Énoncé
    const enonce = etape(++n, 'Énoncé', e.consigne ? `<div class="ex-consigne">${texte(e.consigne)}</div>` : '<p class="muted">Réponds aux questions ci-dessous.</p>');
    // 2. Schéma (à annoter ou image)
    const aSchema = e.schema || imageOk(e.image);
    const schema = aSchema ? etape(++n, e.schema ? 'Schéma à annoter' : 'Schéma', `
        ${e.schema ? '<div class="ex-circuit" data-circuit></div>' : ''}
        ${imageOk(e.image) ? (e.schema
          ? `<details class="ex-orig"><summary>Voir le schéma du cours</summary><figure class="fig ex-img"><img src="${e.image}" alt="Schéma de l'exercice"></figure></details>`
          : `<figure class="fig ex-img"><img src="${e.image}" alt="Schéma de l'exercice"></figure>`) : ''}
        ${e.simu ? `<button class="btn ex-simu" data-action="simu" title="Ouvrir ce circuit dans le simulateur : changer les valeurs et voir ce qui se passe">${icone('eclair')} Voir dans le simulateur</button>` : ''}`) : '';
    // 3. Questions
    const questions = etape(++n, 'Questions', `
        <ol class="ex-items ${e.items.length > 1 ? '' : 'seul'}">${items}</ol>
        ${!etat.rep ? `<p class="ex-papier">${icone('crayon')} ${avecCases ? 'Résous sur ta feuille, tape tes résultats dans les cases et clique sur « Vérifier ».' : 'Résous sur ta feuille, puis ouvre la correction.'}</p>` : ''}
        ${e.indice ? (etat.indice ? `<div class="ex-indice">${icone('ampoule')}<div>${texte(e.indice)}</div></div>`
          : (!etat.rep ? `<button class="btn" data-action="indice">${icone('ampoule')} Un indice</button>` : '')) : ''}`);
    // 4. Correction
    let corps;
    if (etat.rep) {   // d'abord la réponse ; le développement du calcul s'ouvre à la demande
      const html = e.items.map((it, i) => {
        const lettre = e.items.length > 1 ? `<span class="ex-l">${LETTRES[i]})</span>` : '';
        const ouvert = etat.dev.has(i);
        return `<div class="ex-sol">${lettre}<div>
          <div class="ex-step rep"><span class="ex-rep">${icone('check')} Réponse</span>${texte(it.r)}</div>
          ${avecDev[i] ? (ouvert
            ? `<div class="ex-dev"><div class="ex-dev-t">Développement du calcul <button class="btn ex-dev-b" data-action="dev" data-i="${i}" title="Masquer le développement">Masquer</button></div>
                ${imageOk(it.fig) ? `<figure class="fig ex-img ex-fig-dev"><img src="${it.fig}" alt="Schéma de la correction"><figcaption>${it.figLeg ? esc(it.figLeg) : LEGENDE_TRIGO}</figcaption></figure>` : ''}
                ${it.etapes.map((x, k) => `<div class="ex-step"><span class="ex-num">${k + 1}</span><div>${texte(x)}</div></div>`).join('')}</div>`
            : `<button class="btn ex-dev-b" data-action="dev" data-i="${i}">${icone('fleche-d')} Voir le développement</button>`) : ''}
        </div></div>`;
      }).join('');
      const nDev = avecDev.filter(Boolean).length;
      const schemaCorr = imageOk(e.imageCorr)
        ? `<figure class="fig ex-img ex-img-corr"><img src="${e.imageCorr}" alt="Schéma corrigé"><figcaption>Schéma corrigé : valeurs calculées en <b class="vert">vert</b> (courants, potentiels) et en <b class="bleu">bleu</b> (tensions, pointe = côté +).</figcaption></figure>` : '';
      corps = `${nDev > 1 ? `<button class="btn ex-dev-tout" data-action="devtout">${etat.dev.size >= nDev ? 'Tout masquer' : 'Tout développer'}</button>` : ''}
        ${schemaCorr}${html}${boutonsNote(noteAuto(e))}`;
    } else corps = `<button class="btn primary" data-action="reponse">${icone('check')} Voir la correction</button>`;
    const correction = etape(++n, 'Correction', corps, 'ex-corr');

    return `
      <div class="panel ex-card">
        ${entete(e, note)}
        ${enonce}${schema}${questions}${correction}
        ${navEx()}
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
          ${badgeSource(e, e._docs || options.docs)}
        </div>`;
  }
  function carteDessin(e, t) {
    const note = t[cle(e)];
    const corrige = etat.vus > 0;
    const niv = niveauAide(); const A = AIDES[niv];
    const d = etatDessin(e);
    const restIndices = A.indices === Infinity ? '' : ` (${Math.max(0, A.indices - d.indices.length)})`;
    const restBilans = A.bilans === Infinity ? '' : ` (${Math.max(0, A.bilans - d.bilans)})`;
    const aidesNiv = `<div class="ex-aides-niv" role="radiogroup" aria-label="Niveau d'aide">
          <span>Aides :</span>
          ${Object.entries(AIDES).map(([k, v]) => `<label class="chip"><input type="radio" name="aide" value="${k}" ${k === niv ? 'checked' : ''} ${corrige ? 'disabled' : ''}><span>${v.nom}</span></label>`).join('')}
          <span class="muted ex-aides-txt">${{
            facile: 'lignes de rappel, ligne à 45°, pièce 3D avec boutons de vue, traits d’aide illimités.',
            moyen: 'lignes de rappel, ligne à 45°, pièce 3D sans boutons de vue, 3 traits d’aide et 3 vérifications.',
            difficile: 'comme à l’examen : perspective fixe, pas de ligne à 45° ni de rappels, aucune aide.',
          }[niv]}</span>
        </div>`;
    const enonce = etape(1, 'Énoncé', `<div class="ex-dz">
          <div class="ex-consigne">${texte(e.consigne || '')}</div>
          <div class="ex-3d" data-p3d>${!e.piece && e.perspective ? `<figure class="fig ex-persp-fixe">${svgSur(e.perspective)}<figcaption>Perspective · F = sens de la vue de face</figcaption></figure>` : ''}</div>
        </div>
        ${e.indice && niv !== 'difficile' ? (etat.indice ? `<div class="ex-indice">${icone('ampoule')}<div>${texte(e.indice)}</div></div>`
          : (!corrige ? `<button class="btn" data-action="indice">${icone('ampoule')} Un conseil</button>` : '')) : ''}`);
    const planche = etape(2, 'Dessin sur la planche', `${aidesNiv}
        <div class="ex-planche" data-planche></div>
        ${!corrige && (A.indices || A.bilans) ? `<div class="ex-aides">
          ${A.indices ? `<button class="btn" data-action="traitaide" ${d.indices.length >= A.indices ? 'disabled' : ''} title="Montre un trait manquant (−${A.penalite} % par trait d'aide)">${icone('ampoule')} Un trait d'aide${restIndices}</button>` : ''}
          ${A.bilans ? `<button class="btn" data-action="bilan" ${d.bilans >= A.bilans ? 'disabled' : ''} title="Combien de traits sont justes, sans dire lesquels">${icone('progression')} Où j'en suis ?${restBilans}</button>` : ''}
          <div class="ex-aide-msg" data-aidemsg></div>
        </div>` : ''}`);
    const correction = etape(3, 'Correction', !corrige
      ? `<button class="btn primary" data-action="verifier">${icone('check')} Vérifier mon dessin</button>`
      : `<div class="ex-res" data-res></div><div class="ex-expl" data-expl><p class="muted">👉 Touche un trait de la correction (sur la planche) pour savoir d'où il vient : il s'allume aussi sur la pièce 3D.</p></div>
        ${boutonsNote(null)}<div class="fc-actions"><button class="btn" data-action="retoucher">${icone('crayon')} Corriger mon dessin</button></div>`, 'ex-corr');
    return `
      <div class="panel ex-card ex-dessin">
        ${entete(e, note)}
        ${enonce}${planche}${correction}
        ${navEx()}
      </div>`;
  }
  /* aides utilisées pour l'exercice affiché (remises à zéro en changeant d'exercice) */
  function etatDessin(e) {
    if (!etat.dessin || etat.dessin.id !== e.id) etat.dessin = { id: e.id, indices: [], bilans: 0, p3d: null, planche: null };
    return etat.dessin;
  }
  function monter() {
    const zc = conteneur.querySelector('[data-circuit]');
    if (zc) { const ec = etat.liste[etat.pos]; monterCircuit(zc, ec, { cle: cle(ec), solutionVisible: etat.rep }); }
    const zone = conteneur.querySelector('[data-planche]');
    if (!zone) return;
    const e = etat.liste[etat.pos];
    const d = etatDessin(e);
    const niv = niveauAide(); const A = AIDES[niv];
    const z3 = conteneur.querySelector('[data-p3d]');
    d.p3d = null;
    if (z3 && e.piece && A.rotation) d.p3d = monterPiece3D(z3, e.piece, { boutons: A.boutonsVues, rotation: true });
    else if (z3 && e.piece) monterPiece3D(z3, e.piece, { rotation: false });
    const expliquer = (i) => {
      const x = e.expl?.[i]; const zx = conteneur.querySelector('[data-expl]');
      if (!x || !zx) return;
      const r = d.planche?.resultat?.res?.[i];
      const etatTxt = r ? { ok: '<span class="pl-leg ok">Tu l\'as trouvé ✓</span>', manque: '<span class="pl-leg manque">Il manque sur ton dessin</span>', type: '<span class="pl-leg type">Bon tracé, mais mauvais type de trait</span>' }[r.etat] : '';
      zx.innerHTML = `<div class="ex-expl-box"><div>${etatTxt}</div>${texte(x.t)}</div>`;
      d.p3d?.surligner(x.e3);
    };
    d.planche = monterPlanche(zone, e, { cle: cle(e), correction: etat.vus > 0, aide: niv, indices: d.indices, onExpliquer: expliquer });
    const r = d.planche.resultat; const res = conteneur.querySelector('[data-res]');
    if (r && res) {
      const pen = A.penalite * d.indices.length;
      const pct = Math.max(0, r.pct - pen);
      d.pct = pct;
      const verdict = pct >= 95 && !r.enTrop.length ? 'ok' : pct >= 70 ? 'mid' : 'ko';
      res.innerHTML = `<div class="ex-bilan ${verdict}"><b>${pct} %</b>
        <span>${r.ok} / ${r.n} traits justes</span>
        ${r.manque ? `<span class="pl-leg manque">${r.manque} manquant${r.manque > 1 ? 's' : ''}</span>` : ''}
        ${r.type ? `<span class="pl-leg type">${r.type} mauvais type de trait</span>` : ''}
        ${r.enTrop.length ? `<span class="pl-leg trop">${r.enTrop.length} en trop</span>` : ''}
        ${pen ? `<span class="muted">(${d.indices.length} trait${d.indices.length > 1 ? 's' : ''} d'aide : −${pen} %)</span>` : ''}
        <span class="muted">· aides : ${A.nom}</span></div>
        <p class="muted pl-legende"><span class="pl-leg ok">vert</span> trouvé · <span class="pl-leg manque">rouge</span> manquant · <span class="pl-leg type">orange</span> bon tracé mais mauvais type de trait · <span class="pl-leg trop">violet</span> en trop.
        <label><input type="checkbox" checked data-action="voircorr"> Afficher la correction</label></p>`;
      res.querySelector('[data-action=voircorr]').addEventListener('change', (ev) => d.planche.basculer(ev.target.checked));
      const premier = r.res.findIndex((x) => x.etat !== 'ok');
      if (premier >= 0) { d.planche.focus(premier); expliquer(premier); }
    }
    conteneur.querySelectorAll('input[name=aide]').forEach((i) => i.addEventListener('change', () => { choisirAide(i.value); afficher(); }));
  }
  function aideMsg(html) { const z = conteneur.querySelector('[data-aidemsg]'); if (z) z.innerHTML = html; }

  function aller(p) {
    if (p < 0 || p >= etat.liste.length) return;
    etat.pos = p; reset(); afficher();
    conteneur.querySelector('.ex-card')?.scrollIntoView({ block: 'nearest' });
  }

  const actions = {
    verifier: () => { etat.vus = 1; afficher(); conteneur.querySelector('[data-res]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); },
    proposer: () => ouvrirProposition('erreur'),
    retoucher: () => { etat.vus = 0; afficher(); },
    traitaide: () => {
      const e = etat.liste[etat.pos]; const d = etatDessin(e); const A = AIDES[niveauAide()];
      if (d.indices.length >= A.indices) return;
      const i = prochainManquant(e, d.planche?.elements() || [], d.indices);
      if (i < 0) { aideMsg('<p class="pl-leg ok">Tous les traits sont déjà là : vérifie ton dessin !</p>'); return; }
      d.indices.push(i); afficher();
      aideMsg(`<div class="ex-expl-box"><b>Trait d'aide</b> (en pointillé bleu sur la planche) : ${texte(e.expl?.[i]?.t || '')}</div>`);
      d.p3d?.surligner(e.expl?.[i]?.e3);
    },
    bilan: () => {
      const e = etat.liste[etat.pos]; const d = etatDessin(e); const A = AIDES[niveauAide()];
      if (d.bilans >= A.bilans) return;
      const r = corriger(e.solution, d.planche?.elements() || [], e.donnees);
      d.bilans++; afficher();
      aideMsg(`<div class="ex-expl-box"><b>Où j'en suis :</b> ${r.ok} / ${r.n} traits justes${r.type ? ` · ${r.type} avec un mauvais type de trait` : ''}${r.enTrop.length ? ` · ${r.enTrop.length} en trop` : ''} · ${r.manque} encore à trouver.</div>`);
    },
    reponse: () => { etat.rep = true; afficher(); conteneur.querySelector('.ex-corr')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); },
    dev: (b) => { const i = +b.dataset.i; if (etat.dev.has(i)) etat.dev.delete(i); else etat.dev.add(i); afficher(); },
    devtout: () => {
      const e = etat.liste[etat.pos]; const idx = e.items.map((it, i) => ((it.etapes || []).length ? i : -1)).filter((i) => i >= 0);
      etat.dev = etat.dev.size >= idx.length ? new Set() : new Set(idx); afficher();
    },
    indice: () => { etat.indice = true; afficher(); },
    verif: (b) => {
      const i = +b.dataset.i; etat.verif.add(i); afficher();
      conteneur.querySelector(`[data-case="${i}/0"]`)?.closest('.ex-cases')?.scrollIntoView({ block: 'nearest' });
    },
    simu: () => {                            // le circuit de l'exercice s'ouvre (neuf) dans le simulateur
      const e = etat.liste[etat.pos];
      const c = structuredClone(e.simu); c.id = `ex-${cle(e).replace(/[^\w-]+/g, '-')}`; c.nom = c.nom || `Ex : ${e.titre}`; c.maj = Date.now();
      const L = stockage.lire('simu', null) || {}; L[c.id] = c; stockage.ecrire('simu', L); stockage.ecrire('simu.courant', c.id);
      const h = location.hash; const k = h.indexOf('/exercices');
      stockage.ecrire('simu.retour', { id: c.id, t: e.titre, h: k >= 0 ? `${h.slice(0, k + 10)}/${encodeURIComponent(e.id)}` : h });
      location.hash = '#/simu';
    },
    noter: (b) => {
      const ec = etat.liste[etat.pos];
      noter(cle(ec), b.dataset.r, { t: ec.titre, ...(ec.type === 'dessin' ? { aide: niveauAide(), pct: etat.dessin?.pct } : {}) });
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
    if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT' || b.disabled) return;
    actions[b.dataset.action]?.(b);
  });
  conteneur.addEventListener('input', (e) => {
    const k = e.target.dataset?.case; if (k !== undefined) { etat.saisie[k] = e.target.value; e.target.closest('.ex-case')?.classList.remove('ok', 'ko'); }
  });
  conteneur.addEventListener('keydown', (e) => {
    const k = e.target.dataset?.case; if (k === undefined || e.key !== 'Enter') return;
    e.preventDefault(); actions.verif({ dataset: { i: k.split('/')[0] } });
  });
  conteneur.addEventListener('change', (e) => {
    if (e.target.dataset.action === 'filtre') { etat.filtre = e.target.value; nouvelleListe(filtrer()); }
  });

  nouvelleListe(filtrer(), options.debut ? Math.max(0, tous.findIndex((x) => (x._cle || x.id) === options.debut)) : 0);
  return null;
}
