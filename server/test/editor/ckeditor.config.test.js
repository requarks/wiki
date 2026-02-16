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

  test('visual editor allows horizontal scrolling for wide tables', () => {
    const vuePath = path.join(process.cwd(), 'client', 'components', 'editor', 'editor-ckeditor.vue')
    if (!fs.existsSync(vuePath)) {
      console.warn('editor-ckeditor.vue not found; skipping wide table scrolling style test.')
      return
    }

    const src = fs.readFileSync(vuePath, 'utf8')

    // Guardrail: we must not force-hide horizontal overflow on the editable surface.
    // If a table becomes wider than the page, this is what enables the horizontal scrollbar.
    expect(src).toMatch(/>\s*\.ck-editor__editable[\s\S]*?overflow-x:\s*auto\s*;/)
    expect(src).not.toMatch(/>\s*\.ck-editor__editable[\s\S]*?overflow-x:\s*hidden\s*;/)

    // Bare <table> should also be scrollable when present (migrated/pasted HTML).
    expect(src).toMatch(/>\s*\.ck-editor__editable[\s\S]*?\btable\b[\s\S]*?overflow-x:\s*auto\s*;/)

    // Image-only columns shouldn't collapse.
    expect(src).toMatch(/>\s*\.ck-editor__editable[\s\S]*?td:has\(img\)[\s\S]*?min-width:\s*25px\s*;/)
  })
})
