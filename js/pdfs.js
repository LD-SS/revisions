/* =====================================================================
   PDFS — PDF de cours enregistrés dans CE navigateur (jamais publiés)
   ---------------------------------------------------------------------
   Les PDF des professeurs ne sont pas sur le site (droits d'auteur).
   Chaque utilisateur peut « lier » ses propres copies : elles sont
   gardées dans IndexedDB, sur son appareil uniquement, et servent à
   ouvrir la page citée par une pastille de source.
   Clé d'enregistrement : nom du fichier normalisé (source.pdfs[].fichier),
   ce qui permet de partager un même PDF entre plusieurs chapitres
   (ex. le Guide Fanchon).
   ===================================================================== */

const BASE = 'revisions';
const MAGASIN = 'pdfs';

function ouvrirBase() {
  return new Promise((ok, ko) => {
    const req = indexedDB.open(BASE, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(MAGASIN);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => ko(req.error);
  });
}

async function transaction(mode, action) {
  const db = await ouvrirBase();
  return new Promise((ok, ko) => {
    const tx = db.transaction(MAGASIN, mode);
    const req = action(tx.objectStore(MAGASIN));
    tx.oncomplete = () => ok(req?.result);
    tx.onerror = () => ko(tx.error);
  });
}

/** « Chapitre 3 - Racines carrées 1.pdf » → « chapitre3racinescarrees » */
export function cleFichier(nom) {
  return String(nom || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\.pdf$/i, '')
    .replace(/\s*\(\d+\)\s*$/, '')       // « (1) » ajouté par le navigateur
    .replace(/\s+\d$/, '')                // « 1 », « 2 » ajouté en fin de nom (copie)
    .replace(/[^a-z0-9]/g, '');
}

/** Clé d'un PDF source d'un chapitre. */
export const cleSource = (doc) => cleFichier(doc.fichier || doc.nom);

export async function lirePdf(cle) {
  try { return await transaction('readonly', (s) => s.get(cle)); } catch { return null; }
}

export async function enregistrerPdf(cle, fichier, pages) {
  const valeur = { nom: fichier.name, taille: fichier.size, pages, blob: fichier, ajoute: new Date().toISOString() };
  await transaction('readwrite', (s) => s.put(valeur, cle));
}

export async function supprimerPdf(cle) {
  await transaction('readwrite', (s) => s.delete(cle));
}

export async function listerPdfs() {
  try {
    const db = await ouvrirBase();
    return await new Promise((ok, ko) => {
      const res = [];
      const req = db.transaction(MAGASIN).objectStore(MAGASIN).openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return ok(res);
        const { nom, taille, pages, ajoute } = c.value;
        res.push({ cle: c.key, nom, taille, pages, ajoute });
        c.continue();
      };
      req.onerror = () => ko(req.error);
    });
  } catch { return []; }
}

/** Le fichier choisi correspond-il au PDF attendu ? (nom proche ou même nombre de pages) */
export function correspond(doc, fichier, pages) {
  const a = cleSource(doc);
  const b = cleFichier(fichier.name);
  const nomOk = a === b || a.includes(b) || b.includes(a);
  const pagesOk = !doc.pages || doc.pages === pages;
  return { nomOk, pagesOk };
}
