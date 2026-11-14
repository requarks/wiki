<template>
  <!--
    A translucent black band across the whole width of the window, in both themes -- hence
    `w-dark-surface`, which is what gives the buttons on it their dark-mode rendering regardless of
    the app theme.
  -->
  <section
    v-if="isShown"
    class="cookie-consent w-dark-surface fixed inset-x-0 bottom-0 z-[5000] bg-black/80 text-white backdrop-blur-sm"
    role="region"
    :aria-label="t('common.cookieConsent.title')">
    <div
      class="mx-auto flex max-w-screen-lg flex-wrap items-center gap-x-6 gap-y-3 px-4 py-5 sm:flex-nowrap">
      <div class="flex min-w-0 flex-1 flex-nowrap items-center gap-3">
        <w-icon name="la:cookie-bite" size="28px" class="shrink-0" />
        <div class="cookie-consent-message min-w-0" v-html="html" />
      </div>
      <div class="ml-auto flex shrink-0 flex-nowrap items-center gap-2">
        <template v-if="siteStore.hasAnalytics">
          <w-btn
            outline
            no-caps
            color="white"
            :label="t('common.cookieConsent.necessaryOnly')"
            @click="setConsent('necessary')" />
          <w-btn
            unelevated
            no-caps
            color="primary"
            :label="t('common.cookieConsent.acceptAll')"
            @click="setConsent('all')" />
        </template>
        <w-btn
          v-else
          unelevated
          no-caps
          color="primary"
          :label="t('common.cookieConsent.acknowledge')"
          @click="setConsent('acknowledged')" />
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { consent, consentPromptReopened, setConsent } from '@/composables/cookieConsent'

import { useSiteStore } from '@/stores/site'

/**
 * The site's cookie consent banner, along the bottom of the window until the reader answers it.
 *
 * Turned on per site under Admin → General. What it offers depends on whether the site serves any
 * analytics (`siteStore.hasAnalytics`): with none, there is nothing to choose — the wiki sets only its
 * strictly necessary session cookie — so the reader acknowledges the message; with some, they choose
 * between necessary cookies only and necessary plus tracking. The answer is a cookie the server reads
 * to decide whether to serve the tags at all (see `composables/cookieConsent.js`), so declining is
 * what keeps the scripts from ever loading rather than a request to them to behave.
 *
 * The message is markdown, rendered the way the site banner's is (`SiteBanner.vue`): markdown-it with
 * `html` off, imported only once there is a message to show.
 */

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

let md = null

/** Which render is the current one, so that a slower earlier import cannot land on top of a later. */
let generation = 0

const html = ref('')

// COMPUTED

/**
 * Whether the reader still owes an answer: none yet, or a mere acknowledgement from before the site
 * had any tracking to ask about — or they asked to see it again.
 */
const isShown = computed(() => {
  if (!siteStore.id || !siteStore.cookieConsent.isEnabled) {
    return false
  }
  return (
    consentPromptReopened.value ||
    consent.value === null ||
    (siteStore.hasAnalytics && consent.value === 'acknowledged')
  )
})

// WATCHERS

watch(() => [isShown.value, siteStore.cookieConsent.message], render, { immediate: true })

// METHODS

async function render() {
  const gen = ++generation
  const message = siteStore.cookieConsent.message
  if (!isShown.value || !message) {
    html.value = ''
    return
  }
  md ??= new (await import('markdown-it')).default({
    html: false,
    linkify: true,
    breaks: true
  })
  if (gen === generation) {
    html.value = md.render(message)
  }
}
</script>

<style scoped>
.cookie-consent-message {
  line-height: 1.5;
}

.cookie-consent-message :deep(p) {
  margin: 0 0 0.5em;
}

.cookie-consent-message :deep(> :last-child) {
  margin-bottom: 0;
}

/* -> White like the rest of the text, told apart by the underline alone: the band is black in both themes */
.cookie-consent-message :deep(a) {
  color: inherit;
  text-decoration: underline;
}
</style>
