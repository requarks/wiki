<template>
  <w-menu
    class="translucent-menu"
    auto-close
    :anchor="props.anchor"
    :self="props.self"
    :offset="props.offset">
    <w-list padding style="min-width: 200px">
      <w-item
        v-for="lang of siteStore.locales.active"
        :key="lang.code"
        clickable
        @click="pick(lang.code)">
        <w-item-section side>
          <w-avatar
            rounded
            :color="lang.code === currentLocale ? `secondary` : `primary`"
            text-color="white"
            size="sm">
            <div class="text-caption uppercase">
              <strong>{{ lang.language }}</strong>
            </div>
          </w-avatar>
        </w-item-section>
        <w-item-section>
          <w-item-label>{{ lang.displayName }}</w-item-label>
        </w-item-section>
      </w-item>
    </w-list>
  </w-menu>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { splitLocalePath } from '@/helpers/pagePaths'

import { useCommonStore } from '@/stores/common'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

// PROPS

const props = defineProps({
  /**
   * The locale to tick, when the menu is choosing for something other than the site: the file manager
   * browses a locale of its own. The interface locale otherwise.
   */
  selected: {
    type: String,
    default: null
  },
  /**
   * Whether picking a locale takes the reader to the same page in it. Off where the menu is choosing
   * within a screen rather than moving between them — navigating out of the file manager would close
   * the overlay the reader is working in.
   */
  navigate: {
    type: Boolean,
    default: true
  },
  anchor: {
    type: String,
    default: 'bottom left'
  },
  self: {
    type: String,
    default: 'top left'
  },
  offset: {
    type: Array,
    default: () => [0, 0]
  }
})

// EMITS

const emit = defineEmits(['select'])

// STORES

const commonStore = useCommonStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()

// ROUTER

const route = useRoute()
const router = useRouter()

// I18N

const { t } = useI18n()

// COMPUTED

const currentLocale = computed(() => props.selected ?? commonStore.locale)

/**
 * Whether the route is the page the store holds, which is what makes its relations this reader's.
 *
 * Compared as the wiki stores a path rather than as the router hands it over: the URL carries a locale
 * prefix and a leading slash, and the site root is the `home` page.
 */
const onCurrentPage = computed(() => {
  const current = splitLocalePath(route.path, siteStore.localePrefixes)
  const path = (current?.path ?? route.path).replace(/^\/+/, '').replace(/\/+$/, '')
  return (path || 'home') === (pageStore.path || 'home')
})

// METHODS

/**
 * Switch to a locale: the content as well as the interface.
 *
 * The same page in another locale is another URL, so picking one navigates -- setting the interface
 * language alone left the reader on the English page with a French menu. `forcePrefix` has no say in
 * it: that setting decides whether the PRIMARY locale's pages carry a prefix, not whether the others
 * can be reached, and with it off switching to French did nothing at all.
 *
 * **Where the page says which page it is in that locale, that is where the reader goes.** A
 * translation rarely lives at the same path as its original -- a wiki writes its French pages in
 * French -- so the path is only a guess, and one the author can correct: see `localeRelations` on the
 * page store, set from the page properties panel. Without one the path is carried across unchanged,
 * which is the best guess available and is what a site whose translations are filed alike relies on.
 *
 * A menu choosing WITHIN a screen says `navigate: false` and listens for `select` instead: there the
 * locale is what a listing is filtered by rather than where the reader is going, and the interface
 * language is not the picker's to change.
 */
function pick(code) {
  emit('select', code)
  if (!props.navigate) {
    return
  }
  commonStore.setLocale(code)
  const current = splitLocalePath(route.path, siteStore.localePrefixes)
  const path = current?.path ?? route.path
  // -> An empty prefix is the primary locale on a site that does not bracket its URLs, where the path
  //    alone IS the address; anything else carries its short code in front
  const prefix = siteStore.localeUrlPrefix(code)
  /*
    Only when the reader is on the page the relations belong to. The menu is in the shell, so it is on
    screen over the search results and the profile as well, where the store still holds whichever page
    was read last -- and being sent to that page's translation instead of to this screen in the other
    language would be the wrong kind of helpful.
  */
  const related = onCurrentPage.value
    ? pageStore.localeRelations.find((rel) => rel.locale === code)
    : null
  router.push({
    path: related
      ? `${prefix}/${related.path}`
      : prefix
        ? `${prefix}${path === '/' ? '' : path}`
        : path,
    query: route.query,
    hash: route.hash
  })
}
</script>
