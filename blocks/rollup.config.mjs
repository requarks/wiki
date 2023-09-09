import summary from 'rollup-plugin-summary'
import terser from '@rollup/plugin-terser'
import resolve from '@rollup/plugin-node-resolve'
import graphql from '@rollup/plugin-graphql'

import * as glob from 'glob'

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
    resolve(),
    graphql(),
    terser({
      ecma: 2019,
      module: true
    }),
    summary()
  ]
}
