const MarkdownIt = require('markdown-it')
const infographicPlugin = require('../../modules/rendering/markdown-infographic/plugin')

function render(src) {
  const md = new MarkdownIt({ html: true })
  md.use(infographicPlugin)
  return md.render(src)
}

describe('markdown-infographic plugin', () => {
  test('rewrites a fenced infographic block to a div.infographic container', () => {
    const src = '```infographic\ninfographic list-row-simple-horizontal-arrow\ndata\n  lists\n    - label Step 1\n```\n'
    const out = render(src)
    expect(out).toContain('<div class="infographic" data-opts="">')
    expect(out).toContain('infographic list-row-simple-horizontal-arrow')
    expect(out).toContain('- label Step 1')
    expect(out).not.toContain('<pre')
    expect(out).not.toContain('<code')
  })

  test('preserves info-string params as data-opts', () => {
    const src = '```infographic height=600 theme=hand-drawn\nbody\n```\n'
    const out = render(src)
    expect(out).toContain('<div class="infographic" data-opts="height=600 theme=hand-drawn">')
    expect(out).toContain('body')
  })

  test('does not touch unrelated fenced code blocks', () => {
    const src = '```js\nconsole.log(1)\n```\n'
    const out = render(src)
    expect(out).toContain('<code')
    expect(out).not.toContain('class="infographic"')
  })

  test('escapes HTML in body and data-opts', () => {
    const src = '```infographic theme="><script>x</script>\n<script>alert(1)</script>\n```\n'
    const out = render(src)
    expect(out).not.toContain('<script>')
    expect(out).toContain('&lt;script&gt;')
    expect(out).toContain('&quot;')
  })

  test('preserves indentation in body verbatim', () => {
    const src = '```infographic\nfoo\n  bar\n    baz\n```\n'
    const out = render(src)
    // The DSL is indentation-sensitive — leading spaces must survive.
    expect(out).toContain('foo\n  bar\n    baz')
  })

  test('does not match a fence with a similar prefix', () => {
    const src = '```infographicfoo\nbody\n```\n'
    const out = render(src)
    expect(out).not.toContain('class="infographic"')
  })

  test('handles a block at end-of-document without trailing newline closure', () => {
    const src = '```infographic\nbody\n```'
    const out = render(src)
    expect(out).toContain('<div class="infographic"')
    expect(out).toContain('body')
  })
})
