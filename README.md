# Planning perso

Une application personnelle pour organiser sa journée, son mois et son courrier, au même endroit.

Site : https://hugointhegit.github.io/planning-perso/

## À quoi ça sert

- **Un calendrier** avec trois vues : mois, semaine et jour.
- **Une liste de tâches par jour**, avec des sous-tâches, des étiquettes (tags), des notes et un suivi de ce qui est fait.
- **Une recherche** dans les tâches et les notes.
- **Google Agenda** : affiche tes réunions du jour à côté de tes tâches (lecture seule).
- **Gmail** : un espace « Courrier » pour lire tes mails récents (lecture seule, rien n'est envoyé ni supprimé).
- **Sauvegarde** : export en PDF ou en JSON, import d'un JSON (fusion ou remplacement), et suppression de toutes les données.
- **Mobile** : une barre de navigation en bas de l'écran sur téléphone.

Sans compte, tout reste sur l'appareil. Avec une connexion Google, tes tâches et tes notes sont enregistrées en ligne et retrouvées sur tous tes appareils.

## Comment c'est construit

Le projet est volontairement simple et gratuit :

| Partie | Rôle | Où |
|---|---|---|
| Interface | Une seule page web (HTML, CSS et JavaScript, sans framework) | `index.html` |
| Hébergement | Le site est servi par GitHub Pages | ce dépôt (public) |
| Données et connexion | Base de données Postgres, connexion Google, sécurité par ligne | Supabase |
| Gmail et Agenda | Lecture via les API Google | `google-api.js` |
| Synchronisation | Enregistre et relit tes données dans Supabase | `supabase-db.js` |
| Renouvellement Google | Garde l'accès Google valide sans te reconnecter toutes les heures | `supabase/functions/google-auth/` |

### Fichiers

- `index.html` : toute l'application.
- `config.js` : adresse du projet Supabase et clé publique. Cette clé peut être publique, car la sécurité repose sur les règles de la base (chacun ne voit que ses données).
- `supabase-db.js` : adaptateur qui relie l'application à Supabase (tâches, notes, tags, réglages, connexion).
- `google-api.js` : appels à Gmail et Google Agenda, avec un petit cache pour ne pas recharger inutilement.
- `supabase/migrations/` : création des tables SQL (`0001_init.sql`, `0002_google_tokens.sql`).
- `supabase/functions/google-auth/index.ts` : petite fonction serveur qui enregistre le jeton de renouvellement Google et fournit un jeton frais.

### Sécurité

- Le **secret Google** et la **clé `service_role`** de Supabase ne sont jamais dans le dépôt. Ils sont enregistrés dans Supabase (Edge Functions → Secrets).
- Le jeton de renouvellement Google est stocké dans une table que le navigateur ne peut pas lire.
- Chaque ligne de données est liée à son propriétaire : une personne ne peut pas lire les données d'une autre.

## Installation (une seule fois)

### Déjà fait
1. Dépôt GitHub public, avec GitHub Pages activé (branche `main`, dossier racine).
2. Projet Supabase créé, et migration `0001_init.sql` exécutée.
3. Projet Google Cloud : identifiants OAuth (client web), API Gmail et Google Agenda activées, accès en lecture seule demandés, comptes de test ajoutés.
4. Supabase → Authentication → Providers → Google : identifiant et secret client renseignés. Adresse de redirection Google : `https://wkvsnjcwwmvcxwbxoxgq.supabase.co/auth/v1/callback`.
5. Supabase → Authentication → URL Configuration : Site URL = l'adresse GitHub Pages.

### Reste à faire pour une connexion durable
1. **SQL Editor** : exécuter `supabase/migrations/0002_google_tokens.sql`.
2. **Edge Functions** : créer une fonction (nom au choix, par défaut `dynamic-task`), coller le contenu de `supabase/functions/google-auth/index.ts`, puis **désactiver « Verify JWT »** dans Settings et déployer. Si tu lui donnes un autre nom, mets-le dans `googleFn` dans `config.js`.
3. **Edge Functions → Secrets** : ajouter `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` (mêmes valeurs que dans Google Cloud).
4. Sur le site : avatar → « Reconnecter Google », une seule fois.

Sans cette étape, la connexion fonctionne, mais l'accès Gmail et Agenda expire au bout d'une heure.

## Ajouter des utilisateurs

Tant que l'application Google est en mode **Test**, seules les adresses ajoutées dans Google Cloud (Google Auth Platform → Audience → Utilisateurs test) peuvent se connecter. Elles doivent se reconnecter environ tous les 7 jours.

Pour ouvrir à tout le monde, il faut publier l'application et passer la vérification de Google, qui demande une politique de confidentialité, un domaine et une vidéo de démonstration.

## Utilisation

- **Connecté** : tes données sont enregistrées en ligne (Supabase).
- **Non connecté** : tout reste sur l'appareil.
- **Réglages** : export PDF/JSON, import JSON, suppression de toutes les données (en ligne et sur l'appareil).

## Dépannage

- **« L'accès à Google Agenda n'est pas autorisé »** : vérifier que les API Gmail et Google Calendar sont activées dans Google Cloud, puis reconnecter Google en cochant toutes les autorisations.
- **Pas de mise à jour visible** : recharger la page avec Ctrl+Maj+R.
