# Instructions de reprise — Nouvelle conversation StockPilot Pro

## Option recommandée : reprendre dans le même projet Manus

1. Ouvrez une **nouvelle conversation dans le projet Manus « StockPilot SaaS »**. Ne créez pas un nouveau projet.
2. Ne réimportez pas l’archive ZIP dans ce projet : les fichiers, la base de données, les secrets, les checkpoints et le domaine sont déjà associés au projet existant.
3. Joignez ou indiquez le fichier `RESUME_CONTINUITE_PROJET.md` si la nouvelle conversation ne le reçoit pas automatiquement.
4. Collez le prompt ci-dessous dans la nouvelle conversation.

```text
Reprends le projet StockPilot Pro dans le projet Manus existant.

Avant toute modification, lis intégralement :
1. /home/ubuntu/stockpilot-pro/RESUME_CONTINUITE_PROJET.md
2. /home/ubuntu/stockpilot-pro/todo.md
3. /home/ubuntu/stockpilot-pro/tenant-isolation-audit.md
4. /home/ubuntu/stockpilot-pro/offline-architecture.md
5. /home/ubuntu/stockpilot-pro/plan-configuration-commercialisation-saas.md

Contexte impératif :
- Le projet est dans /home/ubuntu/stockpilot-pro.
- Le dernier checkpoint de continuité est 3fe42196 ; le dernier checkpoint fonctionnel du mode hors connexion est ef3f69fd.
- Le domaine publié est https://stockpilot-gpaoheuz.manus.space et doit rester public, sans redirection vers l’authentification Manus/Google.
- L’authentification active est interne, par e-mail et mot de passe, pour administrateurs et vendeurs. Ne réactive pas Google/OAuth.
- Ne révèle ni secret, ni hash, ni token, ni identifiant sensible.
- L’application est multi-entreprise : toute lecture, écriture, archive, restauration, fichier et opération hors connexion doit être limitée à ctx.user.companyId.
- Le mode hors connexion a un socle IndexedDB dans client/src/lib/offlineStore.ts. La priorité technique est de terminer la migration de client/src/contexts/OfflineContext.tsx pour qu’IndexedDB devienne la source unique, sans dépendance résiduelle à localStorage.

Méthode obligatoire :
1. Synchronise/redémarre le serveur de développement avant l’audit.
2. Crée ou actualise un plan et ajoute les nouvelles tâches dans todo.md avant toute modification.
3. Préserve les fonctionnalités POS, factures, impressions, agents, sauvegardes et PWA existantes.
4. Après chaque lot : pnpm check, pnpm test et pnpm build.
5. Relis todo.md, marque uniquement les tâches réellement terminées, puis crée un checkpoint. Chaque checkpoint est publié automatiquement.

Commence par proposer le prochain lot concret pour finaliser la migration offline-first, puis exécute-le après vérification des fichiers ci-dessus.
```

## Option alternative : nouveau projet ou nouvel espace de travail

Cette option est moins recommandée, car elle ne récupère pas automatiquement la base de données, les secrets et le domaine publié.

1. Téléversez `stockpilot-pro-final.zip`.
2. Extrayez l’archive dans `/home/ubuntu/stockpilot-pro`.
3. Installez les dépendances avec `pnpm install`.
4. Configurez séparément la base de données, les secrets applicatifs, le domaine et les intégrations avant de démarrer.
5. Utilisez le même prompt de reprise, mais précisez que l’environnement doit être reconnecté à ses secrets et à sa base.

> Pour conserver exactement l’environnement actuel, choisissez toujours l’option recommandée : nouvelle conversation dans le même projet Manus.
