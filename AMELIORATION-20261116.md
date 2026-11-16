# Bilan et amélioration du 16 novembre 2026

Le journal contient 45 prévisions j1-2.2.0 pour la séance du 16 novembre, enregistrées le 13 novembre à 16:45 UTC. Le bulletin BFIN du 16 novembre permet leur évaluation sans reconstruction rétroactive.

Bilan de cette séance : 3 prix exacts, tous inchangés (ONTBF, ETIT et SDSC). Erreur absolue moyenne rapportée au cours de départ : 1,6891 %, contre 1,6446 % pour le maintien du dernier cours. Trois directions correctes sur cinq signaux explicites. La série d'une journée ne démontre aucun avantage prédictif.

Le nouveau bilan quotidien rend toutes les observations visibles, avec version, date d'enregistrement, prévu, réalisé, erreur, repère inchangé et signal de direction. Les prix exacts sur valeurs inchangées sont distingués de ceux sur valeurs ayant varié. Les observations restent fondées sur les bulletins officiels ; les instantanés web ne servent pas à attribuer une réussite définitive.

Candidat ajouté : régression cours/marché/volumes sur cibles atténuées. Sur les 80 dernières observations d'entraînement, centre médian et dispersion MAD avec plancher de 0,5 %, limitation des rendements d'entraînement à centre +/-3 MAD, régression régularisée (10 variables, pénalisation 100) et atténuation de moitié. Minimum 60 observations d'entraînement. Il est seulement enregistré parmi les méthodes candidates et n'entre ni dans choose(), ni dans la combinaison de production. Les paramètres n'ont pas été choisis pour corriger les résultats du 16 novembre.

La version de production j1-2.2.0 reste inchangée car ses prévisions restent identiques : comparaison de la trace précédente et nouvelle vérifiée. Le candidat a un nom distinct et devra disposer d'au moins 30 dates prospectives distinctes et d'un gain mesuré pour être soumis à revue. La date d'ajout du candidat reste identifiable via le commit et ses premières entrées dans le journal. Aucun gain de précision n'est affirmé à ce stade.

Vérification : suites test_previsions_j1, test_signaux, test_recherche, test_amelioration et test_journal_previsions ; contrôle de syntaxe de l'interface ; recalcul isolé sur 201 séances incluant le bulletin du 16 novembre. Les prévisions suivantes visent le 17 novembre (date de semaine indicative, sous réserve du calendrier officiel).

Le bilan dépend des faits publiés. Un prix central inchangé et une probabilité de baisse peuvent provenir de modèles distincts ; l'interface l'explique. Les résultats historiques reconstruits restent séparés du suivi réellement enregistré.
