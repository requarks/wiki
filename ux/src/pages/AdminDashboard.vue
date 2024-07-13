<template lang='pug'>
q-page.admin-dashboard
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-apps-tab.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.dashboard.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.dashboard.subtitle') }}
  .row.q-px-md.q-col-gutter-sm
    .col-12.col-sm-6.col-lg-3
      q-card
        q-card-section.admin-dashboard-card
          img(src='/_assets/icons/fluent-change-theme.svg')
          div
            strong {{ t('admin.sites.title') }}
            span {{adminStore.sites.length}}
        q-separator
        q-card-actions(align='right')
          q-btn(
            flat
            color='primary'
            icon='las la-plus-circle'
            :label='t(`common.actions.new`)'
            :disable='!userStore.can(`manage:sites`)'
            @click='newSite'
            )
          q-separator.q-mx-sm(vertical)
          q-btn(
            flat
            color='primary'
            icon='las la-sitemap'
            :label='t(`common.actions.manage`)'
            :disable='!userStore.can(`manage:sites`)'
            to='/_admin/sites'
            )
    .col-12.col-sm-6.col-lg-3
      q-card
        q-card-section.admin-dashboard-card
          img(src='/_assets/icons/fluent-people.svg')
          div
            strong {{ t('admin.groups.title') }}
            span {{adminStore.info.groupsTotal}}
        q-separator
        q-card-actions(align='right')
          q-btn(
            flat
            color='primary'
            icon='las la-plus-circle'
            :label='t(`common.actions.new`)'
            :disable='!userStore.can(`manage:users`)'
            @click='newGroup'
            )
          q-separator.q-mx-sm(vertical)
          q-btn(
            flat
            color='primary'
            icon='las la-users'
            :label='t(`common.actions.manage`)'
            :disable='!userStore.can(`manage:users`)'
            to='/_admin/groups'
            )
    .col-12.col-sm-6.col-lg-3
      q-card
        q-card-section.admin-dashboard-card
          img(src='/_assets/icons/fluent-account.svg')
          div
            strong {{ t('admin.users.title') }}
            span {{adminStore.info.usersTotal}}
        q-separator
        q-card-actions(align='right')
          q-btn(
            flat
            color='primary'
            icon='las la-user-plus'
            :label='t(`common.actions.new`)'
            :disable='!userStore.can(`manage:users`)'
            @click='newUser'
            )
          q-separator.q-mx-sm(vertical)
          q-btn(
            flat
            color='primary'
            icon='las la-user-friends'
            :label='t(`common.actions.manage`)'
            :disable='!userStore.can(`manage:users`)'
            to='/_admin/users'
            )
    //- .col-12.col-sm-6.col-lg-3
    //-   q-card
    //-     q-card-section.admin-dashboard-card
    //-       img(src='/_assets/icons/fluent-tag.svg')
    //-       div
    //-         strong {{ t('admin.tags.title') }}
    //-         span {{adminStore.info.tagsTotal}}
    //-     q-separator
    //-     q-card-actions(align='right')
    //-       q-btn(
    //-         flat
    //-         color='primary'
    //-         icon='las la-tags'
    //-         :label='t(`common.actions.manage`)'
    //-         :disable='!userStore.can(`manage:sites`)'
    //-         :to='`/_admin/` + adminStore.currentSiteId + `/tags`'
    //-         )
    .col-12.col-sm-6.col-lg-3
      q-card
        q-card-section.admin-dashboard-card
          img(src='/_assets/icons/fluent-female-working-with-a-laptop.svg')
          div
            strong Logins
            small {{ adminStore.info.loginsPastDay }} #[i / past 24h]
        q-separator
        q-card-actions(align='right')
          q-btn(
            flat
            color='primary'
            icon='las la-chart-area'
            :label='t(`admin.analytics.title`)'
            :disable='!userStore.can(`manage:sites`) || flagsStore.experimental'
            :to='`/_admin/` + adminStore.currentSiteId + `/analytics`'
            )
    //- .col-12.col-lg-9
    //-   q-card
    //-     q-card-section ---

    .col-12
      q-banner.bg-positive.text-white(
        :class='adminStore.isVersionLatest ? `bg-positive` : `bg-warning`'
        inline-actions
        rounded
        )
        i.las.la-check.q-mr-sm
        span.text-weight-medium(v-if='adminStore.isVersionLatest') Your Wiki.js server is running the latest version!
        span.text-weight-medium(v-else) A new version of Wiki.js is available. Please update to the latest version.
        template(#action, v-if='userStore.can(`manage:system`)')
          q-btn(
            flat
            :label='t(`admin.system.checkForUpdates`)'
            @click='checkForUpdates'
            )
          q-separator.q-mx-sm(vertical, dark)
          q-btn(
            flat
            :label='t(`admin.system.title`)'
            to='/_admin/system'
            )
</template>

<script setup>
import { useMeta, useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useAdminStore } from '../stores/admin'
import { useFlagsStore } from '@/stores/flags'
import { useUserStore } from '@/stores/user'

// COMPONENTS

import CheckUpdateDialog from '@/components/CheckUpdateDialog.vue'
import SiteCreateDialog from '@/components/SiteCreateDialog.vue'
import UserCreateDialog from '@/components/UserCreateDialog.vue'
import GroupCreateDialog from '@/components/GroupCreateDialog.vue'

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()
const flagsStore = useFlagsStore()
const userStore = useUserStore()

// ROUTER

const router = useRouter()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.dashboard.title')
})

// METHODS

function newSite () {
  $q.dialog({
    component: SiteCreateDialog
  }).onOk(() => {
    router.push('/_admin/sites')
  })
}
function newUser () {
  $q.dialog({
    component: UserCreateDialog
  }).onOk(() => {
    router.push('/_admin/users')
  })
}
function newGroup () {
  $q.dialog({
    component: GroupCreateDialog
  }).onOk(() => {
    router.push('/_admin/groups')
  })
}
function checkForUpdates () {
  $q.dialog({
    component: CheckUpdateDialog
  })
}

</script>

<style lang='scss'>

.admin-dashboard {
  &-card {
    display: flex;
    align-items: center;

    img {
      width: 64px;
      margin-right: 12px;
    }

    strong {
      font-size: 1.1rem;
      font-weight: 300;
      display: block;
      line-height: 1.2rem;
      padding-left: 2px;
    }

    span {
      font-size: 2rem;
      line-height: 2rem;
      font-weight: 500;
      color: var(--q-secondary);
      display: block;
    }

    small {
      font-size: 1.4rem;
      line-height: 2rem;
      font-weight: 400;
      color: var(--q-secondary);
      display: block;

      i {
        font-size: 1rem;
        font-style: normal;
      }
    }
  }

  .q-card__actions {
    background: linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,.03));

    @at-root .body--dark & {
      background: linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,.2));
    }
  }
}

</style>
