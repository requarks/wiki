---
paths:
  - "backend/api/**"
  - "backend/helpers/audit.ts"
  - "backend/models/auditLog.ts"
  - "backend/tasks/simple/purge-audit-log.ts"
  - "frontend/src/pages/AdminAudit.vue"
  - "frontend/src/components/Audit*.vue"
---

# Audit log

Every action a **person** takes is one row in `auditLog` — `userId`, `clientIP`, `ts`, `kind`
(`page` / `asset` / `auth` / `profile` / `admin`), `action`, and a `meta` blob. Read at
`/_admin/audit` behind the `read:audit` permission; the retention setting behind `manage:system`,
because shortening it destroys evidence and that is not the same authority as looking.

- **Written from API route handlers**, through `audit(req, kind, action, meta)` in `helpers/audit.ts`
  and only ever AFTER the work succeeded. That is what excludes the scheduler by construction: a page
  the git sync imports reaches `pages.adoptStoredPage` by a path that never passes through a route,
  so it leaves no row. Don't move an audit call into a model to save a few lines — the model is
  reachable from a job, and the log would start claiming a person did it.
- **The exceptions are the auth events with no session yet**, which record themselves in
  `models/users.ts`: a login, a registration, an email confirmation, a password reset from a link, a
  forced password change. The account is only identified there, from a credential or a token, and the
  login case additionally converges six routes (local, provider, passkey, and the 2FA and
  password-change continuations) on one place. A logout is the mirror image and passes its own actor,
  since the session is destroyed before the entry is written.
- **`AUDIT_ACTIONS` in `models/auditLog.ts` is the closed list**, grouped by kind, and `AuditAction`
  is its union — so `npm run typecheck` refuses an action that is not in it. Each key is also its
  translation key (`admin.audit.actions.<action>`) and what `GET /audit/actions` serves the filter
  from, so adding an action means adding the string too. Keys are unique ACROSS kinds, which is why
  `forcedPasswordChange` (demanded at sign-in) and `changePassword` (from one's own profile) are
  named apart.
- **What is recorded and what is not.** Every mutating route, plus successful logins. Not reads —
  page views would bury everything else. Not FAILED logins: that endpoint is open to whoever can
  reach the wiki, so recording them would let anybody outside fill the table on demand
  (`models/rateLimits.ts` is what answers that). `requestPasswordReset` is recorded only when a link
  was actually sent, for the same reason.
- **`meta` carries identity, never payload and never content.** A page edit records the `pageHistory`
  version its change produced — which is why `createPage` / `updatePage` / `movePage` / `deletePage`
  return a `PageChange` rather than a page — instead of copying the before and after into a second
  table. Configuration routes record which fields were touched, not what they were set to; `security`
  is the one exception, recorded in full because none of it is a secret and its values are exactly
  what gets asked about later. `sanitizeMeta` redacts secret-shaped keys as a backstop, not as the
  rule.
- **`meta.actor` is a copy of the email, display name and IP as they stood.** `userId` is
  `on delete: set null`, so an entry outlives the account that made it — the copy is the whole reason
  the row is still readable, and the admin area reads the user column from it rather than from the
  users table, so a rename does not rewrite history.
- **Rows are purged, not kept for ever.** `purgeAuditLog` runs daily off `SYSTEM_SCHEDULE`, against
  the `audit.retentionDays` setting (`0` keeps everything). **The floor is `MIN_RETENTION_DAYS`, 30**,
  and it is not a preference: retention is the one setting whose whole effect is to destroy this
  table, and `manage:system` — the permission that changes it — belongs to exactly the person the
  table exists to record. Left free, acting and then setting retention to a day would purge the
  record before anybody had reason to look. So the API refuses anything between 1 and 30, and
  `retentionDays()` reads such a value AS 30 rather than honouring it — the second check is what
  closes the config-file and direct-database routes round the first.
