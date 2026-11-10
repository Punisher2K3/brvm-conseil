# Valorisation complémentaire et comparaison
Les anciennes fiches, scores et prévisions quotidiennes sont conservés. La nouvelle rubrique #valorisation est accessible depuis le menu et le détail apparaît aussi dans les fiches.

Méthodes : BPA annuel publié multiplié par PER recalculé de pairs ; variante sur PER officiels du bulletin ; actif net strict par action multiplié par P/B sectoriel ; dividendes nets actualisés en croissance stable ; flux d'équité actualisés uniquement si normalisés, positifs et vérifiés. La base ne contient actuellement pas ces flux : indisponibilité affichée. Le bénéfice ne remplace jamais un flux.

La comparaison de pairs utilise le même secteur, des comptes du même exercice et au moins deux autres valeurs. Deux pairs constituent un petit échantillon. La variante PER du bulletin précise que l'exercice du bénéfice sous-jacent n'est pas toujours confirmé. Les deux variantes PER ne sont pas toutes deux comptées dans la synthèse.

Dividendes : trois exercices consécutifs positifs, amplitude <=2, bénéfice positif et BPA couvrant le dividende médian. Hypothèses illustratives par défaut r=12 %, g=3 %, modifiables. Ce ne sont pas des paramètres de marché calibrés. Les montants nets publiés sont utilisés, sans fiscalité personnalisée. Formule D*(1+g)/(r-g). Contrôles et explications dans l'interface. Règles de fractionnement existantes conservées.

Fonds propres par action : nombre d'actions récent et antérieur ou égal à la date de prix ; capitaux propres stricts, pas de consolidation ou de ressources assimilées mélangées. Le nombre de titres doit être issu d'un instantané récent (7 jours maximum). Les banques excluent marge et dette industrielles.

Scénarios : r +/-2 points, g -/+1 point et bases comptables +/-20 % selon méthode ; la valeur centrale est une médiane descriptive, pas une valeur vraie. Fourchette de sensibilité, pas un intervalle de probabilité. Dispersion des estimations centrales >50 % signalée comme forte divergence. Les méthodes relatives ne sont pas indépendantes.

Comparaison : critères communs, même exercice et périmètres compatibles pour les données comptables ; minimum trois critères comparables et avantage net de deux critères pour une préférence de long terme. Dette et marge industrielles exclues pour les banques. Liquidité analysée séparément ; aucune supériorité de rendement à court terme n'est déduite du volume. Croissance, ROE, dette et PER ne constituent pas un classement universel.

Calculs automatiques dans le navigateur après chaque nouvelle publication de données sur GitHub. Aucun abonnement IA nécessaire. Tests : node test_valorisations.cjs en complément des suites existantes.
