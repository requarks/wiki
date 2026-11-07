# Vaults

**Status:** proposed. Nothing is implemented.
**Covers:** what a vault is, how its pages and assets are encrypted, where the keys come from and where
they are never kept, sealing and unsealing (with a single key or key shares), how an unsealed vault is
shared across the instances of an HA set, who may read a vault and who may run it, what a vault turns
off, and the order to build it in.

A vault is a folder of the wiki whose pages and assets are stored encrypted. It starts **sealed**:
the server holds the ciphertext and nothing that can decrypt it. Somebody who holds the vault's key,
or enough of its key shares, **unseals** it, and from then on its members read and write it like any
other part of the wiki until somebody **seals** it again or the last instance holding the key stops.

It is meant for the confidential material that belongs in a wiki: an HR procedure, an incident
write-up, a contract summary, a security runbook. It is not a secret manager. Passwords, API keys,
certificates and private keys belong in a tool built for them (HashiCorp Vault / OpenBao, a cloud
KMS or secrets manager, a password manager, an HSM), and the interface says so where a vault is
created ([§12.1](#121-creating-and-managing-a-vault)).

The constraints this is written against:

- **The key is never stored.** Not in the database, not on disk, not in `config.yml`. It exists in
  the memory of the running instances and nowhere else, so stopping every instance seals every vault.
- **Encryption happens in the application, not in PostgreSQL.** The database receives ciphertext and
  never receives a key ([§3.2](#32-why-not-pgcrypto)).
- **Metadata stays in plain text.** A page's title, path, description, icon and tags, and an asset's
  file name, type and size, are stored as they are today. They drive routing, the tree, page rules,
  title suggestions and the file manager, and encrypting them would break each of those. Only bodies
  and bytes are encrypted.
- **A vault is a subtree.** Membership is where a page or asset sits, exactly as for a blog or a
  feedback board. Every locale at that path is in the vault. Vaults do not nest.
- **Vault content lives in the database only.** No storage target ever receives a vault page or a
  vault asset, in either direction.
- **The CLAUDE.md migration rule applies.** The columns are new and nullable, so the migration that
  adds them converts nothing. No existing page becomes encrypted except through an explicit act
  ([§8.5](#85-moving-into-a-vault)).

---

## 1. Goals and non-goals

**Goals**

- A **vault**: a folder path on a site whose pages and assets, in every locale, are stored encrypted
  with AES-256-GCM under a key of the vault's own ([§4](#4-data-model), [§5](#5-keys)).
- **One key per vault.** Two vaults on the same site have different keys and can have different
  custodians.
- **Two ways to hold the key**, chosen when the vault is created: a **single key**, which is what most
  sites will want, or **key shares** (Shamir's Secret Sharing), where any _t_ of _n_ shares unseal it
  ([§5.2](#52-single-key), [§5.3](#53-key-shares)).
- **Seal at any time**, by any member, and optionally **automatically** after a set time unsealed
  ([§6.3](#63-sealing)).
- **An unsealed vault stays unsealed across the cluster.** An instance that restarts while a peer
  still holds the key gets it back from that peer without anybody re-entering it
  ([§6.4](#64-across-instances)).
- **Access is page rules AND vault membership.** A page rule alone never opens a vault
  ([§7](#7-access)).
- **Dissolving** a vault (decrypting it back into ordinary pages) and **destroying** one (deleting it
  and everything in it, possible even when its key is lost) ([§8.8](#88-dissolving-and-destroying)).

**Non-goals**

- **Secret management.** No secret types, no leasing, no programmatic secret retrieval, no audit of
  individual reads.
- **End-to-end encryption.** The server decrypts to render, sanitize and serve. A design where only
  browsers hold the key would lose server-side rendering, title search, the file manager's image
  editor and every API client, and is not what this is.
- **Protection from the running server.** See [§3](#3-threat-model).
- **Encrypted metadata**, as above.
- **Full-text search inside a vault.** Vault pages are found by title only ([§10](#10-what-a-vault-turns-off)).
- **Collaboration features inside a vault:** comments, suggestions and approvals, live collaborative
  editing, live notes, page links. All off ([§10](#10-what-a-vault-turns-off)).
- **A user-chosen passphrase.** The single key is generated ([§5.2](#52-single-key)).
- **Idle-based auto-seal**, in this version. Auto-seal counts from the moment of unsealing
  ([§6.3](#63-sealing)).

---

## 2. Vocabulary

| Term           | Meaning                                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Vault**      | A row in `vaults`: a site, a folder path, a name, a key mode and the wrapped data key                                        |
| **In a vault** | A page or asset at or below a vault's path, in any locale. Carries the vault's id in `vaultId`                               |
| **DEK**        | Data encryption key. 32 random bytes per vault (per key version). Encrypts every row in the vault                            |
| **KEK**        | Key encryption key. 32 random bytes per vault. Encrypts (wraps) the DEK. This is what the single key, or the key shares, are |
| **Single key** | The KEK itself, shown to its creator once, encoded as described in [§5.4](#54-encoding)                                      |
| **Key share**  | One of _n_ Shamir shares of the KEK. Any _t_ of them rebuild it                                                              |
| **Sealed**     | No instance holds the DEK. Bodies and bytes cannot be read or written                                                        |
| **Unsealed**   | At least one instance holds the DEK in memory. Members read and write normally                                               |
| **Custodian**  | Somebody holding the single key or a key share. Not necessarily a member                                                     |
| **Member**     | A user or group allowed into the vault, subject to page rules as well ([§7.1](#71-membership-and-page-rules))                |

---

## 3. Threat model

### 3.1 What a vault protects against, and what it does not

| Protected                                                                                                 | Not protected                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A database dump, backup, snapshot or replica falling into the wrong hands                                 | Somebody with **write** access to the database. They can add themselves to a group with `manage:system`, or to the vault's members, and wait for the next unseal |
| Somebody with **read-only** access to the database: a DBA, a reporting user, the hosting provider's staff | A compromised application server or a malicious deployment. The key is in its memory, and may reach swap or a core dump                                          |
| PostgreSQL logs, `pg_stat_activity`, the WAL and anything else that sees queries go by                    | A wiki administrator holding `manage:system` while the vault is unsealed (by decision: [§7.3](#73-managesystem))                                                 |
| The storage targets (git, disk, S3 and the rest), since vault content never reaches them                  | Plaintext that existed before a page was moved into a vault: old backups, old WAL, git history ([§8.5](#85-moving-into-a-vault))                                 |
| A reader the page rules would admit but who is not a member                                               | Metadata: titles, paths, tags, descriptions, file names                                                                                                          |

The warning shown when a vault is created says the right-hand column in plain words.

### 3.2 Why not pgcrypto

`pgp_sym_encrypt(data, key)` would send the key to PostgreSQL with every read and write. It can then
end up in the server log (`log_statement`, `log_min_duration_statement` with bind parameters, any
error that echoes its statement), in `pg_stat_activity`, and in front of anybody with superuser
access, which is most of the left-hand column of [§3.1](#31-what-a-vault-protects-against-and-what-it-does-not).
`node:crypto` does the same AES-256-GCM in the process that already holds the key, and PostgreSQL
stores `bytea` it cannot read. pgcrypto would add nothing a vault needs.

The same reasoning rules out sending anything secret through `pg_notify`, which is how instances talk
to each other: a `SELECT pg_notify(…)` is logged like any other statement. [§6.4](#64-across-instances)
is shaped by it.

---

## 4. Data model

One migration, `npm run db-generate -- --name=vaults`. Every column it adds is new and nullable or
has a default, so it converts no existing data.

### 4.1 `vaults`

| Column                   | Type                | Notes                                                                                                                                                                                                                        |
| ------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                     | `uuid` PK           |                                                                                                                                                                                                                              |
| `siteId`                 | `uuid` FK → `sites` |                                                                                                                                                                                                                              |
| `path`                   | `varchar(255)`      | The folder path, in the form `pages.path` uses. Unique per site. Covers every locale                                                                                                                                         |
| `name`                   | `varchar(255)`      | Shown in the interface and the unseal dialog                                                                                                                                                                                 |
| `mode`                   | `varchar(16)`       | `single` or `shares`. A varchar for the reason `pageHistory.action` is one                                                                                                                                                   |
| `threshold`              | `smallint`          | _t_. 1 for `single`                                                                                                                                                                                                          |
| `shareCount`             | `smallint`          | _n_. 1 for `single`, 2–10 for `shares`                                                                                                                                                                                       |
| `shareHashes`            | `text[]`            | SHA-256 of each share (or of the single key), by index. Lets a share be recognised, and a wrong one refused, before anything is combined ([§5.4](#54-encoding)). A share is 32+ random bytes, so its hash gives nothing away |
| `keys`                   | `jsonb`             | `[{ version, wrapped, createdAt }]`: each DEK version, AES-256-GCM-wrapped under the KEK. More than one only during a rotation ([§5.6](#56-rotating-the-dek))                                                                |
| `keyVersion`             | `integer`           | The version new writes are sealed with                                                                                                                                                                                       |
| `state`                  | `varchar(16)`       | `pending` until the creator has confirmed the key ([§5.5](#55-creation)), then `active`                                                                                                                                      |
| `unsealedAt`             | `timestamp`         | Null when sealed. Not a secret: it is what tells an instance that boots whether there is a key to ask its peers for ([§6.4](#64-across-instances))                                                                           |
| `sealGeneration`         | `integer`           | Incremented by every seal. An instance holding a DEK for an older generation drops it ([§6.3](#63-sealing))                                                                                                                  |
| `autoSealAfter`          | `integer`           | Minutes. Null means never                                                                                                                                                                                                    |
| `creatorId`              | `uuid` FK → `users` |                                                                                                                                                                                                                              |
| `createdAt`, `updatedAt` | `timestamp`         |                                                                                                                                                                                                                              |

### 4.2 `vaultMembers`

`vaultId` (FK, cascade), `groupId` (FK → `groups`, nullable), `userId` (FK → `users`, nullable), with
a CHECK that exactly one of the two is set and a unique index on each pair. A user is a member if
they are listed, or are in a listed group.

### 4.3 Columns added to existing tables

| Table         | Added                                                 | Meaning                                                                                                                          |
| ------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `pages`       | `vaultId uuid` FK, `sealed bytea`                     | `sealed` holds `{ content, render, toc, scripts }` as one sealed blob ([§4.4](#44-the-sealed-blob))                              |
| `pageHistory` | `vaultId uuid` (no FK, like `pageId`), `sealed bytea` | `{ content, scripts }` of that version                                                                                           |
| `assets`      | `vaultId uuid` FK                                     | `data` and `preview` hold sealed blobs instead of bytes                                                                          |
| `tree`        | `vaultId uuid` FK                                     | So that a listing can filter the vault out with one indexed equality instead of an ltree prefix per vault ([§7.5](#75-listings)) |

`vaultId` is set by one function, `vaults.vaultFor(siteId, path)`, called by everything that creates
or moves a page, an asset or a tree entry. It is a copy of what the path already says, kept so that
the database can enforce [§4.5](#45-constraints) and a listing can filter on it.

### 4.4 The sealed blob

```
"WKV1" (4 bytes) | keyVersion (uint32 BE) | nonce (12 random bytes) | ciphertext | GCM tag (16 bytes)
```

AAD: `siteId | vaultId | table | rowId | column | keyVersion`. Binding the row is what stops somebody
with write access to the database from moving one page's ciphertext under another page's id, where
it would otherwise decrypt cleanly. It does not stop the same row being put back to an older
ciphertext of itself. That is accepted, since such a person is already out of scope
([§3.1](#31-what-a-vault-protects-against-and-what-it-does-not)).

No compression before encrypting. An asset is sealed whole, as the database target already holds it
whole. The existing upload size limit is the limit.

### 4.5 Constraints

The constraint that matters most is the one that stops a code path that forgets about vaults from
writing plain text into one. It is enforced by the database, not trusted to the code:

- `pages`: `vaultId IS NULL OR (content IS NULL AND render IS NULL AND toc IS NULL AND searchContent IS NULL AND ts IS NULL AND scripts = '{}'::jsonb)`,
  and `(vaultId IS NULL) = (sealed IS NULL)`.
- `pageHistory`: `vaultId IS NULL OR (content IS NULL AND NOT meta ? 'scripts')`.
- `assets`: `vaultId IS NULL OR data IS NULL OR substring(data FROM 1 FOR 4) = 'WKV1'::bytea`, and
  the same for `preview`.
- `vaults`: `mode = 'single' AND threshold = 1 AND shareCount = 1` or
  `mode = 'shares' AND threshold BETWEEN 2 AND shareCount AND shareCount <= 10`.

Nesting (a vault's path inside, or above, another vault's path on the same site) is refused by
`vaults.create`, not by a constraint.

---

## 5. Keys

### 5.1 The hierarchy

```
single key, or t key shares ──(Shamir combine)──► KEK         memory only, never stored
KEK ──AES-256-GCM unwrap──► DEK                               stored wrapped in vaults.keys
DEK ──AES-256-GCM, AAD bound to the row──► every sealed blob   §4.4
```

Wrapping the DEK rather than encrypting with the KEK directly is what makes a rekey cheap: new shares
mean a new KEK and one re-wrapped DEK, not every row encrypted again.

There is no separate key-check value. The DEK is wrapped with AES-GCM, so unwrapping under the wrong
KEK fails authentication, and that failure is the check.

All randomness is `crypto.randomBytes`. Every key is a full 32 random bytes, so no KDF is needed.

### 5.2 Single key

The KEK is generated by the server and shown once, in the encoding of [§5.4](#54-encoding).

The key is generated, not chosen. A passphrase would let anybody holding a copy of the database
attack the wrapped DEK offline, at the speed of their own hardware, and a passphrase a person can
remember does not hold up against that. A generated key is meant to live in a password manager.

All a passphrase would add is that a person can remember it and type it. Both matter less than they
seem: somebody who can remember a passphrase can just as well keep a generated key in the password
manager they already use, and the unseal dialog takes a paste. The cost is real, though. The wrapped
DEK sits in every backup, and argon2id slows an offline guess without stopping one against a phrase
short enough to remember. A generated key gives that attack nothing to work with. So there is no
passphrase mode.

### 5.3 Key shares

The KEK is split into _n_ shares, any _t_ of which rebuild it, with `shamir-secret-sharing` (Privy,
audited by Cure53 and Zellic, no dependencies). Shamir is not implemented in this codebase.
2 ≤ _t_ ≤ _n_ ≤ 10.

Combining happens on the server, so the server sees every share submitted. That is inherent in a
vault the server decrypts, and it is why shares are relayed between instances only in encrypted form
([§6.4](#64-across-instances)).

### 5.4 Encoding

A single key and a share use one format, so the unseal dialog takes either:

```
WKV1-<base32 groups of 4>
payload = version (1) | vaultId (16) | index (1) | threshold (1) | key material | checksum (4)
```

`checksum` is the first four bytes of SHA-256 over what comes before it, which catches a typo before
anything is sent. Index 0 and threshold 1 mean a single key. Carrying the vault id means a share
names its own vault, so a custodian who is not a member can unseal it without knowing where it is
([§11](#11-api)). The server also checks the share against `shareHashes[index]`, which refuses a share
from another vault, an old share from before a rekey, and the same share submitted twice.

### 5.5 Creation

1. **`POST …/vaults`**, with `manage:vaults` at the path ([§7.2](#72-permissions)). The path is
   checked: no other vault inside it or above it, and no blog or feedback board at or above it. The
   request gives the name, the path, the members, the mode, _t_ and _n_, and `autoSealAfter`. The
   creator is always added as a member by user id, since without membership their own
   `manage:vaults` would stop working the moment the vault exists ([§7.1](#71-membership-and-page-rules)).
   The server generates the KEK and DEK, splits the KEK
   if asked to, writes the row as `pending` with the DEK wrapped, and answers with the key or the
   shares. **This is the only time they leave the server.** It keeps the DEK in memory: a new vault is
   unsealed.
2. The interface shows them once, with "copy" and "download as text" for each, and the
   loss-of-access warning in large type: **if the key, or more than _n_ − _t_ shares, are lost, the
   vault's content is gone for good.** Nobody can recover it, the wiki's developers included.
3. **`POST …/vaults/:id/confirm`** with the single key, or with every share. Each one is re-entered
   by hand, not pasted from what the page is still showing. The vault becomes `active`. A pending
   vault holds no content and can be dropped. One left pending for an hour is deleted.

If the path already has pages or assets, confirming starts a job that moves them in
([§8.5](#85-moving-into-a-vault)).

### 5.6 Rotating the DEK

Phase 5. A new DEK version is generated, wrapped under the KEK the vault was last unsealed with, and
added to `keys`. `keyVersion` moves to it. An in-process job (a worker does not have the key) re-seals
every row in batches, and removes the old version from `keys` once no row uses it.

Because the KEK is not kept in memory, wrapping the new DEK needs the custodians: a rotation is
started with the same quorum as a rekey ([§5.7](#57-rekeying)).

### 5.7 Rekeying

New shares, a new _t_ or _n_, or switching between single and shares. It needs **a fresh quorum of
the current shares**, collected through the unseal flow, even while the vault is unsealed. Otherwise
anybody holding `manage:vaults` during an unseal could mint a key of their own and walk past the
custodians from then on. The server combines the quorum into the KEK, unwraps every DEK version with
it, generates a new KEK, re-wraps every DEK version under it, writes the new `shareHashes`, and shows
the new key or shares through the same once-only, confirm-by-re-entry flow as [§5.5](#55-creation).
No row is re-encrypted.

---

## 6. Sealing and unsealing

### 6.1 State

Each instance keeps, in memory and per vault: `sealed`, `unsealing { sessionId, shares, startedAt }`,
or `unsealed { deks, generation }`. The DEKs are held in `Buffer`s that sealing overwrites with
`fill(0)`. JavaScript cannot promise that no other copy exists, so "sealed" means that no code path
can reach the key, not that it has been scrubbed from memory. The database holds only what is not
secret: `unsealedAt` and `sealGeneration`.

### 6.2 Unsealing

`POST …/vaults/unseal { share }`. The route takes the single key or one share at a time:

- **Signed-in accounts only**, or a personal access token acting as one ([§7.4](#74-tokens-and-keys)).
  Guests and system API keys are refused.
- **Rate-limited** by `limitAuthAttempts` (`helpers/rateLimit.ts`), per account and per vault.
- Decoded and checked against its checksum and `shareHashes` before anything else. A share that fails
  is refused with no change to an unseal in progress.
- The first accepted share starts an unseal session, which lasts **10 minutes** from that share. The
  answer is progress only: `{ vaultId, name, submitted, threshold }`.
- With _t_ distinct shares in hand, the instance combines them, unwraps the DEKs, discards the shares
  and the KEK, sets `unsealedAt`, and announces the vault as unsealed. If unwrapping fails (which
  `shareHashes` makes very unlikely), the session is thrown away and the custodians start again.
- Any member may cancel a session in progress.

Holding a share is what authorises an unseal. A custodian does not have to be a member, and
unsealing does not make anybody a member.

### 6.3 Sealing

`POST …/vaults/:id/seal`, by any member. It is deliberately cheap: it is
the panic button. In one statement it increments `sealGeneration` and clears `unsealedAt`, then
announces the seal to the cluster. Every instance drops its DEKs, closes any open editor connection
under the vault, and from then on answers 423 for the vault's bodies and bytes.

An instance might miss the announcement because its LISTEN connection dropped. To cover that, every
instance holding a DEK compares its generation with `vaults.sealGeneration` whenever it reconnects
and every 30 seconds, and drops the DEK when they differ.

**Auto-seal.** When `autoSealAfter` is set, every instance holding the DEK computes the deadline from
`unsealedAt`. The first one to reach it seals, with an `UPDATE … WHERE sealGeneration = $seen`, so
two instances doing it together seal once.

### 6.4 Across instances

Instances talk over PostgreSQL LISTEN/NOTIFY, through `helpers/pubsub.ts`. A NOTIFY payload can be
logged ([§3.2](#32-why-not-pgcrypto)), so no share and no DEK is ever sent in the clear:

- **Every instance generates an X25519 key pair at boot** (`crypto.generateKeyPairSync('x25519')`).
  The private half never leaves memory. The public half is announced on the `vault` channel (one of
  its own, as `core/collab.ts` has) with `hello { instanceId, publicKey }`, and peers answer with
  their own.
- **A secret sent to a peer** is encrypted to that peer's public key: an ephemeral X25519 key, ECDH,
  HKDF-SHA256, then AES-256-GCM, with the message type, vault id, sender and recipient as AAD. A
  share or a set of DEKs is far under NOTIFY's 8000-byte cap.
- **Shares are relayed as they arrive.** Custodians behind a load balancer reach different instances,
  so each accepted share is sent, encrypted, to every peer. Every instance accumulates the session
  and combines it independently when the threshold is reached. Progress (`submitted` of `threshold`)
  is announced in the clear, since it is not secret.
- **An instance that boots** reads `vaults`. For every vault with `unsealedAt` set, it asks with
  `want { vaultId }`, and a peer holding the DEKs answers with them encrypted to the asker, along
  with the generation they belong to. This is how a restarted instance rejoins without anybody
  re-entering a key.
- **If nobody answers** within 10 seconds, every instance has gone since the unseal. The asker seals
  the vault (as in [§6.3](#63-sealing)), so that the interface says what is true.

Peers are not authenticated beyond being able to use the database's pubsub. A process with write
access to the database could announce itself as a peer and be handed the DEK. That is no wider than
[§3.1](#31-what-a-vault-protects-against-and-what-it-does-not) already concedes to such a writer. A
shared cluster secret that closes it is deferred ([§16](#16-later-authenticating-peers)), and this
version is built so that adding it later is not a protocol change:

- **Every message on the `vault` channel carries `v: 1`**, and a receiver ignores fields it does not
  know. `hello` reserves an `auth` field, which this version neither sends nor reads.
- **Whether a peer may be sent a secret is one function**, `vaults.trustsPeer(hello)`, which answers
  true for every well-formed `hello` in this version. The share relay and the answer to `want` both
  ask it, and nothing else decides.
- **The HKDF salt is a parameter** of the peer encryption, empty in this version.
- **`decline { vaultId }` is reserved.** A peer that holds the DEKs but will not hand them over
  answers with it. This version never sends one, but an asker that receives one already treats the
  key as held and does not seal. That keeps "nobody holds the key" apart from "nobody will give it to
  me", which a mismatched secret would otherwise blur.

Worker threads never hold a key. Everything that reads or writes vault content runs in-process.

---

## 7. Access

### 7.1 Membership and page rules

Inside a vault, every page permission is granted only if both of these are true:

1. the actor is a **member** of the vault (listed, or in a listed group), or holds `manage:system`;
2. the **page rules** grant it, resolved the way they are everywhere else.

This is checked at the top of `groups.checkAccess`, where `feedback.ruleRefFor` already is:
`vaults.vaultFor(ref)` resolves the vault from an in-memory list per site (refreshed over pubsub when
a vault changes), and a non-member is refused every page permission on everything in it. A broad
`/ ALLOW read:pages` rule therefore never opens a vault, and somebody who is not a member does not
see the vault in the tree at all.

The guests group and the guest account can never be members. `PUT …/vaults/:id` refuses them.

**A group listed as a member brings in whoever can staff that group.** `write:groups` may staff any
ordinary group ([Permissions](../../CLAUDE.md#permissions)), so listing a group lets anybody holding
`write:groups` into the vault by adding themselves to it. The members editor says so beside the group
picker. A vault that has to be closed to them lists users only.

Being sealed is a separate question from access, and is asked where content is read or written. A
member sees a sealed vault's tree, titles and file names, and gets the sealed screen
([§12.2](#122-the-sealed-screen)) instead of a body.

### 7.2 Permissions

**`manage:vaults` is a page-rule permission**, added to `PAGE_PERMISSIONS` in `models/groups.ts`
and to the group editor's rule permissions (`GroupEditOverlay.vue`). It is granted by a rule like
any other, so a rule `/hr ALLOW manage:vaults` on the HR group lets HR create vaults under `/hr` and
run the ones there, and gives it nothing over a vault under `/finance`.

- **It is asked at the vault's path, in the site's primary locale.** A vault spans every locale and
  has to be asked about in one of them, as a live note is (`liveNotes.permissionsFor`). A rule
  limited to another locale therefore never grants it.
- **Inside a vault it is a page permission like the rest**, so it needs membership too
  ([§7.1](#71-membership-and-page-rules)). Whoever runs a vault can read it. This is what keeps a
  rule written by somebody with `write:groups` from handing control of a vault to a non-member.
- **Creating a vault** is the one place it is asked at a path with no vault on it yet. That is why
  the creator is made a member ([§5.5](#55-creation)).
- **No group is seeded with it**, and it is not in `GUEST_ROLES`. Administrators reach every vault
  through `manage:system` ([§7.3](#73-managesystem)).
- **Not elevated.** It changes nothing about who holds what outside the vault, so it does not belong
  in `ELEVATED_PERMISSIONS`.

| Act                                                                                       | Needs                                                                                              |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Create a vault                                                                            | `manage:vaults` at the path                                                                        |
| Rename, change members or `autoSealAfter`, start a rekey or a rotation, dissolve, destroy | Member, plus `manage:vaults` on the vault                                                          |
| Seal, or cancel an unseal in progress                                                     | Member                                                                                             |
| Unseal                                                                                    | Signed in, and holding a share ([§6.2](#62-unsealing))                                             |
| Read or write pages and assets                                                            | Member, plus the page rules ([§7.1](#71-membership-and-page-rules)), plus unsealed                 |
| Move a page or asset **out** of a vault, or duplicate one out                             | `manage:vaults` on the vault, plus `manage:pages` at both ends ([§8.6](#86-moving-out-of-a-vault)) |
| Move the vault, or a folder containing it                                                 | `manage:vaults` on the vault, plus what the move needs today ([§8.7](#87-moving-the-vault))        |

A vault with no member left who holds `manage:vaults` is still run by `manage:system`. Nothing stops
that state from arising, and nothing needs to.

### 7.3 `manage:system`

By decision, `manage:system` passes the membership check, as it passes every other check. An
administrator holding it reads an unsealed vault without being a member. The creation warning and
the Vaults screen both say so.

### 7.4 Tokens and keys

- **A system API key** acts as no user, and never reads a vault body, the same as an unpublished
  page.
- **A personal access token** works as its owner's session does, both on vault content and on the
  vault routes. Content is reached through the `pages` and `assets` scopes it already needs. The vault
  routes declare `config.scope: 'vaults'`, a new category in `TOKEN_SCOPE_CATEGORIES` (mirrored in
  `frontend/src/helpers/personalTokens.js`): read for `GET`, write for the rest, unsealing included.
  A script that unseals therefore holds a share, which is the operator's decision to make.
- **The MCP server sees no vault at all**, regardless of what the token's owner may read. Not the
  bodies and not the titles: `McpContext` refuses every page in a vault, and every MCP listing and
  search filters vault rows out.

### 7.5 Listings

Every query that filters for access in SQL rather than through `checkAccess` adds
`vaultCondition(actor, siteId)` (`helpers/vaults.ts`). It allows rows with `vaultId IS NULL` and rows
in the vaults the actor is a member of, and is the counterpart of `liveCondition` in
`helpers/publishing.ts`. That covers the tree and the file manager, title suggestions, page lists and
recent changes, tag listings and tag counts, history and deleted-page lookups, backlinks and the page
graph, notification fan-out, and the sitemap (where it is moot: [§10](#10-what-a-vault-turns-off)).
Implementing a vault means going through every one of those queries, and the rule file this feature
adds lists them.

---

## 8. Pages

### 8.1 Reading

`getPage` decrypts `sealed` when the vault is unsealed and the actor may read, and hands back the
same page shape as for any other page. When sealed, the body is withheld and the page carries
`sealed: true`, the way a password-protected page carries its withheld flag. The frontend draws the
sealed screen from that. A vault page's response has `Cache-Control: private, no-store`.

### 8.2 Saving

The browser renders as it always does. The server sanitizes and normalizes the render
(`models/rendering.ts`) and extracts the table of contents, then seals `{ content, render, toc, scripts }`
into `sealed` and writes null to `content`, `render`, `toc`, `searchContent` and `ts`. It does not
derive search content, and it does not call `pageLinks.refreshForPage`. A save into a sealed vault
answers 423 (`reply.locked()`).

### 8.3 History

A version of a vault page carries `vaultId` and seals `{ content, scripts }`. Everything else in
`meta` stays in the clear, as metadata. Diffing, restoring and recovering a deleted page all decrypt,
so they all need the vault unsealed. The history list itself does not, since it is metadata.

### 8.4 The render queue

`rendering.queuePage` does not accept a vault page. A stale render is re-made the next time the page
is saved, by the browser of the person saving it. Re-rendering inside a vault would mean decrypting
into the headless browser's job, which is not worth it for a first version.

### 8.5 Moving into a vault

Creating a page under a vault, moving one in, or creating a vault over a path that already holds
pages. The vault must be unsealed. For each page, in one transaction:

1. seal the page and **every one of its history rows**, and null their plaintext columns;
2. delete its `pageLinks` rows and remove it from the search index;
3. queue its removal from every storage target that holds it;
4. set `vaultId` on the page, its history and its tree entry.

A folder move does this in an in-process job, in batches.

The dialog says what this does not undo, before the move is confirmed: a git target's history, the
database's WAL and dead tuples until they are vacuumed and recycled, and every backup taken before
the move, still hold the plain text. **Content that must never have existed in plain text has to be
written in the vault to begin with.**

A page whose translations (`localeGroupId`) would end up on both sides of a vault's path is refused,
and so is linking one translation group across the boundary.

### 8.6 Moving out of a vault

The vault must be unsealed, and the actor needs `manage:vaults` on the vault as well as
`manage:pages` at both ends: taking something out of a vault is declassifying it. The steps are the reverse of
[§8.5](#85-moving-into-a-vault): decrypt the page and its history into the plain columns, re-index
it, re-derive its links, queue its export to storage targets, and clear `vaultId`. Duplicating a page
out of a vault counts as a move out. Moving within a vault, or from one vault to another, is
re-sealing under the destination's key, and needs both vaults unsealed.

### 8.7 Moving the vault

Moving the vault's root folder moves the vault: `vaults.path` is rewritten in the same transaction as
the tree. Moving a folder that contains a vault rewrites `vaults.path` the same way, and is refused
unless the actor holds `manage:vaults` on every vault it carries. Otherwise somebody who cannot even
see `/hr/secrets` could move it by moving `/hr`. A move may not put one vault inside another.

### 8.8 Dissolving and destroying

- **Dissolve** (`manage:vaults` on the vault, unsealed): an in-process job moves everything out as in
  [§8.6](#86-moving-out-of-a-vault), then deletes the vault row. It is resumable, since the vault row
  outlives the pages it still has.
- **Destroy** (`manage:vaults` on the vault, sealed or not, confirmed by typing the vault's name): deletes every
  page, history row, asset and tree entry in the vault, then the vault. This is the way out for a
  vault whose key is lost.

---

## 9. Assets

- **Uploading** into a vault needs it unsealed. The route's `preParsing` hook, which already checks
  the page rule before the body is read, also checks membership and the seal, so a sealed vault
  refuses before it buffers anything. `data` and `preview` are sealed.
- **Storage targets.** `storage.writeTargetsFor` answers the database alone for a vault asset,
  `deliveryTargetsFor` answers the database alone, and `directAccessUrlFor` answers null. A signed URL
  carries no page rules, let alone a vault's.
- **Serving** (`controllers/files.ts` and the asset content API): membership, `read:assets` and
  unsealed, then decrypt. `Cache-Control: private, no-store` instead of `FILE_CACHE`.
- **Thumbnails.** `controllers/thumb.ts` is public on purpose for ordinary assets, and answers 404
  for a vault asset. The file manager inside a vault asks for previews through the authenticated
  asset route instead, which decrypts `preview`.
- **The image editor and resizing** run on the decrypted buffer and seal the result.
- **`assets.meta` stays in the clear**, as metadata. It must not be given anything read out of a
  vault file's bytes beyond what it holds today.
- **Moving** an asset in or out of a vault follows [§8.5](#85-moving-into-a-vault) and
  [§8.6](#86-moving-out-of-a-vault). Moving in removes its copies from other targets.
- **An image from a vault embedded on a page outside it** loads only for members while unsealed.
  Everybody else sees a broken image, which is correct.

---

## 10. What a vault turns off

| Feature                                  | In a vault                                                                                                                                                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full-text search                         | Off. `ts` and `searchContent` are null. Title suggestions (trigram) still work, for members. Search's word-completion vocabularies (`dev/specs/search.md` §5) skip vault pages                                                      |
| Page links                               | Off: no `pageLinks` rows from a vault page, so no backlinks from it, no broken-link report, no page-graph edges                                                                                                                     |
| Comments and annotations                 | Off: the routes refuse, and the panel is not drawn                                                                                                                                                                                  |
| Suggestions and approvals                | Off: `pageEditSubmissions` would hold plain text, so the suggest flow is not offered and an approval rule is not applied                                                                                                            |
| Live collaborative editing               | Off: `controllers/collab.ts` refuses a room for a vault page, since a room relays its text over NOTIFY                                                                                                                              |
| Live notes                               | A note is not a page, and cannot be in a vault. **Publish to Page** into a vault works: it posts to `POST /pages` like any other save, so the page and its images are sealed                                                        |
| Editor's browser buffer                  | Off: `editorBuffer` writes no entry for a vault page, since it would put unsaved plain text in the browser's IndexedDB. Server-side drafts (`dev/specs/drafts.md`, phase 2) seal their content, or the vault turns them off as well |
| Storage targets                          | Never written, never read, never imported into. `importTree` skips (and logs) a file whose path is inside a vault. `exportAll` skips vault content                                                                                  |
| Render queue                             | Not queued ([§8.4](#84-the-render-queue))                                                                                                                                                                                           |
| MCP                                      | Sees no vault ([§7.4](#74-tokens-and-keys))                                                                                                                                                                                         |
| Sitemap and app shell                    | Excluded from `sitemap.xml` explicitly, even though guests cannot be members. The app shell describes a vault page with no title or description                                                                                     |
| Webhooks                                 | Off: no event fires for a vault page or asset, regardless of what a webhook subscribes to. Not even the metadata leaves the wiki                                                                                                    |
| Notifications and email                  | Fire for members. Never carry an excerpt or a diff                                                                                                                                                                                  |
| Lifecycle rules                          | A `move` action may not cross a vault's boundary: refused at save, and skipped (with `lastOutcome`) at run                                                                                                                          |
| Blogs and feedback boards                | Cannot be created in a vault. A vault cannot be created inside one                                                                                                                                                                  |
| Ratings, watching, owners, page password | Unaffected. None of them hold content                                                                                                                                                                                               |

---

## 11. API

All under `/_api/sites/:siteId/vaults`, tagged `Vaults`, with `config.scope: 'vaults'`
([§7.4](#74-tokens-and-keys)). None declares a route permission: `manage:vaults` is a page
permission, so each route checks in its handler and says so with a `No route-level permissions:`
comment, as `api/pages.ts` does. "Manager" below means a member holding `manage:vaults` on the vault,
or `manage:system`.

| Route                     | Who                         | What                                                                                                                                                          |
| ------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /`                   | signed in                   | The vaults the caller is a member of (all of them for `manage:system`), with state and unseal progress                                                        |
| `POST /`                  | `manage:vaults` at the path | Create ([§5.5](#55-creation)). Answers the key or shares, once                                                                                                |
| `POST /:id/confirm`       | manager                     | `{ shares: [] }`. Activates a pending vault                                                                                                                   |
| `PUT /:id`                | manager                     | Name, members, `autoSealAfter`                                                                                                                                |
| `POST /unseal`            | signed in                   | `{ share }`. The vault is read from the share. Answers progress                                                                                               |
| `POST /:id/unseal/cancel` | member                      | Drop the session in progress                                                                                                                                  |
| `POST /:id/seal`          | member                      | Seal                                                                                                                                                          |
| `POST /:id/rekey`         | manager                     | `{ mode, threshold, shareCount }`. Starts a rekey that collects a quorum of current shares through `/unseal` before answering new ones ([§5.7](#57-rekeying)) |
| `POST /shares/verify`     | signed in                   | `{ share }`. Answers which vault and which index it is, and whether it is current, without unsealing. Rate-limited like `/unseal`                             |
| `POST /:id/dissolve`      | manager                     | Starts the dissolve job                                                                                                                                       |
| `DELETE /:id`             | manager                     | `{ confirmName }`. Destroy                                                                                                                                    |

A vault body or byte read or written while sealed answers **423** with the vault's id and name, so
the client can offer the unseal dialog.

---

## 12. Frontend

### 12.1 Creating and managing a vault

Vaults are run from where they sit, not from the admin area, since the permission that runs them is
held at a path. A folder's menu in the tree offers **Make into a vault…** to whoever holds
`manage:vaults` there, and a vault's root folder offers **Vault settings…** to its managers: name,
members, auto-seal, rekey, dissolve and destroy. **Administration → Vaults** is an overview for
`manage:system`: every vault on the site with its path, mode, state and members, the same actions,
and the only place a vault with no manager left can be reached.

Creating one is a wizard:

1. **The warning, first and unskippable.** A vault is for confidential documentation, not for
   secrets. Passwords, keys and certificates belong in a secret manager, a password manager, a KMS or
   an HSM. Metadata is not encrypted. `manage:system` can read an unsealed vault. Plain text that
   existed before a move-in is not erased.
2. Name and members, with the caller already listed. The path is the folder it was opened from.
3. Single key (the default) or key shares, _t_ of _n_. Auto-seal.
4. The key or the shares, shown once, with the loss-of-access warning.
5. Re-entry of each, to confirm.

### 12.2 The sealed screen

A vault page while sealed shows its title, a lock, the vault's name, "This vault is sealed", and an
**Unseal** button for signed-in users. With an unseal in progress it shows "2 of 3 shares entered".

### 12.3 The unseal dialog

One field, which accepts a single key or a share and validates its checksum as it is typed. It shows
progress after each share. It can also be opened from the user menu (**Unseal a vault**), for a
custodian who is not a member and so cannot see the vault.

### 12.4 Inside a vault

- The tree shows a lock on the vault's root folder, and the page header shows a small "Vault" badge,
  with **Seal** for members.
- The editor opens with no collaboration and no browser buffer. The comments and suggestions panels
  are not drawn.
- A 423 from anywhere opens the unseal dialog.

Strings go in `backend/locales/en.json`.

---

## 13. Audit log

Recorded: vault created, confirmed, renamed, members changed, auto-seal changed; each **accepted**
share (vault, index, who), the vault unsealed, the vault sealed (who, or "auto-seal", or "no peer
held the key"), a rekey, a rotation, a dissolve, a destroy; and every move into or out of a vault.

Never recorded: a share or key, in any form, including its hash. A refused share is rate-limited and
logged at `warn`, not audited, for the reason failed logins are not (see the comment on `auditLog`
in `db/schema.ts`).

---

## 14. Risks

- **Lost keys.** The only failure with no recovery, and the one users will hit. Creation forces
  confirmation by re-entry, `/shares/verify` lets a custodian check a share at any time, and the
  warning says it twice.
- **A path that forgets the vault.** Most of the work in this feature is going through the existing
  code paths ([§7.5](#75-listings), [§10](#10-what-a-vault-turns-off)). The CHECK constraints of
  [§4.5](#45-constraints) make the most damaging way to forget (writing plain text) fail loudly
  rather than quietly. Forgetting `vaultCondition` leaks only metadata, to non-members, and is the
  thing review has to catch.
- **`vaultId` drifting from the path.** It is a copy, maintained by `vaultFor` in every create and
  move. A BEFORE INSERT/UPDATE trigger on `pages`, `assets` and `tree` would enforce it in the
  database. The schema has no triggers today, so this is left to the model, and the test suite checks
  it.
- **Metadata.** Users will put secrets in titles. The warning says not to.
- **Groups as members.** Whoever may staff a member group may enter the vault
  ([§7.1](#71-membership-and-page-rules)). The members editor warns, and a strict vault lists users.
- **Memory.** The key is in the process, so in swap, a core dump or a heap snapshot.
  Production images should disable core dumps.
- **HA.** A missed seal announcement leaves an instance unsealed for up to 30 seconds
  ([§6.3](#63-sealing)). Peer impersonation by a database writer ([§6.4](#64-across-instances)).
- **Performance.** Decrypting is microseconds for a page. A large asset is decrypted whole, in memory,
  per request, with no HTTP cache to absorb repeats.

---

## 15. Suggested order

1. **Core.** Schema and migration, `helpers/vaultCrypto.ts` (seal/open with AAD, wrap/unwrap, share
   encoding), `models/vaults.ts` (in-memory state, `vaultFor`, single instance only), create/confirm/
   unseal/seal with a single key, the constraints, `.claude/rules/vaults.md`.
2. **Pages.** Read, save, history, the sealed screen, the 423 handling, access ([§7](#7-access)) and
   `vaultCondition` through every listing. Then everything in [§10](#10-what-a-vault-turns-off) that
   concerns pages.
3. **Assets.** Upload, serve, preview, image editor, storage target exclusion.
4. **Moves.** In, out, within, the vault's own path, dissolve, destroy.
5. **Key shares and HA.** Shamir, share relay, the peer key exchange, auto-seal, rekey, `/shares/verify`.
   Then DEK rotation.

Each phase leaves the wiki shippable. Phases 1 to 4 already hold for a single-instance deployment with
a single key, which is what most sites will run.

---

## 16. Later: authenticating peers

**Deferred.** Not part of this version, but [§6.4](#64-across-instances) is built so that it can be
added without changing the protocol. This section is the design to pick up when it is.

**A cluster secret** authenticates instances to each other before a share or a DEK is handed over.
The operator generates 32 random bytes once per cluster and gives the same value to every instance,
as an environment variable (in the Helm chart, a Kubernetes Secret generated at install time and kept
across upgrades with `lookup`). It is set at deploy time, before any instance starts. It cannot come
from `core/startupChecks.ts`, which stores what it makes in the database, the one place this secret
must not be. It is optional: an instance with none behaves as this version does.

With a secret set, each instance:

- fills `hello.auth` with an HMAC under the secret over `v | instanceId | publicKey | timestamp`, and
  rejects a timestamp more than a minute old;
- answers `trustsPeer` with whether a peer's `auth` verified, so that a share or a DEK is encrypted
  only to a public key that proved it holds the secret;
- passes the secret as the HKDF salt, so that a forged recipient cannot open what it is sent either;
- answers `want` from an untrusted peer with `decline`, which makes that peer wait for an unseal
  rather than seal the vault for everybody.

What it buys: a database writer can no longer receive the DEK silently by posing as a peer. What it
does not buy: the same writer can still give themselves an account with `manage:system` and read the
unsealed vault through the wiki, which [§3.1](#31-what-a-vault-protects-against-and-what-it-does-not)
concedes anyway. That route needs a login and leaves a trace, which the peer route does not, and that
difference is all the secret closes. What it costs: a secret that every HA operator has to provision,
and has to change on every instance at once. During a rolling change, the instances still on the old
value stop handing keys to the ones on the new value, until the next unseal.

