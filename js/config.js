/* =====================================================================
   CONFIG — réglages de l'application (publics : rien de secret ici !)
   ---------------------------------------------------------------------
   auteur : prénom affiché dans l'appli (« Logan validera ton accès »).
   admin  : adresse du compte administrateur (reçoit aussi les « Signaler une erreur »).
   ===================================================================== */

export const CONFIG = {
  auteur: 'Logan',
  // Compte administrateur : valide les inscriptions et les appareils (page Membres).
  admin: 'e20653@student.meuse-cadets.be',
  // Projet Firebase (configuration publique, ce n'est pas un secret : la sécurité
  // vient des règles Firestore et des comptes vérifiés).
  firebase: {
    apiKey: 'AIzaSyC_eOOr6-XXmB7xrEBOCkqqVDAOz5ikY6g',
    authDomain: 'revisions-meuse-cadets.firebaseapp.com',
    projectId: 'revisions-meuse-cadets',
    storageBucket: 'revisions-meuse-cadets.firebasestorage.app',
    messagingSenderId: '1003732319977',
    appId: '1:1003732319977:web:ada4791e077f71b2d67a78',
  },
};
