<template lang="pug">
q-menu(
  auto-close
  anchor='bottom right'
  self='top right'
  )
  q-list(padding)
    q-item(clickable, @click='create(`wysiwyg`)')
      blueprint-icon(icon='google-presentation')
      q-item-section.q-pr-sm New Page
    q-item(clickable, @click='create(`markdown`)')
      blueprint-icon(icon='markdown')
      q-item-section.q-pr-sm New Markdown Page
    q-item(clickable, @click='create(`channel`)')
      blueprint-icon(icon='chat')
      q-item-section.q-pr-sm New Discussion Space
    q-item(clickable, @click='create(`blog`)')
      blueprint-icon(icon='typewriter-with-paper')
      q-item-section.q-pr-sm New Blog Page
    q-item(clickable, @click='create(`api`)')
      blueprint-icon(icon='api')
      q-item-section.q-pr-sm New API Documentation
    q-item(clickable, @click='create(`redirect`)')
      blueprint-icon(icon='advance')
      q-item-section.q-pr-sm New Redirection
    q-separator.q-my-sm(inset)
    q-item(clickable, @click='openFileManager')
      blueprint-icon(icon='add-image')
      q-item-section.q-pr-sm Upload Media Asset
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'

import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// METHODS

function create (editor) {
  window.location.assign('/_edit/new')
  // pageStore.pageCreate({ editor })
}

function openFileManager () {
  siteStore.overlay = 'FileManager'
}
</script>
