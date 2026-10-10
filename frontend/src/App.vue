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
import { loginLocation, redirectTargetOr } from '@/helpers/loginRedirect'
import { isPagePath, splitLocalePath, stripPageExtension } from '@/helpers/pagePaths'
import { useDark } from '@/composables/dark'
import { notify } from '@/composables/notify'

import WDialogHost from '@/components/shared/WDialogHost.vue'
import WLoadingOverlay from '@/components/shared/WLoadingOverlay.vue'
import WNotifications from '@/components/shared/WNotifications.vue'

import { useAuthConfigStore } from '@/stores/authConfig'
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

const authConfigStore = useAuthConfigStore()
const commonStore = useCommonStore()
const flagsStore = useFlagsStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const i18n = useI18n({ useScope: 'global' })

// ROUTER

const router = useRouter()
const route = useRoute()

// STATE

const state = reactive({
  isInitialized: false
})

/** Set by a logout on its way out, for the document it lands on to report. */
const LOGOUT_NOTICE_KEY = 'wiki.logoutNotice'

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

watch(isAdminArea, () => {
  applyTheme()
})

watch(
  () => [userStore.reduceMotion, userStore.underlineLinks, userStore.contentTextSize],
  applyAccessibility,
  { immediate: true }
)

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
  /*
    The document says what language it is in too, not just the strings in it. `index.html` ships
    `lang="en"` because that is all a static shell can say, and it stayed that way however the
    interface was switched -- so a French page announced itself as English to a screen reader, and to
    anything else reading the document for its language.
  */
  document.documentElement.lang = locale
}

// ACCESSIBILITY

/*
  The reader's own accessibility settings (Profile -> Info), as classes on <body> -- the same element
  `body--dark` is on, and for the same reason: it is above everything, teleported dialogs and menus
  included. What each class does is next to the styles it changes: `css/_animation.scss` for motion,
  `css/_page-contents.scss` for links and text size.
*/
function applyAccessibility() {
  const classes = document.body.classList
  classes.toggle('body--reduce-motion', userStore.reduceMotion)
  classes.toggle('body--underline-links', userStore.underlineLinks)
  classes.toggle('body--text-large', userStore.contentTextSize === 'large')
  classes.toggle('body--text-larger', userStore.contentTextSize === 'larger')
}

// THEME

/*
  The admin area is drawn in the wiki's own colours, not the site's. Its header and sidebar already
  are, and a site theme was only ever chosen for reading that site -- a pale or clashing primary made
  the admin controls hard to read, including on the very Theme screen that set it. These are the
  defaults a new site starts with (`backend/models/sites.ts`). The colour vision setting still applies
  on top, since that is the reader's need rather than the site's.
*/
const ADMIN_COLORS = {
  primary: '#1976D2',
  secondary: '#02C39A',
  accent: '#FF9800'
}

function isAdminArea() {
  return route.path === '/_admin' || route.path.startsWith('/_admin/')
}

async function applyTheme() {
  // -> Dark Mode
  if (userStore.appearance === 'site') {
    dark.set(siteStore.theme.dark)
  } else {
    dark.set(userStore.appearance === 'dark')
  }

  // -> CSS Vars
  const brand = isAdminArea()
    ? ADMIN_COLORS
    : {
        primary: siteStore.theme.colorPrimary,
        secondary: siteStore.theme.colorSecondary,
        accent: siteStore.theme.colorAccent
      }
  setCssVar('primary', userStore.getAccessibleColor('primary', brand.primary))
  setCssVar('secondary', userStore.getAccessibleColor('secondary', brand.secondary))
  setCssVar('accent', userStore.getAccessibleColor('accent', brand.accent))
  setCssVar('header', userStore.getAccessibleColor('header', siteStore.theme.colorHeader))
  setCssVar('sidebar', userStore.getAccessibleColor('sidebar', siteStore.theme.colorSidebar))
  setCssVar('positive', userStore.getAccessibleColor('positive', '#02C39A'))
  setCssVar('negative', userStore.getAccessibleColor('negative', '#f03a47'))

  // -> Highlight.js Theme
  await applyCodeBlocksTheme()

  // -> CSS Override. Last, so that it is the last stylesheet in the document
  applyCssOverride()
}

/**
 * The CSS override from Admin → Theme, as its own element at the end of the head.
 *
 * The server already puts this element into the document it serves, so a reader never sees the wiki
 * unstyled while the bundle loads — see `themeInjections` in `backend/helpers/appShell.ts`, and note
 * that the id is shared with it. This is the same element written again from the site store, which is
 * what makes the field take effect the moment it is saved rather than on the next hard navigation; the
 * server's copy is removed first, so there is never more than one of it.
 *
 * Applied after the code blocks theme for the reason the admin area states: an override goes after the
 * wiki's own styles. Both are appended to the head, so the last one appended is the one that wins.
 *
 * The head and body HTML injections have no counterpart here, on purpose. They are usually a `<script>`
 * — an analytics snippet, a tag manager — and a copy of one the document has already run would run it a
 * second time. Those two belong to the document and apply when it is next loaded.
 */
function applyCssOverride() {
  document.querySelector('#theme-css-override')?.remove()

  const css = siteStore.theme.injectCSS?.trim()
  if (!css) {
    return
  }

  const styleEl = document.createElement('style')
  styleEl.id = 'theme-css-override'
  styleEl.textContent = css
  document.head.appendChild(styleEl)
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
    // -> Before the site: `applySiteInfo` resolves the site's active locale codes against this
    siteStore.installedLocales = data.locales ?? []
    siteStore.applySiteInfo(data.site)
    flagsStore.apply(data.flags)
    authConfigStore.apply(data.auth)
    userStore.applyProfile(data.user)
  } catch (err) {
    console.warn(`Could not load the site configuration: ${err.message}`)
  }
}

// ROUTE GUARDS

router.beforeEach(async (to, from) => {
  commonStore.routerLoading = true

  /*
    -> Site info, system flags and the session
    One request for the three of them: none touches the database, so what they cost is the round trip,
    and a full load paid it three times over before it could draw anything. Asked once — a guest is an
    answer like any other, so this does not run again on the way to the next page.
  */
  if (!siteStore.id || !flagsStore.loaded || !userStore.profileLoaded) {
    await loadBootstrap()
  }

  /*
    -> Bypass Unauthorized Screen
    A site can skip the unauthorized screen for a visitor who is not logged in, sending them to sign
    in instead -- for a wiki closed to the public that screen is a dead end with a login button on it.
    Here rather than in the error page, so the screen is never drawn on the way past it. Below the
    bootstrap above, since that is where both the setting and the session come from.

    Only when nobody is logged in: somebody who IS signed in and still refused has nothing to gain
    from the login screen, and gets the error page as usual.

    Where they were refused is what the login sends them back to afterwards, in place of the site's
    and the groups' login redirects -- see `helpers/loginRedirect.js`.
  */
  if (
    to.path === '/_error/unauthorized' &&
    siteStore.auth.bypassUnauthorized &&
    !userStore.authenticated
  ) {
    // -> Only a page the reader actually reached: a direct load of the error URL has none
    const refused =
      from.matched.length > 0 && !from.path.startsWith('/_error') ? from.fullPath : null
    return { ...loginLocation(refused), replace: true }
  }

  /*
    -> Page extensions
    A path ending in one of the extensions the site's content is written in addresses the page
    underneath it, so `/foo/bar.md` is `/foo/bar`. The server redirects a request that reaches it, but
    a link inside a page is followed by the router alone -- which is what this is for. Below the
    bootstrap above, since that is where the site's extensions come from. A `/_` route is the app
    itself rather than a page, and is left alone as it is by the server.
  */
  const isPage = isPagePath(to.path)
  const withoutExtension = isPage ? stripPageExtension(to.path, siteStore.pageExtensions) : null
  if (withoutExtension) {
    return { path: withoutExtension, query: to.query, hash: to.hash, replace: true }
  }

  /*
    -> Locale prefix
    A site that brackets its URLs by locale sends a path arriving without one to its primary locale, so
    that every page has a single address. The server does this for a request that reaches it; this is
    the same rule for a link inside a page, which the router follows on its own. The prefix is the
    locale's short code -- `/fr` for `fr-FR` -- the same segment its content is filed under.
  */
  if (
    isPage &&
    siteStore.locales.forcePrefix &&
    !splitLocalePath(to.path, siteStore.localePrefixes)
  ) {
    const primary = siteStore.localeAlias(siteStore.locales.primary)
    return {
      path: `/${primary}${to.path === '/' ? '' : to.path}`,
      query: to.query,
      hash: to.hash,
      replace: true
    }
  }

  /*
    -> Locale
    On a page, the interface speaks whatever the page is written in -- the prefix in the URL when
    there is one, and the site's PRIMARY locale when there is not, because that is what an unprefixed
    path resolves to. Falling back to the stored choice instead is what left `/` showing the English
    home page with a French interface and French in the picker, after a detour through `/fr/...`.

    It replaces the stored choice rather than shadowing it, which is what carries the switch on to a
    screen with no locale in its path: the admin area and the profile are not pages, and keep it. The
    site's primary is also the fallback for a first visit, and for a stored locale the site no longer
    offers.
  */
  const pageLocale = isPage
    ? (splitLocalePath(to.path, siteStore.localePrefixes)?.locale ?? siteStore.locales.primary)
    : null
  if (pageLocale) {
    if (pageLocale !== commonStore.desiredLocale) {
      commonStore.setLocale(pageLocale)
    }
  } else if (
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
  if (!isPagePath(to.path)) {
    userStore.$patch({ pagePermissions: [] })
  }
})

// GLOBAL EVENTS HANDLERS

/*
  Where a logout goes: the provider's own logout when the strategy has one, otherwise the first group's
  logout redirect, otherwise the site's -- the server's answer, see the logout route.

  Always a full load, never a router push. Everything the app holds was fetched as the user who just
  left: the page on screen, which a guest may not be allowed to read, and every store that caches what
  this session may do. A push to the path already showing is no navigation at all, which is what left
  a reader logging out from the home page looking at the same page, still drawn for an account.
*/
EVENT_BUS.on('logout', ({ redirect } = {}) => {
  const target = redirectTargetOr(redirect)
  // -> Said once the next document has booted, since this one is about to be discarded. Not for a
  //    target that leaves the wiki, where there is nobody to say it to; a lost notice is harmless
  if (target.startsWith('/')) {
    try {
      sessionStorage.setItem(LOGOUT_NOTICE_KEY, '1')
    } catch {}
  }
  window.location.assign(target)
})

EVENT_BUS.on('applyTheme', () => {
  applyTheme()
})

/** Report a logout the previous document made, if it made one. */
function showLogoutNotice() {
  let pending = false
  try {
    pending = sessionStorage.getItem(LOGOUT_NOTICE_KEY) === '1'
    sessionStorage.removeItem(LOGOUT_NOTICE_KEY)
  } catch {}
  if (pending) {
    notify({
      type: 'positive',
      icon: 'mdi:logout',
      message: i18n.t('auth.logoutSuccess')
    })
  }
}

// LOADER

router.afterEach(() => {
  if (!state.isInitialized) {
    state.isInitialized = true
    applyTheme()
    document.querySelector('.init-loading').remove()
    showLogoutNotice()
  }
  commonStore.routerLoading = false
})
</script>
