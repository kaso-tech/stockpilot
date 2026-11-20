# Notes d’intégration YengaPay — vérification initiale

**Date de vérification :** 29 août 2026.

La page officielle YengaPay décrit une API REST de paiement entrant, un environnement d’intégration indiqué par le champ `apiEnv`, une page de checkout hébergée et des notifications par webhook. Le flux annoncé consiste à créer un paiement côté serveur, obtenir un identifiant et une URL `checkoutPageUrlWithPaymentToken`, rediriger l’utilisateur, puis attendre la notification serveur de confirmation. L’interface client ne doit donc jamais activer un abonnement sur la seule base de la redirection de retour. [1]

Les champs publiquement documentés comprennent au minimum `paymentAmount`, `reference`, `apiEnv`, `articles`, `customerNumber` et `paymentSource`; l’authentification de l’exemple emploie l’en-tête `x-api-key`. L’exemple public utilise le domaine `https://api.yengapay.com/` et une monnaie `XOF`. Ces informations doivent être confrontées au projet et à la documentation privée du compte marchand avant toute intégration : les identifiants de groupe/projet, les valeurs autorisées, le schéma de signature du webhook, les URLs d’environnement et les règles de remboursement n’étaient pas vérifiables publiquement. [1]

La documentation détaillée est publiée via une page Notion qui redirige vers un site externe ; son contenu n’était pas accessible au navigateur de vérification sans la redirection correspondante. Il ne faut donc pas déduire ni inventer le format de signature, les endpoints complets, les en-têtes complémentaires ou les statuts définitifs à partir de la page marketing. Ces éléments devront être fournis par le compte marchand ou confirmés auprès de YengaPay avant la configuration des secrets et du webhook.

## Informations confirmées par la documentation fournie

La documentation accessible précise qu’un compte marchand, une organisation, un projet et une clé API sont nécessaires. Elle distingue deux projets créés à l’ouverture du compte : `SANDBOX` pour tous les essais et un projet de production. Le montant minimal annoncé pour un paiement est de **100 F**. L’intégration StockPilot utilisera le paiement entrant indirect et le checkout hébergé ; le paiement direct et les flux de décaissement ne font pas partie du lot I.

Pour les notifications, la documentation confirme une vérification **HMAC-SHA256** avec le `webhookSecret` configuré dans le projet et le header `x-webhook-hash`. Le header `x-yengapay-event` sert à distinguer les événements, dont `payment.success`, `payout.success` et `payout.failed`. YengaPay indique au plus un webhook de décaissement par transaction et statut, tout en précisant qu’une correction tardive d’état peut générer un nouvel événement distinct. Le projet doit donc conserver son propre journal d’événements, imposer l’idempotence sur les identifiants du fournisseur et recontrôler le statut côté serveur avant d’activer un abonnement.

Les chemins HTTP détaillés et les exemples de corps des notifications ne sont pas extraits en texte par la page publique. Ils doivent rester configurables et ne seront jamais reconstruits par supposition ; l’identifiant organisation, l’identifiant projet, la clé API de test et le secret webhook doivent être fournis depuis la console YengaPay.

> **Décision de sécurité :** l’intégration restera en environnement de test tant que les identifiants dédiés, la documentation de signature, les pays/devises, les conditions commerciales et la fiscalité ne sont pas confirmés par le propriétaire.

## Mise en pause opérationnelle — 13 octobre 2026

À la demande du propriétaire, l’intégration PayIn YengaPay reste **explicitement en pause**. Le verrou serveur `YENGAPAY_PAYIN_ENABLED` demeure désactivé par défaut et l’espace propriétaire affiche désormais cet état : aucun bouton ne déclenche de création d’intention, de checkout, de paiement ou d’abonnement. Les secrets SANDBOX existants ne sont ni lus, ni modifiés, ni exposés dans le cadre de cette pause.

La reprise nécessitera une validation API SANDBOX réussie, un schéma webhook confirmé, les tests de réconciliation idempotente et une décision explicite distincte avant toute activation du verrou. Aucune capacité de production n’est concernée.

## Référence

[1]: https://yengapay.com/ "YengaPay — passerelle de paiement Mobile Money"
