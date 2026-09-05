const renderer = require('../../../modules/rendering/markdown-core/renderer')

const render = input => renderer.render.call({
  input,
  children: [],
  config: {
    allowHTML: true,
    linebreaks: true,
    linkify: true,
    typographer: false,
    quotes: 'English',
    underline: false
  }
})

describe('markdown-core spoiler container', () => {
  it('renders a closed details element with a default title', async () => {
    const output = await render('::: spoiler\nHidden **content**.\n:::')

    expect(output).toContain('<details class="spoiler"><summary>Spoiler</summary>')
    expect(output).toContain('<p>Hidden <strong>content</strong>.</p>')
    expect(output).toContain('</details>')
  })

  it('supports a custom escaped title', async () => {
    const output = await render('::: spoiler Reveal <script>alert(1)</script>\nSecret\n:::')

    expect(output).toContain('<summary>Reveal &lt;script&gt;alert(1)&lt;/script&gt;</summary>')
    expect(output).not.toContain('<summary>Reveal <script>')
  })

  it('leaves other containers unchanged', async () => {
    const output = await render('::: note\nVisible\n:::')

    expect(output).toContain('::: note')
    expect(output).not.toContain('<details')
  })
})
