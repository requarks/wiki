const MarkdownIt = require('markdown-it')

let hasTopologyUi = true
try {
  require.resolve('@couchbaselabs/topology-ui')
} catch (err) {
  hasTopologyUi = false
}

const describeIfTopologyUi = hasTopologyUi ? describe : describe.skip

describeIfTopologyUi('markdown couchbase topology renderer', () => {
  const renderer = require('../../modules/rendering/markdown-couchbase-topology/renderer')

  test('renders a fenced topology block as html', () => {
    const md = new MarkdownIt({ html: true, breaks: true, linkify: true })
    renderer.init(md, {
      allowJavaScript: true,
      assetRoot: '/_assets/topology-ui/images',
      openMarker: '```couchbase-topology',
      closeMarker: '```'
    })

    const html = md.render(`
\`\`\`couchbase-topology
{
  "name": "cb-demo",
  "version": "7.2.0",
  "serverGroups": [
    {
      "name": "sg1",
      "nodes": [
        {
          "name": "cb-demo0001",
          "services": ["Data", "Query"],
          "status": "HEALTHY"
        }
      ]
    }
  ]
}
\`\`\`
`)

    expect(html).toContain('cb-topology-renderer-host')
    expect(html).toContain('cb-topology-renderer')
    expect(html).toContain('cb-demo')
    expect(html).toContain('/_assets/topology-ui/images/nodebg.png')
  })

  test('supports alignment attrs on the fence closing line', () => {
    const md = new MarkdownIt({ html: true, breaks: true, linkify: true })
    renderer.init(md, {
      allowJavaScript: true,
      assetRoot: '/_assets/topology-ui/images',
      openMarker: '```couchbase-topology',
      closeMarker: '```'
    })

    const html = md.render(`
\`\`\`couchbase-topology
{
  "name": "cb-demo",
  "version": "7.2.0",
  "serverGroups": []
}
\`\`\` {.align-center #demo-topology}
`)

    expect(html).toContain('class="cb-topology-renderer-host align-center"')
    expect(html).toContain('id="demo-topology"')
  })

  test('supports alignment attrs on the line after the fence', () => {
    const md = new MarkdownIt({ html: true, breaks: true, linkify: true })
    renderer.init(md, {
      allowJavaScript: true,
      assetRoot: '/_assets/topology-ui/images',
      openMarker: '```couchbase-topology',
      closeMarker: '```'
    })

    const html = md.render(`
\`\`\`couchbase-topology
{
  "name": "cb-demo",
  "version": "7.2.0",
  "serverGroups": []
}
\`\`\`
{.align-right}
`)

    expect(html).toContain('class="cb-topology-renderer-host align-right"')
    expect(html).not.toContain('<p class="align-right"></p>')
  })

  test('returns an error block for invalid payloads', () => {
    const md = new MarkdownIt({ html: true, breaks: true, linkify: true })
    renderer.init(md, {
      allowJavaScript: false,
      assetRoot: '/_assets/topology-ui/images',
      openMarker: '```couchbase-topology',
      closeMarker: '```'
    })

    const html = md.render(`
\`\`\`couchbase-topology
{ name: "broken" }
\`\`\`
`)

    expect(html).toContain('cb-topology-renderer-host')
    expect(html).toContain('cb-topology-renderer--error')
    expect(html).toContain('Topology source is not valid JSON')
  })
})
