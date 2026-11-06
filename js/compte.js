/* =====================================================================
   COMPTE — connexion, accès réservé, appareils, contenu protégé
   ---------------------------------------------------------------------
   Firebase (projet « revisions-meuse-cadets ») :
     Authentication : e-mail + mot de passe (adresse de l'école, vérifiée)
     Firestore :
       membres/{uid}      { email, prenom, nom, statut: attente|accepte|bloque,
                            maxApp, appareils: {id: {...}}, demandes: {id: {...}},
                            session: id de l'appareil connecté, vu }
       contenu/{chemin}   { json }   (chemin = « content|elec|schemas.json »)
       progression/{uid}  { json }   (synchro entre appareils)
   Les règles de sécurité (firestore.rules) font le vrai contrôle : sans
   compte accepté, le contenu est illisible, quoi qu'on modifie ici.
   La configuration Firebase ci-dessous est publique par nature (ce n'est
   pas un secret) ; aucun mot de passe n'est stocké par l'appli.
   ===================================================================== */

// Bibliothèque Firebase (version figée ; copiée hors ligne par le service worker).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendEmailVerification, sendPasswordResetEmail, updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, getDocFromServer, setDoc, updateDoc, onSnapshot, collection, getDocs, deleteField, deleteDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { CONFIG } from './config.js';
import { stockage } from './utils.js';
import { CGU_VERSION } from './conditions.js';

const app = initializeApp(CONFIG.firebase);
// Connexion mémorisée sur l'appareil (IndexedDB, sinon localStorage) : on reste connecté
// d'une utilisation à l'autre, jusqu'à « Se déconnecter ».
const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
auth.languageCode = 'fr';
let db;
try { db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
catch { db = initializeFirestore(app, {}); }   // navigation privée : pas de cache disque

export const DOMAINES = ['student.meuse-cadets.be', 'meuse-cadets.be'];
export const domaineOk = (email) => DOMAINES.includes(String(email || '').toLowerCase().split('@')[1] || '');
export const estAdmin = (u = auth.currentUser) => !!u && u.email?.toLowerCase() === CONFIG.admin;
export const utilisateur = () => auth.currentUser;

/* ---------- appareil ---------- */
export function idAppareil() {
  let id = stockage.lire('appareil', '');
  if (!/^[a-z0-9]{16,}$/.test(id)) {
    id = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
    stockage.ecrire('appareil', id);
  }
  return id;
}
export function decrireAppareil(ua = navigator.userAgent) {
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad'
    : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Android (téléphone)' : 'Android (tablette)') : /Windows/.test(ua) ? 'Windows'
      : /CrOS/.test(ua) ? 'Chromebook' : /Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Appareil inconnu';
  const nav = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /OPR\//.test(ua) ? 'Opera'
    : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Navigateur';
  return `${os} · ${nav}`;
}

/* ---------- notifications par e-mail (Formspree) ---------- */
export async function notifier(sujet, message) {
  if (!CONFIG.formulaire) return;
  try {
    await fetch(CONFIG.formulaire, {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ _subject: sujet, message, email: auth.currentUser?.email || '', lien: `${location.origin}${location.pathname}#/membres` }),
    });
  } catch (e) { console.warn('Notification non envoyée', e); }
}

/* ---------- connexion / inscription ---------- */
const lienRetour = () => ({ url: `${location.origin}${location.pathname}`, handleCodeInApp: false });

export async function inscrire({ prenom, nom, email, mdp, cgu }) {
  if (!cgu) throw new Error('Tu dois accepter les conditions d\'utilisation.');
  email = String(email || '').trim().toLowerCase();
  if (!domaineOk(email)) throw new Error('Utilise ton adresse de l\'école (…@student.meuse-cadets.be ou …@meuse-cadets.be).');
  if (!prenom?.trim() || !nom?.trim()) throw new Error('Indique ton prénom et ton nom.');
  const { user } = await createUserWithEmailAndPassword(auth, email, mdp);
  stockage.ecrire('compte.email', email);
  await updateProfile(user, { displayName: `${prenom.trim()}|${nom.trim()}` });
  await sendEmailVerification(user, lienRetour()).catch(() => {});
  return user;
}
export async function connecter(email, mdp) {
  email = String(email || '').trim().toLowerCase();
  if (!domaineOk(email)) throw new Error('Utilise ton adresse de l\'école.');
  const u = (await signInWithEmailAndPassword(auth, email, mdp)).user;
  stockage.ecrire('compte.email', email);
  return u;
}
export const renvoyerVerification = () => sendEmailVerification(auth.currentUser, lienRetour());
export const motDePasseOublie = (email) => sendPasswordResetEmail(auth, String(email || '').trim().toLowerCase(), lienRetour());
export async function deconnecter() { arreterSurveillance(); await signOut(auth); }

/** Message d'erreur Firebase en français. */
export function messageErreur(err) {
  const c = err?.code || '';
  return {
    'auth/email-already-in-use': 'Un compte existe déjà avec cette adresse : connecte-toi (ou « mot de passe oublié »).',
    'auth/invalid-credential': 'Adresse ou mot de passe incorrect.',
    'auth/wrong-password': 'Adresse ou mot de passe incorrect.',
    'auth/user-not-found': 'Aucun compte avec cette adresse : inscris-toi.',
    'auth/weak-password': 'Mot de passe trop faible : au moins 8 caractères.',
    'auth/invalid-email': 'Adresse e-mail invalide.',
    'auth/too-many-requests': 'Trop d\'essais : patiente quelques minutes.',
    'auth/network-request-failed': 'Pas de connexion Internet.',
    'auth/user-disabled': 'Ce compte a été désactivé.',
    'permission-denied': 'Accès refusé.',
  }[c] || err?.message || 'Erreur inconnue.';
}

/** Attend l'état de connexion initial (Firebase le relit depuis le navigateur). */
export const pret = () => new Promise((ok) => { const stop = onAuthStateChanged(auth, (u) => { stop(); ok(u); }); });

/* ---------- membre ---------- */
// Hors ligne, une écriture Firestore reste en file d'attente et sa promesse ne se termine
// qu'au retour du réseau : on n'attend donc pas (ou au plus 4 s).
const ecrireSansAttendre = (p) => { p.catch((e) => console.warn('Écriture compte :', e)); };
const enLigneOuPas = (p) => Promise.race([p, new Promise((ok) => setTimeout(ok, 4000))]);
const refMembre = (uid) => doc(db, 'membres', uid);
export const nomComplet = (m) => [m?.prenom, m?.nom].filter(Boolean).join(' ') || m?.email || '';

/**
 * Ouvre la session sur cet appareil. Renvoie { etat, membre } avec etat :
 * 'deconnecte' | 'non-verifie' | 'attente' | 'bloque' | 'appareil' (appareil en trop, en attente) | 'ok'
 */
export async function ouvrirSession() {
  const u = auth.currentUser;
  if (!u) return { etat: 'deconnecte' };
  if (!u.emailVerified) {
    await u.reload().catch(() => {});
    if (!auth.currentUser.emailVerified) return { etat: 'non-verifie' };
    await u.getIdToken(true);   // le jeton doit contenir « e-mail vérifié » pour les règles
  }
  const dev = idAppareil(); const desc = { nom: decrireAppareil(), premier: Date.now(), dernier: Date.now() };
  const admin = estAdmin(u);
  let snap;
  try { snap = await getDocFromServer(refMembre(u.uid)); } catch { snap = await getDoc(refMembre(u.uid)).catch(() => null); }
  if (!snap) return { etat: 'hors-ligne' };
  let m = snap.exists() ? snap.data() : null;
  if (!m) {
    const [prenom = '', nom = ''] = (u.displayName || '').split('|');
    m = {
      email: u.email.toLowerCase(), prenom, nom, statut: admin ? 'accepte' : 'attente', maxApp: admin ? 3 : 2,
      cree: Date.now(), appareils: { [dev]: desc }, demandes: {}, session: dev, vu: Date.now(),
      cgu: { v: CGU_VERSION, t: Date.now() },
    };
    await setDoc(refMembre(u.uid), m);
    if (!admin) notifier(`Révisions : nouvelle inscription — ${nomComplet(m)}`, `${nomComplet(m)} (${m.email}) demande l'accès à l'appli Révisions. Accepte ou refuse dans la page Membres.`);
  } else if (m.appareils?.[dev]) {
    ecrireSansAttendre(updateDoc(refMembre(u.uid), { [`appareils.${dev}.dernier`]: Date.now(), [`appareils.${dev}.nom`]: desc.nom, session: dev, vu: Date.now() }));
    m.session = dev;
  } else if (Object.keys(m.appareils || {}).length < (m.maxApp || 2) || admin) {
    await enLigneOuPas(updateDoc(refMembre(u.uid), { [`appareils.${dev}`]: desc, session: dev, vu: Date.now() }));
    m.appareils = { ...m.appareils, [dev]: desc }; m.session = dev;
  } else {
    if (!m.demandes?.[dev]) {
      await enLigneOuPas(updateDoc(refMembre(u.uid), { [`demandes.${dev}`]: desc, vu: Date.now() }));
      notifier(`Révisions : nouvel appareil — ${nomComplet(m)}`, `${nomComplet(m)} (${m.email}) veut utiliser l'appli sur un nouvel appareil (${desc.nom}) alors que sa limite de ${m.maxApp || 2} appareils est atteinte. Valide ou refuse dans la page Membres.`);
    }
    return { etat: 'appareil', membre: m };
  }
  if (m.statut === 'bloque') return { etat: 'bloque', membre: m };
  if (m.cgu?.v !== CGU_VERSION) return { etat: 'cgu', membre: m };
  if (m.statut !== 'accepte') return { etat: 'attente', membre: m };
  return { etat: 'ok', membre: m };
}

/* ---------- surveillance : blocage, appareil retiré, session ouverte ailleurs ---------- */
let stopSurv = null;
export function surveiller(onPerte) {
  arreterSurveillance();
  const u = auth.currentUser; if (!u) return;
  const dev = idAppareil();
  stopSurv = onSnapshot(refMembre(u.uid), (s) => {
    if (s.metadata.hasPendingWrites || !s.exists()) return;
    const m = s.data();
    if (estAdmin(u)) return;
    if (m.statut === 'bloque') onPerte('bloque');
    else if (m.statut !== 'accepte') onPerte('attente');
    else if (!m.appareils?.[dev]) onPerte('appareil-retire');
    else if (m.session && m.session !== dev && !s.metadata.fromCache) onPerte('ailleurs');
  }, () => {});
}
export function arreterSurveillance() { if (stopSurv) { stopSurv(); stopSurv = null; } }
/** Acceptation (ou nouvelle acceptation) des conditions d'utilisation. */
export async function accepterConditions() {
  const u = auth.currentUser; if (!u) return;
  await updateDoc(refMembre(u.uid), { cgu: { v: CGU_VERSION, t: Date.now() } });
}
/** Reprendre la session sur cet appareil (déconnecte l'autre). */
export async function reprendreSession() {
  const u = auth.currentUser; if (!u) return;
  await updateDoc(refMembre(u.uid), { session: idAppareil(), vu: Date.now() });
}
export async function monMembre() {
  const u = auth.currentUser; if (!u) return null;
  const s = await getDoc(refMembre(u.uid)).catch(() => null);
  return s?.exists() ? s.data() : null;
}

/* ---------- contenu protégé ---------- */
const idContenu = (chemin) => chemin.replace(/^\.?\//, '').replaceAll('/', '|');
export async function lireContenu(chemin) {
  const ref = doc(db, 'contenu', idContenu(chemin));
  let s;
  try { s = await getDoc(ref); }
  catch (e) { throw new Error(e?.code === 'permission-denied' ? 'Accès au contenu refusé : ton compte n\'est pas (ou plus) autorisé.' : `Contenu indisponible (${e?.code || e?.message}).`); }
  if (!s.exists()) throw new Error(`Contenu introuvable : ${chemin}`);
  return JSON.parse(s.data().json);
}
/** Admin : publie un fichier de contenu (texte JSON) dans Firestore. */
export async function publierContenu(chemin, texte) {
  JSON.parse(texte);   // refuse un JSON invalide
  await setDoc(doc(db, 'contenu', idContenu(chemin)), { json: texte, maj: Date.now() });
}

/* ---------- progression (synchro) ---------- */
export async function lireProgression() {
  const u = auth.currentUser; if (!u) return null;
  const s = await getDocFromServer(doc(db, 'progression', u.uid));
  return s.exists() ? JSON.parse(s.data().json) : null;
}
export async function ecrireProgression(etat) {
  const u = auth.currentUser; if (!u) return;
  await setDoc(doc(db, 'progression', u.uid), { json: JSON.stringify(etat), maj: Date.now() });
}

/* ---------- administration (page Membres) ---------- */
export async function listerMembres() {
  const s = await getDocs(collection(db, 'membres'));
  return s.docs.map((d) => ({ uid: d.id, ...d.data() }));
}
export const majMembre = (uid, champs) => updateDoc(refMembre(uid), champs);
export const champSupprime = deleteField;
export const supprimerMembre = (uid) => deleteDoc(refMembre(uid));
