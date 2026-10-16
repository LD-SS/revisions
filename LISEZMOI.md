# Révisions — bachelier électromécanique

Application web de révision : synthèses de cours, flashcards et (bientôt) exercices,
examens blancs et planning. Fichiers statiques uniquement, publiables sur GitHub Pages,
installable sur PC (PWA) et utilisable hors ligne.

## Tester sur ton PC

Double-clique sur **`lancer-local.bat`**. Une fenêtre noire s'ouvre (le serveur local) et le
navigateur affiche l'appli sur `http://localhost:8080`. Pour arrêter, ferme la fenêtre noire.

> Ouvrir `index.html` par double-clic ne fonctionne pas : le navigateur bloque alors le
> chargement des modules JavaScript et du dossier `content/`.

## Organisation des fichiers

```
index.html              structure de la page
manifest.webmanifest    installation (PWA)
sw.js                   copie hors ligne (ajouter ici tout nouveau fichier JS/CSS)
css/styles.css          styles, thèmes clair et sombre
lib/katex/              affichage des formules (copie locale, licence MIT)
icons/                  icônes de l'appli
content/                CONTENU PUBLIÉ
  index.json            matières et chapitres
  <matiere>/<ch>.json   un fichier par chapitre
js/
  app.js                démarrage, navigation, thème
  utils.js              fonctions communes
  store.js              chargement du contenu
  matieres.js           profils de matière, types de blocs
  icones.js             icônes SVG
  rendu.js              texte enrichi + formules
  synthese.js           affichage des synthèses
  flashcards.js         lecteur de flashcards
  vues/                 pages (accueil, matière, chapitre, paramètres)
```

## Ajouter une matière (à la main, avant l'étape 2)

Dans `content/index.json`, ajouter une entrée dans `matieres` (sans les commentaires `//`) :

```jsonc
{
  "id": "meca",                     // identifiant court, sans espace ni accent
  "nom": "Mécanique appliquée",
  "court": "Méca",                  // nom affiché dans la barre du haut (facultatif)
  "couleur": "#b45309",
  "icone": "engrenage",             // voir ICONES_MATIERES dans js/icones.js
  "profil": "generique",            // maths | dessin | electricite | generique
  "ordre": 4,
  "chapitres": []
}
```

À l'étape 2, le mode créateur permettra de le faire depuis l'appli.

## Format d'un chapitre

Voir les exemples dans `content/` et l'en-tête de `js/synthese.js`. Dans les textes :
`**gras**`, `*italique*`, `$formule LaTeX$`, `$$formule centrée$$`, lignes `- ` pour les listes.
Chaque bloc indique sa page source : `"pages": [4]`.

## Droits d'auteur

Les PDF de cours ne sont **jamais** publiés : seuls les synthèses et exercices générés le sont.
