# Installation et maintenance (pour le développeur)

Ce document décrit comment faire tourner sa propre copie de Planning perso : GitHub Pages pour le site, Supabase pour les données et la connexion, Google pour Gmail et Agenda. Tout se fait avec des offres gratuites.

## Fichiers

- `index.html` : toute l'application.
- `config.js` : adresse du projet Supabase, clé publique et nom de la fonction Google (`googleFn`). La clé publique peut être visible, la sécurité repose sur les règles de la base.
- `supabase-db.js` : relie l'application à Supabase (tâches, notes, tags, réglages, connexion).
- `google-api.js` : appels à Gmail et Google Agenda (lecture seule).
- `supabase/migrations/` : tables SQL (`0001_init.sql`, `0002_google_tokens.sql`).
- `supabase/functions/google-auth/index.ts` : fonction serveur qui enregistre le jeton de renouvellement Google et fournit un jeton frais.

Le **secret Google** et la **clé `service_role`** ne doivent jamais être dans le dépôt. Ils vont dans Supabase → Edge Functions → Secrets.

## Mise en place

1. **GitHub** : dépôt public, GitHub Pages activé (branche `main`, dossier racine).
2. **Supabase** : créer un projet, puis exécuter `supabase/migrations/0001_init.sql` dans le SQL Editor.
3. **Google Cloud** : créer des identifiants OAuth (client web), activer les API Gmail et Google Calendar, ajouter les scopes en lecture seule (`gmail.readonly`, `calendar.readonly`) et les comptes de test.
4. **Supabase → Authentication → Providers → Google** : renseigner l'identifiant et le secret client. Adresse de redirection Google : `https://<ton-projet>.supabase.co/auth/v1/callback`.
5. **Supabase → Authentication → URL Configuration** : Site URL = l'adresse GitHub Pages.
6. **Connexion durable** :
   - exécuter `supabase/migrations/0002_google_tokens.sql` ;
   - créer une Edge Function, y coller `supabase/functions/google-auth/index.ts`, désactiver **Verify JWT** (Settings), déployer ;
   - ajouter les secrets `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` ;
   - si le nom de la fonction n'est pas `dynamic-task`, le mettre à jour dans `config.js`.
7. Sur le site, « Reconnecter Google » une fois pour enregistrer le jeton.

## Utilisateurs

Tant que l'application Google est en mode **Test**, seuls les comptes listés dans Google Cloud (Google Auth Platform → Audience → Utilisateurs test) peuvent se connecter, et leur accès expire tous les 7 jours. Pour ouvrir à tous, il faut publier l'application et passer la vérification Google (politique de confidentialité, domaine, vidéo de démonstration).

## Dépannage

- **« L'accès à Google Agenda n'est pas autorisé »** : vérifier que les API sont activées, puis reconnecter Google en cochant toutes les autorisations. Le détail renvoyé par Google s'affiche sous le message.
- **Pas de mise à jour visible** : recharger avec Ctrl+Maj+R.
