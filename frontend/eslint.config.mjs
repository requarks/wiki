import js from '@eslint/js'
import neostandard from 'neostandard'
import pluginVue from 'eslint-plugin-vue'
import pluginVuePug from 'eslint-plugin-vue-pug'
import vueParser from 'vue-eslint-parser'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat()

export default [
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  ...pluginVuePug.configs['flat/recommended'],
  ...neostandard(),
  {
    ignores: [
      '/dist',
      '/.quasar',
      '/node_modules'
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: vueParser,
      globals: {
        __statics: 'readonly',
        __QUASAR_SSR__: 'readonly',
        __QUASAR_SSR_SERVER__: 'readonly',
        __QUASAR_SSR_CLIENT__: 'readonly',
        __QUASAR_SSR_PWA__: 'readonly',
        process: 'readonly',
        Capacitor: 'readonly',
        chrome: 'readonly',
        APOLLO_CLIENT: 'readonly',
        EVENT_BUS: 'readonly'
      }
    },
    rules: {
      // allow async-await
      'generator-star-spacing': 'off',
      // allow paren-less arrow functions
      'arrow-parens': 'off',
      'one-var': 'off',
      'no-void': 'off',
      'multiline-ternary': 'off',

      'import/first': 'off',
      'import/named': 'error',
      'import/namespace': 'error',
      'import/default': 'error',
      'import/export': 'error',
      'import/extensions': 'off',
      'import/no-unresolved': 'off',
      'import/no-extraneous-dependencies': 'off',

      'prefer-promise-reject-errors': 'off',

      'no-unused-vars': 'off',
      'vue/multi-word-component-names': 'off',

      // allow debugger during development only
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',

      // disable bogus rules
      'vue/valid-template-root': 'off',
      'vue/no-parsing-error': 'off',
      'vue-pug/no-parsing-error': 'off',
      'vue/valid-v-for': 'off',
      'vue/html-quotes': ['warn', 'single'],
      'vue/max-attributes-per-line': 'off'
    }
  }
]
