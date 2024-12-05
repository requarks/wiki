const asciidoctor = require('asciidoctor')()
const cheerio = require('cheerio')
const deflateRawSync = require('zlib').deflateRawSync

// asciidoctor.js extensions
// https://docs.asciidoctor.org/asciidoctor.js/latest/extend/extensions/block-processor/

function plantuml_ext(registry, server) {
  registry.block(function () {
    this.named("plantuml");
    this.onContext(["paragraph", "listing"]);
    this.process(function (parent, reader) {
      const lines = reader.getLines();
      const zippedCode = encode64(
        deflateRawSync(lines.join("\n")).toString("binary")
      );
      return this.createImageBlock(parent, {
        target: `${server}/svg/${zippedCode}`,
      });
    });
  });
}


module.exports = {
  async render() {
    let registry = undefined
    if(this.config.enablePlantuml && this.config.plantumlServer) {
        registry = asciidoctor.Extensions.create();
        plantuml_ext(registry, this.config.plantumlServer);
    }
    const html = asciidoctor.convert(this.input, {
      standalone: false,
      safe: this.config.safeMode,
      attributes: {
        showtitle: true,
        icons: 'font'
      },
      extension_registry: registry
    })

    const $ = cheerio.load(html, {
      decodeEntities: true
    })

    $('pre.highlight > code.language-diagram').each((i, elm) => {
      const diagramContent = Buffer.from($(elm).html(), 'base64').toString()
      $(elm).parent().replaceWith(`<pre class="diagram">${diagramContent}</div>`)
    })

    return $.html()
  }
}


function encode64(data) {
  let r = "";
  for (let i = 0; i < data.length; i += 3) {
    if (i + 2 === data.length) {
      r += append3bytes(data.charCodeAt(i), data.charCodeAt(i + 1), 0);
    } else if (i + 1 === data.length) {
      r += append3bytes(data.charCodeAt(i), 0, 0);
    } else {
      r += append3bytes(
        data.charCodeAt(i),
        data.charCodeAt(i + 1),
        data.charCodeAt(i + 2)
      );
    }
  }
  return r;
}

function append3bytes(b1, b2, b3) {
  let c1 = b1 >> 2;
  let c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
  let c3 = ((b2 & 0xf) << 2) | (b3 >> 6);
  let c4 = b3 & 0x3f;
  let r = "";
  r += encode6bit(c1 & 0x3f);
  r += encode6bit(c2 & 0x3f);
  r += encode6bit(c3 & 0x3f);
  r += encode6bit(c4 & 0x3f);
  return r;
}

function encode6bit(raw) {
  let b = raw;
  if (b < 10) {
    return String.fromCharCode(48 + b);
  }
  b -= 10;
  if (b < 26) {
    return String.fromCharCode(65 + b);
  }
  b -= 26;
  if (b < 26) {
    return String.fromCharCode(97 + b);
  }
  b -= 26;
  if (b === 0) {
    return "-";
  }
  if (b === 1) {
    return "_";
  }
  return "?";
}