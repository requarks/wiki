const renderer = require('../../modules/rendering/html-security/renderer')

describe('HTML Security Renderer - table column sizing', () => {
    test('adds colgroup/col with fixed width for columns containing images', async () => {
        const input = `
      <table>
        <tbody>
          <tr>
            <td><img src="/x.png" /></td>
            <td>Text</td>
          </tr>
        </tbody>
      </table>
    `

        const output = await renderer.init(input, { safeHTML: true })

        expect(output).toMatch(/<colgroup>/)
        // Image-only column gets fixed width styling.
        expect(output).toMatch(/<col[^>]*style="[^"]*width\s*:\s*25px[^"]*"/)
        expect(output).toMatch(/<col[^>]*style="[^"]*min-width\s*:\s*25px[^"]*"/)
    })

    test('does not force fixed width for mixed-content image columns', async () => {
        const input = `
      <table>
        <tbody>
          <tr>
            <td><img src="/x.png" /> caption</td>
            <td>Text</td>
          </tr>
        </tbody>
      </table>
    `

        const output = await renderer.init(input, { safeHTML: true })

        // Should still keep min-width to prevent collapsing.
        expect(output).toMatch(/<col[^>]*style="[^"]*min-width\s*:\s*25px[^"]*"/)
        // But should NOT force a fixed width.
        expect(output).not.toMatch(/<col[^>]*style="[^"]*(^|[;\s])width\s*:\s*25px[^"]*"/)
    })

    test('respects colspans when determining image columns', async () => {
        const input = `
      <table>
        <tbody>
          <tr>
            <td colspan="2"><img src="/x.png" /></td>
            <td>Tail</td>
          </tr>
        </tbody>
      </table>
    `

        const output = await renderer.init(input, { safeHTML: true })

        // There should be at least 3 cols total.
        const colMatches = output.match(/<col\b/gi) || []
        expect(colMatches.length).toBeGreaterThanOrEqual(3)

        // First two cols should both get fixed width styling.
        const styledCols = (output.match(/<col[^>]*style="[^"]*width\s*:\s*25px[^"]*"/gi) || [])
        expect(styledCols.length).toBeGreaterThanOrEqual(2)
    })

    test('does not change tables without images', async () => {
        const input = `
      <table>
        <tr><td>A</td><td>B</td></tr>
      </table>
    `

        const output = await renderer.init(input, { safeHTML: true })

        expect(output).not.toMatch(/<colgroup>/)
        expect(output).not.toMatch(/min-width\s*:\s*25px/)
    })
})
