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
})
