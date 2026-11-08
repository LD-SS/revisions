/* =====================================================================
   VUE EXAMEN BLANC — exercices tirés au hasard, chronométrés
   ---------------------------------------------------------------------
   #/examen : choix (matière, chapitre, nombre, durée) → série au hasard
   dans le lecteur d'exercices habituel, avec un chrono et un bilan à la fin.
   Les notes Juste / Presque / Faux comptent comme dans les chapitres.
   ===================================================================== */

import { esc, stockage, melanger, pluriel } from '../utils.js';
import { icone } from '../icones.js';
import { styleMatiere } from '../matieres.js';
import { matieres, matiere, chargerChapitre, chargerSchemas, chargerEvaluations } from '../store.js';
import { sourcesDe } from '../synthese.js';
import { lecteurExercices } from '../exercices.js';
import { texte } from '../rendu.js';

/* ---------- impression d'une évaluation (énoncé seul, ou corrigé) ---------- */
const LETTRES = 'abcdefghijklmnopqrstuvwxyz';
const imgOk = (x) => typeof x === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(x);
function imprimerEvaluation(ev, corrige) {
  const nq = ev.exercices.reduce((a, x) => a + x.items.length, 0);
  const feuille = document.createElement('div');
  feuille.id = 'impr-eval';
  feuille.innerHTML = `<header class="ie-tete"><h1>${esc(ev.titre)}${corrige ? ' — corrigé' : ''}</h1>
    <p>${corrige ? '' : 'Nom : ........................................   Date : ................   '}Durée : ${ev.duree || 100} min · ${ev.exercices.length} exercices · ${nq} questions</p></header>
    ${ev.exercices.map((x, i) => `<section class="ie-ex"><h2>${i + 1}. ${esc(x.titre)}</h2>
      ${x.consigne ? `<div class="ie-consigne">${texte(x.consigne)}</div>` : ''}
      ${imgOk(corrige && x.imageCorr ? x.imageCorr : x.image) ? `<figure class="ie-fig"><img src="${corrige && x.imageCorr ? x.imageCorr : x.image}" alt=""></figure>` : ''}
      <ol class="ie-q">${x.items.map((it, k) => `<li><span class="ie-l">${x.items.length > 1 ? LETTRES[k] + ')' : ''}</span><div>${texte(it.q)}
        ${corrige ? `<div class="ie-rep"><b>Réponse :</b> ${texte(it.r)}</div>${(it.etapes || []).length ? `<ol class="ie-et">${it.etapes.map((e) => `<li>${texte(e)}</li>`).join('')}</ol>` : ''}`
          : '<div class="ie-zone"></div>'}</div></li>`).join('')}</ol></section>`).join('')}`;
  document.getElementById('impr-eval')?.remove();
  document.body.appendChild(feuille); document.body.classList.add('impr-eval-on');
  const fin = () => { feuille.remove(); document.body.classList.remove('impr-eval-on'); window.removeEventListener('afterprint', fin); };
  window.addEventListener('afterprint', fin);
  // attend les polices des formules (KaTeX) et les images avant d'imprimer
  void feuille.offsetHeight;
  new Promise((r) => requestAnimationFrame(r)).then(() => Promise.all([document.fonts?.ready, ...[...feuille.querySelectorAll('img')].map((i) => i.decode?.().catch(() => {}))]))
    .catch(() => {}).then(() => setTimeout(() => { window.print(); setTimeout(fin, 1500); }, 150));
}

async function reserve(mid, cid) {
  const m = matiere(mid); const r = [];
  for (const c of m.chapitres) {
    if (cid && cid !== c.id) continue;
    let ch; try { ch = await chargerChapitre(mid, c.id); } catch { continue; }
    const docs = sourcesDe(ch);
    for (const e of ch.exercices) if (e.type !== 'dessin') r.push({ ...e, _cle: `${mid}/${c.id}/${e.id}`, _docs: docs, _ou: c.titre });
  }
  if (m.schemas && (!cid || cid === 'schemas')) {
    try {
      const d = await chargerSchemas(mid); const docs = sourcesDe(d);
      for (const e of d.exercices) r.push({ ...e, _cle: `${mid}/schemas/${e.id}`, _docs: docs, _ou: 'Exercices sur schéma' });
    } catch { /* hors ligne */ }
  }
  return r;
}

export function vueExamen(el) {
  const pref = stockage.lire('examen.choix', { mid: matieres()[0]?.id, cid: '', n: 10, min: 30 });
  const mats = matieres().filter((m) => m.chapitres.some((c) => c.nb?.exercices) || m.schemas);
  if (!mats.some((m) => m.id === pref.mid)) pref.mid = mats[0]?.id;

  const formulaire = () => {
    const m = matiere(pref.mid);
    el.innerHTML = `
      <div class="mc" ${styleMatiere(m)}>
        <div class="page-head"><span class="m-ic">${icone('examen')}</span>
          <div><h1>Examen blanc</h1><p class="muted">Des exercices tirés au hasard, en temps limité. Résous sur ta feuille, puis note-toi.</p></div></div>
        <div class="exam-evals" data-evals></div>
        <h2 class="exam-h" data-hasard-titre hidden>Exercices au hasard</h2>
        <div class="panel exam-form">
          <label>Matière <select class="field" data-k="mid">${mats.map((x) => `<option value="${esc(x.id)}" ${x.id === pref.mid ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</select></label>
          <label>Chapitre <select class="field" data-k="cid"><option value="">Tous les chapitres</option>
            ${m.chapitres.filter((c) => c.nb?.exercices).map((c, i) => `<option value="${esc(c.id)}" ${c.id === pref.cid ? 'selected' : ''}>${i + 1}. ${esc(c.titre)}</option>`).join('')}
            ${m.schemas ? `<option value="schemas" ${pref.cid === 'schemas' ? 'selected' : ''}>Exercices sur schéma</option>` : ''}</select></label>
          <label>Nombre d'exercices <select class="field" data-k="n">${[5, 10, 15, 20].map((v) => `<option ${+pref.n === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label>Durée <select class="field" data-k="min">${[10, 20, 30, 45, 60].map((v) => `<option value="${v}" ${+pref.min === v ? 'selected' : ''}>${v} min</option>`).join('')}</select></label>
          <button class="btn primary" data-action="go">${icone('chrono')} Commencer</button>
        </div>
      </div>`;
    chargerEvaluations(pref.mid).then((evs) => {
      const z = el.querySelector('[data-evals]'); if (!z || !evs.length) return;
      el.querySelector('[data-hasard-titre]').hidden = false;
      z.innerHTML = `<h2 class="exam-h">Évaluations types</h2><p class="muted">Une évaluation complète, dans l'ordre, en temps limité, avec le corrigé détaillé de chaque question.</p>
        ${evs.map((ev) => `<div class="panel exam-eval"><div><b>${esc(ev.titre)}</b><br><span class="muted">${esc(ev.desc || '')} · ${ev.duree || 100} min</span></div>
          <span class="exam-eval-b"><button class="btn" data-action="impr" data-eval="${esc(ev.id)}" title="Imprimer l'énoncé pour le faire sur papier">${icone('telecharger')} Imprimer</button>
          <button class="btn" data-action="imprc" data-eval="${esc(ev.id)}" title="Imprimer le corrigé détaillé">Corrigé</button>
          <button class="btn primary" data-action="eval" data-eval="${esc(ev.id)}">${icone('chrono')} Commencer</button></span></div>`).join('')}`;
    }).catch(() => {});
  };
  formulaire();

  let tic = null;
  el.addEventListener('change', (e) => {
    const k = e.target.dataset.k; if (!k) return;
    pref[k] = e.target.value; if (k === 'mid') pref.cid = '';
    stockage.ecrire('examen.choix', pref); formulaire();
  });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-action]'); if (!b) return;
    if (b.dataset.action === 'go') {
      b.disabled = true; b.textContent = 'Préparation…';
      const tous = await reserve(pref.mid, pref.cid);
      if (!tous.length) { b.disabled = false; b.textContent = 'Aucun exercice'; return; }
      lancer(melanger(tous).slice(0, +pref.n));
    }
    if (b.dataset.action === 'eval') {
      const ev = (await chargerEvaluations(pref.mid)).find((x) => x.id === b.dataset.eval); if (!ev) return;
      lancer(ev.exercices.map((x) => ({ ...x, _cle: `${pref.mid}/eval/${ev.id}/${x.id}`, _ou: ev.titre })), ev.duree || 100);
    }
    if (b.dataset.action === 'impr' || b.dataset.action === 'imprc') {
      const ev = (await chargerEvaluations(pref.mid)).find((x) => x.id === b.dataset.eval);
      if (ev) imprimerEvaluation(ev, b.dataset.action === 'imprc');
    }
    if (b.dataset.action === 'fin') bilan();
    if (b.dataset.action === 'refaire') formulaire();
  });

  const notes = new Map();
  let serie = []; let fin = 0;
  function lancer(liste, minutes = +pref.min) {
    serie = liste; notes.clear(); fin = Date.now() + minutes * 60000;
    const m = matiere(pref.mid);
    el.innerHTML = `<div class="mc" ${styleMatiere(m)}>
      <div class="exam-barre"><span class="exam-chrono">${icone('chrono')} <b data-chrono></b></span>
        <span class="muted" data-fait>0 / ${liste.length} notés</span><span class="grow"></span>
        <button class="btn" data-action="fin">Terminer</button></div>
      <div id="exam-lecteur"></div></div>`;
    lecteurExercices(el.querySelector('#exam-lecteur'), liste, {
      onNote: (ex, r) => { notes.set(ex._cle, r); el.querySelector('[data-fait]').textContent = `${notes.size} / ${liste.length} notés`; if (notes.size === liste.length) bilan(); },
    });
    clearInterval(tic); tic = setInterval(chrono, 1000); chrono();
  }
  function chrono() {
    const z = el.querySelector('[data-chrono]'); if (!z) { clearInterval(tic); return; }
    const s = Math.max(0, Math.round((fin - Date.now()) / 1000));
    z.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    z.closest('.exam-chrono').classList.toggle('urgent', s < 120);
    if (!s) { clearInterval(tic); bilan(true); }
  }
  function bilan(tempsEcoule = false) {
    clearInterval(tic);
    const v = { ok: 1, mid: 0.5, ko: 0 };
    const pts = [...notes.values()].reduce((a, r) => a + v[r], 0);
    const pct = serie.length ? Math.round(100 * pts / serie.length) : 0;
    const ligne = (ex) => { const r = notes.get(ex._cle); return `<li><span class="badge ex-${r || 'vide'}">${r ? { ok: 'Juste', mid: 'Presque', ko: 'Faux' }[r] : 'Non fait'}</span> ${esc(ex.titre)} <span class="muted">· ${esc(ex._ou)}</span></li>`; };
    el.innerHTML = `<div class="mc" ${styleMatiere(matiere(pref.mid))}>
      <div class="panel empty exam-bilan">
        <div class="m-ic">${icone('examen')}</div>
        <h2>${tempsEcoule ? 'Temps écoulé !' : 'Examen terminé'}</h2>
        <p class="exam-note"><b>${pct} %</b> · ${pts.toString().replace('.', ',')} / ${serie.length}</p>
        <p class="muted">${pluriel(notes.size, 'exercice')} noté${notes.size > 1 ? 's' : ''} sur ${serie.length}. Les exercices ratés apparaissent dans « À revoir » sur l'accueil.</p>
        <ul class="exam-liste">${serie.map(ligne).join('')}</ul>
        <button class="btn primary" data-action="refaire">${icone('recommencer')} Nouvel examen</button>
      </div></div>`;
  }
  return () => clearInterval(tic);
}
