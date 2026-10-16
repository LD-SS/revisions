/* =====================================================================
   UTILS — petites fonctions communes à tous les modules
   ===================================================================== */

/** Échappe le texte pour l'insérer sans risque dans du HTML. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Stockage local (préfixe « revisions. », valeurs en JSON) ----------
   Toujours dans un try/catch : le stockage peut être bloqué (navigation privée…). */
const PREFIXE = 'revisions.';
export const stockage = {
  lire(cle, defaut = null) {
    try {
      const v = localStorage.getItem(PREFIXE + cle);
      return v === null ? defaut : JSON.parse(v);
    } catch { return defaut; }
  },
  ecrire(cle, valeur) {
    try { localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur)); return true; }
    catch { return false; }
  },
  supprimer(cle) {
    try { localStorage.removeItem(PREFIXE + cle); } catch { /* rien */ }
  },
};

/** Petite notification en bas de l'écran. */
export function toast(message, duree = 2600) {
  const zone = document.getElementById('toasts');
  if (!zone) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  zone.appendChild(el);
  setTimeout(() => el.remove(), duree);
}

/** Copie mélangée d'un tableau (Fisher-Yates). */
export function melanger(tab) {
  const t = [...tab];
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t;
}

/** « 1 chapitre », « 3 chapitres » (en français, 0 et 1 sont au singulier). */
export const pluriel = (n, singulier, pluriel = singulier + 's') => `${n} ${n >= 2 ? pluriel : singulier}`;

/** Date ISO → « 16 octobre 2026 ». */
export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** [3] → « 3 » ; [3,4] → « 3–4 » ; [3,5,6] → « 3, 5–6 ». */
export function pagesTxt(pages) {
  const p = [...new Set((Array.isArray(pages) ? pages : [pages]).filter((x) => Number.isFinite(x)))].sort((a, b) => a - b);
  const morceaux = [];
  for (let i = 0; i < p.length; i++) {
    let j = i;
    while (j + 1 < p.length && p[j + 1] === p[j] + 1) j++;
    morceaux.push(i === j ? `${p[i]}` : `${p[i]}–${p[j]}`);
    i = j;
  }
  return morceaux.join(', ');
}
