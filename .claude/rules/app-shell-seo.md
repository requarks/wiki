---
paths:
  - "backend/helpers/appShell.ts"
  - "backend/helpers/pageLinks.ts"
  - "backend/controllers/rootFiles.ts"
  - "backend/index.ts"
  - "backend/models/pages.ts"
  - "frontend/index.html"
  - "frontend/src/main.js"
  - "frontend/src/layouts/MainLayout.vue"
---

# The app shell and SEO

The compiled SPA is one document for every path on the wiki, served by the `setNotFoundHandler` in
`index.ts` — which is the fallback rather than a route because a page lives at any path a user cares
to give it, and the frontend's router is what resolves one.

That document says nothing about the page at its URL until a browser has run it — a `<title>` reading
`Wiki.js` for every page of every wiki — and **plenty of clients never run it**: a chat client
building an unfurl card, an AI crawler (GPTBot, ClaudeBot, PerplexityBot and friends fetch raw HTML
and render nothing), a search engine that does not render, a reader with JavaScript off.
`helpers/appShell.ts` is what puts something in the document, and `renderAppShell` is the whole of
the decision.

**There is no server-side rendering here, and none is wanted.** A page's HTML is already a string in
`pages.render`, produced once in the editor's browser at save time — so describing a page is reading a
row and two string insertions, not running Vue, a component tree or a second build. Anything that
proposes rendering on the server is solving a problem this schema does not have.

**Every request gets a head describing the page at its URL.** What separates the two kinds of
document is whether the client will run the app, and each has its own function:

- **`fragmentsForCrawler`** — for a client that will not. The PUBLIC's view of the page
  (`pages.describePageForPublic`, which is `listForSitemap`'s question asked of one page): a head, the
  page's markup appended, and 404 where the public may read nothing there. What goes in is what the
  GUESTS group may read and nothing else, which is what makes it the same document for whoever asked
  — and therefore the only half that is cached and handed on.
- **`fragmentsForBrowser`** — for a browser that will. The head alone, describing the page as THAT
  requester may see it (`pages.describePageForRequest`), which makes exactly the cut the page route
  makes: `read:pages` per path, and a page that is not live only for a session that may edit it (see
  [Permissions](../../CLAUDE.md#permissions)). Never cached, because the answer is one reader's. It carries no body (the
  app is about to draw the page properly, so a copy is bytes on every hard navigation for content the
  browser discards), never 404s (whether a path this reader may create is empty is the app's own flow
  to present) and adds no page-specific `noindex`.

  It matters even though the app sets the title itself a moment later: the document's own title is
  what the tab reads while the bundle loads, and what a bookmark or a history entry made before boot
  finishes keeps for ever.
- **The head is columns, not prose**: `<title>` composed exactly as `MainLayout.vue` composes it so
  the tab does not jump when the app boots, `description`, a canonical link, `hreflang` alternates
  from the page's locale group, and the `og:`/`twitter:` pair — which is what a link pasted into
  Slack or Discord reads, and the surface this was most visibly missing.
- **The body is the stored render with everything that would *run* taken out** — `<script>`,
  `<style>`, inline handlers (`stripActiveMarkup`). A page whose author holds `write:scripts` keeps
  those in its render and the app runs them when it draws the page; a copy of the same markup in the
  document as the browser parses it would run them a second time, before the app exists. Not a
  sanitizer — the render was sanitized at save time — just the same markup with less in it.
- **Two blocks are written out as the lists they draw** (`expandLinkBlocks`), because their whole
  content is links and the stored render holds none of them: `block-index` (an empty element — its
  pages are queried through the same `tree.listPages` the block's route uses, as the public) and
  `block-links-grid` (YAML, read by `linksGridCards` in `helpers/pageLinks.ts`, with the block's
  scheme allow-list applied again). A block whose output is anything else is left as it is stored.
- **It lands in `#wiki-prerender`, which both sides know about.** `frontend/index.html` hides it and
  restyles it inside `<noscript>`, so a reader with JavaScript off gets the page as prose; `main.js`
  removes the element before Vue mounts. The `<noscript>` typography puts back the browser defaults
  Tailwind's preflight took away and is deliberately not a copy of the content styles, which belong
  to elements the app draws. Inside it, `prerenderFor` puts a `<header>` (logo and site title, linking
  home, on a plain black bar) over a `<main>` carrying the page's `lang` and `dir` — the header is the
  site's, not the page's, so the language goes on `<main>` alone.
- **An anonymous request to a page path with nothing public at it answers 404**, where the shell used
  to answer 200 everywhere — which is what taught a crawler that every URL on the wiki exists. No
  page, an unpublished one and one the guests group's rules refuse are one answer, since the
  difference is not something to tell whoever is asking. **The site root is the exception and always
  answers 200**: there is something to show there regardless of what the database says — the welcome screen of a
  wiki with no home page yet, a login form on a wiki that is not public — and a root answering 404
  would report a working instance as broken to every uptime check pointed at it. Note the consequence
  on a **private wiki**, where the guests group denies everything by default: every page path answers
  404 to an anonymous client, which is the truthful answer and matches the empty sitemap such a site
  already serves.
- **Indexing is one header and never a tag.** `robotsTagFor` folds the site's **General → SEO**
  settings together with the document's own say — a page marked not searchable, a path with nothing
  public at it, and every URL that is not a page at all (`/_admin`, `/_search`: an interface, not
  content) are all `noindex`. `X-Robots-Tag` rather than `<meta name="robots">` because it reaches
  the same clients and cannot fall out of step with itself.
- **The fragments are cached and the shell is not.** `WIKI.cache` holds the head and body per
  origin-and-path for ten minutes — the sitemap's figure, for the sitemap's reason — while the shell
  is re-read per request so that `npm run build` in `frontend/` takes effect immediately. The key
  carries the request's own host, because a canonical link does; hence the crude
  `SHELL_CACHE_MAX_ENTRIES` ceiling, without which anybody could grow the cache by inventing
  hostnames. `invalidateAppShellCache()` is called from every page mutation and from the two places
  `invalidateSitemaps()` is. Nothing a particular requester holds ever reaches it: the key has no
  session dimension because the only thing cached has no requester in it.
- **`groups.actorForPublic()` is the public as an actor**, and is deliberately separate from
  `actorForRequest`: it is the guests group with no group-wide permissions, asked without a request in
  hand. Both things that get cached and handed on — the sitemap and the public document — are built
  from it, and neither may be built from anything one requester happens to hold.

What already existed and is unchanged: `controllers/rootFiles.ts` serves `robots.txt` and
`sitemap.xml` (with `hreflang` alternates), so **discovery** was never the missing half — the
document was.
