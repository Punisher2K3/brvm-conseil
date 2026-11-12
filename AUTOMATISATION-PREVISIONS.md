# Collecte et prévisions de clôture

Le moteur J+1, ses tests, le journal avant échéance et la collecte progressive sont documentés dans [PREVISIONS-J1.md](PREVISIONS-J1.md). Les descriptions antérieures de sélection fixe sur 60/40 et de coupure de tout l’historique au changement de dividende ne décrivent plus cette version.

GitHub Actions collecte les données chaque heure, calcule les prévisions, conserve le journal et construit le site, sans dépendre de l’ordinateur personnel. Les retards de programmation et erreurs de collecte restent possibles. Les dates et la qualité des données sont affichées.
