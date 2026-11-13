# Moteur j1-2.2.0 — 13 novembre 2026

Le modèle peut désormais exploiter le prix moyen réellement échangé (valeur / volume), l'écart ouverture–clôture et le volume relatif. Les champs absents ou incohérents ne sont pas remplacés par des données inventées. Au moins 40 observations valides sont requises pour calculer cette régression régularisée.

La sélection des méthodes est plus prudente : une alternative au cours inchangé doit réduire l'erreur absolue d'au moins 5 % sur les observations précédentes et gagner dans chacun des trois sous-blocs chronologiques. Ces contrôles se répètent à chaque date sans consulter le rendement suivant. Les méthodes liées à la situation restent expérimentales.

## Résultat exploratoire

`node benchmark_amelioration.cjs` compare la référence j1-2.1.0 archivée dans `previsions_reference_2_1.cjs` au nouveau moteur, sur les mêmes données officielles. L'évaluation porte sur les 30 dernières séances, du 2 octobre au 12 novembre 2026 : 1 347 couples action–séance sur 45 titres. Chaque prédiction n'utilise que les observations antérieures à sa cible ; la base historique actuellement disponible peut néanmoins contenir des corrections découvertes ultérieurement. Ce test est exploratoire et ne constitue pas un résultat futur indépendant de la recherche.

| Erreur absolue moyenne, en pourcentage du cours initial | Résultat |
| --- | ---: |
| Ancien moteur | 1,62336 % |
| Nouveau moteur | 1,61775 % |
| Repère « cours inchangé » | 1,61642 % |

L'amélioration relative face à l'ancien moteur est d'environ 0,35 %. Le nouveau moteur ne bat pas globalement le repère cours inchangé. Il ne faut donc pas annoncer un avantage prédictif établi, une marge d'erreur très petite ou un taux de réussite garanti. Le nouveau candidat a été sélectionné sur huit couples action–séance dans cet audit. La direction conserve son moteur et ses seuils ; aucun signal supplémentaire n'est forcé.

## Résultats réels et conservation

Le rapport expose maintenant un bilan séparé pour chaque version : nombre de prévisions réellement évaluées, séances distinctes, prix exactement atteints, erreur en pourcentage, comparaison au cours inchangé et réussite des directions explicites. Les observations sans échange ou incohérentes restent exclues suivant les règles du journal.

Une mise à jour du moteur ne remplace jamais une estimation déjà enregistrée pour une échéance atteinte : même une ancienne version conserve son prix, sa fourchette, son modèle et son signal. Les diagnostics historiques du moteur actuel sont distincts de la version indiquée pour la prévision conservée. Les anciennes versions restent dans le bilan ; le suivi de j1-2.2.0 commence avec ses nouvelles prévisions enregistrées avant leur échéance. Le bulletin définitif est nécessaire pour noter un résultat ; un cours web provisoire ne suffit pas.

Les tests `test_amelioration.cjs` et `test_previsions_j1.cjs` contrôlent notamment l'absence de fuite future, les données manquantes ou aberrantes, la conservation des prévisions échues et l'évaluation par version.
