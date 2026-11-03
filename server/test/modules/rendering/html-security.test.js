const renderer = require('../../../modules/rendering/html-security/renderer')

describe('modules/rendering/html-security', () => {
  const config = {
    safeHTML: true,
    allowDrawIoUnsafe: false,
    allowIFrames: false
  }

  it('keeps the slot directives emitted by the tabset renderer', async () => {
    const input = '<tabset><template v-slot:tabs=""><li>Tab</li></template>' +
      '<template v-slot:content=""><div class="tabset-panel"><p>Content</p></div></template></tabset>'
    const result = await renderer.init(input, config)
    expect(result).toEqual(input)
  })

  it('strips the value of v-slot:tabs so it cannot be compiled as an expression', async () => {
    const input = `<tabset><template v-slot:tabs="{x = constructor.constructor('alert(1)')()}"><li>Tab</li></template></tabset>`
    const result = await renderer.init(input, config)
    expect(result).toEqual('<tabset><template v-slot:tabs=""><li>Tab</li></template></tabset>')
  })

  it('strips the value of v-slot:content so it cannot be compiled as an expression', async () => {
    const input = `<tabset><template v-slot:content="{x = constructor.constructor('alert(1)')()}"><div>Content</div></template></tabset>`
    const result = await renderer.init(input, config)
    expect(result).toEqual('<tabset><template v-slot:content=""><div>Content</div></template></tabset>')
  })

  it('strips the value of v-pre', async () => {
    const result = await renderer.init(`<p v-pre="{{ constructor.constructor('alert(1)')() }}">Text</p>`, config)
    expect(result).toEqual('<p v-pre="">Text</p>')
  })

  it('removes any other directive or binding attribute', async () => {
    const inputs = [
      `<div v-html="'<img src=x onerror=alert(1)>'">Text</div>`,
      `<div :class="constructor.constructor('alert(1)')()">Text</div>`,
      `<div v-bind:class="constructor.constructor('alert(1)')()">Text</div>`,
      `<div @click="alert(1)">Text</div>`,
      `<div v-on:click="alert(1)">Text</div>`,
      `<div v-slot="{x = alert(1)}">Text</div>`
    ]
    for (const input of inputs) {
      expect(await renderer.init(input, config)).toEqual('<div>Text</div>')
    }
  })

  it('leaves regular content attributes untouched', async () => {
    const input = '<a href="/foo" target="_blank" title="Foo" data-id="1">Link</a>'
    const result = await renderer.init(input, config)
    expect(result).toEqual(input)
  })

  it('does not sanitize anything when safeHTML is disabled', async () => {
    const input = `<tabset><template v-slot:tabs="{x = alert(1)}"><li>Tab</li></template></tabset>`
    const result = await renderer.init(input, { ...config, safeHTML: false })
    expect(result).toEqual(input)
  })
})
