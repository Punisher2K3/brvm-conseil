# Signaux quotidiens et amélioration continue

La rubrique « Hausse / baisse » est placée en haut du site, avant les autres analyses. Elle distingue hausse envisagée, risque de baisse et signal incertain. Aucun titre n'est ajouté pour remplir une liste vide. Le système ne peut pas affirmer qu'une entreprise va monter ou baisser avec certitude.

## Données effectivement exploitées

La BRVM reste la source principale pour les bulletins, cours, volumes, limites résiduelles et comptes vérifiés. Les pages de communiqués, notations et convocations complètent les publications déjà collectées. Sika Finance fournit les historiques OHLC (ouverture, plus haut, plus bas, clôture), volumes et liens de publications et d'actualités publiques. Les cours de plusieurs rediffuseurs proviennent souvent du même marché : ce ne sont pas des confirmations statistiquement indépendantes.

Lors de la préparation du 12 novembre 2026, 8 966 observations Sika Finance ont été collectées pour 48 valeurs, avec des dates remontant jusqu'à février 2026 selon les titres. 6 660 clôtures de chevauchement concordent avec la base officielle ajustée dans la tolérance de 1 FCFA ou 0,05 %. Quatre écarts anciens sur SAFCA sont conservés comme divergences ; aucune correction d'opération sur titres n'est inventée pour les faire disparaître. 85 liens d'actualité et de publication sont archivés. Ces nombres décrivent cette préparation et évolueront.

Les historiques Sika Finance antérieurs à la base officielle ne sont ajoutés qu'avec au moins 30 dates de chevauchement concordantes, aucune divergence sur la valeur et une jonction de série sans saut supérieur à 16 %. Leur cohérence est contrôlée sur le chevauchement ; les séances anciennes hors chevauchement ne sont pas individuellement certifiées par la BRVM. Les cours officiels restent prioritaires. Une révision tierce détectée est archivée et exclue des variables OHLC.

Richbourse a été consulté sur ses pages publiques, mais la collecte automatique testée reçoit HTTP 403, y compris pour robots.txt. Le collecteur conserve ce statut, cesse les requêtes vers ce domaine pendant le passage et ne contourne pas le refus. Les données Premium, les zones privées et le carnet d'ordres complet ne sont pas accessibles par cette collecte. Un export autorisé ou un accès fourni par l'éditeur serait nécessaire pour lever ce manque. Le code ne prétend donc pas récupérer « toutes » les données des trois sites.

Les contenus d'articles ne sont pas reproduits : seuls le titre, le lien, la provenance, la date publiée lorsqu'elle est disponible et la date de première observation sont conservés. Les publications ne sont pas réinjectées artificiellement dans un backtest antérieur à leur découverte. Seules les nouvelles publiées dans les 14 jours précédents sont présentées comme contexte récent. Les dates locales d'articles dont le fuseau n'est pas confirmé sont signalées dans les données.

## Modèle de direction

Le modèle distingue baisse de plus de 0,5 %, stabilité dans ±0,5 % et hausse de plus de 0,5 %. Les trois estimations totalisent 100 %. Il compare des fréquences récentes régularisées à des voisins historiques utilisant les variables connues à la date de départ, dont les amplitudes quotidiennes rapprochées. La sélection utilise seulement les scores de Brier antérieurs ; le candidat conditionnel doit réduire ce score récent d'au moins 2 % sur au moins 20 observations.

Un biais directionnel n'est affiché que si son estimation dépasse 45 % et domine les deux autres issues d'au moins 10 points. Ce seuil désigne une issue dominante et ne signifie pas que sa probabilité réelle a été prouvée. Un biais sous 50 % peut rester l'issue individuelle dominante devant la stabilité et l'autre direction. Les cartes indiquent explicitement « signal fragile » tant que l'appui historique n'est pas établi.

L'appui historique exige au moins 30 signaux du même sens, une borne descriptive de Wilson supérieure à 50 %, un gain probabiliste sur le repère et une précision supérieure au choix majoritaire sur les mêmes dates. Les dépendances entre séances, le faible échantillon et la calibration peuvent limiter cette lecture. Le site affiche les scores de Brier, la fréquence de réussite et l'écart de calibration ; aucun de ces chiffres n'est une garantie de gain.

Le prix central et la direction sont deux sorties différentes : le cours inchangé peut rester le meilleur prix central tandis qu'une classe de baisse est la plus fréquente. Les actualités nouvellement collectées servent à vérifier le contexte, pas à appliquer une hausse ou une baisse arbitraire au prix. L'apprentissage d'un effet d'annonce reste à valider après accumulation d'un historique correctement horodaté.

## Boucle automatique déjà implémentée

1. Collecter les bulletins officiels, puis les pages publiques complémentaires, sans bloquer les données officielles si un éditeur tiers est indisponible.
2. Conserver les origines, dates et empreintes ; rapprocher les chevauchements et exclure les divergences.
3. Calculer la prévision de prix et les trois issues pour la prochaine séance attendue.
4. Enregistrer avant l'échéance la première prévision, les probabilités et les prix de chaque méthode candidate, avec l'empreinte des entrées et du code.
5. Après la séance, noter les erreurs, le score de Brier, le sens observé, le repère du dernier cours et la couverture des intervalles.
6. Suivre chaque action sur les 20 dernières séances, comparer aux 20 précédentes et suspendre le signal directionnel si l'erreur moyenne a augmenté de plus de 50 % sur ces deux fenêtres complètes.
7. Signaler une méthode candidate à réexaminer seulement après au moins 30 dates futures distinctes et un gain d'erreur d'au moins 5 % face à la méthode publiée et au dernier cours, sur les mêmes observations. Ce signal de revue ne prouve pas que le candidat restera supérieur. Les nouvelles versions ne sont pas automatiquement déployées à partir du seul classement rétrospectif.

Le compteur compte des séances distinctes : 45 actions évaluées le même jour ne représentent pas 45 journées de validation. Chaque version du moteur possède son propre suivi. Les prévisions déjà enregistrées ne sont pas réécrites après une nouvelle collecte. Les évaluations rétrospectives consultées pendant le développement restent exploratoires et sont séparées du suivi futur.

## Extension progressive et exploitation

La collecte officielle conserve les séances et étend l'historique par lots de cinq dates ouvrées. Le collecteur complémentaire rafraîchit toutes les valeurs lors d'un nouveau bulletin, puis parcourt 12 valeurs par passage ; les pages de synthèse et d'actualités ont un cache d'une heure. Deux tranches d'archives supplémentaires de 90 jours maximum sont demandées par passage, dans une limite mobile de trois ans. Les dates sans données avancent le curseur et les valeurs ayant atteint la limite ne bloquent pas les autres.

GitHub Actions exécute ces opérations avant le calcul et la publication ; les archives compressées et le journal sont conservés dans Git. Les visites du site n'effectuent pas directement ces collectes. Le délai d'un ordonnanceur ou d'une source peut retarder les données. La révision des prévisions participe au contrôle des mises à jour du navigateur, même lorsque les cours du bulletin n'ont pas changé.

La prochaine amélioration utile sera un historique horodaté de plusieurs mois de signaux et de nouvelles réellement observés. Ensuite, on pourra tester l'effet des annonces, des régimes de marché et de la liquidité, avec une période finale de test indépendante. Ajouter des méthodes ou des données sans démontrer leur gain n'est pas un critère suffisant pour les activer.

Sources : [historiques Sika Finance](https://www.sikafinance.com/marches/historiques/SNTS.SN), [publications Richbourse](https://www.richbourse.com/common/actualite/index), [communiqués BRVM](https://www.brvm.org/fr/emetteurs/type-annonces/communiques), [validation chronologique](https://otexts.com/fpp3/tscv.html), [scores et calibration](https://scikit-learn.org/stable/modules/calibration.html).
