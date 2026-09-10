<template>
  <w-page class="admin-auth">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-security-lock.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 admin-page-title animated fadeInLeft">{{ t('admin.auth.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.auth.subtitle') }}
        </div>
      </div>
      <div class="flex-none flex items-center">
        <w-btn-toggle
          class="mr-4"
          v-model="state.displayMode"
          push
          no-caps
          :toggle-color="dark.isActive ? `white` : `black`"
          :toggle-text-color="dark.isActive ? `black` : `white`"
          :text-color="dark.isActive ? `white` : `black`"
          :color="dark.isActive ? `dark-1` : `white`"
          :options="[
            { label: t('admin.auth.strategies'), value: 'strategies' },
            { label: t('admin.auth.config'), value: 'config' }
          ]" />
        <w-separator class="mr-4" vertical />
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
          @click="refresh">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
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
    <!-- ========================================== -->
    <!-- STRATEGIES -->
    <!-- ========================================== -->
    <!--
      The same shape the storage view uses for a list beside what it selects: the list is as wide as
      it needs to be and the panel takes what is left, wrapping onto its own row when there is no room
      for both. A 12-column grid cannot say that -- the list is 350px, not some number of twelfths --
      which is how this ended up with the panel on `col-span-full`, i.e. underneath.
    -->
    <div class="flex flex-wrap p-4 gap-4" v-if="state.displayMode === `strategies`">
      <div class="flex-none">
        <w-card class="rounded bg-dark">
          <w-list style="min-width: 350px" padding dark>
            <w-item
              v-for="str of state.activeStrategies"
              :key="str.id"
              active-class="bg-primary text-white"
              :active="state.selectedStrategy === str.id"
              @click="state.selectedStrategy = str.id"
              clickable>
              <w-item-section side><w-icon :name="`img:` + str.strategy.icon" /></w-item-section>
              <w-item-section>
                <w-item-label>{{ str.displayName }}</w-item-label>
                <w-item-label caption>{{ str.strategy.title }}</w-item-label>
              </w-item-section>
              <!--
                Its own section rather than sharing the light's: the light is `height: 100%` against
                whatever contains it, and a wrapper sized to its own content is not the row.
              -->
              <w-item-section side v-if="str.isNew">
                <!-- -> Nothing on the server answers to this one yet; Apply is what creates it -->
                <w-badge color="warning" rounded>{{ t('admin.auth.unsaved') }}</w-badge>
              </w-item-section>
              <w-item-section side>
                <status-light
                  :color="str.isEnabled ? `positive` : `negative`"
                  :pulse="str.isEnabled" />
              </w-item-section>
            </w-item>
          </w-list>
        </w-card>
        <!--
          Always shown, rather than only with the experimental flag on: adding a strategy is what this
          screen is for once a wiki has more than the built-in local one, and a button that is not
          there cannot say that none of the installed modules is addable. The menu says it instead.
        -->
        <w-btn
          class="mt-2 w-full"
          color="primary"
          icon="la:plus"
          :label="t(`admin.auth.addStrategy`)">
          <w-menu auto-close fit max-width="300px">
            <w-list separator>
              <!-- -> The local module is filtered out: it is already configured, and a second copy
                   of it holds no credentials -->
              <w-item v-if="availableStrategies.length < 1">
                <w-item-section>
                  <w-item-label caption>{{ t('admin.auth.noModulesToAdd') }}</w-item-label>
                </w-item-section>
              </w-item>
              <w-item
                v-for="str of availableStrategies"
                :key="str.key"
                clickable
                @click="addStrategy(str)">
                <w-item-section avatar>
                  <w-avatar rounded color="dark" text-color="white">
                    <w-icon :name="`img:` + str.icon" />
                  </w-avatar>
                </w-item-section>
                <w-item-section>
                  <w-item-label
                    ><strong>{{ str.title }}</strong></w-item-label
                  >
                  <w-item-label caption lines="2">{{ str.description }}</w-item-label>
                </w-item-section>
              </w-item>
            </w-list>
          </w-menu>
        </w-btn>
      </div>
      <!--
        `min(480px, 100%)` rather than `min-w-0`, and the same reasoning applies to the settings
        column inside: a flex item defaults to `min-width: auto`, i.e. its own min-content, so a long
        value in a field would push the panel wider than the row -- which is what `min-w-0` was for.
        But zero is a floor that never stops it shrinking, and `flex-wrap` only wraps once an item
        cannot fit at its minimum, so nothing ever wrapped: the panel just went on narrowing until
        the settings were a squeezed strip beside a full-width info column. An explicit length is
        also a floor, so it replaces `min-w-0` for the overflow it was preventing, and the `min(...,
        100%)` keeps that promise on a screen narrower than the floor itself.
      -->
      <div class="flex-1" style="min-width: min(480px, 100%)" v-if="state.strategy.id">
        <!--
          The settings and the infobox beside them, the same shape as the list and this panel
          above: the infobox is 300px wide and the settings take what is left, and the infobox drops
          onto its own row once there is no longer room for both.
        -->
        <div class="flex flex-wrap gap-4">
          <div class="flex-1" style="min-width: min(420px, 100%)">
            <w-card class="pb-2">
              <w-card-header>{{ t('admin.auth.info') }}</w-card-header>
              <w-item>
                <blueprint-icon icon="information" />
                <w-item-section>
                  <w-item-label>{{ t(`admin.auth.infoName`) }}</w-item-label>
                  <w-item-label caption>{{ t(`admin.auth.infoNameHint`) }}</w-item-label>
                </w-item-section>
                <w-item-section>
                  <w-input
                    outlined
                    v-model="state.strategy.displayName"
                    dense
                    hide-bottom-space
                    :aria-label="t(`admin.auth.infoName`)" />
                </w-item-section>
              </w-item>
              <w-separator class="my-2" inset />
              <w-item tag="label">
                <blueprint-icon icon="shutdown" top />
                <w-item-section>
                  <w-item-label>{{ t(`admin.auth.enabled`) }}</w-item-label>
                  <w-item-label caption>{{ t(`admin.auth.enabledHint`) }}</w-item-label>
                  <w-item-label class="text-deep-orange" v-if="isBuiltInLocal" caption>{{
                    t(`admin.auth.enabledForced`)
                  }}</w-item-label>
                  <w-item-label class="text-deep-orange" caption>{{
                    t(`admin.auth.enabledSiteHint`)
                  }}</w-item-label>
                </w-item-section>
                <w-item-section avatar>
                  <w-toggle
                    v-model="state.strategy.isEnabled"
                    :disable="isBuiltInLocal"
                    :aria-label="t(`admin.auth.enabled`)" />
                </w-item-section>
              </w-item>
              <w-separator class="my-2" inset />
              <w-item tag="label">
                <blueprint-icon icon="register" />
                <w-item-section>
                  <w-item-label>{{ t(`admin.auth.registration`) }}</w-item-label>
                  <w-item-label caption>{{
                    state.strategy.strategy.key === `local`
                      ? t(`admin.auth.registrationLocalHint`)
                      : t(`admin.auth.registrationHint`)
                  }}</w-item-label>
                </w-item-section>
                <w-item-section avatar>
                  <w-toggle
                    v-model="state.strategy.registration"
                    :aria-label="t(`admin.auth.registration`)" />
                </w-item-section>
              </w-item>
              <template v-if="state.strategy.registration">
                <w-separator class="my-2" inset />
                <w-item>
                  <blueprint-icon icon="team" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.auth.autoEnrollGroups`) }}</w-item-label>
                    <w-item-label caption>{{ t(`admin.auth.autoEnrollGroupsHint`) }}</w-item-label>
                  </w-item-section>
                  <w-item-section>
                    <w-select
                      outlined
                      :options="state.groups"
                      v-model="state.strategy.autoEnrollGroups"
                      multiple
                      map-options
                      emit-value
                      option-value="id"
                      option-label="name"
                      options-dense
                      dense
                      hide-bottom-space
                      :aria-label="t(`admin.users.groups`)"
                      :loading="state.loadingGroups">
                      <template #selected>
                        <div
                          class="text-caption"
                          v-if="state.strategy.autoEnrollGroups?.length > 1">
                          <i18n-t keypath="admin.users.groupsSelected">
                            <template #count>
                              <strong>{{ state.strategy.autoEnrollGroups?.length }}</strong>
                            </template>
                          </i18n-t>
                        </div>
                        <div
                          class="text-caption"
                          v-else-if="state.strategy.autoEnrollGroups?.length === 1">
                          <i18n-t keypath="admin.users.groupSelected">
                            <template #group
                              ><strong>{{ selectedGroupName }}</strong></template
                            >
                          </i18n-t>
                        </div>
                        <span v-else />
                      </template>
                      <template #option="{ itemProps, opt, selected, toggleOption }">
                        <w-item v-bind="itemProps">
                          <w-item-section side>
                            <w-checkbox
                              size="sm"
                              :model-value="selected"
                              @update:model-value="toggleOption(opt)" />
                          </w-item-section>
                          <w-item-section
                            ><w-item-label>{{ opt.name }}</w-item-label></w-item-section
                          >
                        </w-item>
                      </template>
                    </w-select>
                  </w-item-section>
                </w-item>
                <w-separator class="my-2" inset />
                <w-item>
                  <blueprint-icon icon="private" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.auth.allowedEmailRegex`) }}</w-item-label>
                    <w-item-label caption>{{ t(`admin.auth.allowedEmailRegexHint`) }}</w-item-label>
                  </w-item-section>
                  <w-item-section>
                    <w-input
                      outlined
                      v-model="state.strategy.allowedEmailRegex"
                      dense
                      hide-bottom-space
                      :aria-label="t(`admin.auth.allowedEmailRegex`)"
                      prefix="/"
                      suffix="/" />
                  </w-item-section>
                </w-item>
              </template>
            </w-card>
            <!-- ----------------------- -->
            <!-- Configuration -->
            <!-- ----------------------- -->
            <w-card class="pb-2 mt-4">
              <w-card-header>{{ t('admin.auth.strategyConfiguration') }}</w-card-header>
              <w-card-section>
                <w-banner
                  class="mt-4"
                  v-if="!state.strategy.config || Object.keys(state.strategy.config).length < 1"
                  :class="dark.isActive ? `bg-dark-4 text-grey-5` : `bg-grey-2 text-grey-7`">
                  <em>{{ t('admin.auth.noConfigOption') }}</em>
                </w-banner>
              </w-card-section>
              <template v-for="(cfg, cfgKey, idx) in state.strategy.config">
                <template v-if="configIfCheck(cfg.if)">
                  <w-separator class="my-2" inset v-if="idx > 0" />
                  <w-item v-if="cfg.type === `boolean`" :tag="cfg.readOnly ? `div` : `label`">
                    <blueprint-icon :icon="cfg.icon" :hue-rotate="cfg.readOnly ? -45 : 0" />
                    <w-item-section>
                      <w-item-label>{{ cfg.title }}</w-item-label>
                      <w-item-label :class="cfg.readOnly ? `text-orange` : ``" caption>{{
                        cfg.hint
                      }}</w-item-label>
                    </w-item-section>
                    <w-item-section avatar>
                      <w-toggle
                        v-model="cfg.value"
                        :aria-label="cfg.title"
                        :disable="cfg.readOnly" />
                    </w-item-section>
                  </w-item>
                  <w-item v-else>
                    <blueprint-icon :icon="cfg.icon" :hue-rotate="cfg.readOnly ? -45 : 0" />
                    <w-item-section>
                      <w-item-label>{{ cfg.title }}</w-item-label>
                      <w-item-label :class="cfg.readOnly ? `text-orange` : ``" caption>{{
                        cfg.hint
                      }}</w-item-label>
                    </w-item-section>
                    <w-item-section
                      :style="cfg.type === `number` ? `flex: 0 0 150px;` : ``"
                      :class="{ 'col-auto': cfg.enum && cfg.enumDisplay === `buttons` }">
                      <w-btn-toggle
                        v-if="cfg.enum && cfg.enumDisplay === `buttons`"
                        v-model="cfg.value"
                        push
                        glossy
                        no-caps
                        toggle-color="primary"
                        :options="cfg.enum"
                        :disable="cfg.readOnly" />
                      <w-select
                        v-else-if="cfg.enum"
                        outlined
                        v-model="cfg.value"
                        :options="cfg.enum"
                        emit-value
                        map-options
                        dense
                        options-dense
                        :aria-label="cfg.title"
                        :disable="cfg.readOnly" />
                      <!-- -> `no-autofill` on every prop a strategy declares, not only the sensitive
                           ones: a manager offers to fill whatever LOOKS like a credential, and a
                           client ID or an issuer URL beside a secret is exactly that shape. What is
                           typed here is the wiki's credential with an identity provider, never the
                           operator's own. -->
                      <w-input
                        v-else
                        outlined
                        v-model="cfg.value"
                        dense
                        no-autofill
                        :type="inputTypeFor(cfg)"
                        :aria-label="cfg.title"
                        :disable="cfg.readOnly"
                        @focus="(ev) => selectStoredSecret(ev, cfg)" />
                    </w-item-section>
                  </w-item>
                </template>
              </template>
            </w-card>
            <!-- ----------------------- -->
            <!-- References -->
            <!-- ----------------------- -->
            <w-card class="pb-2 mt-4" v-if="strategyRefs.length > 0">
              <w-card-header>
                {{ t('admin.auth.configReference') }}
                <template #hint>{{ t('admin.auth.configReferenceSubtitle') }}</template>
              </w-card-header>
              <w-item v-for="strRef of strategyRefs" :key="strRef.key">
                <blueprint-icon :icon="strRef.icon" :hue-rotate="-45" />
                <w-item-section>
                  <w-item-label>{{ strRef.title }}</w-item-label>
                  <w-item-label caption>{{ strRef.hint }}</w-item-label>
                </w-item-section>
                <w-item-section>
                  <!--
                    These carry the strategy's ID, which the server assigns — so until Apply has created
                    it there is no URL to register with the provider, and showing one built from the
                    placeholder ID would be showing the wrong one.
                  -->
                  <w-item-label v-if="state.strategy.isNew" caption>
                    {{ t('admin.auth.refAfterSave') }}
                  </w-item-label>
                  <w-input
                    v-else
                    outlined
                    v-model="strRef.value"
                    dense
                    :aria-label="strRef.title"
                    readonly />
                </w-item-section>
              </w-item>
            </w-card>
          </div>
          <div class="flex-none" style="width: 300px">
            <!-- ----------------------- -->
            <!-- Infobox -->
            <!-- ----------------------- -->
            <w-card class="rounded">
              <w-card-section class="text-center">
                <!-- -> The module's own icon, the same one the list on the left draws it with, so
                     a strategy looks the same wherever this screen shows it -->
                <w-icon :name="`img:` + state.strategy.strategy.icon" size="100px" />
                <div class="text-subtitle2 mt-2">{{ state.strategy.strategy.title }}</div>
                <div class="text-caption mt-2">{{ state.strategy.strategy.description }}</div>
              </w-card-section>
            </w-card>
            <!-- -> Absent rather than disabled on the built-in local strategy: every account's
                 password is registered against it, so deleting it is not a thing that can be done -->
            <w-btn
              v-if="!isBuiltInLocal"
              class="w-full mt-4 acrylic-btn"
              icon="la:trash-alt"
              flat
              color="negative"
              :label="t(`admin.auth.deleteStrategy`)"
              @click="confirmDelete" />
            <!-- -> An unsaved strategy holds a local `new:` placeholder, not the ID the server
                 assigns on Apply, so showing it would be showing the wrong one -->
            <div
              v-if="!state.strategy.isNew"
              class="text-caption text-grey mt-4 text-center break-all">
              ID: {{ state.strategy.id }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- ========================================== -->
    <!-- CONFIGURATION -->
    <!-- ========================================== -->
    <div class="flex flex-wrap p-4 gap-4" v-if="state.displayMode === `config`">
      <div class="min-w-0 flex-1">
        <w-card class="pb-2">
          <w-card-header>
            {{ t('admin.auth.config') }}
            <template #hint>{{ t('admin.auth.configHint') }}</template>
          </w-card-header>
          <w-item tag="label">
            <blueprint-icon class="self-start" icon="fingerprint-scan" />
            <w-item-section>
              <w-item-label>{{ t(`admin.auth.allowPasskeys`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.auth.allowPasskeysHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.allowPasskeys"
                :aria-label="t(`admin.auth.allowPasskeys`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon class="self-start" icon="administrator-male" />
            <w-item-section>
              <w-item-label>{{ t(`admin.auth.allowProfileEditing`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.auth.allowProfileEditingHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.allowProfileEditing"
                :aria-label="t(`admin.auth.allowProfileEditing`)" />
            </w-item-section>
          </w-item>
        </w-card>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, reactive, watch } from 'vue'
import { v4 as uuid } from 'uuid'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'
import { confirm } from '@/composables/dialog'

import { useAuthConfigStore } from '@/stores/authConfig'
import { useSiteStore } from '@/stores/site'
import { apiErrorMessage } from '@/helpers/apiError'

// COMPOSABLES

const dark = useDark()

// STORES

const authConfigStore = useAuthConfigStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta(() => ({
  title: t('admin.auth.title')
}))

// CONSTANTS

const GUESTS_GROUP_ID = '10000000-0000-4000-8000-000000000001'
// -> The strategy every account's password is stored against, hence the one that cannot be disabled
//    or deleted. A second instance of the local module is an ordinary strategy.
const BUILTIN_LOCAL_STRATEGY_ID = '5a528c4c-0a82-4ad2-96a5-2b23811e6588'

// DATA

const state = reactive({
  loading: 0,
  loadingGroups: true,
  displayMode: 'strategies',
  groups: [],
  strategies: [],
  activeStrategies: [],
  selectedStrategy: '',
  strategy: {
    strategy: {}
  },
  /** The instance-wide settings, which belong to no strategy — the Configuration screen. */
  config: {
    allowPasskeys: true,
    allowProfileEditing: true
  }
})

// COMPUTED

const isBuiltInLocal = computed(() => {
  return state.strategy.id === BUILTIN_LOCAL_STRATEGY_ID
})
const availableStrategies = computed(() => {
  return state.strategies.filter((str) => str.key !== 'local')
})
const selectedGroupName = computed(() => {
  return state.groups.filter((g) => g.id === state.strategy?.autoEnrollGroups?.[0])[0]?.name
})
const strategyRefs = computed(() => {
  if (!state.selectedStrategy) {
    return []
  }
  const str = state.strategies.find((s) => s.key === state.strategy?.strategy?.key)
  if (!str?.refs) {
    return []
  }
  return Object.entries(str.refs).map(([key, ref]) => {
    return {
      ...ref,
      key,
      value: ref.value
        .replaceAll('{host}', window.location.origin)
        .replaceAll('{id}', state.selectedStrategy)
    }
  })
})

// WATCHERS

watch(
  () => state.selectedStrategy,
  (newValue) => {
    state.strategy = state.activeStrategies.find((str) => str.id === newValue) || { strategy: {} }
  }
)
watch(
  () => state.activeStrategies,
  (newValue) => {
    // -> Keep the current selection across a reload, falling back to the first strategy
    state.selectedStrategy = newValue.some((str) => str.id === state.selectedStrategy)
      ? state.selectedStrategy
      : newValue[0]?.id
    state.strategy = newValue.find((str) => str.id === state.selectedStrategy) || { strategy: {} }
  }
)

// METHODS

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
      /*
        What the server sent, kept only for a sensitive prop.

        The server never sends a stored secret back — the field arrives holding a mask instead — so
        this is how the form tells a value that is still the server's from one somebody has typed.
        See `selectStoredSecret`.
      */
      ...(prop.sensitive && { stored: values?.[key] ?? prop.default }),
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

/**
 * Select the whole of a masked secret as soon as its field is focused.
 *
 * A sensitive prop reads as a row of dots rather than as what is stored, in a field that is
 * otherwise an ordinary text box: clicking into it and pasting a new client secret would append it
 * to the mask and save the pair of them. Selecting the mask makes the first thing typed replace it.
 *
 * Only while the field still holds what the server sent, so that a value being edited is not
 * repeatedly selected out from under whoever is editing it. Selecting changes nothing on its own —
 * focusing the field and leaving sends the mask back, which the server reads as "unchanged" — and
 * emptying the field still means the secret is to be removed.
 */
function selectStoredSecret(ev, cfg) {
  if (cfg.sensitive && cfg.value === cfg.stored) {
    ev.target.select()
  }
}

function inputTypeFor(cfg) {
  if (cfg.multiline) {
    return 'textarea'
  }
  if (cfg.sensitive) {
    return 'password'
  }
  return cfg.type === 'number' ? 'number' : 'text'
}

async function load() {
  state.loading++
  state.loadingGroups = true
  loading.show()
  try {
    const [modules, strategies, config, groups] = await Promise.all([
      API_CLIENT.get('authentication/modules').json(),
      API_CLIENT.get('authentication/strategies').json(),
      API_CLIENT.get('authentication/config').json(),
      API_CLIENT.get('groups').json()
    ])
    state.strategies = modules ?? []
    state.config = { ...state.config, ...config }
    /*
      The running app holds these from `bootstrap`, which answered before this screen touched them —
      so without this, an administrator who turns passkeys off goes on being offered a passkey on the
      login screen (and their own profile goes on offering to register one) until the next full load.
      Here rather than in `save`, so opening the screen also settles a change made from elsewhere.
    */
    authConfigStore.apply(state.config)
    state.activeStrategies = (strategies ?? []).map((str) => {
      const mod = state.strategies.find((m) => m.key === str.module) ?? {
        key: str.module,
        title: str.module
      }
      return {
        ...str,
        strategy: mod,
        config: buildConfigEditor(mod.props, str.config)
      }
    })
    // -> Guests cannot be enrolled into, being the group of users who never logged in
    state.groups = (groups ?? []).filter((g) => g.id !== GUESTS_GROUP_ID)
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.auth.loadFailed'),
      caption: err.message
    })
  }
  state.loadingGroups = false
  loading.hide()
  state.loading--
}

async function refresh() {
  await load()
  notify({
    type: 'positive',
    message: t('admin.auth.refreshSuccess')
  })
}

function configIfCheck(ifs) {
  if (!ifs || ifs.length < 1) {
    return true
  }
  return ifs.every((s) => state.strategy.config[s.key]?.value === s.eq)
}

/**
 * The strategy as the API expects it. Read-only props are left out: the server keeps whatever is
 * stored for them, so sending them back would be pretending they can be set.
 */
function payloadFor(str) {
  const config = {}
  for (const [key, cfg] of Object.entries(str.config ?? {})) {
    if (cfg.readOnly) {
      continue
    }
    config[key] = cfg.type === 'number' ? Number(cfg.value) : cfg.value
  }
  return {
    displayName: str.displayName,
    isEnabled: str.isEnabled,
    registration: str.registration,
    allowedEmailRegex: str.allowedEmailRegex ?? '',
    autoEnrollGroups: str.autoEnrollGroups ?? [],
    config
  }
}

async function save() {
  if (state.loading > 0) {
    return
  }

  state.loading++
  const failures = []
  /*
    A strategy that has never been saved is created here, whole: the create endpoint takes the same
    fields the update one does, so a new provider arrives with its configuration rather than existing
    for a moment as an empty shell. Whichever ID the server assigns is what the reload below picks up.
  */
  for (const str of state.activeStrategies) {
    try {
      const resp = str.isNew
        ? await API_CLIENT.post('authentication/strategies', {
            json: { module: str.module, ...payloadFor(str) }
          }).json()
        : await API_CLIENT.put(`authentication/strategies/${str.id}`, {
            json: payloadFor(str)
          }).json()
      if (!resp?.ok) {
        throw new Error(resp?.message || 'An unexpected error occured.')
      }
      if (str.isNew && resp.id) {
        // -> So that the reload lands back on the strategy that was just created
        state.selectedStrategy = resp.id
      }
    } catch (err) {
      failures.push({ name: str.displayName, message: apiErrorMessage(err) })
    }
  }

  /*
    The instance-wide settings go with them, whichever screen is in front: both are edited in this
    one page and Apply is the page's own button, so switching tab to check something must not be
    what loses the edit made on the other.
  */
  let configFailure = null
  try {
    const resp = await API_CLIENT.put('authentication/config', {
      json: {
        allowPasskeys: state.config.allowPasskeys,
        allowProfileEditing: state.config.allowProfileEditing
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    configFailure = apiErrorMessage(err)
  }

  if (failures.length > 0 || configFailure) {
    for (const failure of failures) {
      notify({
        type: 'negative',
        message: t('admin.auth.saveFailed', { strategy: failure.name }),
        caption: failure.message
      })
    }
    if (configFailure) {
      notify({
        type: 'negative',
        message: t('admin.auth.configSaveFailed'),
        caption: configFailure
      })
    }
  } else {
    notify({
      type: 'positive',
      message: t('admin.auth.saveSuccess')
    })
  }
  state.loading--
  await load()
}

/**
 * Add a strategy to the list, without creating it.
 *
 * Nothing is sent: the new strategy is a row in this screen until Apply, like every edit made to the
 * ones beside it. An administrator adding a provider has a client ID and a secret to paste in first,
 * and a half-configured strategy that already exists on the server is one that can be saved by
 * accident, reloaded into, or left behind by closing the tab.
 *
 * The ID is a local placeholder; the server assigns the real one when this is created.
 */
function addStrategy(mod) {
  const strategy = {
    id: `new:${uuid()}`,
    isNew: true,
    module: mod.key,
    displayName: mod.title,
    // -> Off until it has been configured and saved: an enabled strategy appears on login screens
    isEnabled: false,
    registration: false,
    allowedEmailRegex: '',
    autoEnrollGroups: [],
    strategy: mod,
    config: buildConfigEditor(mod.props, {})
  }
  state.activeStrategies.push(strategy)
  state.selectedStrategy = strategy.id
  state.strategy = strategy
  notify({
    type: 'positive',
    message: t('admin.auth.addPending', { strategy: mod.title })
  })
}

function confirmDelete() {
  const strategy = state.strategy
  /*
    Nothing to confirm and nothing to delete for one that only ever existed here: it goes, and the
    selection falls back to the first strategy the way it does after a reload.
  */
  if (strategy.isNew) {
    state.activeStrategies = state.activeStrategies.filter((str) => str.id !== strategy.id)
    state.selectedStrategy = state.activeStrategies[0]?.id
    state.strategy = state.activeStrategies[0] ?? { strategy: {} }
    return
  }
  confirm({
    title: t('admin.auth.deleteStrategy'),
    message: t('admin.auth.deleteConfirm', { strategy: strategy.displayName }),
    persistent: true,
    cancel: true,
    color: 'negative',
    okLabel: t('common.actions.delete')
  }).onOk(async () => {
    state.loading++
    try {
      const resp = await API_CLIENT.delete(`authentication/strategies/${strategy.id}`)
      if (!resp?.ok) {
        throw new Error((await resp.json())?.message || 'An unexpected error occured.')
      }
      notify({
        type: 'positive',
        message: t('admin.auth.deleteSuccess', { strategy: strategy.displayName })
      })
    } catch (err) {
      notify({
        type: 'negative',
        message: t('admin.auth.deleteFailed'),
        caption: apiErrorMessage(err)
      })
    }
    state.loading--
    await load()
  })
}

// MOUNTED

onMounted(load)
</script>
