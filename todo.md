# Project TODO

- [x] Définir le modèle de données pour les produits, fournisseurs, mouvements, alertes et journal d’audit.
- [x] Mettre en place les procédures métier sécurisées et les contrôles de rôles admin/opérateur.
- [x] Ajouter un modèle persistant d’alertes de stock avec statut, seuil et horodatage.
- [x] Construire le tableau de bord sombre avec indicateurs, tendances, alertes et mouvements récents.
- [x] Créer le catalogue de produits avec recherche, filtres et opérations d’ajout, modification et suppression.
- [x] Créer la gestion des mouvements d’entrée, sortie et ajustement avec traçabilité.
- [x] Créer la gestion des fournisseurs et leur historique d’approvisionnements.
- [x] Afficher les alertes de seuil minimum et les notifications visuelles associées.
- [x] Créer le journal horodaté des opérations et l’écran de gestion des utilisateurs.
- [x] Garantir une interface responsive avec sidebar et navigation mobile.
- [x] Écrire et exécuter des tests automatisés des règles métier.
- [x] Vérifier le rendu desktop et mobile, puis corriger les défauts relevés.
- [x] Ajouter des filtres métier au catalogue par catégorie, fournisseur et statut de seuil.
- [x] Afficher un historique détaillé des approvisionnements sur chaque fiche fournisseur.
- [x] Ajouter des tests Vitest des règles métier de mouvement et d’alerte de stock.
- [x] Afficher l’historique complet des approvisionnements par fournisseur, sans tronquer les entrées liées.
- [x] Définir les rôles admin, vendeur, agent commercial et caissier avec leurs capacités d’authentification.
- [x] Étendre les produits avec prix d’achat, prix de vente détail et prix de vente gros.
- [x] Ajouter les clients ordinaires et grossistes avec application automatique de la grille tarifaire.
- [x] Créer le point de vente, les ventes et les factures imprimables avec rattachement des agents.
- [x] Créer les inventaires et les ajustements de stock issus du comptage.
- [x] Ajouter les paramètres d’affectation par défaut des agents sur une vente.
- [x] Créer les règles de rémunération fixe, commission sur chiffre d’affaires et commission sur bénéfice net.
- [x] Créer le suivi des rémunérations dues et des paiements des agents.
- [x] Étendre les tests métier aux prix, commissions, ventes et effets de stock.
- [x] Calculer et afficher le solde de rémunération dû par bénéficiaire sur une période de paie explicite.
- [x] Ajouter des tests couvrant les scénarios de vente et d’inventaire de bout en bout.
- [x] Tester de bout en bout la validation d’un inventaire, l’ajustement du stock et le mouvement associé.
- [x] Définir et calculer les indicateurs de chiffre d’affaires, marge, factures, stock, inventaires et paie.
- [x] Reconcevoir le tableau de bord en cockpit commercial avec priorités et actions rapides.
- [x] Vérifier le rendu responsive du nouveau tableau de bord et les données agrégées.
- [x] Créer un onglet Paramètres accessible aux administrateurs.
- [x] Ajouter les thèmes sombre et clair bleu à l’application.
- [x] Ajouter une préférence de devise USD, EUR ou XOF et l’appliquer aux montants affichés.
- [x] Tester la persistance et le rendu des préférences sur desktop et mobile.
- [x] Vérifier le thème clair bleu et les devises USD, EUR et XOF dans l’interface après bascule.
- [x] Vérifier la conservation du thème et de la devise après rechargement de l’application.
- [x] Ajouter un test d’intégration du parcours Paramètres couvrant thème, USD, EUR, XOF et conservation après rechargement.
- [x] Corriger et faire réussir le test navigateur du parcours Paramètres avec thème et devise persistants.
- [x] Exécuter un parcours E2E utilisateur complet : clics sur thèmes et devises, sauvegarde puis rechargement avec montants mis à jour.
- [x] Permettre à l’administrateur de créer un agent de type vendeur avec identifiants de connexion.
- [x] Configurer le salaire et les commissions directement à la création de tout agent.
- [x] Ajouter la modification et la suppression sécurisée des agents et vendeurs.
- [x] Rendre les champs de rémunération conditionnels au système sélectionné.
- [x] Tester les règles de création, mise à jour et suppression des agents enrichis.
- [x] Couvrir les mutations de création, mise à jour et désactivation des agents et vendeurs.
- [x] Couvrir la connexion vendeur valide, le mot de passe invalide et la désactivation du compte.
- [x] Ajouter un aperçu détaillé de facture avec lignes, client, agents et totaux.
- [x] Ajouter un partage de facture avec lien contrôlé ou copie de lien.
- [x] Ajouter une impression de facture avec une mise en page dédiée.
- [x] Tester les actions d’aperçu, de partage et d’impression des factures.
- [x] Renvoyer les noms et rôles du vendeur, agent commercial et caissier dans le détail de facture.
- [x] Afficher les intervenants de vente clairement dans l’aperçu et l’impression de facture.
- [x] Couvrir par test le détail de facture avec intervenants et total.
- [x] Corriger le déclenchement de l’impression de facture dans le navigateur.
- [x] Remplacer la copie de lien par une ouverture d’aperçu de facture dédiée.
- [x] Tester l’impression et l’ouverture de l’aperçu depuis le registre de factures.
- [x] Ajouter un choix de format d’impression A4 ou ticket de caisse.
- [x] Construire une mise en page détaillée A4 et une mise en page compacte pour ticket.
- [x] Tester les deux formats d’impression dans le navigateur.
- [x] Ajouter les réglages de logo, raison sociale, adresse, téléphone, e-mail et mentions d’entreprise.
- [x] Permettre à l’administrateur de modifier l’identité de l’entreprise depuis les paramètres.
- [x] Afficher l’identité configurée sur les impressions A4 et ticket de caisse.
- [x] Tester la sauvegarde et le rendu de l’identité entreprise sur les factures.
- [x] Corriger la route de l’onglet Paramètres afin de rendre le formulaire d’identité accessible.
- [x] Vérifier le parcours Paramètres complet et la présence du logo configuré dans l’aperçu de facture.
- [x] Vérifier l’upload via le formulaire Paramètres et la persistance réelle de l’identité sauvegardée jusqu’à la facture.
- [x] Vérifier en intégration que le logo et les coordonnées sauvegardés sont relus par les procédures de réglages.
- [x] Ajouter le stockage sécurisé d’une image de signature ou de cachet.
- [x] Ajouter le chargement de signature ou cachet dans les paramètres d’entreprise.
- [x] Afficher la signature ou le cachet sur le format d’impression A4 uniquement.
- [x] Tester l’upload, la persistance et l’exclusion du ticket de caisse.
- [x] Vérifier la relecture intégrée de la signature sauvegardée et son absence dans le ticket de caisse.
- [x] Ajouter un réglage d’affichage de la mention Bon pour accord sur facture A4.
- [x] Ajouter un réglage d’alignement gauche, centre ou droite de la signature ou du cachet.
- [x] Afficher la mention et l’alignement configuré uniquement sur les factures A4.
- [x] Tester les réglages d’accord et d’alignement ainsi que l’exclusion du ticket.
- [x] Appliquer visuellement l’alignement gauche, centre ou droite dans l’aperçu A4 de la facture.
- [x] Répartir les réglages Apparence, Devise et Identité dans des sous-onglets de la page Paramètres.
- [x] Conserver les opérations d’enregistrement et de téléversement dans chaque sous-onglet.
- [x] Vérifier la navigation responsive des sous-onglets Paramètres.
- [x] Remplacer les sous-onglets horizontaux par des liens verticaux de catégories.
- [x] Conserver le contenu et les actions de chaque catégorie dans la navigation verticale.
- [x] Vérifier le comportement responsive des liens verticaux sur mobile et ordinateur.
- [x] Vérifier visuellement les liens verticaux Paramètres sur mobile et corriger tout débordement éventuel.
- [x] Actualiser le serveur puis reconfirmer l’absence d’erreur runtime et le rendu mobile des liens verticaux.
- [x] Ajouter une barre de recherche au-dessus des liens verticaux de paramètres.
- [x] Filtrer les rubriques et mots-clés de réglages, avec un état sans résultat utile.
- [x] Tester la recherche de paramètres sur desktop et mobile.
- [x] Créer des pages dédiées pour Apparence, Devise et Identité & impression.
- [x] Réduire la page Paramètres à un index de liens vers ces pages.
- [x] Supprimer l’entrée Utilisateurs du menu et retirer ses routes et composants dépendants.
- [x] Remplacer les libellés XOF par FCFA dans toute l’interface concernée.
- [x] Vérifier les liens, la navigation mobile et l’absence de références Utilisateurs.
- [x] Actualiser le serveur puis revalider les pages dédiées, FCFA et l’absence de références Utilisateurs.
- [x] Définir les archives de sauvegarde, leur conservation et la restauration contrôlée des données métier.
- [x] Ajouter l’export local et l’import de restauration des sauvegardes.
- [x] Ajouter une planification quotidienne par défaut, ajustable par l’administrateur.
- [x] Reporter la connexion et la validation Google Drive jusqu’à la fourniture des secrets OAuth, conformément à la demande de l’utilisateur.
- [x] Créer une page de sauvegarde avec historique, exécution manuelle et paramètres de fréquence.
- [x] Tester la création, le téléchargement, la restauration et la planification des sauvegardes.
- [x] Finaliser l’interface et les tests de sauvegarde locale, avec Google Drive explicitement en attente.
- [x] Permettre à l’administrateur de modifier le type d’un agent existant.
- [x] Ajouter un retour explicite vers l’index Paramètres sur chaque page de réglage dédiée.
- [x] Créer une page dédiée aux réglages POS et à l’impression ticket.
- [x] Ajouter un historique lisible des changements de paramètres.
- [x] Remplacer tous les libellés visibles XOF par FCFA, y compris dans les montants et réglages.
- [x] Ajouter des tests d’intégration couvrant création d’archive, téléchargement et politique de rétention.
- [x] Ajouter un test d’intégration de restauration d’archive avec garde-fou de confirmation.
- [x] Ajouter des tests du callback planifié de sauvegarde et de la configuration Heartbeat.
- [x] Vérifier le flux de sauvegarde locale sur mobile et desktop, avec un parcours E2E complet.
- [x] Tester la génération de lien de téléchargement et la suppression des archives au-delà de la rétention.
- [x] Tester le garde-fou de confirmation RESTAURER au niveau du routeur de sauvegarde.
- [x] Tester le callback planifié et les actions d’activation, de mise à jour et de suspension Heartbeat.
- [x] Étendre le parcours E2E de sauvegarde au téléchargement et confirmer son comportement sur mobile.
- [x] Tester la génération réelle d’un lien de téléchargement par le routeur de sauvegarde.
- [x] Tester le rejet API d’une restauration sans confirmation RESTAURER.
- [x] Tester la mise à jour d’une tâche Heartbeat existante après changement de fréquence.
- [x] Exécuter un parcours E2E mobile interactif de sauvegarde, restauration et planification.
- [x] Tester la génération réelle du lien signé de téléchargement depuis le service de stockage.
- [x] Exécuter un parcours mobile avec les vraies routes de sauvegarde, sans interception complète des API.
- [x] Exécuter un parcours mobile réel de création, téléchargement et planification, sans restauration destructive.
- [x] Séparer les parcours POS, création de facture et encaissement dans l’interface et les services métier.
- [x] Ajouter le règlement intégral ou partiel avec moyen de paiement et solde restant.
- [x] Construire un écran d’encaissement commun avec total, paiements, agents, validation et annulation.
- [x] Refaire le POS sans client obligatoire, avec panier flottant et accès direct à l’encaissement.
- [x] Refaire la création de facture avec client obligatoire, agents et actions Enregistrer, Imprimer, Encaisser, Annuler.
- [x] Ajouter un sélecteur de produits par recherche et action de scan à la création de facture.
- [x] Tester les flux POS, facture, encaissement intégral et partiel sur desktop et mobile.
- [x] Déclencher réellement l’impression A4 après le bouton Imprimer de la création de facture.
- [x] Couvrir en E2E un encaissement POS intégral et une facture avec encaissement partiel.
- [x] Couvrir sur mobile l’ouverture du panier, l’encaissement et l’ajout produit facturé par recherche et scan.
- [x] Couvrir en E2E mobile la recherche de produit puis l’ajout par scan dans le sélecteur de facture.
- [x] Ajouter des remises par ligne et par facture aux calculs de vente, totaux et impressions.
- [x] Ajouter un lecteur de code-barres par caméra mobile avec repli vers la saisie manuelle.
- [x] Permettre l’encaissement différé depuis les factures au statut partiel ou à encaisser.
- [x] Tester les remises, le scan et les encaissements différés sur desktop et mobile.
- [x] Valider en E2E desktop les remises, le repli scan manuel/caméra et l’encaissement différé.
- [x] Vérifier en E2E les totaux remisés dans l’aperçu et l’impression de facture.
- [x] Relancer les validations desktop et mobile après l’extension des couvertures de vente.
- [x] Vérifier les montants exacts des remises ligne, facture et total dans l’aperçu et l’impression A4.
- [x] Relancer le parcours E2E mobile complet après les dernières améliorations de remises et d’impression.
- [x] Vérifier sur mobile l’aperçu de facture avec les montants exacts des remises ligne et facture.
- [x] Refaire le panier POS en feuille montante mobile inspirée du modèle fourni, avec liste, quantités, total et action d’encaissement.
- [x] Imposer le règlement intégral dans l’encaissement POS et conserver Intégral/Partiel uniquement pour les factures.
- [x] Ne présélectionner aucun moyen de paiement dans les écrans d’encaissement.
- [x] Auto-remplir le montant restant sur les moyens de paiement sélectionnés en règlement intégral, sans auto-remplissage partiel.
- [x] Désactiver la validation lorsque la répartition intégrale ne correspond pas exactement au total à encaisser.
- [x] Ajouter l’activation ou désactivation des moyens de paiement dans les réglages POS.
- [x] Tester les règlements POS et facture, la répartition automatique et les moyens de paiement désactivés sur desktop et mobile.
- [x] Exécuter un test navigateur desktop et mobile couvrant POS intégral, facture partielle, répartition multiple, total incohérent et moyens désactivés.
- [x] Ajouter un test d’intégration serveur prouvant le rejet d’un moyen de paiement désactivé lors de l’encaissement.
- [x] Exécuter un test navigateur desktop et mobile couvrant facture partielle, répartition sur plusieurs moyens, blocage d’un total incohérent et masquage des moyens désactivés.
- [x] Ajouter un test d’intégration de transactions.checkout prouvant le rejet BAD_REQUEST d’un moyen désactivé configuré dans saleSettings.
- [x] Exécuter un test navigateur mobile couvrant la répartition multi-moyens, le blocage du total incohérent et le masquage d’un moyen désactivé dans l’encaissement facture.
- [x] Générer un reçu POS détaillé après un encaissement réussi et déclencher automatiquement son impression.
- [x] Tester le reçu POS et son impression automatique sur desktop et mobile.
- [x] Exécuter un test navigateur desktop validant l’ouverture, le contenu détaillé et l’impression automatique du reçu POS.
- [x] Exécuter un test navigateur mobile validant le reçu POS automatique et le repli si la fenêtre est bloquée.
- [x] Ajouter un test unitaire du générateur HTML de reçu POS et de son déclenchement d’impression.
- [x] Exécuter un test navigateur desktop du flux POS complet déclenchant le reçu depuis l’interface après encaissement.
- [x] Exécuter un test navigateur mobile du flux POS complet et du repli quand la fenêtre d’impression est bloquée.
- [x] Ajouter un mode de rattachement distinct pour le caissier et l’agent commercial : compte par défaut ou choix au comptoir.
- [x] Masquer les sélecteurs d’agents de la création de facture lorsqu’un compte par défaut est configuré.
- [x] Tester les deux modes de rattachement sur la création de facture, desktop et mobile.
- [x] Afficher en lecture seule les agents par défaut appliqués lors de la création de facture.
- [x] Vérifier le rendu desktop et mobile des rattachements affichés en lecture seule.
- [x] Reproduire le panier POS flottant ouvert et ancré en bas de page selon le modèle fourni.
- [x] Limiter sur mobile la zone des articles du panier à trois lignes visibles avec défilement au-delà.
- [x] Vérifier l’ajout, les quantités, le total et l’encaissement du panier sur desktop et mobile.
- [x] Ajouter un bouton pour réduire ou réouvrir le panier flottant POS.
- [x] Afficher un indicateur de stock faible dans les lignes du panier POS.
- [x] Ajouter un raccourci clavier accessible pour ouvrir l’encaissement POS.
- [x] Tester les nouveaux contrôles de panier sur desktop et mobile.
- [x] Afficher un indicateur de stock faible dans la grille des produits du POS avant l’ajout au panier.
- [x] Vérifier le rendu de l’indicateur de stock faible sur desktop et mobile.
- [x] Ajouter un filtre de grille pour n’afficher que les produits en stock faible au POS.
- [x] Tester le filtre de stock faible combiné à la recherche sur desktop et mobile.
- [x] Générer une liste d’achats fournisseur à partir des produits filtrés en stock faible.
- [x] Calculer les quantités à commander pour atteindre le seuil minimal de chaque produit.
- [x] Vérifier la liste d’achats fournisseur sur desktop et mobile.
- [x] Harmoniser les boutons des pages Paramètres avec les actions principales de l’application.
- [x] Ajouter un réglage de couleur principale appliqué globalement aux boutons, badges et icônes.
- [x] Vérifier le changement de couleur sur les thèmes clair et sombre, desktop et mobile.
- [x] Ajouter un aperçu de facture en temps réel dans les paramètres d’apparence.
- [x] Appliquer la couleur principale sélectionnée aux éléments d’accent de l’aperçu.
- [x] Vérifier l’aperçu de facture sur desktop et mobile.
- [x] Ajouter un bouton de bascule entre aperçu A4 et aperçu ticket de caisse.
- [x] Adapter le contenu et les proportions de l’aperçu au format ticket.
- [x] Vérifier les deux aperçus sur desktop et mobile.
- [x] Créer les dépenses avec les catégories Loyer, Énergie, Connexion, Salaire, Marketing, Fournitures, Impôts et Autre.
- [x] Ajouter une page Dépenses pour créer, consulter, modifier et supprimer les dépenses.
- [x] Intégrer les dépenses au calcul du bénéfice net après coût des marchandises et rémunérations.
- [x] Afficher les dépenses et le bénéfice net dans les indicateurs de pilotage pertinents.
- [x] Tester les règles de calcul, les autorisations administrateur et les rendus desktop/mobile.
- [x] Agréger les dépenses mensuelles par catégorie pour alimenter le tableau de bord.
- [x] Ajouter un graphique circulaire des dépenses avec légende, montants et pourcentages.
- [x] Vérifier le graphique et son état vide sur desktop et mobile.
- [x] Définir et enregistrer un budget mensuel de dépenses.
- [x] Comparer les dépenses mensuelles au budget avec consommé, restant et dépassement.
- [x] Ajouter le réglage de budget et le panneau de suivi dans le tableau de bord.
- [x] Tester les calculs, les seuils et les rendus desktop/mobile du budget.
- [x] Joindre et consulter un justificatif sécurisé pour chaque dépense.
- [x] Générer un rapport mensuel de dépenses détaillé par catégorie.
- [x] Définir des alertes de budget à l’approche et au dépassement du plafond mensuel.
- [x] Tester le stockage, le rapport, les alertes et les parcours desktop/mobile.
- [x] Ajouter un en-tête professionnel global avec action de sauvegarde manuelle.
- [x] Ajouter un centre de notifications avec compteur numérique et liste d’alertes métier.
- [x] Tester la sauvegarde, les notifications et le rendu responsive de l’en-tête.
- [x] Afficher le header global sur desktop et mobile sans condition de largeur cachante.
- [x] Appliquer un fond blanc au header avec des contrôles à contraste élevé.
- [x] Afficher un compteur de notifications rouge ou orange visible et accessible.
- [x] Vérifier le header sur desktop et mobile.
- [x] Intégrer les paiements de salaires et de commissions des agents aux dépenses mensuelles.
- [x] Inclure les paiements agents dans le bénéfice net, le budget et les rapports par catégorie.
- [x] Identifier clairement les dépenses d’agents dans le tableau de bord et les rapports.
- [x] Tester les agrégats de paiements agents sur desktop et mobile.
- [x] Joindre et consulter un reçu sécurisé pour chaque paiement agent.
- [x] Afficher le détail des paiements groupés par bénéficiaire dans la paie.
- [x] Tester le stockage des reçus, les listes par bénéficiaire et les rendus desktop/mobile.
- [x] Ajouter des paliers de prix par quantité lors de la création et de la modification d’un produit.
- [x] Appliquer le palier au seuil le plus élevé sans dépasser la quantité vendue, quel que soit le type de client.
- [x] Afficher le palier retenu dans le POS et la création de facture.
- [x] Tester les règles de prix, la configuration produit, le POS et les factures sur desktop et mobile.
- [x] Créer une gestion administrateur des catégories avec création, modification et suppression protégée.
- [x] Ajouter une page Catégories et son accès depuis la navigation.
- [x] Remplacer le champ texte Catégorie des produits par un sélecteur de catégories administrables.
- [x] Tester les catégories, les produits et les rendus desktop/mobile.
- [x] Compacter les cartes de la liste des fournisseurs.
- [x] Rendre les cartes fournisseurs cliquables et afficher leurs détails complets.
- [x] Vérifier le panneau fournisseur et le rendu desktop/mobile.
- [x] Ajouter la suppression sécurisée des clients sans compromettre l’historique commercial.
- [x] Ajouter les actions créer, modifier et supprimer dans la liste des clients.
- [x] Tester la gestion des clients, les autorisations et les rendus desktop/mobile.
- [x] Inclure les paiements agents comme segment dédié dans le graphique de répartition des dépenses.
- [x] Vérifier les montants, libellés et couleurs du graphique sur desktop et mobile.
- [x] Exiger explicitement la sélection d’un agent à la création de facture sans présélectionner « Aucun ».
- [x] Corriger la courbe Dynamique des ventes pour afficher la devise FCFA active.
- [x] Ajouter des préférences pour afficher ou masquer les éléments du tableau de bord.
- [x] Tester les validations facture, la devise et les préférences sur desktop et mobile.
- [x] Préremplir dans l’encaissement les agents déjà sélectionnés à la création de facture, tout en autorisant leur modification.
- [x] Enregistrer les préférences du tableau de bord par utilisateur authentifié.
- [x] Ajouter une réinitialisation des sections et des vues préconfigurées adaptées aux rôles.
- [x] Tester le préremplissage, les préférences personnelles et les rendus desktop/mobile.
- [x] Ajouter une entrée Clients clairement visible dans le menu latéral.
- [x] Vérifier l’accès Clients sur desktop et mobile.
- [x] Ajouter un champ Autre référence alphanumérique aux clients et aux fournisseurs.
- [x] Ajouter une confirmation modale avant la suppression d’un client ou d’une facture.
- [x] Ajouter recherche et filtres de tri dans la gestion des clients.
- [x] Ajouter au tableau de bord un widget de factures impayées et d’activité récente des clients.
- [x] Tester les validations, confirmations, filtres et le widget sur desktop et mobile.
- [x] Ajouter un scanner de code-barres à la création et à la modification d’un produit.
- [x] Créer une gestion administrable des unités de mesure.
- [x] Remplacer le champ Unité du produit par un sélecteur d’unités administrables.
- [x] Tester le scan, les unités et la fiche produit sur desktop et mobile.
- [x] Renforcer les alertes de niveaux de stock bas dans le tableau de bord.
- [x] Afficher une action rapide depuis les alertes de stock pour réapprovisionner les produits concernés.
- [x] Harmoniser les toasts de réussite pour les principales actions métier, dont produits et factures.
- [x] Tester les alertes et notifications sur desktop et mobile.
- [x] Permettre de définir un seuil d’alerte de stock personnalisé pour chaque produit.
- [x] Ajouter une fiche produit avec historique détaillé des entrées et sorties de stock.
- [x] Générer un bon de commande de réapprovisionnement depuis une alerte de stock bas.
- [x] Tester les seuils, l’historique et le bon de commande sur desktop et mobile.
- [x] Séparer les paliers de quantité détail et grossiste dans le modèle produit.
- [x] Permettre d’activer indépendamment les paliers détail, grossiste ou les deux.
- [x] Appliquer le palier approprié selon le type de client dans le POS et les factures.
- [x] Tester les paliers séparés pour les clients détail et grossistes sur desktop et mobile.
- [x] Ajouter un bouton pour dupliquer les paliers détail vers la section grossiste.
- [x] Vérifier la duplication des paliers sur desktop et mobile.
- [x] Retirer le champ Contact des clients et fournisseurs sans altérer l’historique existant.
- [x] Ajouter les champs Numéro fiscal et Notes aux clients et fournisseurs.
- [x] Réorganiser les formulaires selon l’ordre demandé et clarifier Autre référence.
- [x] Tester les formulaires et fiches clients-fournisseurs sur desktop et mobile.
- [x] Ajouter un champ Description aux produits et l’afficher dans leur fiche détaillée.
- [x] Ajouter un centre d’export CSV pour les produits, fournisseurs et clients.
- [x] Ajouter un import CSV validé des produits, fournisseurs et clients.
- [x] Tester les formats CSV, les validations et les contrôles desktop/mobile.
- [x] Importer les paliers détail et grossiste depuis le fichier CSV Produits.
- [x] Ajouter le téléchargement de modèles CSV vides pour produits, fournisseurs et clients.
- [x] Afficher un aperçu des données CSV et exiger une validation avant import.
- [x] Tester les paliers CSV, les modèles et l’aperçu sur desktop et mobile.
- [x] Réduire et centrer l’écran d’encaissement.
- [x] Afficher les agents définis par défaut en lecture seule lors de l’encaissement.
- [x] Exiger un choix explicite d’agent ou de l’option « Aucun » pour les sélecteurs non définis par défaut.
- [x] Tester les sélections d’agents et l’encaissement sur desktop et mobile.
- [x] Conserver l’encaissement déjà validé, sans réduction supplémentaire demandée.
- [x] Autoriser le vendeur à déclencher une sauvegarde manuelle.
- [x] Donner au vendeur accès aux paramètres Apparence et Tableau de bord, sans accès aux réglages sensibles.
- [x] Autoriser le vendeur à créer, modifier et gérer les clients.
- [x] Tester les autorisations vendeur et l’encaissement sur desktop et mobile.
- [x] Restaurer la largeur d’encaissement validée avant la dernière tentative de réduction.
- [x] Exposer les sauvegardes manuelles avec l’auteur, la date, le statut et les métadonnées d’archive.
- [x] Ajouter une vue administrateur dédiée au suivi des sauvegardes effectuées par les vendeurs.
- [x] Tester les autorisations, les données et le rendu responsive de l’historique.
- [x] Autoriser la modification manuelle du prix unitaire lors de la création de facture.
- [x] Ajouter des réglages administrateur pour prix hors tarif et remise maximale vendeur.
- [x] Protéger côté serveur les annulations, remboursements, corrections de stock et modifications de coût d’achat par vendeur.
- [x] Afficher les contrôles et refus explicites dans les écrans de vente et paramètres.
- [x] Tester les seuils, les autorisations et les parcours desktop/mobile.
- [x] Retirer le champ Autre référence des formulaires Clients et Fournisseurs.
- [x] Compacter les cartes de la liste Clients.
- [x] Ajouter une fiche client complète accessible au clic sur une carte.
- [x] Tester les formulaires et le détail client sur desktop et mobile.
- [x] Autoriser les vendeurs à consulter le registre des mouvements de stock.
- [x] Masquer ou désactiver les actions de création et d’ajustement de mouvements pour les vendeurs.
- [x] Tester les autorisations de mouvements sur desktop et mobile.
- [x] Vérifier et rendre accessibles les réglages vendeur de prix inférieur, prix hors tarif et remise au-delà du seuil.
- [x] Appliquer ou compléter les protections vendeur pour annulation, remboursement, correction de stock et coût d’achat.
- [x] Afficher des messages explicites lorsque l’action sensible est bloquée au vendeur.
- [x] Tester individuellement chaque autorisation et blocage vendeur.
- [x] Auditer les écrans, données et mutations à rendre utilisables hors connexion.
- [x] Installer l’application comme PWA et mettre en cache l’interface ainsi que les données essentielles.
- [x] Mettre en file d’attente les actions compatibles hors connexion et les synchroniser au retour du réseau.
- [x] Afficher l’état de connexion et les actions en attente de synchronisation.
- [x] Tester les parcours de consultation, vente et synchronisation hors ligne sur desktop et mobile.
- [x] Auditer les données d’encaissement hors connexion et la structure du reçu provisoire.
- [x] Permettre l’encaissement partiel des factures dans la file d’attente hors connexion.
- [x] Imprimer un reçu provisoire clairement identifié pour les ventes POS hors connexion.
- [x] Tester la synchronisation, le statut partiel et l’impression provisoire sur desktop et mobile.
- [x] Auditer la file de synchronisation et le catalogue produit existant.
- [x] Ajouter un journal détaillé des synchronisations avec états, horodatages et causes d’échec.
- [x] Ajouter une interface de reprise manuelle des synchronisations en erreur.
- [x] Remplacer le tableau des produits par des cartes compactes et cliquables.
- [x] Créer une fiche produit professionnelle regroupant prix, marges, statistiques, mouvements, fournisseurs et actions.
- [x] Tester les parcours de synchronisation et de fiche produit sur desktop et mobile.
- [x] Auditer le header et le formatage des prix existants.
- [x] Harmoniser le header et ses contrôles avec le thème sombre.
- [x] Ajouter des réglages de séparateur de chiffres et d’arrondi pour les prix.
- [x] Tester l’application du format de prix et préparer l’archive actuelle du projet.
- [x] Simplifier le catalogue en cartes de liste produit minimalistes et cliquables.
- [x] Vérifier la densité et la lisibilité des cartes produit sur desktop et mobile.
- [x] Aligner les filtres du catalogue Produits sur une ligne avec repli responsive sur mobile.
- [x] Adapter automatiquement le header au thème clair ou sombre sélectionné.
- [x] Vérifier le header dans les deux thèmes sur desktop et mobile.
- [x] Corriger l’aperçu de format des prix pour qu’il suive exactement les réglages sélectionnés.
- [x] Placer la recherche du catalogue au-dessus des filtres de tri.
- [x] Donner aux filtres de tri des largeurs égales et stables sur leur ligne responsive.
- [x] Auditer la fiche fournisseur actuelle, les produits associés et l’historique de commandes.
- [x] Remplacer la fenêtre fournisseur par une page professionnelle dédiée avec actions Modifier et Supprimer.
- [x] Ajouter les boutons Appeler, Message, WhatsApp et Mail selon les coordonnées disponibles.
- [x] Afficher les produits liés, leur sélection et la création directe d’un bon de commande.
- [x] Tester le parcours fournisseur sur desktop et mobile.
- [x] Auditer les bons de commande et les règles d’entrée de stock existantes.
- [x] Ajouter le partage d’un bon de commande par WhatsApp et e-mail.
- [x] Afficher et mettre à jour les statuts en attente, envoyé et reçu des bons de commande.
- [x] Valider la réception d’un bon pour créer les entrées de stock de manière idempotente.
- [x] Tester le partage, les badges de statut et la réception de marchandises sur desktop et mobile.
- [x] Auditer les lignes de bon, les réceptions et le rendu de partage actuel.
- [x] Permettre une réception partielle par ligne avec calcul des quantités restantes.
- [x] Ajouter l’annulation motivée d’un bon de commande avec traçabilité.
- [x] Générer un PDF du bon de commande et le préparer pour le partage e-mail.
- [x] Tester les réceptions partielles, l’annulation et le PDF de bon sur desktop et mobile.
- [x] Auditer les cartes, actions et données de bon de commande actuelles.
- [x] Ajouter et persister une date de livraison attendue sur les bons de commande.
- [x] Afficher une alerte visuelle lorsque la livraison attendue est dépassée.
- [x] Transformer l’historique fournisseur en cartes de bons cliquables.
- [x] Créer une fiche détaillée de bon avec dates, lignes, statuts et actions complètes.
- [x] Tester les parcours bon de commande sur desktop et mobile.
- [x] Aligner les actions Modifier et Supprimer en haut à droite de la carte fournisseur.
- [x] Placer les informations complémentaires juste sous les coordonnées fournisseur.
- [x] Vérifier la mise en page de la fiche fournisseur sur desktop et mobile.
- [x] Déplacer les actions de la fiche bon de commande en bas de page.
- [x] Afficher le retour vers le fournisseur uniquement après réception complète du bon.
- [x] Vérifier la fiche bon de commande sur desktop et mobile.
- [x] Auditer les données et composants existants de bon de commande.
- [x] Créer une page professionnelle de liste de bons de commande avec filtres et cartes cliquables.
- [x] Ajouter une création de bon de commande depuis cette page.
- [x] Ajouter l’onglet Bons de commande au menu latéral et relier les détails.
- [x] Tester le parcours bons de commande sur desktop et mobile.
- [x] Ajouter une barre de recherche et des filtres par fournisseur et statut dans la liste des bons de commande.
- [x] Préserver l’origine d’ouverture d’un bon pour adapter son bouton Retour.
- [x] Vérifier les retours depuis la liste Bons de commande et depuis la fiche fournisseur.
- [x] Auditer les cartes client, la fenêtre existante et les données associées.
- [x] Créer une fiche client professionnelle avec détails et actions existantes.
- [x] Rendre les cartes client cliquables vers leur fiche dédiée et retirer le popup de détail.
- [x] Tester le parcours de fiche client sur desktop et mobile.
- [x] Ajouter une action Nouvelle facture depuis la fiche client.
- [x] Préremplir et verrouiller la sélection du client dans le flux de création de facture.
- [x] Tester l’ouverture d’une facture préremplie depuis une fiche client.
- [x] Auditer les données d’adresse et les historiques de vente réutilisables à la facture.
- [x] Préremplir l’adresse de livraison du client dans la création de facture.
- [x] Suggérer les produits réellement achetés par le client et permettre leur ajout rapide.
- [x] Tester la livraison préremplie et les suggestions produits sur desktop et mobile.
- [x] Auditer les actions et le rendu existants sur la fiche facture.
- [x] Ajouter la génération PDF, l’impression et l’envoi e-mail des factures créées.
- [x] Tester les actions rapides facture sur desktop et mobile.
- [x] Déplacer le bouton Nouvelle facture auprès des contacts client.
- [x] Remplacer le champ Prix manuel par une édition directe du prix affiché dans chaque ligne de facture.
- [x] Vérifier les parcours client et facture sur desktop et mobile.
- [x] Ajouter les boutons − et + autour de la quantité dans chaque ligne de facture.
- [x] Respecter les limites de stock et vérifier le rendu responsive des contrôles.
- [x] Ajouter la saisie manuelle de quantité entre les boutons − et +.
- [x] Vérifier les bornes de stock et la saisie de quantité sur desktop et mobile.
- [x] Afficher une alerte discrète lorsque la quantité de ligne atteint le stock disponible maximum.
- [x] Vérifier l’alerte de stock maximum sur desktop et mobile.
- [x] Ajouter un lien de fiche produit directement dans l’alerte de stock maximum.
- [x] Vérifier l’ouverture de la fiche produit depuis l’alerte.
- [x] Auditer les remises de facture et les données agent disponibles.
- [x] Retirer la remise par ligne de la création de facture.
- [x] Transformer la liste Agents en cartes compactes et cliquables.
- [x] Créer une fiche professionnelle d’agent avec historiques, commissions, statistiques et actions.
- [x] Ajouter les contacts directs Appeler, Message, WhatsApp et E-mail depuis la fiche agent.
- [x] Tester les parcours facture et agents sur desktop et mobile.
- [x] Auditer le registre de factures, l’aperçu et les actions existantes.
- [x] Créer une fiche professionnelle de facture avec détails, paiements, intervenants et actions.
- [x] Transformer la liste des factures en cartes cliquables vers leur fiche dédiée.
- [x] Tester les actions et la navigation de facture sur desktop et mobile.
- [x] Retirer le bouton WhatsApp redondant des fiches Fournisseur et Agent.
- [x] Vérifier les contacts simplifiés sur desktop et mobile.
- [x] Retirer « Pilotage commercial en direct » et « Cockpit commercial » du tableau de bord pour tous les rôles.
- [x] Vérifier le rendu simplifié du tableau de bord sur desktop et mobile.
- [x] Auditer les libellés de point de vente, les cartes de facture et les actions rapides.
- [x] Compacter les cartes de la liste des factures.
- [x] Remplacer le libellé Point de vente par Vente Rapide.
- [x] Remplacer les actions du tableau de bord par Vente Rapide, Nouvelle Facture et Nouveau Client.
- [x] Tester les libellés et actions rapides sur desktop et mobile.
- [x] Retirer les réglages Répartition des dépenses et Suivi du budget du tableau de bord vendeur.
- [x] Vérifier les préférences vendeur simplifiées sur desktop et mobile.
- [x] Ajouter des icônes et couleurs distinctives aux actions rapides du tableau de bord.
- [x] Vérifier la visibilité des actions rapides sur desktop et mobile.
- [x] Auditer les notifications par rôle et le flux d’impression des factures.
- [x] Filtrer les notifications administrateur hors de la vue vendeur.
- [x] Déclencher automatiquement la boîte de dialogue d’impression après ouverture de la facture.
- [x] Tester les notifications vendeur et l’impression de facture.
- [x] Auditer le panneau actuel et le stockage des notifications lues.
- [x] Ajouter un indicateur visuel de notification non lue.
- [x] Ajouter l’action Marquer toutes comme lues.
- [x] Tester les états de lecture de notification sur desktop et mobile.
- [x] Afficher les badges des factures à encaisser et partiellement réglées en orange.
- [x] Vérifier les statuts de facture sur les listes et fiches.
- [x] Auditer les journaux et le flux de connexion administrateur via Google.
- [x] Corriger l’échec d’authentification identifié.
- [x] Vérifier le retour de connexion administrateur avant publication.
- [x] Auditer le flux OAuth et définir la connexion de secours administrateur.
- [x] Ajouter un stockage sécurisé du mot de passe et une procédure de connexion administrateur.
- [x] Ajouter un formulaire e-mail et mot de passe de secours.
- [x] Tester les succès, échecs et restrictions de la connexion de secours.
- [x] Tracer le cycle OAuth Google pour identifier la perte de session après le callback.
- [x] Corriger la persistance de session afin d’éliminer la boucle de connexion Google.
- [x] Vérifier un aller-retour Google complet vers le tableau de bord.
- [x] Tracer la redirection post-connexion vendeur qui mène à la page 404.
- [x] Corriger la destination après connexion vendeur et vérifier son tableau de bord.
- [x] Finaliser le diagnostic et le correctif du parcours administrateur Google.
- [x] Auditer les secrets et la comparaison des identifiants administrateur de secours.
- [x] Corriger la configuration ou validation qui retourne des identifiants incorrects.
- [x] Vérifier la connexion administrateur de secours de bout en bout.
- [x] Auditer la gestion du mot de passe de secours et les paramètres administrateur existants.
- [x] Créer une procédure administrateur sécurisée de changement de mot de passe de secours.
- [x] Ajouter une page dédiée de réglage du mot de passe de secours.
- [x] Tester les restrictions, validations et changement de mot de passe.
- [x] Préparer l’archive source actuelle du projet pour livraison.
- [x] Cartographier et tracer les flux Google et connexion de secours sur le domaine publié ; le flux Google est ensuite abandonné à la demande de l’utilisateur.
- [x] Reproduire les erreurs avec les identifiants et sessions effectifs sans exposer les secrets ; le remplacement interne supprime la dépendance au parcours instable.
- [x] Corriger la cause racine commune des échecs d’authentification en remplaçant l’accès Google par une connexion interne.
- [x] Abandonner la vérification Google de bout en bout au profit de la connexion e-mail et mot de passe demandée.
- [x] Tracer sans secret la normalisation du formulaire et les valeurs de configuration actives.
- [x] Corriger tout écart de format entre les identifiants saisis et la validation serveur.
- [x] Valider la connexion de secours comme base de la connexion interne et conserver les sessions sécurisées.
- [x] Auditer la publication et le domaine ; le serveur répond et l’ancien callback ne crée plus de cookie de session.
- [x] Remplacer les correctifs Google ou domaine par la désactivation du parcours OAuth dans l’application.
- [x] Vérifier le parcours e-mail et mot de passe à la place des deux anciens parcours de connexion.
- [x] Auditer la table de mot de passe et le compte administrateur cible.
- [x] Initialiser une entrée hachée de mot de passe de secours en base.
- [x] Vérifier la connexion de secours indépendamment des secrets runtime.
- [x] Tracer le callback Google, le cookie de session émis et la première requête authentifiée.
- [x] Corriger la persistance de session ou la redirection finale après Google.
- [x] Retirer le retour Google complet vers le tableau de bord, parcours abandonné à la demande de l’utilisateur.
- [x] Auditer les comptes, mots de passe vendeur et sessions internes existants.
- [x] Créer une connexion interne unifiée par e-mail et mot de passe pour administrateur et vendeurs.
- [x] Remplacer l’écran et le parcours Google par la connexion locale.
- [x] Désactiver les redirections OAuth et préserver les sessions internes existantes.
- [x] Tester les connexions administrateur et vendeur de bout en bout avec les tests de route, de session, de mot de passe, de comptes vendeur et le build de production.
- [x] Ajouter l’option Se souvenir de moi avec une durée de session prolongée explicite.
- [x] Tester la durée standard et la durée prolongée de la session de connexion.
- [x] Créer le suivi persistant des sessions actives par utilisateur.
- [x] Ajouter la consultation et la révocation sécurisée des sessions sur d’autres appareils.
- [x] Tester les sessions actives, la révocation distante et la conservation de la session courante.
- [x] Auditer les données et définir l’architecture multi-entreprise compatible avec l’existant.
- [x] Créer l’entreprise et le premier administrateur via une inscription sécurisée.
- [x] Isoler les catalogues, clients, agents, vendeurs, ventes, dépenses, réglages et indicateurs principaux par entreprise.
- [x] Ajouter l’interface d’inscription et le premier paramétrage de l’entreprise.
- [x] Tester l’inscription, les sessions et l’étanchéité des données principales entre entreprises.
- [x] Reporter l’audit et la configuration d’envoi d’e-mail de vérification jusqu’à la disponibilité d’un fournisseur d’e-mail.
- [x] Reporter le code à six chiffres, l’activation différée, le renvoi contrôlé et leurs tests jusqu’à la disponibilité d’un fournisseur d’e-mail.
- [x] Définir les étapes du premier produit, premier client et premier moyen de paiement.
- [x] Ajouter les pages Conditions d’utilisation et Politique de confidentialité.
- [x] Relier les pages légales au formulaire de création d’entreprise.
- [x] Construire l’assistant de démarrage et mémoriser sa progression par entreprise.
- [x] Tester le parcours de démarrage et les pages légales.
- [x] Ajouter une option persistante permettant à un administrateur d’ignorer définitivement l’assistant de démarrage.
- [x] Tester que l’assistant ne réapparaît pas après son ignorance.
- [x] Diagnostiquer le manque de visibilité : le lien texte était peu perceptible et il n’existait pas de route dédiée à l’inscription.
- [x] Rendre l’inscription explicitement visible et accessible depuis l’écran de connexion via un bouton et la route /inscription.
- [x] Vérifier le parcours de connexion et d’inscription par le typage, les tests et le build PWA ; la nouvelle route cible directement le mode inscription sans session.
- [x] Vérifier et rendre explicite le lien d’inscription sur l’écran de connexion publié.
- [x] Reporter l’envoi d’e-mail, les jetons, les écrans et les tests de réinitialisation jusqu’à la configuration d’un service d’e-mail.
- [x] Ajouter une vérification d’adresse e-mail en temps réel et protégée lors de l’inscription.
- [x] Afficher l’état de disponibilité et bloquer l’inscription si l’adresse est invalide ou déjà utilisée.
- [x] Tester la vérification d’adresse e-mail et le blocage de soumission.
- [x] Ajouter un indicateur de force du mot de passe pendant l’inscription.
- [x] Ajouter des boutons permettant d’afficher ou masquer les mots de passe de connexion et d’inscription.
- [x] Tester les contrôles de force et de visibilité de mot de passe.
- [x] Reproduire la redirection du domaine publié vers l’ancienne authentification : elle était imposée avant le chargement de l’application par la visibilité du domaine.
- [x] Désactiver la protection de domaine héritée dans les paramètres de visibilité de la plateforme.
- [x] Vérifier le domaine publié en navigation vierge vers l’inscription locale.
- [x] Auditer les combinaisons de couleurs peu lisibles dans le thème clair.
- [x] Corriger les tokens et composants concernés tout en préservant le thème sombre.
- [x] Vérifier visuellement les thèmes clair et sombre sur les écrans principaux.
- [x] Corriger la lisibilité de la bannière de démarrage guidé en thème clair.
- [x] Corriger la lisibilité des boutons d’action rapide en thème clair.
- [x] Vérifier visuellement les composants signalés sur la page d’accueil claire à partir de la capture fournie et des variantes claires appliquées.
- [x] Auditer les badges d’état, tableaux, modales et menus déroulants en thème clair.
- [x] Corriger leurs surfaces, textes, bordures et états interactifs pour un contraste lisible.
- [x] Vérifier les superpositions, menus et modales en thème clair et sombre au niveau des composants partagés, des tokens et du build de production.
- [x] Remplacer la couleur principale par le bleu #2563EB dans les tokens globaux.
- [x] Adapter l’onglet actif, le bouton Vente Rapide et la carte Démarrage guidé à la nouvelle couleur.
- [x] Vérifier les contrastes de la nouvelle identité bleue dans les thèmes clair et sombre.
- [x] Auditer les limites du mode hors connexion actuel pour les usages prolongés.
- [x] Concevoir et initialiser une base IndexedDB durable, une file d’opérations isolée par entreprise et une demande de stockage persistant.
- [x] Définir la stratégie de conflit, de sauvegarde et de reprise après plusieurs jours sans réseau.
- [x] Auditer la préparation actuelle de StockPilot Pro pour une commercialisation multi-entreprise.
- [x] Étudier les pratiques professionnelles de solutions de gestion de stock et de vente comparables.
- [x] Définir l’architecture cible, les offres SaaS et les exigences d’exploitation.
- [x] Rédiger le plan de configuration et de commercialisation de StockPilot Pro.
- [x] Cartographier les tables, routes et opérations critiques à isoler par entreprise, avec un audit des priorités restantes.
- [x] Compléter les filtres d’entreprise et les contrôles de propriété manquants sur les parcours métier, POS, inventaires, paie et sauvegardes.
- [x] Ajouter des tests automatisés de non-divulgation entre entreprises pour les factures et encaissements POS.
- [x] Valider l’isolation multi-entreprise sur les parcours critiques avec 153 tests et le build PWA.
- [x] Isoler la création, le téléchargement, la rétention et la restauration des sauvegardes par entreprise.
- [x] Auditer les mutations POS et définir les opérations hors connexion idempotentes.
- [x] Mettre en file dans IndexedDB les ventes et encaissements POS exécutés sans réseau.
- [x] Synchroniser les opérations POS en attente lors du retour réseau.
- [x] Ajouter un journal visuel de synchronisation et une résolution manuelle des conflits de stock.
- [x] Tester les ventes hors connexion, reprises, doublons et conflits de stock.

- [x] Finaliser la migration runtime d’OfflineContext vers IndexedDB comme source de vérité unique par entreprise et utilisateur.
- [x] Migrer une seule fois les anciennes files localStorage compatibles vers le périmètre IndexedDB actif, puis supprimer ces clés legacy sans divulguer de données inter-entreprises.
- [x] Corriger l’hydratation et les écritures transactionnelles de la file et du journal lors d’un changement de compte ou d’un périmètre vide.
- [x] Ajouter les tests offline de migration legacy, d’état vide, d’isolation entreprise/utilisateur et de persistance transactionnelle.

## Programme de remédiation — Lot 1 : baseline et harnais de sécurité
- [x] Créer le registre de remédiation exhaustif C-01 à F-03 avec propriétaire, lot, dépendances, preuve et statut.
- [x] Documenter la baseline reproductible, les commandes de validation, les critères de go/no-go et le rollback.
- [x] Ajouter des fixtures déterministes de deux entreprises pour les futurs tests d’isolation et d’intégrité.
- [x] Ajouter un harnais de tests d’isolation réutilisable sans données réelles ni secrets.
- [x] Vérifier le Lot 1 avec pnpm check, pnpm test et pnpm build, puis publier son checkpoint avant le Lot 2.

## Programme de remédiation — Lot 2 : noyau d’isolation multi-entreprise
- [x] Créer des helpers typés de chargement et d’assertion de ressources par companyId.
- [x] Renforcer companyScope pour refuser les ressources legacy hors des parcours explicitement migrés.
- [x] Ajouter un audit statique des requêtes par identifiant sans scope.
- [x] Ajouter des tests de propriété parent/enfant et de refus inter-entreprise réutilisables.
- [x] Vérifier le Lot 2 avec pnpm check, pnpm test et pnpm build, puis publier son checkpoint avant le Lot 3.

## Programme de remédiation — Lot 3 : routes métier critiques et opérations stock/achats
- [x] Isoler complètement les bons de commande, fournisseurs, lignes, produits et réceptions par companyId.
- [x] Isoler les mouvements de stock, réglages vendeur et alertes dans toutes les lectures et écritures.
- [x] Isoler les catégories, unités et propagations vers les produits.
- [x] Isoler la modification des rôles utilisateurs et les enfants métier associés.
- [x] Ajouter les tests A/B de lecture, création, modification, suppression et réception inter-entreprises.
- [x] Vérifier le Lot 3 avec pnpm check, pnpm test et pnpm build, puis publier son checkpoint avant le Lot 4.

## Programme de remédiation — Lot 4 : sauvegardes, restauration, audit et Google Drive
- [x] Supprimer le mode global implicite des sauvegardes et scoper chaque archive par companyId.
- [x] Valider les payloads de restauration par schéma et relations parent-enfant avant toute suppression.
- [x] Rendre les lignes d’audit nouvelles obligatoirement attribuées à une entreprise.
- [x] Scoper Google Drive, son state OAuth, ses tokens et la synchronisation des archives.
- [x] Rendre le callback planifié générique, idempotent et correctement codé en HTTP.
- [x] Vérifier le Lot 4 avec pnpm check, pnpm test et pnpm build, puis publier son checkpoint avant le Lot 5.

## Programme de remédiation — Lot 5 : authentification, sessions et exposition réseau
- [x] Supprimer les chemins OAuth/Google résiduels du flux d’authentification applicatif sans toucher à Google Drive.
- [x] Durcir le fallback administrateur et supprimer toute valeur de secours dangereuse en production.
- [x] Renforcer cookies, expiration, révocation et validation de session.
- [x] Ajouter une limitation de débit et une politique uniforme pour les endpoints publics sensibles.
- [x] Uniformiser les erreurs d’authentification sans divulgation d’information.
- [x] Vérifier le Lot 5 avec pnpm check, pnpm test et pnpm build, puis publier son checkpoint avant le Lot 6.

## Programme de remédiation — Lot 6 : client offline-first, PWA et impressions
- [x] Garantir qu’IndexedDB reste la source unique sans localStorage métier ou identité.
- [x] Scoper caches, préférences, notifications et journaux par companyId/userId.
- [x] Purger les caches lors du changement de compte, de société ou de déconnexion.
- [x] Corriger les sinks XSS et les HTML d’impression avec échappement systématique.
- [x] Durcir les limites PWA, les uploads locaux et les reprises réseau.
- [x] Vérifier le Lot 6 avec pnpm check, pnpm test et pnpm build, puis publier son checkpoint avant le Lot 7.

## Programme de remédiation — Lot 7 : intégrité métier, schéma et performance
- [x] Ajouter des bornes et validations serveur sur quantités, montants, remises et dates.
- [x] Garantir l’idempotence des opérations offline et des mutations financières critiques.
- [x] Renforcer les transactions stock/vente pour éviter les dépassements et écritures incohérentes.
- [x] Ajouter les index et contraintes de schéma nécessaires sans migration destructive.
- [x] Remplacer les lectures globales coûteuses par des requêtes filtrées et paginées.
- [x] Vérifier le Lot 7 avec pnpm check, pnpm test et pnpm build, puis publier son checkpoint avant le Lot 8.

## Programme de remédiation — Lot 8 : dépendances, CI, code mort et qualité
- [x] Déplacer la configuration pnpm ignorée vers un fichier supporté et vérifier les patches réellement appliqués.
- [x] Réduire les vulnérabilités de dépendances sans mise à niveau majeure non maîtrisée.
- [x] Supprimer ou isoler les modules morts et les imports inutilisés confirmés.
- [x] Ajouter une CI reproductible pour check, tests, build, audit de scope et migration.
- [x] Auditer les erreurs, types faibles et logs sensibles restants ; neutraliser le contenu de réponse du stockage dans les logs de production et conserver les types `any` restants dans des composants d’affichage non sensibles à traiter au fil des refactorings.
- [x] Vérifier le Lot 8 avec pnpm check, pnpm test et pnpm build, puis publier son checkpoint avant le Lot 9.

## Programme de remédiation — Lot 9 : validation adversariale, recette et déploiement progressif
- [x] Exécuter les scénarios A/B de refus inter-entreprises sur lectures, écritures, fichiers, backups et offline.
- [x] Vérifier les endpoints publics, les redirections, les cookies et l’absence de réactivation OAuth.
- [x] Vérifier la migration IndexedDB, le changement de compte et la reprise après perte réseau dans un navigateur.
- [x] Vérifier les impressions et exports avec des caractères HTML adversariaux.
- [x] Exécuter une recette POS, factures, agents, sauvegardes et PWA sans données sensibles.
- [x] Produire le go/no-go, le plan de rollback et le bilan final de déploiement.

## Fonctionnalité commerciale — recherche paramètres, TVA et livraison
- [x] Ajouter une recherche instantanée et accessible dans l’index des paramètres.
- [x] Ajouter une configuration TVA scoped par entreprise avec validation de taux.
- [x] Ajouter les champs TVA et frais de livraison aux factures, bons et devis concernés.
- [x] Persister les taux et frais dans les documents afin de figer les montants historiques.
- [x] Mettre à jour totaux, affichages, détails, impressions et exports.
- [x] Ajouter les tests de calcul, de validation, d’isolation et de régression, puis lancer pnpm check, pnpm test et pnpm build.

## Fiabilité synchronisation offline — verrou et persistance
- [x] Sérialiser les appels concurrents à syncNow et éviter les synchronisations doubles par opération.
- [x] Exposer un état d’erreur de persistance IndexedDB au contexte offline.
- [x] Ne plus ignorer silencieusement les échecs d’écriture et conserver une action de reprise.
- [x] Ajouter les tests de concurrence, d’échec IndexedDB et de reprise.
- [x] Vérifier avec pnpm check, pnpm test et pnpm build, puis créer un checkpoint.

## Réorganisation des paramètres
- [x] Regrouper les paramètres par sections thématiques avec une hiérarchie lisible.
- [x] Créer des liens indépendants pour rattachement, tickets, paiements et actions vendeurs.
- [x] Conserver ensemble les réglages fortement liés comme affichage et devise.
- [x] Préserver les routes historiques et les permissions administrateur.
- [x] Ajouter les tests de recherche par sous-réglage et par section.

## Synchronisation GitHub
- [x] Importer et valider le checkpoint GitHub 54911b1, appliquer les migrations 0041 et 0042, puis préparer sa publication.
- [x] Comparer et intégrer la nouvelle mise à jour déposée sur GitHub, appliquer les migrations éventuelles, valider et publier le checkpoint.

## Correctif — secret de session
- [x] Diagnostiquer et corriger l’erreur « Session secret is not configured securely » sans exposer ni affaiblir le secret de session ; retirer des journaux de rejet les métadonnées d’identifiants non nécessaires.
- [x] Ajouter une couverture de test de la validation de configuration, valider connexion et build, puis publier un checkpoint.

## Taux de TVA prédéfinis
- [x] Permettre à l’administrateur de gérer plusieurs taux de TVA prédéfinis par entreprise.
- [x] Proposer la sélection de ces taux dans les factures et devis, avec une validation serveur du taux choisi.
- [x] Tester les calculs et publier le correctif.

## Taux TVA par défaut
- [x] Permettre de définir un taux TVA prédéfini par défaut dans les réglages de l’entreprise.
- [x] Appliquer automatiquement ce taux aux nouveaux documents et couvrir les calculs associés.
- [x] Valider et publier le correctif.

## Réorganisation — création de facture et devis
- [x] Déplacer les options de livraison après les lignes produits et les masquer derrière une activation désactivée par défaut.
- [x] Placer la remise facture sous la livraison, puis la TVA sous la remise, sans modifier les calculs existants.
- [x] Tester les totaux, les affichages conditionnels et publier le correctif.

## Frais de livraison par défaut
- [x] Ajouter un réglage des frais de livraison par défaut par entreprise.
- [x] Préremplir ce montant à l’activation de la livraison dans les factures et devis, tout en le laissant modifiable.
- [x] Tester les calculs et publier le correctif.

## Allègement — création de facture et devis
- [x] Limiter les produits habituellement achetés à quatre par défaut et permettre de régler leur nombre ou de les désactiver dans les paramètres.
- [x] Masquer les agents sélectionnés par défaut et supprimer les messages de règles ou d’interdiction non actionnables.
- [x] Remplacer le bouton de livraison par un contrôle Activer/Désactiver et masquer la remise facture au vendeur non autorisé.
- [x] Tester les préférences, autorisations et parcours, puis publier le correctif.

## Correctif — autorisations de remise vendeur
- [x] Rétablir les contrôles distincts de remise par produit, facture et panier dans les paramètres vendeur.
- [x] Rétablir les plafonds associés, vérifier la persistance et publier le correctif.

## Correctif critique — application des autorisations vendeur
- [x] Masquer et bloquer les remises non autorisées dans la facture, le devis et Vente rapide.
- [x] Masquer et bloquer la bascule TVA lorsque le vendeur n’est pas autorisé à la modifier.
- [x] Ajouter des scénarios de refus côté client et serveur, puis valider et publier le correctif.

## Restauration — paramètres, historique et documents commerciaux
- [x] Restaurer une page de paramètres professionnelle sans descriptions de cartes ni doublons d’impression/tickets, avec l’impression séparée de l’entreprise.
- [x] Restaurer un historique de modifications isolé par entreprise.
- [x] Restaurer l’harmonisation complète devis/factures et le menu d’envoi WhatsApp, SMS et e-mail prérempli.
- [x] Vérifier les parcours restaurés et publier le correctif.

## Tickets Vente rapide et recherche documentaire
- [x] Enregistrer les tickets Vente rapide dans un registre latéral avec liste minimaliste cliquable et fiche détaillée.
- [x] Permettre de différer l’encaissement de paniers POS et de les reprendre dans des paniers flottants minimalistes.
- [x] Ajouter des recherches et filtres professionnels sur les factures, devis et tickets : période, agent, statut d’encaissement, retour et statut commercial.
- [x] Tester les parcours, le cloisonnement entreprise et publier le correctif.

## Export CSV — documents commerciaux
- [x] Exporter les résultats filtrés des factures, devis et tickets avec les colonnes comptables essentielles.
- [x] Tester la génération CSV, les filtres appliqués et publier le correctif.

## Tickets — actions rapides
- [x] Ouvrir les tickets dans une fenêtre de détail rapide au lieu d’une page dédiée.
- [x] Permettre depuis cette fenêtre l’encaissement, l’impression et la conversion préremplie en facture.
- [x] Tester les actions et publier le correctif.

## Ajustements — articles, TVA et quantité POS
- [x] Retirer le libellé « Tarif appliqué » des lignes de facture et devis.
- [x] Afficher la TVA uniquement si elle est activée globalement et autoriser sa bascule seulement pour les vendeurs habilités.
- [x] Ajouter la saisie directe de quantité dans le panier Vente rapide entre les boutons − et +.
- [x] Tester les contrôles et publier le correctif.

## Tickets — priorité d’encaissement
- [x] Placer et mettre en valeur le bouton Encaisser à droite dans la fenêtre des tickets non soldés.
- [x] Tester le rendu et publier le correctif.

## Correctif — livraison et taux TVA
- [x] Retirer le réglage de frais de livraison par défaut sans retirer les frais appliqués au document.
- [x] Corriger la résolution de l’entreprise active qui bloque la création de taux TVA prédéfinis.
- [x] Tester les réglages, la persistance multi-entreprise et publier le correctif.

## Personnalisation — modèle de facture
- [x] Ajouter dans Documents, tickets et imprimantes les options de personnalisation du modèle de facture.
- [x] Prévisualiser et appliquer les options aux impressions de documents.
- [x] Tester la persistance multi-entreprise et publier le correctif.

## Correctif critique — création des taux TVA
- [x] Corriger le refus silencieux lors de l’ajout d’un taux TVA prédéfini.
- [x] Rafraîchir la liste après ajout et afficher un retour explicite de réussite ou d’erreur.
- [x] Tester la mutation et publier le correctif.

## Multi-entrepôts et transferts de stock
- [x] Ajouter des entrepôts par entreprise, le stock par produit et par entrepôt, et un entrepôt principal.
- [x] Ajouter les transferts de stock tracés avec validation du stock source, réception et historique.
- [x] Raccorder les entrepôts aux ventes, mouvements et inventaires sans rupture du mode hors connexion.
- [x] Tester le cloisonnement multi-entreprise, les transferts et publier le correctif.

## Incident — données non visibles
- [x] Préserver l’état courant et inventorier les données par périmètre entreprise sans écriture.
- [x] Identifier le compte ou périmètre qui affiche une application vide.
- [x] Proposer une récupération non destructive à valider avant toute modification.
- [x] Restaurer uniquement après accord explicite, vérifier les données récupérées et publier un checkpoint.
- [x] Rattacher le compte administrateur confirmé au périmètre entreprise contenant les données existantes.
- [x] Vérifier et rattacher le compte vendeur au périmètre entreprise confirmé sans modifier ses autorisations.

## Ajustements — connexion, encaissement et filtres
- [x] Supprimer le lien d’inscription doublonné et conserver uniquement celui sous le bouton de connexion.
- [x] Masquer entièrement les agents définis par défaut dans l’écran d’encaissement.
- [x] Ajouter le vendeur aux filtres par agent dans les listes de documents concernées.
- [x] Tester les ajustements et publier le correctif.

## Suppression en masse sécurisée
- [x] Définir les ressources admissibles, les dépendances protégées et le contrôle administrateur par entreprise.
- [x] Ajouter les mutations groupées avec aperçu, confirmation renforcée et journal d’audit.
- [x] Ajouter la sélection multiple et les confirmations dans les listes concernées.
- [x] Tester les refus vendeur, les accès inter-entreprises, les données liées et publier le correctif.

## Entrepôt actif pour l’administration
- [x] Définir une préférence d’entrepôt actif isolée par utilisateur et entreprise.
- [x] Ajouter un sélecteur d’entrepôt global réservé à l’administrateur.
- [x] Raccorder les vues de gestion des stocks, produits, mouvements et inventaires au dépôt actif.
- [x] Tester la persistance, le cloisonnement et publier le correctif.

## Vue d’exploitation complète par entrepôt
- [x] Auditer les documents, ventes, indicateurs, agents et dépenses pouvant être filtrés par entrepôt.
- [x] Étendre les contrats serveur avec des filtres d’entrepôt strictement validés.
- [x] Raccorder le tableau de bord, les listes commerciales, les historiques et les statistiques d’agents au dépôt actif.
- [x] Tester la cohérence des totaux, l’isolation multi-entreprise et publier le correctif.

## Pilotage consolidé et affectations vendeur-entrepôt
- [x] Définir les indicateurs comparatifs par entrepôt et leurs règles d’agrégation.
- [x] Créer les affectations vendeur-entrepôt avec contrôles multi-entreprise et audit.
- [x] Restreindre les sélections opérationnelles d’un vendeur aux entrepôts qui lui sont attribués.
- [x] Ajouter le tableau de bord comparatif et l’interface d’affectation administrateur.
- [x] Tester les calculs, l’isolation et les accès vendeur, puis publier le correctif.

## Correctif — affectations des vendeurs
- [x] Corriger la boucle de rendu à l’ouverture de la fenêtre « Gérer les dépôts ».
- [x] Tester l’ouverture, la sélection et l’enregistrement d’affectations vendeur-entrepôt.
- [x] Publier le correctif sans modifier les affectations existantes.

## Recherche vendeur dans les affectations
- [x] Ajouter une recherche de vendeur dans la liste d’affectation des entrepôts.
- [x] Afficher un état explicite lorsqu’aucun vendeur ne correspond.
- [x] Tester la recherche et publier le correctif.

## Portée multi-entrepôts des agents commerciaux
- [x] Définir les modes Tous les entrepôts, Entrepôts sélectionnés et Attribution commerciale seule.
- [x] Ajouter la persistance et l’audit de la portée ainsi que des entrepôts sélectionnés.
- [x] Appliquer la portée aux consultations, actions opérationnelles et statistiques des agents commerciaux.
- [x] Ajouter la configuration administrateur dans la gestion des agents.
- [x] Tester les rôles, l’isolation et publier le correctif.

## Tableau des commissions par agent et entrepôt
- [x] Définir les agrégats de commissions, paiements et soldes par agent, entrepôt et période.
- [x] Créer une procédure sécurisée de rapport financier multi-entrepôts.
- [x] Ajouter le tableau filtrable dans la gestion des agents et rémunérations.
- [x] Tester les calculs et publier le correctif.

## Exploitation multi-entrepôts : rôles, transferts et seuils
- [x] Définir les rôles Responsable, Caissier et Vendeur par entrepôt avec permissions associées.
- [x] Créer les affectations utilisateur-entrepôt sécurisées et auditables.
- [x] Finaliser les transferts brouillon, en transit et réceptionnés avec leurs contrôles de cycle de vie.
- [x] Ajouter les seuils de réapprovisionnement et alertes de stock bas par produit et entrepôt.
- [x] Créer les interfaces d’administration des rôles, des transferts et des seuils locaux.
- [x] Tester permissions, stocks, alertes, transfert et publication.

## Notifications ciblées de rupture par entrepôt
- [x] Identifier les responsables actifs de chaque dépôt et les notifications de stock existantes.
- [x] Déclencher une notification unique lorsqu’une alerte locale devient active.
- [x] Signaler la résolution aux responsables lorsque le seuil est de nouveau respecté.
- [x] Tester le ciblage, la déduplication et publier le correctif.

## Urgences, accusés et e-mails de rupture
- [x] Définir les niveaux d’urgence à partir des jours de couverture estimés.
- [x] Ajouter l’accusé de réception par un responsable d’entrepôt.
- [x] Reporter l’opt-in e-mail transactionnel jusqu’à une configuration explicite du fournisseur, conformément à la demande utilisateur.
- [x] Afficher l’urgence et l’accusé de réception dans les alertes et notifications.
- [x] Tester les règles, les destinataires et publier le correctif.

## Pages d’information et assistance
- [x] Ajouter la page Aide avec les parcours d’assistance essentiels.
- [x] Ajouter les Conditions d’utilisation.
- [x] Ajouter la Politique de sécurité.
- [x] Ajouter la page Contactez-nous et les liens de navigation associés.
- [x] Tester la navigation et publier les pages.

## Demandes d’assistance sécurisées
- [x] Définir les données de demande, les statuts et les limites de pièces jointes image.
- [x] Ajouter une persistance cloisonnée par entreprise et un stockage S3 des captures.
- [x] Créer le formulaire sécurisé de contact avec validation et protection contre les abus.
- [x] Ajouter un registre administratif des demandes d’assistance.
- [x] Tester validation, autorisations, pièce jointe et publication.

## Audit de préparation commerciale
- [x] Auditer sécurité, isolation multi-entreprise et gestion des accès.
- [x] Auditer sauvegardes, exploitation, support et conformité de production.
- [x] Évaluer les éléments commerciaux indispensables avant la vente.
- [x] Produire une feuille de route priorisée de mise sur le marché.

## Expérience utilisateur, exports et tarification
- [x] Standardiser les chargements et confirmations des actions critiques.
- [x] Ajouter les exports CSV d’inventaire et de rapports de ventes.
- [x] Créer une page de tarification SaaS claire et accessible.
- [x] Réorganiser la navigation latérale par sections professionnelles.
- [x] Tester les parcours et publier le correctif.

## Correctifs TVA, thème et entrepôt
- [x] Corriger le faux doublon lors de la création des taux TVA prédéfinis.
- [x] Définir #2563EB comme couleur principale par défaut et corriger les contrastes des boutons.
- [x] Retirer le code affiché sous le sélecteur d’entrepôt dans le pied de page.
- [x] Ajouter la bascule clair/sombre au header.
- [x] Ajouter les modes manuel, suivant le système et automatique selon l’heure dans les paramètres.
- [x] Tester thèmes, TVA et affichage puis publier le correctif.

## Correctif de lisibilité des thèmes
- [x] Corriger les boutons bleus de facture et devis dont le texte reste sombre.
- [x] Corriger l’indicateur actif du menu latéral avec le texte contrasté.
- [x] Corriger les alertes de seuil dont le texte jaune manque de contraste.
- [x] Tester les contrastes en thème bleu et publier le correctif.

## Panneau d’administration SaaS
- [x] Auditer les capacités, rôles et routes d’administration existants.
- [x] Définir le périmètre sécurisé du pilotage des entreprises, comptes, support et exploitation.
- [x] Prioriser les fonctionnalités de production et les garde-fous requis.
- [x] Produire un plan de réalisation du panneau d’administration.

## P0 — Panneau d’administration plateforme
- [x] Créer le rôle plateforme séparé et la liste blanche d’opérateurs.
- [x] Créer l’audit plateforme immuable et les événements de cycle de vie des entreprises.
- [x] Créer les procédures sécurisées de liste, détail minimal, activation et suspension d’entreprises.
- [x] Créer l’interface séparée de gestion des entreprises sans accès aux données métier.
- [x] Tester les accès inter-entreprises, l’audit et publier le lot P0.

## Correctif — lisibilité de la console plateforme
- [x] Auditer les surfaces, textes, badges, champs et actions de la console dans les thèmes clair et sombre.
- [x] Remplacer les associations de couleurs insuffisamment contrastées par des tokens sémantiques accessibles.
- [x] Vérifier les états normaux, focus, survol, chargement et dialogue de suspension, puis publier le correctif.

## P1 — Exploitation SaaS de la plateforme
- [x] Ajouter un tableau de santé par entreprise : statut, dernier accès, synchronisation, sauvegarde et incidents ouverts, sans données métier.
- [x] Enrichir la console plateforme avec un tableau de bord global : répartition active/suspendue, inscriptions récentes, activité récente, demandes support et événements de cycle de vie, uniquement à partir de métadonnées SaaS.
- [x] Ajouter un registre support plateforme avec triage, affectation, statut, priorité et journal d’actions, limité aux métadonnées de demande.
- [x] Ajouter une gestion sécurisée des opérateurs plateforme avec rôles granulaires, invitation contrôlée, révocation et audit immuable.
- [x] Ajouter une fiche entreprise plateforme avec plan, limites, statut administratif, contacts autorisés, événements de cycle de vie et actions auditées.
- [x] Ajouter des filtres, recherche avancée, pagination et exports administratifs ne contenant aucune donnée métier client.
- [x] Définir le socle abonnement et facturation SaaS côté serveur, sans activer de paiement avant la configuration d’un prestataire.
- [x] Tester les permissions plateforme, l’absence de fuite des données métier et les rendus clair/sombre avant publication par sous-lot.

## Plan directeur de mise en place
- [x] Rédiger et livrer un planning complet de mise en place de StockPilot Pro, couvrant produit, sécurité, données, offline, exploitation, support, abonnements, conformité et commercialisation.

## Exécution autonome de la feuille de route
- [x] Enchaîner automatiquement les sous-lots sûrs du panneau SaaS après leurs validations, tests, contrôles d’isolation et checkpoints, jusqu’aux seules décisions irréversibles ou intégrations nécessitant des secrets externes.

## Échéances de salaires et dépenses
- [x] Définir les échéances uniques et récurrentes de salaires et dépenses, avec entreprise, entrepôt facultatif, responsable et statut de règlement.
- [x] Ajouter des rappels internes configurables avant échéance et des alertes de retard visibles aux rôles autorisés, sans e-mail ni service externe.
- [x] Mettre en œuvre le traitement périodique idempotent des rappels et son journal d’exécution.
- [x] Créer les vues calendrier, liste d’alertes, filtres et actions de règlement sans double comptage de dépenses.
- [x] Tester l’isolation multi-entreprise, les portées d’entrepôt, les rappels et publier le module.

## Liaison échéances, dépenses et paie
- [x] Ajouter des modèles d’échéances réutilisables pour les dépenses, un agent ou un groupe d’agents, avec associations cloisonnées.
- [x] Permettre de créer ou lier une échéance depuis la création d’une dépense et d’un agent, sans créer de doublon financier.
- [x] Adapter les échéances mensuelles à une saisie contrôlée du jour du mois et préserver les dates précises pour les échéances ponctuelles.
- [x] Afficher les liaisons et les prochains règlements dans les pages Dépenses, Agents et Échéances.
- [x] Tester l’isolation multi-entreprise, les groupes, les règlements et publier le lot.

## Gestion avancée des échéances et trésorerie
- [x] Ajouter l’édition et l’archivage sécurisés des modèles d’échéance et groupes de bénéficiaires.
- [x] Attacher un justificatif sécurisé à un règlement d’échéance et le rendre accessible dans la portée autorisée.
- [x] Ajouter un rapport prévisionnel mensuel des sorties programmées, paiements attendus et solde engagé par entrepôt.
- [x] Tester l’isolation, les pièces jointes, les calculs prévisionnels et publier le lot.

## Navigation de la console plateforme
- [x] Créer un header plateforme distinct avec identité, accès rapide, indicateurs et menu opérateur.
- [x] Créer une barre latérale responsive organisant les fonctions par opérations, entreprises, support, abonnements et audit.
- [x] Raccorder les sections de navigation aux permissions plateforme sans afficher d’outil non autorisé.
- [x] Vérifier les contrastes, le responsive, les états de chargement et publier la console restructurée.

## Notifications de la console plateforme
- [x] Ajouter un centre de notifications dans le header pour les paiements à surveiller et les échéances à venir.
- [x] Protéger les alertes par rôle plateforme et ne retourner que les métadonnées administratives autorisées.
- [x] Permettre de marquer les alertes comme lues et de rejoindre la section concernée sans exposer de données client.
- [x] Tester les permissions, les compteurs et le rendu responsive, puis publier.

## Pages dédiées de la console plateforme
- [x] Déplacer la navigation secondaire du header vers la barre latérale gauche de la console.
- [x] Créer des pages dédiées pour Entreprises, Support, Opérateurs, Abonnements et Journal d’audit.
- [x] Conserver le tableau de bord comme vue de synthèse sans répéter les outils détaillés.
- [x] Préserver les restrictions de rôle, les états de chargement, les contrastes et le responsive sur chaque page.

## Compétence réutilisable
- [x] Création d’une compétence réutilisable annulée à la demande avant son initialisation.

## Audit global de StockPilot Pro
- [x] Auditer la sécurité, l’authentification, les autorisations et l’isolation multi-entreprises.
- [x] Auditer le schéma, les migrations, l’intégrité métier, l’offline/PWA et les automatisations planifiées.
- [x] Auditer les tests, le build, les performances, l’accessibilité, les interfaces et les régressions observables.
- [x] Produire un rapport complet, priorisé et exploitable des failles, limites, incohérences et améliorations restantes.

## Plan de remédiation de production
- [x] Rédiger un plan complet de correction et d’amélioration issu de l’audit, avec lots, dépendances, critères go/no-go, tests et gouvernance de publication.

## Remédiation de production — exécution A à J
- [x] Lot A : corriger les dépendances vulnérables et renforcer la baseline de release.
- [x] Lot B : renforcer l’isolation structurelle des données et les contraintes multi-entreprises.
- [x] Lot B : rattacher les quatre enregistrements historiques identifiés à l’unique entreprise, conformément à la confirmation explicite reçue, puis imposer les clés entreprise obligatoires.
- [x] Lot B : résoudre la collision historique d’un code d’entrepôt par suffixe technique confirmé avant le rattachement, sans modifier les liaisons par identifiant.
- [x] Lot B : mettre à jour les doubles de test pour refléter le contexte entreprise obligatoire sans affaiblir les contrôles de production.
- [x] Lot C : étendre la sauvegarde, la restauration et la continuité multi-entreprises.
- [x] Lot C : définir les objectifs RPO/RTO, la fréquence, la rétention et le mode de restauration applicables à la production — RPO 6 h, RTO 8 h, fréquence 6 h et conservation de 30 archives.
- [x] Lot C : étendre les snapshots aux données métier multi-entrepôts et financières absentes, avec validation de périmètre et de références.
- [x] Lot C : appliquer la politique validée de sauvegarde toutes les 6 h et de conservation de 30 archives aux réglages nouveaux et existants.
- [x] Lot C : ajouter un contrôle d’intégrité et une simulation de restauration sans écriture avant toute restauration destructive.
- [x] Lot C : aligner les doubles et attentes de test des sauvegardes avec la rétention minimale de production de 30 archives.
- [x] Lot C : aligner les libellés et limites d’interface de sauvegarde sur la politique validée de 6 h et 30 archives.
- [x] Lot C : consolider les réglages de sauvegarde dupliqués afin de garantir une seule planification active par entreprise.
- [x] Lot D : durcir l’authentification, les autorisations, les fichiers et l’audit.
- [x] Lot D : indexer et normaliser l’adresse e-mail afin d’éviter les recherches d’utilisateurs en mémoire dans les flux d’authentification et d’inscription.
- [x] Lot D : empêcher l’accès direct non authentifié aux objets de stockage et vérifier la portée entreprise avant toute lecture de pièce jointe.
- [x] Lot D : acheminer les liens de pièces jointes par un téléchargement autorisé et tenant-scopé, avec redirection signée côté serveur.
- [x] Lot D : contrôler côté serveur l’appartenance des justificatifs de règlement avant leur rattachement à une occurrence.
- [x] Lot D : couvrir par tests la recherche e-mail, la révocation de session et les refus d’accès aux fichiers hors périmètre.
- [x] Lot E : fiabiliser les automatisations et la supervision opérationnelle.
- [x] Lot E : enregistrer des exécutions de tâches tenant-scopées avec statut, durée, corrélation et idempotence temporelle.
- [x] Lot E : isoler le traitement des rappels d’échéance par entreprise afin qu’un échec local ne bloque pas les autres périmètres.
- [x] Lot E : exposer à la console plateforme un résumé agrégé de santé des automatisations sans ligne métier ni contenu client.
- [x] Lot E : couvrir les doublons, les pannes isolées et les métriques de tâche, puis vérifier les parcours de release.
- [x] Lot F : compléter le mode offline-first durable par entreprise et entrepôt.
- [x] Lot F : étendre le périmètre IndexedDB des opérations métier à l’entreprise, l’utilisateur et l’entrepôt actif.
- [x] Lot F : purger ou isoler les caches et files au changement d’entreprise, d’utilisateur ou d’entrepôt sans supprimer le périmètre précédent.
- [x] Lot F : refuser la mise en file ou la synchronisation d’une opération dont l’entrepôt ne correspond plus au périmètre actif.
- [x] Lot F : afficher la fraîcheur locale et distinguer les quantités de stock estimées hors connexion des données confirmées.
- [x] Lot F : couvrir les changements de périmètre, les doublons et les conflits de stock par des tests de non-régression.
- [x] Lot G : consolider l’intégrité métier, stock et financière.
- [x] Lot G : rendre les règlements d’échéance et paiements agents idempotents à partir d’une clé de demande persistée et unique par entreprise.
- [x] Lot G : vérifier côté serveur les bénéficiaires de paie, leur entreprise et leur état actif avant toute écriture financière.
- [x] Lot G : interdire qu’une dépense ou un paiement agent réel soit rattaché à plusieurs règlements d’échéance.
- [x] Lot G : ajouter des tests de conservation des totaux, de doublon de demande et de refus de bénéficiaire hors périmètre.
- [x] Lot G : verrouiller atomiquement l’état des encaissements et remboursements avant tout mouvement de stock ou écriture de commission.
- [x] Lot H : renforcer qualité, accessibilité et recette de release.
- [x] Lot H : supprimer les transitions contrôlé/non contrôlé des sélecteurs critiques et les couvrir par une règle de rendu stable.
- [x] Lot H : étendre la vérification de release aux routes sensibles supplémentaires et à l’audit statique de périmètre tenant.
- [x] Lot H : aligner la CI sur l’audit de production, les migrations générées et les contrôles de qualité réellement exécutables.
- [x] Lot H : vérifier les parcours essentiels sur desktop et mobile, les contrastes, la navigation clavier et les états de chargement.
- [ ] Lot I : préparer paiement et abonnement SaaS avec YengaPay sous validation externe.
- [x] Lot I : vérifier la documentation YengaPay, les pays, devises, flux de test et exigences de webhook avant toute activation.
- [ ] Lot I : concevoir des références de paiement uniques, des webhooks vérifiés et une réconciliation sans activation côté client.
- [ ] Lot I : demander les identifiants de test et les paramètres commerciaux/fiscaux uniquement après validation du flux retenu.
- [ ] Lot I : couvrir les scénarios test réussis, annulés, expirés, doublons, retardés et reçus dans un ordre inversé.
- [x] Lot I : préparer la réception webhook YengaPay SANDBOX avec vérification HMAC-SHA256, journal idempotent et refus des événements non autorisés.
- [x] Lot I : différer explicitement la création PayIn, la vérification de statut et l’activation d’abonnement jusqu’à obtention de la clé API SANDBOX.
- [ ] Lot I : configurer l’organisation et le projet YengaPay SANDBOX côté serveur, sans les exposer au navigateur.
- [ ] Lot I : créer une demande PayIn SaaS idempotente avec référence interne et checkout hébergé YengaPay.
- [ ] Lot I : réconcilier l’intention et le paiement côté serveur avant tout changement de souscription.
- [ ] Lot I : tester les flux SANDBOX et les notifications rejouées sans activer le projet YengaPay de production.
- [ ] Lot I : modéliser l’offre Test à 1 000 XOF par mois et des intentions de paiement SaaS tenant-scopées.
- [ ] Lot I : autoriser uniquement le propriétaire d’une entreprise à créer un checkout YengaPay SANDBOX pour son offre.
- [ ] Lot I : créer le PayIn YengaPay côté serveur avec référence idempotente, retour utilisateur sans confiance et journal de réconciliation.
- [ ] Lot I : activer un abonnement mensuel seulement après rapprochement du paiement confirmé par le fournisseur.
- [x] Lot I : transformer l’offre existante Premium en offre Test à 1 000 XOF par mois, avec un essai d’un jour, après migration non destructive.
- [x] Offres SaaS : ajouter prix et modalité mensuelle, annuelle ou à vie au modèle de plan et au formulaire d’administration.
- [x] Offres SaaS : valider côté serveur les montants, devises et modalités, puis afficher une tarification lisible dans la console.
- [x] Lot J : préparer conformité, gouvernance et lancement contrôlé, sous réserve des validations externes documentées dans le registre.
- [x] Lot J : produire un registre de préparation au lancement distinguant les contrôles techniques validés, les responsabilités et les prérequis externes.
- [x] Lot J : consolider les procédures internes de sécurité, continuité, incident et support à partir des contrôles réellement disponibles dans l’application.
- [x] Lot J : ajouter un parcours de vérification de préparation commerciale sans promettre de conformité juridique ni de risque nul.
- [x] Lot J : exécuter les contrôles de release finaux et documenter les décisions requises avant d’activer les paiements ou une ouverture commerciale large.


## Correctif prioritaire — stabilité hors connexion et intégration en pause (13 octobre 2026)

- [x] Maintenir YengaPay SANDBOX désactivé : aucun checkout, paiement, abonnement ou appel PayIn ne sera déclenché pendant ce correctif.
- [x] Supprimer la télémétrie de prévisualisation à cadence de 2 s et empêcher toute actualisation automatique non sollicitée de l’interface.
- [x] Rendre les mises à jour PWA explicites et différées afin qu’elles ne rechargent jamais une session active sans action de l’utilisateur.
- [x] Stabiliser le cache React Query par portée entreprise-utilisateur-entrepôt, sans purge ni réhydratation quand la portée métier est inchangée.
- [x] Désactiver les revalidations réseau automatiques incompatibles avec l’usage hors connexion, tout en conservant la synchronisation déclenchée par retour réseau ou action utilisateur.
- [x] Ajouter des tests unitaires des politiques de cache et de mise à jour PWA, puis exécuter typage, tests, build et vérification de release.
- [x] Documenter honnêtement la mise en pause YengaPay et le correctif offline, puis créer un checkpoint de validation.
