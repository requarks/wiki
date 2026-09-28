import { cluster } from 'd3-hierarchy'
import { curveBundle, lineRadial, linkRadial } from 'd3-shape'
import { boundsOf, polarToXY, radialLabel, radialLabelEnd } from './shared.js'

/**
 * Relational Radial: every page on one ring, and the links between them drawn across it.
 *
 * Hierarchical edge bundling -- each link is routed through the folders both of its ends sit in, so
 * links between two sections run together as one visible strand instead of a web. The folders are
 * where the bundles bend, so they are drawn too, faintly, inside the ring.
 *
 * The scene appends its stubs to the focus as groups of their own, which is what puts them on an arc
 * of the ring apart from the section's pages; they are then pushed out past the ring, so a link
 * leaving the section is seen to leave it.
 */

const LEAF_ARC = 14
const MIN_RADIUS = 220
/** How far past the ring a stub sits. */
const STUB_OFFSET = 26

const bundle = lineRadial()
  .curve(curveBundle.beta(0.85))
  .angle((pos) => pos.a)
  .radius((pos) => pos.r)

const edge = linkRadial()
  .angle((pos) => pos.a)
  .radius((pos) => pos.r)

export default {
  key: 'relational',
  icon: 'mdi:graph-outline',
  labelKey: 'fileman.graph.viewRelational',
  budget: 800,
  maxChildren: 300,
  links: true,
  labelChars: 28,
  fontSize: 10.5,

  layout(scene) {
    const { root, nodesById } = scene
    const leaves = root.leaves().length
    const radius = Math.max(MIN_RADIUS, (leaves * LEAF_ARC) / (2 * Math.PI))

    cluster()
      .size([2 * Math.PI, radius])
      .separation((a, b) => (a.parent === b.parent ? 1 : 2))(root)

    const positions = new Map()
    const edges = []
    for (const node of root.descendants()) {
      const isStub = node.data.kind === 'stub'
      positions.set(node.data.id, { a: node.x, r: node.y + (isStub ? STUB_OFFSET : 0) })
      if (node.parent) {
        edges.push({
          id: node.data.id,
          parent: node.parent.data.id,
          child: node.data.id,
          depth: node.depth
        })
      }
    }

    return {
      positions,
      edges,
      place: polarToXY,
      label: (pos, node) => radialLabel(pos, node.depth === 0),
      edgePath: (s, t) => edge({ source: s, target: t }),
      linkPath(link) {
        const source = nodesById.get(link.source)
        const target = nodesById.get(link.target)
        return bundle(source.path(target).map((node) => positions.get(node.data.id)))
      },
      /** Where a link starts round the ring, as a fraction of a turn: it sets when the link draws in. */
      linkPhase(link) {
        const a = positions.get(link.source)?.a ?? 0
        return a / (2 * Math.PI)
      },
      bounds: boundsOf(root, positions, polarToXY, {
        chars: this.labelChars,
        labelEnd: radialLabelEnd
      })
    }
  }
}
