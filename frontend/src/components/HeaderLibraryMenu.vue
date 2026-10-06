<template>
  <w-menu class="translucent-menu" auto-close anchor="bottom right" self="top right">
    <w-list padding>
      <!--
        -> Whoever may put a file somewhere: `write:assets` outright, or `write:pages` for an author
           whose rules cover the pages but not the assets beside them, since the editor sends them here
           to insert an image. Every folder and every file is checked again by the endpoints behind
           the manager, which answer per path, so this decides only whether the door is shown.
      -->
      <w-item v-if="canUseFileManager" clickable @click="openFileManager">
        <blueprint-icon icon="live-folder" />
        <w-item-section class="pr-2">{{ t('fileman.title') }}</w-item-section>
      </w-item>
      <!--
        -> Where the site has a glossary and this session may read it in at least one locale --
           `read:glossary` ignores the path, so the answer does not change from page to page and is
           asked once (`stores/glossary.js`). Experimental for now: this row is the glossary's only
           way in, so the flag hides the feature as a whole.
      -->
      <w-item
        v-if="flagsStore.experimental && glossaryStore.isAvailable"
        clickable
        @click="openGlossary">
        <blueprint-icon icon="parchment" />
        <w-item-section class="pr-2">{{ t('common.header.glossary') }}</w-item-section>
      </w-item>
      <w-item clickable to="/_tags" @click="emit('navigate')">
        <blueprint-icon icon="tags" />
        <w-item-section class="pr-2">{{ t('tags.title') }}</w-item-section>
      </w-item>
    </w-list>
  </w-menu>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFlagsStore } from '@/stores/flags'
import { useGlossaryStore } from '@/stores/glossary'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

/**
 * The header's Library menu: the File Manager, the Glossary and the Tags page.
 *
 * Its own component, like `PageNewMenu`, because it is opened from two places -- the folder button on
 * a wide header, and a submenu of the overflow menu below 900px. `navigate` is emitted as a row acts,
 * so that a menu holding this one as a submenu can close itself too.
 */

// EMITS

const emit = defineEmits(['navigate'])

// STORES

const flagsStore = useFlagsStore()
const glossaryStore = useGlossaryStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// COMPUTED

const canUseFileManager = computed(
  () => userStore.can('write:assets') || userStore.can('write:pages')
)

// WATCHERS

// -> Asked again whenever the answer could have changed: a login, a logout, another site -- and not
//    at all while the glossary is behind the experimental flag and nothing would show it
watch(
  () => [flagsStore.experimental, siteStore.id, userStore.authenticated, userStore.id],
  () => {
    if (flagsStore.experimental) {
      glossaryStore.ensureAccess()
    }
  },
  { immediate: true }
)

// METHODS

/*
  `navigate` first: the manager is a full-screen overlay, and a parent menu teleported to the body
  outranks it -- so the parent has to be gone before the panel opens.
*/
function openFileManager() {
  emit('navigate')
  siteStore.openFileManager()
}

function openGlossary() {
  emit('navigate')
  siteStore.openGlossary()
}
</script>
