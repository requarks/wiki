const fs = require('fs')
const path = require('path')

describe('Wide table horizontal scrolling styles', () => {
  test('view mode provides horizontal scrolling for bare <table> in page contents', () => {
    const scssPath = path.join(process.cwd(), 'client', 'themes', 'default', 'scss', 'app.scss')
    if (!fs.existsSync(scssPath)) {
      console.warn('app.scss not found; skipping bare table scroll style test.')
      return
    }

    const src = fs.readFileSync(scssPath, 'utf8')

    // We intentionally scope this to the rendered page content area.
    expect(src).toMatch(/\.v-main\s+\.contents\s*\{[\s\S]*?>\s*table[\s\S]*?overflow-x:\s*auto\s*;/)
    expect(src).toMatch(/\.v-main\s+\.contents\s*\{[\s\S]*?>\s*table[\s\S]*?width:\s*max-content\s*;/)
    expect(src).toMatch(/\.v-main\s+\.contents\s*\{[\s\S]*?>\s*table[\s\S]*?min-width:\s*100%\s*;/)

    // Image columns shouldn't collapse.
    expect(src).toMatch(/>\s*table\s+td:has\(img\)[\s\S]*?min-width:\s*25px\s*;/)
  })
})
