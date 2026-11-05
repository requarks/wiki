# Wiki.js Fork — Feature Guide

This wiki runs an **opinionated fork of [Wiki.js](https://github.com/requarks/wiki) 2.x** maintained at [arsenixprime/wiki](https://github.com/arsenixprime/wiki). It tracks upstream Wiki.js and layers the features below on top. Everything is **opt-in through the normal admin UI**; stock Wiki.js behaviour is unchanged until a feature is turned on.

This page is the rolling, user-facing guide: what each feature does, where to turn it on, and how to use it. For internals (tables, GraphQL, code paths) see the technical reference `dev/docs/corporate-workflow.md` in the repository.

**Which build am I on?** Admin → System Info → **Git Build** shows the branch, commit and date of the running build. Compare it with the [Releases](https://github.com/arsenixprime/wiki/releases) page.

---

## Release history

| Version | Date | What it added |
|---|---|---|
| `v2.5.314_jp` | 2026-06-13 | Clipboard image paste and drag-and-drop in both editors |
| `v2.5.314_jp2` | 2026-09-09 | Corporate workflow (Watch, Managed pages, Review/Approve, groups everywhere), mail-failure alert, Private site, Hide "Powered by Wiki.js", Print QR code, customizable load/save animation, Git build info |
| `v2.5.317_jp1` | 2026-11-05 | Includes upstream **2.5.316** and **2.5.317**: the **Export for Wiki.js 3.x** utility under Admin → Utilities, which produces the `.wkbackup` package the Wiki.js 3 importer reads; and the Node security updates of the 2.5.317 build |
| `v2.5.315_jp3` | 2026-10-30 | Drafts-in-progress warning: opening the editor on a page that already has drafts shows a dialog listing them, with Review / Edit draft / Back to page / Edit live page anyway, so pending drafts can be merged before the live page is changed |
| `v2.5.315_jp2` | 2026-10-24 | fix: the floating edit (pencil) button covered the draft actions at the bottom of the sidebar workflow card; the sidebar now scrolls far enough to clear it |
| `v2.5.315_jp1` | 2026-10-03 | Includes upstream **2.5.315** (two security fixes: XSS through Vue directives in page content, and delegated user managers editing administrators); print view shows last editor and revision date under the title; fix: watch-digest job could freeze the whole server for minutes on large, heavily edited pages; SMTP timeouts bounded so an unreachable mail host can't stall a publish |
| `v2.5.314_jp3` | 2026-09-30 | Staged list editing in the Workflow tab (Apply changes / Discard); fix: saving more than one manager/approver/watcher failed on SQLite and MySQL; fix: Admin dashboard stayed blank / statistics never loaded on released builds because the `_jpN` version suffix crashed the version comparison |

Versions follow the upstream Wiki.js release they are based on, with a `_jpN` suffix. Docker images: `ghcr.io/arsenixprime/wiki:<version>` (and `:latest`).

---

## Editing

### Clipboard image paste and drag-and-drop

Paste a screenshot from the clipboard, or drop image files, directly into the **Markdown** or **Visual** editor. The image is uploaded as a page asset and a link is inserted at the cursor. Works on Windows, macOS and Linux.

- Pasted images land in the **root assets folder** with a generated name such as `pasted_20260930_1412_a7k3.png` (browsers name every clipboard image `image.png`, and Wiki.js overwrites assets with the same name, so a unique name is generated).
- Dropped files keep their own file name, lower-cased and with spaces replaced by underscores, matching how the server stores them.
- Requires the **Upload Assets** (`write:assets`) permission, the same one the Assets dialog needs.

---

## Controlled publishing workflow

Four features that turn a page into a governed document. They are configured per page in the editor under **Page Properties → Workflow** (the fifth tab). The tab is only usable on a page that has been **saved at least once**, by users who can **manage pages** (or administrators). Day-to-day use happens in the **Workflow panel** in the right-hand sidebar of every page.

### Watch

Be emailed when a page's published content changes.

- **Watch yourself**: open the page, find **Workflow** in the sidebar, click the eye icon. Click again to unwatch. Any reader can do this.
- **Assign others**: Page Properties → Workflow → **Watchers**. Managers and admins can add individual users or whole groups.
- Emails are **debounced**: a burst of edits produces **one** digest, sent after a quiet period (site default 30 minutes; override per page with **Notification delay**). The digest includes who changed what, a compact stats line and a link to the diff.
- The person who made the change is never emailed about their own edit.

### Managed pages

Restrict direct publishing to designated **managers**; everyone else proposes changes as **drafts**.

1. Page Properties → Workflow → turn on **Only managers may publish directly** and add managers (users or groups). Click **Apply changes**.
2. Anyone else who edits the page sees an orange **managed** banner. Their **Save** stores a **draft**, never the live page. Drafts open in the full editor (preview, image paste, toolbar, all of it).
3. The author clicks **Submit for review** (in the banner or the sidebar). Managers are emailed.
4. A manager opens the page, and in the sidebar's **Drafts** list clicks **Review draft** to see a side-by-side diff, then **Publish** or **Reject** (with an optional comment emailed back to the author).
5. Publishing records the **author** as the page author, and the manager as the publisher. The draft is then removed.

Notes:
- The sidebar shows **Managed page**. Hover or click it to see who the managers are.
- Drafts are collaborative by design: any user who can author a draft on the page can edit or delete any draft on it.
- Drafts never appear in search, navigation, the page tree or the sitemap.
- Authoring a draft requires normal page-edit rights on the page.
- **Drafts-in-progress warning**: opening the editor on a page that already has drafts shows a dialog listing them (title, status, last editor) before any edit is made. From it you can **Review** a draft (opens the side-by-side diff on the page, where a manager can publish it), **Edit draft** to continue it, go **Back to page**, or **Edit live page anyway**. This gives managers a chance to merge pending drafts before changing the live page underneath them. It applies to every way into the editor (pencil button, menu, keyboard shortcut, direct URL) and is not shown when you are already editing a draft.

### Review / Approve

Per-revision sign-off by designated **approvers**.

- Page Properties → Workflow → **Approval mode**:
  - **Off** — no sign-off.
  - **Review (informal sign-off)** — approvers are asked to review; the sidebar shows "Reviewed by X of Y".
  - **Approve (formal approval badge)** — same flow, and once **every** current approver has approved the current revision the page shows a prominent **Approved** badge.
- Add approvers (users or groups) and click **Apply changes**.
- On every publish, approvers are emailed. Someone who approved an earlier revision gets a **delta** email with a diff since their last approval.
- Approvers act in the sidebar: **Approve** (one click) or **Request changes** with a comment, which emails the last editor and the managers.
- Approvals are **per revision**. Any later publish silently un-approves everyone until they re-approve. The status list is visible to all readers.

### Groups everywhere

Watchers, managers and approvers can be **users or groups**. Group membership is looked up **live** every time it matters, never snapshotted:

- Add someone to an approver group and they immediately become a pending approver for the current revision. That can move a fully-approved page back to pending. This is intended.
- A user reachable both directly and through a group gets one email and one approval slot.
- The group pickers list every group defined in Admin → Groups.

### Editing the lists (Apply changes / Discard)

In the Workflow tab, list edits are **staged** so it is always clear what is about to change:

- Newly added people or groups show as a green chip marked **new**.
- Removed entries stay visible, crossed out and marked **removing**, with an **undo** control to put them back.
- A caption below the list summarises pending edits, e.g. *"2 to add, 1 to remove — not yet applied."*
- **Apply changes** is greyed out until something has changed. **Discard** reverts to the saved list. After applying, the list renders normally.
- The Managed toggle, Approval mode and Notification delay are single values and still save immediately when changed.

### Email

Every step sends mail through the normal Wiki.js mail settings (Admin → Mail): watch digests, draft submitted, draft rejected, approval requested, changes requested. Links in the emails use the site host configured in Admin → General.

---

## Administration and presentation

### Mail-failure alert

Because the workflow depends on email, a failed send must not be silent. If a message cannot be sent (SMTP error, or mail not configured when something tried to send), every **administrator** sees a red banner on every page:

> Email delivery is failing — N message(s) could not be sent. Notifications may not be reaching users.

with **Mail settings** and **Dismiss** buttons. Dismissing clears the alert; it reappears on the next failure. This detects send failures; bounces after delivery are not tracked.

### Private site

Admin → General → **Private site**. Hides the social share targets (Facebook, Twitter, LinkedIn, Reddit, Telegram, Viber, Weibo, WhatsApp) from a page's share menu, leaving only **Copy URL** and **Email**.

### Hide "Powered by Wiki.js"

Admin → General → **Hide "Powered by Wiki.js"**. Removes the attribution from the page footer, which also removes it from printed output.

### Print header: last editor and revision date

Always on. When a page is printed, a line under the title reads *Last edited by &lt;name&gt; on &lt;date&gt;*, taken from the page's current revision. It is hidden on screen (except in the print preview opened from the page's printer button).

### Print QR code

Admin → General → **Print QR code**. When a page is printed (browser Print or Save as PDF), a small QR code linking back to the live page is placed in the page-title header, to the right of the title. Useful on printed procedures so readers can jump to the current version.

### Customizable load/save animation

Admin → Theme → **Loading & Saving Animation**. Choose the spinner shown while pages load (top bar) and save (editor progress dialog): **20 presets**, a **colour**, and a **speed**, with a live preview. One setting covers both.

### Git build info

Admin → System Info → **Git Build** row: branch, short commit and commit date of the running build. Works for Docker images from the release pipeline, for bare-metal installs from a git checkout, and in development. If nothing is known the row is hidden.

---

## Deploying and upgrading

Each release publishes a Docker image and a bare-metal tarball:

```bash
docker pull ghcr.io/arsenixprime/wiki:2.5.314_jp2
```

Pin a version tag rather than `:latest` on production hosts, and confirm the upgrade took effect in Admin → System Info → **Git Build**. Database migrations run automatically at start-up; the workflow features add tables on first boot. SQLite, PostgreSQL, MySQL and SQL Server are all supported.

To cut a new release, push a tag `v<upstream>_jpN` to the fork; the `release-fork` GitHub Actions workflow builds and publishes it.

---

## Keeping this page current

Add a row to **Release history** and a section (or a bullet) under the relevant heading whenever a fork feature ships. The authoritative copy lives in the repository at `dev/docs/fork-features.md`; paste the latest version here after each release.
