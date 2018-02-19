<template lang='pug'>
  .editor-code
    v-toolbar(color='blue', flat, dense, dark)
      v-icon(color='blue lighten-5') border_color
      v-toolbar-title.white--text Sample Page
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
            v-list-tile(v-for='(n, idx) in 6', @click='', :key='idx')
              v-list-tile-action: v-icon format_size
              v-list-tile-title Heading {{n}}
        .editor-code-toolbar-item
          svg.icons.is-18(role='img')
            title Blockquote
            use(xlink:href='#fa-quote-left')
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
      v-speed-dial(v-model='fabInsertMenu', :open-on-hover='true', direction='top', transition='slide-y-reverse-transition', :fixed='true', :right='!isMobile', :left='isMobile', :bottom='true')
        v-btn(color='blue', fab, dark, v-model='fabInsertMenu', slot='activator')
          v-icon add_circle
          v-icon close
        v-btn(color='teal', fab, dark): v-icon image
        v-btn(color='pink', fab, dark): v-icon insert_drive_file
        v-btn(color='red', fab, dark): v-icon play_circle_outline
        v-btn(color='purple', fab, dark): v-icon multiline_chart
        v-btn(color='indigo', fab, dark): v-icon functions
      v-speed-dial(v-model='fabMainMenu', :open-on-hover='true', :direction='saveMenuDirection', transition='slide-x-reverse-transition', :fixed='true', :right='true', :top='!isMobile', :bottom='isMobile')
        v-btn(color='white', fab, light, v-model='fabMainMenu' slot='activator')
          v-icon(color='blue darken-2') blur_on
          v-icon(color='blue darken-2') close
        v-btn(color='blue-grey', fab, dark, @click.native.stop='$parent.openModal(`properties`)'): v-icon sort_by_alpha
        v-btn(color='green', fab, dark, @click.native.stop='$parent.save()'): v-icon save
        v-btn(color='red', fab, dark, small): v-icon not_interested
        v-btn(color='orange', fab, dark, small, @click.native.stop='$parent.openModal(`access`)'): v-icon vpn_lock
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
      fabMainMenu: false,
      fabInsertMenu: false,
      code: '# Header 1\n\nSample **Text**\n\n## Header 2\nSample Text',
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
    },
    isMobile() {
      return this.$vuetify.breakpoint.smAndDown
    },
    saveMenuDirection() {
      return this.isMobile ? 'top' : 'bottom'
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

      @include until($tablet) {
        display: none;
      }
    }
  }

  &-preview {
    flex: 1 1 50%;
    background-color: mc('grey', '100');
    position: relative;
    padding: 30px 1rem 1rem 1rem;

    @include until($tablet) {
      display: none;
    }

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

    @include until($tablet) {
      justify-content: center;
    }

    &-group {
      display: flex;

      + .editor-code-toolbar-group {
        border-left: 1px solid rgba(mc('blue', '600'), .5);
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

      @include until($tablet) {
        width: 35px;
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

  .cm-header-1 {
    font-size: 1.5rem;
  }
  .cm-header-2 {
    font-size: 1.25rem;
  }
  .cm-header-3 {
    font-size: 1.15rem;
  }
  .cm-header-4 {
    font-size: 1.1rem;
  }
  .cm-header-5 {
    font-size: 1.05rem;
  }
  .cm-header-6 {
    font-size: 1.025rem;
  }
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
