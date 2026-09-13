<template>
  <w-page class="admin-analytics">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-bar-chart.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 admin-page-title animated fadeInLeft">
          {{ t('admin.analytics.title') }}
        </div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.analytics.subtitle') }}
        </div>
      </div>
      <div class="flex-none flex items-center">
        <w-spinner class="mr-4" v-show="state.loading > 0" color="accent" size="sm" />
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/analytics`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          unelevated
          icon="mdi:check"
          :label="t(`common.actions.apply`)"
          color="secondary"
          @click="save"
          :loading="state.loading > 0" />
      </div>
    </div>
    <w-separator inset />
    <!--
      The same shape as the storage and authentication screens: a list as wide as it needs to be, the
      panel taking what is left, and the panel wrapping onto its own row rather than narrowing for
      ever. The explicit floors are what make the wrapping real -- see the note in `AdminStorage.vue`.
    -->
    <div class="flex flex-wrap p-4 gap-4">
      <div class="flex-none">
        <w-card class="rounded bg-dark">
          <w-list style="min-width: 300px" padding dark>
            <w-item
              v-for="prv of state.providers"
              :key="prv.key"
              active-class="bg-primary text-white"
              :active="state.selectedProvider === prv.key"
              :to="`/_admin/` + adminStore.currentSiteId + `/analytics/` + prv.key"
              clickable>
              <w-item-section side><w-icon :name="`img:` + prv.icon" /></w-item-section>
              <w-item-section>
                <w-item-label>{{ prv.title }}</w-item-label>
                <w-item-label caption :class="subtitleColor(prv)">{{
                  providerState(prv).label
                }}</w-item-label>
              </w-item-section>
              <w-item-section side>
                <status-light :color="providerState(prv).light" :pulse="providerState(prv).pulse" />
              </w-item-section>
            </w-item>
          </w-list>
        </w-card>
      </div>
      <div class="flex-1" style="min-width: min(480px, 100%)" v-if="state.provider">
        <div class="flex flex-wrap gap-4">
          <div class="flex-1" style="min-width: min(420px, 100%)">
            <!-- ----------------------- -->
            <!-- Provider Configuration -->
            <!-- ----------------------- -->
            <w-card class="pb-2">
              <w-card-header>{{ t('admin.analytics.providerConfiguration') }}</w-card-header>
              <w-item tag="label">
                <blueprint-icon class="self-start" icon="shutdown" />
                <w-item-section>
                  <w-item-label>{{ t(`admin.analytics.enabled`) }}</w-item-label>
                  <w-item-label caption>{{ t(`admin.analytics.enabledHint`) }}</w-item-label>
                  <!-- -> Only while it is actually true of the form in front of the reader: a
                       provider is turned on and then filled in, and saying so before either has
                       happened would be scolding somebody for not having finished yet. -->
                  <w-item-label class="text-deep-orange" v-if="missingLabels.length > 0" caption>
                    {{ t('admin.analytics.missingFields', { fields: missingLabels.join(', ') }) }}
                  </w-item-label>
                </w-item-section>
                <w-item-section avatar>
                  <w-toggle
                    v-model="state.provider.isEnabled"
                    :aria-label="t(`admin.analytics.enabled`)" />
                </w-item-section>
              </w-item>
              <!--
                The condition belongs on the section rather than on the text inside it: a section is
                a padded band whether or not anything renders in it, so an unconditional one would
                leave 32px of empty space under the toggle on every provider that does have props.
              -->
              <w-card-section
                v-if="!state.provider.config || Object.keys(state.provider.config).length < 1">
                <div class="text-body2 text-grey">
                  {{ t('admin.analytics.providerNoConfiguration') }}
                </div>
              </w-card-section>
              <template v-for="(cfg, cfgKey) in state.provider.config" :key="cfgKey">
                <w-separator class="my-2" inset />
                <w-item v-if="cfg.type === `boolean`" tag="label">
                  <blueprint-icon class="self-start" :icon="cfg.icon" />
                  <w-item-section>
                    <w-item-label>{{ cfg.title }}</w-item-label>
                    <w-item-label caption>{{ cfg.hint }}</w-item-label>
                  </w-item-section>
                  <w-item-section avatar>
                    <w-toggle v-model="cfg.value" :aria-label="cfg.title" />
                  </w-item-section>
                </w-item>
                <w-item v-else>
                  <blueprint-icon class="self-start" :icon="cfg.icon" />
                  <w-item-section>
                    <w-item-label>{{ cfg.title }}</w-item-label>
                    <w-item-label caption>{{ cfg.hint }}</w-item-label>
                  </w-item-section>
                  <w-item-section :style="cfg.type === `number` ? `flex: 0 0 150px;` : ``">
                    <w-select
                      v-if="cfg.enum"
                      outlined
                      v-model="cfg.value"
                      :options="cfg.enum"
                      emit-value
                      map-options
                      dense
                      options-dense
                      :aria-label="cfg.title" />
                    <!-- -> `no-autofill` on every field, as on the other two module forms: a
                         password manager offers to fill whatever LOOKS like an account field, and a
                         tracking ID beside a server URL is exactly that shape. -->
                    <w-input
                      v-else
                      outlined
                      v-model="cfg.value"
                      dense
                      no-autofill
                      :type="cfg.type === `number` ? `number` : `text`"
                      :aria-label="cfg.title" />
                  </w-item-section>
                </w-item>
              </template>
              <!-- -> Only once there is more than one tag going out, which is the situation it
                   describes. A wiki with a single provider on has nothing to double-count. -->
              <w-card-section v-if="activeCount > 1">
                <w-banner
                  :class="dark.isActive ? `bg-orange-9 text-white` : `bg-orange-1 text-orange-9`">
                  {{ t('admin.analytics.multipleWarn') }}
                </w-banner>
              </w-card-section>
            </w-card>
          </div>
          <div class="flex-none" style="width: 300px">
            <!-- ----------------------- -->
            <!-- Infobox -->
            <!-- ----------------------- -->
            <w-card class="rounded">
              <w-card-section class="text-center">
                <!-- -> The module's own icon, the same one the list on the left draws it with, so a
                     provider looks the same wherever this screen shows it -->
                <w-icon :name="`img:` + state.provider.icon" size="100px" />
                <div class="text-subtitle2 mt-2">{{ state.provider.title }}</div>
                <div class="text-caption mt-2">{{ state.provider.description }}</div>
              </w-card-section>
            </w-card>
            <w-btn
              v-if="state.provider.website"
              class="w-full mt-4 acrylic-btn"
              icon="la:external-link-alt"
              flat
              color="primary"
              :label="t(`admin.analytics.website`)"
              :href="state.provider.website"
              target="_blank"
              rel="noopener" />
          </div>
        </div>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, nextTick, onMounted, reactive, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'

import { apiErrorMessage } from '@/helpers/apiError'

// COMPOSABLES

const dark = useDark()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// META

useMeta(() => ({
  title: t('admin.analytics.title')
}))

// DATA

const state = reactive({
  loading: 0,
  selectedProvider: '',
  desiredProvider: '',
  provider: null,
  providers: []
})

// COMPUTED

/**
 * The titles of the selected provider's required fields that are still empty.
 *
 * Read off the form rather than off what the server last sent, so that filling the last empty field
 * clears the warning as it is typed. The server asks the same question of the stored values before it
 * renders anything — an enabled provider missing one of these contributes no tag at all, which is the
 * whole reason this is worth saying on the screen.
 */
const missingLabels = computed(() => {
  const provider = state.provider
  if (!provider?.isEnabled) {
    return []
  }
  return (provider.requires ?? [])
    .filter((key) => `${provider.config?.[key]?.value ?? ''}`.trim().length < 1)
    .map((key) => provider.config?.[key]?.title ?? key)
})

/** How many providers the form has turned on, which is what decides the double-counting warning. */
const activeCount = computed(() => state.providers.filter((prv) => prv.isEnabled).length)

// WATCHERS

watch(
  () => adminStore.currentSiteId,
  async (newValue) => {
    await load()
    nextTick(() => {
      router.replace(`/_admin/${newValue}/analytics/${state.selectedProvider}`)
    })
  }
)
watch(
  () => state.selectedProvider,
  (newValue) => {
    state.provider = state.providers.find((prv) => prv.key === newValue) || null
  }
)
watch(
  () => state.providers,
  (newValue) => {
    if (newValue && newValue.length > 0) {
      if (state.desiredProvider) {
        state.selectedProvider = state.desiredProvider
        state.desiredProvider = ''
      } else if (newValue.some((prv) => prv.key === state.selectedProvider)) {
        // -> Keep the current selection across a reload, since saving reloads the providers
        state.provider = newValue.find((prv) => prv.key === state.selectedProvider)
      } else {
        state.selectedProvider = newValue[0].key
        if (!route.params.id) {
          router.replace(`/_admin/${adminStore.currentSiteId}/analytics/${state.selectedProvider}`)
        }
      }
    }
  }
)
watch(
  () => route.params.id,
  (to) => {
    if (!to) {
      return
    }
    if (state.providers.length < 1) {
      state.desiredProvider = to
    } else {
      state.selectedProvider = to
    }
  }
)

// METHODS

/**
 * What a provider is doing, in the order the two questions matter.
 *
 * Turned off first, since nothing else about it applies. Then whether it has what it needs: a
 * provider with an empty tracking ID is not collecting less, it is collecting nothing — the server
 * skips it rather than serving a tag pointed at no account — so it gets the amber light that means
 * "go and look at this one" here and on the storage screen.
 */
function providerState(prv) {
  if (!prv.isEnabled) {
    return { label: t('admin.analytics.inactive'), light: 'negative', pulse: false }
  }
  const missing = (prv.requires ?? []).some(
    (key) => `${prv.config?.[key]?.value ?? ''}`.trim().length < 1
  )
  if (missing) {
    return { label: t('admin.analytics.incomplete'), light: 'warning', pulse: true }
  }
  return { label: t('admin.analytics.active'), light: 'positive', pulse: true }
}

function subtitleColor(prv) {
  if (state.selectedProvider === prv.key) {
    return 'text-blue-2'
  } else if (prv.isEnabled) {
    return 'text-positive'
  } else {
    return 'text-grey-7'
  }
}

/**
 * Turn a module prop declaration and its stored value into the shape the config editor renders,
 * expanding `value|label` enum entries into options.
 */
function buildConfigEditor(props, values) {
  const config = {}
  for (const [key, prop] of Object.entries(props ?? {})) {
    config[key] = {
      ...prop,
      value: values?.[key] ?? prop.default,
      ...(prop.enum && {
        enum: prop.enum.map((entry) => {
          const [value, label] = entry.split('|')
          return { value, label: label ?? value }
        })
      })
    }
  }
  return config
}

async function load() {
  state.loading++
  loading.show()
  try {
    const resp = await API_CLIENT.get(`sites/${adminStore.currentSiteId}/analytics`).json()
    state.providers = (resp?.providers ?? []).map((prv) => ({
      ...prv,
      config: buildConfigEditor(prv.props, prv.config)
    }))
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.analytics.loadFailed'),
      caption: apiErrorMessage(err),
      timeout: 20000
    })
  }
  loading.hide()
  state.loading--
}

/** A provider as the API expects it. Read-only props are left out — the server keeps what it holds. */
function payloadFor(prv) {
  const config = {}
  for (const [key, cfg] of Object.entries(prv.config ?? {})) {
    if (cfg.readOnly) {
      continue
    }
    config[key] = cfg.type === 'number' ? Number(cfg.value) : cfg.value
  }
  return {
    key: prv.key,
    isEnabled: prv.isEnabled,
    config
  }
}

/**
 * Save every provider at once, the way the API takes it.
 *
 * All of them rather than the selected one: they are one setting between them — the tags that go out
 * with every page — and a screen that saved only what was on it would quietly discard whatever was
 * changed on another provider before switching.
 */
async function save() {
  state.loading++
  loading.show()
  try {
    const resp = await API_CLIENT.put(`sites/${adminStore.currentSiteId}/analytics`, {
      json: {
        providers: state.providers.map(payloadFor)
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('admin.analytics.saveSuccess')
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.analytics.saveFailed'),
      caption: apiErrorMessage(err)
    })
  }
  loading.hide()
  state.loading--
}

// MOUNTED

onMounted(() => {
  if (!state.selectedProvider && route.params.id) {
    state.desiredProvider = route.params.id
  }
  if (adminStore.currentSiteId) {
    load()
  }
})
</script>
