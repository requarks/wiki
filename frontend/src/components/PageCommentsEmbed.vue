<template>
  <div class="page-comments-embed">
    <w-separator class="my-6" />
    <div class="flex items-center pb-3">
      <w-icon class="mr-2" name="la:comments" color="grey" />
      <div class="text-caption text-grey-7">{{ t('common.comments.title') }}</div>
    </div>
    <!--
      The provider draws itself in here. Keyed by the page, so that a router transition destroys the
      container and builds a new one rather than handing the old one to a widget that has no idea the
      reader has moved -- several of the providers cache what they drew against the element they were
      given.
    -->
    <div :key="pageStore.id" ref="hostEl" />
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

import { mountCommentsEmbed } from '@/helpers/commentsEmbed'

/**
 * The comments of a third-party provider, under the article.
 *
 * Under it rather than on a tab, which is the opposite of what the built-in provider does and is
 * deliberate: this is somebody else's widget with its own accounts, its own moderation and its own
 * idea of what a discussion looks like, so it sits where every site that uses one of these puts it.
 * The Talk tab is for the discussion that is part of this wiki.
 *
 * Everything about the markup comes from the site payload, already rendered by the server bar the
 * placeholders about the page -- see `helpers/commentsEmbed.js`, which is also where the reason this
 * is mounted in the browser at all is written down.
 */

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const hostEl = ref(null)

// WATCHERS

// -> A page change is what a comment widget has to be told about, since nothing here reloads
watch(
  () => pageStore.id,
  // -> After the DOM has caught up: the container is keyed by the page, so the element this mounts
  //    into does not exist yet at the moment the id changes
  () => nextTick(mount)
)

// METHODS

function mount() {
  const code = siteStore.comments.code
  if (!hostEl.value || !pageStore.id || !code) {
    return
  }
  /*
    What a provider is allowed to know about the page, and the whole of it. The URL is built from the
    location the reader is at rather than from the path alone, because that is what a provider keys a
    discussion on and what it links back to from its own moderation screens.
  */
  mountCommentsEmbed(hostEl.value, code, {
    id: pageStore.id,
    path: pageStore.path,
    title: pageStore.title,
    locale: pageStore.locale,
    url: `${window.location.origin}/${pageStore.path}`
  })
}

// MOUNTED

onMounted(() => {
  mount()
})
</script>
