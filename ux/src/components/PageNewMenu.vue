<template lang="pug">
q-menu.translucent-menu(
  auto-close
  anchor='bottom right'
  self='top right'
  )
  q-list(padding)
    q-item(
      clickable
      @click='create(`wysiwyg`)'
      v-if='siteStore.editors.wysiwyg && flagsStore.experimental'
      )
      blueprint-icon(icon='google-presentation')
      q-item-section.q-pr-sm New Page
    q-item(
      clickable
      @click='create(`markdown`)'
      v-if='siteStore.editors.markdown'
      )
      blueprint-icon(icon='markdown')
      q-item-section.q-pr-sm New Markdown Page
    template(v-if='flagsStore.experimental')
      q-item(
        clickable
        @click='create(`asciidoc`)'
        v-if='siteStore.editors.asciidoc'
        )
        blueprint-icon(icon='asciidoc')
        q-item-section.q-pr-sm New AsciiDoc Page
      q-item(
        clickable
        @click='create(`channel`)'
        )
        blueprint-icon(icon='chat')
        q-item-section.q-pr-sm New Discussion Space
      q-item(
        clickable
        @click='create(`blog`)'
        )
        blueprint-icon(icon='typewriter-with-paper')
        q-item-section.q-pr-sm New Blog Page
      q-item(
        clickable
        @click='create(`api`)'
        )
        blueprint-icon(icon='api')
        q-item-section.q-pr-sm New API Documentation
      q-item(
        clickable
        @click='create(`redirect`)'
        )
        blueprint-icon(icon='advance')
        q-item-section.q-pr-sm New Redirection
    template(v-if='props.hideAssetBtn === false')
      q-separator.q-my-sm(inset)
      q-item(
        clickable
        @click='openFileManager'
        )
        blueprint-icon(icon='add-image')
        q-item-section.q-pr-sm Upload Media Asset
    template(v-if='props.showNewFolder')
      q-separator.q-my-sm(inset)
      q-item(
        clickable
        @click='newFolder'
        )
        blueprint-icon(icon='add-folder')
        q-item-section.q-pr-sm New Folder
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'

import { useEditorStore } from 'src/stores/editor'
import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'
import { useFlagsStore } from 'src/stores/flags'

// PROPS

const props = defineProps({
  hideAssetBtn: {
    type: Boolean,
    default: false
  },
  showNewFolder: {
    type: Boolean,
    default: false
  },
  basePath: {
    type: String,
    default: null
  }
})

// EMITS

const emit = defineEmits(['newFolder', 'newPage'])

// QUASAR

const $q = useQuasar()

// STORES

const editorStore = useEditorStore()
const flagsStore = useFlagsStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// METHODS

async function create (editor) {
  $q.loading.show()
  emit('newPage')
  await pageStore.pageCreate({ editor, basePath: props.basePath })
  $q.loading.hide()
}

function openFileManager () {
  siteStore.openFileManager()
}

function newFolder () {
  emit('newFolder')
}
</script>
