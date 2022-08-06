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
        href='https://docs.js.wiki/admin/auth'
        target='_blank'
        type='a'
        )
      q-btn(
        unelevated
        icon='fa-solid fa-check'
        :label='t(`common.actions.apply`)'
        color='secondary'
        @click='save'
        :loading='state.loading > 0'
      )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-auto
      q-card.rounded-borders.bg-dark
        q-list(
          style='min-width: 350px;'
          padding
          dark
          )
          q-item(
            v-for='str of combinedActiveStrategies'
            :key='str.key'
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
      q-card.shadow-1.q-pb-sm
        q-card-section
          .text-subtitle1 {{t('admin.storage.contentTypes')}}
          .text-body2.text-grey {{ t('admin.storage.contentTypesHint') }}

      //- -----------------------
      //- Configuration
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{t('admin.storage.config')}}
          q-banner.q-mt-md(
            v-if='!state.strategy.config || Object.keys(state.strategy.config).length < 1'
            rounded
            :class='$q.dark.isActive ? `bg-negative text-white` : `bg-grey-2 text-grey-7`'
            ) {{t('admin.storage.noConfigOption')}}
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
                  :type='cfg.multiline ? `textarea` : `input`'
                  :aria-label='cfg.title'
                  :disable='cfg.readOnly'
                  )

    .col-auto(v-if='state.selectedStrategy && state.strategy')
      //- -----------------------
      //- Infobox
      //- -----------------------
      q-card.rounded-borders.q-pb-md(style='width: 350px;')
        q-card-section
          .text-subtitle1 {{state.strategy.strategy.title}}
          q-img.q-mt-sm.rounded-borders(
            :src='state.strategy.strategy.logo'
            fit='contain'
            no-spinner
            style='height: 100px;'
          )
          .text-body2.q-mt-md {{state.strategy.strategy.description}}
        q-separator.q-mb-sm(inset)
        q-item
          q-item-section
            q-item-label.text-grey {{t(`admin.auth.vendor`)}}
            q-item-label {{state.strategy.strategy.vendor}}
        q-separator.q-my-sm(inset)
        q-item
          q-item-section
            q-item-label.text-grey {{t(`admin.auth.vendorWebsite`)}}
            q-item-label: a(:href='state.strategy.strategy.website', target='_blank', rel='noreferrer') {{state.strategy.strategy.website}}

      //- -----------------------
      //- Status
      //- -----------------------
      q-card.rounded-borders.q-pb-md.q-mt-md(style='width: 350px;')
        q-card-section
          .text-subtitle1 {{t(`admin.auth.status`)}}
        q-item(tag='label')
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
        q-item
          q-item-section
            q-btn.acrylic-btn(
              icon='las la-trash-alt'
              flat
              color='negative'
              :disable='state.strategy.strategy.key === `local`'
              label='Delete Strategy'
              )

    //- v-flex(xs12, lg9)
    //-   v-card.animated.fadeInUp.wait-p2s
    //-     v-toolbar(color='primary', dense, flat, dark)
    //-       .subtitle-1 {{strategy.displayName}} #[em ({{strategy.strategy.title}})]
    //-       v-spacer
    //-       v-btn(small, outlined, dark, color='white', :disabled='strategy.key === `local`', @click='deleteStrategy()')
    //-         v-icon(left) mdi-close
    //-         span {{$t('common.actions.delete')}}
    //-     v-card-info(color='blue')
    //-       div
    //-         span {{strategy.strategy.description}}
    //-         .caption: a(:href='strategy.strategy.website') {{strategy.strategy.website}}
    //-       v-spacer
    //-       .admin-providerlogo
    //-         img(:src='strategy.strategy.logo', :alt='strategy.strategy.title')
    //-     v-card-text
    //-       .row
    //-         .col-8
    //-           v-text-field(
    //-             outlined
    //-             :label='$t(`admin.auth.displayName`)'
    //-             v-model='strategy.displayName'
    //-             prepend-icon='mdi-format-title'
    //-             :hint='$t(`admin.auth.displayNameHint`)'
    //-             persistent-hint
    //-             )
    //-         .col-4
    //-           v-switch.mt-1(
    //-             :label='$t(`admin.auth.strategyIsEnabled`)'
    //-             v-model='strategy.isEnabled'
    //-             color='primary'
    //-             prepend-icon='mdi-power'
    //-             :hint='$t(`admin.auth.strategyIsEnabledHint`)'
    //-             persistent-hint
    //-             inset
    //-             :disabled='strategy.key === `local`'
    //-             )
    //-       template(v-if='strategy.config && Object.keys(strategy.config).length > 0')
    //-         v-divider
    //-         .overline.my-5 {{$t('admin.auth.strategyConfiguration')}}
    //-         .pr-3
    //-           template(v-for='cfg in strategy.config')
    //-             v-select.mb-3(
    //-               v-if='cfg.value.type === "string" && cfg.value.enum'
    //-               outlined
    //-               :items='cfg.value.enum'
    //-               :key='cfg.key'
    //-               :label='cfg.value.title'
    //-               v-model='cfg.value.value'
    //-               prepend-icon='mdi-cog-box'
    //-               :hint='cfg.value.hint ? cfg.value.hint : ""'
    //-               persistent-hint
    //-               :class='cfg.value.hint ? "mb-2" : ""'
    //-               :style='cfg.value.maxWidth > 0 ? `max-width:` + cfg.value.maxWidth + `px;` : ``'
    //-             )
    //-             v-switch.mb-6(
    //-               v-else-if='cfg.value.type === "boolean"'
    //-               :key='cfg.key'
    //-               :label='cfg.value.title'
    //-               v-model='cfg.value.value'
    //-               color='primary'
    //-               prepend-icon='mdi-cog-box'
    //-               :hint='cfg.value.hint ? cfg.value.hint : ""'
    //-               persistent-hint
    //-               inset
    //-               )
    //-             v-textarea.mb-3(
    //-               v-else-if='cfg.value.type === "string" && cfg.value.multiline'
    //-               outlined
    //-               :key='cfg.key'
    //-               :label='cfg.value.title'
    //-               v-model='cfg.value.value'
    //-               prepend-icon='mdi-cog-box'
    //-               :hint='cfg.value.hint ? cfg.value.hint : ""'
    //-               persistent-hint
    //-               :class='cfg.value.hint ? "mb-2" : ""'
    //-               )
    //-             v-text-field.mb-3(
    //-               v-else
    //-               outlined
    //-               :key='cfg.key'
    //-               :label='cfg.value.title'
    //-               v-model='cfg.value.value'
    //-               prepend-icon='mdi-cog-box'
    //-               :hint='cfg.value.hint ? cfg.value.hint : ""'
    //-               persistent-hint
    //-               :class='cfg.value.hint ? "mb-2" : ""'
    //-               :style='cfg.value.maxWidth > 0 ? `max-width:` + cfg.value.maxWidth + `px;` : ``'
    //-               )
    //-       v-divider
    //-       .overline.my-5 {{$t('admin.auth.registration')}}
    //-       .pr-3
    //-         v-switch.ml-3(
    //-           v-model='strategy.selfRegistration'
    //-           :label='$t(`admin.auth.selfRegistration`)'
    //-           color='primary'
    //-           :hint='$t(`admin.auth.selfRegistrationHint`)'
    //-           persistent-hint
    //-           inset
    //-         )
    //-         v-combobox.ml-3.mt-5(
    //-           :label='$t(`admin.auth.domainsWhitelist`)'
    //-           v-model='strategy.domainWhitelist'
    //-           prepend-icon='mdi-email-check-outline'
    //-           outlined
    //-           :disabled='!strategy.selfRegistration'
    //-           :hint='$t(`admin.auth.domainsWhitelistHint`)'
    //-           persistent-hint
    //-           small-chips
    //-           deletable-chips
    //-           clearable
    //-           multiple
    //-           chips
    //-           )
    //-         v-autocomplete.mt-3.ml-3(
    //-           outlined
    //-           :disabled='!strategy.selfRegistration'
    //-           :items='groups'
    //-           item-text='name'
    //-           item-value='id'
    //-           :label='$t(`admin.auth.autoEnrollGroups`)'
    //-           v-model='strategy.autoEnrollGroups'
    //-           prepend-icon='mdi-account-group'
    //-           :hint='$t(`admin.auth.autoEnrollGroupsHint`)'
    //-           small-chips
    //-           persistent-hint
    //-           deletable-chips
    //-           clearable
    //-           multiple
    //-           chips
    //-           )

    //-   v-card.mt-4.wiki-form.animated.fadeInUp.wait-p4s(v-if='selectedStrategy !== `local`')
    //-     v-toolbar(color='primary', dense, flat, dark)
    //-       .subtitle-1 {{$t('admin.auth.configReference')}}
    //-     v-card-text
    //-       .body-2 {{$t('admin.auth.configReferenceSubtitle')}}
    //-       v-alert.mt-3.radius-7(v-if='host.length < 8', color='red', outlined, :value='true', icon='mdi-alert')
    //-         i18next(path='admin.auth.siteUrlNotSetup', tag='span')
    //-           strong(place='siteUrl') {{$t('admin.general.siteUrl')}}
    //-           strong(place='general') {{$t('admin.general.title')}}
    //-       .pa-3.mt-3.radius-7.grey(v-else, :class='$vuetify.theme.dark ? `darken-3-d5` : `lighten-3`')
    //-         .body-2: strong {{$t('admin.auth.allowedWebOrigins')}}
    //-         .body-2 {{host}}
    //-         v-divider.my-3
    //-         .body-2: strong {{$t('admin.auth.callbackUrl')}}
    //-         .body-2 {{host}}/login/{{strategy.key}}/callback
    //-         v-divider.my-3
    //-         .body-2: strong {{$t('admin.auth.loginUrl')}}
    //-         .body-2 {{host}}/login
    //-         v-divider.my-3
    //-         .body-2: strong {{$t('admin.auth.logoutUrl')}}
    //-         .body-2 {{host}}
    //-         v-divider.my-3
    //-         .body-2: strong {{$t('admin.auth.tokenEndpointAuthMethod')}}
    //-         .body-2 HTTP-POST
</template>

<script setup>
import gql from 'graphql-tag'
import { find, reject, transform } from 'lodash-es'
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

const combinedActiveStrategies = computed(() => {
  return state.activeStrategies.map(str => ({
    ...str,
    strategy: find(state.strategies, ['key', str.strategy?.key]) || {}
  }))
})

// WATCHERS

watch(() => state.selectedStrategy, (newValue, oldValue) => {
  const str = find(combinedActiveStrategies.value, ['id', newValue]) || {}
  str.config = transform(str.strategy.props, (cfg, v, k) => {
    cfg[k] = {
      ...v,
      value: str.config[k]
    }
  }, {})
  state.strategy = str
})
watch(() => state.activeStrategies, (newValue, oldValue) => {
  state.selectedStrategy = newValue[0]?.id
})

// METHODS

async function load () {
  state.loading++
  $q.loading.show()
  const resp = await APOLLO_CLIENT.query({
    query: gql`
      query adminFetchAuthStrategies {
        authStrategies {
          key
          props
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
  state.activeStrategies = resp?.data?.authActiveStrategies || []
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
    strategy: {
      key: str.key
    },
    config: transform(str.props, (cfg, v, k) => {
      cfg[k] = v.default
    }, {}),
    isEnabled: false,
    displayName: str.title,
    selfRegistration: false,
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
})
</script>
