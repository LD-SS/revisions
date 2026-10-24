/* =====================================================================
   VUE ATELIER DE DESSIN — tous les exercices « à dessiner » réunis
   ---------------------------------------------------------------------
   #/dessin                       galerie (filtres, progression)
   #/dessin/<chapitre>/<exercice> planche de l'exercice (lecteur commun)
   Les notes sont les mêmes que dans l'onglet Exercices du chapitre.
   ===================================================================== */

import { esc, stockage } from '../utils.js';
import { icone } from '../icones.js';
import { styleMatiere } from '../matieres.js';
import { matiere, chargerChapitre } from '../store.js';
import { sourcesDe } from '../synthese.js';
import { svgSur } from '../rendu.js';
import { lecteurExercices, noteExo } from '../exercices.js';
import { niveauAide, AIDES } from '../planche.js';

const MID = 'dessin';
const NOTES = { ok: ['Réussi', 'ok'], mid: ['Presque', 'mid'], ko: ['À refaire', 'ko'] };

/** Tous les exercices de dessin de la matière, dans l'ordre des chapitres. */
async function tousLesExercices() {
  const m = matiere(MID);
  if (!m) return { m: null, exos: [] };
  const exos = [];
  for (const c of m.chapitres) {
    if (!c.nb?.exercices) continue;
    let ch;
    try { ch = await chargerChapitre(MID, c.id); } catch { continue; }
    const docs = sourcesDe(ch);
    for (const e of ch.exercices) {
      if (e.type !== 'dessin') continue;
      exos.push({ ...e, _cle: `${MID}/${c.id}/${e.id}`, _docs: docs, _chap: c, _num: m.chapitres.indexOf(c) + 1 });
    }
  }
  return { m, exos };
}

export async function vueAtelier(el, params = []) {
  const { m, exos } = await tousLesExercices();
  if (!m) throw new Error('Matière « dessin » introuvable.');
  const [cid, eid] = params;

  if (cid && eid) {   // ---------- planche d'un exercice
    el.innerHTML = `
      <div class="mc" ${styleMatiere(m)}>
        <div class="crumb"><a href="#/">Accueil</a><span class="crumb-sep">›</span><a href="#/dessin">Atelier de dessin</a><span class="crumb-sep">›</span><span>Exercice</span></div>
        <div class="atelier-retour"><a class="btn" href="#/dessin">${icone('fleche-g')} Toutes les planches</a></div>
        <div id="atelier-lecteur"></div>
      </div>`;
    lecteurExercices(el.querySelector('#atelier-lecteur'), exos, { prefixe: MID, debut: `${MID}/${cid}/${eid}` });
    return null;
  }

  // ---------- galerie
  const filtre = stockage.lire('atelier.filtre', 'tous');
  const notes = exos.map((e) => noteExo(e._cle));
  const faits = notes.filter(Boolean);
  const reussis = faits.filter((n) => n.r === 'ok').length;
  const moyenne = faits.length ? Math.round(faits.reduce((s, n) => s + (n.pct ?? { ok: 100, mid: 50, ko: 0 }[n.r]), 0) / faits.length) : null;
  const FILTRES = [['tous', 'Toutes'], ['afaire', 'Pas encore faites'], ['refaire', 'À refaire'], ['reussi', 'Réussies'], ['n1', '★'], ['n2', '★★'], ['n3', '★★★']];
  const garde = (e, n) => ({
    afaire: !n, refaire: n && n.r !== 'ok', reussi: n?.r === 'ok',
    n1: (e.niveau || 1) === 1, n2: e.niveau === 2, n3: e.niveau === 3,
  }[filtre] ?? true);

  const carte = (e, i) => {
    const n = notes[i];
    const etoiles = '★'.repeat(e.niveau || 1) + '☆'.repeat(3 - (e.niveau || 1));
    const tache = { face: 'Vue de face', gauche: 'Vue de gauche', dessus: 'Vue de dessus' }[e.piece?.vue] || 'Arêtes cachées';
    return `<a class="panel at-carte" href="#/dessin/${esc(e._chap.id)}/${esc(e.id)}">
      <div class="at-img fig">${e.perspective ? svgSur(e.perspective) : ''}</div>
      <div class="at-txt">
        <div class="at-l1"><span class="ex-niv">${etoiles}</span>${n ? `<span class="badge ex-${NOTES[n.r][1]}">${NOTES[n.r][0]}${n.pct != null ? ` · ${n.pct} %` : ''}</span>` : '<span class="badge">À faire</span>'}</div>
        <b>${esc(e.titre)}</b>
        <span class="muted">${tache} · ch. ${e._num}</span>
        ${n?.aide ? `<span class="muted at-aide">aides : ${esc(AIDES[n.aide]?.nom || n.aide)}</span>` : ''}
      </div></a>`;
  };
  const visibles = exos.map((e, i) => [e, i]).filter(([e, i]) => garde(e, notes[i]));

  el.innerHTML = `
    <div class="mc" ${styleMatiere(m)}>
      <div class="crumb"><a href="#/">Accueil</a><span class="crumb-sep">›</span><span>Atelier de dessin</span></div>
      <div class="page-head">
        <span class="m-ic">${icone('crayon')}</span>
        <div><h2>Atelier de dessin</h2><p class="muted">Dessine les vues directement dans l'appli : correction automatique et expliquée.</p></div>
      </div>
      <div class="at-stats">
        <div class="panel"><div class="big">${exos.length}</div>planches</div>
        <div class="panel"><div class="big">${faits.length}</div>faites</div>
        <div class="panel"><div class="big ok">${reussis}</div>réussies</div>
        <div class="panel"><div class="big">${moyenne == null ? '–' : `${moyenne} %`}</div>score moyen</div>
      </div>
      <div class="at-barre">
        <div class="at-filtres" role="radiogroup" aria-label="Filtrer">
          ${FILTRES.map(([v, l]) => `<label class="chip"><input type="radio" name="atf" value="${v}" ${v === filtre ? 'checked' : ''}><span>${l}</span></label>`).join('')}
        </div>
        <span class="muted">Niveau d'aide actuel : <b>${AIDES[niveauAide()].nom}</b> (modifiable dans chaque planche)</span>
      </div>
      ${(() => {
        const prochaine = exos.find((e, i) => !notes[i]) || exos.find((e, i) => notes[i]?.r !== 'ok');
        return prochaine ? `<a class="btn primary at-go" href="#/dessin/${esc(prochaine._chap.id)}/${esc(prochaine.id)}">${icone('crayon')} ${faits.length ? 'Continuer' : 'Commencer'} : ${esc(prochaine.titre)}</a>` : '<p class="notice info">Toutes les planches sont réussies, bravo ! Essaie-les en aides « Difficile ».</p>';
      })()}
      <div class="at-grille">${visibles.length ? visibles.map(([e, i]) => carte(e, i)).join('') : '<p class="muted">Aucune planche pour ce filtre.</p>'}</div>
      <p class="muted at-note">D'autres planches (coupes, plans inclinés, cylindres) viendront s'ajouter ici.</p>
    </div>`;
  el.querySelectorAll('input[name=atf]').forEach((r) => r.addEventListener('change', () => { stockage.ecrire('atelier.filtre', r.value); vueAtelier(el, params); }));
  return null;
}
