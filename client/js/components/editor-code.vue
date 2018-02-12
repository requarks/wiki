<template lang='pug'>
  .editor-code
    .editor-code-toolbar
      .editor-code-toolbar-group
        .editor-code-toolbar-item
          svg.icons.is-18(role='img')
            title Bold
            use(xlink:href='#fa-bold')
        .editor-code-toolbar-item
          svg.icons.is-18(role='img')
            title Italic
            use(xlink:href='#fa-italic')
        .editor-code-toolbar-item
          svg.icons.is-18(role='img')
            title Strikethrough
            use(xlink:href='#fa-strikethrough')
      .editor-code-toolbar-group
        v-menu(offset-y, open-on-hover)
          .editor-code-toolbar-item.is-dropdown(slot='activator')
            svg.icons.is-18(role='img')
              title Heading
              use(xlink:href='#fa-heading')
          v-list
            v-list-tile(v-for='(n, idx) in 6', @click='')
              v-list-tile-action: v-icon format_size
              v-list-tile-title Heading {{n}}
      .editor-code-toolbar-group
        .editor-code-toolbar-item
          svg.icons.is-18(role='img')
            title Unordered List
            use(xlink:href='#fa-list-ul')
        .editor-code-toolbar-item
          svg.icons.is-18(role='img')
            title Ordered List
            use(xlink:href='#fa-list-ol')
      .editor-code-toolbar-group
        .editor-code-toolbar-item
          svg.icons.is-18(role='img')
            title Link
            use(xlink:href='#fa-link')
      .editor-code-toolbar-group
        .editor-code-toolbar-item
          svg.icons.is-18(role='img')
            title Inline Code
            use(xlink:href='#fa-terminal')
        .editor-code-toolbar-item
          svg.icons.is-18(role='img')
            title Code Block
            use(xlink:href='#fa-code')
      .editor-code-toolbar-group
        .editor-code-toolbar-item
          svg.icons.is-18(role='img')
            title Horizontal Bar
            use(xlink:href='#fa-minus')
    .editor-code-main
      .editor-code-editor
        .editor-code-editor-title Editor
        codemirror(ref='cm', v-model='code', :options='cmOptions', @ready="onCmReady")
      .editor-code-preview
        .editor-code-preview-title Preview
        v-speed-dial(:hover='true', direction='left', transition='slide-y-reverse-transition', :fixed='true', :right='true', :bottom='true')
          v-btn(color='green', fab, dark, slot='activator')
            v-icon save
            v-icon close
          v-btn(color='red', fab, dark, small): v-icon not_interested
          v-btn(color='orange', fab, dark, small): v-icon vpn_lock
          v-btn(color='indigo', fab, dark, small): v-icon restore
          v-btn(color='brown', fab, dark, small): v-icon archive

</template>

<script>
import { codemirror } from 'vue-codemirror'
import 'codemirror/lib/codemirror.css'

// Theme

import 'codemirror/theme/base16-dark.css'

// Language

import 'codemirror/mode/markdown/markdown.js'

// Addons

import 'codemirror/addon/selection/active-line.js'
import 'codemirror/addon/display/fullscreen.js'
import 'codemirror/addon/display/fullscreen.css'
import 'codemirror/addon/selection/mark-selection.js'
import 'codemirror/addon/scroll/annotatescrollbar.js'
import 'codemirror/addon/search/matchesonscrollbar.js'
import 'codemirror/addon/search/searchcursor.js'
import 'codemirror/addon/search/match-highlighter.js'

export default {
  components: {
    codemirror
  },
  data() {
    return {
      code: 'const a = 10',
      cmOptions: {
        tabSize: 2,
        mode: 'text/markdown',
        theme: 'base16-dark',
        lineNumbers: true,
        lineWrapping: true,
        line: true,
        styleActiveLine: true,
        highlightSelectionMatches: {
          annotateScrollbar: true
        },
        viewportMargin: 50,
        extraKeys: {
          'F11'(cm) {
            cm.setOption('fullScreen', !cm.getOption('fullScreen'))
          },
          'Esc'(cm) {
            if (cm.getOption('fullScreen')) cm.setOption('fullScreen', false)
          }
        }
      }
    }
  },
  computed: {
    cm() {
      return this.$refs.cm.codemirror
    }
  },
  methods: {
    onCmReady(cm) {
      cm.setSize(null, 'calc(100vh - 50px)')
    },
    onCmFocus(cm) {
      console.log('the editor is focus!', cm)
    },
    onCmCodeChange(newCode) {
      console.log('this is new code', newCode)
      this.code = newCode
    }
  }
}
</script>

<style lang='scss'>
.editor-code {
  &-main {
    display: flex;
    width: 100%;
  }

  &-editor {
    flex: 1 1 50%;
    display: block;
    min-height: calc(100vh - 50px);
    position: relative;

    &-title {
      background-color: mc('grey', '800');
      border-bottom-left-radius: 5px;
      display: inline-flex;
      height: 30px;
      justify-content: center;
      align-items: center;
      padding: 0 1rem;
      color: mc('grey', '500');
      position: absolute;
      top: 0;
      right: 0;
      z-index: 2;
      text-transform: uppercase;
      font-size: .7rem;
    }
  }

  &-preview {
    flex: 1 1 50%;
    background-color: mc('grey', '100');
    position: relative;
    padding: 30px 1rem 1rem 1rem;

    &-title {
      background-color: mc('blue', '100');
      border-bottom-right-radius: 5px;
      display: inline-flex;
      height: 30px;
      justify-content: center;
      align-items: center;
      padding: 0 1rem;
      color: mc('blue', '800');
      position: absolute;
      top: 0;
      left: 0;
      z-index: 2;
      text-transform: uppercase;
      font-size: .7rem;
    }
  }

  &-toolbar {
    background-color: mc('blue', '700');
    background-image: linear-gradient(to bottom, mc('blue', '700') 0%, mc('blue','800') 100%);
    height: 50px;
    color: #FFF;
    display: flex;

    &-group {
      display: flex;

      + .editor-code-toolbar-group {
        border-left: 1px solid rgba(mc('blue', '900'), .75);
      }
    }

    &-item {
      width: 40px;
      height: 50px;
      display: flex;
      justify-content: center;
      align-items: center;
      transition: all .4s ease;
      cursor: pointer;

      &:first-child {
        padding-left: .5rem;
      }

      &:last-child {
        padding-right: .5rem;
      }

      &:hover {
        background-color: mc('blue', '600');
      }
    }

    svg {
      use {
        color: #FFF;
      }
    }
  }
}

.CodeMirror {
  height: auto;
}

.CodeMirror-focused .cm-matchhighlight {
  background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVQI12NgYGBgkKzc8x9CMDAwAAAmhwSbidEoSQAAAABJRU5ErkJggg==);
  background-position: bottom;
  background-repeat: repeat-x;
}
.cm-matchhighlight {
  background-color: mc('grey', '800');
}
.CodeMirror-selection-highlight-scrollbar {
  background-color: mc('green', '600');
}
</style>
