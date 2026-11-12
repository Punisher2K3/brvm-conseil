# Publications officielles BRVM

La collecte étendue ajoute les annonces émetteurs, projets de résolution, franchissements de seuil, dirigeants, événements sur titres, avis de marché, bulletins statistiques et rapports. Le parcours remonte progressivement les pages anciennes, dans un périmètre débutant en 2024 pour les annonces datées. Une rubrique « Données officielles BRVM » présente les références et la couverture ; chaque fiche d’action propose ses documents associés.

`collecter_brvm.py` respecte robots.txt et un délai minimal de dix secondes entre les requêtes réseau. Les pages sont mises en cache pendant une journée. Chaque passage dispose d’un budget, conserve le curseur de pagination et archive une sélection de PDF ; les lots suivants reprennent le travail. Les émetteurs sont revisités par rotation pour dépasser les huit rapports du catalogue initial. Le nombre de documents repérés est distinct du nombre de PDF effectivement archivés.

Les PDF sont archivés dans `collecte/brvm-officiel/` avec empreinte SHA-256, taille, nombre de pages et date d’extraction. Les lignes de chiffres sont conservées comme candidats, avec leur numéro de page. Elles ne sont pas injectées automatiquement dans les comptes validés : unité, exercice, périmètre consolidé ou individuel et comparabilité doivent être vérifiés. Le site public publie les liens et métadonnées, sans recopier le texte intégral des rapports.

Les annonces nouvelles peuvent rejoindre le suivi existant. Les dates de première observation sont préservées et les événements anciens découverts aujourd’hui ne deviennent pas des informations connues dans un test passé. Une date d’effet d’opération sur titres n’est jamais utilisée comme date de publication. Les véhicules de titrisation sont distingués des actions portant un nom similaire.

`collecter_indices.py` extrait les indices officiels et l’activité des premières pages des bulletins déjà archivés, avec dates et sources. Les anciennes et nouvelles séries sectorielles sont séparées. Les instantanés du site web restent distincts des chiffres définitifs des bulletins. Aucune interpolation des séances absentes.

Le calendrier officiel des fermetures est également collecté. Les dates mobiles marquées provisoires sont affichables mais ne sont pas assimilées à des fermetures confirmées dans le moteur. La date du prochain cours tient compte des fermetures fixes collectées.

Les nouvelles archives quotidiennes sont ajoutées sans remplacer les séances existantes. Les erreurs de téléchargement ou de format sont conservées pour reprise, distinctement d’une absence HTTP 404/410. L’historique de plusieurs années reste en constitution ; les flux détaillés temps réel et l’historique complet proposés sur demande ne sont pas accessibles par cette collecte publique.

La construction GitHub Pages exécute les collecteurs, contrôles et exports à chaque actualisation. Aucun gain de précision n’est revendiqué du seul fait d’avoir collecté davantage de documents. Les méthodes candidates restent comparées aux résultats réellement observés.
