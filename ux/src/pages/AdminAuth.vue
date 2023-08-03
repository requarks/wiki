<template lang='pug'>
q-page.admin-mail
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
              q-item-label {{str.displayName}}
              q-item-label(caption) {{str.strategy.title}}
            q-item-section(side)
              status-light(:color='str.isEnabled ? `positive` : `negative`', :pulse='str.isEnabled')
      q-btn.q-mt-sm.full-width(
        color='primary'
        icon='las la-plus'
        :label='t(`admin.auth.addStrategy`)'
        )
        q-menu(auto-close, fit, max-width='300px')
          q-list(separator)
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
                q-item-label: strong {{str.title}}
                q-item-label(caption, lines='2') {{str.description}}
    .col
      q-card.q-pb-sm
        q-card-section
          .text-subtitle1 {{t('admin.auth.info')}}
        q-item
          blueprint-icon(icon='information')
          q-item-section
            q-item-label {{t(`admin.auth.infoName`)}}
            q-item-label(caption) {{t(`admin.auth.infoNameHint`)}}
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
            q-item-label {{t(`admin.auth.enabled`)}}
            q-item-label(caption) {{t(`admin.auth.enabledHint`)}}
            q-item-label.text-deep-orange(v-if='state.strategy.strategy.key === `local`', caption) {{t(`admin.auth.enabledForced`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.strategy.isEnabled'
              :disable='state.strategy.strategy.key === `local`'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.auth.enabled`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='register')
          q-item-section
            q-item-label {{t(`admin.auth.selfRegistration`)}}
            q-item-label(caption) {{t(`admin.auth.selfRegistrationHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.strategy.selfRegistration'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.auth.selfRegistration`)'
              )
        template(v-if='state.strategy.selfRegistration')
          q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='team')
            q-item-section
              q-item-label {{t(`admin.auth.autoEnrollGroups`)}}
              q-item-label(caption) {{t(`admin.auth.autoEnrollGroupsHint`)}}
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
                template(v-slot:selected)
                  .text-caption(v-if='state.strategy.autoEnrollGroups?.length > 1')
                    i18n-t(keypath='admin.users.groupsSelected')
                      template(#count)
                        strong {{ state.strategy.autoEnrollGroups?.length }}
                  .text-caption(v-else-if='state.strategy.autoEnrollGroups?.length === 1')
                    i18n-t(keypath='admin.users.groupSelected')
                      template(#group)
                        strong {{ selectedGroupName }}
                  span(v-else)
                template(v-slot:option='{ itemProps, opt, selected, toggleOption }')
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
              q-item-label {{t(`admin.auth.domainsWhitelist`)}}
              q-item-label(caption) {{t(`admin.auth.domainsWhitelistHint`)}}
            q-item-section
              q-input(
                outlined
                v-model='state.strategy.domainWhitelist'
                dense
                hide-bottom-space
                :aria-label='t(`admin.auth.domainsWhitelist`)'
                prefix='/'
                suffix='/'
                )

      //- -----------------------
      //- Configuration
      //- -----------------------
      q-card.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{t('admin.auth.strategyConfiguration')}}
          q-banner.q-mt-md(
            v-if='!state.strategy.config || Object.keys(state.strategy.config).length < 1'
            rounded
            :class='$q.dark.isActive ? `bg-negative text-white` : `bg-grey-2 text-grey-7`'
            ) {{t('admin.auth.noConfigOption')}}
        template(
          v-for='(cfg, cfgKey, idx) in state.strategy.config'
          )
          template(
            v-if='configIfCheck(cfg.if)'
            )
            q-separator.q-my-sm(inset, v-if='idx > 0')
            q-item(v-if='cfg.type === `boolean`', tag='label')
              blueprint-icon(:icon='cfg.icon', :hue-rotate='cfg.readOnly ? -45 : 0')
              q-item-section
                q-item-label {{cfg.title}}
                q-item-label(caption) {{cfg.hint}}
              q-item-section(avatar)
                q-toggle(
                  v-model='cfg.value'
                  color='primary'
                  checked-icon='las la-check'
                  unchecked-icon='las la-times'
                  :aria-label='t(`admin.general.allowComments`)'
                  :disable='cfg.readOnly'
                  )
            q-item(v-else)
              blueprint-icon(:icon='cfg.icon', :hue-rotate='cfg.readOnly ? -45 : 0')
              q-item-section
                q-item-label {{cfg.title}}
                q-item-label(caption) {{cfg.hint}}
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
                  :type='cfg.multiline ? `textarea` : (cfg.sensitive ? `password` : `input`)'
                  :aria-label='cfg.title'
                  :disable='cfg.readOnly'
                  )

      //- -----------------------
      //- References
      //- -----------------------
      q-card.q-pb-sm.q-mt-md(v-if='strategyRefs.length > 0')
        q-card-section
          .text-subtitle1 {{t('admin.auth.configReference')}}
        q-item(v-for='strRef of strategyRefs', :key='strRef.key')
          blueprint-icon(:icon='strRef.icon', :hue-rotate='-45')
          q-item-section
            q-item-label {{strRef.title}}
            q-item-label(caption) {{strRef.hint}}
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
          .text-subtitle2.q-mt-sm {{state.strategy.strategy.title}}
          .text-caption.q-mt-sm {{state.strategy.strategy.description}}
          .text-caption.q-mt-sm: strong {{state.strategy.strategy.vendor}}
          .text-caption: a(:href='state.strategy.strategy.website', target='_blank', rel='noreferrer') {{state.strategy.strategy.website}}

      .flex.q-mt-md
        .text-caption.text-grey ID: {{ state.strategy.id }}
        q-space
        q-btn.acrylic-btn(
          icon='las la-trash-alt'
          flat
          color='negative'
          :disable='state.strategy.strategy.key === `local`'
          label='Delete Strategy'
          @click='deleteStrategy(state.strategy.id)'
          )
</template>

<script setup>
import gql from 'graphql-tag'
import { cloneDeep, find, reject, transform } from 'lodash-es'
import { v4 as uuid } from 'uuid'

import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { computed, onMounted, reactive, watch, nextTick } from 'vue'

import { useAdminStore } from 'src/stores/admin'
import { useSiteStore } from 'src/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.auth.title')
})

// DATA

const state = reactive({
  loading: 0,
  loadingGroups: true,
  groups: [],
  strategies: [],
  activeStrategies: [],
  selectedStrategy: '',
  host: '',
  strategy: {
    strategy: {}
  }
})

// COMPUTED

const availableStrategies = computed(() => {
  return state.strategies.filter(str => str.key !== 'local')
})
const selectedGroupName = computed(() => {
  return state.groups.filter(g => g.id === state.strategy?.autoEnrollGroups?.[0])[0]?.name
})
const strategyRefs = computed(() => {
  if (!state.selectedStrategy) { return [] }
  const str = find(state.strategies, ['key', state.strategy?.strategy.key])
  if (!str || !str.refs) { return [] }
  return Object.entries(str.refs).map(([k, v]) => {
    return {
      ...v,
      key: k,
      value: v.value.replaceAll('{host}', window.location.origin).replaceAll('{id}', state.selectedStrategy)
    }
  }) ?? []
})

// WATCHERS

watch(() => state.selectedStrategy, (newValue, oldValue) => {
  state.strategy = find(state.activeStrategies, ['id', newValue]) || {}
})
watch(() => state.activeStrategies, (newValue, oldValue) => {
  state.selectedStrategy = newValue[0]?.id
})

// METHODS

async function loadGroups () {
  state.loading++
  state.loadingGroups = true
  const resp = await APOLLO_CLIENT.query({
    query: gql`
      query getGroupsForAdminAuth {
        groups {
          id
          name
        }
      }
    `,
    fetchPolicy: 'network-only'
  })
  state.groups = cloneDeep(resp?.data?.groups?.filter(g => g.id !== '10000000-0000-4000-8000-000000000001') ?? [])
  state.loadingGroups = false
  state.loading--
}

async function load () {
  state.loading++
  $q.loading.show()
  const resp = await APOLLO_CLIENT.query({
    query: gql`
      query adminFetchAuthStrategies {
        authStrategies {
          key
          props
          refs
          title
          description
          isAvailable
          useForm
          usernameType
          logo
          color
          vendor
          website
          icon
        }
        authActiveStrategies {
          id
          strategy {
            key
          }
          displayName
          isEnabled
          config
          selfRegistration
          domainWhitelist
          autoEnrollGroups
        }
      }
    `,
    fetchPolicy: 'network-only'
  })
  state.strategies = resp?.data?.authStrategies || []
  state.activeStrategies = (cloneDeep(resp?.data?.authActiveStrategies) || []).map(a => {
    const str = cloneDeep(find(state.strategies, ['key', a.strategy.key])) || {}
    a.strategy = str
    a.config = transform(str.props, (r, v, k) => {
      r[k] = {
        ...v,
        value: a.config?.[k],
        ...v.enum && {
          enum: v.enum.map(o => {
            if (o.indexOf('|') > 0) {
              const oParsed = o.split('|')
              return {
                value: oParsed[0],
                label: oParsed[1]
              }
            } else {
              return {
                value: o,
                label: o
              }
            }
          })
        }
      }
    }, {})
    return a
  })
  $q.loading.hide()
  state.loading--
}

function configIfCheck (ifs) {
  if (!ifs || ifs.length < 1) { return true }
  return ifs.every(s => state.strategy.config[s.key]?.value === s.eq)
}

function addStrategy (str) {
  const newStr = {
    id: uuid(),
    strategy: str,
    config: transform(str.props, (r, v, k) => {
      r[k] = {
        ...v,
        value: v.default,
        ...v.enum && {
          enum: v.enum.map(o => {
            if (o.indexOf('|') > 0) {
              const oParsed = o.split('|')
              return {
                value: oParsed[0],
                label: oParsed[1]
              }
            } else {
              return {
                value: o,
                label: o
              }
            }
          })
        }
      }
    }, {}),
    isEnabled: true,
    displayName: str.title,
    selfRegistration: true,
    domainWhitelist: [],
    autoEnrollGroups: []
  }
  state.activeStrategies = [...state.activeStrategies, newStr]
  nextTick(() => {
    state.selectedStrategy = newStr.id
  })
}

function deleteStrategy (id) {
  state.activeStrategies = reject(state.activeStrategies, ['id', id])
}

async function save () {
  state.loading++
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation($strategies: [AuthenticationStrategyInput]!) {
          authentication {
            updateStrategies(strategies: $strategies) {
              responseResult {
                succeeded
                errorCode
                slug
                message
              }
            }
          }
        }
      `,
      variables: {
        strategies: this.activeStrategies.map((str, idx) => ({
          key: str.key,
          strategyKey: str.strategy.key,
          displayName: str.displayName,
          order: idx,
          isEnabled: str.isEnabled,
          config: str.config.map(cfg => ({ ...cfg, value: JSON.stringify({ v: cfg.value.value }) })),
          selfRegistration: str.selfRegistration,
          domainWhitelist: str.domainWhitelist,
          autoEnrollGroups: str.autoEnrollGroups
        }))
      }
    })
    if (resp?.data?.authentication?.updateStrategies?.operation.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('admin.auth.saveSuccess')
      })
    } else {
      throw new Error(resp?.data?.authentication?.updateStrategies?.operation?.message || t('common.error.unexpected'))
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to save site theme config',
      caption: err.message
    })
  }
  state.loading--
}

// apollo: {
//   strategies: {
//     query: gql`
//       query {
//         authentication {
//           strategies {
//             key
//             title
//             description
//             isAvailable
//             useForm
//             logo
//             website
//             props {
//               key
//               value
//             }
//           }
//         }
//       }
//     `,
//     skip: true,
//     fetchPolicy: 'network-only',
//     update: (data) => _.get(data, 'authentication.strategies', []).map(str => ({
//       ...str,
//       isDisabled: !str.isAvailable || str.key === 'local',
//       props: _.sortBy(str.props.map(cfg => ({
//         key: cfg.key,
//         ...JSON.parse(cfg.value)
//       })), [t => t.order])
//     })),
//     watchLoading (isLoading) {
//       this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-auth-strategies-refresh')
//     }
//   },
//   activeStrategies: {
//     query: gql`
//       query {
//         authentication {
//           activeStrategies {
//             key
//             strategy {
//               key
//               title
//               description
//               useForm
//               logo
//               website
//             }
//             config {
//               key
//               value
//             }
//             order
//             isEnabled
//             displayName
//             selfRegistration
//             domainWhitelist
//             autoEnrollGroups
//           }
//         }
//       }
//     `,
//     skip: true,
//     fetchPolicy: 'network-only',
//     update: (data) => _.sortBy(_.get(data, 'authentication.activeStrategies', []).map(str => ({
//       ...str,
//       config: _.sortBy(str.config.map(cfg => ({
//         ...cfg,
//         value: JSON.parse(cfg.value)
//       })), [t => t.value.order])
//     })), ['order']),
//     watchLoading (isLoading) {
//       this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-auth-activestrategies-refresh')
//     }
//   },
//   groups: {
//     query: gql`{ test }`,
//     fetchPolicy: 'network-only',
//     update: (data) => data.groups.list,
//     watchLoading (isLoading) {
//       this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-auth-groups-refresh')
//     }
//   },
//   host: {
//     query: gql`{ test }`,
//     fetchPolicy: 'network-only',
//     update: (data) => _.cloneDeep(data.site.config.host),
//     watchLoading (isLoading) {
//       this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-auth-host-refresh')
//     }
//   }

onMounted(() => {
  load()
  loadGroups()
})
</script>
