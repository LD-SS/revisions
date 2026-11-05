/* =====================================================================
   CONFIG — réglages de l'application (publics : rien de secret ici !)
   ---------------------------------------------------------------------
   formulaire : adresse du formulaire Formspree qui reçoit les propositions
                d'amélioration (https://formspree.io/f/xxxxxxx). Vide = boîte
                à idées désactivée. L'adresse e-mail de l'auteur n'apparaît pas.
   auteur     : prénom affiché dans la boîte à idées.
   ===================================================================== */

export const CONFIG = {
  formulaire: 'https://formspree.io/f/xyeevdjq',
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
