# Observation de la séance en cours

Les cours publics de la BRVM sont différés de 15 minutes. Le module ne prétend pas suivre chaque transaction et ne transforme pas les cours en séance en clôtures définitives.

Archivage compact de points (date de séance, heure officielle, date de collecte, cours et volume par action). Déduplication des points identiques ; les contenus différents publiés au même horodatage sont conservés. Limite : 400 instantanés sur au plus 10 séances. Pas de reconstruction des mouvements entre points. Les deux observations initiales du 17 novembre (13:02 et 14:30, Abidjan) proviennent d'une copie GitHub déjà collectée et de la collecte locale officielle, avec leurs dates de collecte.

Le point de publication commun des fondamentaux conserve l'instantané précédent et le nouvel instantané, lors des collectes horaires comme des contrôles rapides. Aucun service tiers ni abonnement ajouté. La fréquence planifiée reste celle des workflows existants ; retard de GitHub possible.

Le bilan de séance compare les cours aux dernières clôtures valides strictement antérieures à la date de l'instantané. Il n'utilise pas le champ 'cours veille' d'un instantané intrajournalier pour reconstruire cette référence. Seules les actions ayant échangé et une clôture comparable contribuent au nombre de hausses/baisses/inchangées.

L'évolution depuis la première observation conservée est distinguée de la variation depuis la veille. Exemple observé le 17 novembre : SETAO peut remonter entre deux instantanés tout en restant sous sa clôture précédente. Les volumes publiés sont conservés ; un recul entre points est signalé comme révision possible, pas comme un volume négatif de transactions.

Ces observations n'alimentent pas automatiquement un nouveau modèle de prévision intrajournalier. Les prévisions initiales du journal sont conservées. Il faut davantage de séances horodatées et une validation avant d'affirmer un gain de précision intrajournalier.

Tests : python -m unittest test_instantanes_marche.py ; node test_evolution.cjs ; contrôles de syntaxe et de publication habituels.
