---
paths:
  - "backend/api/**"
  - "backend/index.ts"
  - "backend/models/personalTokens.ts"
  - "backend/models/apiKeys.ts"
  - "backend/helpers/requester.ts"
  - "frontend/src/helpers/personalTokens.js"
  - "frontend/src/pages/ProfileTokens.vue"
  - "frontend/src/components/PersonalToken*.vue"
---

# Personal access tokens

A user's own API key, made under **Profile → Access Tokens**. `models/personalTokens.ts`,
`api/personalTokens.ts`. It is signed by the same keypair and verified by the same bearer hook as a
system API key (`models/apiKeys.ts`) — the JWT audience is what tells the two apart — and lands on
`req.apiKey` with `kind: 'personal'`. What differs is who it acts as: a system key acts for its groups
and is nobody; a personal token acts AS its owner, with their groups and permissions resolved on every
request, narrowed to its scopes.

- **Ask `requestUser(req)` / `requestUserId(req)` (`helpers/requester.ts`), not `req.session.user`**,
  on any route a token can reach. A token never fills the session in — writing to it would persist a
  session row per call — and a route that reads the session refuses the token's owner as a guest.
  `hasUserSession(req)` is the guard for refreshing the session's own copy of the user.
- **Scopes are per route and opt-in.** A route declares `config.scope`: a category (`'pages'`, level
  from the method — GET/HEAD read, anything else write) or `'category:level'` for a method that says
  the wrong thing. The bearer hook in `index.ts` refuses a token on any route without one, unless it
  is `publicAccess`. So admin routes, and the account's own credentials — password, 2FA, passkeys and
  the tokens themselves — are closed to every token without anybody having to remember to close them.
  The categories are `TOKEN_SCOPE_CATEGORIES`, mirrored in `frontend/src/helpers/personalTokens.js`.
  There is no admin category by design; automating the admin area is what system keys are for.
- **`auth.allowPersonalTokens` (Admin → Authentication → Configuration) switches use off as well as
  creation**, as does the API's own switch. The rows are kept and work again when it is turned back
  on. Revoking deletes the row; the audit log keeps the record (`meta.patId` — never `tokenId`, which
  `sanitizeMeta` would redact as a secret).
