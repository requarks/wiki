const mdPlantUml = require('markdown-it-plantuml')()

// ------------------------------------
// Markdown - PlantUML Preprocessor
// ------------------------------------

module.exports = {
  init (md, conf) {
    md.use(mdPlantUml, {
      openMarker: this.config.openMarker,
      closeMarker: this.config.closeMarker,
      imageFormat: this.config.imageFormat,
      server: this.config.server
    })
  }
}
