# API Centurie — guide pour Claude

## À quoi sert cette API

Elle sert à **gérer et piloter les comptes Instagram** des clients Centurie. On peut :
- connecter, renommer ou supprimer un compte ;
- mettre un compte en pause ou le relancer ;
- régler ses quotas quotidiens (follow, like story, like post) ;
- gérer ses cibles de prospection ;
- mettre à jour son mot de passe et sa 2FA ;
- consulter ses statistiques, ses actions, ses nouveaux followers et ses captures d'écran ;
- lire des profils Instagram publics.

Chaque compte Instagram est rattaché à un **abonnement Stripe** Centurie (`sub_…`), lui-même rattaché à un
**client Stripe** (`cus_…`).

- **Base URL** : `https://api.centuriegrowth.com`
- **Documentation interactive** : `https://api.centuriegrowth.com/docs` (Basic Auth, identifiants fournis à part)
- **Authentification** : chaque requête porte l'en-tête `Authorization: Bearer <token>`

## Les tokens

| Token | Forme | Qui l'utilise | Accès |
|---|---|---|---|
| **Admin Centurie** | `CENTURIE-ADMIN-…` (fourni à part) | serveur Centurie uniquement | tous les comptes liés aux abonnements utilisables (`active`, `trialing`, `past_due`) du compte Stripe Centurie ; il émet les tokens clients |
| **Client** | `cbk_…` | peut être remis au client | les comptes liés aux abonnements utilisables de **ce** client |
| **Backend** | `b64_…` | serveur Centurie uniquement | même accès que le token client |

Aucun token ne donne accès à des comptes hors du compte Stripe Centurie.

## Générer un token client (`cbk_`)

```bash
curl -X POST "https://api.centuriegrowth.com/admin/tokens/cus_XXXXXXXX" \
  -H "Authorization: Bearer <TOKEN_ADMIN_CENTURIE>"
```

| Code | Signification |
|---|---|
| `201` | Token créé : `{ "cus_id", "token": "cbk_…", "created": true, … }` |
| `200` | Un token existait déjà, il est renvoyé (`"created": false`) |
| `404 Unknown cus_id` | Ce `cus_id` n'est pas un client du compte Stripe Centurie (rien n'est créé) |
| `502` | Stripe est injoignable |

Autres routes :
- **Lire** le token d'un client : `GET /admin/tokens/{cus_id}` (`404 No token for this cus_id` s'il n'en a pas encore).
- **Régénérer** : `POST /admin/tokens/{cus_id}/regenerate`. L'ancien token est invalidé **immédiatement**.
- **Lister** les tokens des clients Centurie : `GET /admin/tokens`.

Le token `cbk_` est aléatoire, donc infalsifiable, et révocable par régénération. C'est lui qu'on remet à un client.

## Token backend `b64_` (sans génération préalable)

> ⚠️ **Réservé au serveur.** Ce token n'est **pas signé** : quiconque connaît un `cus_id` peut le fabriquer.
> Il ne doit **jamais** être exposé côté client : pas de front, d'URL, de QR code, d'e-mail, de log client
> ni de stockage navigateur. Si le token doit être partagé ou révocable, utilise `cbk_`.

Il permet à ton serveur d'appeler l'API au nom d'un client sans générer ni stocker de token : il se déduit
directement du `cus_id`.

```
token = "b64_" + base64url(cus_id)     # base64 URL-safe, SANS padding "="
Authorization: Bearer b64_<base64url(cus_id)>
```

| Élément | Valeur |
|---|---|
| `cus_id` | `cus_EXEMPLE0001` |
| base64url | `Y3VzX0VYRU1QTEUwMDAx` |
| **token** | `b64_Y3VzX0VYRU1QTEUwMDAx` |

```js
// Node.js
const token = 'b64_' + Buffer.from(cusId, 'utf8').toString('base64url')
```
```python
# Python
token = 'b64_' + base64.urlsafe_b64encode(cus_id.encode()).decode().rstrip('=')
```
```bash
# Bash
TOKEN="b64_$(printf %s "$CUS_ID" | base64 | tr '+/' '-_' | tr -d '=')"
```

Le token est refusé avec `401 Invalid token` dans ces cas :
- le `cus_id` ne commence pas par `cus_` ;
- il contient d'autres caractères que `A-Z a-z 0-9 _ -` ;
- l'encodage n'est pas du base64url canonique (sans `=`) ;
- le client n'existe pas dans le compte Stripe Centurie (vérifié en direct à chaque requête).

Une erreur Stripe (indisponibilité) donne un `5xx`, pas un refus d'authentification. Les droits sont
**exactement** ceux du token `cbk_` du même client. Le coût est d'un appel Stripe de plus par requête, pour
vérifier que le client existe.

## Endpoints

Toutes les routes `/account/…` existent en 2 variantes strictes : `/account/sub_id/{sub_id}/…` et
`/account/username/{username}/…` (le username est en minuscules). Les lectures de compte `/manage` en ont 2 aussi.
Un compte inexistant ou hors de ton périmètre renvoie toujours le même **404**.

**Abonnements** (token client `cbk_` ou `b64_` uniquement)
- `GET /subscriptions` : abonnements utilisables du client, avec le compte lié éventuel.
- `GET /subscriptions/{sub_id}` : détail d'un abonnement et du compte lié (sans les secrets).

**Comptes**
- `GET /accounts` : tes comptes (`?current_status=` en option). Avec un token client, les abonnements sans compte apparaissent en `unlinked`.
- `GET /accounts/detailed` : idem, avec les infos Instagram.
- `GET /accounts/actions` : export des actions de tous les comptes.

**Connexion et identifiants** (`/manage`)
- `POST /manage/connectAccount` `{username, password, sub_id}` : connecte un compte.
  - Token client : le `sub_id` doit être l'un de ses abonnements (sinon `403`).
  - Token admin : le client est déduit de l'abonnement Stripe (`422` si ce `sub_id` est inconnu de Stripe Centurie).
- `PUT /manage/updatePassword`, `PUT /manage/update2FA` (codes de secours), `PUT /manage/send2FAKey` (clé TOTP).
- `GET /manage/sub_id/{sub_id}` et `GET /manage/username/{username}` : fiche complète du compte. ⚠️ Elle contient les secrets 2FA : **serveur uniquement**.
- `DELETE /manage/delete` `{username, sub_id}` : suppression définitive. Le token admin peut supprimer même si l'abonnement est annulé.

**Gestion** (`/manage`)
- `PUT /manage/toggleActive` `{sub_id, is_active}` : pause ou reprise.
- `PUT /manage/updateExpert` `{sub_id, expert}` : active ou retire le mode Business/Expert.
- `PUT /manage/updateSubId` `{username, new_sub_id}` : rattache le compte à un autre abonnement.
- `PUT /manage/switchUsername` `{sub_id, old_username, new_username}` : ⚠️ opération sensible, renomme le compte (le nouveau @ est vérifié sur Instagram).

**Configuration** : `GET|PUT /account/…/config`
- Quotas quotidiens : `per_day_follow`, `per_day_like_story`, `per_day_like_post`.
- Mode warmup : `enabled_warmup`.

**Cibles** : `GET|POST|DELETE /account/…/targets`

**Statistiques** : `GET /account/…/stats`, `/profile-stats`, `/gains`

**Historique** : `GET /account/…/actions`, `/actionsHistory` (actions réussies, 1000 par page), `/operations` (journal des opérations)

**Followers et retours** : `GET /account/…/followers-gained`, `/followbacks`, `/prospects-sources` (paramètre `?days=`, 30 par défaut)

**Captures d'écran** : `GET /account/…/screenshots`
- Captures rangées par session, chacune avec une `url` signée valable 30 jours.
- Utilise l'`url` telle quelle, par exemple dans une balise `<img>`.

**Instagram** (lecture de profils publics, tout token valide)
- `GET /instagram/username?username=…` : **à privilégier** (option `&debug=true` pour la réponse brute).
- `GET /instagram/user/by/username`, `/user/by/id`, `/user/full/profile`, `/user/suggested/profiles`,
  `/media/pk/from/code`, `/media/code/from/pk`.
- `GET /HR/{path}` : endpoints Instagram réels de notre ferme de scraping.

## Codes de réponse courants

| Code | Cause |
|---|---|
| `401` | En-tête `Authorization` absent ou mal formé, ou token invalide |
| `403` | Route réservée à un autre type de token, ou `sub_id` qui n'est pas un abonnement du client |
| `404` | Compte ou abonnement inexistant **ou** hors de ton périmètre (réponse identique) |
| `409` | Conflit (username ou `sub_id` déjà utilisé) |
| `422` | `sub_id` inconnu de Stripe Centurie (connexion d'un compte par token admin) |
| `502` | Stripe injoignable : aucune écriture n'a été faite |

## Règles

- Ne jamais exposer le token admin ni un token `b64_` hors du serveur.
- Un token client donne un accès complet aux comptes de ce client : ne le remettre qu'à lui.
- Ne jamais committer de token ni de clé.
- Dans les exemples, n'utiliser que des usernames fictifs (`example_user`).
