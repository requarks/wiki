import fs from 'node:fs/promises'
import path from 'node:path'
import { CheckRepoActions, simpleGit } from 'simple-git'
import {
  absPathIn,
  assetRelPath,
  existsUnder,
  HOME_PATH,
  importTree,
  isIgnoredPath,
  matchStoredReadme,
  moveStored,
  pageRelPath,
  readmeExtension,
  readmeVariants,
  resolveRoot,
  serializePage
} from '../../../helpers/storageFiles.ts'
import { generatePathHash } from '../../../helpers/common.ts'
import { pageFileExtension } from '../../../models/pages.ts'
import type { ImportSummary, StoredFile } from '../../../helpers/storageFiles.ts'
import type { SimpleGit } from 'simple-git'
import type {
  StorageModule,
  StoragePageRef,
  StorageQueuedChange,
  StorageTarget
} from '../../../models/storage.ts'

/** Where the working copy goes when the target has no path configured, per the definition default. */
const DEFAULT_REPO_PATH = './data/repo'

/** What a change with no one person behind it is committed as, per the definition defaults. */
const FALLBACK_AUTHOR = { name: 'Wiki.js', email: 'wiki@example.com' }

/**
 * How many times a stopped rebase is moved on by hand before giving up on it. Each turn settles one
 * replayed commit, so this is far more than a sync ever replays; it exists so that a git that keeps
 * stopping for a reason this module does not understand fails the sync rather than spinning.
 */
const SETTLE_LIMIT = 1000

/** How many moves an unpublished asset is followed back through to find its bytes. */
const MAX_MOVE_HOPS = 100

/**
 * The most characters of an author's own commit message that are kept. An argument to a process is
 * capped by the OS (128 KiB on Linux, less on Windows), and one over it fails the commit — and with
 * it every sync after, since the change stays queued.
 */
const MAX_COMMIT_MESSAGE_LENGTH = 4096

/**
 * This instance's working copy, as this module keeps it between operations.
 *
 * Cached against the configuration it was set up from, so that changing a setting in the admin area
 * takes effect on the next operation rather than at the next restart.
 */
interface Repo {
  git: SimpleGit
  root: string
  /** The configuration this was prepared from — see `configFingerprint`. */
  fingerprint: string
}

const repos = new Map<string, Repo>()

/** The last operation queued against each target. See `withRepo`. */
const queues = new Map<string, Promise<unknown>>()

/** A fetch in progress for an asset read, per target. See `readBlob`. */
const fetches = new Map<string, Promise<unknown>>()

/** The working copy for this target, as an absolute path. */
function repoDir(target: StorageTarget): string {
  return resolveRoot(target.config.localRepoPath, DEFAULT_REPO_PATH)
}

/**
 * What the cached repository was prepared from.
 *
 * Every setting `prepareRepo` writes into the repository or uses to reach the remote. A change to any
 * of them has to run the setup again — a new branch, a rotated key, a different URL. The default
 * author is in here because it becomes the repository's own `user.name` and `user.email`, i.e. the
 * committer of every commit; `alwaysUseDefaultAuthor` is not, because `commitAuthor` reads it per
 * commit and there is nothing prepared from it.
 */
function configFingerprint(target: StorageTarget): string {
  const c = target.config
  return JSON.stringify([
    c.localRepoPath,
    c.authType,
    c.repoUrl,
    c.branch,
    c.sshPrivateKeyMode,
    c.sshPrivateKeyPath,
    c.sshPrivateKeyContent,
    c.verifySSL,
    c.basicUsername,
    c.basicPassword,
    c.gitBinaryPath,
    c.defaultName,
    c.defaultEmail
  ])
}

/** Where an inline SSH key is written, one file per target so two of them cannot collide. */
function sshKeyPath(target: StorageTarget): string {
  return path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'secure', `git-ssh-${target.id}.pem`)
}

/**
 * The remote URL to talk to, with basic credentials folded in where there are any to fold.
 *
 * Built here rather than stored, and never logged: the password is a config value an administrator
 * can rotate, and a URL with it baked in would otherwise sit in the repository's own `.git/config`
 * under a name this module had stopped looking at.
 *
 * Credentials only ever go into an HTTP URL, which is the only scheme that has anywhere to put them.
 * Everything else is passed through untouched — an `ssh://` or `git@host:path` remote authenticates
 * with a key, and a bare path or `file://` is a repository on this machine and authenticates with
 * nothing at all. A URL with no scheme is the one case worth guessing about: `server.com/org/repo.git`
 * is what somebody configuring basic auth types, so it becomes HTTPS.
 */
function remoteUrl(target: StorageTarget): string {
  const { authType, repoUrl, basicUsername, basicPassword } = target.config
  if (authType !== 'basic') {
    return repoUrl
  }
  // -> A local path, or any scheme that is not HTTP. `git@host:path` counts: the colon is scp syntax
  //    and there is no scheme at all, so the slash test is what tells it from `host/org/repo.git`.
  const isHttp = /^https?:\/\//i.test(repoUrl)
  if (!isHttp && (repoUrl.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(repoUrl))) {
    return repoUrl
  }
  // -> Nothing to fold in. `https://:@host` is not the same request as `https://host` and some hosts
  //    refuse it outright, so an unset username means the URL is left as it is.
  if (!basicUsername) {
    return isHttp ? repoUrl : `https://${repoUrl}`
  }
  const credentials = `${encodeURIComponent(basicUsername)}:${encodeURIComponent(basicPassword ?? '')}`
  return isHttp
    ? repoUrl.replace(/^(https?:\/\/)/i, `$1${credentials}@`)
    : `https://${credentials}@${repoUrl}`
}

/**
 * Prepare this instance's working copy, without touching the network.
 *
 * A working copy that exists, is a repository, knows who it is committing as and has `origin`
 * pointing where the configuration says. What is checked out in it is the sync's business — see
 * `checkoutAt` — since a copy prepared on a pod that started a minute ago holds nothing yet.
 */
async function prepareRepo(target: StorageTarget): Promise<Repo> {
  const root = repoDir(target)
  await fs.mkdir(root, { recursive: true })
  /*
    `core.sshCommand` is arbitrary command execution, so simple-git refuses to set it unless the
    caller says it means to — a library cannot tell a path an administrator typed from one that
    arrived in a query string, and for most of its users the value would be the latter.

    Here it is neither: it comes from this target's own configuration, which is only writable through
    `PUT /sites/:siteId/storage` behind `manage:system` — a permission that bypasses every check in
    the wiki, so anybody who can set this can already do anything. Granted only for the auth type that
    actually needs it, so a target authenticating over HTTPS carries no allowance at all.
  */
  const git = simpleGit(
    root,
    target.config.authType === 'ssh' ? { unsafe: { allowUnsafeSshCommand: true } } : {}
  )
  if (target.config.gitBinaryPath) {
    git.customBinary(target.config.gitBinaryPath)
  }

  /*
    `IS_REPO_ROOT`, emphatically not a bare `checkIsRepo()`. That defaults to
    `rev-parse --is-inside-work-tree`, which is true for any directory *inside* a repository — and the
    default working copy is `<install>/data/repo`, so on any instance whose install directory is itself
    a git checkout (every dev install, and any deployment that pulled the source down with git) the
    answer is yes and `git init` is skipped. Every command after that then runs against the wiki's own
    source repository, which is how this came to fail on a `.gitignore` rule that has nothing to do
    with storage. `--git-dir` resolving to `.git` is the question actually being asked here: is this
    directory the root of its own repository.

    A repository nested inside another one's working tree is fine, and is what this creates: git uses
    the innermost `.git` for commands run here, and reads ignore rules from this root downwards, so
    the outer checkout's `.gitignore` stops applying the moment this exists.
  */
  if (!(await git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT))) {
    WIKI.logger.info(`(STORAGE/GIT) Initializing local repository at ${root}...`)
    await git.init(['--initial-branch', target.config.branch || 'main'])
  }

  // -> Without this git escapes any non-ASCII path in its own output, and every path this module
  //    reads back out of a diff would arrive quoted and mangled
  await git.addConfig('core.quotepath', 'false')
  await git.addConfig('user.name', target.config.defaultName || FALLBACK_AUTHOR.name)
  await git.addConfig('user.email', target.config.defaultEmail || FALLBACK_AUTHOR.email)
  await git.addConfig('http.sslVerify', target.config.verifySSL === false ? 'false' : 'true')

  if (target.config.authType === 'ssh') {
    let keyPath = target.config.sshPrivateKeyPath
    if (target.config.sshPrivateKeyMode === 'inline') {
      keyPath = sshKeyPath(target)
      await fs.mkdir(path.dirname(keyPath), { recursive: true })
      // -> Trailing newline and 0600, both of which ssh insists on: it refuses a key file other
      //    users can read, and a key without the final newline
      await fs.writeFile(keyPath, `${(target.config.sshPrivateKeyContent ?? '').trimEnd()}\n`, {
        encoding: 'utf8',
        mode: 0o600
      })
    }
    if (keyPath) {
      await git.addConfig(
        'core.sshCommand',
        `ssh -i "${keyPath}" -o StrictHostKeyChecking=no -o IdentitiesOnly=yes`
      )
    }
  }

  // -> The working copy outlives any one run of the wiki and anybody with a shell on this machine can
  //    be in the middle of something in it, so one that arrives mid-rebase is put back before it is
  //    used rather than left to fail every commit made against it
  await abortInterrupted({ git })

  // -> Rewritten rather than added to: the URL carries the credentials, so a remote left over from a
  //    previous configuration would still be reachable under its old ones
  const remotes = await git.getRemotes()
  for (const remote of remotes) {
    await git.removeRemote(remote.name)
  }
  if (target.config.repoUrl) {
    await git.addRemote('origin', remoteUrl(target))
  }

  return {
    git,
    root,
    fingerprint: configFingerprint(target)
  }
}

/**
 * Run something against this instance's working copy of a target, one operation at a time.
 *
 * Git takes a lock on the index for the length of a write, so two operations landing together would
 * have one of them fail on `index.lock` rather than wait. This serializes within the process only;
 * what keeps two instances from syncing the same target at once is `exclusive`.
 */
async function withRepo<T>(target: StorageTarget, run: (repo: Repo) => Promise<T>): Promise<T> {
  const turn = async () => {
    let repo = repos.get(target.id)
    if (!repo || repo.fingerprint !== configFingerprint(target)) {
      repo = await prepareRepo(target)
      repos.set(target.id, repo)
    }
    return run(repo)
  }
  // -> The repository is prepared inside the turn, and the queue is kept apart from it. A queue that
  //    lived on the prepared entry would give two operations arriving before there was one an entry
  //    each, and a changed setting a new entry beside whatever was still running on the old one — two
  //    queues over one working copy, and the index lock this exists to avoid.
  const result = (queues.get(target.id) ?? Promise.resolve()).then(turn, turn)
  // -> The queue holds the settled outcome rather than the result, so one failed operation does not
  //    reject every operation queued behind it
  queues.set(
    target.id,
    result.catch(() => {})
  )
  return result
}

/**
 * Run a sync of a target here, provided no other instance is running one.
 *
 * Every instance of an HA set has a working copy of its own, and any of them may be the one the
 * scheduler hands the next sync to — or the one the load balancer hands a Force Sync to. What they
 * share is the database: the queue of changes nobody has published yet and the commit the wiki last
 * agreed with the remote on. So the work is one at a time per target across all of them, and each
 * instance's working copy is rebuilt from those two at the start of it.
 *
 * @param busy What to report when another instance already has it
 */
async function exclusive(
  target: StorageTarget,
  busy: string,
  run: (repo: Repo) => Promise<string>
): Promise<string> {
  const outcome = await WIKI.models.storage.exclusivelyFor(target, () => withRepo(target, run))
  return outcome.busy ? busy : outcome.result
}

/** The branch a target syncs, as configured. */
function branchOf(target: StorageTarget): string {
  return target.config.branch || 'main'
}

/** Which way a target syncs. See the definition's `syncMode`. */
function modeOf(target: StorageTarget): 'sync' | 'push' | 'pull' {
  const mode = target.config.syncMode
  return mode === 'push' || mode === 'pull' ? mode : 'sync'
}

/**
 * Whether the wiki's own changes are recorded for this target at all.
 *
 * Not in Pull only, the mode that makes the remote the only author: nothing queued would ever be
 * sent, and a queue that is never drained is a row per page save for ever.
 */
function acceptsWrites(target: StorageTarget): boolean {
  return modeOf(target) !== 'pull'
}

/**
 * Where this target last agreed with its remote, if that is still the remote it is pointed at.
 *
 * Recorded against a URL and a branch and only good for those: a commit of a repository the target
 * has since been pointed away from is nothing to diff against, so the next sync starts again from
 * whatever the new remote has.
 */
async function syncedCommit(target: StorageTarget): Promise<string | null> {
  const state = await WIKI.models.storage.syncStateFor(target)
  if (
    !state ||
    state.remote !== (target.config.repoUrl || '') ||
    state.branch !== branchOf(target)
  ) {
    return null
  }
  return state.commit
}

/** What a ref points at here, or null for one this working copy does not have. */
async function resolveRef(repo: Repo, ref: string): Promise<string | null> {
  // -> `--verify --quiet` exits non-zero for a ref that does not exist, which simple-git raises
  return repo.git.raw(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).then(
    (out) => out.trim() || null,
    () => null
  )
}

/** Whether this working copy has a commit, which a fresh one has not until it has fetched. */
async function hasCommit(repo: Repo, commit: string): Promise<boolean> {
  return repo.git.raw(['cat-file', '-e', `${commit}^{commit}`]).then(
    () => true,
    () => false
  )
}

/**
 * Bring the remote's branches into this working copy, without touching what is checked out.
 *
 * A remote that does not have the branch yet is the ordinary state of a repository somebody has just
 * created, and the first push is what creates it — 2.x refused to start at all in that case, which
 * made an empty remote something an administrator had to go and fix by hand before the wiki would
 * talk to it. What is still worth refusing is a branch that exists nowhere on a remote that has other
 * branches, because that is a typo rather than a beginning.
 *
 * @returns The commit the remote's branch is on, or null when it does not have the branch yet
 */
async function fetchRemote(repo: Repo, target: StorageTarget): Promise<string | null> {
  const branch = branchOf(target)
  await repo.git.raw(['fetch', '--prune', 'origin'])
  const head = await resolveRef(repo, `refs/remotes/origin/${branch}`)
  if (head) {
    return head
  }
  const others = (await repo.git.raw(['branch', '-r', '--format=%(refname:lstrip=3)']))
    .split('\n')
    .map((name) => name.trim())
    .filter((name) => name && name !== 'HEAD')
  if (others.length > 0) {
    throw new Error(
      `(STORAGE/GIT) The branch "${branch}" does not exist on the remote, which has ${others.join(', ')}. Check the branch name, or create it on the remote first.`
    )
  }
  return null
}

/**
 * Put the working copy at a commit, exactly: that commit's files and nothing else.
 *
 * This is what keeps the working copy a cache. Whatever was left in it — by a process that died part
 * way through a rebase, by an earlier sync whose push failed, by somebody with a shell — is not what a
 * sync builds on; the commit the wiki last agreed with the remote on is. So all of it goes, an
 * unfinished rebase and a stale index lock included: nothing else can be using this working copy
 * while a sync holds it, so a lock still there is one nobody is coming back for.
 *
 * @param commit Null for a branch with nothing on it yet, which leaves an empty one to commit into
 */
async function checkoutAt(repo: Repo, branch: string, commit: string | null): Promise<void> {
  await fs.rm(path.join(repo.root, '.git', 'index.lock'), { force: true })
  await abortInterrupted(repo)
  if (commit) {
    await repo.git.raw(['checkout', '--force', '-B', branch, commit])
  } else {
    await repo.git.raw(['symbolic-ref', 'HEAD', `refs/heads/${branch}`])
    await repo.git.raw(['update-ref', '-d', `refs/heads/${branch}`]).catch(() => null)
    await repo.git.raw(['read-tree', '--empty'])
  }
  await repo.git.raw(['clean', '-ffdx'])
}

/**
 * Commit the changes queued for this target, one commit each, in the order they were made.
 *
 * Each is replayed as it was recorded: the file as it was written, by whoever wrote it, dated when
 * they did. What the replay adds is only what can be read off the working copy at that point —
 * whether a page being written is new, and whether a file being moved is there to move.
 *
 * A change that leaves the tree as it was — a page saved without a change to its stored form, a file
 * under one of the repository's own ignore rules, a move of something the repository never had —
 * commits nothing, and still counts as published: there is nothing left of it to send.
 *
 * @returns The ids of the changes replayed, which the caller drops from the queue once they have
 *   reached the remote
 */
async function replay(
  repo: Repo,
  target: StorageTarget,
  changes: StorageQueuedChange[]
): Promise<number[]> {
  const replayed: number[] = []
  const inRepo = existsUnder(repo.root)
  for (const change of changes) {
    const by = { actorId: change.actorId, date: change.createdAt }
    // -> A home page filed as a README goes under the name the repository already has for it, which
    //    only the working copy can say: the change was queued on the request path, without looking
    const relPath =
      change.kind === 'page' ? await matchStoredReadme(target, change.path, inRepo) : change.path
    const previousPath =
      change.kind === 'page'
        ? await matchStoredReadme(target, change.previousPath ?? null, inRepo)
        : change.previousPath
    if (change.op === 'put') {
      const data = await WIKI.models.storage.queuedData(change.id)
      const filePath = absPathIn(repo.root, relPath)
      // -> Which of the two verbs a page's commit gets. Read before the write, since afterwards every
      //    page looks like one that was already there.
      const existed = await fs.access(filePath).then(
        () => true,
        () => false
      )
      if (data && !(await isIgnored(repo, relPath))) {
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, data)
        await repo.git.raw(['add', '--', relPath])
        await commitPaths(
          repo,
          target,
          [relPath],
          commitMessageOf(change.message) ||
            (change.kind === 'page'
              ? `docs: ${existed ? 'update' : 'create'} ${change.label}`
              : `docs: upload ${change.label}`),
          by
        )
      }
    } else if (change.op === 'delete') {
      await fs.rm(absPathIn(repo.root, relPath), { force: true })
      // -> From the index rather than `git rm`, which fails on a path git has never heard of — an
      //    ordinary situation here, for a file deleted before this target was enabled
      await repo.git.raw(['rm', '--cached', '--ignore-unmatch', '--quiet', '--', relPath])
      await commitPaths(repo, target, [relPath], `docs: delete ${change.label}`, by)
    } else if (previousPath && (await moveStored(repo.root, previousPath, relPath)) === 'moved') {
      const paths = [previousPath, relPath]
      for (const moved of paths) {
        await repo.git.add(['-A', '--', moved])
      }
      await commitPaths(
        repo,
        target,
        paths,
        `docs: rename ${change.previousLabel} to ${change.label}`,
        by
      )
    }
    replayed.push(change.id)
  }
  return replayed
}

/**
 * What git has stopped in the middle of, if anything.
 *
 * A rebase or a merge that hits a conflict is not an operation that failed and ended — it is one that
 * is still going, waiting for somebody to resolve it, with the index unmerged until they do.
 */
async function interruptedBy(repo: { git: SimpleGit }): Promise<'rebase' | 'merge' | null> {
  const gitDir = await repo.git.revparse(['--absolute-git-dir'])
  const exists = (name: string) =>
    fs.stat(path.join(gitDir, name)).then(
      () => true,
      () => false
    )
  // -> Two directories because there are two rebase backends: `rebase-merge` for the default one and
  //    `rebase-apply` for `--apply`, which is what somebody working in the repository by hand may well
  //    have left behind
  if ((await exists('rebase-merge')) || (await exists('rebase-apply'))) {
    return 'rebase'
  }
  return (await exists('MERGE_HEAD')) ? 'merge' : null
}

/**
 * Put the working copy back the way it was before an operation git could not finish.
 *
 * An unfinished rebase holds the index unmerged, and git refuses to check out a branch or make a
 * commit against an unmerged index.
 */
async function abortInterrupted(repo: { git: SimpleGit }): Promise<void> {
  const interrupted = await interruptedBy(repo)
  if (!interrupted) {
    return
  }
  WIKI.logger.warn(`(STORAGE/GIT) Rolling back an unfinished ${interrupted}...`)
  await repo.git.raw([interrupted, '--abort'])
}

/** The paths a stopped merge or rebase has left unresolved. */
async function unmergedPaths(repo: { git: SimpleGit }): Promise<string[]> {
  const raw = await repo.git.raw(['diff', '--name-only', '--diff-filter=U', '-z']).catch(() => '')
  return [...new Set(raw.split('\0').filter((p) => p !== ''))]
}

/**
 * Move the commits made since `base` onto the remote's branch, the remote winning whatever collides.
 *
 * `--onto` with `base` spelled out, rather than a pull: what goes on top of the remote is exactly the
 * commits the replay just made, whatever the remote's history has done in the meantime — including
 * having been rewritten underneath the commit the wiki last synced.
 *
 * A rebase stops at the first conflict and waits for a human, and this one has none: nobody is looking
 * at this working copy and the sync that started it returns to a scheduler. So a conflicted rebase is
 * rolled back and run again with the remote winning every hunk that changed on both sides — the
 * direction a sync already has, where what comes back replaces what is in the wiki and the version it
 * replaced is still in that page's history. `-X ours` reads backwards until you remember which way
 * round a rebase is: the wiki's commits are the ones being replayed, so *theirs* is the wiki and
 * *ours* is the remote.
 *
 * What `-X` cannot settle is a file one side changed and the other deleted, there being no hunk to
 * prefer. `settleRebase` finishes those by hand, the same way round. A sync that stopped there would
 * not be one failed sync but every sync after it, since the queue it failed to publish is still the
 * queue the next one starts from.
 *
 * @returns The paths that conflicted, for the report
 */
async function rebaseOnto(repo: Repo, branch: string, base: string): Promise<string[]> {
  const onto = ['--onto', `refs/remotes/origin/${branch}`, base, branch]
  try {
    await repo.git.raw(['rebase', ...onto])
    return []
  } catch (err: any) {
    const conflicted = await unmergedPaths(repo)
    await abortInterrupted(repo)
    // -> Nothing unmerged means the rebase failed for something resolving conflicts cannot fix
    if (conflicted.length < 1) {
      throw err
    }
    WIKI.logger.warn(
      `(STORAGE/GIT) ${conflicted.length} path(s) conflict with origin/${branch}; taking the remote's version...`
    )
    try {
      await repo.git.raw(['rebase', '-X', 'ours', ...onto])
    } catch (retryErr: any) {
      await settleRebase(repo, retryErr)
    }
    return conflicted
  }
}

/**
 * Finish a stopped rebase by taking the remote's side of every path it stopped on.
 *
 * During a rebase stage 2 of an unmerged path is the side being rebased onto, which is the remote:
 * where it has the file, its version is checked out, and where it has not, the file goes. A commit
 * that leaves nothing staged once that is done had nothing in it the remote did not overrule, and is
 * skipped rather than made empty.
 */
async function settleRebase(repo: Repo, cause: Error): Promise<void> {
  for (let turn = 0; (await interruptedBy(repo)) === 'rebase'; turn++) {
    const unmerged = await unmergedPaths(repo)
    if (turn >= SETTLE_LIMIT || (turn > 0 && unmerged.length < 1)) {
      await abortInterrupted(repo)
      throw cause
    }
    for (const relPath of unmerged) {
      const stages = await repo.git.raw(['ls-files', '--unmerged', '-z', '--', relPath])
      if (stages.split('\0').some((entry) => /^\d+ [0-9a-f]+ 2\t/.test(entry))) {
        await repo.git.raw(['checkout', '--ours', '--', relPath])
        await repo.git.raw(['add', '--', relPath])
      } else {
        await repo.git.raw(['rm', '--cached', '--quiet', '--', relPath])
        await fs.rm(absPathIn(repo.root, relPath), { force: true })
      }
    }
    const staged = await repo.git.raw(['diff', '--cached', '--quiet']).then(
      () => false,
      () => true
    )
    // -> Stopping again on the next commit raises, and is the next turn of this loop
    await repo.git
      .raw(staged ? ['-c', 'core.editor=true', 'rebase', '--continue'] : ['rebase', '--skip'])
      .catch(() => null)
  }
}

/**
 * A file as a commit has it, fetching the commit first if this working copy has never seen it.
 *
 * Read out of git rather than off the working tree, which on any given instance is wherever its last
 * sync left it — or part way through the next one. Not through `withRepo` once the working copy is
 * prepared, for the same reason: a read must not wait for a sync's push, and the one thing it may need
 * from the network is a fetch, which git does not take the index lock for.
 */
async function readBlob(
  target: StorageTarget,
  commit: string,
  relPath: string
): Promise<Buffer | null> {
  const cached = repos.get(target.id)
  const repo =
    cached?.fingerprint === configFingerprint(target)
      ? cached
      : await withRepo(target, async (prepared) => prepared)
  if (!(await hasCommit(repo, commit))) {
    if (!target.config.repoUrl) {
      return null
    }
    // -> One fetch per target however many reads arrive at a cold instance together
    let fetching = fetches.get(target.id)
    if (!fetching) {
      fetching = fetchRemote(repo, target).finally(() => fetches.delete(target.id))
      fetches.set(target.id, fetching)
    }
    await fetching
  }
  const object = `${commit}:${relPath}`
  const exists = await repo.git.raw(['cat-file', '-e', object]).then(
    () => true,
    () => false
  )
  return exists ? ((await repo.git.binaryCatFile(['blob', object])) as Buffer) : null
}

/** Whether the repository's own ignore rules exclude this path. */
async function isIgnored(repo: Repo, relPath: string): Promise<boolean> {
  try {
    // -> Raw, for the `--`: a path is never read as an option, whatever it starts with
    return (await repo.git.raw(['check-ignore', '--', relPath])).trim().length > 0
  } catch {
    // -> `check-ignore` exits non-zero when nothing matches, which simple-git raises
    return false
  }
}

/**
 * Who to attribute a commit to: whoever made the change, or the target's configured stand-in.
 *
 * `alwaysUseDefaultAuthor` is the stand-in for everything, for a repository whose history should not
 * carry the wiki's accounts — a public mirror, or an instance whose users did not agree to have their
 * name and address published with every edit they make. The actor is not looked up at all in that
 * case rather than looked up and discarded, so there is nothing to leak by mistake.
 *
 * The committer is the default author either way: it comes from the repository's own `user.name` and
 * `user.email`, which `prepareRepo` sets from these same two settings. This decides the *author*,
 * which is the half of a commit that git shows and that would otherwise name the person.
 */
async function commitAuthor(target: StorageTarget, actorId?: string | null): Promise<string> {
  const name = target.config.defaultName || FALLBACK_AUTHOR.name
  const email = target.config.defaultEmail || FALLBACK_AUTHOR.email
  if (target.config.alwaysUseDefaultAuthor) {
    return `${name} <${email}>`
  }
  const actor = await WIKI.models.storage.actorFor(actorId)
  return `${actor?.name || name} <${actor?.email || email}>`
}

/**
 * Commit whatever is staged at these paths, and nothing if that is nothing.
 *
 * The empty check is not an optimization. Every page save is replayed through this, and most of them
 * saved a page whose stored form had not actually changed — a re-publish, a tag reordered into the
 * same order — so without it the repository would fill with empty commits that say a file changed
 * when it did not.
 *
 * @param by Who made the change and when. The date is when it was made in the wiki rather than when
 *   the sync got round to committing it, which is what the committer date already says.
 */
async function commitPaths(
  repo: Repo,
  target: StorageTarget,
  paths: string[],
  message: string,
  by: { actorId?: string | null; date?: Date } = {}
): Promise<boolean> {
  const staged = await repo.git.raw(['diff', '--cached', '--name-only', '--', ...paths])
  if (!staged.trim()) {
    return false
  }
  // -> Raw, for the `--` that keeps a path from being read as an option -- `commit()` puts the paths
  //    straight after the message with nothing in between
  await repo.git.raw([
    'commit',
    '-m',
    message,
    `--author=${await commitAuthor(target, by.actorId)}`,
    ...(by.date ? [`--date=${by.date.toISOString()}`] : []),
    '--',
    ...paths
  ])
  return true
}

/**
 * A commit message given by a person — a page save's reason for change — made safe to hand git, or
 * empty when nothing of it is left.
 *
 * Nothing here is about the command: git is spawned without a shell and the message is the value of
 * `-m`, so it cannot be read as anything but the message. It is about what the message does to the
 * terminal of whoever reads the history, and what it does to the commit:
 * - Control characters other than a tab and a newline are dropped. Escape sequences in a commit
 *   message reach a terminal untouched through `git log`, where they can recolour, rewrite or hide
 *   lines, retitle the window and, through OSC 52, write the clipboard. A NUL would fail the spawn.
 * - So are the bidirectional embedding, override and isolate characters, which make a line display
 *   in an order other than the one it is stored in. Right-to-left text needs none of them.
 * - It is cut to `MAX_COMMIT_MESSAGE_LENGTH`.
 */
function commitMessageOf(given: string | null | undefined): string {
  const kept: string[] = []
  for (const char of (given ?? '').replace(/\r\n?/g, '\n')) {
    const code = char.codePointAt(0)!
    const isControl =
      (code < 0x20 && char !== '\n' && char !== '\t') || (code >= 0x7f && code <= 0x9f)
    const isBidiControl = (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)
    if (isControl || isBidiControl) {
      continue
    }
    kept.push(char)
    if (kept.length >= MAX_COMMIT_MESSAGE_LENGTH) {
      break
    }
  }
  return kept.join('').trim()
}

/** A page's path as a commit message names it: its locale and where it sits. */
function pageLabel(ref: StoragePageRef): string {
  return `[${ref.locale}] ${ref.path || '/'}`
}

/** An asset's path as a commit message names it. */
function assetLabel(ref: { locale: string; folderPath: string; fileName: string }): string {
  return `[${ref.locale}] ${ref.folderPath ? `${ref.folderPath}/` : ''}${ref.fileName}`
}

/** One entry of a `--name-status` diff. */
interface DiffEntry {
  status: string
  segments: string[]
  previousSegments?: string[]
}

/**
 * What changed between two commits, as paths this module can act on.
 *
 * Read with `--name-status -M` rather than through a diff summary because the three things that
 * matter here are exactly what that reports: whether a path arrived, went, or moved. A summary of
 * insertions and deletions cannot tell a deleted file from one emptied to nothing, and 2.x guessed at
 * that from the line counts.
 */
async function changedPaths(repo: Repo, from: string, to: string): Promise<DiffEntry[]> {
  const raw = await repo.git.raw(['diff', '--name-status', '-M', '-z', from, to])
  // -> `-z` because a path may contain anything at all, newlines included, and the fields are then
  //    NUL-separated: `status NUL path` for most, `Rxxx NUL old NUL new` for a rename
  const fields = raw.split('\0').filter((f) => f !== '')
  const entries: DiffEntry[] = []
  for (let i = 0; i < fields.length;) {
    const status = fields[i++]
    if (status.startsWith('R') || status.startsWith('C')) {
      const previous = fields[i++]
      const current = fields[i++]
      if (!current) {
        break
      }
      entries.push({
        status: 'R',
        segments: current.split('/'),
        previousSegments: previous.split('/')
      })
      continue
    }
    const file = fields[i++]
    if (!file) {
      break
    }
    entries.push({ status: status[0], segments: file.split('/') })
  }
  return entries
}

/**
 * Take a path the repository no longer has out of the wiki.
 *
 * The half of a pull that `importTree` cannot do, and the one that makes the remote authoritative
 * rather than merely a source: a commit somebody pushed that deletes a file deletes the page or the
 * asset here too.
 *
 * Which of the two it was has to be worked out from the tree rather than from the file, since the
 * file is exactly what is no longer there. A page is filed under its editor's extension and addressed
 * without one, so the stem is looked up first and only counts as the page if the page's own stored
 * file name is the one that went — `readme.pdf` disappearing is not the markdown page `readme`.
 *
 * @returns What was deleted, for the report
 */
async function removeFromWiki(
  target: StorageTarget,
  segments: string[],
  actorId: string
): Promise<'page' | 'asset' | null> {
  const stored = WIKI.models.storage.parseStoredPath(target.siteId, segments)
  if (!stored) {
    return null
  }
  const rest = [...stored.segments]
  const fileName = rest.pop()!
  const folderPath = rest.join('/')
  const ext = path.extname(fileName).replace(/^\./, '').toLowerCase()
  const stem = fileName.slice(0, fileName.length - (ext ? ext.length + 1 : 0))

  // -> A root README is the home page, when the home page is in the format that README is: one in
  //    another format is filed under another name, and the README that went was never it. No asset is
  //    ever named `README` either — an asset's name is lowercase — so there is nothing else for it to
  //    have been.
  const readmeExt = rest.length === 0 ? readmeExtension(fileName) : null
  if (readmeExt && WIKI.models.storage.mapReadmeToHomeFor(target.siteId)) {
    const home = await WIKI.models.pages.getPage({
      siteId: target.siteId,
      hash: generatePathHash(HOME_PATH),
      locale: stored.locale
    })
    if (!home || pageFileExtension(home.contentType) !== readmeExt) {
      return null
    }
    await WIKI.models.pages.deletePage(target.siteId, home.id, {
      id: actorId,
      permissions: ['manage:system']
    })
    return 'page'
  }

  if (stem) {
    const asPage = await WIKI.models.tree.getEntryAt({
      siteId: target.siteId,
      locale: stored.locale,
      parentPath: folderPath || null,
      fileName: stem
    })
    if (
      asPage?.type === 'page' &&
      (await WIKI.models.pages.storageFileNameOf(asPage.id)) === fileName
    ) {
      await WIKI.models.pages.deletePage(target.siteId, asPage.id, {
        id: actorId,
        permissions: ['manage:system']
      })
      return 'page'
    }
  }

  const asAsset = await WIKI.models.tree.getEntryAt({
    siteId: target.siteId,
    locale: stored.locale,
    parentPath: folderPath || null,
    fileName
  })
  if (asAsset?.type === 'asset') {
    await WIKI.models.assets.deleteAsset(target.siteId, asAsset.id, actorId)
    return 'asset'
  }
  return null
}

/** Every file this target should be holding, written into the working copy. */
async function writeEverything(
  repo: Repo,
  target: StorageTarget
): Promise<{ pages: number; assets: number; unstored: number; unreadable: number }> {
  const counts = { pages: 0, assets: 0, unstored: 0, unreadable: 0 }

  for (const asset of await WIKI.models.assets.listStoredAssets(target.siteId)) {
    const contentType = WIKI.models.storage.contentTypeFor(
      target.siteId,
      asset.kind,
      asset.fileSize
    )
    if (!target.contentTypes.activeTypes.includes(contentType)) {
      continue
    }
    const relPath = assetRelPath(target, asset)
    if (!relPath) {
      counts.unstored++
      continue
    }
    const data = await WIKI.models.storage.getAsset(asset)
    if (!data) {
      counts.unreadable++
      continue
    }
    const filePath = absPathIn(repo.root, relPath)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, data)
    counts.assets++
  }

  if (target.contentTypes.activeTypes.includes('pages')) {
    for (const { ref, content } of await WIKI.models.pages.listForStorage(target.siteId)) {
      const relPath = await matchStoredReadme(
        target,
        pageRelPath(target, ref),
        existsUnder(repo.root)
      )
      if (!relPath) {
        counts.unstored++
        continue
      }
      const filePath = absPathIn(repo.root, relPath)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, serializePage(ref, content))
      counts.pages++
    }
  }

  return counts
}

/** What an import run did, in words. */
function describeImport(summary: ImportSummary | null): string {
  if (!summary) {
    return 'There was nothing to import.'
  }
  const parts = []
  if (summary.pages > 0 || summary.assets > 0) {
    parts.push(`Imported ${summary.pages} page(s) and ${summary.assets} asset(s).`)
  } else {
    parts.push('There was nothing to import.')
  }
  if (summary.skipped > 0) {
    parts.push(`${summary.skipped} could not replace what is at their path and were left alone.`)
  }
  if (summary.failed > 0) {
    parts.push(`${summary.failed} could not be imported - see the server log.`)
  }
  return parts.join(' ')
}

/**
 * Queue a move, or the delete a move amounts to when the site's layout has nowhere to put it now.
 */
async function queueMove(
  target: StorageTarget,
  kind: 'page' | 'asset',
  from: { path: string | null; label: string },
  to: { path: string | null; label: string },
  actorId?: string
): Promise<void> {
  if (!from.path || from.path === to.path) {
    return
  }
  await WIKI.models.storage.queueChange(
    target,
    to.path
      ? {
          kind,
          op: 'move',
          path: to.path,
          previousPath: from.path,
          label: to.label,
          previousLabel: from.label,
          actorId
        }
      : { kind, op: 'delete', path: from.path, label: from.label, actorId }
  )
}

/**
 * Git storage module
 *
 * Keeps the site's content as a git repository: the same tree the local disk target writes, committed
 * as it changes and synchronized with a remote. What that buys over the disk target is history — every
 * edit is a commit by the person who made it, so the repository is a record of the wiki and not only a
 * copy of it — and a second place the content lives that is not this machine.
 *
 * The layout, the front matter and what makes a file a page are all `helpers/storageFiles.ts`, shared
 * with the disk target. This module is what git adds on top: a commit per change, and a sync.
 *
 * **The working copy is a cache.** It is a directory on whichever pod happens to be running, and an
 * HA set has one per pod — none of them on a volume the others can see, and perhaps none on a volume
 * at all. So nothing is kept only there. A change made in the wiki is queued in the database
 * (`storageOutbox`) by the instance that made it, and the commit the wiki and the remote last agreed on
 * is recorded there too (`storageSyncState`). A sync, on whichever instance runs it, puts its own
 * working copy at that commit, replays the queue on top as one commit per change, and publishes. Two
 * instances never sync the same target at once (`exclusive`), and an instance whose copy is empty,
 * stale or wedged simply rebuilds it.
 *
 * **Nothing waits on git but the sync.** A page save is a row inserted; the commit, the push and the
 * pull all happen in `sync`, which the scheduler runs every few minutes and an administrator can run on
 * demand. An unreachable remote cannot make the wiki slow to edit, or fail an upload.
 *
 * **A pull is authoritative.** What it brings in is applied to the wiki, replacing what is there — and
 * a commit that deleted a file deletes the page or the asset here too, which is the whole point of
 * pointing a wiki at a repository other people push to. It also means push access to the remote is
 * effectively write access to the wiki, which is worth knowing before configuring one. It is also how
 * a file that changed on both sides is settled: the remote wins it, since nobody is here to be asked.
 * And it is applied once: the diff is taken from the commit last agreed on, which every instance
 * reads from the same row.
 */
const gitStorage: StorageModule = {
  canStore(target, ref) {
    return (
      acceptsWrites(target) && WIKI.models.storage.pathPrefixFor(target.siteId, ref.locale) !== null
    )
  },

  async putAsset(target, ref, data) {
    const relPath = assetRelPath(target, ref)
    if (!relPath) {
      throw new Error(
        `(STORAGE/GIT) ${target.title} has no path for ${ref.locale} content, so ${ref.fileName} cannot be stored there.`
      )
    }
    await WIKI.models.storage.queueChange(target, {
      kind: 'asset',
      op: 'put',
      path: relPath,
      label: assetLabel(ref),
      data,
      actorId: ref.actorId
    })
  },

  /**
   * The bytes of an asset, from the queue if they have not been published yet and from the commit
   * last synced if they have.
   *
   * An asset whose only home is this target has its bytes in the queue until a sync has pushed them,
   * and it may have been moved since — which queues no bytes of its own — so a move is followed back
   * to wherever the file was before it.
   */
  async getAsset(target, ref) {
    let relPath = assetRelPath(target, ref)
    if (!relPath) {
      return null
    }
    let beforeId: number | undefined
    for (let hop = 0; hop < MAX_MOVE_HOPS; hop++) {
      const change = await WIKI.models.storage.latestQueuedAt(target, relPath, beforeId)
      if (!change) {
        break
      }
      if (change.op === 'put') {
        return WIKI.models.storage.queuedData(change.id)
      }
      if (change.op === 'delete' || !change.previousPath) {
        return null
      }
      relPath = change.previousPath
      beforeId = change.id
    }
    const commit = await syncedCommit(target)
    return commit ? readBlob(target, commit, relPath) : null
  },

  async deleteAsset(target, ref) {
    const relPath = assetRelPath(target, ref)
    if (!relPath || !acceptsWrites(target)) {
      return
    }
    await WIKI.models.storage.queueChange(target, {
      kind: 'asset',
      op: 'delete',
      path: relPath,
      label: assetLabel(ref),
      actorId: ref.actorId
    })
  },

  async moveAsset(target, ref, previous) {
    if (!acceptsWrites(target)) {
      return
    }
    await queueMove(
      target,
      'asset',
      {
        path: assetRelPath(target, { ...ref, ...previous }),
        label: assetLabel({ ...ref, ...previous })
      },
      { path: assetRelPath(target, ref), label: assetLabel(ref) },
      ref.actorId
    )
  },

  async putPage(target, ref, page) {
    const relPath = pageRelPath(target, ref)
    if (!relPath || !acceptsWrites(target)) {
      return
    }
    await WIKI.models.storage.queueChange(target, {
      kind: 'page',
      op: 'put',
      path: relPath,
      label: pageLabel(ref),
      message: ref.reason,
      data: Buffer.from(serializePage(ref, page), 'utf8'),
      actorId: ref.actorId
    })
  },

  async deletePage(target, ref) {
    const relPath = pageRelPath(target, ref)
    if (!relPath || !acceptsWrites(target)) {
      return
    }
    await WIKI.models.storage.queueChange(target, {
      kind: 'page',
      op: 'delete',
      path: relPath,
      label: pageLabel(ref),
      actorId: ref.actorId
    })
  },

  async movePage(target, ref, previous) {
    if (!acceptsWrites(target)) {
      return
    }
    await queueMove(
      target,
      'page',
      {
        path: pageRelPath(target, { ...ref, ...previous }),
        label: pageLabel({ ...ref, ...previous })
      },
      { path: pageRelPath(target, ref), label: pageLabel(ref) },
      ref.actorId
    )
  },

  /**
   * Publish what the wiki has queued, and apply what the remote has that the wiki has not.
   *
   * The direction is the target's `syncMode`: `push` never takes anything in and force-pushes, so the
   * wiki wins; `pull` never sends anything, so the remote does; `sync` does both, rebasing the wiki's
   * commits on top of what it fetched — and resolving whatever that conflicts on rather than stopping
   * half way through it. See `rebaseOnto`.
   */
  async sync(target: StorageTarget, actorId: string): Promise<string> {
    return exclusive(
      target,
      'Another instance is syncing this target right now; what the wiki has queued will be published by that sync or the next one.',
      (repo) => publish(repo, target, actorId)
    )
  },

  /**
   * Write and commit everything this target should be holding but has never been given, then sync.
   *
   * The way in for content that predates the target: a wiki that ran for a year before git was
   * enabled has a repository with nothing in it, and nothing in the ordinary course of things ever
   * goes back for those pages. One commit, by the administrator who asked for it, since it is their
   * action and not a hundred authors' edits — made as part of a sync, since a commit made anywhere
   * else would be in one pod's working copy and nowhere else.
   */
  async syncUntracked(target: StorageTarget, actorId: string): Promise<string> {
    if (!acceptsWrites(target)) {
      return 'This target is set to Pull only, so nothing the wiki holds is written to the repository.'
    }
    return exclusive(
      target,
      'Another instance is syncing this target right now. Try again once it has finished.',
      (repo) => publish(repo, target, actorId, { addUntracked: true })
    )
  },

  /**
   * Take everything the repository holds into the wiki, whatever the last commit did.
   *
   * For a repository that already had content before this target existed: the sync only ever applies
   * what changed between two commits, and the first sync applies nothing at all, so a repository with
   * a thousand files in it has none of them in the wiki. The repository wins every collision,
   * consistent with what a pull does — except over a file the wiki has changed since and not yet
   * published, which is newer here than there.
   *
   * Read out of the commit last synced rather than off the working tree, which on this instance may be
   * anything from empty to part way through the next sync.
   */
  async importAll(target: StorageTarget, actorId: string): Promise<string> {
    return withRepo(target, async (repo) => {
      const commit = await syncedCommit(target)
      if (!commit) {
        return 'This target has not synced with its repository yet, so there is nothing to import. Run a Force Sync first.'
      }
      if (!(await hasCommit(repo, commit)) && target.config.repoUrl) {
        await fetchRemote(repo, target)
      }
      const unpublished = new Set(
        (await WIKI.models.storage.queuedChanges(target)).flatMap((change) =>
          change.previousPath ? [change.path, change.previousPath] : [change.path]
        )
      )
      const files: StoredFile[] = (
        await repo.git.raw(['ls-tree', '-r', '-z', '--name-only', commit])
      )
        .split('\0')
        .filter((relPath) => relPath !== '' && !unpublished.has(relPath))
        .map((relPath) => ({ filePath: relPath, segments: relPath.split('/') }))
        .filter(({ segments }) => !isIgnoredPath(segments))
      return describeImport(
        await importTree({
          target,
          root: repo.root,
          actorId,
          overwrite: true,
          files,
          readFile: async (relPath) =>
            (await repo.git.binaryCatFile(['blob', `${commit}:${relPath}`])) as Buffer
        })
      )
    })
  },

  /**
   * Throw this instance's working copy away.
   *
   * Nothing is lost by it when there is a remote: what has not been published is in the queue, and the
   * next sync on this instance builds the working copy again from the remote. It is for a copy git can
   * no longer make sense of at all — and is about the instance that answered the request, which in an
   * HA set is whichever one the load balancer picked.
   */
  async purge(target: StorageTarget): Promise<string> {
    const root = repoDir(target)
    return withRepo(target, async () => {
      WIKI.logger.info(`(STORAGE/GIT) Purging the working copy at ${root}...`)
      await fs.rm(root, { recursive: true, force: true })
      // -> Dropped rather than reused: it holds a SimpleGit bound to a directory that no longer
      //    exists, and the next operation is what sets the replacement up
      repos.delete(target.id)
      return target.config.repoUrl
        ? "This instance's working copy has been removed. The next sync here takes it again from the remote, with the changes the wiki has queued on top."
        : 'The local repository has been emptied, history and all. It will be initialized again on the next sync.'
    })
  }
}

/**
 * One sync, on this instance's working copy, with no other instance syncing the same target.
 *
 * In order: put the working copy at the commit last agreed on, commit the queue on top, settle with
 * the remote's branch (rebase, or force, or neither, by mode), push, apply what the remote brought,
 * and only then drop what was published from the queue and record the new commit — both at once. An
 * instance that dies anywhere before that last step leaves the queue and the record as they were, so
 * the next sync, on whichever instance, does it all again: the commits it replays are already on the
 * remote and the rebase drops them as such, and the changes it applies are applied the same way twice.
 *
 * **The first sync with a remote applies nothing.** With no commit agreed on yet — a new target, one
 * pointed at another repository or branch, or one whose commit the remote no longer has because
 * somebody rewrote its history — the remote's branch is taken up as it is and the queue committed on
 * top. There is nothing to diff it against, and a scheduled job that started rewriting pages out of a
 * repository it had only just been introduced to would be a surprise, most of all where the wiki had
 * deleted them on purpose. Import Everything is what takes the repository's content in.
 */
async function publish(
  repo: Repo,
  target: StorageTarget,
  actorId: string,
  { addUntracked = false }: { addUntracked?: boolean } = {}
): Promise<string> {
  const mode = modeOf(target)
  const branch = branchOf(target)
  const remote = target.config.repoUrl || ''
  const known = await syncedCommit(target)
  const queue = await WIKI.models.storage.queuedChanges(target)
  const toReplay = acceptsWrites(target) ? queue : []
  const parts: string[] = []

  if (!remote) {
    const base =
      known && (await hasCommit(repo, known))
        ? known
        : await resolveRef(repo, `refs/heads/${branch}`)
    await checkoutAt(repo, branch, base)
    const published = await replay(repo, target, toReplay)
    if (addUntracked) {
      parts.push(await commitUntracked(repo, target, actorId))
    }
    const head = await resolveRef(repo, 'HEAD')
    await WIKI.models.storage.settleSync(target, {
      published,
      state: head ? { remote, branch, commit: head } : null
    })
    parts.unshift(
      `No repository URI is configured, so the repository is this instance's alone: ${published.length} queued change(s) were committed to it and nothing was pushed.`
    )
    return parts.join(' ')
  }

  const remoteHead = await fetchRemote(repo, target)
  const base = known && (await hasCommit(repo, known)) ? known : remoteHead
  const attaching = base !== null && base !== known
  await checkoutAt(repo, branch, base)

  const published = await replay(repo, target, toReplay)
  if (addUntracked) {
    parts.push(await commitUntracked(repo, target, actorId))
  }
  const before = await resolveRef(repo, 'HEAD')

  let conflicted: string[] = []
  if (mode === 'sync' && remoteHead && base && base !== remoteHead) {
    WIKI.logger.info(`(STORAGE/GIT) Rebasing onto origin/${branch}...`)
    conflicted = await rebaseOnto(repo, branch, base)
  } else if (mode === 'pull' && remoteHead && base !== remoteHead) {
    await checkoutAt(repo, branch, remoteHead)
  }
  const head = await resolveRef(repo, 'HEAD')

  if (mode !== 'pull' && head && head !== remoteHead) {
    WIKI.logger.info(`(STORAGE/GIT) Pushing to origin/${branch}...`)
    // -> `--force` only in push mode, which is the mode that says the wiki is the authority
    await repo.git.push(
      'origin',
      branch,
      mode === 'push' ? ['--signed=if-asked', '--force'] : ['--signed=if-asked']
    )
  }

  const changes =
    !attaching && mode !== 'push' && before && head && before !== head
      ? await changedPaths(repo, before, head)
      : []

  // -> What is still queued and was not replayed: changes made in the wiki while this ran, in any mode
  //    but Pull only, and changes made before a target was switched to it, in that one
  const replayed = new Set(published)
  const pending = (await WIKI.models.storage.queuedChanges(target)).filter(
    (change) => !replayed.has(change.id)
  )
  // -> A home page's README is queued as `README.md` whatever the repository calls it, so a change to
  //    any of its names on the remote is a change to the same file
  const touched = (change: StorageQueuedChange) =>
    (change.previousPath ? [change.path, change.previousPath] : [change.path]).flatMap((relPath) =>
      readmeVariants(target, relPath)
    )
  const discarded: number[] = []
  let held = new Set<string>()
  if (mode === 'pull') {
    // -> The remote is the only author in this mode, so a queued change to a file it has changed since
    //    is overruled rather than held on to until the mode changes back
    const incoming = new Set(
      changes.flatMap((change) =>
        [change.segments, change.previousSegments].flatMap((s) => (s ? [s.join('/')] : []))
      )
    )
    for (const change of pending) {
      if (touched(change).some((relPath) => incoming.has(relPath))) {
        discarded.push(change.id)
      }
    }
  } else {
    // -> Newer than anything the remote has, so the wiki keeps them and the next sync publishes them
    held = new Set(pending.flatMap(touched))
  }

  if (attaching) {
    parts.unshift(
      `This target had no commit agreed with origin/${branch} - it has not synced with it before, or the remote's history was rewritten since - so the remote's branch was taken up as it stands${published.length > 0 ? ` and ${published.length} queued change(s) committed on top of it` : ''}. Nothing in the wiki itself was changed: run Import Everything if the repository holds content this wiki does not.`
    )
  } else if (changes.length > 0) {
    parts.unshift(await applyIncoming(repo, target, changes, held, actorId))
  } else if (mode === 'push') {
    parts.unshift(`Pushed ${published.length} queued change(s) to the remote.`)
  } else if (!remoteHead) {
    parts.unshift(
      mode === 'pull'
        ? 'Synced. The remote does not have this branch yet, so there was nothing to pull.'
        : `Synced. The remote did not have this branch yet, and ${published.length} queued change(s) created it.`
    )
  } else {
    parts.unshift(
      `Synced. Nothing had changed on the remote${mode === 'pull' ? '' : `, and ${published.length} queued change(s) were published`}.`
    )
  }
  if (conflicted.length > 0) {
    parts.push(
      `${conflicted.length} file(s) had changed both here and on the remote, and the remote's version won. A page it replaced keeps its previous version in its history; a file has none.`
    )
  }

  await WIKI.models.storage.settleSync(target, {
    published: [...published, ...discarded],
    state: head ? { remote, branch, commit: head } : null
  })
  return parts.join(' ')
}

/**
 * Write everything this target should be holding into the working copy, and commit what was missing.
 */
async function commitUntracked(
  repo: Repo,
  target: StorageTarget,
  actorId: string
): Promise<string> {
  const counts = await writeEverything(repo, target)
  await repo.git.add(['-A', '--', '.'])
  const committed = await commitPaths(repo, target, ['.'], 'docs: add all untracked content', {
    actorId
  })
  WIKI.logger.info(
    `(STORAGE/GIT) Wrote ${counts.pages} page(s) and ${counts.assets} asset(s) to ${repo.root} [ OK ]`
  )
  const parts = [
    committed
      ? `Committed the untracked part of ${counts.pages} page(s) and ${counts.assets} asset(s).`
      : `Wrote ${counts.pages} page(s) and ${counts.assets} asset(s); all of it was already tracked.`
  ]
  if (counts.unreadable > 0) {
    parts.push(`${counts.unreadable} asset(s) could not be read and were skipped.`)
  }
  if (counts.unstored > 0) {
    const { primaryLocale } = WIKI.models.storage.pathLayoutFor(target.siteId)
    parts.push(
      `${counts.unstored} item(s) are not in the ${primaryLocale} locale, which is the only one this site stores.`
    )
  }
  return parts.join(' ')
}

/**
 * Apply what the remote changed to the wiki.
 *
 * A file that arrived or changed is imported with the repository winning; one that went is deleted. A
 * rename is both, in that order, which is what moves a page rather than losing its history to a
 * delete and a create.
 *
 * @param held Paths the wiki changed while the sync ran. The wiki's version is the newer one, and the
 *   next sync publishes it over the remote's, so the remote's is not applied over it in the meantime.
 */
async function applyIncoming(
  repo: Repo,
  target: StorageTarget,
  changes: DiffEntry[],
  held: Set<string>,
  actorId: string
): Promise<string> {
  const files: StoredFile[] = []
  const removals: string[][] = []
  let heldBack = 0
  for (const change of changes) {
    const paths = [change.segments, change.previousSegments].flatMap((s) =>
      s ? [s.join('/')] : []
    )
    if (paths.some((relPath) => held.has(relPath))) {
      heldBack++
      continue
    }
    if (change.status === 'D') {
      removals.push(change.segments)
      continue
    }
    if (change.status === 'R' && change.previousSegments) {
      removals.push(change.previousSegments)
    }
    files.push({
      filePath: absPathIn(repo.root, change.segments.join('/')),
      segments: change.segments
    })
  }

  const summary = await importTree({
    target,
    root: repo.root,
    actorId,
    overwrite: true,
    files
  })

  let deletedPages = 0
  let deletedAssets = 0
  for (const segments of removals) {
    try {
      // -> Not queued back for this target: the file is already gone from the repository
      const removed = await WIKI.models.storage.importingFrom(target, () =>
        removeFromWiki(target, segments, actorId)
      )
      if (removed === 'page') {
        deletedPages++
      } else if (removed === 'asset') {
        deletedAssets++
      }
    } catch (err: any) {
      // -> One entry the wiki could not let go of must not stop the rest of the commit being applied
      WIKI.logger.warn(`(STORAGE/GIT) Could not delete ${segments.join('/')} [ SKIPPED ]`)
      WIKI.logger.warn(`(STORAGE/GIT) ${err.message}`)
    }
  }

  const parts = ['Synced.']
  if (summary && (summary.pages > 0 || summary.assets > 0)) {
    parts.push(`Took in ${summary.pages} page(s) and ${summary.assets} asset(s).`)
  }
  if (deletedPages > 0 || deletedAssets > 0) {
    parts.push(`Deleted ${deletedPages} page(s) and ${deletedAssets} asset(s) the remote removed.`)
  }
  if (summary && summary.failed > 0) {
    parts.push(`${summary.failed} could not be imported - see the server log.`)
  }
  if (heldBack > 0) {
    parts.push(
      `${heldBack} file(s) the remote changed were changed in the wiki too while this ran; the wiki's version is published next.`
    )
  }
  if (parts.length === 1) {
    parts.push('Nothing the remote changed affected this wiki.')
  }
  return parts.join(' ')
}

export default gitStorage
