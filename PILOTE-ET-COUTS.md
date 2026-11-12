# Groupe pilote, coûts et annonces — version j1-2.1.0

La rubrique Hausse / baisse ajoute un groupe pilote, un filtre, des scénarios de coûts et un suivi des annonces. Les valeurs hors pilote conservent leurs prévisions et restent accessibles avec « Toutes les actions ». Les données disponibles ne prouvent pas encore une supériorité générale de prévision.

## Groupe pilote

Le groupe est recalculé sur les 20 dernières séances officielles connues à la date d'origine : au moins 95 % de séances avec échanges valides, montant médian échangé d'au moins 5 millions FCFA, prévision disponible pour cette même séance et absence de conflit de source courant. Un montant manquant n'est pas remplacé par zéro.

Les valeurs éligibles sont triées par montant médian décroissant, puis par symbole pour départager les égalités. Le groupe contient au maximum dix titres et trois par secteur. Il peut en contenir moins si les critères ne sont pas satisfaits. Le seuil est une règle de suivi explicite, pas une preuve de liquidité suffisante pour tout montant d'investissement.

La composition est enregistrée avant la séance avec chaque prévision. Les résultats futurs du pilote utilisent cette composition enregistrée, pas la liste sélectionnée après avoir vu les cours. Aucune performance historique de portefeuille n'est attribuée au groupe choisi aujourd'hui. Ce groupe n'est pas une liste d'achats.

## Coûts et prix accessible

Deux hypothèses modifiables sont proposées : frais par opération et écart d'exécution par opération. Les valeurs initiales de 1 % et 0,25 % sont illustratives ; elles ne constituent ni les tarifs officiels de la BRVM ni une mesure du spread de chaque titre. Les frais restent synchronisés avec le contrôle existant du site.

Pour un prix d'entrée de référence P, un prix de sortie F, des frais f et un écart s en fractions :

```text
Coût d'achat = P × (1+s) × (1+f)
Produit net de vente = F × (1-s) × (1-f)
Rendement net simulé = produit net / coût d'achat − 1
Seuil de revente = coût d'achat / [(1-s) × (1-f)]
```

Le scénario central et les deux bornes sont évalués. « Oui dans la fourchette » signifie que même sa borne basse couvre les coûts supposés ; « Non » signifie que même sa borne haute ne les couvre pas ; sinon le résultat est indéterminé. La fourchette n'est pas une borne maximale garantie des cours futurs.

Le scénario avant séance utilise le dernier cours comme référence d'entrée. Une fois le marché fermé, ce cours peut être inaccessible : le prochain prix d'ouverture peut être différent. Le site ne prétend pas qu'un achat au dernier cours serait exécutable. Une opération n'est jamais transmise.

Le journal conserve les hypothèses par défaut utilisées lors de l'enregistrement. Après réception du bulletin suivant, il peut mesurer séparément une simulation de l'ouverture suivante vers la clôture, avec le véritable cours d'ouverture publié et ces hypothèses. Cette simulation ignore encore la disponibilité réelle de la quantité, les contraintes d'exécution et une fiscalité supplémentaire éventuelle ; elle n'est pas le rendement réel d'un investisseur. Les changements d'hypothèses effectués par un visiteur ne réécrivent pas le journal.

## Situations et méthodes candidates

Les variables connues au départ décrivent cinq situations : volume au moins 1,8 fois la médiane récente, volatilité quotidienne supérieure à 2,5 %, tendance moyenne supérieure à +0,3 %, tendance inférieure à −0,3 %, ou absence de tendance marquée. Les catégories sont descriptives et leurs seuils ne sont pas des promesses de performance.

Deux candidats de prix sont ajoutés : régression sur les situations comparables (minimum 30 observations antérieures), et choix de méthode à partir des erreurs déjà observées dans une situation comparable (minimum 24 observations comparables pour cette sélection). Le modèle directionnel possède aussi une variante à situations comparables, avec score de Brier mesuré chronologiquement.

Les essais exploratoires n'établissent pas un gain général. Le moteur principal et ses dix méthodes existantes sont conservés. La régression nouvelle, le choix selon la situation et la variante directionnelle sont calculés pour comparaison, sans remplacer les résultats publiés. Un contrôle de régression local a confirmé des cours centraux et des erreurs rétrospectives identiques au moteur précédent sur les 45 actions calculables de la copie de données utilisée pour cette préparation.

Le journal enregistre les prix candidats et les probabilités directionnelles candidates avant leur échéance. Les résultats futurs comparent leurs erreurs ou leurs scores de Brier sur les mêmes dates. La procédure de suivi ne propose une revue qu'avec au moins 30 dates futures distinctes et un gain suffisant. La présence d'une méthode dans le code n'implique pas sa sélection automatique en production.

## Annonces d'entreprise

Les annonces sont classées en résultats, dividendes, opérations sur capital, avertissements, notations, gouvernance et autres. Un titre d'article n'est pas interprété comme une mesure automatique d'impact financier.

Une observation d'annonce est enregistrée seulement si sa première découverte précède la prévision et date de moins de 24 heures, et si la date de publication est celle du jour ou de la veille. Les événements anciens découverts récemment et les dates invalides sont exclus. Les doublons société / catégorie / date de publication ne créent pas plusieurs observations indépendantes. La couverture publique restant partielle, « sans annonce repérée » ne signifie pas « aucune annonce publiée ».

Après une séance future, l'étude descriptive mesure la variation suivante, le nombre de dates et de sociétés distinctes, et l'écart à des observations sans annonce repérée du même secteur et de la même séance lorsque de tels témoins existent. Les événements dont le résultat se situe après la date d'étude sont exclus. Les anciens enregistrements sans collecte d'annonces ne deviennent pas de faux témoins.

Un candidat numérique « cours + annonces » nécessite au moins 30 observations antérieures pour une catégorie, dix séances distinctes, trois sociétés et 30 observations sans annonce repérée. Il estime une correction régularisée du résidu de prévision, limitée à ±2 points de rendement. Son résultat est uniquement ajouté aux méthodes enregistrées pour comparaison future. La prévision principale n'est pas modifiée et aucun lien causal n'est établi. Le premier bilan est donc en phase de collecte, sans effet d'annonce validé.

## Validation et exploitation

Le contrôle `node test_recherche.cjs` couvre les coûts composés, les données invalides, la sélection du pilote sans données futures, la diversité sectorielle, les annonces tardives ou dupliquées, les témoins et dates de l'étude, la séparation entre candidat et prévision principale, la simulation à l'ouverture suivante et l'échappement des contenus. Il s'ajoute aux contrôles du moteur, des probabilités, de la collecte, du journal et des valorisations.

La publication conserve le workflow GitHub Actions existant. Les fichiers de données et le journal déjà présents sur la branche principale ne sont pas remplacés par une copie locale ; la nouvelle version enregistre ses prochaines prévisions pendant la construction du site.
