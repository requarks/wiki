const fs = require('fs')
const path = require('path')

describe('CKEditor fontFamily configuration', () => {
  test('fontFamily options and supportAllValues are configured', () => {
    const filePath = path.join(process.cwd(), 'client', 'components', 'editor', 'ckeditor', 'ckeditor.js')
    if (!fs.existsSync(filePath)) {
      console.warn('ckeditor.js source not found; skipping fontFamily options test.')
      return
    }
    const src = fs.readFileSync(filePath, 'utf8')
    // Extract fontFamily config block using regex (simple heuristic)
    // Match fontFamily block allowing nested objects and arrays until next top-level plugin config line or end of editor config
    const match = src.match(/fontFamily:\s*{[\s\S]*?supportAllValues:[\s\S]*?}\s*[,}]/)
    expect(match).toBeTruthy()
    const block = match[0]
    expect(block).toMatch(/options:\s*\[/)
    const expectedOptions = [
      'default',
      'Arial, Helvetica, sans-serif',
      'Courier New, Courier, monospace',
      'Georgia, serif',
      'Lucida Sans Unicode, Lucida Grande, sans-serif',
      'Tahoma, Geneva, sans-serif',
      'Times New Roman, Times, serif',
      'Trebuchet MS, Helvetica, sans-serif',
      'Verdana, Geneva, sans-serif',
      'Ubuntu, sans-serif'
    ]
    for (const opt of expectedOptions) {
      expect(block).toContain(opt)
    }
    expect(block).toMatch(/supportAllValues:\s*true/)
  })

  test('typography.scss no longer globally forces font-family on all descendants', () => {
    const typoPath = path.join(process.cwd(), 'client', 'scss', 'base', 'typography.scss')
    if (!fs.existsSync(typoPath)) {
      console.warn('typography.scss not found; skipping global font-family enforcement test.')
      return
    }
    const css = fs.readFileSync(typoPath, 'utf8')
    // Ensure old pattern .v-application * with !important is removed
    expect(css).not.toMatch(/\.v-application \*/)
    expect(css).not.toMatch(/!important;?\s*$/m)
    // Ensure ck-content inherits and utility classes exist
    expect(css).toMatch(/\.ck-content[^{]*{[^}]*font-family:\s*inherit/)
    expect(css).toMatch(/\.ck-content \.font-family-arial/)
  })

  test('built editor bundle contains updated fontFamily options', () => {
    const builtPath = path.join(process.cwd(), 'assets', 'js', 'editor-ckeditor.js')
    if (!fs.existsSync(builtPath)) {
      // Provide a clear message; failing here can be noisy if build not run yet.
      console.warn('editor-ckeditor.js not found; run build before executing this test to validate font list.')
      return
    }
    const bundle = fs.readFileSync(builtPath, 'utf8')
    const fonts = [
      'default',
      'Arial, Helvetica, sans-serif',
      'Courier New, Courier, monospace',
      'Georgia, serif',
      'Lucida Sans Unicode, Lucida Grande, sans-serif',
      'Tahoma, Geneva, sans-serif',
      'Times New Roman, Times, serif',
      'Trebuchet MS, Helvetica, sans-serif',
      'Verdana, Geneva, sans-serif',
      'Ubuntu, sans-serif'
    ]
    for (const f of fonts) {
      expect(bundle).toContain(f)
    }
  })
})
