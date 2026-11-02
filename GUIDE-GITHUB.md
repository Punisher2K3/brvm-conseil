# Publier BRVM Conseil sur GitHub

Le dossier `publication-github` contient seulement les fichiers à envoyer. Le dossier de travail complet conserve les PDF et les preuves ; ils ne doivent pas tous être transférés. Rien n'a encore été publié sur votre compte.

## Ce qui fonctionnera en ligne

GitHub Pages affichera le site à tous. GitHub Actions exécutera la collecte Python chaque heure, à la minute 17, puis publiera les données et les fichiers du site. Votre ordinateur pourra être éteint. Les visiteurs ne pourront ni modifier les sources ni lancer un collecteur depuis le bouton : « Actualiser » vérifiera la dernière publication disponible. Les avis restent calculés dans leur navigateur selon leur profil. L'export CSV sera téléchargé sur leur appareil.

Les cours web du jour sont distingués du bulletin complet utilisé pour les scores. Les horaires affichés des cours sont ceux de la BRVM (Abidjan, UTC). Les nouvelles transcriptions de bilans annuels nécessitent toujours une vérification humaine ; télécharger un rapport ne signifie pas que ses comptes ont été vérifiés.

## Étapes avec GitHub Desktop

1. Créez votre compte sur https://github.com si nécessaire. Installez GitHub Desktop depuis https://desktop.github.com et connectez-vous à votre compte.
2. Dans GitHub Desktop, choisissez **File > New repository**. Nom : `brvm-conseil`. Choisissez comme emplacement local le dossier `Projet BRVM conseil` du Bureau. Cela créera un sous-dossier `brvm-conseil` dans ce projet. Choisissez la branche `main` ; si une autre branche est créée, renommez-la en `main` avec **Branch > Rename**.
3. Copiez **le contenu** de `publication-github` dans ce nouveau sous-dossier `brvm-conseil`, sans ajouter un niveau `publication-github`. À la racine du dépôt, vous devez voir `index.html`, `collecter.py` et le dossier `.github` contenant `workflows/brvm-pages.yml`.
4. Dans GitHub Desktop, indiquez le résumé `Première version de BRVM Conseil`, puis **Commit to main**. Cliquez sur **Publish repository**. Décochez **Keep this code private** pour créer un dépôt public, puis publiez.
5. Sur la page du dépôt GitHub, ouvrez **Settings > Pages**. Dans **Build and deployment**, choisissez **Source: GitHub Actions**. Ne choisissez pas « Deploy from a branch ».
6. Ouvrez l'onglet **Actions**. Sélectionnez **Publier et actualiser BRVM Conseil**, puis **Run workflow > main > Run workflow**. Le premier déclenchement automatique a pu échouer avant l'activation de Pages : cette relance est normale.
7. Attendez la coche verte, puis revenez dans **Settings > Pages** et ouvrez le lien publié. Il aura généralement la forme `https://VOTRE-PSEUDO.github.io/brvm-conseil/`. Ce lien sera accessible publiquement.
8. Vérifiez que le bandeau indique **Version publique**, que les dates des cours et du bulletin sont visibles et qu'une fiche affiche ses sources. Dans Actions, les exécutions horaires suivantes doivent apparaître sans intervention sur votre ordinateur.

## Si une étape échoue

- **Aucun workflow** : vérifiez le chemin exact `.github/workflows/brvm-pages.yml` et la branche par défaut `main`.
- **Pages introuvable** : revenez à l'étape 5 puis relancez le workflow.
- **Écriture des données refusée** : dans **Settings > Actions > General > Workflow permissions**, autorisez **Read and write permissions** si la politique de votre compte le permet. Le workflow utilise uniquement le `GITHUB_TOKEN` automatique, aucun mot de passe ni jeton personnel à créer. Une protection de la branche peut également empêcher les mises à jour automatiques.
- **Collecte BRVM en échec** : ouvrez l'étape rouge dans Actions. La publication précédente reste accessible ; relancez le workflow après le rétablissement de la source. Ne remplacez pas des données manquantes par zéro.
- **Mise à jour plus tardive que prévu** : les tâches planifiées GitHub peuvent être retardées ou exceptionnellement omises. Ce n'est pas un flux boursier temps réel. Sur un dépôt public sans activité pendant 60 jours, GitHub peut désactiver la planification ; elle se réactive depuis Actions. La BRVM peut également publier son bulletin après les cours web.

## Modifier le site ensuite

Avant de publier une modification depuis GitHub Desktop, faites **Fetch origin**, puis **Pull origin** : les tâches automatiques auront pu ajouter des données au dépôt. Modifiez ou copiez seulement les fichiers de code concernés, sans écraser les données plus récentes du dépôt avec une ancienne copie locale. Faites un commit puis **Push origin**. Le workflow republiera le site.

## Sources de la procédure

- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
- https://docs.github.com/en/desktop/adding-and-cloning-repositories/adding-a-repository-from-your-local-computer-to-github-desktop

## Couverture des indicateurs

Cette version comprend 48 présentations d'entreprise, 48 capitalisations, 313 distributions officielles collectées et 23 jeux de comptes annuels 2025 vérifiés, parfois partiels. Les dix derniers exercices clos sont affichés même lorsqu'une distribution n'a pas été retrouvée. Un historique complet de dix dividendes pour chaque société n'est pas affirmé. Certaines sociétés sont récemment cotées ou n'ont pas distribué régulièrement ; l'absence d'archive ne prouve pas une absence de paiement.

Le BPA officiel est distingué du BPA implicite du PER. La qualité du business est une grille de faits et de questions, pas une note inventée sur la gouvernance ou l'avantage concurrentiel. Les extrêmes sont des clôtures sur la période archivée, pas des plus hauts/bas intrajournaliers ou sur dix ans. Le rendement corrigé de l'inflation utilise une hypothèse saisie par le lecteur, jamais une inflation officielle supposée.
