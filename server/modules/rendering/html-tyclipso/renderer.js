const ImageOverlay = require('./components/ImageOverlay')
const AnchorCopyButton = require('./components/AnchorCopyButton')

module.exports = {
  init($) {
    // wrap images
    $('p > img, ul img, ol img').each((i, element) => {
      const src = $(element).attr('src');
      $(element).wrap(`<div class="ty-image-wrapper"></div>`)
      $(element).parent().append(ImageOverlay(src))
    })

    // add anchor button to headlines
    $('h1,h2,h3,h4,h5,h6').append(AnchorCopyButton())
  }
}
