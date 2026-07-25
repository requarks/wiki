import summary from 'rollup-plugin-summary'
import terser from '@rollup/plugin-terser'
import resolve from '@rollup/plugin-node-resolve'
import graphql from '@rollup/plugin-graphql'

import * as glob from 'glob'

/**
 * Turn an ESTree literal node into a plain JS value.
 *
 * Only literals, arrays and objects of literals are supported — a block definition is metadata, so
 * anything computed is a mistake worth failing the build over.
 */
function literalToValue (node, blockDir) {
  switch (node.type) {
    case 'Literal':
      return node.value
    case 'ArrayExpression':
      return node.elements.map(el => literalToValue(el, blockDir))
    case 'ObjectExpression':
      return Object.fromEntries(node.properties.map(prop => [
        prop.key.name ?? prop.key.value,
        literalToValue(prop.value, blockDir)
      ]))
    default:
      throw new Error(`${blockDir}: "static definition" must contain only plain literals, got ${node.type}.`)
  }
}

/**
 * Collects each block's `static definition` into `compiled/blocks.manifest.json`.
 *
 * The definitions are read from the AST rather than by importing the modules, since a component
 * registers itself with `customElements` on load and so cannot be imported outside a browser.
 */
function blocksManifest () {
  const definitions = new Map()
  return {
    name: 'blocks-manifest',
    buildStart () {
      definitions.clear()
    },
    transform (code, id) {
      if (!id.endsWith('/component.js')) {
        return null
      }
      const blockDir = id.split('/').at(-2)
      const ast = this.parse(code)
      for (const node of ast.body) {
        const classNode = node.type === 'ExportNamedDeclaration' ? node.declaration : node
        if (classNode?.type !== 'ClassDeclaration') {
          continue
        }
        const definitionNode = classNode.body.body.find(member =>
          member.type === 'PropertyDefinition' && member.static && member.key.name === 'definition'
        )
        if (definitionNode) {
          definitions.set(blockDir, literalToValue(definitionNode.value, blockDir))
        }
      }
      if (!definitions.has(blockDir)) {
        this.warn(`${blockDir} has no "static definition" — it will not appear in the admin area.`)
      }
      return null
    },
    generateBundle () {
      this.emitFile({
        type: 'asset',
        fileName: 'blocks.manifest.json',
        source: JSON.stringify([...definitions.values()], null, 2) + '\n'
      })
    }
  }
}

export default {
  input: Object.fromEntries(
    glob.sync('@(block-*)/component.js', {
      ignore: [
        'dist/**',
        'node_modules/**'
      ]
    }).map(file => {
      const fileParts = file.split('/')
      return [
        fileParts[0],
        file
      ]
    })
  ),
  output: {
    dir: 'compiled',
    format: 'es',
    globals: {
      APOLLO_CLIENT: 'APOLLO_CLIENT'
    }
  },
  plugins: [
    blocksManifest(),
    resolve(),
    graphql(),
    terser({
      ecma: 2019,
      module: true
    }),
    summary()
  ]
}
