<template lang="pug">
.wysiwyg-container
  .wysiwyg-toolbar(v-if='editor')
    template(v-for='menuItem of menuBar')
      q-separator.q-mx-xs(
        v-if='menuItem.type === `divider`'
        vertical
        )
      q-btn(
        v-else-if='menuItem.type === `dropdown`'
        :key='menuItem.key'
        flat
        :icon='menuItem.icon'
        padding='xs'
        :class='{ "is-active": menuItem.isActive && menuItem.isActive() }'
        :color='menuItem.isActive && menuItem.isActive() ? `primary` : `grey-10`'
        :aria-label='menuItem.title'
        split
        :disabled='menuItem.disabled && menuItem.disabled()'
        )
        q-menu
          q-list(
            dense
            padding
            )
            template(v-for='child of menuItem.children')
              q-separator.q-my-sm(v-if='child.type === `divider`')
              q-item(
                v-else
                :key='menuItem.key + `-` + child.key'
                clickable
                @click='child.action'
                :active='child.isActive && child.isActive()'
                active-class='text-primary'
                :disabled='child.disabled && child.disabled()'
                )
                q-item-section(side)
                  q-icon(
                    :name='child.icon'
                    :color='child.color'
                  )
                q-item-section
                  q-item-label {{child.title}}
      q-btn-group(
        v-else-if='menuItem.type === `btngroup`'
        :key='menuItem.key'
        flat
        )
        q-btn(
          v-for='child of menuItem.children'
          :key='menuItem.key + `-` + child.key'
          flat
          :icon='child.icon'
          padding='xs'
          :class='{ "is-active": child.isActive && child.isActive() }'
          :color='child.isActive && child.isActive() ? `primary` : `grey-10`'
          @click='child.action'
          :aria-label='child.title'
          :disabled='menuItem.disabled && menuItem.disabled()'
          )
      q-btn(
        v-else
        flat
        :icon='menuItem.icon'
        padding='xs'
        :class='{ "is-active": menuItem.isActive && menuItem.isActive() }'
        :color='menuItem.isActive && menuItem.isActive() ? `primary` : `grey-10`'
        @click='menuItem.action'
        :aria-label='menuItem.title'
        :disabled='menuItem.disabled && menuItem.disabled()'
        )
    q-space
    q-btn(
      size='sm'
      unelevated
      color='red'
      label='Test'
      @click='snapshot'
    )
  q-scroll-area(
    :thumb-style='thumbStyle'
    :bar-style='barStyle'
    style='height: 100%;'
    )
    editor-content(:editor='editor')
</template>

<script>
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
// import Collaboration from '@tiptap/extension-collaboration'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { Color } from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Mention from '@tiptap/extension-mention'
import Placeholder from '@tiptap/extension-placeholder'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Typography from '@tiptap/extension-typography'
// import * as Y from 'yjs'
// import { IndexeddbPersistence } from 'y-indexeddb'
// import { WebsocketProvider } from 'y-websocket'

export default {
  components: {
    EditorContent
  },
  data () {
    return {
      editor: null,
      ydoc: null,
      thumbStyle: {
        right: '2px',
        borderRadius: '5px',
        backgroundColor: '#000',
        width: '5px',
        opacity: 0.15
      },
      barStyle: {
        backgroundColor: '#FAFAFA',
        width: '9px',
        opacity: 1
      },
      menuBar: [
        {
          key: 'bold',
          icon: 'mdi-format-bold',
          title: 'Bold',
          action: () => this.editor.chain().focus().toggleBold().run(),
          isActive: () => this.editor.isActive('bold')
        },
        {
          key: 'italic',
          icon: 'mdi-format-italic',
          title: 'Italic',
          action: () => this.editor.chain().focus().toggleItalic().run(),
          isActive: () => this.editor.isActive('italic')
        },
        {
          key: 'strikethrough',
          icon: 'mdi-format-strikethrough',
          title: 'Strike',
          action: () => this.editor.chain().focus().toggleStrike().run(),
          isActive: () => this.editor.isActive('strike')
        },
        {
          key: 'code',
          icon: 'mdi-code-tags',
          title: 'Code',
          action: () => this.editor.chain().focus().toggleCode().run(),
          isActive: () => this.editor.isActive('code')
        },
        {
          key: 'fontfamily',
          icon: 'mdi-format-font',
          title: 'Font Family',
          type: 'dropdown',
          isActive: () => this.editor.isActive('fontFamily'),
          children: [
            {
              key: 'fontunset',
              icon: 'mdi-format-font',
              title: 'Sans-Serif',
              action: () => this.editor.chain().focus().unsetFontFamily().run()
            },
            {
              key: 'monospace',
              icon: 'mdi-format-font',
              title: 'Monospace',
              action: () => this.editor.chain().focus().setFontFamily('monospace').run()
            }
          ]
        },
        {
          key: 'color',
          icon: 'mdi-palette',
          title: 'Text Color',
          type: 'dropdown',
          isActive: () => this.editor.isActive('color'),
          children: [
            {
              key: 'blue',
              icon: 'mdi-palette',
              title: 'Blue',
              color: 'blue',
              action: () => this.editor.chain().focus().toggleHighlight().run()
            },
            {
              key: 'brown',
              icon: 'mdi-palette',
              title: 'Brown',
              color: 'brown',
              action: () => this.editor.chain().focus().toggleHighlight().run()
            },
            {
              key: 'green',
              icon: 'mdi-palette',
              title: 'Green',
              color: 'green',
              action: () => this.editor.chain().focus().toggleHighlight().run()
            },
            {
              key: 'orange',
              icon: 'mdi-palette',
              title: 'Orange',
              color: 'orange',
              action: () => this.editor.chain().focus().toggleHighlight().run()
            },
            {
              key: 'pink',
              icon: 'mdi-palette',
              title: 'Pink',
              color: 'pink',
              action: () => this.editor.chain().focus().toggleHighlight().run()
            },
            {
              key: 'purple',
              icon: 'mdi-palette',
              title: 'Purple',
              color: 'purple',
              action: () => this.editor.chain().focus().toggleHighlight().run()
            },
            {
              key: 'red',
              icon: 'mdi-palette',
              title: 'Red',
              color: 'red',
              action: () => this.editor.chain().focus().toggleHighlight().run()
            },
            {
              key: 'teal',
              icon: 'mdi-palette',
              title: 'Teal',
              color: 'teal',
              action: () => this.editor.chain().focus().toggleHighlight().run()
            },
            {
              key: 'yellow',
              icon: 'mdi-palette',
              title: 'Yellow',
              color: 'yellow',
              action: () => this.editor.chain().focus().toggleHighlight().run()
            },
            {
              type: 'divider'
            },
            {
              key: 'remove',
              icon: 'mdi-water-off',
              title: 'Default',
              color: 'grey',
              action: () => this.editor.chain().focus().unsetHighlight().run()
            }
          ]
        },
        {
          key: 'highlight',
          icon: 'mdi-marker',
          title: 'Highlight',
          type: 'dropdown',
          isActive: () => this.editor.isActive('highlight'),
          children: [
            {
              key: 'yellow',
              icon: 'mdi-marker',
              title: 'Yellow',
              color: 'yellow',
              action: () => this.editor.chain().focus().toggleHighlight().run()
            },
            {
              key: 'blue',
              icon: 'mdi-marker',
              title: 'Blue',
              color: 'blue',
              action: () => this.editor.chain().focus().toggleHighlight().run()
            },
            {
              key: 'pink',
              icon: 'mdi-marker',
              title: 'Pink',
              color: 'pink',
              action: () => this.editor.chain().focus().toggleHighlight().run()
            },
            {
              key: 'green',
              icon: 'mdi-marker',
              title: 'Green',
              color: 'green',
              action: () => this.editor.chain().focus().toggleHighlight().run()
            },
            {
              key: 'orange',
              icon: 'mdi-marker',
              title: 'Orange',
              color: 'orange',
              action: () => this.editor.chain().focus().toggleHighlight().run()
            },
            {
              type: 'divider'
            },
            {
              key: 'remove',
              icon: 'mdi-marker-cancel',
              title: 'Remove',
              color: 'grey',
              action: () => this.editor.chain().focus().unsetHighlight().run()
            }
          ]
        },
        {
          type: 'divider'
        },
        {
          key: 'header',
          icon: 'mdi-format-header-pound',
          title: 'Header',
          type: 'dropdown',
          isActive: () => this.editor.isActive('heading'),
          children: [
            {
              key: 'h1',
              icon: 'mdi-format-header-1',
              title: 'Header 1',
              action: () => this.editor.chain().focus().toggleHeading({ level: 1 }).run(),
              isActive: () => this.editor.isActive('heading', { level: 1 })
            },
            {
              key: 'h2',
              icon: 'mdi-format-header-2',
              title: 'Header 2',
              action: () => this.editor.chain().focus().toggleHeading({ level: 2 }).run(),
              isActive: () => this.editor.isActive('heading', { level: 2 })
            },
            {
              key: 'h3',
              icon: 'mdi-format-header-3',
              title: 'Header 3',
              action: () => this.editor.chain().focus().toggleHeading({ level: 3 }).run(),
              isActive: () => this.editor.isActive('heading', { level: 3 })
            },
            {
              key: 'h4',
              icon: 'mdi-format-header-4',
              title: 'Header 4',
              action: () => this.editor.chain().focus().toggleHeading({ level: 4 }).run(),
              isActive: () => this.editor.isActive('heading', { level: 4 })
            },
            {
              key: 'h5',
              icon: 'mdi-format-header-5',
              title: 'Header 5',
              action: () => this.editor.chain().focus().toggleHeading({ level: 5 }).run(),
              isActive: () => this.editor.isActive('heading', { level: 5 })
            },
            {
              key: 'h6',
              icon: 'mdi-format-header-6',
              title: 'Header 6',
              action: () => this.editor.chain().focus().toggleHeading({ level: 6 }).run(),
              isActive: () => this.editor.isActive('heading', { level: 6 })
            }
          ]
        },
        {
          key: 'paragraph',
          icon: 'mdi-format-paragraph',
          title: 'Paragraph',
          action: () => this.editor.chain().focus().setParagraph().run(),
          isActive: () => this.editor.isActive('paragraph')
        },
        {
          type: 'divider'
        },
        {
          key: 'align',
          type: 'btngroup',
          children: [
            {
              key: 'left',
              icon: 'mdi-format-align-left',
              title: 'Left Align',
              action: () => this.editor.chain().focus().setTextAlign('left').run(),
              isActive: () => this.editor.isActive({ textAlign: 'left' })
            },
            {
              key: 'center',
              icon: 'mdi-format-align-center',
              title: 'Center Align',
              action: () => this.editor.chain().focus().setTextAlign('center').run(),
              isActive: () => this.editor.isActive({ textAlign: 'center' })
            },
            {
              key: 'right',
              icon: 'mdi-format-align-right',
              title: 'Right Align',
              action: () => this.editor.chain().focus().setTextAlign('right').run(),
              isActive: () => this.editor.isActive({ textAlign: 'right' })
            },
            {
              key: 'justify',
              icon: 'mdi-format-align-justify',
              title: 'Justify Align',
              action: () => this.editor.chain().focus().setTextAlign('justify').run(),
              isActive: () => this.editor.isActive({ textAlign: 'justify' })
            }
          ]
        },
        {
          type: 'divider'
        },
        {
          key: 'bulletlist',
          icon: 'mdi-format-list-bulleted',
          title: 'Bullet List',
          action: () => this.editor.chain().focus().toggleBulletList().run(),
          isActive: () => this.editor.isActive('bulletList')
        },
        {
          key: 'orderedlist',
          icon: 'mdi-format-list-numbered',
          title: 'Ordered List',
          action: () => this.editor.chain().focus().toggleOrderedList().run(),
          isActive: () => this.editor.isActive('orderedList')
        },
        {
          key: 'tasklist',
          icon: 'mdi-format-list-checkbox',
          title: 'Task List',
          action: () => this.editor.chain().focus().toggleTaskList().run(),
          isActive: () => this.editor.isActive('taskList')
        },
        {
          type: 'divider'
        },
        {
          key: 'codeblock',
          icon: 'mdi-code-json',
          title: 'Code Block',
          action: () => this.editor.chain().focus().toggleCodeBlock().run(),
          isActive: () => this.editor.isActive('codeBlock')
        },
        {
          key: 'blockquote',
          icon: 'mdi-format-quote-close',
          title: 'Blockquote',
          action: () => this.editor.chain().focus().toggleBlockquote().run(),
          isActive: () => this.editor.isActive('blockquote')
        },
        {
          key: 'rule',
          icon: 'mdi-minus',
          title: 'Horizontal Rule',
          action: () => this.editor.chain().focus().setHorizontalRule().run()
        },
        {
          key: 'link',
          icon: 'mdi-link-plus',
          title: 'Link',
          action: () => {
            // TODO: insert link
          }
        },
        {
          key: 'image',
          icon: 'mdi-image-plus',
          title: 'Image',
          action: () => {
            // TODO: insert image
          }
        },
        {
          key: 'table',
          icon: 'mdi-table-large',
          title: 'Table',
          type: 'dropdown',
          isActive: () => this.editor.isActive('table'),
          children: [
            {
              key: 'insert',
              icon: 'mdi-table-large-plus',
              title: 'Insert Table',
              action: () => this.editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            },
            {
              type: 'divider'
            },
            {
              key: 'addcolumnbefore',
              icon: 'mdi-table-column-plus-before',
              title: 'Add Column Before',
              action: () => this.editor.chain().focus().addColumnBefore().run(),
              disabled: () => !this.editor.can().addColumnBefore()
            },
            {
              key: 'addcolumnafter',
              icon: 'mdi-table-column-plus-after',
              title: 'Add Column After',
              action: () => this.editor.chain().focus().addColumnAfter().run(),
              disabled: () => !this.editor.can().addColumnAfter()
            },
            {
              key: 'deletecolumn',
              icon: 'mdi-table-column-remove',
              title: 'Remove Column',
              action: () => this.editor.chain().focus().deleteColumn().run(),
              disabled: () => !this.editor.can().deleteColumn()
            },
            {
              type: 'divider'
            },
            {
              key: 'addrowbefore',
              icon: 'mdi-table-row-plus-before',
              title: 'Add Row Before',
              action: () => this.editor.chain().focus().addRowBefore().run(),
              disabled: () => !this.editor.can().addRowBefore()
            },
            {
              key: 'addrowafter',
              icon: 'mdi-table-row-plus-after',
              title: 'Add Row After',
              action: () => this.editor.chain().focus().addRowAfter().run(),
              disabled: () => !this.editor.can().addRowAfter()
            },
            {
              key: 'deleterow',
              icon: 'mdi-table-row-remove',
              title: 'Remove Row',
              action: () => this.editor.chain().focus().deleteRow().run(),
              disabled: () => !this.editor.can().deleteRow()
            },
            {
              type: 'divider'
            },
            {
              key: 'merge',
              icon: 'mdi-table-merge-cells',
              title: 'Merge Cells',
              action: () => this.editor.chain().focus().mergeCells().run(),
              disabled: () => !this.editor.can().mergeCells()
            },
            {
              key: 'split',
              icon: 'mdi-table-split-cell',
              title: 'Split Cell',
              action: () => this.editor.chain().focus().splitCell().run(),
              disabled: () => !this.editor.can().splitCell()
            },
            {
              type: 'divider'
            },
            {
              key: 'toggleHeaderColumn',
              icon: 'mdi-table-column',
              title: 'Toggle Header Column',
              action: () => this.editor.chain().focus().toggleHeaderColumn().run(),
              disabled: () => !this.editor.can().toggleHeaderColumn()
            },
            {
              key: 'toggleHeaderRow',
              icon: 'mdi-table-row',
              title: 'Toggle Header Row',
              action: () => this.editor.chain().focus().toggleHeaderRow().run(),
              disabled: () => !this.editor.can().toggleHeaderRow()
            },
            {
              key: 'toggleHeaderCell',
              icon: 'mdi-crop-square',
              title: 'Toggle Header Cell',
              action: () => this.editor.chain().focus().toggleHeaderCell().run(),
              disabled: () => !this.editor.can().toggleHeaderCell()
            },
            {
              type: 'divider'
            },
            {
              key: 'fix',
              icon: 'mdi-table-heart',
              title: 'Fix Table',
              action: () => this.editor.chain().focus().fixTables().run(),
              disabled: () => !this.editor.can().fixTables()
            },
            {
              key: 'remove',
              icon: 'mdi-table-large-remove',
              title: 'Delete Table',
              action: () => this.editor.chain().focus().deleteTable().run(),
              disabled: () => !this.editor.can().deleteTable()
            }
          ]
        },
        {
          type: 'divider'
        },
        {
          key: 'pagebreak',
          icon: 'mdi-format-page-break',
          title: 'Hard Break',
          action: () => this.editor.chain().focus().setHardBreak().run()
        },
        {
          key: 'clearformat',
          icon: 'mdi-format-clear',
          title: 'Clear Format',
          action: () => this.editor.chain()
            .focus()
            .clearNodes()
            .unsetAllMarks()
            .run()
        },
        {
          type: 'divider'
        },
        {
          key: 'undo',
          icon: 'mdi-undo-variant',
          title: 'Undo',
          action: () => this.editor.chain().focus().undo().run(),
          disabled: () => !this.editor.can().undo()
        },
        {
          key: 'redo',
          icon: 'mdi-redo-variant',
          title: 'Redo',
          action: () => this.editor.chain().focus().redo().run(),
          disabled: () => !this.editor.can().redo()
        }
      ]
    }
  },
  mounted () {
    if (!import.meta.env.SSR) {
      this.init()
    }
  },
  beforeUnmount () {
    this.editor.destroy()
  },
  methods: {
    init () {
      console.info('BOOP')
      // this.ydoc = new Y.Doc()

      /* eslint-disable no-unused-vars */
      // const dbProvider = new IndexeddbPersistence('example-document', this.ydoc)
      // const wsProvider = new WebsocketProvider('ws://127.0.0.1:1234', 'example-document', this.ydoc)
      /* eslint-enable no-unused-vars */

      this.editor = new Editor({
        content: this.$store.get('page/render'),
        extensions: [
          StarterKit.configure({
            codeBlock: false,
            history: {
              depth: 500
            }
          }),
          CodeBlockLowlight,
          Color,
          // Collaboration.configure({
          //   document: this.ydoc
          // }),
          FontFamily,
          Highlight.configure({
            multicolor: true
          }),
          Image,
          Mention.configure({
            // TODO: suggestions
          }),
          Placeholder.configure({
            placeholder: 'Enter some content here...'
          }),
          Table.configure({
            resizable: true
          }),
          TableRow,
          TableHeader,
          TableCell,
          TaskList,
          TaskItem,
          TextAlign,
          TextStyle,
          Typography
        ],
        onUpdate: () => {
          this.$store.set('page/render', this.editor.getHTML())
        }
      })
    },
    insertTable () {
      // this.ql.getModule('table').insertTable(3, 3)
    },
    snapshot () {
      // console.info(Y.encodeStateVector(this.ydoc))
    }
  }
}
</script>

<style lang="scss">
.wysiwyg-container {
  height: calc(100% - 41px);

  .wysiwyg-toolbar {
    border: none;
    border-bottom: 1px solid $grey-4;
    display: flex;
    align-items: center;
    padding: 4px;
    background: linear-gradient(to top, $grey-1 0%, #FFF 100%);
  }

  .ProseMirror {
    padding: 16px;
    min-height: 75vh;

    &-focused {
      border: none;
      outline: none;
    }

    > * + * {
      margin-top: 0.75em;
    }

    ul,
    ol {
      padding: 0 1rem;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      line-height: 1.1;
    }

    code {
      background-color: rgba(#616161, 0.1);
      color: #616161;
    }

    pre {
      background: #0D0D0D;
      color: #FFF;
      font-family: 'JetBrainsMono', monospace;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;

      code {
        color: inherit;
        padding: 0;
        background: none;
        font-size: 0.8rem;
      }
    }

    img {
      max-width: 100%;
      height: auto;
    }

    blockquote {
      padding-left: 1rem;
      border-left: 2px solid rgba(#0D0D0D, 0.1);
    }

    hr {
      border: none;
      border-top: 2px solid rgba(#0D0D0D, 0.1);
      margin: 2rem 0;
    }

    table {
      border-collapse: collapse;
      table-layout: fixed;
      width: 100%;
      margin: 0;
      overflow: hidden;

      td,
      th {
        min-width: 1em;
        border: 2px solid #ced4da;
        padding: 3px 5px;
        vertical-align: top;
        box-sizing: border-box;
        position: relative;

        > * {
          margin-bottom: 0;
        }
      }

      th {
        font-weight: bold;
        text-align: left;
        background-color: #f1f3f5;
      }

      .selectedCell:after {
        z-index: 2;
        position: absolute;
        content: "";
        left: 0; right: 0; top: 0; bottom: 0;
        background: rgba(200, 200, 255, 0.4);
        pointer-events: none;
      }

      .column-resize-handle {
        position: absolute;
        right: -2px;
        top: 0;
        bottom: -2px;
        width: 4px;
        background-color: #adf;
        pointer-events: none;
      }
    }

    .tableWrapper {
      overflow-x: auto;
    }

    .resize-cursor {
      cursor: ew-resize;
      cursor: col-resize;
    }

    ul[data-type="taskList"] {
      list-style: none;
      padding: 0;

      li {
        display: flex;
        align-items: center;

        > label {
          flex: 0 0 auto;
          margin-right: 0.5rem;
        }
      }
    }

    p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      float: left;
      color: #ced4da;
      pointer-events: none;
      height: 0;
    }
  }
}
</style>
