<template lang='pug'>
q-page.admin-auth
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-security-lock.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.auth.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.auth.subtitle') }}
    .col-auto
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        :aria-label='t(`common.actions.viewDocs`)'
        :href='siteStore.docsBase + `/admin/auth`'
        target='_blank'
        type='a'
        )
        q-tooltip {{ t(`common.actions.viewDocs`) }}
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        :aria-label='t(`common.actions.refresh`)'
        @click='refresh'
        )
        q-tooltip {{ t(`common.actions.refresh`) }}
      q-btn(
        unelevated
        icon='mdi-check'
        :label='t(`common.actions.apply`)'
        color='secondary'
        @click='save'
        :loading='state.loading > 0'
      )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12.col-lg-auto
      q-card.rounded-borders.bg-dark
        q-list(
          style='min-width: 350px;'
          padding
          dark
          )
          q-item(
            v-for='str of state.activeStrategies'
            :key='str.id'
            active-class='bg-primary text-white'
            :active='state.selectedStrategy === str.id'
            @click='state.selectedStrategy = str.id'
            clickable
            )
            q-item-section(side)
              q-icon(:name='`img:` + str.strategy.icon')
            q-item-section
              q-item-label {{ str.displayName }}
              q-item-label(caption) {{ str.strategy.title }}
            q-item-section(side)
              status-light(:color='str.isEnabled ? `positive` : `negative`', :pulse='str.isEnabled')
      q-btn.q-mt-sm.full-width(
        color='primary'
        icon='las la-plus'
        :label='t(`admin.auth.addStrategy`)'
        v-if='flagsStore.experimental'
        )
        q-menu(auto-close, fit, max-width='300px')
          q-list(separator)
            //- Only the local module ships with the wiki so far, and it is already configured
            q-item(v-if='availableStrategies.length < 1')
              q-item-section
                q-item-label(caption) {{ t('admin.auth.noModulesToAdd') }}
            q-item(
              v-for='str of availableStrategies'
              :key='str.key'
              clickable
              @click='addStrategy(str)'
              )
              q-item-section(avatar)
                q-avatar(
                  rounded
                  color='dark'
                  text-color='white'
                  )
                  q-icon(
                    :name='`img:` + str.icon'
                  )
              q-item-section
                q-item-label: strong {{ str.title }}
                q-item-label(caption, lines='2') {{str.description}}
    .col(v-if='state.strategy.id')
      q-card.q-pb-sm
        q-card-section
          .text-subtitle1 {{ t('admin.auth.info') }}
        q-item
          blueprint-icon(icon='information')
          q-item-section
            q-item-label {{ t(`admin.auth.infoName`) }}
            q-item-label(caption) {{ t(`admin.auth.infoNameHint`) }}
          q-item-section
            q-input(
              outlined
              v-model='state.strategy.displayName'
              dense
              hide-bottom-space
              :aria-label='t(`admin.auth.infoName`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='shutdown')
          q-item-section
            q-item-label {{ t(`admin.auth.enabled`) }}
            q-item-label(caption) {{ t(`admin.auth.enabledHint`) }}
            q-item-label.text-deep-orange(v-if='isBuiltInLocal', caption) {{ t(`admin.auth.enabledForced`) }}
          q-item-section(avatar)
            q-toggle(
              v-model='state.strategy.isEnabled'
              :disable='isBuiltInLocal'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.auth.enabled`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='register')
          q-item-section
            q-item-label {{ t(`admin.auth.registration`) }}
            q-item-label(caption) {{ state.strategy.strategy.key === `local` ? t(`admin.auth.registrationLocalHint`) : t(`admin.auth.registrationHint`) }}
            //- Saved, but there is no self-registration path in the server yet — say so rather than
            //- let the toggle read as a working setting
            q-item-label.text-orange(caption) {{ t(`admin.auth.registrationNotEnforced`) }}
          q-item-section(avatar)
            q-toggle(
              v-model='state.strategy.registration'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.auth.registration`)'
              )
        template(v-if='state.strategy.registration')
          q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='team')
            q-item-section
              q-item-label {{ t(`admin.auth.autoEnrollGroups`) }}
              q-item-label(caption) {{ t(`admin.auth.autoEnrollGroupsHint`) }}
            q-item-section
              q-select(
                outlined
                :options='state.groups'
                v-model='state.strategy.autoEnrollGroups'
                multiple
                map-options
                emit-value
                option-value='id'
                option-label='name'
                options-dense
                dense
                hide-bottom-space
                :aria-label='t(`admin.users.groups`)'
                :loading='state.loadingGroups'
                )
                template(#selected)
                  .text-caption(v-if='state.strategy.autoEnrollGroups?.length > 1')
                    i18n-t(keypath='admin.users.groupsSelected')
                      template(#count)
                        strong {{ state.strategy.autoEnrollGroups?.length }}
                  .text-caption(v-else-if='state.strategy.autoEnrollGroups?.length === 1')
                    i18n-t(keypath='admin.users.groupSelected')
                      template(#group)
                        strong {{ selectedGroupName }}
                  span(v-else)
                template(#option='{ itemProps, opt, selected, toggleOption }')
                  q-item(
                    v-bind='itemProps'
                    )
                    q-item-section(side)
                      q-checkbox(
                        size='sm'
                        :model-value='selected'
                        @update:model-value='toggleOption(opt)'
                        )
                    q-item-section
                      q-item-label {{opt.name}}

          q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='private')
            q-item-section
              q-item-label {{ t(`admin.auth.allowedEmailRegex`) }}
              q-item-label(caption) {{ t(`admin.auth.allowedEmailRegexHint`) }}
            q-item-section
              q-input(
                outlined
                v-model='state.strategy.allowedEmailRegex'
                dense
                hide-bottom-space
                :aria-label='t(`admin.auth.allowedEmailRegex`)'
                prefix='/'
                suffix='/'
                )

      //- -----------------------
      //- Configuration
      //- -----------------------
      q-card.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{ t('admin.auth.strategyConfiguration') }}
          q-banner.q-mt-md(
            v-if='!state.strategy.config || Object.keys(state.strategy.config).length < 1'
            rounded
            :class='$q.dark.isActive ? `bg-dark-4 text-grey-5` : `bg-grey-2 text-grey-7`'
            ): em {{ t('admin.auth.noConfigOption') }}
        template(
          v-for='(cfg, cfgKey, idx) in state.strategy.config'
          )
          template(
            v-if='configIfCheck(cfg.if)'
            )
            q-separator.q-my-sm(inset, v-if='idx > 0')
            q-item(v-if='cfg.type === `boolean`', :tag='cfg.readOnly ? `div` : `label`')
              blueprint-icon(:icon='cfg.icon', :hue-rotate='cfg.readOnly ? -45 : 0')
              q-item-section
                q-item-label {{ cfg.title }}
                q-item-label(:class='cfg.readOnly ? `text-orange` : ``', caption) {{ cfg.hint }}
              q-item-section(avatar)
                q-toggle(
                  v-model='cfg.value'
                  color='primary'
                  checked-icon='las la-check'
                  unchecked-icon='las la-times'
                  :aria-label='cfg.title'
                  :disable='cfg.readOnly'
                  )
            q-item(v-else)
              blueprint-icon(:icon='cfg.icon', :hue-rotate='cfg.readOnly ? -45 : 0')
              q-item-section
                q-item-label {{ cfg.title }}
                q-item-label(:class='cfg.readOnly ? `text-orange` : ``', caption) {{ cfg.hint }}
              q-item-section(
                :style='cfg.type === `number` ? `flex: 0 0 150px;` : ``'
                :class='{ "col-auto": cfg.enum && cfg.enumDisplay === `buttons` }'
                )
                q-btn-toggle(
                  v-if='cfg.enum && cfg.enumDisplay === `buttons`'
                  v-model='cfg.value'
                  push
                  glossy
                  no-caps
                  toggle-color='primary'
                  :options='cfg.enum'
                  :disable='cfg.readOnly'
                )
                q-select(
                  v-else-if='cfg.enum'
                  outlined
                  v-model='cfg.value'
                  :options='cfg.enum'
                  emit-value
                  map-options
                  dense
                  options-dense
                  :aria-label='cfg.title'
                  :disable='cfg.readOnly'
                )
                q-input(
                  v-else
                  outlined
                  v-model='cfg.value'
                  dense
                  :type='inputTypeFor(cfg)'
                  :aria-label='cfg.title'
                  :disable='cfg.readOnly'
                  )

      //- -----------------------
      //- References
      //- -----------------------
      q-card.q-pb-sm.q-mt-md(v-if='strategyRefs.length > 0')
        q-card-section
          .text-subtitle1 {{ t('admin.auth.configReference') }}
          .text-caption.text-grey {{ t('admin.auth.configReferenceSubtitle') }}
        q-item(v-for='strRef of strategyRefs', :key='strRef.key')
          blueprint-icon(:icon='strRef.icon', :hue-rotate='-45')
          q-item-section
            q-item-label {{ strRef.title }}
            q-item-label(caption) {{ strRef.hint }}
          q-item-section
            q-input(
              outlined
              v-model='strRef.value'
              dense
              :aria-label='strRef.title'
              readonly
            )
      //- -----------------------
      //- Infobox
      //- -----------------------
      q-card.q-mt-md
        q-card-section.text-center
          q-img.rounded-borders(
            :src='state.strategy.strategy.logo'
            fit='contain'
            no-spinner
            style='height: 100px; max-width: 300px;'
          )
          .text-subtitle2.q-mt-sm {{ state.strategy.strategy.title }}
          .text-caption.q-mt-sm {{ state.strategy.strategy.description }}
          .text-caption.q-mt-sm: strong {{ state.strategy.strategy.vendor }}
          .text-caption: a(:href='state.strategy.strategy.website', target='_blank', rel='noreferrer') {{state.strategy.strategy.website}}

      .flex.q-mt-md
        .text-caption.text-grey ID: {{ state.strategy.id }}
        q-space
        q-btn.acrylic-btn(
          icon='las la-trash-alt'
          flat
          color='negative'
          :disable='isBuiltInLocal'
          :label='t(`admin.auth.deleteStrategy`)'
          @click='confirmDelete'
          )
          q-tooltip(v-if='isBuiltInLocal') {{ t('admin.auth.deleteLocalForbidden') }}
</template>

<script setup>

import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { computed, onMounted, reactive, watch } from 'vue'

import { useFlagsStore } from '@/stores/flags'
import { useSiteStore } from '@/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const flagsStore = useFlagsStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.auth.title')
})

// CONSTANTS

const GUESTS_GROUP_ID = '10000000-0000-4000-8000-000000000001'
// -> The strategy every account's password is stored against, hence the one that cannot be disabled
//    or deleted. A second instance of the local module is an ordinary strategy.
const BUILTIN_LOCAL_STRATEGY_ID = '5a528c4c-0a82-4ad2-96a5-2b23811e6588'

// DATA

const state = reactive({
  loading: 0,
  loadingGroups: true,
  groups: [],
  strategies: [],
  activeStrategies: [],
  selectedStrategy: '',
  strategy: {
    strategy: {}
  }
})

// COMPUTED

const isBuiltInLocal = computed(() => {
  return state.strategy.id === BUILTIN_LOCAL_STRATEGY_ID
})
const availableStrategies = computed(() => {
  return state.strategies.filter(str => str.key !== 'local')
})
const selectedGroupName = computed(() => {
  return state.groups.filter(g => g.id === state.strategy?.autoEnrollGroups?.[0])[0]?.name
})
const strategyRefs = computed(() => {
  if (!state.selectedStrategy) { return [] }
  const str = state.strategies.find(s => s.key === state.strategy?.strategy?.key)
  if (!str?.refs) { return [] }
  return Object.entries(str.refs).map(([key, ref]) => {
    return {
      ...ref,
      key,
      value: ref.value.replaceAll('{host}', window.location.origin).replaceAll('{id}', state.selectedStrategy)
    }
  })
})

// WATCHERS

watch(() => state.selectedStrategy, (newValue) => {
  state.strategy = state.activeStrategies.find(str => str.id === newValue) || { strategy: {} }
})
watch(() => state.activeStrategies, (newValue) => {
  // -> Keep the current selection across a reload, falling back to the first strategy
  state.selectedStrategy = newValue.some(str => str.id === state.selectedStrategy)
    ? state.selectedStrategy
    : newValue[0]?.id
  state.strategy = newValue.find(str => str.id === state.selectedStrategy) || { strategy: {} }
})

// METHODS

/**
 * Turn a module prop declaration and its stored value into the shape the config editor renders,
 * expanding `value|label` enum entries into options.
 */
function buildConfigEditor (props, values) {
  const config = {}
  for (const [key, prop] of Object.entries(props ?? {})) {
    config[key] = {
      ...prop,
      value: values?.[key] ?? prop.default,
      ...prop.enum && {
        enum: prop.enum.map(entry => {
          const [value, label] = entry.split('|')
          return { value, label: label ?? value }
        })
      }
    }
  }
  return config
}

function inputTypeFor (cfg) {
  if (cfg.multiline) { return 'textarea' }
  if (cfg.sensitive) { return 'password' }
  return cfg.type === 'number' ? 'number' : 'text'
}

async function load () {
  state.loading++
  state.loadingGroups = true
  $q.loading.show()
  try {
    const [modules, strategies, groups] = await Promise.all([
      API_CLIENT.get('authentication/modules').json(),
      API_CLIENT.get('authentication/strategies').json(),
      API_CLIENT.get('groups').json()
    ])
    state.strategies = modules ?? []
    state.activeStrategies = (strategies ?? []).map(str => {
      const mod = state.strategies.find(m => m.key === str.module) ?? { key: str.module, title: str.module }
      return {
        ...str,
        strategy: mod,
        config: buildConfigEditor(mod.props, str.config)
      }
    })
    // -> Guests cannot be enrolled into, being the group of users who never logged in
    state.groups = (groups ?? []).filter(g => g.id !== GUESTS_GROUP_ID)
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: t('admin.auth.loadFailed'),
      caption: err.message
    })
  }
  state.loadingGroups = false
  $q.loading.hide()
  state.loading--
}

async function refresh () {
  await load()
  $q.notify({
    type: 'positive',
    message: t('admin.auth.refreshSuccess')
  })
}

function configIfCheck (ifs) {
  if (!ifs || ifs.length < 1) { return true }
  return ifs.every(s => state.strategy.config[s.key]?.value === s.eq)
}

/**
 * The strategy as the API expects it. Read-only props are left out: the server keeps whatever is
 * stored for them, so sending them back would be pretending they can be set.
 */
function payloadFor (str) {
  const config = {}
  for (const [key, cfg] of Object.entries(str.config ?? {})) {
    if (cfg.readOnly) { continue }
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

/**
 * Read the API's own message off a failed request, since ky doesn't throw on 400
 */
async function apiMessage (err) {
  return err.response?.json().then(b => b?.message).catch(() => null) ?? err.message
}

async function save () {
  if (state.loading > 0) { return }

  state.loading++
  const failures = []
  for (const str of state.activeStrategies) {
    try {
      const resp = await API_CLIENT.put(`authentication/strategies/${str.id}`, {
        json: payloadFor(str)
      }).json()
      if (!resp?.ok) {
        throw new Error(resp?.message || 'An unexpected error occured.')
      }
    } catch (err) {
      failures.push({ name: str.displayName, message: await apiMessage(err) })
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      $q.notify({
        type: 'negative',
        message: t('admin.auth.saveFailed', { strategy: failure.name }),
        caption: failure.message
      })
    }
  } else {
    $q.notify({
      type: 'positive',
      message: t('admin.auth.saveSuccess')
    })
  }
  state.loading--
  await load()
}

async function addStrategy (mod) {
  state.loading++
  try {
    const resp = await API_CLIENT.post('authentication/strategies', {
      json: { module: mod.key, displayName: mod.title }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    $q.notify({
      type: 'positive',
      message: t('admin.auth.addSuccess', { strategy: mod.title })
    })
    state.selectedStrategy = resp.id
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: t('admin.auth.addFailed'),
      caption: await apiMessage(err)
    })
  }
  state.loading--
  await load()
}

function confirmDelete () {
  const strategy = state.strategy
  $q.dialog({
    title: t('admin.auth.deleteStrategy'),
    message: t('admin.auth.deleteConfirm', { strategy: strategy.displayName }),
    persistent: true,
    ok: {
      label: t('common.actions.delete'),
      color: 'negative',
      unelevated: true
    },
    cancel: {
      label: t('common.actions.cancel'),
      color: 'grey',
      flat: true
    }
  }).onOk(async () => {
    state.loading++
    try {
      const resp = await API_CLIENT.delete(`authentication/strategies/${strategy.id}`)
      if (!resp?.ok) {
        throw new Error((await resp.json())?.message || 'An unexpected error occured.')
      }
      $q.notify({
        type: 'positive',
        message: t('admin.auth.deleteSuccess', { strategy: strategy.displayName })
      })
    } catch (err) {
      $q.notify({
        type: 'negative',
        message: t('admin.auth.deleteFailed'),
        caption: await apiMessage(err)
      })
    }
    state.loading--
    await load()
  })
}

// MOUNTED

onMounted(load)

</script>
