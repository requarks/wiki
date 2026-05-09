const cheerio = require('cheerio')

describe('html-vega renderer', () => {
  const renderer = require('../../modules/rendering/html-vega/renderer')

  test('rewrites a fenced vega code block to a div.vega container', () => {
    const html = `<pre class="prismjs"><code class="language-vega">{"$schema":"https://vega.github.io/schema/vega/v5.json"}</code></pre>`
    const $ = cheerio.load(html)
    renderer.init($, {})
    const out = $.html()
    expect(out).toContain('<div class="vega">')
    expect(out).not.toContain('language-vega')
    expect(out).toContain('vega.github.io/schema/vega/v5.json')
  })

  test('does not touch unrelated code blocks', () => {
    const html = `<pre class="prismjs"><code class="language-js">console.log(1)</code></pre>`
    const $ = cheerio.load(html)
    renderer.init($, {})
    const out = $.html()
    expect(out).toContain('language-js')
    expect(out).not.toContain('class="vega"')
  })

  test('does not match vega-lite blocks', () => {
    const html = `<pre class="prismjs"><code class="language-vega-lite">{}</code></pre>`
    const $ = cheerio.load(html)
    renderer.init($, {})
    const out = $.html()
    expect(out).toContain('language-vega-lite')
    expect(out).not.toContain('<div class="vega">')
  })
})

describe('html-vega-lite renderer', () => {
  const renderer = require('../../modules/rendering/html-vega-lite/renderer')

  test('rewrites a fenced vega-lite code block to a div.vega-lite container', () => {
    const html = `<pre class="prismjs"><code class="language-vega-lite">{"$schema":"https://vega.github.io/schema/vega-lite/v5.json"}</code></pre>`
    const $ = cheerio.load(html)
    renderer.init($, {})
    const out = $.html()
    expect(out).toContain('<div class="vega-lite">')
    expect(out).not.toContain('language-vega-lite')
    expect(out).toContain('vega.github.io/schema/vega-lite/v5.json')
  })

  test('does not match vega blocks', () => {
    const html = `<pre class="prismjs"><code class="language-vega">{}</code></pre>`
    const $ = cheerio.load(html)
    renderer.init($, {})
    const out = $.html()
    expect(out).toContain('language-vega')
    expect(out).not.toContain('<div class="vega-lite">')
  })
})
