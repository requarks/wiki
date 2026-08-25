<template>
  <w-page class="admin-login">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img
          class="admin-icon animated fadeInLeft"
          src="/_assets/icons/fluent-bunch-of-keys-animated.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 admin-page-title animated fadeInLeft">{{ t('admin.login.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.login.subtitle') }}
        </div>
      </div>
      <div class="flex-none">
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/auth`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:redo-alt"
          flat
          color="secondary"
          :loading="state.loading > 0"
          :aria-label="t(`common.actions.refresh`)"
          @click="load">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
        <w-btn
          unelevated
          icon="mdi:check"
          :label="t(`common.actions.apply`)"
          color="secondary"
          @click="save"
          :disabled="state.loading > 0" />
      </div>
    </div>
    <w-separator inset />
    <div class="grid grid-cols-12 p-4 gap-4">
      <div class="col-span-12 lg:col-span-6">
        <!-- ----------------------- -->
        <!-- Experience -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>{{ t('admin.login.experience') }}</w-card-header>
          <w-item>
            <blueprint-icon
              class="self-start"
              icon="full-image"
              indicator
              :indicator-text="t(`admin.extensions.requiresSharp`)" />
            <w-item-section>
              <div class="flex">
                <w-item-section>
                  <w-item-label>{{ t(`admin.login.background`) }}</w-item-label>
                  <w-item-label caption>{{ t(`admin.login.backgroundHint`) }}</w-item-label>
                </w-item-section>
                <w-item-section class="flex-none">
                  <div class="flex gap-2">
                    <w-btn
                      :label="t(`common.actions.upload`)"
                      unelevated
                      icon="la:upload"
                      color="primary"
                      text-color="white"
                      @click="uploadBg" />
                    <w-btn
                      :label="t(`common.actions.clear`)"
                      outline
                      icon="la:times"
                      color="primary"
                      :disable="!state.hasBg"
                      @click="clearBg" />
                  </div>
                </w-item-section>
              </div>
              <img
                v-if="adminStore.currentSiteId"
                class="admin-login-bg mt-4"
                :src="`/_site/` + adminStore.currentSiteId + `/loginBg?` + state.assetTimestamp"
                :alt="t(`admin.login.background`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="close-pane" />
            <w-item-section>
              <w-item-label>{{ t(`admin.login.bypassScreen`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.login.bypassScreenHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.autoLogin"
                :aria-label="t(`admin.login.bypassScreen`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="no-access" />
            <w-item-section>
              <w-item-label>{{ t(`admin.login.bypassUnauthorized`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.login.bypassUnauthorizedHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.bypassUnauthorized"
                :aria-label="t(`admin.login.bypassUnauthorized`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="double-right" />
            <w-item-section>
              <w-item-label>{{ t(`admin.login.loginRedirect`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.login.loginRedirectHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-input
                outlined
                v-model="state.config.loginRedirect"
                dense
                :rules="[
                  (val) =>
                    state.invalidCharsRegex.test(val) || t('admin.login.loginRedirectInvalidChars')
                ]"
                hide-bottom-space
                :aria-label="t(`admin.login.loginRedirect`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="chevron-right" />
            <w-item-section>
              <w-item-label>{{ t(`admin.login.welcomeRedirect`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.login.welcomeRedirectHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-input
                outlined
                v-model="state.config.welcomeRedirect"
                dense
                :rules="[
                  (val) =>
                    state.invalidCharsRegex.test(val) ||
                    t('admin.login.welcomeRedirectInvalidChars')
                ]"
                hide-bottom-space
                :aria-label="t(`admin.login.welcomeRedirect`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="exit" />
            <w-item-section>
              <w-item-label>{{ t(`admin.login.logoutRedirect`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.login.logoutRedirectHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-input
                outlined
                v-model="state.config.logoutRedirect"
                dense
                :rules="[
                  (val) =>
                    state.invalidCharsRegex.test(val) || t('admin.login.logoutRedirectInvalidChars')
                ]"
                hide-bottom-space
                :aria-label="t(`admin.login.logoutRedirect`)" />
            </w-item-section>
          </w-item>
        </w-card>
      </div>
      <div class="col-span-12 lg:col-span-6">
        <!-- ----------------------- -->
        <!-- Providers -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>{{ t('admin.login.providers') }}</w-card-header>
          <w-card-section class="admin-login-providers pt-0">
            <sortable
              :list="state.providers"
              item-key="id"
              :options="sortableOptions"
              @end="updateAuthPosition">
              <template #item="{ element }">
                <w-item>
                  <w-item-section side>
                    <w-icon class="handle" name="mdi:drag-horizontal" />
                  </w-item-section>
                  <w-item-section side>
                    <w-icon :name="`img:` + element.activeStrategy.strategy.icon" />
                  </w-item-section>
                  <w-item-section>
                    <w-item-label>{{ element.activeStrategy.displayName }}</w-item-label>
                    <w-item-label caption>{{ element.activeStrategy.strategy.title }}</w-item-label>
                  </w-item-section>
                  <w-item-section side>
                    <w-toggle
                      v-model="element.isVisible"
                      label="Visible"
                      :aria-label="element.activeStrategy.displayName" />
                  </w-item-section>
                </w-item>
              </template>
            </sortable>
          </w-card-section>
          <w-item class="pt-0">
            <w-item-section>
              <w-card class="bg-info text-white rounded" flat>
                <w-card-section class="items-center" horizontal>
                  <w-card-section class="flex-none pr-0">
                    <w-icon name="la:info-circle" size="lg" />
                  </w-card-section>
                  <w-card-section class="text-caption">{{
                    t('admin.login.providersVisbleWarning')
                  }}</w-card-section>
                </w-card-section>
              </w-card>
            </w-item-section>
          </w-item>
        </w-card>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { onMounted, reactive, watch } from 'vue'

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'

import {
  clearSiteImage,
  isAcceptedSiteImage,
  pickSiteImage,
  uploadSiteImage
} from '@/helpers/siteImages'

import { toMerged } from 'es-toolkit/object'
import { Sortable } from 'sortablejs-vue3'

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.login.title')
})

// DATA

/**
 * Fallbacks for keys a site may not have stored yet, so that every control renders with a defined
 * value. Must mirror the `auth` defaults used by the backend when creating a site.
 */
function defaultConfig() {
  return {
    autoLogin: false,
    bypassUnauthorized: false,
    hideLocal: false,
    loginRedirect: '/',
    welcomeRedirect: '/',
    logoutRedirect: '/'
  }
}

const state = reactive({
  invalidCharsRegex: /^[^<>"]+$/,
  loading: 0,
  config: defaultConfig(),
  providers: [],
  // -> Whether this site has a background of its own, i.e. whether there is anything to clear. The
  //    preview always renders: without one it shows the default the login page falls back to.
  hasBg: false,
  assetTimestamp: new Date().toISOString()
})

const sortableOptions = {
  handle: '.handle',
  animation: 150
}

// WATCHERS

watch(
  () => adminStore.currentSiteId,
  (newValue) => {
    load()
  }
)

// METHODS

async function load() {
  state.loading++
  loading.show()
  try {
    const [site, providers] = await Promise.all([
      API_CLIENT.get(`sites/${adminStore.currentSiteId}?strict=true`).json(),
      API_CLIENT.get(`sites/${adminStore.currentSiteId}/auth/strategies`, {
        searchParams: { visibleOnly: false }
      }).json()
    ])
    state.config = toMerged(defaultConfig(), site?.auth ?? {})
    state.providers = providers ?? []
    state.hasBg = site?.assets?.loginBg ?? false
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.login.loadFailed'),
      caption: err.message
    })
  }
  loading.hide()
  state.loading--
}

async function save() {
  state.loading++
  try {
    const resp = await API_CLIENT.put(`sites/${adminStore.currentSiteId}`, {
      json: {
        auth: {
          autoLogin: state.config.autoLogin ?? false,
          bypassUnauthorized: state.config.bypassUnauthorized ?? false,
          hideLocal: state.config.hideLocal ?? false,
          loginRedirect: state.config.loginRedirect ?? '/',
          welcomeRedirect: state.config.welcomeRedirect ?? '/',
          logoutRedirect: state.config.logoutRedirect ?? '/'
        },
        // -> Order comes from the current position in the drag-sortable list
        authStrategies: state.providers.map((provider, index) => ({
          id: provider.id,
          order: index,
          isVisible: provider.isVisible ?? false
        }))
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(
        t(`admin.login.${resp?.error}`, resp?.message || 'An unexpected error occured.')
      )
    }
    notify({
      type: 'positive',
      message: t('admin.login.saveSuccess')
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: 'Failed to save login configuration.',
      caption: err.message
    })
  }
  state.loading--
}

function updateAuthPosition(ev) {
  const item = state.providers.splice(ev.oldIndex, 1)[0]
  state.providers.splice(ev.newIndex, 0, item)
}

async function uploadBg() {
  const file = await pickSiteImage()
  if (!file) {
    return
  }
  if (!isAcceptedSiteImage(file)) {
    notify({
      type: 'negative',
      message: t('admin.login.bgUploadFailed'),
      caption: t('admin.login.bgUploadInvalidType')
    })
    return
  }
  state.loading++
  try {
    await uploadSiteImage(adminStore.currentSiteId, 'loginBg', file)
    notify({
      type: 'positive',
      message: t('admin.login.bgUploadSuccess')
    })
    state.hasBg = true
    state.assetTimestamp = new Date().toISOString()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.login.bgUploadFailed'),
      caption: err.message
    })
  }
  state.loading--
}

async function clearBg() {
  state.loading++
  try {
    await clearSiteImage(adminStore.currentSiteId, 'loginBg')
    notify({
      type: 'positive',
      message: t('admin.login.bgClearSuccess')
    })
    state.hasBg = false
    state.assetTimestamp = new Date().toISOString()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.login.bgClearFailed'),
      caption: err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(() => {
  if (adminStore.currentSiteId) {
    load()
  }
})
</script>

<style lang="scss">
.admin-login-bg {
  width: 100%;
  height: 140px;
  object-fit: cover;
  border-radius: 5px;
}

.admin-login-providers {
  .w-item {
    border-radius: 5px;

    @at-root .body--light & {
      background-color: $grey-2;
    }
    @at-root .body--dark & {
      background-color: $dark-5;
    }

    & + .w-item {
      margin-top: 8px;
    }
  }

  .handle {
    cursor: ns-resize;
  }
}
</style>
