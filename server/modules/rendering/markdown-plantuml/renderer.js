const mdPlantUml = require('markdown-it-plantuml')

// ------------------------------------
// Markdown - PlantUML Preprocessor
// ------------------------------------

module.exports = {
  init (md, conf) {
    md.use(mdPlantUml, {
      openMarker: conf.openMarker,
      closeMarker: conf.closeMarker,
      imageFormat: conf.imageFormat,
      server: conf.server
    })
  }
}
