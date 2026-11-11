/* =====================================================================
   SERVICE WORKER — fonctionnement hors ligne
   ---------------------------------------------------------------------
   Stratégie « réseau d'abord » : en ligne, on prend toujours la dernière
   version (et on met la copie à jour) ; hors ligne, on sert la copie.
   À l'installation, toute l'appli est copiée (le contenu vient de Firestore).
   Quand on ajoute un fichier JS / CSS : l'ajouter dans FICHIERS_APP.
   ===================================================================== */

const CACHE = 'revisions-v43';

const FICHIERS_APP = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/app.js',
  'js/utils.js',
  'js/store.js',
  'js/matieres.js',
  'js/icones.js',
  'js/rendu.js',
  'js/synthese.js',
  'js/flashcards.js',
  'js/pdfs.js',
  'js/visionneuse.js',
  'js/pages.js',
  'js/exercices.js',
  'js/planche.js',
  'js/piece3d.js',
  'js/circuit.js',
  'js/vues/schemas.js',
  'js/vues/outils.js',
  'js/synchro.js',
  'js/compte.js',
  'js/conditions.js',
  'js/vues/acces.js',
  'js/vues/membres.js',
  'js/vues/generateur.js',
  'js/vues/examen.js',
  'js/suivi.js',
  'js/proposer.js',
  'js/config.js',
  'lib/pdfjs/pdf.min.mjs',
  'lib/pdfjs/pdf.worker.min.mjs',
  'js/vues/accueil.js',
  'js/vues/matiere.js',
  'js/vues/chapitre.js',
  'js/vues/parametres.js',
  'js/vues/atelier.js',
  'js/vues/planche-libre.js',
  'js/dao/feuille.js',
  'js/dao/geom.js',
  'js/dao/trace.js',
  'js/dao/edition.js',
  'js/dao/cotes.js',
  'js/geometrie.js',
  'lib/katex/katex.min.js',
  'lib/katex/katex.min.css',
  ...[
    'AMS-Regular', 'Caligraphic-Bold', 'Caligraphic-Regular', 'Fraktur-Bold', 'Fraktur-Regular',
    'Main-Bold', 'Main-BoldItalic', 'Main-Italic', 'Main-Regular', 'Math-BoldItalic', 'Math-Italic',
    'SansSerif-Bold', 'SansSerif-Italic', 'SansSerif-Regular', 'Script-Regular',
    'Size1-Regular', 'Size2-Regular', 'Size3-Regular', 'Size4-Regular', 'Typewriter-Regular',
  ].map((f) => `lib/katex/fonts/KaTeX_${f}.woff2`),
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FICHIERS_APP);
    // Le contenu (synthèses, exercices) n'est plus dans le site : il vient de Firestore,
    // qui garde sa propre copie hors ligne pour les comptes acceptés.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const cle of await caches.keys()) if (cle !== CACHE) await caches.delete(cle);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Bibliothèque Firebase (adresse versionnée, ne change jamais) : copie d'abord, pour le hors ligne.
  if (req.method === 'GET' && url.origin === 'https://www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    event.respondWith(caches.open(CACHE).then(async (cache) => (await cache.match(req)) || fetch(req).then((rep) => { if (rep.ok) cache.put(req, rep.clone()); return rep; })));
    return;
  }
  // Sinon, on ne gère que les lectures de notre propre site (jamais Firestore ni l'API Claude).
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const rep = await fetch(req, { cache: 'no-cache' });
      if (rep.ok) cache.put(req, rep.clone());
      return rep;
    } catch (e) {
      const copie = await cache.match(req, { ignoreSearch: true });
      if (copie) return copie;
      if (req.mode === 'navigate') {
        const accueil = await cache.match('index.html');
        if (accueil) return accueil;
      }
      return new Response('Hors ligne : fichier non disponible.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
