# Collecte et prévisions de clôture

GitHub Actions exécute automatiquement actualisation_auto.py chaque heure, ordinateur personnel éteint. Les tâches peuvent démarrer en retard. Le navigateur consulte la dernière publication réussie.

Après les bulletins et avant la publication, collecter_ordres.py enrichit au maximum 24 séances par passage, en commençant par la plus récente. Le marqueur et les données sont conservés dans la base compressée et le cache des bulletins. Les autres archives sont reprises aux passages suivants, sans commande manuelle. Seules les séances déjà présentes dans la base sont enrichies : ceci ne constitue pas une archive exhaustive depuis la création de la BRVM.

Le tableau Marché et chaque fiche affichent la clôture estimée et la séance attendue. Date calculée au prochain jour de semaine : le calendrier des jours fériés/fermetures exceptionnelles reste à confirmer. Une prévision dont l'échéance est passée est signalée dans la fiche. Il ne s'agit pas d'une prédiction intrajournalière recalculée à chaque transaction.

Les données de carnet sont les limites résiduelles publiées en fin de séance, pas la profondeur complète ni la garantie de leur maintien le lendemain. Prix, quantités, source, date et page sont conservés. Les valeurs manquantes ne deviennent pas zéro. Les limites croisées ou non numériques sont exclues de la régression.

Trois modèles de cours sont comparés chronologiquement ; un quatrième candidat relie déséquilibre résiduel de la veille et variation de la séance suivante par régression régularisée. Il ne participe qu'avec au moins 40 observations de carnet dans la partie de sélection, 20 dans le test et un carnet courant exploitable. Les ajustements connus de fractionnement sont appliqués aux cours historiques par le moteur existant. Le déséquilibre des quantités est invariant à un changement uniforme d'unité.

Minimum de 100 variations de cours valides après la dernière rupture de série. Sélection sur les premiers 60 %, évaluation sur les derniers 40 %, sans usage du rendement futur dans l'entraînement. L'erreur moyenne, la référence cours inchangé et la couverture empirique sont affichées. La cible de couverture 80 % n'est pas une garantie. Une prévision peut être égale au cours précédent. Les prix sont des estimations statistiques, pas des limites d'ordre validées au pas de cotation.

Vérification : node test_previsions.cjs et node test_fondamentaux.cjs. Extraction contrôlée sur un PDF réel : BOC du 5 novembre 2026, 48 actions, Sonatel achat 4045 / 30 titres et vente 4050 / 5004 titres.
