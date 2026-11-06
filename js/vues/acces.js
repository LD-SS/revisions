/* =====================================================================
   ACCÈS — écrans de connexion, d'inscription et d'attente
   ---------------------------------------------------------------------
   exigerAcces(el) : affiche ce qu'il faut (connexion, e-mail à confirmer,
   attente de validation, appareil en trop, accès bloqué) et ne rend la main
   que lorsque le compte est accepté sur cet appareil.
   ===================================================================== */

import { esc, toast } from '../utils.js';
import { icone } from '../icones.js';
import { CONFIG } from '../config.js';
import {
  pret, ouvrirSession, inscrire, connecter, deconnecter, renvoyerVerification, motDePasseOublie,
  messageErreur, utilisateur, decrireAppareil, reprendreSession, accepterConditions,
} from '../compte.js';
import { CGU_HTML } from '../conditions.js';

const cadre = (contenu) => `<div class="acces"><div class="panel acces-boite">
  <div class="acces-tete"><span class="logo">${icone('logo')}</span><div><h1>Révisions</h1>
  <p class="muted">Bachelier en électromécanique · accès réservé aux élèves et professeurs de Meuse-Cadets</p></div></div>
  ${contenu}</div></div>`;

/** Rend la main (avec le membre) quand l'accès est accordé. */
export async function exigerAcces(el) {
  await pret();
  for (;;) {
    let r;
    try { r = await ouvrirSession(); }
    catch (err) { r = { etat: 'erreur', message: messageErreur(err) }; }
    if (r.etat === 'ok') return r.membre;
    await ecran(el, r);
  }
}

/** Accès perdu en cours d'utilisation (bloqué, appareil retiré, ouvert ailleurs). */
export function ecranPerte(el, raison) {
  document.body.classList.add('verrou');
  const txt = {
    ailleurs: ['Ton compte vient d\'être ouvert sur un autre appareil.', 'Une seule session à la fois : l\'autre appareil sera déconnecté si tu reprends ici.'],
    bloque: ['Ton accès a été bloqué.', `Contacte ${CONFIG.auteur} si tu penses que c'est une erreur.`],
    attente: ['Ton accès est suspendu.', `Il doit être de nouveau validé par ${CONFIG.auteur}.`],
    'appareil-retire': ['Cet appareil a été retiré de ton compte.', 'Reconnecte-toi pour demander à l\'utiliser de nouveau.'],
  }[raison] || ['Accès interrompu.', ''];
  el.innerHTML = cadre(`<h2>${esc(txt[0])}</h2><p class="muted">${esc(txt[1])}</p>
    <div class="acces-actions">
      ${raison === 'ailleurs' ? `<button class="btn primary" data-a="reprendre">${icone('recommencer')} Reprendre ici</button>` : `<button class="btn primary" data-a="recharger">${icone('recommencer')} Réessayer</button>`}
      <button class="btn" data-a="sortir">Se déconnecter</button></div>`);
  el.querySelector('[data-a=reprendre]')?.addEventListener('click', async () => { await reprendreSession().catch(() => {}); location.reload(); });
  el.querySelector('[data-a=recharger]')?.addEventListener('click', () => location.reload());
  el.querySelector('[data-a=sortir]').addEventListener('click', async () => { await deconnecter(); location.reload(); });
}

function ecran(el, r) {
  return new Promise((suite) => {
    const u = utilisateur();
    const boutonSortir = '<button class="btn" data-a="sortir">Se déconnecter</button>';
    const lier = () => {
      el.querySelector('[data-a=sortir]')?.addEventListener('click', async () => { await deconnecter(); suite(); });
      el.querySelector('[data-a=verifier]')?.addEventListener('click', () => suite());
    };
    const verifierBtn = (t = 'Actualiser') => `<button class="btn primary" data-a="verifier">${icone('recommencer')} ${t}</button>`;
    switch (r.etat) {
      case 'deconnecte': formulaire(el, suite); return;
      case 'non-verifie':
        el.innerHTML = cadre(`<h2>Confirme ton adresse e-mail</h2>
          <p>Un mail de confirmation a été envoyé à <b>${esc(u?.email)}</b>. Clique sur le lien qu'il contient
          (regarde aussi dans les <b>spams</b>), puis reviens ici.</p>
          <div class="acces-actions">${verifierBtn('J\'ai confirmé')}<button class="btn" data-a="renvoyer">Renvoyer le mail</button>${boutonSortir}</div>`);
        lier();
        el.querySelector('[data-a=renvoyer]').addEventListener('click', async (e) => {
          e.target.disabled = true;
          try { await renvoyerVerification(); toast('Mail renvoyé'); } catch (err) { toast(messageErreur(err), 5000); e.target.disabled = false; }
        });
        return;
      case 'attente':
        el.innerHTML = cadre(`<h2>Demande envoyée</h2>
          <p>Ton compte <b>${esc(u?.email)}</b> est créé. ${esc(CONFIG.auteur)} doit encore <b>valider ton accès</b> :
          tu pourras utiliser l'appli dès que c'est fait.</p>
          <div class="acces-actions">${verifierBtn()}${boutonSortir}</div>`);
        lier(); return;
      case 'bloque':
        el.innerHTML = cadre(`<h2>Accès bloqué</h2><p>L'accès de <b>${esc(u?.email)}</b> a été bloqué.
          Contacte ${esc(CONFIG.auteur)} si tu penses que c'est une erreur.</p>
          <div class="acces-actions">${verifierBtn()}${boutonSortir}</div>`);
        lier(); return;
      case 'cgu':
        el.innerHTML = cadre(`<h2>Conditions d'utilisation</h2>
          <p>Pour continuer à utiliser l'appli, lis et accepte les conditions d'utilisation.</p>
          <div class="cgu-boite">${CGU_HTML}</div>
          <label class="cgu-ok"><input type="checkbox" data-a="coche"> J'ai lu et j'accepte les conditions d'utilisation.</label>
          <div class="acces-actions"><button class="btn primary" data-a="accepter" disabled>Accepter et continuer</button>${boutonSortir}</div>`);
        lier();
        el.querySelector('[data-a=coche]').addEventListener('change', (e) => { el.querySelector('[data-a=accepter]').disabled = !e.target.checked; });
        el.querySelector('[data-a=accepter]').addEventListener('click', async (e) => {
          e.target.disabled = true;
          try { await accepterConditions(); suite(); } catch (err) { toast(messageErreur(err), 5000); e.target.disabled = false; }
        });
        return;
      case 'appareil':
        el.innerHTML = cadre(`<h2>Nouvel appareil</h2>
          <p>Ton compte est déjà utilisé sur <b>${Object.keys(r.membre?.appareils || {}).length} appareil(s)</b>, le maximum autorisé.
          Une demande a été envoyée à ${esc(CONFIG.auteur)} pour cet appareil (<b>${esc(decrireAppareil())}</b>).</p>
          <p class="muted">Tu pourras l'utiliser dès qu'elle sera acceptée.</p>
          <div class="acces-actions">${verifierBtn()}${boutonSortir}</div>`);
        lier(); return;
      case 'hors-ligne':
        el.innerHTML = cadre(`<h2>Pas de connexion</h2><p>La première connexion sur un appareil demande Internet.</p>
          <div class="acces-actions">${verifierBtn('Réessayer')}${boutonSortir}</div>`);
        lier(); return;
      default:
        el.innerHTML = cadre(`<h2>Oups</h2><p>${esc(r.message || 'Erreur inconnue.')}</p>
          <div class="acces-actions">${verifierBtn('Réessayer')}${boutonSortir}</div>`);
        lier();
    }
  });
}

function formulaire(el, suite, mode = 'connexion') {
  const ins = mode === 'inscription';
  el.innerHTML = cadre(`
    <div class="seg acces-seg" role="tablist">
      <button class="${ins ? '' : 'actif'}" data-mode="connexion" type="button">Se connecter</button>
      <button class="${ins ? 'actif' : ''}" data-mode="inscription" type="button">Créer un compte</button>
    </div>
    <form class="acces-form" novalidate>
      ${ins ? `<div class="acces-2"><label>Prénom<input class="field" name="prenom" autocomplete="given-name" required></label>
        <label>Nom<input class="field" name="nom" autocomplete="family-name" required></label></div>` : ''}
      <label>Adresse e-mail de l'école<input class="field" name="email" type="email" autocomplete="username" placeholder="prenom.nom@student.meuse-cadets.be" required></label>
      <label>Mot de passe<input class="field" name="mdp" type="password" autocomplete="${ins ? 'new-password' : 'current-password'}" minlength="8" required></label>
      ${ins ? `<label>Confirme le mot de passe<input class="field" name="mdp2" type="password" autocomplete="new-password" minlength="8" required></label>
        <details class="cgu-details"><summary>Lire les conditions d'utilisation</summary><div class="cgu-boite">${CGU_HTML}</div></details>
        <label class="cgu-ok"><input type="checkbox" name="cgu"> J'ai lu et j'accepte les conditions d'utilisation.</label>` : ''}
      <p class="acces-err" hidden></p>
      <button class="btn primary" type="submit">${ins ? 'Créer mon compte' : 'Se connecter'}</button>
      ${ins ? `<p class="muted">Seules les adresses <b>@student.meuse-cadets.be</b> et <b>@meuse-cadets.be</b> sont acceptées.
        Tu recevras un mail de confirmation, puis ${esc(CONFIG.auteur)} validera ton accès.
        Ton compte est personnel : il fonctionne sur 2 appareils au maximum (ex. PC + téléphone), une session à la fois.</p>`
      : '<button class="btn lien" type="button" data-a="oubli">Mot de passe oublié ?</button>'}
    </form>`);
  el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => formulaire(el, suite, b.dataset.mode)));
  const f = el.querySelector('form'); const err = el.querySelector('.acces-err');
  const montrer = (m) => { err.textContent = m; err.hidden = !m; };
  el.querySelector('[data-a=oubli]')?.addEventListener('click', async () => {
    const email = f.email.value.trim();
    if (!email) { montrer('Tape d\'abord ton adresse e-mail ci-dessus.'); return; }
    try { await motDePasseOublie(email); montrer(''); toast(`Si un compte existe, un mail de réinitialisation a été envoyé à ${email}`, 6000); }
    catch (e) { montrer(messageErreur(e)); }
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); montrer('');
    const b = f.querySelector('[type=submit]'); b.disabled = true;
    try {
      if (ins) {
        if (f.mdp.value.length < 8) throw new Error('Mot de passe trop court : au moins 8 caractères.');
        if (f.mdp.value !== f.mdp2.value) throw new Error('Les deux mots de passe sont différents.');
        if (!f.cgu.checked) throw new Error('Coche la case pour accepter les conditions d\'utilisation.');
        await inscrire({ prenom: f.prenom.value, nom: f.nom.value, email: f.email.value, mdp: f.mdp.value, cgu: true });
      } else {
        await connecter(f.email.value, f.mdp.value);
      }
      suite();
    } catch (er) { montrer(messageErreur(er)); b.disabled = false; }
  });
}
