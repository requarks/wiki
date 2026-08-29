import fs from 'node:fs/promises'
import path from 'node:path'
import { CheckRepoActions, simpleGit } from 'simple-git'
import {
  absPathIn,
  assetRelPath,
  importTree,
  moveStored,
  pageRelPath,
  resolveRoot,
  serializePage,
  walkStored
} from '../../../helpers/storageFiles.ts'
import type { ImportSummary, StoredFile } from '../../../helpers/storageFiles.ts'
import type { SimpleGit } from 'simple-git'
import type { StorageModule, StoragePageRef, StorageTarget } from '../../../models/storage.ts'

/** Where the working copy goes when the target has no path configured, per the definition default. */
const DEFAULT_REPO_PATH = './data/repo'

/** What a change with no one person behind it is committed as, per the definition defaults. */
const FALLBACK_AUTHOR = { name: 'Wiki.js', email: 'wiki@example.com' }

/**
 * One repository, as this module keeps it between operations.
 *
 * Cached against the configuration it was set up from, so that changing a setting in the admin area
 * takes effect on the next operation rather than at the next restart.
 */
interface Repo {
  git: SimpleGit
  root: string
  /** The configuration this was prepared from — see `configFingerprint`. */
  fingerprint: string
  /** Whether the remote has been contacted since this entry was made. See `ensureRemote`. */
  remoteReady: boolean
  /** Serializes work on this repository. See `withRepo`. */
  queue: Promise<unknown>
}

const repos = new Map<string, Repo>()

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
 * Prepare the local repository, without touching the network.
 *
 * Everything an ordinary page save needs: a working copy that exists, is a repository, knows who it
 * is committing as and has `origin` pointing where the configuration says. Deliberately *not* the
 * fetch and the checkout — see `ensureRemote`. A page save must not wait on a remote, and with the
 * commits made locally and pushed by the sync there is no reason for it to.
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
    fingerprint: configFingerprint(target),
    remoteReady: false,
    queue: Promise.resolve()
  }
}

/**
 * Run something against this target's repository, one operation at a time.
 *
 * Git takes a lock on the index for the length of a write, so two uploads landing together would have
 * one of them fail on `index.lock` rather than wait. Serializing here is what makes concurrent saves
 * safe, and the queue is per target because two targets are two working copies.
 */
async function withRepo<T>(target: StorageTarget, run: (repo: Repo) => Promise<T>): Promise<T> {
  let repo = repos.get(target.id)
  if (!repo || repo.fingerprint !== configFingerprint(target)) {
    repo = await prepareRepo(target)
    repos.set(target.id, repo)
  }
  const entry = repo
  const result = entry.queue.then(
    () => run(entry),
    () => run(entry)
  )
  // -> The queue holds the settled outcome rather than the result, so one failed operation does not
  //    reject every operation queued behind it
  entry.queue = result.catch(() => {})
  return result
}

/**
 * Bring the working copy onto the configured branch, having contacted the remote.
 *
 * The part of the 2.x module's `init` that costs a network round trip, split off so that only a sync
 * pays for it. A repository with no remote configured is left as the purely local one it is.
 *
 * @returns Whether the remote already has the branch, which decides whether there is anything to pull
 */
async function ensureRemote(repo: Repo, target: StorageTarget): Promise<{ onRemote: boolean }> {
  const branch = target.config.branch || 'main'
  if (!target.config.repoUrl) {
    return { onRemote: false }
  }
  if (!repo.remoteReady) {
    await repo.git.raw(['remote', 'update', 'origin', '--prune'])
  }

  const branches = await repo.git.branch(['-a'])
  const onRemote = branches.all.includes(`remotes/origin/${branch}`)
  const onLocal = branches.all.includes(branch)

  /*
    A remote that does not have the branch yet is the ordinary state of a repository somebody has just
    created, and the first push is what creates it — 2.x refused to start at all in that case, which
    made an empty remote something an administrator had to go and fix by hand before the wiki would
    talk to it.

    What is still worth refusing is a branch that exists nowhere on a remote that has other branches,
    because that is a typo rather than a beginning.
  */
  if (!onRemote && !onLocal) {
    const remoteBranches = branches.all.filter((b) => b.startsWith('remotes/origin/'))
    if (remoteBranches.length > 0) {
      throw new Error(
        `The branch "${branch}" does not exist locally or on the remote, which has ${remoteBranches
          .map((b) => b.replace('remotes/origin/', ''))
          .join(', ')}. Check the branch name, or create it on the remote first.`
      )
    }
  } else if (onRemote && branches.current !== branch) {
    WIKI.logger.info(`(STORAGE/GIT) Checking out branch ${branch}...`)
    await repo.git.checkout(branch)
  }

  repo.remoteReady = true
  return { onRemote }
}

/**
 * What git has stopped in the middle of, if anything.
 *
 * A rebase or a merge that hits a conflict is not an operation that failed and ended — it is one that
 * is still going, waiting for somebody to resolve it, with the index unmerged until they do. Nothing
 * here resolves anything, so the only question worth asking is whether the working copy is in that
 * state at all.
 */
async function interruptedBy(repo: { git: SimpleGit }): Promise<'rebase' | 'merge' | null> {
  const gitDir = await repo.git.revparse(['--absolute-git-dir'])
  const exists = (name: string) =>
    fs.stat(path.join(gitDir, name)).then(
      () => true,
      () => false
    )
  // -> Two directories because there are two rebase backends: `rebase-merge` for the default one and
  //    `rebase-apply` for `--apply`, which is what an administrator working in the repository by hand
  //    may well have left behind
  if ((await exists('rebase-merge')) || (await exists('rebase-apply'))) {
    return 'rebase'
  }
  return (await exists('MERGE_HEAD')) ? 'merge' : null
}

/**
 * Put the working copy back the way it was before an operation git could not finish.
 *
 * The one state this module must never leave behind. An unfinished rebase holds the index unmerged,
 * and git refuses to check out a branch or make a commit against an unmerged index — so it is not one
 * sync that failed but everything after it: every page save, every upload and every later sync, until
 * somebody notices and runs Purge. Aborting restores the branch and the working tree to what they
 * were, so nothing local is lost and the next sync simply tries again.
 *
 * @returns What was rolled back, if anything, so that a report can say it happened
 */
async function abortInterrupted(repo: { git: SimpleGit }): Promise<'rebase' | 'merge' | null> {
  const interrupted = await interruptedBy(repo)
  if (!interrupted) {
    return null
  }
  WIKI.logger.warn(`(STORAGE/GIT) Rolling back an unfinished ${interrupted}...`)
  await repo.git.raw([interrupted, '--abort'])
  return interrupted
}

/** The paths a stopped merge or rebase has left unresolved. */
async function unmergedPaths(repo: { git: SimpleGit }): Promise<string[]> {
  const raw = await repo.git.raw(['diff', '--name-only', '--diff-filter=U', '-z']).catch(() => '')
  return raw.split('\0').filter((p) => p !== '')
}

/**
 * Bring the remote's commits in under the wiki's, resolving whatever collides.
 *
 * A rebase stops at the first conflict and waits for a human, and this one has none: the working copy
 * is the wiki's own, nobody is looking at it, and the sync that started it returns to a scheduler. So
 * a conflicted rebase is rolled back and the pull run again with the remote winning every file that
 * changed on both sides — the direction a pull already has here, where what comes back replaces what
 * is in the wiki and the version it replaced is still in that page's history.
 *
 * `-X ours` reads backwards until you remember which way round a rebase is: the wiki's commits are the
 * ones being replayed, so *theirs* is the wiki and *ours* is what was pulled in.
 *
 * What it does not settle is a file one side changed and the other deleted, since there is no version
 * of it to prefer. That fails the sync — with the working copy put back rather than left half way
 * through a rebase, so the wiki carries on committing while somebody decides which of the two is right.
 *
 * @returns The paths that had to be resolved that way, for the report
 */
async function pullRebase(repo: Repo, branch: string): Promise<string[]> {
  // -> `--autostash` for the same reason as the rest of this: a write that was staged but never
  //    committed would otherwise refuse every pull from here on rather than only this one
  const options = ['--rebase', '--autostash']
  try {
    await repo.git.pull('origin', branch, options)
    return []
  } catch (err: any) {
    const conflicted = await unmergedPaths(repo)
    await abortInterrupted(repo).catch((abortErr: any) => {
      WIKI.logger.warn(`(STORAGE/GIT) Could not roll the rebase back: ${abortErr.message}`)
      return null
    })
    // -> Nothing unmerged means the pull failed for something resolving conflicts cannot fix — an
    //    unreachable remote, a refused key, a branch that has gone — and the sync should say so
    if (conflicted.length < 1) {
      throw err
    }
    WIKI.logger.warn(
      `(STORAGE/GIT) ${conflicted.length} path(s) conflict with origin/${branch}; taking the remote's version...`
    )
    try {
      await repo.git.pull('origin', branch, [...options, '-X', 'ours'])
    } catch (retryErr: any) {
      const unsettled = await unmergedPaths(repo)
      await abortInterrupted(repo).catch(() => null)
      if (unsettled.length < 1) {
        throw retryErr
      }
      throw new Error(
        `${unsettled.slice(0, 5).join(', ')}${unsettled.length > 5 ? ', ...' : ''} changed here and were deleted on the remote, or the other way round, which nothing can settle on its own. Nothing has been changed either side. Decide which of the two is right - Purge Local Repository takes the remote's answer, Force Sync in Push mode takes the wiki's.`
      )
    }
    return conflicted
  }
}

/**
 * Whether this working copy's history and the remote branch's have anything at all in common.
 *
 * They always should, and there is one ordinary way they come not to: the content is a database on one
 * machine and the working copy is a directory on another, so a container replaced without a volume for
 * that directory leaves the wiki with a repository started again from nothing. `prepareRepo`
 * initializes it, the first page save commits into it, and what that produces is a second root — the
 * same paths as the remote already has, and not one commit in common with them.
 */
async function sharesHistoryWith(repo: Repo, branch: string): Promise<boolean> {
  // -> `merge-base` exits non-zero when there is no common commit at all, which simple-git raises
  return repo.git
    .raw(['merge-base', 'HEAD', `origin/${branch}`])
    .then((out) => out.trim().length > 0)
    .catch(() => false)
}

/**
 * Take the remote's history up as this working copy's own, keeping the files the wiki has written.
 *
 * What a rebase cannot do, and what lets a replaced working copy heal itself instead of waiting for an
 * administrator: the two histories are merged, unrelated as they are, and every file that exists on
 * both sides is settled in favour of the working copy. That is the opposite of what `pullRebase` does
 * with a conflict, and deliberately — these local files were written by page saves made *since* the
 * repository was started again, straight out of the wiki's own database, so the remote's copy of one
 * of them is by construction the older. The wiki loses nothing it has, the remote's history and every
 * file the wiki has not touched since come back, and the push that follows leaves the two in step.
 *
 * Nothing is written to the wiki. Its database is the half that survived — it is the working copy that
 * was lost — and a scheduled job that started creating pages out of a repository it had only just been
 * introduced to would be a surprise, most of all where the wiki had deleted them on purpose. Content
 * the repository holds and the wiki does not is what `importAll` is for, which is why the report says
 * so rather than acting on it.
 */
async function reattach(repo: Repo, branch: string): Promise<string> {
  WIKI.logger.warn(
    `(STORAGE/GIT) ${repo.root} has no history in common with origin/${branch}; taking the remote's up...`
  )
  try {
    await repo.git.raw([
      'merge',
      '--allow-unrelated-histories',
      '-X',
      'ours',
      '--no-edit',
      '-m',
      `chore: reconcile the working copy with origin/${branch}`,
      `origin/${branch}`
    ])
  } catch (err: any) {
    await abortInterrupted(repo).catch(() => null)
    throw new Error(
      `This working copy has no history in common with origin/${branch}, and taking the remote's up failed: ${err.message}. Purge Local Repository starts again from the remote's copy.`
    )
  }
  return `The working copy had no history in common with origin/${branch} - which is what a container replaced without a volume for it leaves behind - so the remote's history was taken up and this wiki's own files kept on top of it. Nothing in the wiki itself was changed: run Import Everything if the repository holds content this wiki does not.`
}

/** Whether the repository's own ignore rules exclude this path. */
async function isIgnored(repo: Repo, relPath: string): Promise<boolean> {
  try {
    return (await repo.git.checkIgnore([relPath])).length > 0
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
async function commitAuthor(target: StorageTarget, actorId?: string): Promise<string> {
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
 * The empty check is not an optimization. Every page save reaches this, and most of them save a page
 * whose stored form has not actually changed — a re-publish, a tag reordered into the same order — so
 * without it the repository would fill with empty commits that say a file changed when it did not.
 */
async function commitPaths(
  repo: Repo,
  target: StorageTarget,
  paths: string[],
  message: string,
  actorId?: string
): Promise<boolean> {
  const staged = await repo.git.raw(['diff', '--cached', '--name-only', '--', ...paths])
  if (!staged.trim()) {
    return false
  }
  await repo.git.commit(message, paths, { '--author': await commitAuthor(target, actorId) })
  return true
}

/** Stage a written file and commit it, unless the repository is told to ignore it. */
async function stageAndCommit(
  repo: Repo,
  target: StorageTarget,
  relPath: string,
  message: string,
  actorId?: string
): Promise<void> {
  if (await isIgnored(repo, relPath)) {
    return
  }
  await repo.git.add(relPath)
  await commitPaths(repo, target, [relPath], message, actorId)
}

/**
 * Stage a deletion and commit it.
 *
 * `git rm` fails on a path git has never heard of, which is an ordinary situation here — a file
 * excluded by `.gitignore`, or one deleted before this target was enabled — so the removal is staged
 * from the index instead and a path that was not in it simply leaves nothing to commit.
 */
async function removeAndCommit(
  repo: Repo,
  target: StorageTarget,
  relPath: string,
  message: string,
  actorId?: string
): Promise<void> {
  await fs.rm(absPathIn(repo.root, relPath), { force: true })
  try {
    await repo.git.raw(['rm', '--cached', '--ignore-unmatch', '--', relPath])
  } catch (err: any) {
    WIKI.logger.warn(`(STORAGE/GIT) Could not unstage ${relPath}: ${err.message}`)
    return
  }
  await commitPaths(repo, target, [relPath], message, actorId)
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
      const relPath = pageRelPath(target, ref)
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
    return 'There is nothing in the local repository yet. Run a Force Sync to fetch from the remote first.'
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
 * **Local writes, batched network.** A page save commits and returns; nothing waits on a remote. The
 * push and the pull happen in `sync`, which the scheduler runs every few minutes and an administrator
 * can run on demand. That is why `prepareRepo` and `ensureRemote` are separate: an unreachable remote
 * must not be able to make the wiki slow to edit, or fail an upload.
 *
 * **A pull is authoritative.** What it brings in is applied to the wiki, replacing what is there — and
 * a commit that deleted a file deletes the page or the asset here too, which is the whole point of
 * pointing a wiki at a repository other people push to. It also means push access to the remote is
 * effectively write access to the wiki, which is worth knowing before configuring one. It is also how
 * a file that changed on both sides is settled: the remote wins it, since nobody is here to be asked.
 *
 * **A sync always leaves the working copy usable**, which is what `abortInterrupted` is for. A stopped
 * rebase holds the index unmerged and git then refuses every write against it, so a conflict nobody
 * resolves does not cost one sync — it costs every commit the wiki makes afterwards.
 *
 * **A working copy started again from nothing re-attaches itself.** Losing one is ordinary rather than
 * exceptional: it is a directory in a container, the content is a database somewhere else, and an
 * upgrade that replaces the container without a volume for it takes it with it. What the wiki then has
 * is the remote's files under a root commit of its own, so a sync that finds no commit in common takes
 * the remote's history up instead of rebasing onto it — `reattach`.
 *
 * Everything runs through `withRepo`, one operation at a time per target: git locks its index for the
 * length of a write, so two concurrent uploads would otherwise have one of them fail outright.
 */
const gitStorage: StorageModule = {
  canStore(target, ref) {
    return WIKI.models.storage.pathPrefixFor(target.siteId, ref.locale) !== null
  },

  async putAsset(target, ref, data) {
    const relPath = assetRelPath(target, ref)
    if (!relPath) {
      throw new Error(
        `${target.title} has no path for ${ref.locale} content, so ${ref.fileName} cannot be stored there.`
      )
    }
    await withRepo(target, async (repo) => {
      const filePath = absPathIn(repo.root, relPath)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, data)
      await stageAndCommit(repo, target, relPath, `docs: upload ${assetLabel(ref)}`, ref.actorId)
    })
  },

  async getAsset(target, ref) {
    const relPath = assetRelPath(target, ref)
    if (!relPath) {
      return null
    }
    // -> Read straight off the working copy rather than out of git: what the wiki serves is the
    //    current state of the branch, which is exactly what is checked out
    try {
      return await fs.readFile(absPathIn(repoDir(target), relPath))
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err
      }
      return null
    }
  },

  async deleteAsset(target, ref) {
    const relPath = assetRelPath(target, ref)
    if (!relPath) {
      return
    }
    await withRepo(target, (repo) =>
      removeAndCommit(repo, target, relPath, `docs: delete ${assetLabel(ref)}`, ref.actorId)
    )
  },

  async moveAsset(target, ref, previous) {
    const from = assetRelPath(target, { ...ref, ...previous })
    const to = assetRelPath(target, ref)
    await withRepo(target, async (repo) => {
      const outcome = await moveStored(repo.root, from, to)
      if (outcome === 'nothing') {
        return
      }
      const paths = outcome === 'moved' ? [from!, to!] : [from!]
      for (const relPath of paths) {
        await repo.git.add(['-A', '--', relPath])
      }
      await commitPaths(
        repo,
        target,
        paths,
        outcome === 'moved'
          ? `docs: rename ${assetLabel({ ...ref, ...previous })} to ${assetLabel(ref)}`
          : `docs: delete ${assetLabel({ ...ref, ...previous })}`,
        ref.actorId
      )
    })
  },

  async putPage(target, ref, page) {
    const relPath = pageRelPath(target, ref)
    if (!relPath) {
      return
    }
    await withRepo(target, async (repo) => {
      const filePath = absPathIn(repo.root, relPath)
      // -> Which of the two verbs the commit gets. Read before the write, since afterwards every page
      //    looks like one that was already there.
      const existed = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, serializePage(ref, page), 'utf8')
      await stageAndCommit(
        repo,
        target,
        relPath,
        `docs: ${existed ? 'update' : 'create'} ${pageLabel(ref)}`,
        ref.actorId
      )
    })
  },

  async deletePage(target, ref) {
    const relPath = pageRelPath(target, ref)
    if (!relPath) {
      return
    }
    await withRepo(target, (repo) =>
      removeAndCommit(repo, target, relPath, `docs: delete ${pageLabel(ref)}`, ref.actorId)
    )
  },

  async movePage(target, ref, previous) {
    const from = pageRelPath(target, { ...ref, ...previous })
    const to = pageRelPath(target, ref)
    await withRepo(target, async (repo) => {
      const outcome = await moveStored(repo.root, from, to)
      if (outcome === 'nothing') {
        return
      }
      const paths = outcome === 'moved' ? [from!, to!] : [from!]
      for (const relPath of paths) {
        await repo.git.add(['-A', '--', relPath])
      }
      await commitPaths(
        repo,
        target,
        paths,
        outcome === 'moved'
          ? `docs: rename ${pageLabel({ ...ref, ...previous })} to ${pageLabel(ref)}`
          : `docs: delete ${pageLabel({ ...ref, ...previous })}`,
        ref.actorId
      )
    })
  },

  /**
   * Pull from the remote, push to it, and apply what came back.
   *
   * The direction is the target's `syncMode`, and it decides which half runs: `push` never takes
   * anything in and force-pushes, so the wiki wins; `pull` never sends anything, so the remote does;
   * `sync` does both, rebasing the wiki's commits on top of what it pulled — and resolving whatever
   * that conflicts on rather than stopping half way through it. See `pullRebase`.
   *
   * Whatever a pull brought in is then applied to the wiki — created, replaced, or deleted. That is
   * done from a `--name-status` diff between the commit the branch was on before and the one it is on
   * now, rather than by walking the tree: a sync runs every few minutes, and reading every file in the
   * repository each time to find the two that changed would be absurd.
   */
  async sync(target: StorageTarget, actorId: string): Promise<string> {
    const mode = target.config.syncMode || 'sync'
    const branch = target.config.branch || 'main'
    return withRepo(target, async (repo) => {
      if (!target.config.repoUrl) {
        return 'No repository URI is configured, so there is nothing to sync with. Commits are being made locally.'
      }
      // -> Before anything else touches the repository, since git refuses to move a branch or make a
      //    commit while an earlier operation is unfinished — `ensureRemote`'s checkout is the first
      //    thing to fail, which is why that is what a wedged working copy reports
      const recovered = await abortInterrupted(repo)
      const { onRemote } = await ensureRemote(repo, target)

      const before = await repo.git.revparse(['HEAD']).catch(() => null)
      const parts: string[] = []

      // -> Nothing to pull from a branch the remote does not have yet; the push below creates it
      let conflicted: string[] = []
      let reattached: string | null = null
      if (onRemote && before && !(await sharesHistoryWith(repo, branch))) {
        /*
          In every mode, including the two that would otherwise not go near the remote's history. A
          `push` that forced this working copy onto the remote would replace a wiki's whole repository
          with the handful of pages saved since the copy was started again — the mode says the wiki is
          the authority, and a working copy that has just been created is not the wiki.
        */
        reattached = await reattach(repo, branch)
      } else if (mode !== 'push' && onRemote) {
        WIKI.logger.info(`(STORAGE/GIT) Pulling from origin/${branch}...`)
        conflicted = await pullRebase(repo, branch)
      }
      if (mode !== 'pull') {
        WIKI.logger.info(`(STORAGE/GIT) Pushing to origin/${branch}...`)
        // -> `--force` only in push mode, which is the mode that says the wiki is the authority
        await repo.git.push(
          'origin',
          branch,
          mode === 'push' ? ['--signed=if-asked', '--force'] : ['--signed=if-asked']
        )
      }

      if (reattached) {
        // -> Emphatically not `applyIncoming`: every file on the remote arrived in this working copy
        //    just now, so the diff is the entire repository and applying it would rewrite every page
        //    in the wiki from a copy of itself
        parts.push(reattached)
      } else if (mode !== 'push' && onRemote) {
        const after = await repo.git.revparse(['HEAD']).catch(() => null)
        if (!after) {
          return 'Synced. The repository has no commits yet.'
        }
        parts.push(await applyIncoming(repo, target, before, after, actorId))
      } else if (mode === 'pull') {
        parts.push(
          'Synced. The remote does not have this branch yet, so there was nothing to pull.'
        )
      } else {
        parts.push('Pushed to the remote.')
      }
      if (recovered) {
        parts.push(`An unfinished ${recovered} left by an earlier sync was rolled back first.`)
      }
      if (conflicted.length > 0) {
        parts.push(
          `${conflicted.length} file(s) had changed both here and on the remote, and the remote's version won. A page it replaced keeps its previous version in its history; a file has none.`
        )
      }
      return parts.join(' ')
    })
  },

  /**
   * Write and commit everything this target should be holding but has never been given.
   *
   * The way in for content that predates the target: a wiki that ran for a year before git was
   * enabled has a repository with nothing in it, and nothing in the ordinary course of things ever
   * goes back for those pages. One commit, by the administrator who asked for it, since it is their
   * action and not a hundred authors' edits.
   */
  async syncUntracked(target: StorageTarget, actorId: string): Promise<string> {
    return withRepo(target, async (repo) => {
      const counts = await writeEverything(repo, target)
      await repo.git.add(['-A', '--', '.'])
      const committed = await commitPaths(
        repo,
        target,
        ['.'],
        'docs: add all untracked content',
        actorId
      )
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
    })
  },

  /**
   * Take everything in the working copy into the wiki, whatever the last commit did.
   *
   * For a repository that already had content before this target existed: the sync only ever looks at
   * what changed between two commits, so a repository cloned with a thousand files in it has none of
   * them in the wiki. The repository wins every collision, consistent with what a pull does — this is
   * the same direction, applied to everything at once instead of to a diff.
   */
  async importAll(target: StorageTarget, actorId: string): Promise<string> {
    return withRepo(target, async (repo) =>
      describeImport(await importTree({ target, root: repo.root, actorId, overwrite: true }))
    )
  },

  /**
   * Throw the working copy away and take it again from the remote.
   *
   * The answer to a working copy git can no longer make sense of — unrelated histories, a rebase that
   * cannot be finished, an index that will not unlock. Nothing about the remote changes and nothing is
   * committed, so the cost is any commit that only existed here.
   */
  async purge(target: StorageTarget): Promise<string> {
    const root = repoDir(target)
    return withRepo(target, async () => {
      WIKI.logger.info(`(STORAGE/GIT) Purging the local repository at ${root}...`)
      await fs.rm(root, { recursive: true, force: true })
      // -> Dropped rather than reused: it holds a SimpleGit bound to a directory that no longer
      //    exists, and the next operation is what sets the replacement up
      repos.delete(target.id)
      if (!target.config.repoUrl) {
        return 'The local repository has been emptied. It will be initialized again on the next change.'
      }
      const repo = await prepareRepo(target)
      repos.set(target.id, repo)
      await ensureRemote(repo, target)
      return 'The local repository has been emptied and taken again from the remote. Run Import Everything if the wiki should now say what it holds.'
    })
  }
}

/**
 * Apply what a pull brought in to the wiki.
 *
 * Split out of `sync` because it is the interesting half and reads as its own thing: a diff, and then
 * two lists — what to take in and what to take out. A file that arrived or changed is imported with
 * the repository winning; one that went is deleted. A rename is both, in that order, which is what
 * moves a page rather than losing its history to a delete and a create.
 */
async function applyIncoming(
  repo: Repo,
  target: StorageTarget,
  before: string | null,
  after: string,
  actorId: string
): Promise<string> {
  // -> Nothing came back, which is the ordinary outcome of a sync and worth saying plainly
  if (before === after) {
    return 'Synced. Nothing had changed on the remote.'
  }

  let files: StoredFile[] | null
  const removals: string[][] = []
  if (!before) {
    // -> Nothing to diff against: the branch had no commits here at all, so everything in it is new
    files = await walkStored(repo.root)
  } else {
    const changes = await changedPaths(repo, before, after)
    files = []
    for (const change of changes) {
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
      const removed = await removeFromWiki(target, segments, actorId)
      if (removed === 'page') {
        deletedPages++
      } else if (removed === 'asset') {
        deletedAssets++
      }
    } catch (err: any) {
      // -> One entry the wiki could not let go of must not stop the rest of the commit being applied
      WIKI.logger.warn(`(STORAGE/GIT) Could not delete ${segments.join('/')} [ SKIPPED ]`)
      WIKI.logger.warn(err.message)
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
  if (parts.length === 1) {
    parts.push('Nothing the remote changed affected this wiki.')
  }
  return parts.join(' ')
}

export default gitStorage
