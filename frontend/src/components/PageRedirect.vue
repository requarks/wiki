<template>
  <div class="page-placeholder">
    <!-- ----------------------- -->
    <!-- Nowhere to go -->
    <!-- ----------------------- -->
    <template v-if="problem">
      <w-icon class="page-placeholder-icon" name="la:exclamation-triangle" />
      <div class="text-h6">{{ t(`common.redirect.${problem}`) }}</div>
      <div class="text-body2 mt-1 opacity-60" v-if="canEditPage">
        {{ t('common.redirect.brokenHint') }}
      </div>
      <div class="text-caption font-robotomono mt-3 opacity-50" v-if="redirect.target">
        {{ redirect.target }}
      </div>
      <w-btn
        class="mt-6"
        v-if="canEditPage"
        unelevated
        icon="la:edit"
        color="primary"
        padding="xs lg"
        :label="t(`common.actions.edit`)"
        @click="editPage" />
    </template>
    <!-- ----------------------- -->
    <!-- Held, so the page can be worked on -->
    <!-- ----------------------- -->
    <template v-else-if="!following">
      <w-icon class="page-placeholder-icon" name="la:directions" />
      <div class="text-h6">{{ t('common.redirect.held') }}</div>
      <div class="text-caption font-robotomono mt-3 opacity-50">{{ redirect.target }}</div>
      <w-btn
        class="mt-6"
        unelevated
        icon="la:arrow-right"
        color="primary"
        padding="xs lg"
        :label="t(`common.redirect.follow`)"
        @click="follow" />
    </template>
    <!-- ----------------------- -->
    <!-- On the way -->
    <!-- ----------------------- -->
    <template v-else>
      <w-icon class="page-placeholder-icon" name="la:directions" />
      <!--
        `aria-live`, because nothing here is clicked: a reader on a screen reader is told where they
        are being taken at the moment the page announces it, not when they get around to reading it.
      -->
      <div class="text-h6" role="status" aria-live="polite">
        {{ t('common.redirect.redirectingTo', { target: redirect.target }) }}
      </div>
      <!-- -> The way out of a wait, and the way past it: a reader who does not want to sit through
              the notice can go now, and one who lands here with scripting half-loaded has a link -->
      <w-btn
        class="mt-6"
        unelevated
        icon="la:arrow-right"
        color="primary"
        padding="xs lg"
        :label="t(`common.redirect.goNow`)"
        @click="go" />
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { loading } from '@/composables/loading'

import { isFollowable, parseRedirect, REDIRECT_INTERSTITIAL_MS } from '@/helpers/pageRedirect'

import { usePageStore } from '@/stores/page'
import { useUserStore } from '@/stores/user'

/**
 * What the page view draws in place of an article for a page authored with the `redirect` editor.
 *
 * A redirection has no body: it sends its reader somewhere else, either straight away or after a
 * short notice saying where. See `helpers/pageRedirect.js` for what is stored, and
 * `EditorRedirect.vue` for where it is filled in.
 *
 * **`?redirect=no` holds it**, which is what makes a redirection maintainable: without it, a page
 * whose whole purpose is to bounce the reader elsewhere cannot be opened by the person who has to
 * fix it. The link a redirection's own screens hand out carries it, so following a chain of them
 * backwards keeps working.
 */

/**
 * How many redirections may be followed one after another before the chain is treated as a loop.
 *
 * `A → B → A` is a browser that never stops navigating, and no single page can see it: each one is
 * pointing somewhere perfectly reasonable. Only the count across them says otherwise. Generous enough
 * that a chain nobody meant to build still works, and small enough to stop before anything hangs.
 */
const MAX_HOPS = 5

/**
 * Redirections followed in a row. Deliberately outside the component, because that is the whole point:
 * the page view keeps this one component mounted from a redirection to the next, and the count is
 * about the chain rather than about any page in it. Reset the moment the chain ends — a page that is
 * read rather than followed unmounts this, and one held by `?redirect=no` is not being followed.
 */
let hops = 0

// STORES

const pageStore = usePageStore()
const userStore = useUserStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// DATA

/** The timer behind the interstitial. Cleared on the way out, so a page left early does not fire. */
let timer = null

/** Whether this page ends a chain that has gone on too long; see `MAX_HOPS`. */
const chainStopped = ref(false)

// COMPUTED

const redirect = computed(() => parseRedirect(pageStore.content))

/**
 * Why this redirection cannot be followed, if it cannot: nothing was filled in, it points at the page
 * it is on, or it is the last hop of a chain that has come back around. All three would leave a reader
 * bouncing rather than arriving.
 *
 * Doubles as the name of the string that says so.
 */
const problem = computed(() => {
  if (!isFollowable(redirect.value)) {
    return 'broken'
  }
  if (chainStopped.value) {
    return 'chain'
  }
  return redirect.value.kind === 'page' && isSelf(redirect.value.target) ? 'loop' : null
})

/**
 * Whether the reader is on their way, rather than being held.
 *
 * Two things hold a redirection. `?redirect=no` is the one a person asks for. The other is an editor
 * route: `/_edit/<path>` and `/_create/<editor>` load the page BEFORE they open the editor on it, and
 * in the gap between the two the page view is drawn for a page that is already known to be a
 * redirection — which would take the author to the target instead of showing them the form for it.
 * Nobody on those routes is reading the page, so nothing there is ever followed.
 */
const following = computed(
  () =>
    route.query.redirect !== 'no' &&
    !route.path.startsWith('/_edit') &&
    !route.path.startsWith('/_create')
)

/** Whoever can save the page is who the broken-redirection screen offers a way to fix it to. */
const canEditPage = computed(() =>
  ['write:pages', 'manage:pages'].some((permission) =>
    userStore.pagePermissions.includes(permission)
  )
)

// WATCHERS

/*
  Keyed on the page rather than run on mount: this component stays mounted from one redirection to the
  next -- the page view swaps the store's contents under it -- so a mount hook would fire for the
  first one only.

  `immediate`, because arriving at a redirection directly is the ordinary case.
*/
watch(
  () => [pageStore.id, redirect.value.target, following.value],
  () => {
    clear()
    if (!following.value) {
      // -> Held, so nothing is being followed and whatever came before it was not a chain
      hops = 0
      chainStopped.value = false
      return
    }
    if (problem.value) {
      return
    }
    /*
      Counted here rather than in `go`, so that the interstitial on the page that breaks the chain is
      never shown: it would say the reader is on their way somewhere they are about to be told they
      cannot go. A URL target leaves the app entirely, which ends any chain by itself.
    */
    if (redirect.value.kind === 'page' && ++hops > MAX_HOPS) {
      chainStopped.value = true
      return
    }
    if (!redirect.value.showInterstitial) {
      go()
      return
    }
    timer = setTimeout(go, REDIRECT_INTERSTITIAL_MS)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  clear()
  // -> Whatever comes next is read rather than followed, so the chain ends here
  hops = 0
})

// METHODS

function clear() {
  clearTimeout(timer)
  timer = null
}

/** Whether a page target is the page holding it, however the two are spelled. */
function isSelf(target) {
  const stored = `/${pageStore.path}`.replace(/\/+$/, '')
  const to = target.replace(/\/+$/, '').toLowerCase()
  return to === stored.toLowerCase() || (stored === '/home' && to === '')
}

/**
 * Take the reader on.
 *
 * `replace` rather than a push, both ways: a redirection is not somewhere anyone meant to be, and
 * leaving it in the history means the back button lands on it and bounces straight forward again.
 */
function go() {
  clear()
  if (problem.value) {
    return
  }
  if (redirect.value.kind === 'url') {
    // -> Leaving the app entirely, so the loading bar is what stands in for the wait
    loading.show()
    window.location.replace(redirect.value.target)
    return
  }
  router.replace(redirect.value.target)
}

/** Follow it deliberately, from the screen `?redirect=no` holds the reader on. */
function follow() {
  router.replace({ path: route.path, query: { ...route.query, redirect: undefined } })
}

function editPage() {
  router.push(`/_edit/${pageStore.path}`)
}
</script>
