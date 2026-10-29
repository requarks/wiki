---
paths:
  - "backend/models/pageLifecycle.ts"
  - "backend/api/pageLifecycle.ts"
  - "backend/tasks/simple/process-lifecycle-rules.ts"
  - "backend/notifications/categories/pageLifecycle.ts"
  - "frontend/src/components/PageLifecycle*.vue"
---

# Page lifecycle rules

What happens to a page as it ages, set in the **Lifecycle Rules** section of its properties panel.
`models/pageLifecycle.ts`, `api/pageLifecycle.ts`; on the frontend `PageLifecycleRuleDialog.vue` and
`PageLifecycleBanner.vue`. A rule is a trigger counted in days — `contentAge`, `commentAge` or
`interval` — and one or more actions: `banner`, `notify` (the page's owners, as the `pageLifecycle`
notification category), `move`, `tags` and `remove` — the rule deleting itself once its `fireCount`
reaches `after`. Every firing counts towards it whatever came of the actions, removal is settled
after them, and a rule whose only action is `remove` is refused.

- **Not page content**, like the owners (`pageOwners`): `pageLifecycleRules` is its own table, saved
  by `PUT …/lifecycle-rules` after the page save (`pageSaveLifecycleRules`), in no version, never
  exported to storage, not copied by a duplicate or a restore. The panel's edit is held in
  `editorStore.lifecycleRules`, beside the page store, for the reason `editorStore.ownership` is.
- **A rule acts as whoever last wrote it**, falling back to `users.getSystemActorId()` when that account
  is gone or disabled. So a rule that is new or changed is checked against its saver: `move` needs
  `manage:pages` on the page and at the destination, `tags` needs what `retagRefusal` asks. The daily
  run asks the author again before acting, since a permission may have been lost since.
- **The daily run is in-process**, `tasks/simple/process-lifecycle-rules.ts` off `SYSTEM_SCHEDULE`,
  because moving, retagging and notifying need models a worker thread does not have. Rules fire one
  at a time and re-read their page, because a move changes what the next rule sees.
- **The "days since" triggers fire once per clock**: having fired after the moment they count from,
  they wait for it to move. That moment is the later of `pages.contentUpdatedAt` — the BODY's last
  change, which `updatePage` moves only when `content` changed — and `pages.lastReviewedAt`
  (`commentAge` uses the last comment, or the page's creation, instead of the body). `interval` counts
  from its own last firing.
- **One banner per page**, refused at save. It lives on `pages.lifecycleBanner`, shown to every
  reader, and goes when somebody marks the page reviewed (`PUT …/reviewed`: an owner, `write:pages` or
  `manage:pages`), which also sets `lastReviewedAt`. A save of the rules that removes the banner's
  rule takes the banner down with it — but a rule that REMOVES ITSELF leaves its banner up, which is
  what a show-once rule is for, so `replaceRules` only clears a banner whose rule this save had.
- **A move's path takes `{pagePathName}`** (the last segment) **and `{pagePath}`** (all of it). A page
  already under what comes before `{pagePath}` is left where it is, or `/archived/{pagePath}` would
  nest it deeper on every firing. A destination already taken is skipped, and every firing records
  its outcome on the rule (`lastOutcome`), which the panel shows.
- `contentUpdatedAt`, `lastReviewedAt` and `lifecycleBanner` are in `EXCLUDED_FROM_META`
  (`models/pageHistory.ts`): bookkeeping a version must not carry or a restore put back.
