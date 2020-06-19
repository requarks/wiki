const galleryPlugin = require('markdown-it-gallery')

// ------------------------------------
// Markdown - Markdown-it-gallery
// ------------------------------------

module.exports = {
  init (md, conf) {
    md.use(galleryPlugin, {
      galleryClass: 'md-gallery',
      galleryTag: 'figure',
      imgClass: 'md-gallery__image',
      wrapImagesInLinks: true,
      linkClass: 'md-gallery__link',
      linkTarget: '_blank',
      imgTokenType: 'image',
      linkTokenType: 'link'})
  }
}
