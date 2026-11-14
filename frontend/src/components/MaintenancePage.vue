<template>
  <!--
    The whole window, in place of the app's own screens, drawn the way the login screen is: the site's
    login background behind everything, and on it a panel of the login sidebar's frosted black glass
    holding the logo, the banner's title and contents on a darker inset, and the way in. Always dark,
    as the login screen is -- `App.vue` pins the theme while this is up.
  -->
  <main class="maintenance-page relative flex min-h-screen items-center justify-center px-4 py-12">
    <div class="maintenance-page-bg" aria-hidden="true">
      <img src="/_site/current/loginBg" alt="" />
    </div>
    <div
      class="maintenance-page-panel relative z-[1] flex w-full max-w-3xl flex-col items-center gap-8 rounded-xl p-4 text-white sm:p-10">
      <!-- -> The site's title beside the logo, unless the site hides it (`logoText`), as the header does -->
      <div class="flex max-w-full items-center gap-4">
        <!--
          A fixed height rather than only a maximum, as the login screen and the header give it. The
          default logo is an SVG sized `100%` with no width of its own, which a maximum alone left at
          nothing while the row measured itself -- so the row came out a logo too narrow, and the
          title wrapped with the panel's whole width beside it. `object-contain` keeps a logo wider
          than the cap in proportion rather than squeezing it.
        -->
        <img
          class="maintenance-page-logo h-14 w-auto max-w-[240px] shrink-0 object-contain"
          src="/_site/current/logo"
          :alt="siteStore.logoText ? '' : siteStore.title" />
        <span
          v-if="siteStore.logoText"
          class="maintenance-page-title min-w-0 text-3xl font-bold leading-tight break-words">
          {{ siteStore.title }}
        </span>
      </div>
      <section
        class="w-full rounded-lg bg-black/30 p-5 sm:p-8"
        aria-labelledby="maintenance-page-title">
        <div class="flex items-start gap-4">
          <w-icon name="mdi:wrench-clock" size="36px" class="mt-0.5 shrink-0 text-warning" />
          <div class="min-w-0 flex-1">
            <h1 id="maintenance-page-title" class="text-2xl font-semibold leading-tight">
              {{ title }}
            </h1>
            <!--
              `page-contents` for the markdown, as the banner above a page draws it -- its own outer
              margins are zeroed below, so the contents sit under the title rather than a page-heading's
              distance from it.
            -->
            <div v-if="html" class="maintenance-page-contents page-contents mt-4" v-html="html" />
            <p v-else class="mt-4 text-grey-8 dark:text-grey-5">
              {{ t('common.maintenance.message') }}
            </p>
          </div>
        </div>
      </section>
      <!-- -> How a member of a bypass group gets recognised as one. Not shown once signed in. -->
      <w-btn
        v-if="!userStore.authenticated"
        unelevated
        no-caps
        color="primary"
        icon="mdi:login"
        :label="t('common.maintenance.login')"
        to="/login" />
    </div>
  </main>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMeta } from '@/composables/meta'
import { renderBannerMarkdown } from '@/helpers/bannerMarkdown'

import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

/**
 * What a site closed for maintenance (`restricted`) shows in place of every screen but the login, to
 * every reader the mode holds back. Mounted by `App.vue` instead of the router view, so none of the
 * screens behind it ever loads and asks the server for anything it would refuse.
 *
 * The banner's title and contents are the message: they are what an administrator closing the site
 * writes, under **Admin → General → Site-wide Banner / Maintenance**. Either left empty falls back to
 * a generic line, so a site closed in a hurry still says what is going on.
 */

// STORES

const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// DATA

const html = ref('')

/** Which render is the current one, so that a slower earlier import cannot land on top of a later. */
let generation = 0

// COMPUTED

const title = computed(() => siteStore.banner.title || t('common.maintenance.title'))

// META

useMeta(() => ({ title: title.value }))

// WATCHERS

watch(() => siteStore.banner.content, render, { immediate: true })

// METHODS

async function render(content) {
  const gen = ++generation
  const rendered = content ? await renderBannerMarkdown(content) : ''
  if (gen === generation) {
    html.value = rendered
  }
}
</script>

<style lang="scss">
.maintenance-page {
  /* -> What shows if the background image fails to load, as on the login screen */
  background-color: $dark-6;

  /* -> Behind the whole screen, so that the panel has something to blur */
  &-bg {
    position: absolute;
    inset: 0;
    overflow: hidden;

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      margin: 0;
      padding: 0;
    }
  }

  /*
    The login sidebar's glass (`.auth-content` in `pages/Login.vue`, dark): the same black at the same
    opacity, blurred so the image's detail does not fight what is written on it.
  */
  &-panel {
    background-color: rgba($dark-6, 0.8);
    backdrop-filter: blur(24px) saturate(180%);
  }

  /* -> The login screen's site title, in its dark colour: this panel is dark in both themes */
  &-title {
    color: $blue-grey-1;
  }
}

/*
  Not scoped: the contents are written by `v-html`, which scoped styles do not reach. Two classes so
  that these out-weigh `.page-contents > :first-child` and friends.
*/
.maintenance-page-contents.page-contents {
  > :first-child {
    margin-top: 0;
  }

  > :last-child {
    margin-bottom: 0;
  }
}
</style>
