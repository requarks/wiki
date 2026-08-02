/**
 * `markdown-it`'s `Token` class, at the specifier a plugin still asks for.
 *
 * markdown-it 15 removed its package-internal subpath exports (`markdown-it/lib/*`) and moved the
 * parser internals onto the main export as static classes. `markdown-it-mdc` has not caught up — it
 * still does `import TokenClass from 'markdown-it/lib/token.mjs'`, which now resolves to nothing and
 * fails the build outright rather than at runtime.
 *
 * `vite.config.js` aliases that dead specifier here, and `package.json` overrides the plugin's own
 * `markdown-it: ^14.0.0` peer range to the version the app actually installs -- without that second
 * half, npm refuses to resolve the tree at all and EVERY subsequent `npm install` fails on ERESOLVE.
 *
 * Nothing in this repo imports this file directly. Both halves come out when the plugin catches up.
 */
import MarkdownIt from 'markdown-it'

export default MarkdownIt.Token
