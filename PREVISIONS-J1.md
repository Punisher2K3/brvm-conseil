# Prévision de la prochaine clôture

Le moteur estime la clôture de la prochaine séance à partir du dernier bulletin officiel complet. Il n'estime ni le prochain prix à la seconde, ni le plus haut de demain, ni la valeur fondamentale de l'entreprise. Il ne promet pas une petite erreur : le gain face au dernier cours doit être mesuré.

## Informations utilisées

- Cours et volumes quotidiens, ramenés à l'unité actuelle pour les fractionnements vérifiés.
- Variations, tendance, volatilité, volume relatif et fréquence des cours inchangés.
- Mouvement moyen des autres actions et des autres actions du secteur à la date de départ. Ce sont des agrégats calculés sur l'échantillon disponible, pas les indices officiels pondérés de la BRVM.
- Déséquilibre et écart des limites résiduelles du bulletin, seulement si la date et les valeurs sont exploitables. Ce tableau ne constitue pas le carnet complet ; des ordres peuvent disparaître avant demain.

Un changement de date de dividende affiché ne détruit plus tout l'historique. Une référence effectivement modifiée entre deux bulletins exclut cette transition de l'apprentissage et du test. Les séances sans échange, les suspensions et les incohérences sont exclues. Une transition ne saute pas une séance manquante lorsque le calendrier des séances de marché est disponible. Les résultats sont conditionnels à ces contrôles et ne couvrent pas les jours exclus.

## Modèles et choix chronologique

Le moteur compare le dernier cours, une médiane récente, une moyenne atténuée, une tendance, un retour partiel, trois régressions régularisées (cours/volumes ; contexte marché/secteur ; limites résiduelles) et une combinaison pondérée par les erreurs passées. Les régressions normalisent leurs variables sur leurs seules données d'entraînement. Les variables manquantes ont des indicateurs de disponibilité ; les ordres inconnus ne deviennent pas une absence d'ordres.

Les premières 20 lignes servent aux variables retardées. Après 30 transitions d'apprentissage, chaque prévision candidate est calculée avec les observations précédentes. Le choix utilise jusqu'à 60 erreurs candidates déjà observées. Pour remplacer le dernier cours, il faut au moins 20 observations de sélection, une erreur récente inférieure d'au moins 2 % et un gain sur deux des trois sous-périodes de sélection. Le dernier cours reste un candidat à chaque date. Les trois sous-périodes se trouvent dans les données déjà connues et ne sont pas des tests futurs.

Le test commence à la 60e transition et exige au moins 20 prévisions évaluables. Il porte sur la procédure complète, y compris ses changements de méthode. Les résultats des candidats séparés servent au diagnostic ; ils ne permettent pas de remplacer après coup la procédure par le meilleur modèle sur le test.

Paramètres figés dans `previsions.js`, version `j1-1.0.0`. Les résultats de cette base ont été consultés pendant le développement : ils constituent une validation rétrospective exploratoire, pas une preuve indépendante de performance future. Toute optimisation ultérieure devra utiliser une validation chronologique imbriquée et une nouvelle période finale tenue à l'écart, ou être jugée sur le journal prospectif.

## Erreur et fourchette

Le site affiche l'erreur absolue moyenne en FCFA et en pourcentage du cours de départ, le repère « cours inchangé » sur les mêmes dates, le gain relatif, le 90e percentile de l'erreur, et les fréquences d'erreur inférieure à 0,5 % et 1 %. La fréquence des cours inchangés est présentée pour éviter de confondre immobilité et capacité à prévoir une hausse. Les résultats ne sont ni un rendement de portefeuille ni un rendement après frais.

La demi-largeur de la fourchette est un quantile conservateur des erreurs absolues antérieures de la procédure complète, sur 60 observations au maximum. Elle vise 80 % de couverture. La couverture effectivement observée est affichée sur les mêmes séances de test. Les marchés évoluent et les erreurs sont dépendantes : ce calcul ne fournit pas une garantie mathématique de couverture future. Les estimations décimales ne sont pas des ordres validés au pas de cotation.

## Journal avant échéance

`node evaluer_previsions.cjs` produit `previsions-calcul.json`, son équivalent navigateur et `previsions-journal.json`. Le journal conserve la première estimation d'un symbole, d'une date d'origine et d'une version du moteur, avec l'heure UTC et l'empreinte SHA-256 de la base utilisée. Une nouvelle exécution ne réécrit pas ce prix. Une estimation déjà échue n'est jamais ajoutée comme prévision enregistrée à l'avance.

Au bulletin suivant, le résultat est rattaché à la première séance réellement observée après la date d'origine. L'enregistrement doit précéder le début UTC de cette séance pour être évaluable. Les références révisées et séances non échangées ne sont pas notées comme une réussite. Les simulations historiques restent séparées. Les enregistrements réalisés localement pendant le développement ne seront pas présentés comme des prévisions déjà publiées sur le site.

La date cible exclut les week-ends. Un calendrier de fermetures peut être fourni au moteur, mais sa complétude n'est pas établie ; le site indique une date attendue. Il faut distinguer le 13 novembre prévu le 12 d'une ancienne estimation du 12 produite avec le bulletin du 11.

## Conservation et extension des archives

La collecte fusionne les séances nouvelles avec les séances validées déjà présentes. Une reconstruction ou une panne ne supprime plus l'historique antérieur à la fenêtre courante de 200 jours. L'enrichissement des limites résiduelles est conservé si le PDF est inchangé.

L'actualisation demande un lot de cinq dates ouvrées plus anciennes par passage, dans une limite mobile de 1 095 jours. Le curseur avance même si une date n'a pas de bulletin, afin de ne pas rester bloqué sur un jour fermé. Les dates sans bulletin restent signalées ; elles ne sont pas déclarées jours fériés et l'archive ne devient pas exhaustive. Les dates anciennes déjà manquantes ne sont pas redemandées à chaque passage incrémental ; un passage explicite sans `--incremental` peut les réessayer.

GitHub Actions calcule les prévisions après la collecte et avant la construction du site. Il conserve le journal dans Git. Les rapports sont recalculés à chaque publication. Les versions de données sont contrôlées avant la réutilisation d'un résultat précalculé dans le navigateur.

## Vérification

```text
python gerer_base.py restaurer
node test_previsions.cjs
node test_previsions_j1.cjs
node test_journal_previsions.cjs
python -m unittest test_collecte_historique.py
node test_fondamentaux.cjs
node test_valorisations.cjs
node evaluer_previsions.cjs
python preparer_publication.py
```

Sources : [bulletins BRVM](https://www.brvm.org/fr/bulletins-officiels-de-la-cote), [validation chronologique, Hyndman et Athanasopoulos](https://otexts.com/fpp3/tscv.html), [intervalles de prévision](https://otexts.com/fpp3/prediction-intervals.html).
