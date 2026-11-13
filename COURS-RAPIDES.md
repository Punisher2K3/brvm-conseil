# Cours rapides et service à la minute

## En production sur GitHub Pages

Le workflow **Vérifier les cours web toutes les cinq minutes** contrôle uniquement `https://www.brvm.org/fr/cours-actions/0`. Il est programmé du lundi au vendredi, entre 9 h et 19 h UTC (heures d'Abidjan), aux minutes 02, 07, 12, 22, 27, 32, 37, 42, 47, 52 et 57. Le passage complet horaire à :17 contrôle également les cours. Hors de cette plage, la collecte horaire reste active. Les jours fériés peuvent donc occasionner des contrôles sans changement.

Cette programmation n'est pas une garantie de délai : GitHub peut retarder ou supprimer un passage ; la construction et le déploiement prennent aussi du temps. La minute n'est pas activée sur GitHub Pages. Le navigateur recherche la dernière publication toutes les 30 secondes, ce qui reste distinct de la fréquence de collecte aux sources.

Un passage rapide lit une page de cours, pas les PDF, rapports, historiques ou sites tiers. Les robots sont vérifiés au plus une fois par jour ; les requêtes conditionnelles HTTP sont utilisées lorsque le serveur fournit ETag ou Last-Modified. Les cours, volumes, dates et symboles participent à l'empreinte du contenu ; une simple modification de l'heure de la page ne déclenche pas de publication.

Si le contenu ne change pas, aucun recalcul ni déploiement n'est effectué. Si le contenu change, le rapport est reconstruit sur le dernier bulletin validé pour conserver des fichiers cohérents, puis la publication est contrôlée. Les estimations enregistrées avant leur échéance ne sont pas réécrites. Une variation d'un cours web ne devient pas automatiquement une clôture officielle ou une nouvelle prévision enregistrée.

Les cours incomplets, invalides, futurs ou plus anciens sont refusés. Après une erreur, les dernières données sont conservées. Le délai augmente après les échecs ; HTTP 429 respecte Retry-After, et un refus d'accès suspend les essais pendant 24 heures. Une attente demandée supérieure à un an suspend les essais jusqu'à intervention. Il n'y a ni accès abonné contourné, ni collecte à la seconde.

Les publications rapide et complète partagent le verrou GitHub de publication. Un contrôle de la tête de branche empêche l'écrasement d'une modification concurrente. La collecte complète conserve ses sauvegardes quotidiennes et ses contrôles ; le passage léger n'accumule pas de sauvegardes supplémentaires.

## Service prêt à héberger à 60 secondes

Sur un serveur permanent disposant de Python et d'une copie du dépôt avec `fondamentaux.json` :

```sh
python collecter_cours_rapides.py --daemon --port 8876
```

Le service interroge la même page au plus une fois toutes les 60 secondes, sous réserve des délais d'attente imposés après un échec. Il publie uniquement deux routes locales : `/cours.json` pour le dernier instantané modifié et `/sante.json` pour le contrôle. Aucun dossier du dépôt n'est exposé. Les fichiers d'état sont stockés dans `collecte/`. Les autres routes et les origines de navigateur différentes du site GitHub sont refusées.

Ce mode **n'est pas lancé automatiquement sur l'ordinateur du propriétaire** et n'est pas raccordé au site public. Pour l'activer réellement : héberger ce processus sous supervision (par exemple systemd), placer les routes derrière un reverse proxy HTTPS sur un domaine du propriétaire, puis raccorder l'URL publique au navigateur et à sa politique CSP. Ne pas ouvrir un port HTTP brut sur Internet ni fournir de jeton GitHub dans le navigateur. La politique de confidentialité devra alors identifier le nouvel hébergeur et ses traitements techniques.

Un service à la minute ne crée pas des données à la minute si la source les publie moins souvent. Le flux seconde par seconde exige une source et une autorisation adaptées ; aucun flux de ce type n'est annoncé ici.
