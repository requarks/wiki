const renderer = require('../../modules/rendering/html-security/renderer')

describe('HTML Security Renderer - image resize preservation', () => {
  test('keeps inline style width and height auto on img', async () => {
    const input = '<figure class="image"><img src="/x.png" style="width:123px;height:auto" /></figure>'
    const output = await renderer.init(input, { safeHTML: true })
    expect(output).toContain('style="width:123px;height:auto"')
  })

  test('allows width attribute if present', async () => {
    const input = '<figure class="image"><img src="/x.png" width="456" /></figure>'
    const output = await renderer.init(input, { safeHTML: true })
    expect(output).toContain('width="456"')
  })

  test('preserves enlarged image width (upscaling)', async () => {
    const input = '<figure class="image"><img src="/x.png" style="width:850px;height:auto" /></figure>'
    const output = await renderer.init(input, { safeHTML: true })
    expect(output).toContain('style="width:850px;height:auto"')
  })

  test('preserves shrunken image width (downscaling)', async () => {
    const input = '<figure class="image"><img src="/x.png" style="width:200px;height:auto" /></figure>'
    const output = await renderer.init(input, { safeHTML: true })
    expect(output).toContain('style="width:200px;height:auto"')
  })

  test('preserves width on figure element when set', async () => {
    const input = '<figure class="image" style="width:750px"><img src="/x.png" style="width:750px;height:auto" /></figure>'
    const output = await renderer.init(input, { safeHTML: true })
    expect(output).toContain('style="width:750px"')
    expect(output).toContain('style="width:750px;height:auto"')
  })

  test('allows duplicate images with different widths', async () => {
    const input = `
      <figure class="image"><img src="/x.png" style="width:400px;height:auto" /></figure>
      <figure class="image"><img src="/x.png" style="width:800px;height:auto" /></figure>
    `
    const output = await renderer.init(input, { safeHTML: true })
    expect(output).toContain('style="width:400px;height:auto"')
    expect(output).toContain('style="width:800px;height:auto"')
  })

  test('preserves width with alignment classes', async () => {
    const input = '<figure class="image image-style-align-center"><img src="/x.png" style="width:600px;height:auto" /></figure>'
    const output = await renderer.init(input, { safeHTML: true })
    expect(output).toContain('style="width:600px;height:auto"')
    expect(output).toContain('image-style-align-center')
  })

  test('does not add aspect-ratio style property', async () => {
    const input = '<figure class="image"><img src="/x.png" style="width:500px;height:auto" /></figure>'
    const output = await renderer.init(input, { safeHTML: true })
    expect(output).not.toContain('aspect-ratio')
  })

  test('preserves both width attribute and inline style', async () => {
    const input = '<figure class="image"><img src="/x.png" width="300" style="width:300px;height:auto" /></figure>'
    const output = await renderer.init(input, { safeHTML: true })
    expect(output).toContain('width="300"')
    expect(output).toContain('style="width:300px;height:auto"')
  })

  test('preserves percentage widths converted to pixels', async () => {
    const input = '<figure class="image"><img src="/x.png" style="width:1200px;height:auto" /></figure>'
    const output = await renderer.init(input, { safeHTML: true })
    expect(output).toContain('style="width:1200px;height:auto"')
  })
})
