/* =====================================================================
   SIGNALER UNE ERREUR — fenêtre avec une capture automatique de
   l'exercice (ou de l'écran), que l'élève peut annoter (stylo rouge),
   puis envoi :
     - téléphone / navigateur qui sait partager des fichiers : partage
       natif (messagerie, Gmail…) avec la capture jointe ;
     - sinon : la capture est téléchargée et la messagerie s'ouvre avec
       le message pré-rempli (il reste à joindre l'image).
   Aucun service tiers : capture faite dans le navigateur (lib/html2canvas,
   copie locale), message par « mailto: » ou partage du système.
   ===================================================================== */

import { CONFIG } from './config.js';
import { matiere, infoChapitre } from './store.js';
import { esc, toast } from './utils.js';
import { icone } from './icones.js';

let contexteExo = null;   // exercice affiché (renseigné par exercices.js)
export function definirExerciceCourant(c) { contexteExo = c; }

/** L'auteur (l'administrateur) ne voit pas les boutons « Signaler ». */
export const estAuteur = () => !!window.__admin;
export const boiteActive = () => !!CONFIG.admin;

/** Où est l'élève ? (matière › chapitre › onglet › exercice) */
function contexte() {
  const [page, mid, cid, onglet] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  if (page !== 'm' || !mid) return page ? `Page « ${page} »` : 'Accueil';
  const m = matiere(mid); const ch = cid && cid !== 'schemas' ? infoChapitre(mid, cid) : null;
  const morceaux = [m?.nom || mid];
  if (cid === 'schemas') morceaux.push('Exercices sur schéma');
  if (ch) morceaux.push(`Ch. ${ch.ordre} – ${ch.titre}`, onglet || 'synthese');
  if (contexteExo) morceaux.push(`exercice ${contexteExo.num || ''} : ${contexteExo.titre}`);
  return morceaux.join(' › ');
}

/* ---------- capture ---------- */
let h2c = null;
function chargerCapture() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  if (!h2c) h2c = new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = 'lib/html2canvas.min.js';
    s.onload = () => ok(window.html2canvas); s.onerror = () => { h2c = null; ko(new Error('outil de capture indisponible')); };
    document.head.appendChild(s);
  });
  return h2c;
}
const fondPage = () => getComputedStyle(document.body).backgroundColor || '#fff';
async function capturer(cible) {
  const html2canvas = await chargerCapture();
  const el = cible === 'ecran' ? document.body : (document.querySelector('.ex-card') || document.querySelector('main') || document.body);
  const opts = { backgroundColor: fondPage(), scale: Math.min(2, window.devicePixelRatio || 1), useCORS: true, logging: false,
    ignoreElements: (n) => n.classList?.contains('sig-fond') };
  if (cible === 'ecran') Object.assign(opts, { x: window.scrollX, y: window.scrollY, width: window.innerWidth, height: window.innerHeight });
  return html2canvas(el, opts);
}

/* ---------- fenêtre ---------- */
export function ouvrirProposition() {
  document.querySelector('.sig-fond')?.remove();
  const ou = contexte();
  const fond = document.createElement('div');
  fond.className = 'sig-fond';
  fond.innerHTML = `
    <div class="sig" role="dialog" aria-modal="true" aria-label="Signaler une erreur">
      <div class="sig-tete"><b>${icone('alerte')} Signaler une erreur</b><span class="grow"></span>
        <button class="btn icon" data-s="fermer" title="Fermer (Échap)">${icone('croix')}</button></div>
      <p class="muted sig-ou">${esc(ou)}</p>
      <div class="sig-choix" role="radiogroup" aria-label="Zone capturée">
        <button class="btn actif" data-s="exo">Capture de l'exercice</button>
        <button class="btn" data-s="ecran">Capture de l'écran</button>
        <span class="grow"></span>
        <button class="btn" data-s="effacer" title="Effacer les traits rouges">Effacer les traits</button></div>
      <div class="sig-zone"><div class="loading">Capture…</div></div>
      <p class="muted sig-aide">${icone('crayon')} Entoure l'erreur au doigt ou à la souris (trait rouge).</p>
      <label class="sig-lab">Ce qui ne va pas
        <textarea rows="3" placeholder="Ex. : la réponse b) devrait être 4,31 m, pas 4,13 m."></textarea></label>
      <div class="sig-actions"><span class="grow"></span>
        <button class="btn" data-s="fermer">Annuler</button>
        <button class="btn primary" data-s="envoyer">${icone('check')} Envoyer</button></div>
    </div>`;
  document.body.appendChild(fond);
  const zone = fond.querySelector('.sig-zone');
  const txt = fond.querySelector('textarea');
  let toile = null, dessin = null, base = null;

  async function prendre(cible) {
    zone.innerHTML = '<div class="loading">Capture…</div>';
    fond.querySelectorAll('[data-s=exo],[data-s=ecran]').forEach((b) => b.classList.toggle('actif', b.dataset.s === cible));
    try {
      fond.style.visibility = 'hidden';
      base = await capturer(cible);
    } catch (e) {
      base = null;
      zone.innerHTML = `<p class="notice">Capture impossible (${esc(e.message)}). Tu peux quand même envoyer ton message.</p>`;
      return;
    } finally { fond.style.visibility = ''; }
    toile = document.createElement('canvas');
    toile.width = base.width; toile.height = base.height;
    toile.className = 'sig-toile';
    dessin = toile.getContext('2d');
    dessin.drawImage(base, 0, 0);
    zone.innerHTML = ''; zone.appendChild(toile);
    brancherStylo();
  }
  function brancherStylo() {
    let trace = false;
    const pt = (e) => { const r = toile.getBoundingClientRect(); return [(e.clientX - r.left) * toile.width / r.width, (e.clientY - r.top) * toile.height / r.height]; };
    toile.addEventListener('pointerdown', (e) => {
      trace = true; toile.setPointerCapture(e.pointerId);
      const [x, y] = pt(e);
      dessin.strokeStyle = '#e11d2e'; dessin.lineWidth = Math.max(3, toile.width / 220); dessin.lineCap = dessin.lineJoin = 'round';
      dessin.beginPath(); dessin.moveTo(x, y);
      e.preventDefault();
    });
    toile.addEventListener('pointermove', (e) => { if (!trace) return; const [x, y] = pt(e); dessin.lineTo(x, y); dessin.stroke(); e.preventDefault(); });
    const fin = () => { trace = false; };
    toile.addEventListener('pointerup', fin); toile.addEventListener('pointercancel', fin);
  }
  const imageBlob = () => new Promise((ok) => (toile ? toile.toBlob(ok, 'image/png') : ok(null)));

  async function envoyer() {
    const message = txt.value.trim();
    const sujet = `Révisions — erreur signalée (${ou})`.slice(0, 180);
    const corps = `Endroit : ${ou}\nLien : ${location.href}\nVersion : ${window.__version || ''}\n\nCe qui ne va pas :\n${message || '(à compléter)'}\n`;
    const blob = await imageBlob();
    const nom = `erreur-revisions-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.png`;
    const fichier = blob ? new File([blob], nom, { type: 'image/png' }) : null;
    // 1) partage natif avec la capture jointe (téléphone, Windows récent…)
    if (fichier && navigator.canShare?.({ files: [fichier] })) {
      try {
        await navigator.share({ title: sujet, text: `À : ${CONFIG.admin}\n${sujet}\n\n${corps}`, files: [fichier] });
        fermer(); toast('Merci pour ton signalement !'); return;
      } catch (e) { if (e?.name === 'AbortError') return; }
    }
    // 2) sinon : téléchargement de la capture + messagerie pré-remplie
    if (fichier) {
      const a = document.createElement('a'); a.href = URL.createObjectURL(fichier); a.download = nom;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    const corpsMail = corps + (fichier ? `\n(Capture d'écran : joins le fichier « ${nom} », il vient d'être téléchargé.)\n` : '');
    location.href = `mailto:${CONFIG.admin}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corpsMail)}`;
    fermer();
    if (fichier) toast(`Capture téléchargée : joins « ${nom} » à ton e-mail.`, 6000);
  }

  const clavier = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fermer(); } };
  function fermer() { fond.remove(); document.removeEventListener('keydown', clavier, true); }
  document.addEventListener('keydown', clavier, true);
  fond.addEventListener('click', (e) => {
    if (e.target === fond) return fermer();
    const s = e.target.closest('[data-s]')?.dataset.s;
    if (s === 'fermer') fermer();
    else if (s === 'exo' || s === 'ecran') prendre(s);
    else if (s === 'effacer' && base && dessin) dessin.drawImage(base, 0, 0);
    else if (s === 'envoyer') envoyer();
  });
  prendre('exo');
}

// Anciennes fonctions de la boîte à idées : plus rien à faire.
export function viderAttente() {}
export function majBoutonProposer() { document.getElementById('btn-proposer')?.remove(); }
export function devenirAuteur() {}
