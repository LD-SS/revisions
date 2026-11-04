/* =====================================================================
   VUES OUTILS — menu « Plus » (téléphone) et recherche globale
   ---------------------------------------------------------------------
   #/plus              liens vers les pages qui ne tiennent pas dans la barre du bas
   #/recherche[/<q>]   recherche dans synthèses, flashcards, exercices et schémas
   ===================================================================== */

import { esc, pluriel } from '../utils.js';
import { icone } from '../icones.js';
import { styleMatiere } from '../matieres.js';
import { matieres, matiere, chargerChapitre, chargerSchemas } from '../store.js';
import { enLigne } from '../rendu.js';

export function vuePlus(el) {
  const dessin = matiere('dessin'); const elec = matieres().find((m) => m.schemas);
  const lien = (h, ic, t, d, m) => `<a class="panel plus-l ${m ? 'mc' : ''}" ${m ? styleMatiere(m) : ''} href="${h}">
    <span class="m-ic">${icone(ic)}</span><span><b>${t}</b><span class="muted">${d}</span></span>${icone('fleche-d')}</a>`;
  el.innerHTML = `
    <div class="page-head"><div><h1>Plus</h1></div></div>
    <div class="plus-liste">
      ${lien('#/recherche', 'loupe', 'Rechercher', 'Une formule, un mot de la synthèse, un exercice…')}
      ${lien('#/examen', 'examen', 'Examen blanc', 'Questions au hasard, chronométrées, comme à l\'examen')}
      ${dessin ? lien('#/dessin', 'crayon', 'Atelier de dessin', 'Dessiner les vues et les coupes dans l\'appli', dessin) : ''}
      ${elec ? lien(`#/m/${esc(elec.id)}/schemas`, 'eclair', 'Exercices sur schéma', 'Annoter les courants et tensions sur le schéma', elec) : ''}
      ${lien('#/parametres', 'reglages', 'Paramètres', 'Thème, PDF de cours, boîte à idées, mise à jour')}
    </div>`;
}

/* ---------- Recherche ---------- */
const sansAccent = (s) => String(s || '').replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const brut = (s) => String(s || '').replace(/\$\$?([^$]*)\$\$?/g, ' $1 ').replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}*_^]/g, '').replace(/\s+/g, ' ').trim();
let INDEX = null;

async function construireIndex() {
  if (INDEX) return INDEX;
  const r = [];
  for (const m of matieres()) {
    for (const c of m.chapitres) {
      let ch; try { ch = await chargerChapitre(m.id, c.id); } catch { continue; }
      const base = `#/m/${m.id}/${c.id}`; const ou = `${m.court || m.nom} · ${c.titre}`;
      for (const s of ch.synthese.sections) {
        const txt = [s.titre, ...(s.blocs || []).map((b) => [b.titre, b.contenu, ...(b.items || []), ...((b.lignes || []).flat())].join(' '))].join(' ');
        r.push({ type: 'Synthèse', ic: 'synthese', titre: s.titre, ou, h: `${base}/synthese`, txt, m });
      }
      for (const f of ch.flashcards) r.push({ type: 'Flashcard', ic: 'cartes', titre: f.recto, ou, h: `${base}/flashcards`, txt: `${f.recto} ${f.verso}`, m });
      for (const e of ch.exercices) r.push({ type: e.type === 'dessin' ? 'Dessin' : 'Exercice', ic: e.type === 'dessin' ? 'crayon' : 'exercices', titre: e.titre, ou, h: `${base}/exercices/${e.id}`, txt: [e.titre, e.consigne, ...(e.items || []).map((it) => `${it.q} ${it.r}`)].join(' '), m });
    }
    if (m.schemas) {
      try {
        const d = await chargerSchemas(m.id);
        for (const e of d.exercices) r.push({ type: 'Schéma', ic: 'eclair', titre: e.titre, ou: `${m.court || m.nom} · Exercices sur schéma`, h: `#/m/${m.id}/schemas/${e.id}`, txt: [e.titre, e.consigne, ...(e.items || []).map((it) => `${it.q} ${it.r}`)].join(' '), m });
      } catch { /* hors ligne */ }
    }
  }
  for (const x of r) { x.n = sansAccent(brut(x.txt)); x.nt = sansAccent(brut(x.titre)); }
  INDEX = r;
  return r;
}

function extrait(x, mots) {
  const t = brut(x.txt).replace(/œ/g, 'oe').replace(/Œ/g, 'OE'); const n = sansAccent(t);
  const i = Math.max(0, n.indexOf(mots[0]));
  const deb = Math.max(0, i - 50);
  let s = (deb ? '…' : '') + t.slice(deb, deb + 150) + (t.length > deb + 150 ? '…' : '');
  s = esc(s);
  for (const m of mots) {
    if (m.length < 2) continue;
    const re = new RegExp(`(${m.split('').map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\u0300-\\u036f]*')})`, 'gi');
    s = s.normalize('NFD').replace(re, '<mark>$1</mark>').normalize('NFC');
  }
  return s;
}

export async function vueRecherche(el, q0 = '') {
  el.innerHTML = `
    <div class="page-head"><div><h1>Rechercher</h1></div></div>
    <input class="field rech-champ" type="search" placeholder="Ex. : loi des nœuds, puissance, a^0, coupe…" value="${esc(q0)}" aria-label="Rechercher" autofocus>
    <div class="rech-res"><p class="muted">Tape au moins 2 lettres.</p></div>`;
  const champ = el.querySelector('input'); const res = el.querySelector('.rech-res');
  let minuteur = null;
  const lancer = async () => {
    const q = champ.value.trim();
    history.replaceState(null, '', `#/recherche${q ? `/${encodeURIComponent(q)}` : ''}`);
    if (q.length < 2) { res.innerHTML = '<p class="muted">Tape au moins 2 lettres.</p>'; return; }
    if (!INDEX) res.innerHTML = '<p class="muted">Chargement du contenu…</p>';
    const idx = await construireIndex();
    const mots = sansAccent(q).split(/\s+/).filter(Boolean);
    const trouves = idx.filter((x) => mots.every((m) => x.n.includes(m)))
      .map((x) => ({ x, score: mots.filter((m) => x.nt.includes(m)).length * 3 + (x.type === 'Synthèse' ? 1 : 0) }))
      .sort((a, b) => b.score - a.score).slice(0, 60);
    res.innerHTML = trouves.length
      ? `<p class="muted">${pluriel(trouves.length, 'résultat')}${trouves.length === 60 ? ' (les 60 premiers)' : ''}</p>
         <div class="rech-liste">${trouves.map(({ x }) => `<a class="panel rech-r mc" ${styleMatiere(x.m)} href="${x.h}">
           <span class="badge">${icone(x.ic)} ${x.type}</span><b>${enLigne(x.titre)}</b>
           <span class="muted rech-ou">${esc(x.ou)}</span><span class="rech-ext">${extrait(x, mots)}</span></a>`).join('')}</div>`
      : '<div class="panel empty"><p class="muted">Aucun résultat. Essaie un autre mot (sans accent, au singulier…).</p></div>';
  };
  champ.addEventListener('input', () => { clearTimeout(minuteur); minuteur = setTimeout(lancer, 220); });
  if (q0) lancer();
  setTimeout(() => champ.focus(), 50);
}
