/* =====================================================================
   COURS INTERACTIF — onglet « Cours » d'un chapitre (si le fichier a « cours »)
   ---------------------------------------------------------------------
   cours: { intro?, lecons: [ { id, titre, but?, blocs: [ bloc, … ] } ] }
   Blocs : ceux de la synthèse (texte, definition, point-cle, piege, exemple,
   formule, liste, tableau, figure) + trois blocs interactifs :
     qcm    → { id, q, choix: [..], bonne: n, explication? }
     nombre → { id, q, reponse, unite?, tol? (relative, défaut 0,02), indice?, explication? }
     schema → { id, q, schema, solution, donnees? }  schéma à annoter (flèches de courant et vecteurs
              tension + valeurs), même format que les exercices sur schéma (voir circuit.js) ;
              réussi quand « Vérifier » donne 100 %
     labo   → { id, titre?, consigne?, circuit (format du simulateur),
                reglages: [ { c, champ: 'val'|'vz'|'vs'|'ferme', label, min?, max?, pas?, unite? } ],
                mesures:  [ { c, g: 'u'|'-u'|'i'|'-i'|'p'|'etat', label, unite? } ]   (u = V(a) − V(b) ; -u = l'inverse),
                defi?: { q, c, g, op: '>'|'<'|'='|'etat', val, tol?, abs? (défaut : valeur absolue) } }
       Le circuit est recalculé en direct par le moteur du simulateur.
   Progression : stockage « cours » = { "<matière>/<chapitre>/<leçon>/<id>": 1 }
   (synchronisée, voir synchro.js). Une leçon est terminée quand toutes ses
   questions (et ses défis) sont réussies.
   ===================================================================== */

import { esc, stockage, $$ } from './utils.js';
import { icone } from './icones.js';
import { enLigne } from './rendu.js';
import { rendreBloc } from './synthese.js';
import { resoudre } from './simu/moteur.js';
import { svgCircuit, fmt, ETAT } from './vues/simulateur.js';
import { monterCircuit } from './circuit.js';

const INTERACTIFS = new Set(['qcm', 'nombre', 'labo', 'schema']);
const lireProg = () => stockage.lire('cours', {}) || {};
const reussi = (cle) => !!lireProg()[cle];
function noter(cle) { const p = lireProg(); if (p[cle]) return; p[cle] = 1; stockage.ecrire('cours', p); }

const nombre = (s) => { const v = parseFloat(String(s ?? '').trim().replace(/\s/g, '').replace(',', '.')); return Number.isFinite(v) ? v : null; };
const joliNb = (v) => String(+(+v).toPrecision(4)).replace('.', ',');
const questions = (l) => (l.blocs || []).filter((b) => (b.type === 'qcm' || b.type === 'nombre' || b.type === 'schema' || (b.type === 'labo' && b.defi)) && b.id);

/** Lecteur du cours. Renvoie une fonction de nettoyage. */
export function lecteurCours(zone, cours, { docs = [], prefixe = '' } = {}) {
  const lecons = Array.isArray(cours?.lecons) ? cours.lecons : [];
  if (!lecons.length) { zone.innerHTML = '<div class="panel empty"><h3>Pas encore de cours</h3></div>'; return () => {}; }
  const cleL = (l) => `${prefixe}/${l.id}`;
  const etat = (l) => { const qs = questions(l); const n = qs.filter((b) => reussi(`${cleL(l)}/${b.id}`)).length; return { n, total: qs.length, fini: n === qs.length && qs.length > 0 }; };
  let k = Math.max(0, lecons.findIndex((l) => !etat(l).fini));
  if (k < 0) k = 0;
  const derniere = stockage.lire(`cours.ou.${prefixe}`, null);
  if (derniere != null && lecons[derniere]) k = derniere;

  function sommaire() {
    return lecons.map((l, i) => {
      const e = etat(l);
      return `<li><button type="button" class="crs-som${i === k ? ' active' : ''}${e.fini ? ' fini' : ''}" data-l="${i}">
        <span class="crs-num">${e.fini ? icone('check') : i + 1}</span><span class="crs-st">${esc(l.titre)}</span>
        ${e.total ? `<span class="crs-pr">${e.n}/${e.total}</span>` : ''}</button></li>`;
    }).join('');
  }

  function bloc(b, l) {
    if (!INTERACTIFS.has(b.type)) return rendreBloc(b, docs);
    const cle = `${cleL(l)}/${b.id}`; const ok = reussi(cle);
    if (b.type === 'qcm') {
      return `<div class="crs-q${ok ? ' ok' : ''}" data-q="${esc(b.id)}" data-type="qcm">
        <div class="crs-qt">${icone('exercices')} ${enLigne(b.q)}</div>
        <div class="crs-choix">${(b.choix || []).map((c, i) => `<button type="button" class="btn crs-c${ok && i === b.bonne ? ' bon' : ''}" data-i="${i}">${enLigne(c)}</button>`).join('')}</div>
        <div class="crs-fb" ${ok ? '' : 'hidden'}>${ok ? retour(true, b) : ''}</div></div>`;
    }
    if (b.type === 'nombre') {
      return `<div class="crs-q${ok ? ' ok' : ''}" data-q="${esc(b.id)}" data-type="nombre">
        <div class="crs-qt">${icone('calculatrice')} ${enLigne(b.q)}</div>
        <form class="crs-n"><input type="text" inputmode="decimal" autocomplete="off" placeholder="ta réponse" aria-label="Réponse"${ok ? ` value="${esc(joliNb(b.reponse))}"` : ''}>
          ${b.unite ? `<span class="crs-u">${esc(b.unite)}</span>` : ''}<button class="btn primary" type="submit">Vérifier</button>
          ${b.indice ? '<button class="btn crs-ind" type="button">Indice</button>' : ''}</form>
        <div class="crs-fb" ${ok ? '' : 'hidden'}>${ok ? retour(true, b) : ''}</div></div>`;
    }
    if (b.type === 'schema') {
      return `<div class="crs-q${ok ? ' ok' : ''}" data-q="${esc(b.id)}" data-type="schema">
        <div class="crs-qt">${icone('eclair')} ${enLigne(b.q)}</div>
        <div class="crs-ci"></div>
        <div class="crs-fb" ${ok ? '' : 'hidden'}>${ok ? retour(true, b) : ''}</div></div>`;
    }
    // labo
    return `<div class="crs-labo${ok ? ' ok' : ''}" data-q="${esc(b.id)}" data-type="labo">
      <div class="crs-qt">${icone('eclair')} <b>${esc(b.titre || 'Manipule le circuit')}</b></div>
      ${b.consigne ? `<p class="crs-cons">${enLigne(b.consigne)}</p>` : ''}
      <div class="crs-lab">
        <div class="crs-sch"></div>
        <div class="crs-reg">
          ${(b.reglages || []).map((r, i) => r.champ === 'ferme'
            ? `<label class="crs-r crs-k"><input type="checkbox" data-r="${i}"> ${enLigne(r.label)}</label>`
            : `<label class="crs-r"><span>${enLigne(r.label)} : <b data-v="${i}"></b></span><input type="range" data-r="${i}" min="${r.min ?? 0}" max="${r.max ?? 10}" step="${r.pas ?? 0.1}"></label>`).join('')}
          <table class="crs-mes"><tbody>${(b.mesures || []).map((m, i) => `<tr><td>${enLigne(m.label)}</td><td data-m="${i}"></td></tr>`).join('')}</tbody></table>
        </div>
      </div>
      ${b.defi ? `<div class="crs-defi">${icone('ampoule')} <b>Défi :</b> ${enLigne(b.defi.q)} <span class="crs-dok">${ok ? `${icone('check')} réussi` : ''}</span></div>` : ''}
    </div>`;
  }

  function retour(bon, b, extra = '') {
    return `<div class="crs-ret ${bon ? 'ok' : 'ko'}">${icone(bon ? 'check' : 'croix')} <b>${bon ? 'Juste !' : 'Pas encore.'}</b> ${extra}</div>${bon && b.explication ? `<div class="crs-exp">${enLigne(b.explication)}</div>` : ''}`;
  }

  function afficher() {
    const l = lecons[k];
    stockage.ecrire(`cours.ou.${prefixe}`, k);
    zone.innerHTML = `
      <div class="crs">
        <nav class="panel crs-nav" aria-label="Leçons"><h3>Leçons</h3><ol>${sommaire()}</ol></nav>
        <div class="crs-corps">
          ${k === 0 && cours.intro ? `<div class="panel crs-intro">${enLigne(cours.intro)}</div>` : ''}
          <section class="panel crs-lecon">
            <h2><span class="num">${k + 1}</span>${esc(l.titre)}</h2>
            ${l.but ? `<p class="crs-but">${icone('info')} <b>Objectif :</b> ${enLigne(l.but)}</p>` : ''}
            ${(l.blocs || []).map((b) => bloc(b, l)).join('')}
            <div class="crs-fin"></div>
          </section>
          <div class="crs-pied">
            ${k > 0 ? `<button class="btn" data-aller="${k - 1}" type="button">${icone('fleche-g')} Leçon précédente</button>` : '<span></span>'}
            ${k < lecons.length - 1 ? `<button class="btn primary" data-aller="${k + 1}" type="button">Leçon suivante ${icone('fleche-d')}</button>` : ''}
          </div>
        </div>
      </div>`;
    activer(l);
    majFin(l);
  }

  function majFin(l) {
    const e = etat(l); const f = zone.querySelector('.crs-fin');
    if (f) f.innerHTML = e.total ? (e.fini
      ? `<div class="notice ok">${icone('check')}<div><b>Leçon maîtrisée !</b> Toutes les questions sont réussies.</div></div>`
      : `<p class="muted">${e.n}/${e.total} question${e.total > 1 ? 's' : ''} réussie${e.n > 1 ? 's' : ''}.</p>`) : '';
    const nav = zone.querySelector('.crs-nav ol'); if (nav) nav.innerHTML = sommaire();
  }

  function activer(l) {
    for (const el of $$('.crs-q, .crs-labo', zone)) {
      const b = (l.blocs || []).find((x) => x.id === el.dataset.q); if (!b) continue;
      const cle = `${cleL(l)}/${b.id}`; const fb = el.querySelector('.crs-fb');
      if (b.type === 'qcm') {
        el.querySelectorAll('.crs-c').forEach((bt) => bt.addEventListener('click', () => {
          const i = +bt.dataset.i; const bon = i === b.bonne;
          el.querySelectorAll('.crs-c').forEach((x) => x.classList.remove('bon', 'faux'));
          bt.classList.add(bon ? 'bon' : 'faux');
          fb.hidden = false; fb.innerHTML = retour(bon, b, bon ? '' : 'Relis la question et réessaie.');
          if (bon) { el.classList.add('ok'); noter(cle); majFin(l); }
        }));
      } else if (b.type === 'nombre') {
        const form = el.querySelector('form'); const inp = form.querySelector('input');
        form.addEventListener('submit', (ev) => {
          ev.preventDefault();
          const v = nombre(inp.value);
          if (v == null) { fb.hidden = false; fb.innerHTML = `<div class="crs-ret ko">${icone('alerte')} Écris un nombre (ex. 7 ou 0,5).</div>`; return; }
          const tol = b.tol ?? 0.02; const r = +b.reponse;
          const bon = r === 0 ? Math.abs(v) < 1e-9 : Math.abs(v - r) <= Math.abs(r) * tol;
          let aide = '';
          if (!bon && r !== 0) {
            const q = v / r;
            if ([1e3, 1e-3, 1e6, 1e-6].some((f) => Math.abs(q / f - 1) < tol)) aide = `Le chiffre est bon mais pas l'unité : la réponse est en <b>${esc(b.unite || '')}</b>.`;
            else if (Math.abs(v + r) <= Math.abs(r) * tol) aide = 'Le signe est faux.';
            else aide = b.indice ? 'Regarde l\'indice.' : 'Refais le calcul.';
          }
          fb.hidden = false; fb.innerHTML = retour(bon, b, bon ? '' : aide);
          if (bon) { el.classList.add('ok'); noter(cle); majFin(l); }
        });
        el.querySelector('.crs-ind')?.addEventListener('click', () => { fb.hidden = false; fb.innerHTML = `<div class="crs-ret ind">${icone('ampoule')} ${enLigne(b.indice)}</div>`; });
      } else if (b.type === 'schema') {
        monterCircuit(el.querySelector('.crs-ci'), b, { cle: `cours/${cle}`, onVerifier: (pct) => {
          if (pct !== 100) return;
          fb.hidden = false; fb.innerHTML = retour(true, b);
          if (!reussi(cle)) { el.classList.add('ok'); noter(cle); majFin(l); }
        } });
      } else if (b.type === 'labo') {
        labo(el, b, () => { if (!reussi(cle)) { noter(cle); el.classList.add('ok'); const d = el.querySelector('.crs-dok'); if (d) d.innerHTML = `${icone('check')} réussi`; majFin(l); } });
      }
    }
  }

  /** Laboratoire : réglages → recalcul → schéma + mesures. */
  function labo(el, b, reussite) {
    const C = structuredClone(b.circuit);
    const comp = (id) => C.comps.find((c) => c.id === id);
    const sch = el.querySelector('.crs-sch');
    const unite = (r) => r.unite || (r.champ === 'val' ? ({ R: 'Ω', V: 'V', W: 'V', I: 'A' }[comp(r.c)?.t] || '') : 'V');
    (b.reglages || []).forEach((r, i) => {
      const inp = el.querySelector(`input[data-r="${i}"]`); const c = comp(r.c); if (!inp || !c) return;
      if (r.champ === 'ferme') inp.checked = !!c.ferme; else inp.value = c[r.champ] ?? 0;
      inp.addEventListener('input', () => { if (r.champ === 'ferme') c.ferme = inp.checked; else c[r.champ] = +inp.value; maj(); });
    });
    function valeur(m, res) {
      const r = res.comps.get(m.c); if (!r) return null;
      if (m.g === 'etat') return r.etat || '';
      return m.g === 'u' ? r.u : m.g === '-u' ? -r.u : m.g === 'i' ? r.i : m.g === '-i' ? -r.i : r.p;
    }
    function maj() {
      let res;
      try { res = resoudre(C); } catch { res = { ok: false, comps: new Map(), fils: [], V: new Map() }; }
      sch.innerHTML = svgCircuit(C, res, { val: true, ui: true, anim: true, coul: false }, 3);
      (b.reglages || []).forEach((r, i) => { const s = el.querySelector(`[data-v="${i}"]`); const c = comp(r.c); if (s && c) s.textContent = fmt(+c[r.champ], unite(r)); });
      (b.mesures || []).forEach((m, i) => {
        const td = el.querySelector(`[data-m="${i}"]`); if (!td) return;
        const v = res.ok ? valeur(m, res) : null;
        if (v == null) { td.textContent = '—'; return; }
        if (m.g === 'etat') { td.innerHTML = `<span class="crs-etat ${esc(v)}">${esc(ETAT[v] || v)}</span>`; return; }
        const u = m.unite || (m.g.endsWith('u') ? 'V' : m.g.endsWith('i') ? 'A' : 'W');
        const facteur = { mA: 1e3, mW: 1e3, kΩ: 1e-3, µA: 1e6 }[u] || 1;
        const x = Math.abs(v) < 1e-9 ? 0 : v * facteur;
        td.textContent = `${String(+x.toPrecision(3)).replace('.', ',')} ${u}`;
      });
      const d = b.defi;
      if (d && res.ok) {
        const v = valeur(d, res);
        let ok = false;
        if (d.op === 'etat') ok = v === d.val;
        else if (typeof v === 'number') {
          const x = d.abs === false ? v : Math.abs(v);
          ok = d.op === '>' ? x > d.val : d.op === '<' ? x < d.val : Math.abs(x - d.val) <= Math.abs(d.val) * (d.tol ?? 0.03);
        }
        if (ok) reussite();
      }
    }
    maj();
  }

  zone.addEventListener('click', (e) => {
    const s = e.target.closest('[data-l]'); const a = e.target.closest('[data-aller]');
    const i = s ? +s.dataset.l : a ? +a.dataset.aller : null;
    if (i == null || !lecons[i]) return;
    k = i; afficher(); zone.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  afficher();
  return () => {};
}
