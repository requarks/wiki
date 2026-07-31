import summary from 'rollup-plugin-summary'
import terser from '@rollup/plugin-terser'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

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
    // A backtick string with nothing interpolated is still a plain value, and the readable way to
    // write the multi-line ones -- a starter body for a block, say.
    case 'TemplateLiteral':
      if (node.expressions.length > 0) {
        throw new Error(`${blockDir}: "static definition" must contain only plain literals, got an interpolated template.`)
      }
      return node.quasis[0].value.cooked
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
 * Loads a `.css` import as a string.
 *
 * A block styles itself from inside its shadow root, which a `<link>` in the page cannot reach — so a
 * library's stylesheet has to be part of the component. Rollup has no notion of CSS on its own.
 */
function cssAsString () {
  return {
    name: 'css-as-string',
    transform (code, id) {
      if (!id.endsWith('.css')) {
        return null
      }
      return { code: `export default ${JSON.stringify(code)}`, map: { mappings: '' } }
    }
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
    format: 'es'
  },
  plugins: [
    blocksManifest(),
    cssAsString(),
    resolve(),
    // -> A block's own code is ESM, but a library it pulls in need not be: mermaid reaches for dayjs,
    //    which ships as UMD, and rollup has no notion of `module.exports` without this
    commonjs(),
    terser({
      ecma: 2019,
      module: true
    }),
    summary()
  ]
}
