/* =====================================================================
   VUE PARAMÈTRES — thème, mode, données, à propos
   ===================================================================== */

import { esc, toast, formatDate, stockage } from '../utils.js';
import { icone } from '../icones.js';
import { dateContenu, matieres, chargerChapitre } from '../store.js';
import { listerPdfs, supprimerPdf, enregistrerPdf, cleFichier, cleSource } from '../pdfs.js';
import { sourcesDe } from '../synthese.js';
import { CONFIG } from '../config.js';
import { CGU_HTML } from '../conditions.js';
import { synchroniser, infosSynchro } from '../synchro.js';
import { utilisateur, monMembre, nomComplet, deconnecter, idAppareil, estAdmin } from '../compte.js';

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


      <div class="panel" id="synchro"></div>

      <div class="panel">
        <h3>Mes données</h3>
        <p class="muted">Ta progression (exercices notés, flashcards à revoir, annotations des schémas) est enregistrée
        dans ton compte : tu la retrouves sur chacun de tes appareils.</p>
        <p class="muted" data-horsligne></p>
        <div class="set-row"><button class="btn" data-action="maj">${icone('recommencer')} Forcer la mise à jour de l'appli</button></div>
        <p class="muted">À utiliser si une nouvelle version n'apparaît pas : vide la copie hors ligne et recharge la page.
        Ta progression n'est pas effacée.</p>
        <div class="set-row"><button class="btn bad" data-action="raz">${icone('croix')} Effacer ma progression</button></div>
      </div>

      <div class="panel">
        <h3>À propos</h3>
        <p class="set-row">Révisions — version ${esc(app.version)}</p>
        ${dateContenu() ? `<p class="muted">Contenu mis à jour le ${esc(formatDate(dateContenu()))}.</p>` : ''}
        <p class="muted">Les cours restent la propriété de leurs auteurs (les professeurs).
        Seuls les synthèses et exercices générés le sont.</p>
        <p class="muted">Formules affichées avec KaTeX (licence MIT).</p>
        <p>© 2026 Logan Degossely — tous droits réservés.</p>
        <details class="cgu-details"><summary>Conditions d'utilisation</summary><div class="cgu-boite">${CGU_HTML}</div></details>
      </div>
    </div>`;

  el.addEventListener('change', (e) => {
    if (e.target.name === 'theme') app.changerTheme(e.target.value);
  });
  panneauSynchro(el.querySelector('#synchro'));
  const hl = stockage.lire('horsligne.jour', '');
  el.querySelector('[data-horsligne]').textContent = hl ? `Tout le contenu est gardé sur cet appareil pour le hors ligne (mis à jour le ${hl.split('-').reverse().join('/')}).` : 'Le contenu est copié automatiquement sur cet appareil pour le hors ligne.';
  el.querySelector('[data-action="raz"]').addEventListener('click', () => {
    if (!confirm(`Effacer toutes tes notes d'exercices, flashcards à revoir et annotations' sur TOUS tes appareils' ?`)) return;
    for (const k of ['exos', 'fc', 'circuits', 'dernier', 'planches']) stockage.supprimer(k);
    toast('Progression effacée');
  });
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

/* ---------- Mon compte (identité, appareils, synchro) ---------- */
function panneauSynchro(box) {
  const quand = (t) => (t ? new Date(t).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' }) : 'jamais');
  const dessiner = async () => {
    const u = utilisateur(); const m = await monMembre(); const s = infosSynchro(); const ici = idAppareil();
    const apps = Object.entries(m?.appareils || {});
    box.innerHTML = `<h3>Mon compte</h3>
      <p><b>${esc(nomComplet(m) || u?.email || '')}</b><br><span class="muted">${esc(u?.email || '')}</span>
      ${estAdmin() ? ' · <a href="#/membres">gérer les membres</a>' : ''}</p>
      <p class="muted">Appareils autorisés : ${apps.length} / ${m?.maxApp || 2} · une seule session à la fois.</p>
      <ul class="mb-apps">${apps.map(([id, a]) => `<li><span>${esc(a.nom || 'Appareil')}${id === ici ? ' <span class="badge">cet appareil</span>' : ''}<br>
        <span class="muted">vu le ${esc(quand(a.dernier))}</span></span></li>`).join('')}</ul>
      <p class="muted">Progression synchronisée${s.derniere ? ` (dernière fois : ${esc(quand(s.derniere))})` : ''}.${s.erreur ? ` <b>Problème :</b> ${esc(s.erreur)}` : ''}</p>
      <div class="set-row"><button class="btn" data-s="maintenant">${icone('recommencer')} Synchroniser maintenant</button>
        <button class="btn" data-s="sortir">Se déconnecter</button></div>
      <p class="muted">Pour changer d'appareil (nouveau téléphone…), demande à ${esc(CONFIG.auteur)} de retirer l'ancien.</p>`;
  };
  dessiner();
  box.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    if (b.dataset.s === 'maintenant') {
      b.disabled = true; await synchroniser(); await dessiner();
      toast(infosSynchro().erreur ? 'Synchro impossible' : 'Progression synchronisée');
    }
    if (b.dataset.s === 'sortir' && confirm('Se déconnecter de cet appareil ? Ta progression reste dans ton compte.')) {
      await synchroniser(); await deconnecter(); location.reload();
    }
  });
}
