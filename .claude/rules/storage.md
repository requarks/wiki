---
paths:
  - "backend/modules/storage/**"
  - "backend/models/storage.ts"
  - "backend/models/assets.ts"
  - "backend/api/storage.ts"
  - "backend/helpers/storageFiles.ts"
  - "backend/helpers/storageObjects.ts"
  - "backend/controllers/files.ts"
  - "backend/tasks/simple/sync-storage-targets.ts"
  - "frontend/src/pages/AdminStorage.vue"
---

# Storage targets

A storage target is one module from `modules/storage/<key>/` configured for one site. Six ship, each
with a real `storage.ts`:

| Key | What it is |
| --- | ---------- |
| `db` | Enabled on every site and impossible to turn off — bytes in the asset's own row |
| `disk` | The wiki's tree as files at `<root>/<locale>/<folders…>/<file>` |
| `git` | That same tree in a repository, committed per change and synced with a remote |
| `s3` | Amazon S3 **and anything speaking its API** — R2, Spaces, B2, Wasabi, MinIO |
| `azure` | Azure Blob Storage |
| `gcs` | Google Cloud Storage |
| `sftp` | That tree again, on a remote host over SSH — a copy, never a delivery source |

A new module is a directory with a `definition.yml` and a `storage.ts` exporting the `StorageModule`
contract, and `hasImplementation` gates both dispatch and the admin area's action buttons on the
latter existing.

**`disk`, `git` and `sftp` are the same tree in three places**, and share `helpers/storageFiles.ts`
for all of it: the layout, the front matter, what makes a file a page, and `importTree`'s adoption
walk. `sftp` hands `importTree` its own `readFile` — the only thing that differs about a tree on
another machine — and uses `path.posix` throughout, since a wiki on Windows still talks to sshd in
slashes. Its connection is cached per target and serialized, because a single `ssh2-sftp-client` does
not support concurrent operations, and dropped on a connection-shaped failure so the next operation
reconnects. Unlike 2.x's SFTP module it reads as well as writes, so a site can serve from it and
import a tree that was put there from outside.

**The three object stores are one file of client calls each.** `put`, `get`, `remove` and `copy` — the
`ObjectStoreClient` in `helpers/storageObjects.ts` — and `objectStorageModule` builds the whole
`StorageModule` from them. An object key *is* a path, the same one `disk` would write, so a bucket and
a folder hold a site's content laid out identically and `pathPrefixFor` decides the shape of both.
Each of the three also takes a **`pathPrefix`**, which is the segments that key starts with — empty by
default, so the tree sits at the root of the bucket, and set when the bucket has to be shared with
something else, since an object store has no folders to keep two tenants apart. It is per target,
unlike everything `pathPrefixFor` answers, for the same reason the bucket name is: *which* store the
tree goes in and *how* the tree is laid out are different questions. It is normalized rather than
validated — surrounding and doubled slashes go, and so do `.` and `..` segments, which name a literal
object in a bucket rather than a relative path. A custom `baseUrl` still stands in for the bucket and
not for the prefix, because the key is signed prefix and all. Object stores have no rename, so
`moveObject` copies and then deletes, in that order, and never deletes on a copy that failed. Credentials are optional on all three: left empty, each SDK falls back
to the machine's own identity (an IAM role, a managed identity, a workload identity), which is how a
deployment keeps a long-lived secret out of the database. Only `exportAll` is offered — there is no
`importAll`, because nothing but the wiki writes into these buckets, which is exactly what makes git
different.

**Nothing else may live under `modules/storage/`.** `refreshFromDisk` reads every directory there and
expects a `definition.yml` in it; one without takes *every* storage module down with it, since the
read is wrapped in a single try/catch that empties `definitions`. This is why the tree logic shared by
`disk` and `git` — the front matter, the file name a page is filed under, what makes a file a page
rather than an attachment, and the walk an import does — sits in `helpers/storageFiles.ts` instead.

**Content is written to every target that claims it, and read from one.** Those are two separate
questions with two separate answers, and conflating them is the way to get this wrong:

- **Written** — a target's `contentTypes.activeTypes` says what is stored there, and a site may store
  the same kind in several places at once. An upload goes to *all* of them; the admin area's
  **Targets** tab is where that is set, per target.
- **Read** — `assetDelivery.servedTypes` names the content types a reader's request is answered from
  that target, at most one target per type across the site. The **Content Delivery** tab sets it, and
  a target may only be nominated for a type it also stores (`validateTarget` refuses the pair). Pages
  are never nominated: a page is read from its own row, always.

  **Direct access.** An object store can answer instead of being read through: `assetDelivery.mode`
  is `streaming` (the default — bytes through the wiki) or `direct`, where both serving routes
  (`controllers/files.ts` and the asset content API) answer **302 to a signed URL** and the bytes
  never touch the server. `storage.directAccessUrlFor` is the whole decision and both routes call it.
  Three things it insists on: the target must be the *nominated* source for that content type
  (`deliveryTargetsFor`'s head standing in as the database is not a nomination), the module must
  implement `presignAsset`, and the link's lifetime is capped at 7 days because no provider signs for
  longer. The redirect is cached for **half** the link's life, so a cached redirect can never outlive
  the URL in it.

  **A signed link carries none of the wiki's page rules** — it works for whoever holds it until it
  expires. That is what makes the store able to serve without asking the wiki, and it is why the
  expiry defaults to `5m`. When signing fails, the site's `storage.directAccessFallback` decides:
  `stream` (default) serves the bytes the slow way so a bad credential costs performance rather than
  every image on every page, `error` fails the request so it cannot go unnoticed. The target records a
  `warning` either way.

  **A custom `baseUrl` is signed *for*, never swapped in afterwards.** S3 and GCS sign the host, so
  rewriting it invalidates the signature: S3 builds a second client (`bucketEndpoint` with the URL as
  the `Bucket` when the domain *is* the bucket, `forcePathStyle` when the bucket is a path segment),
  GCS passes `cname`, and Azure alone can simply swap the origin because a SAS signs the
  canonicalized resource and not the host. CloudFront is therefore out of scope — it needs its own
  key pair and signing scheme.

  **A module can decline to serve at all.** `assetDelivery.isDeliverySupported` (default true; false
  only for `sftp`) keeps a target out of the Content Delivery tab, out of `sourceOptions`, and gets a
  nomination refused by `validateTarget` and cleared by `updateTarget`. It is still written to,
  exported to and imported from — the point is that every image on every page should not be an SSH
  round trip. It does stay in the read fallback list, sorted behind even the database: `offloadUnchecked`
  can leave a file whose only copy is there, and a slow answer beats telling a reader it is gone.

  **Only an explicit nomination moves delivery.** A type nobody has been nominated for is served
  from the database (`deliveryTargetsFor`), never from whichever other target happens to be enabled
  — enabling one says where content is *written*, and a target enabled after an upload holds none of
  the existing files anyway. Disabling a target therefore puts delivery back, and `updateTarget`
  clears `servedTypes` as it goes so that re-enabling it later does not silently take the content
  type with it. The database gives the role up only by not holding the type at all.

So neither an asset nor a page records where its bytes went — there is no single place — and each
target derives where its own copy sits from the tree, the same way for both. `resolveTargetFor` and
`assets.storageInfo` are gone; `writeTargetsFor` and `deliveryTargetsFor` replace them.

**Where a file sits under a target's root is one answer per site too**, and `storage.pathPrefixFor`
is the only thing that gives it: the leading segments of every path any path-based module writes,
with `parseStoredPath` as its exact inverse for reading a folder back in. Two site settings shape it,
both on the **Configuration** tab and both read through `storage.pathLayoutFor`:

- **`storage.sitePrefix`** (off) files the tree under a folder named after the site. Off because the
  configured root already *is* that site's folder; on is what lets two sites share a location, each
  ignoring the other's half of it.
- **`storage.localePrefix`** (on) brackets the tree by locale, which is what keeps `guides/logo.png`
  from being the same file in every locale. **Off, the site stores its primary locale and no other**
  — there is nowhere to put the rest — so `pathPrefixFor` answers null for them and the target is
  skipped: a page copy silently (the page is in the database either way), an asset copy after a
  `canStore` check, so that the upload still succeeds as long as some *other* target takes the bytes.

Neither setting moves anything already stored; the disk target's export and import actions are how
content crosses from one layout to the next.

**Which content type a file is, is one answer per site, not per target.** `large` is a category of
its own rather than a modifier — that is what lets a target take the 40 MB video without also taking
every thumbnail — and the size at which it starts lives in the site's config as
`storage.largeThreshold` (`storage.largeThresholdFor`, the admin area's **Configuration** tab). It
has to be shared: a file the disk target called large and the database called an image would be
claimed by neither target, or by both. The whole storage configuration of a site — the site-wide
settings and every target — is read and written as one, through `GET`/`PUT /sites/:siteId/storage`.

Everything else follows from that:

- **A write must succeed everywhere; a read may fall back.** `storage.putAsset` fans out and throws if
  any target refuses, failing the upload — an asset may have no database copy, so a half-stored one
  must not be reported as saved. **Refusing is not the same as having nowhere to put it**: a target
  whose `canStore` says no is never asked, because nothing has gone wrong and the file may well be
  storable elsewhere. Only when *nothing* can hold it is the upload failed, and then with a
  `CustomError` — a plain `Error` reaches the client as a bare 500, since the error handler in
  `index.ts` only forwards a message that came with a `statusCode`. `getAsset` tries the nominated source and then every other target
  holding the content, database last, because a target enabled after an upload never received it.
  Pages are gentler still: `mirrorPage` / `removePage` / `relocatePage` log a target that could not
  keep up and carry on, since the database always has the page.
- **The disk target's `exportAll` is a copy, not a move.** It writes out everything it is configured
  to hold, overwriting, and touches neither the database nor any record — which is how content that
  predates the target being enabled gets onto it.
- **The move is the database target's `offloadUnchecked`.** Turning a target on only affects what is
  uploaded from then on, so a site that unticks a content type on the database is still carrying
  every file of that kind ever uploaded — and carrying it unreachably, since a target is only read
  for a type it stores. That action reads each of those out of its row, writes it to every enabled
  target holding the type, **reads it back to check** and only then clears the `data` column. An
  asset with no destination keeps its copy and is reported as stranded: nothing is cleared that is
  not known to be somewhere else, because this is the only copy of the bytes. Metadata is untouched
  throughout — `data` is the one column it empties.
- **Renames have files to move on every target.** `assets.relocateAssets` takes the old location from
  the caller and reads the new one off the tree; `tree.renameFolder` does the same for everything
  beneath a renamed folder, pages included (moved, not rewritten — nothing changed).
- **Thumbnails always stay in the database** (`assets.preview`) — the file manager asks for a
  screenful at a time, and a slow target must not cost a wiki its file browser.
- **`pages.adoptStoredPage` and `assets.adoptStoredFile` are the way back in**, for the disk
  target's two import actions. Both take an `overwrite` flag, and it is the only thing separating
  them: `importAll` leaves a path the wiki already has alone, because reconciling a file changed on
  both sides is a merge and belongs to a target with history, while `importAllOverwrite` lets the
  folder win — for a restore, where there is nothing to reconcile. A page is replaced through
  `updatePage`, so its previous version is in its history; an asset has none, and `replace` also
  dispatches the new bytes to every write target, since the copy a reader is served is usually the
  database's. Imported content is rendered with **no script or style permission** whoever ran the
  import, since the file need not have been written by them.
- **An import is never written back to the target it reads from.** What it adopts is saved like any
  edit and so copied to every target holding it, and `sftp` serializes every operation per target —
  with the import itself being one, a copy back to the source waits on the import that is waiting on
  it. For `git` the copy back would be a queued change re-publishing what was just pulled. `importTree` runs under `storage.importingFrom(target)`, an `AsyncLocalStorage`
  scope that `putAsset`, `eachPageTarget` and `eachAssetTarget` skip that target in (counting it,
  for `putAsset`, as somewhere the file is held). Anything else a module does to the wiki while
  holding its own queue — git's removals in `applyIncoming` — needs the same scope.
- **On import a file is a page if its extension is reserved, or if it declares an `editor`** in its
  front matter. A text page is front matter plus the source; a **JSON** page — a redirection today —
  is one JSON document with the metadata at its top level and the source under `content`.

**Pages and assets share one folder, and the site's `pageExtensions` is what keeps them apart.** A
page is stored under its editor's extension (`md`, `html`, `adoc`, `json`), while the tree holds its
name without one — so page `notes/readme` and an attachment called `readme.md` are different names to
the wiki and the same file on disk. Three rules stop them ever meeting, and all three live in the
models rather than in the storage module:

- **`pageExtensions` are reserved.** `assets.upload` refuses an attachment using one — a `.md` file is
  a page, so uploading it as an attachment is a mistake rather than a collision. This is the whole of
  it on a default site (`md,html,txt`).
- **Both sides check anyway.** For an extension a site has taken *off* that list,
  `assets.guardAgainstPageCollision` and `pages.guardAgainstAssetCollision` refuse whichever arrives
  second. Extensions must match to collide: `readme.pdf` sits happily beside the page `readme`.
- **Nothing guesses at a name.** `StoragePageRef` carries `contentType`, so a delete or a move touches
  exactly one file — a target that tried each extension in turn would delete the attachment next door.

**A target's `state` column is how it is behaving, not how it is configured.** `{ status: 'healthy' |
'warning' | 'error', message, updatedAt }`, written only by `storage.recordState` as the model
dispatches to a module, absent from `StorageTargetInput`, and reported by the Status card. `error` is
a failure that was raised to whoever asked (a refused upload); `warning` is one that was swallowed
because the request succeeded anyway (a page copy that could not be written). The last operation
wins — a later success clears an earlier failure, which is what makes a full disk that gets emptied
stop reporting itself without anybody dismissing anything. Nothing probes a target proactively, so a
misconfigured one reads healthy until something is actually asked of it.

**The git target is the disk target plus history and a remote.** Same tree, same helpers, and then:

- **The working copy is a cache; the database is what every instance agrees on.** An HA set has a
  working copy per pod, on no shared volume and perhaps on no volume at all, so nothing is kept only
  there. A page save or an upload queues a row in `storageOutbox` — the file as written, who wrote it,
  when — and that is all it does: nothing on the request path touches git or the network. The commit
  the wiki and the remote last agreed on is `storageSyncState`, recorded against the remote URL and
  branch it belongs to. A sync, on whichever instance runs it, `checkoutAt`s that commit (wiping
  whatever its own copy held, an interrupted rebase and a stale `index.lock` included), `replay`s the
  queue as one commit per change with the original author and date, settles with the remote, pushes,
  applies what came back, and only then drops the published rows and records the new commit, in one
  transaction. Rows are dropped by id, never by range, since ids are not handed out in commit order.
- **One sync per target across the whole set.** `storage.exclusivelyFor` holds a session advisory lock
  (`pg_try_advisory_lock(TARGET_LOCK_CLASS, hashtext(targetId))`) for the length of it; an instance
  that finds it taken reports so and does nothing, since the holder is doing the same job. `withRepo`
  serializes within the process on top of that.
- **`sync` runs on a schedule.** `tasks/simple/sync-storage-targets.ts`, on a `* * * * *`
  `jobSchedule` row seeded by `jobs.init()`, walks every enabled target whose module declares a `sync`
  handler (`storage.syncableTargets`) and runs it through `executeAction`, so a failure lands on the
  target's Status card. The **Force Sync** action is the same call on demand. Which instance gets a
  tick does not matter.
- **How often is `storage.syncInterval`, per site** (the **Configuration** tab, `syncIntervalFor`,
  default `5m`). Since it is per site, one cron row cannot express it: the tick is every minute — as
  fine as the shortest interval anyone can set — and the task skips the sites whose turn it is not.
  Due-ness is `epochMinute % intervalMinutes === 0` rather than a stored last-sync time, so nothing
  has to be persisted, two instances agree without coordinating and a restart changes nothing. The
  cost is that a missed tick is not caught up, which for something running all day is the right
  trade. An interval that will not parse means *never*, not every minute.
- **A pull is authoritative, and that includes deletions.** What comes back is applied to the wiki
  with `overwrite`, and a commit that deleted a file deletes the page or asset here too. So push
  access to the remote is effectively write access to the wiki. Which of the two a vanished path was
  has to come off the tree rather than the file: the stem is looked up first and only counts as the
  page if `pages.storageFileNameOf` matches the name that went, so a deleted `readme.pdf` never takes
  the page `readme` with it.
- **A conflict is settled, never left open.** The queue's commits go onto the remote with `rebase
  --onto origin/<branch> <agreed commit>`, and a rebase that conflicts stops and waits for a human
  this working copy does not have. `rebaseOnto` therefore rolls a conflicted rebase back and runs it
  again with `-X ours`, which during a rebase is the *remote*, consistent with a pull being
  authoritative; what `-X` cannot settle — a file one side changed and the other deleted — is finished
  by `settleRebase`, taking stage 2 (the remote's side) of every unmerged path. A sync that stopped
  there would fail every sync after it, since the queue it could not publish is the next one's too.
- **Changed in the wiki while a sync ran** means queued after it read the queue: the remote's change
  to that path is not applied over it, and the next sync publishes the wiki's. In **Pull only** the
  wiki queues nothing at all (`acceptsWrites`, and `canStore` declines assets), and a row left from
  before the switch is dropped once the remote changes its path.
- **The first sync with a remote applies nothing.** With no agreed commit — a new target, one pointed
  at another URL or branch, an installation upgraded from before the queue existed, or a remote whose
  history was rewritten past the agreed commit — the remote's branch is taken up as it stands and the
  queue committed on top; there is nothing to diff it against. Import Everything is what takes in
  content the repository has and the wiki does not, and it reads the agreed commit's tree out of git
  (`ls-tree`, `cat-file`) rather than off any working tree.
- **An asset is read out of git, not off the working tree** (`readBlob`), which on any given instance
  is wherever its last sync left it. Not yet published, its bytes are the queue's — followed back
  through a queued move — and after that they are the agreed commit's, fetched first by an instance
  that has never seen it. The fetch is the only network a read can cost, and only on a cold instance.
- **The diff, not the tree.** Incoming changes come from `git diff --name-status -M -z` between the
  commit the branch was on after the replay and the one it is on after the rebase — a sync runs every few minutes and cannot read
  every file each time. `-z` because a path may contain anything, newlines included. `changedPaths`
  drops what `isIgnoredPath` rules out, as Import Everything's `ls-tree` does — a dot folder would
  otherwise fail `folderNameFrom` and abort every sync after it, and a root dotfile would come in as
  an asset with its dot stripped. A rename across that line keeps only the visible side.
- **An empty commit is never made.** Most page saves do not change the stored form of the page (a
  re-publish, a tag reordered into the same order), and `commitPaths` checks `diff --cached` before
  committing so the history says what actually changed.
- Operator git config is inherited on purpose — including `commit.gpgsign`, which will fail every
  commit if it is on without a usable key. The failure surfaces as the target's recorded `error`, and
  the queue is kept for the sync after it. simple-git strips every ambient `GIT_*` variable before
  spawning git, so `GIT_CONFIG_GLOBAL` cannot switch that off for a test instance; a `HOME` of its own
  can.
- **Without a Repository URI the repository is one instance's own**: the queue is committed into
  whichever working copy syncs, and nothing else holds those commits. That needs a single instance on
  a persistent volume; with a remote, neither is needed.

**A change carries who made it, and only git cares.** `StorageAssetRef` and `StoragePageRef` carry an
optional `actorId`, which is the user id the models already had in hand at each dispatch site;
`storage.actorFor` turns it into a name and an email, cached indefinitely because a page save is a hot
path and a stale commit author costs nothing. Absent for a change no one person made — a folder rename
that moved a hundred files, a scheduled sync — and the git target's configured default author stands
in. A scheduled pull creates content, which needs an author, so it uses
`users.getSystemActorId()`: the wiki's longest-standing active administrator.

Git's **`alwaysUseDefaultAuthor`** makes that stand-in universal, for a repository whose history must
not carry the wiki's accounts. `commitAuthor` then returns the default without calling `actorFor` at
all — not looked up and discarded, so there is nothing to leak by mistake. Note the *committer* is the
default author in every case regardless: it is the repository's own `user.name`/`user.email`, which
`prepareRepo` writes from those same two settings, and which is why they are in
`configFingerprint` — renaming the default author has to re-prepare the repository to take effect.

Not to be confused with `<dataPath>/cache/files`, the serving cache in the assets model. That one is
derived and swept; a storage target is where content actually lives.
