<template>
  <router-view />
  <!-- Mounted once for the whole app; driven by composables/{notify,loading,dialog}.js -->
  <w-notifications />
  <w-loading-overlay />
  <w-dialog-host />
  <component :is="DevQuickMenu" v-if="DevQuickMenu" />
</template>

<script setup>
import { defineAsyncComponent, reactive, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { setCssVar } from '@/helpers/cssVars'
import { useDark } from '@/composables/dark'
import { notify } from '@/composables/notify'

import WDialogHost from '@/components/shared/WDialogHost.vue'
import WLoadingOverlay from '@/components/shared/WLoadingOverlay.vue'
import WNotifications from '@/components/shared/WNotifications.vue'

import { useCommonStore } from './stores/common'
import { useFlagsStore } from '@/stores/flags'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

/* global siteConfig */

// DEV TOOLS

/*
  The dev quick menu, and nothing of it in a release.

  `import.meta.env.DEV` is substituted at build time, so a production build sees `false ? … : null`,
  drops the branch, and with it the only reference to the dynamic import -- the component is never
  emitted as a chunk, not merely never rendered. Keep the import inside this expression for that
  reason: a top-level `import` of it would be bundled however it was guarded afterwards.
*/
const DevQuickMenu = import.meta.env.DEV
  ? defineAsyncComponent(() => import('@/components/DevQuickMenu.vue'))
  : null

// DARK MODE

const dark = useDark()

// STORES

const commonStore = useCommonStore()
const flagsStore = useFlagsStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const i18n = useI18n({ useScope: 'global' })

// ROUTER

const router = useRouter()

// STATE

const state = reactive({
  isInitialized: false
})

// WATCHERS

watch(
  () => userStore.appearance,
  (newValue) => {
    if (newValue === 'site') {
      dark.set(siteStore.theme.dark)
    } else {
      dark.set(newValue === 'dark')
    }
  }
)

watch(
  () => userStore.cvd,
  () => {
    applyTheme()
  }
)

watch(() => commonStore.locale, applyLocale)

// LOCALE

async function applyLocale(locale) {
  if (!i18n.availableLocales.includes(locale)) {
    try {
      i18n.setLocaleMessage(locale, await commonStore.fetchLocaleStrings(locale))
    } catch (err) {
      notify({
        type: 'negative',
        message: `Failed to load ${locale} locale strings.`,
        caption: err.message
      })
    }
  }
  i18n.locale.value = locale
}

// THEME

async function applyTheme() {
  // -> Dark Mode
  if (userStore.appearance === 'site') {
    dark.set(siteStore.theme.dark)
  } else {
    dark.set(userStore.appearance === 'dark')
  }

  // -> CSS Vars
  setCssVar('primary', userStore.getAccessibleColor('primary', siteStore.theme.colorPrimary))
  setCssVar('secondary', userStore.getAccessibleColor('secondary', siteStore.theme.colorSecondary))
  setCssVar('accent', userStore.getAccessibleColor('accent', siteStore.theme.colorAccent))
  setCssVar('header', userStore.getAccessibleColor('header', siteStore.theme.colorHeader))
  setCssVar('sidebar', userStore.getAccessibleColor('sidebar', siteStore.theme.colorSidebar))
  setCssVar('positive', userStore.getAccessibleColor('positive', '#02C39A'))
  setCssVar('negative', userStore.getAccessibleColor('negative', '#f03a47'))

  // -> Highlight.js Theme
  await applyCodeBlocksTheme()
}

/**
 * Every highlight.js theme the admin area offers, as loaders that fetch one on demand.
 *
 * `?inline` hands back the stylesheet as a STRING rather than injecting it: these have to be scoped to
 * the page content before they are applied (see below), which cannot be done to a stylesheet the
 * bundler has already added to the document. `**` covers the `base16/` family, since that is how the
 * admin's list names half of its options.
 *
 * Only the theme in use is ever fetched; the rest sit in the build as assets nobody asks for.
 */
const HLJS_THEMES = import.meta.glob('../node_modules/highlight.js/styles/**/*.min.css', {
  query: '?inline',
  import: 'default'
})

/**
 * Paint code blocks in the theme chosen under Admin → Theme.
 *
 * The stylesheet is wrapped in `.page-contents { ... }` and applied through CSS nesting, for two
 * reasons: a highlight.js theme is written as bare `.hljs*` rules that would otherwise reach every
 * code sample in the interface, and nesting lifts its selectors to the same weight as the fallback
 * palette in `_page-contents.scss` -- so this one wins on being applied later, which is exactly the
 * relationship wanted. With no theme chosen, nothing is injected and that fallback is what shows.
 */
async function applyCodeBlocksTheme() {
  document.querySelector('#hljs-theme')?.remove()

  // -> A colour-vision-deficient palette cannot be honoured per theme, so it takes a neutral one
  const desiredHljsTheme = userStore.cvd !== 'none' ? 'github' : siteStore.theme.codeBlocksTheme
  if (!desiredHljsTheme) {
    return
  }

  const load = HLJS_THEMES[`../node_modules/highlight.js/styles/${desiredHljsTheme}.min.css`]
  if (!load) {
    // -> A name the admin area offers that highlight.js does not ship; the fallback palette stands in
    console.warn(`Unknown code blocks theme: ${desiredHljsTheme}`)
    return
  }

  const styleEl = document.createElement('style')
  styleEl.id = 'hljs-theme'
  styleEl.textContent = `.page-contents {\n${await load()}\n}`
  document.head.appendChild(styleEl)
}

// INIT SITE STORE

if (typeof siteConfig !== 'undefined') {
  siteStore.$patch({
    id: siteConfig.id,
    title: siteConfig.title
  })
  applyTheme()
}

/**
 * Everything the app has to know before it can draw: which site it is on, which system flags are set,
 * and who is asking.
 *
 * The three have endpoints of their own, and are still asked separately where they change on their
 * own — the admin area saves flags, a login changes who is asking. This is the load, where all three
 * are wanted at once and none of them is known yet.
 *
 * A failure leaves the stores at their defaults and says so in the console, which is what the three
 * calls did before: there is no interface yet to put an error in front of.
 */
async function loadBootstrap() {
  try {
    const data = await API_CLIENT.get('bootstrap', {
      searchParams: { hostname: window.location.hostname },
      cache: 'no-store'
    }).json()
    siteStore.applySiteInfo(data.site)
    flagsStore.apply(data.flags)
    userStore.applyProfile(data.user)
  } catch (err) {
    console.warn(`Could not load the site configuration: ${err.message}`)
  }
}

// ROUTE GUARDS

router.beforeEach(async (to, from) => {
  commonStore.routerLoading = true

  // -> Init Auth Token
  // if (userStore.token && !userStore.authenticated) {
  //   userStore.loadToken()
  // }

  /*
    -> Site info, system flags and the session
    One request for the three of them: none touches the database, so what they cost is the round trip,
    and a full load paid it three times over before it could draw anything. Asked once — a guest is an
    answer like any other, so this does not run again on the way to the next page.
  */
  if (!siteStore.id || !flagsStore.loaded || !userStore.profileLoaded) {
    await loadBootstrap()
  }

  // -> Locale
  if (
    !commonStore.desiredLocale ||
    !siteStore.locales.active.some((l) => l.code === commonStore.desiredLocale)
  ) {
    commonStore.setLocale(siteStore.locales.primary)
  }
  applyLocale(commonStore.desiredLocale)

  /*
    -> Page Permissions
    Not fetched here any more: what this reader may do at a path comes back with the page itself, so
    a page view is one request rather than two. What is left is the routes that are not a page —
    dropping the last page's permissions on the way out of the page view, which takes no request at
    all. A path with no page behind it has nothing to carry them, and asks in `pages/Index.vue`.
  */
  if (to.path.startsWith('/_')) {
    userStore.$patch({ pagePermissions: [] })
  }
})

// GLOBAL EVENTS HANDLERS

EVENT_BUS.on('logout', ({ redirect } = {}) => {
  const target = redirect || '/'
  // -> A group or the site can send logged out users to another site entirely, which the router cannot
  //    navigate to — and leaving the wiki means there is no point notifying anyone either
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(target)) {
    window.location.assign(target)
    return
  }
  router.push(target)
  notify({
    type: 'positive',
    icon: 'mdi:logout',
    message: i18n.t('auth.logoutSuccess')
  })
})
EVENT_BUS.on('applyTheme', () => {
  applyTheme()
})

// LOADER

router.afterEach(() => {
  if (!state.isInitialized) {
    state.isInitialized = true
    applyTheme()
    document.querySelector('.init-loading').remove()
  }
  commonStore.routerLoading = false
})
</script>
