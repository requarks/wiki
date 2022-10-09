<template lang='pug'>
q-layout.admin(view='hHh Lpr lff')
  q-header.bg-black.text-white
    .row.no-wrap
      q-toolbar(style='height: 64px;', dark)
        q-btn(dense, flat, href='/')
          q-avatar(size='34px', square)
            img(src='/_assets/logo-wikijs.svg')
        q-toolbar-title.text-h6 Wiki.js
      q-toolbar.gt-sm.justify-center(style='height: 64px;', dark)
        .text-overline.text-uppercase.text-grey {{t('admin.adminArea')}}
        q-badge.q-ml-sm(
          label='v3 Preview'
          color='pink'
          outline
          )
      q-toolbar(style='height: 64px;', dark)
        q-space
        transition(name='syncing')
          q-spinner-tail(
            v-show='siteStore.routerLoading'
            color='accent'
            size='24px'
          )
        q-btn.q-ml-md(flat, dense, icon='las la-times-circle', label='Exit' color='pink', to='/')
        account-menu
  q-drawer.admin-sidebar(v-model='leftDrawerOpen', show-if-above, bordered)
    q-scroll-area.admin-nav(
      :thumb-style='thumbStyle'
      :bar-style='barStyle'
      )
      q-list.text-white(padding, dense)
        q-item.q-mb-sm
          q-item-section
            q-btn.acrylic-btn(
              flat
              color='pink'
              icon='las la-heart'
              :label='t(`admin.contribute.title`)'
              no-caps
              href='https://js.wiki/donate'
              target='_blank'
              type='a'
            )
        q-item(to='/_admin/dashboard', v-ripple, active-class='bg-primary text-white')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-apps-tab.svg')
          q-item-section {{ t('admin.dashboard.title') }}
        q-item(to='/_admin/sites', v-ripple, active-class='bg-primary text-white')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-change-theme.svg')
          q-item-section {{ t('admin.sites.title') }}
          q-item-section(side)
            q-badge(color='dark-3', :label='adminStore.sites.length')
        q-item-label.q-mt-sm(header).text-caption.text-blue-grey-4 {{ t('admin.nav.site') }}
        q-item.q-mb-md
          q-item-section
            q-select(
              dark
              standout
              dense
              v-model='adminStore.currentSiteId'
              :options='adminStore.sites'
              option-value='id'
              option-label='title'
              emit-value
              map-options
            )
        q-item(:to='`/_admin/` + adminStore.currentSiteId + `/general`', v-ripple, active-class='bg-primary text-white')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-web.svg')
          q-item-section {{ t('admin.general.title') }}
        q-item(:to='`/_admin/` + adminStore.currentSiteId + `/analytics`', v-ripple, active-class='bg-primary text-white', disabled)
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-bar-chart.svg')
          q-item-section {{ t('admin.analytics.title') }}
        q-item(:to='`/_admin/` + adminStore.currentSiteId + `/approvals`', v-ripple, active-class='bg-primary text-white', disabled)
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-inspection.svg')
          q-item-section {{ t('admin.approval.title') }}
        q-item(:to='`/_admin/` + adminStore.currentSiteId + `/comments`', v-ripple, active-class='bg-primary text-white', disabled)
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-comments.svg')
          q-item-section {{ t('admin.comments.title') }}
        q-item(:to='`/_admin/` + adminStore.currentSiteId + `/blocks`', v-ripple, active-class='bg-primary text-white', disabled)
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-rfid-tag.svg')
          q-item-section {{ t('admin.blocks.title') }}
        q-item(:to='`/_admin/` + adminStore.currentSiteId + `/editors`', v-ripple, active-class='bg-primary text-white', disabled)
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-cashbook.svg')
          q-item-section {{ t('admin.editors.title') }}
        q-item(:to='`/_admin/` + adminStore.currentSiteId + `/locale`', v-ripple, active-class='bg-primary text-white')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-language.svg')
          q-item-section {{ t('admin.locale.title') }}
        q-item(:to='`/_admin/` + adminStore.currentSiteId + `/login`', v-ripple, active-class='bg-primary text-white')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-bunch-of-keys.svg')
          q-item-section {{ t('admin.login.title') }}
        q-item(:to='`/_admin/` + adminStore.currentSiteId + `/navigation`', v-ripple, active-class='bg-primary text-white')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-tree-structure.svg')
          q-item-section {{ t('admin.navigation.title') }}
        q-item(:to='`/_admin/` + adminStore.currentSiteId + `/rendering`', v-ripple, active-class='bg-primary text-white', disabled)
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-rich-text-converter.svg')
          q-item-section {{ t('admin.rendering.title') }}
        q-item(:to='`/_admin/` + adminStore.currentSiteId + `/storage`', v-ripple, active-class='bg-primary text-white')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-ssd.svg')
          q-item-section {{ t('admin.storage.title') }}
        q-item(:to='`/_admin/` + adminStore.currentSiteId + `/theme`', v-ripple, active-class='bg-primary text-white')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-paint-roller.svg')
          q-item-section {{ t('admin.theme.title') }}
        q-item-label.q-mt-sm(header).text-caption.text-blue-grey-4 {{ t('admin.nav.users') }}
        q-item(to='/_admin/auth', v-ripple, active-class='bg-primary text-white')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-security-lock.svg')
          q-item-section {{ t('admin.auth.title') }}
        q-item(to='/_admin/groups', v-ripple, active-class='bg-primary text-white')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-people.svg')
          q-item-section {{ t('admin.groups.title') }}
          q-item-section(side)
            q-badge(color='dark-3', :label='adminStore.info.groupsTotal')
        q-item(to='/_admin/users', v-ripple, active-class='bg-primary text-white')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-account.svg')
          q-item-section {{ t('admin.users.title') }}
          q-item-section(side)
            q-badge(color='dark-3', :label='adminStore.info.usersTotal')
        q-item-label.q-mt-sm(header).text-caption.text-blue-grey-4 {{ t('admin.nav.system') }}
        q-item(to='/_admin/api', v-ripple, active-class='bg-primary text-white')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-rest-api.svg')
          q-item-section {{ t('admin.api.title') }}
          q-item-section(side)
            status-light(:color='adminStore.info.isApiEnabled ? `positive` : `negative`')
        q-item(to='/_admin/audit', v-ripple, active-class='bg-primary text-white', disabled)
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-event-log.svg')
          q-item-section {{ t('admin.audit.title') }}
        q-item(to='/_admin/extensions', v-ripple, active-class='bg-primary text-white')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-module.svg')
          q-item-section {{ t('admin.extensions.title') }}
        q-item(to='/_admin/mail', v-ripple, active-class='bg-primary text-white')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-message-settings.svg')
          q-item-section {{ t('admin.mail.title') }}
          q-item-section(side)
            status-light(:color='adminStore.info.isMailConfigured ? `positive` : `warning`')
        q-item(to='/_admin/scheduler', v-ripple, active-class='bg-primary text-white')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-bot.svg')
          q-item-section {{ t('admin.scheduler.title') }}
          q-item-section(side)
            status-light(:color='adminStore.info.isSchedulerHealthy ? `positive` : `warning`')
        q-item(to='/_admin/security', v-ripple, active-class='bg-primary text-white')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-protect.svg')
          q-item-section {{ t('admin.security.title') }}
        q-item(to='/_admin/ssl', v-ripple, active-class='bg-primary text-white', disabled)
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-security-ssl.svg')
          q-item-section {{ t('admin.ssl.title') }}
        q-item(to='/_admin/system', v-ripple, active-class='bg-primary text-white')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-processor.svg')
          q-item-section {{ t('admin.system.title') }}
          q-item-section(side)
            status-light(:color='adminStore.isVersionLatest ? `positive` : `warning`')
        q-item(to='/_admin/terminal', v-ripple, active-class='bg-primary text-white')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-linux-terminal.svg')
          q-item-section {{ t('admin.terminal.title') }}
        q-item(to='/_admin/utilities', v-ripple, active-class='bg-primary text-white')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-swiss-army-knife.svg')
          q-item-section {{ t('admin.utilities.title') }}
        q-item(to='/_admin/webhooks', v-ripple, active-class='bg-primary text-white')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-lightning-bolt.svg')
          q-item-section {{ t('admin.webhooks.title') }}
        q-item(to='/_admin/flags', v-ripple, active-class='bg-primary text-white')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-windsock.svg')
          q-item-section {{ t('admin.dev.flags.title') }}
  q-page-container.admin-container
    router-view(v-slot='{ Component }')
      component(:is='Component')
  q-dialog.admin-overlay(
    v-model='overlayIsShown'
    persistent
    full-width
    full-height
    no-shake
    transition-show='jump-up'
    transition-hide='jump-down'
    )
    component(:is='overlays[adminStore.overlay]')
  q-footer.admin-footer
    q-bar.justify-center(dense)
      span(style='font-size: 11px;') Powered by #[a(href='https://js.wiki', target='_blank'): strong Wiki.js], an open source project.
</template>

<script setup>
import { useMeta, useQuasar, setCssVar } from 'quasar'
import { defineAsyncComponent, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useAdminStore } from '../stores/admin'
import { useSiteStore } from '../stores/site'

// COMPONENTS

import AccountMenu from '../components/AccountMenu.vue'
const overlays = {
  GroupEditOverlay: defineAsyncComponent(() => import('../components/GroupEditOverlay.vue')),
  UserEditOverlay: defineAsyncComponent(() => import('../components/UserEditOverlay.vue'))
}

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// META

useMeta({
  titleTemplate: title => `${title} - ${t('admin.adminArea')} - Wiki.js`
})

// DATA

const leftDrawerOpen = ref(true)
const overlayIsShown = ref(false)
const search = ref('')
const user = reactive({
  name: 'John Doe',
  email: 'test@example.com',
  picture: null
})
const thumbStyle = {
  right: '1px',
  borderRadius: '5px',
  backgroundColor: '#666',
  width: '5px',
  opacity: 0.5
}
const barStyle = {
  width: '7px'
}

// WATCHERS

watch(() => adminStore.sites, (newValue) => {
  if (adminStore.currentSiteId === null && newValue.length > 0) {
    adminStore.$patch({
      currentSiteId: siteStore.id
    })
  }
})
watch(() => adminStore.overlay, (newValue) => {
  overlayIsShown.value = !!newValue
})
watch(() => adminStore.currentSiteId, (newValue) => {
  if (newValue && route.params.siteid !== newValue) {
    router.push({ params: { siteid: newValue } })
  }
})

// MOUNTED

onMounted(async () => {
  await adminStore.fetchSites()
  if (route.params.siteid) {
    adminStore.$patch({
      currentSiteId: route.params.siteid
    })
  }
  adminStore.fetchInfo()
})

</script>

<style lang="scss">
.admin-nav {
  height: 100%;
}
.admin-icon {
  height: 64px;
}
.admin-sidebar {
  @at-root .body--light & {
    background-color: $dark-4;
  }
  @at-root .body--dark & {
    background-color: $dark-5;
  }

  .q-item__label--header {
    box-shadow: 0 -1px 0 0 rgba(255,255,255,.15), 0 -2px 0 0 darken($dark-6, 1%);
    padding-top: 16px;
  }
}
.admin-container {
  @at-root .body--light & {
    background-color: $grey-1;
  }
  @at-root .body--dark & {
    background-color: $dark-4;
  }

  .q-card {
    @at-root .body--light & {
      background-color: #FFF;
    }
    @at-root .body--dark & {
      background-color: $dark-3;
    }
  }
}

.admin-overlay {
  > .q-dialog__backdrop {
    background-color: rgba(0,0,0,.6);
  }
  > .q-dialog__inner {
    padding: 24px 64px;

    @media (max-width: $breakpoint-sm-max) {
      padding: 0;
    }

    > .q-layout-container {
      @at-root .body--light & {
        background-image: linear-gradient(to bottom, $dark-5 10px, $grey-3 11px, $grey-4);
      }
      @at-root .body--dark & {
        background-image: linear-gradient(to bottom, $dark-4 10px, $dark-4 11px, $dark-3);
      }
      border-radius: 6px;
      box-shadow: 0 0 0 2px rgba(0,0,0,.5);
    }
  }
}

.admin-footer > .q-bar {
  @at-root .body--light & {
    background-color: #FFF !important;
    color: $blue-grey-5 !important;

    a {
      color: $blue-grey-9 !important;
      text-decoration: none;
    }
  }
  @at-root .body--dark & {
    background-color: $dark-6 !important;
    color: $blue-grey-5 !important;

    a {
      color: $blue-grey-5 !important;
      text-decoration: none;
    }
  }
}
</style>
