<template>
  <div class="unsubscribe">
    <div class="unsubscribe-card">
      <div class="unsubscribe-logo">
        <img :src="`/_site/current/logo`" :alt="siteStore.title" />
      </div>
      <h1 class="text-h6 mb-2">{{ t('unsubscribe.title') }}</h1>

      <template v-if="state.status === 'loading'">
        <w-spinner size="32px" color="primary" />
      </template>

      <template v-else-if="state.status === 'invalid'">
        <p class="text-body2">{{ t('unsubscribe.invalid') }}</p>
        <div class="unsubscribe-actions">
          <w-btn
            unelevated
            color="primary"
            :label="t(`unsubscribe.manage`)"
            @click="goToSettings" />
        </div>
      </template>

      <template v-else-if="state.status === 'done'">
        <p class="text-body2">
          {{ state.scope === 'all' ? t('unsubscribe.doneAll') : t('unsubscribe.done') }}
        </p>
        <div class="unsubscribe-actions">
          <w-btn flat color="primary" :label="t(`unsubscribe.manage`)" @click="goToSettings" />
          <w-btn unelevated color="primary" :label="t(`unsubscribe.backToWiki`)" to="/" />
        </div>
      </template>

      <!--
        The page that asks. Nothing has happened by the time it is drawn: a mail scanner following the
        link gets this far and no further, which is the reason it exists.
      -->
      <template v-else>
        <p class="text-body2">{{ t('unsubscribe.intro') }}</p>
        <ul class="unsubscribe-list text-body2">
          <li v-for="category of state.categories" :key="category">
            {{ t(`notifications.categories.${category}.title`) }}
          </li>
        </ul>
        <p class="text-caption opacity-70">{{ t('unsubscribe.inAppStays') }}</p>
        <div class="unsubscribe-actions">
          <w-btn
            flat
            color="negative"
            :label="t(`unsubscribe.all`)"
            :disable="state.busy"
            @click="unsubscribe('all')" />
          <w-btn
            unelevated
            color="primary"
            :label="t(`unsubscribe.confirm`)"
            :loading="state.busy"
            @click="unsubscribe('token')" />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'

import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

/**
 * Where an unsubscribe link in a notification email lands — the one in the mail body, and the one in
 * the `List-Unsubscribe` header when it is opened rather than posted.
 *
 * It asks before it acts. A mail client's own unsubscribe button posts to the API directly and is done
 * (RFC 8058); this page is for a person who clicked, and for the scanners that fetch every link in a
 * message, which must not unsubscribe anybody by doing so. No session is needed: the token in the URL
 * says whose email it is, and all it can do is turn that email off.
 */

// ROUTER

const route = useRoute()
const router = useRouter()

// STORES

const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// META

useMeta(() => ({
  title: t('unsubscribe.title')
}))

// DATA

const state = reactive({
  /** `loading`, `ready`, `invalid` or `done`. */
  status: 'loading',
  categories: [],
  scope: 'token',
  busy: false
})

// METHODS

async function load() {
  try {
    const info = await API_CLIENT.get('notifications/unsubscribe/info', {
      searchParams: { t: route.query.t ?? '' }
    }).json()
    state.categories = info.categories ?? []
    state.status = info.valid ? 'ready' : 'invalid'
  } catch {
    state.status = 'invalid'
  }
}

async function unsubscribe(scope) {
  state.busy = true
  try {
    await API_CLIENT.post('notifications/unsubscribe', {
      json: { t: route.query.t ?? '', scope }
    })
    state.scope = scope
    state.status = 'done'
  } catch (err) {
    notify({
      type: 'negative',
      message: t('unsubscribe.failed'),
      caption: apiErrorMessage(err)
    })
  }
  state.busy = false
}

/** The full settings, which need a session — the login screen comes first for somebody without one. */
function goToSettings() {
  router.push(userStore.authenticated ? '/_profile/notifications' : '/login')
}

// MOUNTED

onMounted(load)
</script>

<style lang="scss" scoped>
.unsubscribe {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background-color: $grey-2;
  color: var(--color-black);

  @at-root .body--dark & {
    background-color: $dark-6;
    color: var(--color-white);
  }

  &-card {
    width: 100%;
    max-width: 480px;
    padding: 32px;
    border-radius: 8px;
    background-color: #fff;
    box-shadow: $shadow-2;

    @at-root .body--dark & {
      background-color: $dark-3;
    }
  }

  &-logo {
    margin-bottom: 16px;

    img {
      height: 48px;
    }
  }

  &-list {
    margin: 12px 0;
    padding-inline-start: 20px;
    list-style: disc;
  }

  &-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 24px;
  }
}
</style>
