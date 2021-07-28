const ImageOverlay = require('./components/ImageOverlay')

module.exports = {
  init($, config) {

    // wrap images
    $('p > img').each((i, element) => {
      const src = $(element).attr('src');
      $(element).wrap(`<a class="ty-image-wrapper" href="${src}" target="_blank"></a>`)
      $(element).parent().append(ImageOverlay)
    })
  }
}
