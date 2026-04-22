# AGENTS.md

## Project

This repository is the Wiki.js application used for the Shadows Over Westgate wiki.

The active custom theme is `westgate`, located under `client/themes/westgate`. The goal is to match the Shadows Over Westgate NodeBB theme as closely as Wiki.js permits, ideally 1:1 in visual language, interaction polish, and atmosphere while respecting Wiki.js architecture.

## Local Environment

- Wiki repo: `/home/vicky/Projects/nwnee-shadowsoverwestgate/wiki`
- NodeBB theme reference repo: `/home/vicky/Projects/nodebb-dev/nodebb-theme-westgate`
- NodeBB theme instructions: `/home/vicky/Projects/nodebb-dev/nodebb-theme-westgate/AGENTS.md`
- This Wiki.js checkout targets Wiki.js 2.x and Node `>=20`, as declared in `package.json`.
- Wiki.js assets are built through webpack from the repo root.

## Theme Direction

Use the NodeBB Westgate theme as the source of truth.

The visual target is black velvet silk, darkness, vampirism, decadence, and decay.

Use this palette direction:

- Plum and near-black as the dominant base.
- Muted gold for accents, borders, small highlights, and important affordances.
- Red only sparingly, preferably as a subtle detail or state color.
- Avoid bright, playful, clinical, or flat SaaS-style treatment.
- Favor depth, restraint, texture, and rich contrast over loud ornament.

Before adding new visual language, inspect the NodeBB reference files in `/home/vicky/Projects/nodebb-dev/nodebb-theme-westgate`, especially:

- `____live-copy.css`
- `____wikijs-live-copy.scss`
- `____bootstrap-overrides.scss`

`____live-copy.css` is the clearest reference for the slick gradient treatment. Port that direction into Wiki.js foreground elements such as page chrome, navigation, panels, buttons, cards, tables, forms, alerts, active states, borders, and links. Keep the wiki readable and usable; do not turn the whole page into a decorative gradient background.

## Wiki.js Theme Rules

Follow the current Wiki.js theme model:

- Theme metadata lives in `client/themes/westgate/theme.yml`.
- Theme styles live in `client/themes/westgate/scss/app.scss`.
- Theme-specific JavaScript lives in `client/themes/westgate/js/app.js`.
- Theme Vue components live in `client/themes/westgate/components/`.
- `client/themes/westgate/components/page.vue` is the mandatory theme entry component.
- `client/themes/westgate/js/app.js` and `client/themes/westgate/scss/app.scss` are mandatory entry files, even if one is temporarily empty.
- `client/themes/westgate/thumbnail.png` is the theme preview image.
- The active theme components are bundled from `client/themes/<siteConfig.theme>/components/` by `client/client-app.js`.
- `Page` and `NavFooter` are registered as theme components in `client/client-app.js`.
- Other page-level behavior and app chrome may come from shared Wiki.js components under `client/components/`.
- Folder names for themes must be lowercase and avoid spaces or special characters. Keep this theme folder named `westgate`.
- This checkout's page component and admin UI use `off` as the hidden table-of-contents value, even though some upstream theme metadata examples use `hidden`.

Official Wiki.js theme docs: https://docs.requarks.io/dev/themes

The theme must be built together with the application components. Styling only the theme SCSS is often insufficient because Wiki.js renders a mix of:

- Theme components in `client/themes/westgate/components/`.
- Shared Vue components in `client/components/`.
- Server Pug views in `server/views/`.
- Global SCSS in `client/scss/`.
- Vuetify-generated markup and utility classes.

Prefer changes in `client/themes/westgate` when the behavior or markup is theme-owned. Touch shared `client/components`, `client/scss`, or `server/views` only when the rendered Wiki.js surface cannot be matched from the theme layer alone.

Wiki.js officially treats custom themes as a developer workflow: they are manually compiled as part of the application bundle, not installed or switched like downloadable packages.

The top black navigation header is shared across the wiki, admin, editor, profile, and other app surfaces. Official docs say the header cannot be customized as part of a normal content-page theme. Prefer styling it from SCSS only when needed for visual parity; do not assume it can be replaced from `client/themes/westgate/components`.

When editing `client/themes/westgate/components/page.vue`, keep the `props` object and `created()` method intact. Wiki.js uses them to persist page data to the store, and changing them can break page rendering across the application.

Do not modify `client/themes/default` unless the task explicitly asks to update the default theme or compare behavior. Use it as a reference for expected component structure.

## Current Files Of Interest

- `client/themes/westgate/theme.yml`: Westgate theme metadata and theme props.
- `client/themes/westgate/scss/app.scss`: main Westgate visual layer.
- `client/themes/westgate/js/app.js`: theme-specific browser behavior.
- `client/themes/westgate/components/page.vue`: main wiki page layout for the theme.
- `client/themes/westgate/components/nav-sidebar.vue`: page contents/sidebar navigation component.
- `client/themes/westgate/components/nav-footer.vue`: footer navigation component.
- `client/themes/westgate/components/tabset.vue`: theme tabset component.
- `client/client-app.js`: global Vue registration, including theme component imports.
- `client/scss/`: global Wiki.js and Vuetify styling layers.
- `server/views/`: Pug views that host rendered Vue app pages.
- `dev/webpack/webpack.dev.js` and `dev/webpack/webpack.prod.js`: asset build configuration.

## Working Practices

- Keep edits scoped to the wiki project unless the task explicitly names the NodeBB theme repo.
- Treat `/home/vicky/Projects/nodebb-dev/nodebb-theme-westgate` as visual reference material, not as a target for wiki edits.
- Prefer existing Wiki.js, Vue 2, Vuetify, Pug, SCSS, and local theme patterns over introducing new frameworks.
- Keep selectors maintainable and tied to Wiki.js/Vuetify structure where possible.
- Avoid broad global overrides unless they are intentional theme-wide tokens, resets, or Vuetify corrections.
- Avoid unrelated formatting churn.
- Preserve accessibility: readable contrast, visible focus states, keyboard-usable controls, meaningful hover/active states, and no text hidden purely for visual effect unless there is an accessible alternative.
- When porting NodeBB styling, translate the visual intent to Wiki.js markup instead of copying selectors that only make sense in NodeBB.
- When editing Vue components, keep template, script, and style behavior aligned with the default Wiki.js component unless a Westgate-specific override is intentional.
- Keep `theme.yml` prop keys unique and meaningful; avoid duplicate YAML keys.

## Build And Validation

Run commands from `/home/vicky/Projects/nwnee-shadowsoverwestgate/wiki`.

Prefer the devcontainer / Docker Compose workflow for this project. Host-side Node commands may fail because dependencies are expected to live inside the `wiki-app` container.

Dev container workflow:

- Compose file: `dev/containers/docker-compose.yml`.
- App container: `wiki-app`.
- Database container: `wiki-db`.
- Adminer container: `wiki-adminer`.
- Workspace inside the app container: `/wiki`.
- The host repo is bind-mounted into `/wiki`.
- `node_modules` is container-local via the `/wiki/node_modules` volume and should not be expected on the host.
- Wiki.js is exposed at `http://localhost:3000`.
- Adminer is exposed at `http://localhost:3001`.
- Local Postgres is exposed on host port `15432`, container port `5432`.
- Container config lives at `dev/containers/config.yml`; copy it to `config.yml` inside `/wiki` if needed.

Common host commands:

- `docker compose -f dev/containers/docker-compose.yml up -d --build`: build and start the dev database, app, and Adminer containers.
- `docker exec -it wiki-app bash`: open a shell in the Wiki.js app container.

Common container commands from `/wiki`:

- `yarn install`: install dependencies into the container-local `node_modules` volume.
- `cp dev/containers/config.yml config.yml`: use the dev Postgres config.
- `yarn dev`: official Wiki.js development workflow; theme changes automatically rebuild client assets and live-reload while it is running. During active visual iteration, prefer this live reload loop instead of repeatedly running `yarn build`.
- `yarn build` or `npm run build`: production webpack build for app, legacy, setup, theme SCSS, theme JS, and Vue components.
- `yarn test` or `npm run test`: eslint, pug-lint, and jest.

Dev database settings from inside Docker:

- Type: `postgres`
- Host: `db`
- Port: `5432`
- Database: `wiki`
- User: `wikijs`
- Password: `wikijsrocks`

Common commands:

- `yarn dev`: official Wiki.js development workflow; theme changes automatically rebuild client assets.
- `npm run watch`: development webpack build for app, legacy, setup, theme SCSS, theme JS, and Vue components.
- `npm run build`: production webpack build for app, legacy, setup, theme SCSS, theme JS, and Vue components.
- `npm run dev`: Wiki.js development server workflow.
- `npm run start`: start the Wiki.js server.
- `npm run test`: eslint, pug-lint, and jest.

Important build note:

- The Westgate theme is not just a standalone stylesheet. It depends on the theme Vue components and shared Wiki.js components being bundled together. After changing `client/themes/westgate/components`, `client/themes/westgate/scss`, `client/themes/westgate/js`, `client/components`, `client/scss`, or `server/views`, rebuild the webpack assets.
- If `yarn dev` is already running, use its live reload / automatic rebuild capability during iteration; a separate `yarn build` is not normally needed until final production-style validation.
- Production build output includes the generated `assets` folder and generated views under `server/views`.
- The active custom theme is selected from the database `settings` table, `theming` row, JSON `theme` property. For this project it should be `westgate`; restart Wiki.js after changing it.

Validation checklist when practical:

- Build assets inside the `wiki-app` container with `yarn build`, or run `yarn dev` during iterative work.
- Verify that the active wiki theme is `westgate`.
- Check desktop and mobile widths.
- Check representative page content: headings, paragraphs, links, tables, code blocks, blockquotes, tags, page metadata, table of contents/sidebar, footer navigation, and edit controls.
- Check shared app surfaces affected by theme work: login, register, profile, search, not found, unauthorized, and editor/new-page flows when relevant.
- Use Playwright for rendered route checks and screenshots when the wiki server is running.

If validation cannot be run, report what changed and what still needs to be checked in the running wiki.

## Current Tasks

Complete and update as needed. Future-dated tasks and possibilities go into Future Tasks.

Statuses:

1. `[x]` marks total completion.
2. `[-]` marks partial completion: not exact specification.
3. `[ ]` marks incomplete.
4. `[?]` marks uncertainty or exception: treat as incomplete, expand as needed, and keep in scope.

Complete the following:

- [-] Bring the Wiki.js Westgate theme into close visual parity with the NodeBB Westgate theme. Continued with shared chrome, search, auth, menu, table, media, focus, content-surface polish, and multiple geometry cleanup passes in `client/themes/westgate/scss/app.scss`.
- [x] Build the theme together with Wiki.js components after theme/component changes. `yarn build` completed successfully on April 22, 2026.
- [ ] Validate the rendered wiki on desktop and mobile against the NodeBB visual direction. Pending because the Wiki.js server was not running on `localhost:3000` in the current container and Playwright is not installed here.
- [-] Reduce boxes-within-boxes across the Westgate theme. Removed card styling from structural page columns, softened sidebar cards/TOC rows, restored pilcrow anchors as overlay markers that do not indent headings, and simplified top nav/search/editor title input borders from SCSS. Continue checking the shared `nav-header` and editor title/search wrappers; exact 1:1 alignment may require editing shared Vue markup in `client/components/common/nav-header.vue` if SCSS cannot fully undo Vuetify wrapper nesting.
- [-] Improve editor/read-view parity. Markdown editor line-card striping was fixed by exempting CodeMirror line elements from global code-block styling. The WYSIWYG/preview pane still does not show the same gold heading/pilcrow marker behavior as the read view; treat this as optional unless visual parity there becomes a priority.
- [ ] Re-check body/header separation on real content pages. Current SCSS reduces page title height and tightens page body spacing, but screenshots should be reviewed after live reload to decide whether page title and article content should become one continuous component or remain separate Wiki.js regions.
- [-] Fix current layout overlap regression. Removed the negative sticky side-rail offset from `client/themes/westgate/components/page.vue`, because it caused the TOC/sidebar column to overlap the top page chrome and content region. Continue checking for remaining overlap after live reload.
- [-] Document VPS deployment. `README.md` was cleared and rewritten as a Wiki.js 2.x VPS deployment guide for this custom theme, using the repo's `dev/build/Dockerfile` custom image path. It references official Wiki.js installation, Docker, and requirements docs. Validate commands against the real production repo URL, hostname, and volume names before first live deployment.
- [-] Last geometry simplification pass before handoff. Added explicit Westgate classes to the breadcrumb toolbar/body container, removed inline page title height, flattened breadcrumb boxes, removed most side-rail/card borders, and simplified the content panel edges. Remaining navbar/search double-border issues likely come from shared Vuetify/nav-header wrapper markup and should be handled in `client/components/common/nav-header.vue` by the next pass rather than by piling on more SCSS overrides.

## Future Tasks

Tasks to be considered in the future, not implemented immediately. Keep them in scope when making decisions.

- [ ] Consider a light mode/dark mode toggle only if it can retain the core Westgate identity.
- [ ] Consider extracting repeated Westgate SCSS tokens/mixins if theme styling continues to grow.
