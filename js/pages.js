/* =====================================================================
   PAGES — images des pages de cours, chiffrées (dossier pages/)
   ---------------------------------------------------------------------
   Les pages des PDF sont publiées sous forme d'images JPEG CHIFFRÉES
   (AES-GCM, clé dérivée d'un mot de passe par PBKDF2-SHA256) :
   le site étant public, elles sont illisibles sans le mot de passe.
   pages/index.json : { sel, iterations, verif, paquet, docs: { <clé PDF>: { pages, paquets } } }
   pages/<clé PDF>-<n>.bin : IV (12 octets) + paquet chiffré de `paquet` pages :
     [nombre N][N tailles][N images JPEG]  (entiers 32 bits little-endian)
   Le mot de passe n'est demandé qu'une fois par appareil (la clé dérivée
   est gardée dans ce navigateur).
   ===================================================================== */

const CLE_STOCKAGE = 'revisions.pages.cle';
let manifeste = null;
let cleAes = null;
const paquets = new Map(); // "doc/n" → Promise<Blob[]>

export async function chargerManifeste() {
  if (manifeste) return manifeste;
  try {
    const rep = await fetch('pages/index.json', { cache: 'no-cache' });
    manifeste = rep.ok ? await rep.json() : { docs: {} };
  } catch { manifeste = { docs: {} }; }
  return manifeste;
}

/** Ce PDF a-t-il des images publiées ? */
export async function imagesDisponibles(cleDoc) {
  const m = await chargerManifeste();
  return m.docs?.[cleDoc] || null;
}

const hex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
const enHex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

async function dechiffrer(cle, octets) {
  const iv = octets.slice(0, 12);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cle, octets.slice(12));
}

async function importer(brute) {
  return crypto.subtle.importKey('raw', brute, 'AES-GCM', true, ['decrypt']);
}

/** Clé déjà connue sur cet appareil ? */
export async function cleConnue() {
  if (cleAes) return true;
  try {
    const h = localStorage.getItem(CLE_STOCKAGE);
    if (!h) return false;
    const cle = await importer(hex(h));
    const m = await chargerManifeste();
    await dechiffrer(cle, hex(m.verif)); // vérifie qu'elle est toujours valable
    cleAes = cle;
    return true;
  } catch { return false; }
}

/** Essaie un mot de passe ; true s'il est correct (la clé est alors mémorisée). */
export async function essayerMotDePasse(mdp) {
  const m = await chargerManifeste();
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(mdp), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hex(m.sel), iterations: m.iterations }, base, 256);
  const cle = await importer(bits);
  try { await dechiffrer(cle, hex(m.verif)); } catch { return false; }
  cleAes = cle;
  try { localStorage.setItem(CLE_STOCKAGE, enHex(bits)); } catch { /* stockage bloqué : redemandé plus tard */ }
  return true;
}

export function oublierMotDePasse() {
  cleAes = null;
  try { localStorage.removeItem(CLE_STOCKAGE); } catch { /* rien */ }
}

async function chargerPaquet(cleDoc, n) {
  const id = `${cleDoc}/${n}`;
  if (!paquets.has(id)) {
    paquets.set(id, (async () => {
      const rep = await fetch(`pages/${cleDoc}-${n}.bin`);
      if (!rep.ok) throw new Error(`page indisponible (erreur ${rep.status})`);
      const clair = new Uint8Array(await dechiffrer(cleAes, new Uint8Array(await rep.arrayBuffer())));
      const v = new DataView(clair.buffer);
      const nb = v.getUint32(0, true);
      let pos = 4 + 4 * nb;
      const images = [];
      for (let i = 0; i < nb; i++) {
        const taille = v.getUint32(4 + 4 * i, true);
        images.push(new Blob([clair.slice(pos, pos + taille)], { type: 'image/jpeg' }));
        pos += taille;
      }
      return images;
    })().catch((e) => { paquets.delete(id); throw e; }));
  }
  return paquets.get(id);
}

/** Image (Blob JPEG) de la page `page` (1 = première) du PDF `cleDoc`. */
export async function imagePage(cleDoc, page) {
  const m = await chargerManifeste();
  const n = Math.floor((page - 1) / m.paquet);
  const images = await chargerPaquet(cleDoc, n);
  return images[(page - 1) % m.paquet];
}
