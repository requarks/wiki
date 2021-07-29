const ImageOverlay = require('./components/ImageOverlay')

module.exports = {
  init($, config) {

    // wrap images
    $('p > img').each((i, element) => {
      const src = $(element).attr('src');
      $(element).wrap(`<div class="ty-image-wrapper"></div>`)
      $(element).parent().append(ImageOverlay(src))
    })
  }
}
