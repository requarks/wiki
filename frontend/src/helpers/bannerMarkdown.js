/**
 * The markdown an administrator writes into the site-wide banner, as HTML — shared by the banner
 * above every page (`SiteBanner.vue`) and the maintenance page a closed site shows in place of
 * everything (`MaintenancePage.vue`), so that the same contents read the same in both.
 *
 * Only the inline parts of markdown are worth anything in a notice a few lines long, but the full
 * block grammar comes free with the parser, so the whole of markdown-it is what runs -- with `html`
 * OFF, unlike the page renderer. An administrator writing a banner is not writing a page, and
 * markdown-it's own link validation (`javascript:` and friends) is then the only escape left to
 * worry about, which it handles itself.
 */

/**
 * The parser, built on first use and kept.
 *
 * Imported dynamically so that markdown-it stays out of the bundle a reader downloads for a site with
 * no banner, which is nearly all of them -- and so that it is fetched alongside the banner rather than
 * ahead of the page.
 */
let md = null

export async function renderBannerMarkdown(source) {
  md ??= new (await import('markdown-it')).default({
    html: false,
    linkify: true,
    breaks: true
  })
  return md.render(source)
}
