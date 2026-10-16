/* =====================================================================
   VISIONNEUSE — affiche une page d'un PDF de cours lié sur cet appareil
   ---------------------------------------------------------------------
   Ouverte en touchant une pastille de source (« Ch. 3 – Racines · p. 5 »).
   1. Si les images des pages sont publiées (pages/, chiffrées) : affiche l'image
      de la page (mot de passe demandé une seule fois par appareil).
   2. Sinon, si le PDF est lié sur cet appareil : affiche la page avec pdf.js.
   3. Sinon : propose de choisir le fichier (il reste dans ce navigateur).
   Rendu avec pdf.js (lib/pdfjs/, licence Apache 2.0), chargé à la demande.
   ===================================================================== */

import { esc, toast } from './utils.js';
import { icone } from './icones.js';
import { lirePdf, enregistrerPdf, correspond } from './pdfs.js';
import { imagesDisponibles, cleConnue, essayerMotDePasse, imagePage } from './pages.js';

let pdfjs = null;
const documents = new Map(); // clé → document pdf.js déjà ouvert

async function chargerPdfjs() {
  if (pdfjs) return pdfjs;
  pdfjs = await import('../lib/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../lib/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  return pdfjs;
}

/** Ouvre un PDF (Blob ou File) avec pdf.js. */
export async function ouvrirDocument(blob) {
  const lib = await chargerPdfjs();
  const donnees = new Uint8Array(await blob.arrayBuffer());
  return lib.getDocument({
    data: donnees,
    standardFontDataUrl: new URL('../lib/pdfjs/standard_fonts/', import.meta.url).href,
  }).promise;
}

/**
 * @param {{cle: string, nom: string, court?: string, fichier?: string, pages?: number}} doc
 * @param {number} page  page à afficher (1 = première)
 */
export async function ouvrirVisionneuse(doc, page = 1) {
  fermer();
  const fond = document.createElement('div');
  fond.className = 'visio-fond';
  fond.innerHTML = `
    <div class="visio" role="dialog" aria-modal="true" aria-label="PDF de cours">
      <div class="visio-tete">
        <div class="visio-titre">${icone('page')}<span>${esc(doc.court || doc.nom)}</span></div>
        <div class="visio-outils" hidden>
          <button class="btn icon" data-v="prec" title="Page précédente (←)">${icone('fleche-g')}</button>
          <span class="visio-num"></span>
          <button class="btn icon" data-v="suiv" title="Page suivante (→)">${icone('fleche-d')}</button>
          <button class="btn icon" data-v="moins" title="Réduire">−</button>
          <button class="btn icon" data-v="plus" title="Agrandir">+</button>
        </div>
        <button class="btn icon" data-v="fermer" title="Fermer (Échap)">${icone('croix')}</button>
      </div>
      <div class="visio-corps"><div class="loading">Chargement…</div></div>
      <div class="visio-pied muted"></div>
    </div>`;
  document.body.appendChild(fond);
  document.body.classList.add('visio-ouverte');

  const corps = fond.querySelector('.visio-corps');
  const pied = fond.querySelector('.visio-pied');
  const etat = { doc, page, zoom: 1, pdf: null, rendu: null };

  async function afficherPage() {
    if (etat.mode === 'images') return afficherImage();
    const pdf = etat.pdf;
    etat.page = Math.min(Math.max(1, etat.page), pdf.numPages);
    fond.querySelector('.visio-num').textContent = `p. ${etat.page} / ${pdf.numPages}`;
    fond.querySelector('[data-v="prec"]').disabled = etat.page <= 1;
    fond.querySelector('[data-v="suiv"]').disabled = etat.page >= pdf.numPages;
    const p = await pdf.getPage(etat.page);
    const largeur = Math.max(280, corps.clientWidth - 24) * etat.zoom;
    const base = p.getViewport({ scale: 1 });
    const echelle = largeur / base.width;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const vue = p.getViewport({ scale: echelle * dpr });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vue.width);
    canvas.height = Math.floor(vue.height);
    canvas.style.width = `${Math.floor(vue.width / dpr)}px`;
    canvas.className = 'visio-page';
    etat.rendu?.cancel?.();
    etat.rendu = p.render({ canvasContext: canvas.getContext('2d'), viewport: vue });
    try { await etat.rendu.promise; } catch { return; }
    corps.replaceChildren(canvas);
    corps.scrollTop = 0;
  }

  /* ----- Mode images (pages publiées, chiffrées) ----- */
  async function afficherImage() {
    etat.page = Math.min(Math.max(1, etat.page), etat.total);
    fond.querySelector('.visio-num').textContent = `p. ${etat.page} / ${etat.total}`;
    fond.querySelector('[data-v="prec"]').disabled = etat.page <= 1;
    fond.querySelector('[data-v="suiv"]').disabled = etat.page >= etat.total;
    const voulue = etat.page;
    try {
      const blob = await imagePage(doc.cle, voulue);
      if (voulue !== etat.page) return; // l'utilisateur a déjà changé de page
      const img = new Image();
      img.className = 'visio-page';
      img.alt = `Page ${voulue} — ${doc.nom}`;
      img.src = URL.createObjectURL(blob);
      img.onload = () => URL.revokeObjectURL(img.src);
      img.style.width = `${Math.round(Math.max(280, corps.clientWidth - 24) * etat.zoom)}px`;
      corps.replaceChildren(img);
      corps.scrollTop = 0;
    } catch (e) {
      corps.innerHTML = `<div class="error-box">Page indisponible : ${esc(e.message)}. Vérifie ta connexion (elle sera ensuite gardée hors ligne).</div>`;
    }
  }

  function demarrerImages(info) {
    etat.mode = 'images';
    etat.total = info.pages;
    fond.querySelector('.visio-outils').hidden = false;
    pied.textContent = doc.nom;
    afficherImage();
  }

  function demanderMotDePasse(info, erreur = false) {
    fond.querySelector('.visio-outils').hidden = true;
    corps.innerHTML = `
      <form class="visio-lier" data-v="mdp">
        <h3>Pages de cours protégées</h3>
        <p>Les pages des cours sont protégées par un mot de passe (droits d'auteur des professeurs).
        Entre-le une seule fois : il sera retenu sur cet appareil.</p>
        ${erreur ? '<p class="notice">Mot de passe incorrect.</p>' : ''}
        <p><input class="field" type="password" name="mdp" autocomplete="current-password" placeholder="Mot de passe" required style="width:100%"></p>
        <button class="btn primary" type="submit">${icone('cadenas')} Déverrouiller</button>
      </form>`;
    const form = corps.querySelector('form');
    form.querySelector('input').focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      form.querySelector('button').disabled = true;
      const ok = await essayerMotDePasse(form.mdp.value);
      if (ok) { toast('Pages déverrouillées sur cet appareil'); demarrerImages(info); } else demanderMotDePasse(info, true);
    });
  }

  async function demarrer(blob) {
    try {
      if (!documents.has(doc.cle)) documents.set(doc.cle, await ouvrirDocument(blob));
      etat.pdf = documents.get(doc.cle);
      fond.querySelector('.visio-outils').hidden = false;
      pied.innerHTML = `${esc(doc.nom)} — enregistré sur cet appareil. <a href="#" data-v="changer">Changer de fichier</a>`;
      await afficherPage();
    } catch (e) {
      corps.innerHTML = `<div class="error-box">Impossible d'ouvrir ce PDF : ${esc(e.message)}</div>`;
    }
  }

  function demanderFichier(message = '') {
    fond.querySelector('.visio-outils').hidden = true;
    pied.textContent = '';
    corps.innerHTML = `
      <div class="visio-lier">
        <h3>Lier le PDF de ce cours</h3>
        ${message ? `<p class="notice">${message}</p>` : ''}
        <p>Pour relire la théorie à la bonne page, choisis le fichier
        <b>${esc(doc.fichier || doc.nom)}</b>${doc.pages ? ` (${doc.pages} pages)` : ''}.</p>
        <label class="btn primary">${icone('page')} Choisir le PDF
          <input type="file" accept="application/pdf,.pdf" hidden data-v="fichier"></label>
        <p class="muted">Le PDF reste <b>uniquement dans ce navigateur</b>, sur cet appareil : il n'est jamais envoyé
        ni publié. Une fois lié, il s'ouvre directement à la page citée, même hors ligne.
        Tu peux aussi lier tous tes PDF d'un coup dans Paramètres.</p>
      </div>`;
  }

  async function fichierChoisi(fichier) {
    corps.innerHTML = '<div class="loading">Lecture du PDF…</div>';
    try {
      const pdf = await ouvrirDocument(fichier);
      const { nomOk, pagesOk } = correspond(doc, fichier, pdf.numPages);
      if (!nomOk && !pagesOk) {
        corps.innerHTML = `<div class="visio-lier"><p class="notice">« ${esc(fichier.name)} » (${pdf.numPages} pages) ne ressemble pas au PDF attendu
          (<b>${esc(doc.fichier || doc.nom)}</b>${doc.pages ? `, ${doc.pages} pages` : ''}).</p>
          <button class="btn primary" data-v="quandmeme">L'utiliser quand même</button>
          <button class="btn" data-v="autre">Choisir un autre fichier</button></div>`;
        etat.enAttente = { fichier, pdf };
        return;
      }
      await lier(fichier, pdf);
    } catch (e) {
      demanderFichier(`Ce fichier n'a pas pu être lu comme un PDF (${esc(e.message)}).`);
    }
  }

  async function lier(fichier, pdf) {
    try {
      await enregistrerPdf(doc.cle, fichier, pdf.numPages);
      navigator.storage?.persist?.().catch(() => {});
    } catch (e) {
      toast('PDF affiché mais non enregistré (espace insuffisant ?)');
    }
    documents.set(doc.cle, pdf);
    toast('PDF lié à cet appareil');
    await demarrer(fichier);
  }

  fond.addEventListener('click', async (e) => {
    if (e.target === fond) return fermer();
    const v = e.target.closest('[data-v]')?.dataset.v;
    if (!v) return;
    if (v === 'fermer') fermer();
    else if (v === 'prec') { etat.page--; afficherPage(); }
    else if (v === 'suiv') { etat.page++; afficherPage(); }
    else if (v === 'plus') { etat.zoom = Math.min(3, etat.zoom * 1.25); afficherPage(); }
    else if (v === 'moins') { etat.zoom = Math.max(0.5, etat.zoom / 1.25); afficherPage(); }
    else if (v === 'changer') { e.preventDefault(); documents.delete(doc.cle); demanderFichier(); }
    else if (v === 'quandmeme') { const a = etat.enAttente; etat.enAttente = null; await lier(a.fichier, a.pdf); }
    else if (v === 'autre') demanderFichier();
  });
  fond.addEventListener('change', (e) => {
    if (e.target.dataset.v === 'fichier' && e.target.files[0]) fichierChoisi(e.target.files[0]);
  });
  clavier = (e) => {
    if (e.key === 'Escape') fermer();
    else if ((etat.pdf || etat.mode === 'images') && e.key === 'ArrowLeft') { etat.page--; afficherPage(); }
    else if ((etat.pdf || etat.mode === 'images') && e.key === 'ArrowRight') { etat.page++; afficherPage(); }
    else return;
    e.preventDefault(); e.stopPropagation();
  };
  document.addEventListener('keydown', clavier, true);

  const images = await imagesDisponibles(doc.cle);
  if (images) {
    if (await cleConnue()) demarrerImages(images);
    else demanderMotDePasse(images);
    return;
  }
  const enregistre = await lirePdf(doc.cle);
  if (enregistre?.blob) await demarrer(enregistre.blob);
  else demanderFichier();
}

let clavier = null;
export function fermer() {
  document.querySelector('.visio-fond')?.remove();
  document.body.classList.remove('visio-ouverte');
  if (clavier) document.removeEventListener('keydown', clavier, true);
  clavier = null;
}
