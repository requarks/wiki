---
paths:
  - "backend/cli.ts"
  - "backend/cli/**"
---

# Management CLI

`backend/cli.ts` is maintenance and recovery from the server's own shell — `reset-password`,
`set-hostname`, `list-admins`, `grant-admin`, `enable-user`, `reset-security`, `flush-caches`,
`info`. Run as `backend/cli.ts <command>` (the shebang adds `--no-experimental-webstorage`), or
`npm run cli -- <command>` from `backend/`. Paths come from the file's own location, so it runs from
any working directory, including `docker exec` / `kubectl exec` into the image.

- **Its boundary is shell access, and it stands outside the permission model on purpose.** Whoever
  can run it can read the config and so the database credentials. That is only true while nothing
  else can start it: never add a route, a scheduled task or an admin-terminal hook that runs a
  command. The guards in `api/users.ts` and `api/groups.ts` do not apply here, which is what lets it
  recover an instance where nobody holds `manage:system` any more.
- **It boots like a worker, not a server** (`boot()` in `cli.ts`): config through `core/config.ts`
  exactly as the server reads it, then `dbManager.init(true)` — the worker path, which never migrates
  and never honours `dev.dropSchema` — the models, the settings, and the site cache. No HTTP, no
  scheduler, no startup checks. The pool has one connection, so a command must not hold a
  transaction open while it queries anything else.
- **It refuses a schema that is not its own** (`checkSchema` in `cli/runtime.ts`), comparing migration
  names on disk with the `migrations` table. Only a running instance migrates. `info` is the one
  command that runs anyway (`toleratesSchemaMismatch`), and stops before the model-backed sections.
- **Running instances hear about changes over the same NOTIFY channel they use between themselves.**
  `boot()` forwards everything emitted on `WIKI.events.outbound` — so a model method that calls
  `reloadCacheEverywhere()` or `configSvc.saveToDb()` reaches every instance without the command
  doing anything — and `main` waits for the sends before closing the pool. `ctx.broadcast` is for an
  event with no model method behind it (`flushCaches`).
- **Every change is audited** with `ctx.audit`, reusing an existing `AUDIT_ACTIONS` key and adding
  `meta.via: 'cli'`, the OS user and the host; the actor has no account. Mind `sanitizeMeta`: a meta
  key containing `token`, `password`, `secret` or `accesskey` is redacted, hence `patsRevoked`.
- **Output goes to the terminal, never through `WIKI.logger`**, which is held at `warn` (`--verbose`
  lets it through) and may be shipped somewhere. `reset-password` prints the new password once; it
  is never taken as an argument, where it would land in shell history and `/proc/*/cmdline`.
- **`reset-password` always emails the account holder when mail is configured, and has no option to
  skip it.** The mail is a security notice, not a courtesy: the CLI hands an account to whoever can
  run it, and that mail is how the owner learns of a reset they did not ask for. Do not add an
  opt-out.
- **Every command works without a terminal**: each value it would prompt for is also an option, a
  missing one fails naming the option (exit 2), and `--yes` confirms. `ctx.confirmWrite` always
  prints which database is about to change, `--yes` or not. Prompts read from one shared line
  iterator, so answers typed or pasted ahead are queued rather than swallowed by the first prompt.
- A new command is a `Command` in `cli/commands/`, added to `COMMANDS` in `cli.ts`. A command module
  is imported before `WIKI` exists, so it must not import a model at the top level — reach models
  through `WIKI.models`, or import inside the function (`createAdminGroup` does).
