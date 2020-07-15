const _ = require('lodash')

module.exports = {
  init($, config) {
    // If enabled, converting all "video" tags into "video-js" VUE custom client component
    if (config.videoJS) {
      $('video').replaceWith(function() {
        let element = $(this)
        // Initializing "data-setup" options
        let dataSetupOptions = {}
        if (element.attr('data-setup')) {
          try {
            dataSetupOptions = JSON.parse(element.attr('data-setup'))
          } catch (e) {}
        }
        // Initializing component options from specific video attributes and tag sources
        let playerOptions = _.chain({
          controls: (!!element.attr('controls')),
          preload: element.attr('preload') || 'auto',
          autoplay: (!!element.attr('autoplay')),
          loop: (!!element.attr('loop')),
          responsive: (!!element.attr('responsive')),
          fill: (!!element.attr('fill')),
          height: element.attr('height') || 'auto',
          width: element.attr('width') || 'auto',
          poster: element.attr('poster'),
          aspectRatio: (!!element.attr('aspect-ratio') || null),
          sources: _.chain(element.find('source'))
            // Mapping tag "source" as child of "video"
            .map((item) => $(item).attr('src'))
            .toArray()
            // Adding attribute src if present
            .push(element.attr('src'))
            // Removing null values
            .compact()
            .value()
        })
          // Merging with data-setup attribute
          .merge(dataSetupOptions)
          // Removing null/undefined properties
          .pickBy(_.identity)
          .value()
        // Passing player options to video-js custom component
        return $('<video-js />', {html: element.html()}).attr(':options', JSON.stringify(playerOptions))
      })
    }
  }
}
