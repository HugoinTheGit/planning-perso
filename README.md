# Planning perso

Agenda + liste de tâches + courrier Gmail + réunions Google Agenda.
Fichier statique (GitHub Pages) + Supabase (données et connexion) + Google (Gmail/Agenda en lecture seule). Tout est gratuit.

Site : https://hugointhegit.github.io/planning-perso/

## Fichiers
- `index.html` : l'application
- `config.js` : adresse du projet Supabase + clé publique (sans danger dans un dépôt public)
- `supabase-db.js` : synchronisation des tâches, notes, tags, réglages + connexion Google
- `google-api.js` : lecture de Gmail et Google Agenda
- `supabase/migrations/` : tables SQL (`0001_init.sql`, `0002_google_tokens.sql`)
- `supabase/functions/google-auth/` : fonction unique (garde le jeton de renouvellement et donne un jeton Google frais). Son nom dans Supabase est réglé dans `config.js` (`googleFn`).

## Déjà fait
1. Dépôt GitHub public + GitHub Pages (branche `main`, dossier racine).
2. Projet Supabase `wkvsnjcwwmvcxwbxoxgq`, SQL `0001_init.sql` exécuté.
3. Google Cloud : identifiants OAuth (client web) ; adresses ajoutées comme utilisateurs test ; accès Gmail + Agenda (lecture seule) ajoutés ; Gmail API et Calendar API activées.
4. Supabase → Authentication → Providers → Google : client ID + secret saisis. Redirection Google : `https://wkvsnjcwwmvcxwbxoxgq.supabase.co/auth/v1/callback`.
5. Supabase → Authentication → URL Configuration : Site URL = l'adresse GitHub Pages.

## À faire une seule fois (connexion durable, sans expiration après 1 h)
1. SQL Editor : coller et exécuter `supabase/migrations/0002_google_tokens.sql`.
2. Edge Functions → créer une fonction, coller `supabase/functions/google-auth/index.ts`, **désactiver « Verify JWT »**, Deploy. Si son nom n'est pas `dynamic-task`, le mettre dans `config.js`.
3. Edge Functions → Secrets : ajouter `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` (mêmes valeurs que dans Google Cloud). Ne jamais les mettre dans le dépôt.
4. Sur le site : avatar → « Reconnecter Google » (une fois, pour enregistrer le jeton).

Sans cette étape, la connexion fonctionne mais Gmail/Agenda demandent de se reconnecter toutes les heures.

## Utilisation
- Connecté : tâches et notes enregistrées en ligne (Supabase), synchronisées entre appareils.
- Non connecté : tout reste sur l'appareil.
- Réglages : export PDF/JSON, import JSON (fusion ou remplacement), suppression de toutes les données (en ligne et locales).
