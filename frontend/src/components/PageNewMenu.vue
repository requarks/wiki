<template>
  <w-menu class="translucent-menu" auto-close anchor="bottom right" self="top right">
    <w-list padding>
      <!--
        The editors this site writes pages with, in the order the store lists them -- which is where
        the rule lives, so that what can be created here and what a search can be filtered by cannot
        drift apart. Each still carries its own icon and wording: `redirect` makes a redirection
        rather than a page, and both Markdown and Visual say which of the two they open.
      -->
      <w-item
        v-for="editor of siteStore.activeEditors"
        :key="editor"
        clickable
        @click="create(editor)">
        <blueprint-icon :icon="EDITOR_ICONS[editor]" />
        <w-item-section class="pr-2">{{ t(`common.createPage.${editor}`) }}</w-item-section>
      </w-item>
      <template v-if="props.hideAssetBtn === false">
        <w-separator class="my-2" inset />
        <w-item clickable @click="openFileManager">
          <blueprint-icon icon="add-image" />
          <w-item-section class="pr-2">{{ t('common.createPage.uploadAsset') }}</w-item-section>
        </w-item>
      </template>
      <template v-if="props.showNewFolder">
        <w-separator class="my-2" inset />
        <w-item clickable @click="newFolder">
          <blueprint-icon icon="add-folder" />
          <w-item-section class="pr-2">{{ t('common.actions.newFolder') }}</w-item-section>
        </w-item>
      </template>
    </w-list>
  </w-menu>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { loading } from '@/composables/loading'

import { useEditorStore } from '@/stores/editor'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

/**
 * The icon each editor is offered under.
 *
 * WHICH of them are offered, and in what order, is `siteStore.activeEditors` -- only that list
 * decides. The wording lives in the locale file as `common.createPage.<editor>`, keyed by the same
 * ids, so an editor added to that list needs an icon here and a string there.
 *
 * `redirect` is not an editor the site can turn off, because it authors nothing: a redirection is a
 * page with a target instead of a body.
 */
const EDITOR_ICONS = {
  markdown: 'markdown',
  visual: 'google-presentation',
  asciidoc: 'asciidoc',
  channel: 'chat',
  blog: 'typewriter-with-paper',
  api: 'api',
  redirect: 'advance'
}

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
  },
  /**
   * The locale to write the new page in. The page store's current one when absent, which is right
   * from the page view and wrong from the file manager -- there the reader is looking at whichever
   * locale the picker is on, not at the page behind the overlay.
   */
  locale: {
    type: String,
    default: null
  }
})

// EMITS

const emit = defineEmits(['newFolder', 'newPage'])

// STORES

const editorStore = useEditorStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// METHODS

async function create(editor) {
  loading.show()
  emit('newPage')
  await pageStore.pageCreate({ editor, basePath: props.basePath, locale: props.locale })
  loading.hide()
}

function openFileManager() {
  siteStore.openFileManager()
}

function newFolder() {
  emit('newFolder')
}
</script>
