/* =====================================================================
   CONDITIONS D'UTILISATION — acceptées à l'inscription (et à chaque
   nouvelle version : changer CGU_VERSION les redemande à tout le monde).
   ===================================================================== */

export const CGU_VERSION = '2026-11-06';

export const CGU_HTML = `
<p><b>Révisions</b> est une application créée par <b>Logan Degossely</b>. © 2026, tous droits réservés.</p>
<ol class="cgu-liste">
  <li><b>Accès personnel.</b> Ton compte est réservé à toi seul. Tu ne prêtes ni ne partages tes identifiants,
    et tu n'utilises l'appli que sur tes propres appareils (2 au maximum, une session à la fois).</li>
  <li><b>Usage privé.</b> L'appli sert à tes révisions personnelles dans le cadre de ta formation.
    Toute utilisation commerciale est interdite.</li>
  <li><b>Pas de copie ni de diffusion.</b> Tu ne copies pas, n'exportes pas, ne publies pas et ne transmets pas
    à des tiers le contenu de l'appli (synthèses, flashcards, exercices, schémas, corrigés) ni son code,
    y compris par captures d'écran partagées, sans l'accord écrit de l'auteur.</li>
  <li><b>Contenu des cours.</b> Les synthèses et exercices s'appuient sur les cours des professeurs, qui en restent
    propriétaires. Ils peuvent contenir des erreurs : en cas de doute, le cours du professeur fait foi.</li>
  <li><b>Données.</b> L'appli enregistre ton nom, ton adresse de l'école, les appareils utilisés (type et dates)
    et ta progression, uniquement pour gérer l'accès et synchroniser tes révisions. Seul l'auteur y a accès.
    Tu peux demander la suppression de ton compte à tout moment.</li>
  <li><b>Retrait de l'accès.</b> L'auteur peut refuser, suspendre ou bloquer un compte, notamment en cas de
    non-respect de ces conditions.</li>
  <li><b>Sans garantie.</b> L'appli est fournie gratuitement, telle quelle, sans garantie de disponibilité.</li>
</ol>
<p class="muted">Version du ${CGU_VERSION.split('-').reverse().join('/')}.</p>`;
