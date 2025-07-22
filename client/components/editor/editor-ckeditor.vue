<template lang="pug">
  .editor-ckeditor
    div(ref='toolbarContainer')
    div.contents(ref='editor')
    v-system-bar.editor-ckeditor-sysbar(dark, status, :color='colors.surfaceDark.black')
      .caption.editor-ckeditor-sysbar-locale {{locale.toUpperCase()}}
      .caption.px-3 /{{path}}
      template(v-if='$vuetify.breakpoint.mdAndUp')
        v-spacer
        .caption Visual Editor
        v-spacer
        .caption {{$t('editor:ckeditor.stats', { chars: stats.characters, words: stats.words })}}
    editor-conflict(v-model='isConflict', v-if='isConflict')
    page-selector(mode='select', v-model='insertLinkDialog', :open-handler='insertLinkHandler', :path='path', :locale='locale')
</template>

<script>
import _ from 'lodash'
import { get, sync } from 'vuex-pathify'
import DecoupledEditor from './ckeditor/ckeditor'
import EditorConflict from './ckeditor/conflict.vue'
import { html as beautify } from 'js-beautify/js/lib/beautifier.min.js'
import colors from '@/themes/default/js/color-scheme'

/* global siteLangs */

export default {
  components: {
    EditorConflict
  },
  props: {
    save: {
      type: Function,
      default: () => {}
    }
  },
  data() {
    return {
      editor: null,
      isDiagramEdit: false,
      stats: {
        characters: 0,
        words: 0
      },
      content: '',
      isConflict: false,
      insertLinkDialog: false,
      colors: colors
    }
  },
  computed: {
    isMobile() {
      return this.$vuetify.breakpoint.smAndDown
    },
    locale: get('page/locale'),
    path: get('page/path'),
    activeModal: sync('editor/activeModal'),
    sitePath: get('page/sitePath')
  },
  methods: {
    insertLink() {
      this.insertLinkDialog = true
    },
    insertLinkHandler({ locale, path }) {
      this.editor.execute('link', siteLangs.length > 0 ? `/${this.sitePath}/${locale}/${path}` : `/${this.sitePath}/${path}`)
    },
    insertDiagram() {
      this.isDiagramEdit = false
      this.toggleModal('editorModalDrawio')
    },
    editDiagram(diagram) {
      this.isDiagramEdit = true
      this.$store.set('editor/activeModalData', diagram)
      this.toggleModal('editorModalDrawio')
    },
    toggleModal(modalKey) {
      this.activeModal = (this.activeModal === modalKey) ? '' : modalKey
    },
    getSelectedWidget() {
      return document.getElementsByClassName('ck-widget_selected').item(0)
    },
    getSelectedDiagram() {
      const selection = this.getSelectedWidget()
      return selection.getElementsByTagName('img').item(0).getAttribute('src')
    },
    getDiagramCaption() {
      const selection = this.getSelectedWidget()
      return selection.getElementsByTagName('figcaption')?.item(0)?.firstChild.data
    },
    setDiagramCaption(caption) {
      const selection = this.getSelectedWidget()

      const userAgent = navigator.userAgent
      const chromeRE = /Chrome\/(\d{3})\.\d/
      const chromeMatch = chromeRE.exec(userAgent)
      const firefoxRE = /Firefox\/(\d{3})\.\d/
      const firefoxMatch = firefoxRE.exec(userAgent)

      if ((firefoxMatch && Number(firefoxMatch[1]) >= 123) ||
        (chromeMatch && Number(chromeMatch[1]) >= 124)) {
        // The caption is sanatized by the ckEditor
        selection.getElementsByTagName('figcaption').item(0).setHTMLUnsafe(caption)
      } else if (chromeMatch && Number(chromeMatch[1]) < 124) {
        // setHTMLUnsafe is not available for earlier browser versions
        selection.getElementsByTagName('figcaption').item(0).setHTML(caption)
      }
    }
  },
  async mounted() {
    this.$store.set('editor/editorKey', 'ckeditor')

    this.editor = await DecoupledEditor.create(this.$refs.editor, {
      language: this.locale,
      placeholder: 'Type the page content here',
      disableNativeSpellChecker: false,
      wordCount: {
        onUpdate: stats => {
          this.stats = {
            characters: stats.characters,
            words: stats.words
          }
        }
      }
    })
    this.$refs.toolbarContainer.appendChild(this.editor.ui.view.toolbar.element)

    if (this.mode !== 'create') {
      this.editor.setData(this.$store.get('editor/content'))
    }

    this.editor.model.document.on('change:data', _.debounce(evt => {
      this.$store.set('editor/content', beautify(this.editor.getData(), { indent_size: 2, end_with_newline: true }))
    }, 300))

    this.$root.$on('editorInsert', opts => {
      switch (opts.kind) {
        case 'IMAGE':
          this.editor.execute('insertImage', {
            source: opts.path
          })
          break
        case 'BINARY':
          this.editor.execute('link', opts.path, {
            linkIsDownloadable: true
          })
          break
        case 'DIAGRAM':
          let caption = ''
          if (this.isDiagramEdit) {
            caption = this.getDiagramCaption()
            this.editor.execute('delete')
          }

          this.editor.execute('insertImage', {
            source: `data:image/svg+xml;base64,${opts.text}`
          })

          if (this.isDiagramEdit && caption) {
            this.setDiagramCaption(caption)
          }
          break
      }
    })

    this.$root.$on('editorLinkToPage', () => {
      this.insertLink()
    })

    // Handle save conflict
    this.$root.$on('saveConflict', () => {
      this.isConflict = true
    })
    this.$root.$on('overwriteEditorContent', () => {
      this.editor.setData(this.$store.get('editor/content'))
    })

    this.$root.$on('insertDiagram', () => {
      this.insertDiagram()
    })
    this.$root.$on('editDiagram', () => {
      const selectedImg = this.getSelectedDiagram()
      this.editDiagram(selectedImg)
    })

    this.editor.model.document.on('change:data', (evt, data) => {
      // Track new mentions and remove old mentions
      let newMentions = new Map()
      const changes = data.operations.filter((op) => op.type === 'insert')
      changes.forEach((change) => {
        for (const node of change.nodes) {
          if (node.hasAttribute('mention')) {
            let mention = node.getAttribute('mention')
            if (mention.id && mention.id.startsWith('@')) {
            // Remove '@' from the mention id
              mention.id = mention.id.substring(1)
            }
            newMentions.set(mention['uid'], mention)
          }
        }
      })

      // Track removed mentions
      const uidNodes = []
      const walker = this.editor.model
        .createRangeIn(this.editor.model.document.getRoot())
        .getWalker()

      for (const value of walker) {
        const node = value.item
        if (node.hasAttribute('mention')) {
          const mention = node.getAttribute('mention')
          if (mention.uid) {
            uidNodes.push(node)
          }
        }
      }

      // Compare newMentions with uidNodes and remove non-existing mentions
      for (const [uid] of newMentions) {
        if (
          !uidNodes.some((node) => node.getAttribute('mention').uid === uid)
        ) {
          newMentions.delete(uid)
        }
      }
      // Merge new mentions with existing mentions in the store
      const existingMentions = this.$store.get('editor/mentions') || []
      const mergedMentions = new Set([...existingMentions, ...Array.from(newMentions.values()).map((mention) => mention.id)])

      // Set the mentions in the Vuex store
      this.$store.set('editor/mentions', Array.from(mergedMentions))
    })
  },
  beforeDestroy() {
    if (this.editor) {
      this.editor.destroy()
      this.editor = null
    }
  }
}
</script>

<style lang="scss" scoped>
$editor-height: calc(100vh - 64px - 24px);
$editor-height-mobile: calc(100vh - 56px - 16px);

.editor-ckeditor {
  background-color: mc('surface-light', 'disabled');
  display: inline-flex;
  display: flex;
  flex-flow: column nowrap;
  height: $editor-height;
  max-height: $editor-height;
  position: relative;

  @at-root .theme--dark & {
    background-color: mc('surface-dark', 'disabled');
  }

  @include until($tablet) {
    height: $editor-height-mobile;
    max-height: $editor-height-mobile;
  }

  &-sysbar {
    padding-left: 0;

    &-locale {
      background-color: mc("surface-dark", "secondary-neutral-lite");
      display: inline-flex;
      padding: 0 12px;
      height: 24px;
      width: 63px;
      justify-content: center;
      align-items: center;
    }
  }

  .contents {

    table {
      margin: inherit;
    }
    pre > code {
      background-color: unset;
      color: unset;
      padding: 0.15em;
    }
  }

  .ck.ck-toolbar__items {
    justify-content: center;
  }

  > .ck-editor__editable {
    background-color: mc('surface-light', 'page-background');
    color: mc('text-light', 'primary');
    overflow-y: auto;
    overflow-x: hidden;
    padding: 2rem;
    box-shadow: 0 0 5px hsla(0, 0, 0, .1);
    margin: 1rem auto 0;
    width: calc(100vw - 256px - 16vw);
    min-height: calc(100vh - 64px - 24px - 1rem - 40px);
    border-radius: 5px;

    @at-root .theme--dark & {
      background-color: mc('surface-dark', 'page-background');
      color: mc('text-dark', 'primary');
    }

    @include until($widescreen) {
      width: calc(100vw - 2rem);
      margin: 1rem 1rem 0 1rem;
      min-height: calc(100vh - 64px - 24px - 1rem - 40px);
    }

    @include until($tablet) {
      width: 100%;
      margin: 0;
      min-height: calc(100vh - 56px - 24px - 76px);
    }

    &.ck.ck-editor__editable:not(.ck-editor__nested-editable).ck-focused {
      border-color: #fff;
      box-shadow: 0 0 10px rgba(mc('blue', '700'), 0.25);

      @at-root .theme--dark & {
        border-color: #444;
        border-bottom: none;
        box-shadow: 0 0 10px rgba(#000, .25);
      }
    }

    &.ck .ck-editor__nested-editable.ck-editor__nested-editable_focused,
    &.ck .ck-editor__nested-editable:focus,
    .ck-widget.table td.ck-editor__nested-editable.ck-editor__nested-editable_focused,
    .ck-widget.table th.ck-editor__nested-editable.ck-editor__nested-editable_focused {
      background-color: mc('neutral', '100');

      @at-root .theme--dark & {
        background-color: mc('neutral', '900');
      }
    }
  }
}

.v-main .contents code{
  text-shadow: none;
  &::selection {
    color: #ffffff;
    background-color: mc('blue', '900') !important;
  }
}
</style>

// Global styling
<style lang="scss">
.editor-ckeditor {

  .ck.ck-toolbar.ck-toolbar_grouping {
    border: none;
    justify-content: center;
    background-color: mc('surface-light', 'tertiary-neutral-lite');

    &.ck-disabled {
      color: mc('text-light', 'disabled');
    }

    .ck-button:hover {
      &:not(.ck-disabled) {
        background: mc('surface-light', 'secondary-neutral-lite');
      }
      &.ck-disabled {
        background: transparent;
        &> .ck-icon {
          background-color: transparent;
        }
      }
    }

    @at-root .theme--dark & {
      background-color: mc('surface-dark', 'tertiary-neutral-lite');

      .ck.ck-dropdown__panel {
        border: mc('border-dark', 'inverse');

        .ck.ck-button.ck-list-item-button {
          background: mc('surface-dark', 'primary-neutral-lite');

          &:hover {
            color: mc('action-dark', 'active')
          }
        }
      }

      .ck.ck-list {
        background-color: mc('surface-dark', 'primary-neutral-lite');
        border-radius: 0px;
      }

      .ck.ck-dropdown__button:hover:not(.ck-disabled) > *,
      .ck.ck-splitbutton.ck-dropdown__button.ck-splitbutton_open > *,
      .ck.ck-dropdown > .ck-button.ck-splitbutton.ck-on {
        background-color: mc('surface-dark', 'primary-neutral-lite');
      }

      .ck-button, .ck-dropdown {
        color: mc('text-dark', 'primary');

        &:hover:not(.ck-disabled),
        &.ck-on,
        .ck.ck-dropdown__panel,
        .ck.ck-toolbar,
        .ck-toolbar__items,
        .ck-color-grids-fragment {
          background: mc('surface-dark', 'primary-neutral-lite');
          color: mc('action-dark', 'active')
        }
      }
    }
  }
}

:root {
  --ck-highlight-marker-yellow: #{mc('yellow', '600')};
  --ck-highlight-marker-green: #{mc('green', '600')};
  --ck-highlight-marker-blue: #{mc('blue', '600')};
  --ck-highlight-marker-red: #{mc('red', '700')};
  --ck-highlight-marker-pink: #{mc('red', '400')};
}
</style>
