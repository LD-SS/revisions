/* =====================================================================
   SERVICE WORKER — fonctionnement hors ligne
   ---------------------------------------------------------------------
   Stratégie « réseau d'abord » : en ligne, on prend toujours la dernière
   version (et on met la copie à jour) ; hors ligne, on sert la copie.
   À l'installation, tout l'appli + tout le contenu de content/ est copié.
   Quand on ajoute un fichier JS / CSS : l'ajouter dans FICHIERS_APP.
   ===================================================================== */

const CACHE = 'revisions-v12';

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
  'js/proposer.js',
  'js/config.js',
  'lib/pdfjs/pdf.min.mjs',
  'lib/pdfjs/pdf.worker.min.mjs',
  'js/vues/accueil.js',
  'js/vues/matiere.js',
  'js/vues/chapitre.js',
  'js/vues/parametres.js',
  'js/vues/atelier.js',
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
    // Contenu : l'index puis chaque chapitre qu'il référence.
    try {
      const rep = await fetch('content/index.json', { cache: 'no-cache' });
      if (rep.ok) {
        await cache.put('content/index.json', rep.clone());
        const index = await rep.json();
        const fichiers = (index.matieres || []).flatMap((m) => (m.chapitres || []).map((c) => `content/${c.fichier}`));
        await Promise.allSettled(fichiers.map((f) => cache.add(f)));
      }
    } catch (e) { /* hors ligne pendant l'installation : le contenu sera copié au fil des visites */ }
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
  // On ne gère que les lectures de notre propre site (jamais l'API Claude, par exemple).
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
