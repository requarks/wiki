const rxYoutube = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/)|(?:(?:watch)?\?v(?:i)?=|&v(?:i)?=))([^#&?]*).*/
const rxVimeo = /^.*(vimeo\.com\/)((channels\/[A-z]+\/)|(groups\/[A-z]+\/videos\/))?([0-9]+)/

module.exports = {
  init($, config) {
    $('oembed').each((i, elm) => {
      const url = $(elm).attr('url')
      const ytMatch = url.match(rxYoutube)
      let src
      if (ytMatch) {
        src = `https://www.youtube.com/embed/${ytMatch[1]}`
      } else {
        const vmMatch = url.match(rxVimeo)
        if (vmMatch) {
          src = `https://player.vimeo.com/video/${vmMatch[5]}`
        } else {
          return
        }
      }
      const newElm = $(`<div class="video-responsive" style="position: relative; height: 0; padding-top: 56.25%; width:100%;">
        <iframe style="position: absolute; top: 0; left: 0; border: 0; width: 100%; height: 100%;" type="text/html" src="${src}" frameborder="0" allowfullscreen></iframe>
      </div>`)
      $(elm).parent().replaceWith(newElm)
    })
  }
}
