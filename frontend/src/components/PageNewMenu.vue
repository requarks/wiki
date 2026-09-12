<template>
  <w-menu class="translucent-menu" auto-close anchor="bottom right" self="top right">
    <w-list padding>
      <!--
        The editors this site writes pages with, in the order the store lists them -- which is where
        the rule lives, so that what can be created here and what a search can be filtered by cannot
        drift apart. Each still carries its own icon and wording: `redirect` makes a redirection
        rather than a page, and `wysiwyg` is just "New Page".
      -->
      <w-item
        v-for="editor of siteStore.activeEditors"
        :key="editor"
        clickable
        @click="create(editor)">
        <blueprint-icon :icon="NEW_PAGE_ITEMS[editor].icon" />
        <w-item-section class="pr-2">{{ NEW_PAGE_ITEMS[editor].label }}</w-item-section>
      </w-item>
      <template v-if="props.hideAssetBtn === false">
        <w-separator class="my-2" inset />
        <w-item clickable @click="openFileManager">
          <blueprint-icon icon="add-image" />
          <w-item-section class="pr-2">Upload Media Asset</w-item-section>
        </w-item>
      </template>
      <template v-if="props.showNewFolder">
        <w-separator class="my-2" inset />
        <w-item clickable @click="newFolder">
          <blueprint-icon icon="add-folder" />
          <w-item-section class="pr-2">New Folder</w-item-section>
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
 * How each editor is offered: its icon, and the wording of the item that creates one with it.
 *
 * WHICH of them are offered is `siteStore.activeEditors`, and only that list decides -- these are the
 * words for the ones that are.
 */
const NEW_PAGE_ITEMS = {
  wysiwyg: { icon: 'google-presentation', label: 'New Page' },
  markdown: { icon: 'markdown', label: 'New Markdown Page' },
  asciidoc: { icon: 'asciidoc', label: 'New AsciiDoc Page' },
  channel: { icon: 'chat', label: 'New Discussion Space' },
  blog: { icon: 'typewriter-with-paper', label: 'New Blog Page' },
  api: { icon: 'api', label: 'New API Documentation' },
  // -> Not an editor the site can turn off, because it authors nothing: a redirection is a page with
  //    a target instead of a body
  redirect: { icon: 'advance', label: 'New Redirection' }
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
