# Changelog

This file documents all changes made in the CultBR fork of Wiki.js (branch `vega`), relative to the upstream [`requarks/wiki`](https://github.com/requarks/wiki) `vega` branch.

Changes are split into two categories: bug fixes that are candidates for upstream pull requests, and CultBR-specific customizations that are intentional fork-only changes.

---

## Bug Fixes (candidates for upstream PR)

### CJS to ESM module wrappers for auth and storage modules

**Files:** `server/modules/authentication/*/index.cjs`, `server/modules/storage/*/index.cjs`, corresponding `.mjs` wrappers

The `package.json` declares `"type": "module"`, which causes Node.js to treat all `.js` files as ESM. The existing authentication and storage modules use `require()` and `module.exports` (CommonJS). To resolve the conflict without rewriting every module, each module file was renamed from `index.js` to `index.cjs` (so Node.js treats them as CJS regardless of `package.json`) and a thin ESM wrapper (`index.mjs`) was created alongside, re-exporting via `createRequire`. The `init` function signature was also adapted to the 3-argument `(passport, id, config)` form expected by the vega branch.

### Fix strategy vs strategyId field name mismatch in auth controller

**File:** `server/controllers/auth.mjs`

The login method was called with `strategy` as the field name, but the method signature and downstream code expected `strategyId`. This caused authentication flows to fail silently.

### Fix WIKI.Error undefined references in users model

**File:** `server/models/users.mjs`

Several call sites referenced `WIKI.Error` which is not defined in the vega codebase (it was renamed/removed). These references were replaced with standard `Error` construction, preventing runtime crashes during user operations.

### Fix null-safe .trim() on page fields in updatePage

**File:** `server/models/pages.mjs`

The `updatePage` function called `.trim()` on page fields (title, description, content) without guarding against null or undefined values. This caused an unhandled exception when saving a page with any of those fields unset. Null-safe guards were added before each `.trim()` call.

### Fix processProfile for v3 schema (no providerId/providerKey columns)

**File:** `server/models/users.mjs`

The `processProfile` function was written against the v2 database schema, which had `providerId` and `providerKey` columns on the users table. The vega branch removed these columns and switched to email-based lookup. The function was updated to match the v3 schema and perform user lookup by email instead.

### Fix OIDC passport-openidconnect verify callback 10-arg signature

**File:** `server/modules/authentication/oidc/index.cjs`

The `passport-openidconnect` strategy calls the verify callback with 10 arguments: `(issuer, uiProfile, idProfile, context, idToken, accessToken, refreshToken, params, tokenSet, done)`. The existing callback was defined with fewer arguments, causing `done` to be `undefined` and authentication to hang. The callback signature was corrected to accept all 10 arguments.

### Fix OIDC state store verification bypass

**File:** `server/modules/authentication/oidc/index.cjs`

The default OIDC state store performs a strict session-based verification that fails in certain deployment configurations (e.g., stateless or cross-origin setups). A custom state store was implemented that bypasses the verification step while still handling state generation, allowing the OIDC callback to complete successfully.

### Manually fetch userinfo with access token for GitLab self-hosted

**File:** `server/modules/authentication/oidc/index.cjs`

When using GitLab as a self-hosted OIDC provider, the `idProfile` object returned by `passport-openidconnect` may be incomplete or empty. The verify callback was updated to manually call the OIDC userinfo endpoint using the access token (with a fallback to the GitLab `/api/v4/user` endpoint) to reliably retrieve the user's email and display name.

### Fix OAuth callback error handling (redirect instead of 500)

**File:** `server/controllers/auth.mjs`

Unhandled errors during the OAuth callback (e.g., cancelled authorization, state mismatch) were propagating as unhandled exceptions and resulting in a generic 500 response. The callback now catches these errors and redirects the user to the login page with an appropriate error query parameter.

### Implement missing save group function in GroupEditOverlay

**File:** `ux/src/components/GroupEditOverlay.vue`

The "Save" button in the admin group edit overlay was rendered but had no handler wired up. The save function was implemented to collect the form state and call the appropriate GraphQL mutation to persist group changes.

### Implement missing assign/unassign user functions in GroupEditOverlay

**File:** `ux/src/components/GroupEditOverlay.vue`

The admin group detail view showed a user list but lacked the ability to add or remove users from a group. Assign and unassign functions were implemented, backed by GraphQL mutations, completing the group membership management flow.

---

## CultBR Customizations (fork-only)

### SCSS theme with CultBR design system colors

**File:** `ux/src/themes/cultbr.scss` (and related Quasar/Vite config)

A custom SCSS theme defines the CultBR design system color palette: primary `#006FEE`, secondary `#39DDA2`, accent `#FFCF00`. These override the default Wiki.js Quasar theme variables globally.

### Fumadocs-style layout

**Files:** `ux/src/layouts/`, `ux/src/components/NavSidebar.vue`, `ux/src/pages/Index.vue`

The global layout was redesigned to match a Fumadocs-style documentation aesthetic: white header, clean left sidebar with light theme, no footer, no breadcrumbs. The sidebar (`NavSidebar`) uses the CultBR color palette and a flat, minimal style.

### Simplified PageHeader (title and edit button only)

**File:** `ux/src/components/PageHeader.vue`

The page header was reduced to display only the page title and an edit button (visible to authenticated users with write permission). All other default elements (tags, actions bar, breadcrumbs, social links) were removed.

### Simplified Index.vue (removed TOC, tags, actions, breadcrumbs)

**File:** `ux/src/pages/Index.vue`

The main page view was stripped down: the table of contents, tags section, page actions toolbar, and breadcrumb navigation were all removed to produce a clean reading experience aligned with the CultBR documentation portal style.

### Login page with CultBR gradient branding

**File:** `ux/src/pages/Login.vue` (or equivalent auth page)

The login page was restyled with the CultBR brand gradient and logo, replacing the default Wiki.js login UI.

### CultBR logo replacing Wiki.js logo

**Files:** `dev/build/public/cultbr.svg`, `Dockerfile`

The Wiki.js logo was replaced with the CultBR logo (`cultbr.svg`) throughout the application. The Dockerfile copies the SVG into the correct location so Vite serves it from the public root.

### Mermaid.js CDN injection in index.html

**File:** `dev/build/index.html` (injected via Dockerfile)

A `<script>` tag loading Mermaid.js from CDN was injected into the main `index.html` to enable Mermaid diagram rendering in wiki pages without requiring a full build-time integration.

### Real-time collaborative editing (Hocuspocus + Yjs + Tiptap Collaboration)

**Files:** `server/core/server.mjs`, `ux/src/components/editors/wysiwyg/`, `package.json`

Real-time collaborative editing was implemented end-to-end:
- Server side: a [Hocuspocus](https://hocuspocus.dev/) WebSocket server is started alongside the main HTTP server, handling Y.Doc synchronization and awareness (cursor presence).
- Client side: the WYSIWYG editor (Tiptap) was extended with the `@tiptap/extension-collaboration` and `@tiptap/extension-collaboration-cursor` extensions, connecting to the Hocuspocus endpoint via `HocuspocusProvider`.
- The Y.Doc is seeded with the page's existing rendered HTML on first connection so users see content immediately before saving.

### Custom WelcomeOverlay with CultBR branding

**File:** `ux/src/components/WelcomeOverlay.vue`

The default Wiki.js welcome/onboarding overlay was replaced with a CultBR-branded version matching the portal's visual identity.

### Multi-select user assignment in admin groups

**File:** `ux/src/components/GroupEditOverlay.vue`

The user assignment dialog in the admin panel was upgraded to support multi-select: users are shown in a checkable list, already-assigned users are hidden, and multiple users can be selected and assigned in a single action.

### WYSIWYG as default and only editor

**Files:** `ux/src/stores/editor.js` (or equivalent), editor selection logic

The editor selection was locked to the WYSIWYG (Tiptap) editor, removing the Markdown and other editor options from the UI. This aligns with the CultBR portal's target audience of non-technical content authors.

### HTML content save for WYSIWYG editor

**File:** `ux/src/components/editors/wysiwyg/EditorWysiwyg.vue`

The WYSIWYG editor was configured to save the page `content` field as raw HTML (via `editor.getHTML()`) rather than as Tiptap's JSON format. This ensures content is stored in a portable format compatible with the page rendering pipeline.
