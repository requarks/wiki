import { tree } from 'd3-hierarchy'
import { boundsOf } from './shared.js'

/**
 * Hierarchical Tree: the site root on the left, each level a column to the right of the last.
 *
 * The one view whose labels never rotate, which makes it the one to read titles in -- and so the one
 * that stops shrinking to fit: past `minFitScale` it is started from its root, top left, and the rest is
 * panned to, rather than scaled down to a column of dots.
 */

const ROW = 24
const COLUMN = 240

export default {
  key: 'tree',
  icon: 'mdi:file-tree-outline',
  labelKey: 'fileman.graph.viewTree',
  budget: 500,
  maxChildren: 200,
  links: false,
  labelChars: 34,
  fontSize: 12,
  minFitScale: 0.8,

  layout(scene) {
    const { root } = scene
    tree()
      .nodeSize([ROW, COLUMN])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.3))(root)

    const positions = new Map()
    const edges = []
    for (const node of root.descendants()) {
      // -> d3 lays a tree out top-down; turned on its side, its x is our y
      positions.set(node.data.id, { x: node.y, y: node.x })
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
      place: (pos) => pos,
      label: () => ({ rotate: 0, side: 1, anchor: 'start' }),
      edgePath(s, t) {
        const mid = (s.x + t.x) / 2
        return `M${s.x},${s.y}C${mid},${s.y} ${mid},${t.y} ${t.x},${t.y}`
      },
      bounds: boundsOf(root, positions, (pos) => pos, {
        chars: this.labelChars,
        labelEnd: (pos, width) => ({ x: pos.x + width, y: pos.y })
      })
    }
  }
}
