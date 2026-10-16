/* =====================================================================
   VUE PARAMÈTRES — thème, mode, données, à propos
   ===================================================================== */

import { esc, toast, formatDate } from '../utils.js';
import { icone } from '../icones.js';
import { dateContenu } from '../store.js';

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
