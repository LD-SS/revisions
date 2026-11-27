/* =====================================================================
   ANCIENNES ADRESSES « EXERCICES SUR SCHÉMA »
   ---------------------------------------------------------------------
   Depuis la v1.50, les exercices sur schéma sont rangés dans leur chapitre
   (onglet Exercices). Les anciens liens sont redirigés :
   #/m/<matière>/schemas            → page de la matière
   #/m/<matière>/schemas/<exercice> → #/m/<matière>/<chapitre>/exercices/sch-<exercice>
   Les outils (simulateur, générateur, atelier) sont dans le menu Outils.
   ===================================================================== */

import { matiere, chargerSchemas } from '../store.js';
import { chapitreDe } from './chapitre.js';

/** Plus d'onglets par matière : tout est dans les chapitres et dans le menu Outils. */
export function ongletsMatiere() { return ''; }

export async function vueSchemas(el, mid, eid) {
  const m = matiere(mid);
  let cible = `#/m/${mid}`;
  if (m && eid) {
    const d = await chargerSchemas(mid).catch(() => null);
    const e = d?.exercices.find((x) => x.id === eid);
    const c = e && chapitreDe(m, e);
    if (c) cible = `#/m/${mid}/${c}/exercices/sch-${encodeURIComponent(eid)}`;
  }
  location.replace(cible);
  return null;
}
