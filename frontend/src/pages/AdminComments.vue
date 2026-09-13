<template>
  <w-page class="admin-comments">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-comments.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 admin-page-title animated fadeInLeft">
          {{ t('admin.comments.title') }}
        </div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.comments.subtitle') }}
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
          :href="siteStore.docsBase + `/admin/comments`"
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
      The same shape as the storage and analytics screens: a list as wide as it needs to be, the panel
      taking what is left, and the panel wrapping onto its own row rather than narrowing for ever. The
      explicit floors are what make the wrapping real -- see the note in `AdminStorage.vue`.
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
              :to="`/_admin/` + adminStore.currentSiteId + `/comments/` + prv.key"
              clickable>
              <!--
                Which provider is in use, and the only control that sets it. `.stop.prevent` because
                the row itself is a link to that provider's settings: without them the click would
                reach the anchor and navigate, and `.stop` alone would leave the browser to follow
                the href as a full page load -- router-link's own handler having been cut off.

                Choosing is separate from looking, which is why the radio is here rather than in the
                panel: comparing two providers means opening each in turn, and a screen where that
                also switched the live one would be a trap.

                White on the row being LOOKED at, which is the one filled with `bg-primary`: a
                selected radio draws itself in its colour, so the default primary would be a blue
                dot inside a blue ring on a blue row -- invisible on exactly the row most likely to
                be both.
              -->
              <w-item-section side>
                <w-radio
                  dark
                  :model-value="state.selected"
                  :val="prv.key"
                  :color="state.selectedProvider === prv.key ? `white` : `primary`"
                  :aria-label="t(`admin.comments.useProvider`, { provider: prv.title })"
                  @click.stop.prevent="selectProvider(prv.key)" />
              </w-item-section>
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
              <w-card-header>{{ t('admin.comments.providerConfiguration') }}</w-card-header>
              <!--
                The condition belongs on the section rather than on the text inside it: a section is
                a padded band whether or not anything renders in it, so an unconditional one would
                leave 32px of empty space under the toggle on every provider that does have props.
              -->
              <w-card-section
                v-if="!state.provider.config || Object.keys(state.provider.config).length < 1">
                <div class="text-body2 text-grey">
                  {{ t('admin.comments.providerNoConfiguration') }}
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
                    <!-- -> `no-autofill` on every field, as on the other module forms: a password
                         manager offers to fill whatever LOOKS like an account field, and an API key
                         beside a server URL is exactly that shape. -->
                    <w-input
                      v-else
                      outlined
                      v-model="cfg.value"
                      dense
                      no-autofill
                      :type="inputTypeFor(cfg)"
                      :revealable="cfg.sensitive"
                      :aria-label="cfg.title" />
                  </w-item-section>
                </w-item>
              </template>
              <!--
                Two states worth saying out loud, and the site-wide one first because it overrules
                the other: picking a provider here does nothing at all while comments are switched
                off under General, and an administrator who has just done so is owed that sentence
                rather than a screen that looks saved and changes nothing.
              -->
              <w-card-section v-if="!state.isAllowed">
                <w-banner
                  :class="dark.isActive ? `bg-orange-9 text-white` : `bg-orange-1 text-orange-9`">
                  {{ t('admin.comments.disabledWarn') }}
                </w-banner>
              </w-card-section>
              <!-- -> Only of the provider actually in use, and only once a required field is
                   genuinely empty: a provider is chosen and then filled in, and saying this before
                   either has happened would be scolding somebody for not having finished yet. -->
              <w-card-section v-else-if="missingLabels.length > 0">
                <w-banner
                  :class="dark.isActive ? `bg-orange-9 text-white` : `bg-orange-1 text-orange-9`">
                  {{ t('admin.comments.missingFields', { fields: missingLabels.join(', ') }) }}
                </w-banner>
              </w-card-section>
              <!--
                No provider in use at all. Not something this screen can produce any more -- the
                radios have no "none" -- but a stored key stops resolving when its module is dropped
                from the installation, and a site in that state has no comments anywhere.
              -->
              <w-card-section v-else-if="!state.selected">
                <w-banner
                  :class="dark.isActive ? `bg-orange-9 text-white` : `bg-orange-1 text-orange-9`">
                  {{ t('admin.comments.noneWarn') }}
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
              <w-separator />
              <!--
                What using this provider means for the wiki, which is the one thing that genuinely
                differs between the two kinds and is not obvious from the settings: whether the page
                rules govern the discussion, or whether somebody else's service does.
              -->
              <w-card-section>
                <div class="text-caption">
                  {{
                    state.provider.isBuiltIn
                      ? t('admin.comments.builtInInfo')
                      : t('admin.comments.thirdPartyInfo')
                  }}
                </div>
              </w-card-section>
            </w-card>
            <w-btn
              v-if="state.provider.website"
              class="w-full mt-4 acrylic-btn"
              icon="la:external-link-alt"
              flat
              color="primary"
              :label="t(`admin.comments.website`)"
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

/**
 * Admin > Comments: which provider this site's discussions are handled by.
 *
 * Laid out as the storage and analytics screens are -- providers on the left, the configuration in
 * the middle, what the provider is on the right -- and differs from them in one way that shapes the
 * whole screen: **only one provider is in use at a time**. Two analytics tags count the same visit
 * twice, which is a mistake to warn about; two comment widgets are two separate discussions of the
 * same page, and neither of them is the discussion.
 *
 * So the toggle is a choice rather than a switch, and `state.selected` -- the one that is in use --
 * is separate from `state.selectedProvider`, which is merely the one being looked at.
 *
 * The configuration of the providers that are not in use is kept and saved all the same, so that
 * trying another one and coming back finds a form still filled in.
 */

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
  title: t('admin.comments.title')
}))

// DATA

const state = reactive({
  loading: 0,
  /** The provider whose settings are on screen. */
  selectedProvider: '',
  desiredProvider: '',
  /** The provider the site uses, which is what the toggle sets. Empty means none is in use. */
  selected: '',
  /** Whether the site allows comments at all, which is the switch under General → Features. */
  isAllowed: true,
  provider: null,
  providers: []
})

// COMPUTED

/**
 * The titles of the selected provider's required fields that are still empty.
 *
 * Read off the form rather than off what the server last sent, so that filling the last empty field
 * clears the warning as it is typed. The server asks the same question of the stored values before it
 * tells a browser anything: a provider in use but missing one of these is served as no provider at
 * all, which is the whole reason this is worth saying on the screen.
 */
const missingLabels = computed(() => {
  const provider = state.provider
  if (!provider || state.selected !== provider.key) {
    return []
  }
  return (provider.requires ?? [])
    .filter((key) => `${provider.config?.[key]?.value ?? ''}`.trim().length < 1)
    .map((key) => provider.config?.[key]?.title ?? key)
})

// WATCHERS

watch(
  () => adminStore.currentSiteId,
  async (newValue) => {
    await load()
    nextTick(() => {
      router.replace(`/_admin/${newValue}/comments/${state.selectedProvider}`)
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
          router.replace(`/_admin/${adminStore.currentSiteId}/comments/${state.selectedProvider}`)
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
 * Not in use first, since nothing else about it applies. Then whether it has what it needs: a
 * provider missing a required field shows nothing at all rather than showing less -- the server
 * skips it -- so it gets the amber light that means "go and look at this one" here and on the
 * storage and analytics screens.
 */
function providerState(prv) {
  if (state.selected !== prv.key) {
    return { label: t('admin.comments.inactive'), light: 'negative', pulse: false }
  }
  const missing = (prv.requires ?? []).some(
    (key) => `${prv.config?.[key]?.value ?? ''}`.trim().length < 1
  )
  if (missing) {
    return { label: t('admin.comments.incomplete'), light: 'warning', pulse: true }
  }
  return { label: t('admin.comments.active'), light: 'positive', pulse: true }
}

function subtitleColor(prv) {
  if (state.selectedProvider === prv.key) {
    return 'text-blue-2'
  } else if (state.selected === prv.key) {
    return 'text-positive'
  } else {
    return 'text-grey-7'
  }
}

/**
 * The field a prop is edited in.
 *
 * A sensitive prop gets a password field with a reveal, so that an API key is not read over
 * somebody's shoulder from an admin screen -- and the value in it is the mask until it is typed over,
 * since the server never sends a stored secret back out.
 */
function inputTypeFor(cfg) {
  if (cfg.sensitive) {
    return 'password'
  }
  return cfg.type === 'number' ? 'number' : 'text'
}

/**
 * Put a provider in use, which is the same act as taking whichever one was in use out of it.
 *
 * Only changes what is SELECTED, not what is on screen: the row's own link does that, and a radio
 * that also navigated would make comparing two providers impossible without switching the live one.
 */
function selectProvider(key) {
  state.selected = key
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
    const resp = await API_CLIENT.get(`sites/${adminStore.currentSiteId}/comments`).json()
    state.selected = resp?.provider ?? ''
    state.isAllowed = resp?.isAllowed !== false
    state.providers = (resp?.providers ?? []).map((prv) => ({
      ...prv,
      config: buildConfigEditor(prv.props, prv.config)
    }))
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.comments.loadFailed'),
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
  return { key: prv.key, config }
}

/**
 * Save the selection and every provider's settings at once.
 *
 * All of them rather than the one on screen: switching providers to compare two of them is exactly
 * what this screen is for, and a save that took only the visible one would quietly discard whatever
 * was typed into the other before the switch.
 *
 * A sensitive value goes back up as the mask it came down as, which the server reads as "leave it as
 * it is" -- so saving this screen never overwrites a stored key with dots.
 */
async function save() {
  state.loading++
  loading.show()
  try {
    const resp = await API_CLIENT.put(`sites/${adminStore.currentSiteId}/comments`, {
      json: {
        provider: state.selected,
        providers: state.providers.map(payloadFor)
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('admin.comments.saveSuccess')
    })
    await load()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.comments.saveFailed'),
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
