// Asciidoctor API Documentation for HTML5Converter:
// https://www.rubydoc.info/gems/asciidoctor/2.0.23/Asciidoctor/Converter/Html5Converter#convert_admonition-instance_method

module.exports = function (registry) {
  // Success Admonition block rendering
  // [SUCCESS]
  // <paragraphContent>
  registry.block(function () {
    var self = this
    self.named('SUCCESS')
    self.onContext('paragraph')
    self.process(function (parent, reader) {
      var lines = reader.getLines()
      return self.createBlock(parent, 'admonition', lines, {name: 'success', textlabel: 'Success'})
    })
  })
}
