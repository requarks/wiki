/* eslint-disable camelcase */
module.exports = {
  init($, config) {
    // Define which elements can be captioned.
    // Currently, only <img> is supported,
    // could be extended to <video>, <audio>,
    // <iframe>, mermaid elements, etc
    let figurable_selectors = []
    if (config.images) figurable_selectors.push('img')
    let figurable_selector = figurable_selectors.join(', ')

    // Check every paragraph with class caption.
    // If it contains a figurable element in the
    // beginning followed by text, the text will be
    // used as a caption for the figureable.
    // If the paragraph doesn't start with a figurable
    // element, but the previous paragraph just contains
    // a single figureable element, the current
    // paragraph's text will be used as a caption
    // for the figurable.
    $('p.caption').each((idx, elm) => {
      let figurable_elm, caption_elm, replace_elm

      let transform = false
      elm = $(elm)

      // figurable to be captioned is in the same paragraph
      if (elm.contents(':first-child').is(figurable_selector)) {
        figurable_elm = elm.children(figurable_selector)
        caption_elm = $('<figcaption>')
          .append(elm.contents())
        replace_elm = elm
        transform = true
      }
      // figurable to be captioned is in the paragraph above
      else {
        let prev = elm.prev('p')
        if (prev.text().trim().length == 0) {
          figurable_elm = prev.children(figurable_selector)
          caption_elm = $('<figcaption>')
            .append(elm.contents())
          prev.remove()
          replace_elm = elm
          transform = true
        }
      }

      if (transform) {
        elm.removeClass('caption')
        let wrapper_elm = $('<div>')
          .attr('class', elm.attr('class'))
          .addClass('illustration')

        if (config.enumerate) {
          caption_elm.prepend(`<label>Fig ${idx + 1}: </label>`)
        }

        let figure = $('<figure>')
          .append(figurable_elm)
          .append(caption_elm)
        wrapper_elm.append(figure)
        replace_elm.replaceWith(wrapper_elm)
      }
    })
  }
}
