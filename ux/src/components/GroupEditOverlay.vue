<template lang="pug">
q-layout(view='hHh lpR fFf', container)
  q-header.card-header.q-px-md.q-py-sm
    q-icon(name='img:/_assets/icons/fluent-people.svg', left, size='md')
    div
      span {{t(`admin.groups.edit`)}}
      .text-caption {{state.group.name}}
    q-space
    q-btn-group(push)
      q-btn(
        push
        color='grey-6'
        text-color='white'
        :aria-label='t(`common.actions.refresh`)'
        icon='las la-redo-alt'
        @click='refresh'
        )
        q-tooltip(anchor='center left', self='center right') {{t(`common.actions.refresh`)}}
      q-btn(
        push
        color='white'
        text-color='grey-7'
        :label='t(`common.actions.close`)'
        icon='las la-times'
        @click='close'
      )
      q-btn(
        push
        color='positive'
        text-color='white'
        :label='t(`common.actions.save`)'
        icon='las la-check'
      )
  q-drawer.bg-dark-6(:model-value='true', :width='250', dark)
    q-list(padding, v-show='!state.isLoading')
      q-item(
        v-for='sc of sections'
        :key='`section-` + sc.key'
        clickable
        :to='{ params: { section: sc.key } }'
        active-class='bg-primary text-white'
        :disabled='sc.disabled'
        )
        q-item-section(side)
          q-icon(:name='sc.icon', color='white')
        q-item-section {{sc.text}}
        q-item-section(side, v-if='sc.usersTotal')
          q-badge(color='dark-3', :label='state.usersTotal')
        q-item-section(side, v-if='sc.rulesTotal && state.group.rules')
          q-badge(color='dark-3', :label='state.group.rules.length')
  q-page-container
    q-page(v-if='state.isLoading')
    //- -----------------------------------------------------------------------
    //- OVERVIEW
    //- -----------------------------------------------------------------------
    q-page(v-else-if='route.params.section === `overview`')
      .q-pa-md
        .row.q-col-gutter-md
          .col-12.col-lg-8
            q-card.shadow-1.q-pb-sm
              q-card-section
                .text-subtitle1 {{t('admin.groups.general')}}
              q-item
                blueprint-icon(icon='team')
                q-item-section
                  q-item-label {{t(`admin.groups.name`)}}
                  q-item-label(caption) {{t(`admin.groups.nameHint`)}}
                q-item-section
                  q-input(
                    outlined
                    v-model='state.group.name'
                    dense
                    :rules='groupNameValidation'
                    hide-bottom-space
                    :aria-label='t(`admin.groups.name`)'
                    )

            q-card.shadow-1.q-pb-sm.q-mt-md
              q-card-section
                .text-subtitle1 {{t('admin.groups.authBehaviors')}}
              q-item
                blueprint-icon(icon='double-right')
                q-item-section
                  q-item-label {{t(`admin.groups.redirectOnLogin`)}}
                  q-item-label(caption) {{t(`admin.groups.redirectOnLoginHint`)}}
                q-item-section
                  q-input(
                    outlined
                    v-model='state.group.redirectOnLogin'
                    dense
                    :aria-label='t(`admin.groups.redirectOnLogin`)'
                    )
              q-separator.q-my-sm(inset)
              q-item
                blueprint-icon(icon='chevron-right')
                q-item-section
                  q-item-label {{t(`admin.groups.redirectOnFirstLogin`)}}
                  q-item-label(caption) {{t(`admin.groups.redirectOnFirstLoginHint`)}}
                q-item-section
                  q-input(
                    outlined
                    v-model='state.group.redirectOnFirstLogin'
                    dense
                    :aria-label='t(`admin.groups.redirectOnLogin`)'
                    )
              q-separator.q-my-sm(inset)
              q-item
                blueprint-icon(icon='exit')
                q-item-section
                  q-item-label {{t(`admin.groups.redirectOnLogout`)}}
                  q-item-label(caption) {{t(`admin.groups.redirectOnLogoutHint`)}}
                q-item-section
                  q-input(
                    outlined
                    v-model='state.group.redirectOnLogout'
                    dense
                    :aria-label='t(`admin.groups.redirectOnLogout`)'
                    )

          .col-12.col-lg-4
            q-card.shadow-1.q-pb-sm
              q-card-section
                .text-subtitle1 {{t('admin.groups.info')}}
              q-item
                blueprint-icon(icon='team', :hue-rotate='-45')
                q-item-section
                  q-item-label {{t(`common.field.id`)}}
                  q-item-label: strong {{state.group.id}}
              q-separator.q-my-sm(inset)
              q-item
                blueprint-icon(icon='calendar-plus', :hue-rotate='-45')
                q-item-section
                  q-item-label {{t(`common.field.createdOn`)}}
                  q-item-label: strong {{humanizeDate(state.group.createdAt)}}
              q-separator.q-my-sm(inset)
              q-item
                blueprint-icon(icon='summertime', :hue-rotate='-45')
                q-item-section
                  q-item-label {{t(`common.field.lastUpdated`)}}
                  q-item-label: strong {{humanizeDate(state.group.updatedAt)}}
    //- -----------------------------------------------------------------------
    //- RULES
    //- -----------------------------------------------------------------------
    q-page(v-else-if='route.params.section === `rules`')
      q-toolbar.q-pl-md(
        :class='$q.dark.isActive ? `bg-dark-3` : `bg-white`'
        )
        .text-subtitle1 {{t('admin.groups.rules')}}
        q-space
        q-btn.acrylic-btn.q-mr-sm(
          icon='las la-question-circle'
          flat
          color='grey'
          type='a'
          href='https://docs.js.wiki/admin/groups#rules'
          target='_blank'
          )
        q-btn.acrylic-btn.q-mr-sm(
          flat
          color='indigo'
          icon='las la-file-export'
          @click='exportRules'
          )
          q-tooltip {{t('admin.groups.exportRules')}}
        q-btn.acrylic-btn.q-mr-sm(
          flat
          color='indigo'
          icon='las la-file-import'
          @click='importRules'
          )
          q-tooltip {{t('admin.groups.importRules')}}
        q-btn(
          unelevated
          color='primary'
          icon='las la-plus'
          label='New Rule'
          @click='newRule'
        )
      q-separator
      .q-pa-md
        q-banner(
          v-if='!state.group.rules || state.group.rules.length < 1'
          rounded
          :class='$q.dark.isActive ? `bg-negative text-white` : `bg-grey-4 text-grey-9`'
          ) {{t('admin.groups.rulesNone')}}
        q-card.shadow-1.q-pb-sm(v-else)
          q-card-section
            .admin-groups-rule(
              v-for='(rule, idx) of state.group.rules'
              :key='rule.id'
              )
              .admin-groups-rule-icon(:class='getRuleModeColor(rule.mode)')
                q-icon.cursor-pointer(
                  :name='getRuleModeIcon(rule.mode)'
                  color='white'
                  @click='rule.mode = getNextRuleMode(rule.mode)'
                )
              .admin-groups-rule-name
                .admin-groups-rule-name-text: strong(:class='getRuleModeColor(rule.mode)') {{getRuleModeName(rule.mode)}}
                q-separator.q-ml-sm.q-mr-xs(vertical)
                input(
                  type='text'
                  v-model='rule.name'
                  placeholder='Rule Name'
                )
              q-card.admin-groups-rule-card.q-mt-md(flat)
                q-card-section.admin-groups-rule-card-permissions(:class='getRuleModeClass(rule.mode)')
                  q-select.q-mt-xs(
                    standout
                    v-model='rule.roles'
                    emit-value
                    map-options
                    dense
                    :aria-label='t(`admin.groups.ruleSites`)'
                    :options='rules'
                    placeholder='Select permissions...'
                    option-value='permission'
                    option-label='title'
                    options-dense
                    multiple
                    use-chips
                    stack-label
                    )
                    template(v-slot:option='{ itemProps, itemEvents, opt, selected, toggleOption }')
                      q-item(v-bind='itemProps', v-on='itemEvents')
                        q-item-section(side)
                          q-toggle(
                            :value='selected'
                            @input='toggleOption(opt)'
                            color='primary'
                            checked-icon='las la-check'
                            unchecked-icon='las la-times'
                            :aria-label='opt.label'
                          )
                        //- q-item-section(side, style='flex-basis: 150px;')
                        //-   q-chip.text-caption(
                        //-     square
                        //-     color='teal'
                        //-     text-color='white'
                        //-     dense
                        //-   ) {{opt.permission}}
                        q-item-section
                          q-item-label {{opt.title}}
                          q-item-label(caption) {{opt.hint}}
                  q-btn.acrylic-btn.q-ml-md(
                    flat
                    icon='las la-trash'
                    color='negative'
                    padding='sm sm'
                    size='md',
                    @click='deleteRule(rule.id)'
                  )
                q-card-section(horizontal)
                  q-card-section.admin-groups-rule-card-filters
                    .text-caption Applies to...
                    q-select.q-mt-xs(
                      standout
                      v-model='rule.sites'
                      emit-value
                      map-options
                      dense
                      :aria-label='t(`admin.groups.ruleSites`)'
                      :options='adminStore.sites'
                      option-value='id'
                      option-label='title'
                      multiple
                      behavior='dialog'
                      :display-value='t(`admin.groups.selectedSites`, rule.sites.length, { count: rule.sites.length })'
                      )
                      template(v-slot:option='{ itemProps, itemEvents, opt, selected, toggleOption }')
                        q-item(v-bind='itemProps', v-on='itemEvents')
                          q-item-section
                            q-item-label {{opt.title}}
                          q-item-section(side)
                            q-toggle(
                              :value='selected'
                              @input='toggleOption(opt)'
                              color='primary'
                              checked-icon='las la-check'
                              unchecked-icon='las la-times'
                              :aria-label='opt.label'
                            )
                    q-select.q-mt-sm(
                      standout
                      v-model='rule.locales'
                      emit-value
                      map-options
                      dense
                      :aria-label='t(`admin.groups.ruleLocales`)'
                      :options='adminStore.locales'
                      option-value='code'
                      option-label='name'
                      multiple
                      behavior='dialog'
                      :display-value='t(`admin.groups.selectedLocales`, rule.locales.length, { count: rule.locales.length, locale: rule.locales.length === 1 ? rule.locales[0].toUpperCase() : `` })'
                      )
                      template(v-slot:option='{ itemProps, opt, selected, toggleOption }')
                        q-item(v-bind='itemProps')
                          q-item-section
                            q-item-label {{opt.name}}
                          q-item-section(side)
                            q-toggle(
                              :model-value='selected'
                              @update:model-value='toggleOption(opt)'
                              color='primary'
                              checked-icon='las la-check'
                              unchecked-icon='las la-times'
                              :aria-label='opt.name'
                            )
                  q-card-section.admin-groups-rule-card-pattern
                    .text-caption Pattern
                    q-select.q-mt-xs(
                      standout
                      v-model='rule.match'
                      emit-value
                      map-options
                      dense
                      :aria-label='t(`admin.groups.ruleMatch`)'
                      :options=`[
                        { label: t('admin.groups.ruleMatchStart'), value: 'START' },
                        { label: t('admin.groups.ruleMatchEnd'), value: 'END' },
                        { label: t('admin.groups.ruleMatchRegex'), value: 'REGEX' },
                        { label: t('admin.groups.ruleMatchTag'), value: 'TAG' },
                        { label: t('admin.groups.ruleMatchTagAll'), value: 'TAGALL' },
                        { label: t('admin.groups.ruleMatchExact'), value: 'EXACT' }
                      ]`
                    )
                    q-input.q-mt-sm(
                      standout
                      v-model='rule.path'
                      dense
                      :prefix='[`START`, `REGEX`, `EXACT`].includes(rule.match) ? `/` : null'
                      :suffix='rule.match === `REGEX` ? `/` : null'
                      :aria-label='t(`admin.groups.rulePath`)'
                    )
    //- -----------------------------------------------------------------------
    //- PERMISSIONS
    //- -----------------------------------------------------------------------
    q-page(v-else-if='route.params.section === `permissions`')
      .q-pa-md
        .row.q-col-gutter-md
          .col-12.col-lg-6
            q-card.shadow-1.q-pb-sm
              .flex.justify-between
                q-card-section
                  .text-subtitle1 {{t(`admin.groups.permissions`)}}
                q-card-section
                  q-btn.acrylic-btn(
                    icon='las la-question-circle'
                    flat
                    color='grey'
                    type='a'
                    href='https://docs.js.wiki/admin/groups#permissions'
                    target='_blank'
                    )
              template(v-for='(perm, idx) of permissions', :key='perm.permission')
                q-item(tag='label', v-ripple)
                  q-item-section.items-center(style='flex: 0 0 40px;')
                    q-icon(
                      name='las la-comments'
                      color='primary'
                      size='sm'
                      )
                  q-item-section
                    q-item-label {{perm.permission}}
                    q-item-label(caption) {{perm.hint}}
                  q-item-section(avatar)
                    q-toggle(
                      v-model='state.group.permissions'
                      :val='perm.permission'
                      color='primary'
                      checked-icon='las la-check'
                      unchecked-icon='las la-times'
                      :aria-label='t(`admin.general.allowComments`)'
                      )
                q-separator.q-my-sm(inset, v-if='idx < permissions.length - 1')
    //- -----------------------------------------------------------------------
    //- USERS
    //- -----------------------------------------------------------------------
    q-page(v-else-if='route.params.section === `users`')
      q-toolbar(
        :class='$q.dark.isActive ? `bg-dark-3` : `bg-white`'
        )
        .text-subtitle1 {{t('admin.groups.users')}}
        q-space
        q-btn.acrylic-btn.q-mr-sm(
          icon='las la-question-circle'
          flat
          color='grey'
          type='a'
          href='https://docs.js.wiki/admin/groups#users'
          target='_blank'
          )
        q-input.denser.fill-outline.q-mr-sm(
          outlined
          v-model='state.usersFilter'
          :placeholder='t(`admin.groups.filterUsers`)'
          dense
          )
          template(#prepend)
            q-icon(name='las la-search')
        q-btn.q-mr-sm.acrylic-btn(
          icon='las la-redo-alt'
          flat
          color='secondary'
          @click='refreshUsers'
          )
        q-btn.q-mr-xs(
          unelevated
          icon='las la-user-plus'
          :label='t(`admin.groups.assignUser`)'
          color='primary'
          @click='assignUser'
          )
      q-separator
      .q-pa-md
        q-banner(
          v-if='!state.users || state.users.length < 1'
          rounded
          :class='$q.dark.isActive ? `bg-negative text-white` : `bg-grey-4 text-grey-9`'
          ) {{t('admin.groups.usersNone')}}
        q-card.shadow-1
          q-table(
            :rows='state.users'
            :columns='usersHeaders'
            row-key='id'
            flat
            hide-header
            hide-bottom
            :rows-per-page-options='[0]'
            :loading='state.isLoadingUsers'
            )
            template(v-slot:body-cell-id='props')
              q-td(:props='props')
                q-icon(name='las la-user', color='primary', size='sm')
            template(v-slot:body-cell-name='props')
              q-td(:props='props')
                .flex.items-center
                  strong {{props.value}}
                  q-icon.q-ml-sm(
                    v-if='props.row.isSystem'
                    name='las la-lock'
                    color='pink'
                    )
                  q-icon.q-ml-sm(
                    v-if='!props.row.isActive'
                    name='las la-ban'
                    color='pink'
                    )
            template(v-slot:body-cell-email='props')
              q-td(:props='props')
                em {{ props.value }}
            template(v-slot:body-cell-date='props')
              q-td(:props='props')
                i18n-t.text-caption(keypath='admin.users.createdAt', tag='div')
                  template(#date)
                    strong {{ humanizeDate(props.value) }}
                i18n-t.text-caption(
                  v-if='props.row.lastLoginAt'
                  keypath='admin.users.lastLoginAt'
                  tag='div'
                  )
                  template(#date)
                    strong {{ humanizeDate(props.row.lastLoginAt) }}
            template(v-slot:body-cell-edit='props')
              q-td(:props='props')
                q-btn.acrylic-btn.q-mr-sm(
                  v-if='!props.row.isSystem'
                  flat
                  :to='`/_admin/users/` + props.row.id'
                  icon='las la-pen'
                  color='indigo'
                  :label='t(`common.actions.edit`)'
                  no-caps
                  )
                q-btn.acrylic-btn(
                  v-if='!props.row.isSystem'
                  flat
                  icon='las la-user-minus'
                  color='accent'
                  @click='unassignUser(props.row)'
                  )

        .flex.flex-center.q-mt-md(v-if='usersTotalPages > 1')
          q-pagination(
            v-model='state.usersPage'
            :max='usersTotalPages'
            :max-pages='9'
            boundary-numbers
            direction-links
          )
</template>

<script setup>
import gql from 'graphql-tag'
import { DateTime } from 'luxon'
import cloneDeep from 'lodash/cloneDeep'
import some from 'lodash/some'
import { v4 as uuid } from 'uuid'
import { fileOpen } from 'browser-fs-access'

import { useI18n } from 'vue-i18n'
import { exportFile, useQuasar } from 'quasar'
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { useAdminStore } from 'src/stores/admin'

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  group: {
    rules: []
  },
  isLoading: false,
  users: [],
  isLoadingUsers: false,
  usersFilter: '',
  usersPage: 1,
  usersPageSize: 15,
  usersTotal: 0
})

const sections = [
  { key: 'overview', text: t('admin.groups.overview'), icon: 'las la-users' },
  { key: 'rules', text: t('admin.groups.rules'), icon: 'las la-file-invoice', rulesTotal: true },
  { key: 'permissions', text: t('admin.groups.permissions'), icon: 'las la-list-alt' },
  { key: 'users', text: t('admin.groups.users'), icon: 'las la-user', usersTotal: true }
]

const usersHeaders = [
  {
    align: 'center',
    field: 'id',
    name: 'id',
    sortable: false,
    style: 'width: 20px'
  },
  {
    label: t('common.field.name'),
    align: 'left',
    field: 'name',
    name: 'name',
    sortable: true
  },
  {
    label: t('admin.users.email'),
    align: 'left',
    field: 'email',
    name: 'email',
    sortable: false
  },
  {
    align: 'left',
    field: 'createdAt',
    name: 'date',
    sortable: false
  },
  {
    label: '',
    align: 'right',
    field: 'edit',
    name: 'edit',
    sortable: false,
    style: 'width: 250px'
  }
]

const permissions = [
  {
    permission: 'write:users',
    hint: 'Can create or authorize new users, but not modify existing ones',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'manage:users',
    hint: 'Can manage all users (but not users with administrative permissions)',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'write:groups',
    hint: 'Can manage groups and assign CONTENT permissions / page rules',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'manage:groups',
    hint: 'Can manage groups and assign ANY permissions (but not manage:system) / page rules',
    warning: true,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'manage:navigation',
    hint: 'Can manage the site navigation',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'manage:theme',
    hint: 'Can manage and modify themes',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'manage:api',
    hint: 'Can generate and revoke API keys',
    warning: true,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'manage:system',
    hint: 'Can manage and access everything. Root administrator.',
    warning: true,
    restrictedForSystem: true,
    disabled: true

  }
]

const rules = [
  {
    permission: 'read:pages',
    title: 'Read Pages',
    hint: 'Can view and search pages.',
    warning: false,
    restrictedForSystem: false,
    disabled: false
  },
  {
    permission: 'write:pages',
    title: 'Write Pages',
    hint: 'Can create and edit pages.',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'review:pages',
    title: 'Review Pages',
    hint: 'Can review and approve edits submitted by users.',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'manage:pages',
    title: 'Manage Pages',
    hint: 'Can move existing pages to other locations the user has write access to.',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'delete:pages',
    title: 'Delete Pages',
    hint: 'Can delete existing pages.',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'write:styles',
    title: 'Use CSS',
    hint: 'Can insert CSS styles in pages.',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'write:scripts',
    title: 'Use JavaScript',
    hint: 'Can insert JavaScript in pages.',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'read:source',
    title: 'View Pages Source',
    hint: 'Can view pages source.',
    warning: false,
    restrictedForSystem: false,
    disabled: false
  },
  {
    permission: 'read:history',
    title: 'View Page History',
    hint: 'Can view previous versions of pages.',
    warning: false,
    restrictedForSystem: false,
    disabled: false
  },
  {
    permission: 'read:assets',
    title: 'View Assets',
    hint: 'Can view / use assets (such as images and files) in pages.',
    warning: false,
    restrictedForSystem: false,
    disabled: false
  },
  {
    permission: 'write:assets',
    title: 'Upload Assets',
    hint: 'Can upload new assets (such as images and files).',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'manage:assets',
    title: 'Manage Assets',
    hint: 'Can edit and delete existing assets (such as images and files).',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'read:comments',
    title: 'Read Comments',
    hint: 'Can view page comments.',
    warning: false,
    restrictedForSystem: false,
    disabled: false
  },
  {
    permission: 'write:comments',
    title: 'Write Comments',
    hint: 'Can post new comments on pages.',
    warning: false,
    restrictedForSystem: false,
    disabled: false
  },
  {
    permission: 'manage:comments',
    title: 'Manage Comments',
    hint: 'Can edit and delete existing page comments.',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  }
]

// VALIDATION RULES

const groupNameValidation = [
  val => /^[^<>"]+$/.test(val) || t('admin.groups.nameInvalidChars')
]

// COMPUTED

const usersTotalPages = computed(() => {
  if (state.usersTotal < 1) { return 0 }
  return Math.ceil(state.usersTotal / state.usersPageSize)
})

// WATCHERS

watch(() => route.params.section, checkRoute)
watch([() => state.usersPage, () => state.usersFilter], refreshUsers)

// METHODS

function close () {
  adminStore.$patch({ overlay: '' })
}

function checkRoute () {
  if (!route.params.section) {
    router.replace({ params: { section: 'overview' } })
  } else if (route.params.section === 'users') {
    refreshUsers()
  }
}

function humanizeDate (val) {
  if (!val) { return '---' }
  return DateTime.fromISO(val).toLocaleString(DateTime.DATETIME_FULL)
}

function getRuleModeColor (mode) {
  return ({
    DENY: 'text-negative',
    ALLOW: 'text-positive',
    FORCEALLOW: 'text-blue'
  })[mode]
}

function getRuleModeClass (mode) {
  return 'is-' + mode.toLowerCase()
}

function getRuleModeIcon (mode) {
  return ({
    DENY: 'las la-ban',
    ALLOW: 'las la-check',
    FORCEALLOW: 'las la-check-double'
  })[mode] || 'las la-frog'
}

function getNextRuleMode (mode) {
  return ({
    DENY: 'FORCEALLOW',
    ALLOW: 'DENY',
    FORCEALLOW: 'ALLOW'
  })[mode] || 'ALLOW'
}

function getRuleModeName (mode) {
  switch (mode) {
    case 'ALLOW': return t('admin.groups.ruleAllow')
    case 'DENY': return t('admin.groups.ruleDeny')
    case 'FORCEALLOW': return t('admin.groups.ruleForceAllow')
    default: return '???'
  }
}

function refresh () {
  fetchGroup()
}

async function fetchGroup () {
  state.isLoading = true
  try {
    const resp = await APOLLO_CLIENT.query({
      query: gql`
        query adminFetchGroup (
          $id: UUID!
          ) {
          groupById(
            id: $id
          ) {
            id
            name
            redirectOnLogin
            redirectOnFirstLogin
            redirectOnLogout
            isSystem
            permissions
            rules {
              id
              name
              path
              roles
              match
              mode
              locales
              sites
            }
            userCount
            createdAt
            updatedAt
          }
        }
      `,
      variables: {
        id: adminStore.overlayOpts.id
      },
      fetchPolicy: 'network-only'
    })
    if (resp?.data?.groupById) {
      state.group = cloneDeep(resp.data.groupById)
      state.usersTotal = state.group.userCount ?? 0
    } else {
      throw new Error('An unexpected error occured while fetching group details.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  state.isLoading = false
}

function newRule () {
  state.group.rules.push({
    id: uuid(),
    name: t('admin.groups.ruleUntitled'),
    mode: 'ALLOW',
    match: 'START',
    roles: [],
    path: '',
    locales: [],
    sites: []
  })
}

function deleteRule (id) {
  state.group.rules = state.group.rules.filter(r => r.id !== id)
}

function exportRules () {
  if (state.group.rules.length < 1) {
    return $q.notify({
      type: 'negative',
      message: t('admin.groups.exportRulesNoneError')
    })
  }
  exportFile('rules.json', JSON.stringify(state.group.rules, null, 2), { mimeType: 'application/json;charset=UTF-8' })
}

async function importRules () {
  try {
    const blob = await fileOpen({
      mimeTypes: ['application/json'],
      extensions: ['.json'],
      startIn: 'downloads',
      excludeAcceptAllOption: true
    })
    const rulesRaw = await blob.text()
    const rules = JSON.parse(rulesRaw)
    if (!Array.isArray(rules) || rules.length < 1) {
      throw new Error('Invalid Rules Format')
    }
    $q.dialog({
      title: t('admin.groups.importModeTitle'),
      message: t('admin.groups.importModeText'),
      options: {
        model: 'replace',
        type: 'radio',
        items: [
          { label: t('admin.groups.importModeReplace'), value: 'replace' },
          { label: t('admin.groups.importModeAdd'), value: 'add' }
        ]
      },
      persistent: true
    }).onOk(choice => {
      if (choice === 'replace') {
        state.group.rules = []
      }
      state.group.rules = [
        ...state.group.rules,
        ...rules.map(r => ({
          id: uuid(),
          name: r.name || t('admin.groups.ruleUntitled'),
          mode: ['ALLOW', 'DENY', 'FORCEALLOW'].includes(r.mode) ? r.mode : 'DENY',
          match: ['START', 'END', 'REGEX', 'TAG', 'TAGALL', 'EXACT'].includes(r.match) ? r.match : 'START',
          roles: r.roles || [],
          path: r.path || '',
          locales: r.locales.filter(l => some(adminStore.locales, ['code', l])),
          sites: r.sites.filter(s => some(adminStore.sites, ['id', s]))
        }))
      ]
      $q.notify({
        type: 'positive',
        message: t('admin.groups.importSuccess')
      })
    })
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: t('admin.groups.importFailed') + ` [${err.message}]`
    })
  }
}

async function refreshUsers () {
  state.isLoadingUsers = true
  try {
    const resp = await APOLLO_CLIENT.query({
      query: gql`
        query adminFetchGroupUsers (
          $filter: String
          $page: Int
          $pageSize: Int
          $groupId: UUID!
          ) {
          groupById (
            id: $groupId
          ) {
            id
            userCount
            users (
              filter: $filter
              page: $page
              pageSize: $pageSize
            ) {
              id
              name
              email
              isSystem
              isActive
              createdAt
              lastLoginAt
            }
          }
        }
      `,
      variables: {
        filter: state.usersFilter,
        page: state.usersPage,
        pageSize: state.usersPageSize,
        groupId: adminStore.overlayOpts.id
      },
      fetchPolicy: 'network-only'
    })
    if (resp?.data?.groupById?.users) {
      state.usersTotal = resp.data.groupById.userCount ?? 0
      state.users = cloneDeep(resp.data.groupById.users)
    } else {
      throw new Error('An unexpected error occured while fetching group users.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  state.isLoadingUsers = false
}

function assignUser () {

}

function unassignUser () {

}

// MOUNTED

onMounted(() => {
  checkRoute()
  fetchGroup()
})

</script>

<style lang="scss">
.admin-groups-rule {
  position: relative;
  padding: 10px 0 24px 40px;

  &-icon {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 31px;

    &::before {
      position: absolute;
      content: "";
      border-radius: 100%;
      width: 31px;
      height: 31px;
      background-color: currentColor;
      top: 4px;
    }

    &::after {
      position: absolute;
      content: "";
      width: 3px;
      top: 41px;
      bottom: 0;
      left: 14px;
      opacity: .4;
      background-color: currentColor;
      display: block;
    }

    .q-icon {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      font-size: 16px;
      height: 38px;
      line-height: 38px;
      width: 100%;
      align-items: center;
      justify-content: center;
      display: flex;
    }
  }

  &-name {
    line-height: 12px;
    display: flex;
    flex-wrap: nowrap;
    padding-top: 4px;

    &-text {
      flex: 0 0;
      white-space: nowrap;
    }

    input {
      font-weight: 700;
      color: $grey-6;
      letter-spacing: 1px;
      font-size: 12px;
      line-height: 12px;
      border: none;
      padding: 0 0 0 5px;
      outline: none;
      flex: 1;
      background-color: transparent;

      &::placeholder {
        color: $grey-5;
      }

      @at-root .body--dark & {
        color: rgba(255,255,255,.7);

        &::placeholder {
          color: rgba(255,255,255,.4);
        }
      }
    }
  }

  &-card {
    background-color: $grey-2 !important;

    @at-root .body--dark & {
      background-color: $dark-6 !important;
    }

    &-permissions {
      background-color: rgba($positive, .1);
      border-bottom: 1px solid rgba($positive, .3);
      display: flex;
      align-items: center;

      .q-select {
        flex-basis: 100%;
      }

      &.is-allow {
        background-color: rgba($positive, .1);
        border-bottom: 1px solid rgba($positive, .3);
      }
      &.is-deny {
        background-color: rgba($negative, .1);
        border-bottom: 1px solid rgba($negative, .3);
      }
      &.is-forceallow {
        background-color: rgba($blue, .1);
        border-bottom: 1px solid rgba($blue, .3);
      }
    }

    &-filters {
      background-color: $grey-3;
      flex-basis: 300px;

      .text-caption:first-child {
        color: $grey-7;
      }

      @at-root .body--dark & {
        background-color: $dark-5;
      }
    }
    &-pattern {
      flex-grow: 1;
    }
  }
}
</style>
