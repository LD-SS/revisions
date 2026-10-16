/* =====================================================================
   VUE PARAMÈTRES — thème, mode, données, à propos
   ===================================================================== */

import { esc, toast, formatDate } from '../utils.js';
import { icone } from '../icones.js';
import { dateContenu, matieres, chargerChapitre } from '../store.js';
import { listerPdfs, supprimerPdf, enregistrerPdf, cleFichier, cleSource } from '../pdfs.js';
import { sourcesDe } from '../synthese.js';

/**
 * @param {HTMLElement} el
 * @param {{ version: string, theme: () => string, changerTheme: (t: string) => void }} app
 */
export function vueParametres(el, app) {
  const theme = app.theme();
  const choix = [['auto', 'Automatique', 'auto'], ['light', 'Clair', 'soleil'], ['dark', 'Sombre', 'lune']];

  el.innerHTML = `
    <div class="crumb"><a href="#/">Accueil</a><span class="crumb-sep">›</span><span>Paramètres</span></div>
    <div class="page-head"><div><h1>Paramètres</h1></div></div>
    <div class="set-grid">
      <div class="panel">
        <h3>Apparence</h3>
        <div class="choice" role="radiogroup" aria-label="Thème">
          ${choix.map(([v, l, ic]) => `<label><input type="radio" name="theme" value="${v}" ${theme === v ? 'checked' : ''}>${icone(ic)} ${l}</label>`).join('')}
        </div>
        <p class="muted set-row">« Automatique » suit le réglage clair / sombre de Windows.</p>
      </div>

      <div class="panel">
        <h3>Mode créateur</h3>
        <p class="set-row"><span class="badge info">${icone('cadenas')} Arrive à l'étape 2</span></p>
        <p class="muted">En saisissant ta clé API Anthropic ici, tu pourras glisser un PDF de cours dans un chapitre
        et générer la synthèse, les flashcards et les exercices. La clé restera uniquement dans ce navigateur.</p>
        <p class="muted">Sans clé, l'appli reste en mode étudiant : consultation seulement.</p>
      </div>

      <div class="panel" id="mes-pdf">
        <h3>Mes PDF de cours</h3>
        <p class="muted">Lie tes PDF pour que les pastilles « p. X » ouvrent directement la bonne page.
        Ils restent <b>uniquement dans ce navigateur</b> (jamais envoyés ni publiés) : à faire une fois sur chaque appareil.</p>
        <div class="set-row"><label class="btn primary">${icone('page')} Ajouter des PDF (plusieurs à la fois)
          <input type="file" accept="application/pdf,.pdf" multiple hidden data-action="ajout-pdf"></label></div>
        <div class="liste-pdf muted">Chargement…</div>
      </div>

      <div class="panel">
        <h3>Mes données</h3>
        <p class="muted">Ta progression (flashcards, scores, planning) est enregistrée dans ce navigateur.
        L'export / import d'une sauvegarde arrive à l'étape 4.</p>
        <div class="set-row"><button class="btn" data-action="maj">${icone('recommencer')} Forcer la mise à jour de l'appli</button></div>
        <p class="muted">À utiliser si une nouvelle version n'apparaît pas : vide la copie hors ligne et recharge la page.
        Ta progression n'est pas effacée.</p>
      </div>

      <div class="panel">
        <h3>À propos</h3>
        <p class="set-row">Révisions — version ${esc(app.version)}</p>
        ${dateContenu() ? `<p class="muted">Contenu mis à jour le ${esc(formatDate(dateContenu()))}.</p>` : ''}
        <p class="muted">Les PDF de cours restent la propriété de leurs auteurs et ne sont pas publiés.
        Seuls les synthèses et exercices générés le sont.</p>
        <p class="muted">Formules affichées avec KaTeX (licence MIT).</p>
      </div>
    </div>`;

  el.addEventListener('change', (e) => {
    if (e.target.name === 'theme') app.changerTheme(e.target.value);
  });
  activerPdfs(el.querySelector('#mes-pdf'));
  el.querySelector('[data-action="maj"]').addEventListener('click', async () => {
    try {
      if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
      if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
      toast('Copie hors ligne vidée, rechargement…');
      setTimeout(() => location.reload(), 600);
    } catch (err) {
      toast('Échec : ' + err.message);
    }
  });
}

/* ---------- Mes PDF de cours ---------- */

/** Tous les PDF sources cités par les chapitres publiés (une entrée par fichier). */
async function tousLesDocs() {
  const docs = new Map();
  for (const m of matieres()) {
    for (const c of m.chapitres) {
      try {
        const ch = await chargerChapitre(m.id, c.id);
        for (const d of sourcesDe(ch)) {
          const cle = cleSource(d);
          if (!docs.has(cle)) docs.set(cle, { ...d, cle, ou: `${m.court || m.nom} · ${c.titre}` });
        }
      } catch { /* chapitre indisponible hors ligne */ }
    }
  }
  return [...docs.values()];
}

async function afficherPdfs(el) {
  const zone = el.querySelector('.liste-pdf');
  const [docs, lies] = await Promise.all([tousLesDocs(), listerPdfs()]);
  const parCle = new Map(lies.map((l) => [l.cle, l]));
  const ligne = (d) => {
    const l = parCle.get(d.cle);
    return `<li class="pdf-ligne">
      <span class="badge ${l ? 'ok' : ''}">${l ? 'lié' : 'à lier'}</span>
      <span class="pdf-nom"><b>${esc(d.court || d.nom)}</b><br><span class="muted">${esc(d.fichier || d.nom)}${d.pages ? ` · ${d.pages} p.` : ''}</span></span>
      ${l ? `<button class="btn icon" data-action="suppr-pdf" data-cle="${esc(d.cle)}" title="Retirer de cet appareil">${icone('croix')}</button>` : ''}
    </li>`;
  };
  const nbLies = docs.filter((d) => parCle.has(d.cle)).length;
  zone.innerHTML = `<p><b>${nbLies} / ${docs.length}</b> PDF liés sur cet appareil.</p><ul class="pdf-liste">${docs.map(ligne).join('')}</ul>`;
  return docs;
}

async function ajouterPdfs(el, fichiers) {
  const { ouvrirDocument } = await import('../visionneuse.js');
  const docs = await tousLesDocs();
  let ok = 0; const ignores = [];
  for (const f of fichiers) {
    const cle = cleFichier(f.name);
    let pdf;
    try { pdf = await ouvrirDocument(f); } catch { ignores.push(f.name); continue; }
    // 1) même nom ; 2) nom proche ET même nombre de pages
    const doc = docs.find((d) => d.cle === cle)
      || docs.find((d) => (d.cle.includes(cle) || cle.includes(d.cle)) && d.pages === pdf.numPages);
    if (!doc) { ignores.push(f.name); continue; }
    await enregistrerPdf(doc.cle, f, pdf.numPages); ok++;
  }
  navigator.storage?.persist?.().catch(() => {});
  toast(`${ok} PDF lié${ok > 1 ? 's' : ''}${ignores.length ? ` · ${ignores.length} non reconnu${ignores.length > 1 ? 's' : ''}` : ''}`, 5000);
  if (ignores.length) setTimeout(() => toast(`Non reconnus : ${ignores.join(', ')}`, 7000), 600);
  await afficherPdfs(el);
}

export function activerPdfs(el) {
  afficherPdfs(el);
  el.addEventListener('change', (e) => {
    if (e.target.dataset.action === 'ajout-pdf' && e.target.files.length) {
      el.querySelector('.liste-pdf').innerHTML = '<p class="muted">Lecture des PDF…</p>';
      ajouterPdfs(el, [...e.target.files]);
    }
  });
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-action="suppr-pdf"]');
    if (!b) return;
    await supprimerPdf(b.dataset.cle);
    toast('PDF retiré de cet appareil');
    afficherPdfs(el);
  });
}
