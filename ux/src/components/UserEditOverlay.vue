<template lang="pug">
q-layout(view='hHh lpR fFf', container)
  q-header.card-header.q-px-md.q-py-sm
    q-icon(name='img:/_assets/icons/fluent-account.svg', left, size='md')
    div
      span {{t(`admin.users.edit`)}}
      .text-caption {{state.user.name}}
    q-space
    q-btn-group(push)
      q-btn(
        push
        color='grey-6'
        text-color='white'
        :aria-label='t(`common.actions.refresh`)'
        icon='las la-redo-alt'
        @click='fetchUser'
        :loading='state.loading > 0'
        )
        q-tooltip(anchor='center left', self='center right') {{t(`common.actions.refresh`)}}
      q-btn(
        push
        color='white'
        text-color='grey-7'
        :label='t(`common.actions.close`)'
        :aria-label='t(`common.actions.close`)'
        icon='las la-times'
        @click='close'
      )
      q-btn(
        push
        color='positive'
        text-color='white'
        :label='t(`common.actions.save`)'
        :aria-label='t(`common.actions.save`)'
        icon='las la-check'
        @click='save()'
        :disabled='state.loading > 0'
      )
  q-drawer.bg-dark-6(:model-value='true', :width='250', dark)
    q-list(padding, v-if='state.loading < 1')
      template(
        v-for='sc of sections'
        :key='`section-` + sc.key'
        )
        q-item(
          v-if='!sc.disabled || flagsStore.experimental'
          clickable
          :to='{ params: { section: sc.key } }'
          active-class='bg-primary text-white'
          :disabled='sc.disabled'
          )
          q-item-section(side)
            q-icon(:name='sc.icon', color='white')
          q-item-section {{sc.text}}
  q-page-container
    q-page(v-if='state.loading > 0')
      .flex.q-pa-lg.items-center
        q-spinner-tail(color='primary', size='32px', :thickness='2')
        .text-caption.text-primary.q-pl-md: strong {{t('admin.users.loading')}}
    q-page(v-else-if='route.params.section === `overview`')
      .q-pa-md
        .row.q-col-gutter-md
          .col-12.col-lg-8
            q-card.shadow-1.q-pb-sm
              q-card-section
                .text-subtitle1 {{t('admin.users.profile')}}
              q-item
                blueprint-icon(icon='contact')
                q-item-section
                  q-item-label {{t(`admin.users.name`)}}
                  q-item-label(caption) {{t(`admin.users.nameHint`)}}
                q-item-section
                  q-input(
                    outlined
                    v-model='state.user.name'
                    dense
                    :rules=`[
                      val => invalidCharsRegex.test(val) || t('admin.users.nameInvalidChars')
                    ]`
                    hide-bottom-space
                    :aria-label='t(`admin.users.name`)'
                    )
              q-separator.q-my-sm(inset)
              q-item
                blueprint-icon(icon='envelope')
                q-item-section
                  q-item-label {{t(`admin.users.email`)}}
                  q-item-label(caption) {{t(`admin.users.emailHint`)}}
                q-item-section
                  q-input(
                    outlined
                    v-model='state.user.email'
                    dense
                    :aria-label='t(`admin.users.email`)'
                    )
              template(v-if='state.user.meta')
                q-separator.q-my-sm(inset)
                q-item
                  blueprint-icon(icon='address')
                  q-item-section
                    q-item-label {{t(`admin.users.location`)}}
                    q-item-label(caption) {{t(`admin.users.locationHint`)}}
                  q-item-section
                    q-input(
                      outlined
                      v-model='state.user.meta.location'
                      dense
                      :aria-label='t(`admin.users.location`)'
                      )
                q-separator.q-my-sm(inset)
                q-item
                  blueprint-icon(icon='new-job')
                  q-item-section
                    q-item-label {{t(`admin.users.jobTitle`)}}
                    q-item-label(caption) {{t(`admin.users.jobTitleHint`)}}
                  q-item-section
                    q-input(
                      outlined
                      v-model='state.user.meta.jobTitle'
                      dense
                      :aria-label='t(`admin.users.jobTitle`)'
                      )
                q-separator.q-my-sm(inset)
                q-item
                  blueprint-icon(icon='gender')
                  q-item-section
                    q-item-label {{t(`admin.users.pronouns`)}}
                    q-item-label(caption) {{t(`admin.users.pronounsHint`)}}
                  q-item-section
                    q-input(
                      outlined
                      v-model='state.user.meta.pronouns'
                      dense
                      :aria-label='t(`admin.users.pronouns`)'
                      )

            q-card.shadow-1.q-pb-sm.q-mt-md(v-if='state.user.meta')
              q-card-section
                .text-subtitle1 {{t('admin.users.preferences')}}
              q-item
                blueprint-icon(icon='timezone')
                q-item-section
                  q-item-label {{t(`admin.users.timezone`)}}
                  q-item-label(caption) {{t(`admin.users.timezoneHint`)}}
                q-item-section
                  q-select(
                    outlined
                    v-model='state.user.prefs.timezone'
                    :options='timezones'
                    option-value='value'
                    option-label='text'
                    emit-value
                    map-options
                    dense
                    options-dense
                    :aria-label='t(`admin.users.timezone`)'
                  )
              q-separator.q-my-sm(inset)
              q-item
                blueprint-icon(icon='calendar')
                q-item-section
                  q-item-label {{t(`admin.users.dateFormat`)}}
                  q-item-label(caption) {{t(`admin.users.dateFormatHint`)}}
                q-item-section
                  q-select(
                    outlined
                    v-model='state.user.prefs.dateFormat'
                    emit-value
                    map-options
                    dense
                    :aria-label='t(`admin.users.dateFormat`)'
                    :options=`[
                      { label: t('profile.localeDefault'), value: '' },
                      { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
                      { label: 'DD.MM.YYYY', value: 'DD.MM.YYYY' },
                      { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
                      { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
                      { label: 'YYYY/MM/DD', value: 'YYYY/MM/DD' }
                    ]`
                  )
              q-separator.q-my-sm(inset)
              q-item
                blueprint-icon(icon='clock')
                q-item-section
                  q-item-label {{t(`admin.users.timeFormat`)}}
                  q-item-label(caption) {{t(`admin.users.timeFormatHint`)}}
                q-item-section.col-auto
                  q-btn-toggle(
                    v-model='state.user.prefs.timeFormat'
                    push
                    glossy
                    no-caps
                    toggle-color='primary'
                    :options=`[
                      { label: t('profile.timeFormat12h'), value: '12h' },
                      { label: t('profile.timeFormat24h'), value: '24h' }
                    ]`
                  )
              q-separator.q-my-sm(inset)
              q-item
                blueprint-icon(icon='light-on')
                q-item-section
                  q-item-label {{t(`admin.users.appearance`)}}
                  q-item-label(caption) {{t(`admin.users.darkModeHint`)}}
                q-item-section.col-auto
                  q-btn-toggle(
                    v-model='state.user.prefs.appearance'
                    push
                    glossy
                    no-caps
                    toggle-color='primary'
                    :options=`[
                      { label: t('profile.appearanceDefault'), value: 'site' },
                      { label: t('profile.appearanceLight'), value: 'light' },
                      { label: t('profile.appearanceDark'), value: 'dark' }
                    ]`
                  )
              q-separator.q-my-sm(inset)
              q-item
                blueprint-icon(icon='visualy-impaired')
                q-item-section
                  q-item-label {{t(`profile.cvd`)}}
                  q-item-label(caption) {{t(`profile.cvdHint`)}}
                q-item-section.col-auto
                  q-btn-toggle(
                    v-model='state.user.prefs.cvd'
                    push
                    glossy
                    no-caps
                    toggle-color='primary'
                    :options=`[
                      { value: 'none', label: t('profile.cvdNone') },
                      { value: 'protanopia', label: t('profile.cvdProtanopia') },
                      { value: 'deuteranopia', label: t('profile.cvdDeuteranopia') },
                      { value: 'tritanopia', label: t('profile.cvdTritanopia') }
                    ]`
                  )

          .col-12.col-lg-4
            q-card.shadow-1.q-pb-sm
              q-card-section
                .text-subtitle1 {{t('admin.users.info')}}
              q-item
                blueprint-icon(icon='person', :hue-rotate='-45')
                q-item-section
                  q-item-label {{t(`common.field.id`)}}
                  q-item-label: strong {{state.user.id}}
              q-separator.q-my-sm(inset)
              q-item
                blueprint-icon(icon='calendar-plus', :hue-rotate='-45')
                q-item-section
                  q-item-label {{t(`common.field.createdOn`)}}
                  q-item-label: strong {{formattedDate(state.user.createdAt)}}
              q-separator.q-my-sm(inset)
              q-item
                blueprint-icon(icon='summertime', :hue-rotate='-45')
                q-item-section
                  q-item-label {{t(`common.field.lastUpdated`)}}
                  q-item-label: strong {{formattedDate(state.user.updatedAt)}}
              q-separator.q-my-sm(inset)
              q-item
                blueprint-icon(icon='enter', :hue-rotate='-45')
                q-item-section
                  q-item-label {{t(`admin.users.lastLoginAt`)}}
                  q-item-label: strong {{formattedDate(state.user.lastLoginAt)}}

            q-card.shadow-1.q-pb-sm.q-mt-md(v-if='state.user.meta')
              q-card-section
                .text-subtitle1 {{t('admin.users.notes')}}
                q-input.q-mt-sm(
                  outlined
                  v-model='state.user.meta.notes'
                  type='textarea'
                  :aria-label='t(`admin.users.notes`)'
                  input-style='min-height: 243px'
                  :hint='t(`admin.users.noteHint`)'
                )

    q-page(v-else-if='route.params.section === `activity`')
      span ---

    q-page(v-else-if='route.params.section === `auth`')
      .q-pa-md
        .row.q-col-gutter-md
          .col-12.col-lg-7
            q-card.shadow-1.q-pb-sm
              q-card-section
                .text-subtitle1 {{t('admin.users.passAuth')}}
              q-item
                blueprint-icon(icon='password', :hue-rotate='45')
                q-item-section
                  q-item-label {{t(`admin.users.changePassword`)}}
                  q-item-label(caption) {{t(`admin.users.changePasswordHint`)}}
                  q-item-label(caption): strong(:class='localAuth.isPasswordSet ? `text-positive` : `text-negative`') {{localAuth.isPasswordSet ? t(`admin.users.pwdSet`) : t(`admin.users.pwdNotSet`)}}
                q-item-section(side)
                  q-btn.acrylic-btn(
                    flat
                    icon='las la-arrow-circle-right'
                    color='primary'
                    @click='changePassword'
                    :label='t(`common.actions.proceed`)'
                  )
              q-separator.q-my-sm(inset)
              q-item(tag='label', v-ripple)
                blueprint-icon(icon='password-reset')
                q-item-section
                  q-item-label {{t(`admin.users.mustChangePwd`)}}
                  q-item-label(caption) {{t(`admin.users.mustChangePwdHint`)}}
                q-item-section(avatar)
                  q-toggle(
                    v-model='localAuth.mustChangePwd'
                    color='primary'
                    checked-icon='las la-check'
                    unchecked-icon='las la-times'
                    :aria-label='t(`admin.users.mustChangePwd`)'
                  )
              q-separator.q-my-sm(inset)
              q-item(tag='label', v-ripple)
                blueprint-icon(icon='key')
                q-item-section
                  q-item-label {{t(`admin.users.pwdAuthRestrict`)}}
                  q-item-label(caption) {{t(`admin.users.pwdAuthRestrictHint`)}}
                q-item-section(avatar)
                  q-toggle(
                    v-model='localAuth.restrictLogin'
                    color='primary'
                    checked-icon='las la-check'
                    unchecked-icon='las la-times'
                    :aria-label='t(`admin.users.pwdAuthRestrict`)'
                  )

            q-card.shadow-1.q-pb-sm.q-mt-md
              q-card-section
                .text-subtitle1 {{t('admin.users.tfa')}}
              q-item(tag='label', v-ripple)
                blueprint-icon(icon='key')
                q-item-section
                  q-item-label {{t(`admin.users.tfaRequired`)}}
                  q-item-label(caption) {{t(`admin.users.tfaRequiredHint`)}}
                q-item-section(avatar)
                  q-toggle(
                    v-model='localAuth.isTfaRequired'
                    color='primary'
                    checked-icon='las la-check'
                    unchecked-icon='las la-times'
                    :aria-label='t(`admin.users.tfaRequired`)'
                  )
              q-separator.q-my-sm(inset)
              q-item
                blueprint-icon(icon='password', :hue-rotate='45')
                q-item-section
                  q-item-label {{t(`admin.users.tfaInvalidate`)}}
                  q-item-label(caption) {{t(`admin.users.tfaInvalidateHint`)}}
                  q-item-label(caption): strong(:class='localAuth.isTfaSetup ? `text-positive` : `text-negative`') {{localAuth.isTfaSetup ? t(`admin.users.tfaSet`) : t(`admin.users.tfaNotSet`)}}
                q-item-section(side)
                  q-btn.acrylic-btn(
                    flat
                    icon='las la-arrow-circle-right'
                    color='primary'
                    @click='invalidateTFA'
                    :label='t(`common.actions.proceed`)'
                  )
          .col-12.col-lg-5
            q-card.shadow-1.q-pb-sm
              q-card-section
                .text-subtitle1 {{t('admin.users.linkedProviders')}}
                q-banner.q-mt-md(
                  v-if='linkedAuthProviders.length < 1'
                  rounded
                  :class='$q.dark.isActive ? `bg-negative text-white` : `bg-grey-2 text-grey-7`'
                  ) {{t('admin.users.noLinkedProviders')}}
              template(
                v-for='(prv, idx) in linkedAuthProviders'
                :key='prv.authId'
                )
                q-separator.q-my-sm(inset, v-if='idx > 0')
                q-item
                  blueprint-icon(:icon='prv.strategyIcon', :hue-rotate='-45')
                  q-item-section
                    q-item-label {{prv.authName}}
                    q-item-label(caption) {{prv.config.key}}

    q-page(v-else-if='route.params.section === `groups`')
      .q-pa-md
        .row.q-col-gutter-md
          .col-12.col-lg-8
            q-card.shadow-1.q-pb-sm
              q-card-section
                .text-subtitle1 {{t('admin.users.groups')}}
              template(
                v-for='(grp, idx) of state.user.groups'
                :key='grp.id'
                )
                q-separator.q-my-sm(inset, v-if='idx > 0')
                q-item
                  blueprint-icon(icon='team', :hue-rotate='-45')
                  q-item-section
                    q-item-label {{grp.name}}
                  q-item-section(side)
                    q-btn.acrylic-btn(
                      flat
                      icon='las la-times'
                      color='accent'
                      @click='unassignGroup(grp.id)'
                      :aria-label='t(`admin.users.unassignGroup`)'
                      )
                      q-tooltip(anchor='center left' self='center right') {{t('admin.users.unassignGroup')}}
            q-card.shadow-1.q-py-sm.q-mt-md
              q-item
                blueprint-icon(icon='join')
                q-item-section
                  q-select(
                    outlined
                    :options='state.groups'
                    v-model='state.groupToAdd'
                    map-options
                    emit-value
                    option-value='id'
                    option-label='name'
                    options-dense
                    dense
                    hide-bottom-space
                    :label='t(`admin.users.groups`)'
                    :aria-label='t(`admin.users.groups`)'
                    :loading='state.loading > 0'
                    )
                q-item-section(side)
                  q-btn(
                    unelevated
                    icon='las la-plus'
                    :label='t(`admin.users.assignGroup`)'
                    color='primary'
                    @click='assignGroup'
                  )

    q-page(v-else-if='route.params.section === `metadata`')
      .q-pa-md
        .row.q-col-gutter-md
          .col-12.col-lg-8
            q-card.shadow-1.q-pb-sm
              q-card-section.flex.items-center
                .text-subtitle1 {{t('admin.users.metadata')}}
                q-space
                q-badge(
                  v-if='state.metadataInvalidJSON'
                  color='negative'
                  )
                  q-icon.q-mr-xs(name='las la-exclamation-triangle', size='20px')
                  span {{t('admin.users.invalidJSON')}}
                q-badge.q-py-xs(
                  v-else
                  label='JSON'
                  color='positive'
                )
              q-item
                q-item-section
                  q-no-ssr(:placeholder='t(`common.loading`)')
                    util-code-editor.admin-theme-cm(
                      v-model='metadata'
                      language='json'
                      :min-height='500'
                    )

    q-page(v-else-if='route.params.section === `operations`')
      .q-pa-md
        .row.q-col-gutter-md
          .col-12.col-lg-8
            q-card.shadow-1.q-pb-sm
              q-card-section
                .text-subtitle1 {{t('admin.users.operations')}}
              q-item
                blueprint-icon(icon='email-open', :hue-rotate='45')
                q-item-section
                  q-item-label {{t(`admin.users.sendWelcomeEmail`)}}
                  q-item-label(caption) {{t(`admin.users.sendWelcomeEmailAltHint`)}}
                q-item-section(side)
                  q-btn.acrylic-btn(
                    flat
                    icon='las la-arrow-circle-right'
                    color='primary'
                    @click='sendWelcomeEmail'
                    :label='t(`common.actions.proceed`)'
                  )
              q-separator.q-my-sm(inset)
              q-item
                blueprint-icon(icon='apply', :hue-rotate='45')
                q-item-section
                  q-item-label {{state.user.isVerified ? t(`admin.users.unverify`) : t(`admin.users.verify`)}}
                  q-item-label(caption) {{state.user.isVerified ? t(`admin.users.unverifyHint`) : t(`admin.users.verifyHint`)}}
                  q-item-label(caption): strong(:class='state.user.isVerified ? `text-positive` : `text-negative`') {{state.user.isVerified ? t(`admin.users.verified`) : t(`admin.users.unverified`)}}
                q-item-section(side)
                  q-btn.acrylic-btn(
                    flat
                    icon='las la-arrow-circle-right'
                    color='primary'
                    @click='toggleVerified'
                    :label='t(`common.actions.proceed`)'
                  )
              q-separator.q-my-sm(inset)
              q-item
                blueprint-icon(icon='unfriend', :hue-rotate='45')
                q-item-section
                  q-item-label {{state.user.isActive ? t(`admin.users.ban`) : t(`admin.users.unban`)}}
                  q-item-label(caption) {{state.user.isActive ? t(`admin.users.banHint`) : t(`admin.users.unbanHint`)}}
                  q-item-label(caption): strong(:class='state.user.isActive ? `text-positive` : `text-negative`') {{state.user.isActive ? t(`admin.users.active`) : t(`admin.users.banned`)}}
                q-item-section(side)
                  q-btn.acrylic-btn(
                    flat
                    icon='las la-arrow-circle-right'
                    color='primary'
                    @click='toggleBan'
                    :label='t(`common.actions.proceed`)'
                  )
            q-card.shadow-1.q-py-sm.q-mt-md
              q-item
                blueprint-icon(icon='denied', :hue-rotate='140')
                q-item-section
                  q-item-label {{t(`admin.users.delete`)}}
                  q-item-label(caption) {{t(`admin.users.deleteHint`)}}
                q-item-section(side)
                  q-btn.acrylic-btn(
                    flat
                    icon='las la-arrow-circle-right'
                    color='negative'
                    @click='deleteUser'
                    :label='t(`common.actions.proceed`)'
                  )
</template>

<script setup>
import gql from 'graphql-tag'
import { cloneDeep, find, map, some } from 'lodash-es'
import { DateTime } from 'luxon'

import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { computed, onMounted, reactive, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { useAdminStore } from '@/stores/admin'
import { useFlagsStore } from '@/stores/flags'
import { useUserStore } from '@/stores/user'

import UserChangePwdDialog from './UserChangePwdDialog.vue'
import UtilCodeEditor from './UtilCodeEditor.vue'

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()
const flagsStore = useFlagsStore()
const userStore = useUserStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  invalidCharsRegex: /^[^<>"]+$/,
  user: {
    meta: {},
    prefs: {},
    groups: []
  },
  groups: [],
  groupToAdd: null,
  loading: 0,
  metadataInvalidJSON: false
})

const sections = [
  { key: 'overview', text: t('admin.users.overview'), icon: 'las la-user' },
  { key: 'activity', text: t('admin.users.activity'), icon: 'las la-chart-area', disabled: true },
  { key: 'auth', text: t('admin.users.auth'), icon: 'las la-key' },
  { key: 'groups', text: t('admin.users.groups'), icon: 'las la-users' },
  { key: 'metadata', text: t('admin.users.metadata'), icon: 'las la-clipboard-list' },
  { key: 'operations', text: t('admin.users.operations'), icon: 'las la-tools' }
]

const timezones = Intl.supportedValuesOf('timeZone')

// COMPUTED

const metadata = computed({
  get () { return JSON.stringify(state.user.meta ?? {}, null, 2) },
  set (val) {
    try {
      state.user.meta = JSON.parse(val)
      state.metadataInvalidJSON = false
    } catch (err) {
      state.metadataInvalidJSON = true
    }
  }
})

const localAuth = computed({
  get () {
    return find(state.user?.auth, ['strategyKey', 'local'])?.config ?? {}
  },
  set (val) {
    if (localAuth.value.authId) {
      find(state.user.auth, ['strategyKey', 'local']).config = val
    }
  }
})

const linkedAuthProviders = computed(() => {
  if (!state.user?.auth) { return [] }

  return state.user.auth.filter(prv => prv.strategyKey !== 'local')
})

// WATCHERS

watch(() => route.params.section, checkRoute)

// METHODS

async function fetchUser () {
  state.loading++
  $q.loading.show()
  try {
    const resp = await APOLLO_CLIENT.query({
      query: gql`
        query adminFetchUser (
          $id: UUID!
          ) {
          groups {
            id
            name
          }
          userById(
            id: $id
          ) {
            id
            email
            name
            isSystem
            isVerified
            isActive
            auth {
              authId
              authName
              strategyKey
              strategyIcon
              config
            }
            meta
            prefs
            lastLoginAt
            createdAt
            updatedAt
            groups {
              id
              name
            }
          }
        }
      `,
      variables: {
        id: adminStore.overlayOpts.id
      },
      fetchPolicy: 'network-only'
    })
    state.groups = resp?.data?.groups?.filter(g => g.id !== '10000000-0000-4000-8000-000000000001') ?? []
    if (resp?.data?.userById) {
      state.user = cloneDeep(resp.data.userById)
    } else {
      throw new Error('An unexpected error occured while fetching user details.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  $q.loading.hide()
  state.loading--
}

function close () {
  adminStore.$patch({ overlay: '' })
}

function checkRoute () {
  if (!route.params.section) {
    router.replace({ params: { section: 'overview' } })
  }
  if (route.params.section === 'metadata') {
    state.metadataInvalidJSON = false
  }
}

function formattedDate (val) {
  if (!val) { return '---' }
  return DateTime.fromISO(val).toLocaleString(DateTime.DATETIME_FULL)
}

function assignGroup () {
  if (!state.groupToAdd) {
    $q.notify({
      type: 'negative',
      message: t('admin.users.noGroupSelected')
    })
  } else if (some(state.user.groups, gr => gr.id === state.groupToAdd)) {
    $q.notify({
      type: 'warning',
      message: t('admin.users.groupAlreadyAssigned')
    })
  } else {
    const newGroup = find(state.groups, ['id', state.groupToAdd])
    state.user.groups = [...state.user.groups, newGroup]
  }
}

function unassignGroup (id) {
  if (state.user.groups.length <= 1) {
    $q.notify({
      type: 'negative',
      message: t('admin.users.minimumGroupRequired')
    })
  } else {
    state.user.groups = state.user.groups.filter(gr => gr.id === id)
  }
}

async function save (patch, { silent, keepOpen } = { silent: false, keepOpen: false }) {
  $q.loading.show()
  if (!patch) {
    patch = {
      name: state.user.name,
      email: state.user.email,
      isVerified: state.user.isVerified,
      isActive: state.user.isActive,
      meta: state.user.meta,
      prefs: state.user.prefs,
      groups: state.user.groups.map(gr => gr.id),
      auth: {
        tfaRequired: localAuth.value.isTfaRequired,
        mustChangePwd: localAuth.value.mustChangePwd,
        restrictLogin: localAuth.value.restrictLogin
      }
    }
  }
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation adminSaveUser (
          $id: UUID!
          $patch: UserUpdateInput!
          ) {
          updateUser (
            id: $id
            patch: $patch
            ) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        id: adminStore.overlayOpts.id,
        patch
      }
    })
    if (resp?.data?.updateUser?.operation?.succeeded) {
      if (!silent) {
        $q.notify({
          type: 'positive',
          message: t('admin.users.saveSuccess')
        })
      }
      if (!keepOpen) {
        close()
      }
    } else {
      throw new Error(resp?.data?.updateUser?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  $q.loading.hide()
}

function changePassword () {
  $q.dialog({
    component: UserChangePwdDialog,
    componentProps: {
      userId: adminStore.overlayOpts.id
    }
  }).onOk(({ mustChangePassword }) => {
    localAuth.value = {
      ...localAuth.value,
      mustChangePwd: mustChangePassword
    }
  })
}

function invalidateTFA () {
  $q.dialog({
    title: t('admin.users.tfaInvalidate'),
    message: t('admin.users.tfaInvalidateConfirm'),
    cancel: true,
    persistent: true,
    ok: {
      label: t('common.actions.confirm')
    }
  }).onOk(() => {
    // TODO: invalidate user 2FA
    $q.notify({
      type: 'positive',
      message: t('admin.users.tfaInvalidateSuccess')
    })
  })
}

async function sendWelcomeEmail () {

}

function toggleVerified () {
  state.user.isVerified = !state.user.isVerified
  save({
    isVerified: state.user.isVerified
  }, { silent: true, keepOpen: true })
}

function toggleBan () {
  state.user.isActive = !state.user.isActive
  save({
    isActive: state.user.isActive
  }, { silent: true, keepOpen: true })
}

async function deleteUser () {

}

// MOUNTED

onMounted(() => {
  checkRoute()
  fetchUser()
})

</script>

<style lang="scss" scoped>
.metadata-codemirror {
  &:deep(.cm-editor) {
    min-height: 150px;
    border-radius: 5px;
    border: 1px solid #CCC;
  }
}
</style>
