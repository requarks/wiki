<template lang='pug'>
q-layout.admin(view='hHh Lpr lff')
  q-header.bg-black.text-white
    .row.no-wrap
      q-toolbar(style='height: 64px;', dark)
        q-btn(dense, flat, to='/')
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
            v-show='commonStore.routerLoading'
            color='accent'
            size='24px'
          )
        q-btn.q-ml-md(flat, dense, icon='las la-times-circle', :label='t(`common.actions.exit`)' color='pink', to='/')
        q-btn.q-ml-md(flat, dense, icon='las la-language', :label='commonStore.locale' color='grey-4')
          q-menu.translucent-menu(auto-close, anchor='bottom right', self='top right')
            q-list(separator, padding)
              q-item(
                v-for='lang of adminStore.locales'
                clickable
                @click='commonStore.setLocale(lang.code)'
                )
                q-item-section(side)
                  q-avatar(rounded, :color='lang.code === commonStore.locale ? `secondary` : `primary`', text-color='white', size='sm')
                    .text-caption.text-uppercase: strong {{ lang.language }}
                q-item-section
                  q-item-label {{ lang.nativeName }}
                  q-item-label(caption) {{ lang.name }}
        account-menu
  q-drawer.admin-sidebar(v-model='leftDrawerOpen', show-if-above, bordered)
    q-scroll-area.admin-nav(
      :thumb-style='thumbStyle'
      :bar-style='barStyle'
      )
      q-list.text-white.q-pb-lg(padding, dense)
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
        q-item(to='/_admin/sites', v-ripple, active-class='bg-primary text-white', v-if='userStore.can(`manage:sites`)')
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-change-theme.svg')
          q-item-section {{ t('admin.sites.title') }}
          q-item-section(side)
            q-badge(color='dark-3', :label='adminStore.sites.length')
        template(v-if='siteSectionShown')
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
          template(v-if='flagsStore.experimental')
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
          q-item(:to='`/_admin/` + adminStore.currentSiteId + `/editors`', v-ripple, active-class='bg-primary text-white', v-if='userStore.can(`manage:sites`)')
            q-item-section(avatar)
              q-icon(name='img:/_assets/icons/fluent-cashbook.svg')
            q-item-section {{ t('admin.editors.title') }}
          q-item(:to='`/_admin/` + adminStore.currentSiteId + `/locale`', v-ripple, active-class='bg-primary text-white', v-if='userStore.can(`manage:sites`)')
            q-item-section(avatar)
              q-icon(name='img:/_assets/icons/fluent-language.svg')
            q-item-section {{ t('admin.locale.title') }}
          q-item(:to='`/_admin/` + adminStore.currentSiteId + `/login`', v-ripple, active-class='bg-primary text-white', v-if='userStore.can(`manage:sites`)')
            q-item-section(avatar)
              q-icon(name='img:/_assets/icons/fluent-bunch-of-keys.svg')
            q-item-section {{ t('admin.login.title') }}
          q-item(:to='`/_admin/` + adminStore.currentSiteId + `/navigation`', v-ripple, active-class='bg-primary text-white', disabled, v-if='flagsStore.experimental && (userStore.can(`manage:sites`) || userStore.can(`manage:navigation`))')
            q-item-section(avatar)
              q-icon(name='img:/_assets/icons/fluent-tree-structure.svg')
            q-item-section {{ t('admin.navigation.title') }}
          q-item(:to='`/_admin/` + adminStore.currentSiteId + `/storage`', v-ripple, active-class='bg-primary text-white', v-if='userStore.can(`manage:sites`)')
            q-item-section(avatar)
              q-icon(name='img:/_assets/icons/fluent-ssd.svg')
            q-item-section {{ t('admin.storage.title') }}
            q-item-section(side)
              //- TODO: Reflect site storage status
              status-light(:color='true ? `positive` : `warning`', :pulse='false')
          q-item(:to='`/_admin/` + adminStore.currentSiteId + `/theme`', v-ripple, active-class='bg-primary text-white', v-if='userStore.can(`manage:sites`) || userStore.can(`manage:theme`)')
            q-item-section(avatar)
              q-icon(name='img:/_assets/icons/fluent-paint-roller.svg')
            q-item-section {{ t('admin.theme.title') }}
        template(v-if='usersSectionShown')
          q-item-label.q-mt-sm(header).text-caption.text-blue-grey-4 {{ t('admin.nav.users') }}
          q-item(to='/_admin/auth', v-ripple, active-class='bg-primary text-white', v-if='userStore.can(`manage:system`)')
            q-item-section(avatar)
              q-icon(name='img:/_assets/icons/fluent-security-lock.svg')
            q-item-section {{ t('admin.auth.title') }}
          q-item(to='/_admin/groups', v-ripple, active-class='bg-primary text-white', v-if='userStore.can(`manage:groups`)')
            q-item-section(avatar)
              q-icon(name='img:/_assets/icons/fluent-people.svg')
            q-item-section {{ t('admin.groups.title') }}
            q-item-section(side)
              q-badge(color='dark-3', :label='adminStore.info.groupsTotal')
          q-item(to='/_admin/users', v-ripple, active-class='bg-primary text-white', v-if='userStore.can(`manage:users`)')
            q-item-section(avatar)
              q-icon(name='img:/_assets/icons/fluent-account.svg')
            q-item-section {{ t('admin.users.title') }}
            q-item-section(side)
              q-badge(color='dark-3', :label='adminStore.info.usersTotal')
        template(v-if='userStore.can(`manage:system`)')
          q-item-label.q-mt-sm(header).text-caption.text-blue-grey-4 {{ t('admin.nav.system') }}
          q-item(to='/_admin/api', v-ripple, active-class='bg-primary text-white')
            q-item-section(avatar)
              q-icon(name='img:/_assets/icons/fluent-rest-api.svg')
            q-item-section {{ t('admin.api.title') }}
            q-item-section(side)
              status-light(:color='adminStore.info.isApiEnabled ? `positive` : `negative`')
          q-item(to='/_admin/audit', v-ripple, active-class='bg-primary text-white', disabled, v-if='flagsStore.experimental')
            q-item-section(avatar)
              q-icon(name='img:/_assets/icons/fluent-event-log.svg')
            q-item-section {{ t('admin.audit.title') }}
          q-item(to='/_admin/extensions', v-ripple, active-class='bg-primary text-white')
            q-item-section(avatar)
              q-icon(name='img:/_assets/icons/fluent-module.svg')
            q-item-section {{ t('admin.extensions.title') }}
          q-item(to='/_admin/icons', v-ripple, active-class='bg-primary text-white')
            q-item-section(avatar)
              q-icon(name='img:/_assets/icons/fluent-spring.svg')
            q-item-section {{ t('admin.icons.title') }}
          q-item(to='/_admin/instances', v-ripple, active-class='bg-primary text-white')
            q-item-section(avatar)
              q-icon(name='img:/_assets/icons/fluent-network.svg')
            q-item-section {{ t('admin.instances.title') }}
          q-item(to='/_admin/mail', v-ripple, active-class='bg-primary text-white')
            q-item-section(avatar)
              q-icon(name='img:/_assets/icons/fluent-message-settings.svg')
            q-item-section {{ t('admin.mail.title') }}
            q-item-section(side)
              status-light(:color='adminStore.info.isMailConfigured ? `positive` : `warning`', :pulse='!adminStore.info.isMailConfigured')
          q-item(to='/_admin/rendering', v-ripple, active-class='bg-primary text-white')
            q-item-section(avatar)
              q-icon(name='img:/_assets/icons/fluent-rich-text-converter.svg')
            q-item-section {{ t('admin.rendering.title') }}
          q-item(to='/_admin/scheduler', v-ripple, active-class='bg-primary text-white')
            q-item-section(avatar)
              q-icon(name='img:/_assets/icons/fluent-bot.svg')
            q-item-section {{ t('admin.scheduler.title') }}
            q-item-section(side)
              status-light(:color='adminStore.info.isSchedulerHealthy ? `positive` : `warning`', :pulse='!adminStore.info.isSchedulerHealthy')
          q-item(to='/_admin/search', v-ripple, active-class='bg-primary text-white')
            q-item-section(avatar)
              q-icon(name='img:/_assets/icons/fluent-find-and-replace.svg')
            q-item-section {{ t('admin.search.title') }}
          q-item(to='/_admin/security', v-ripple, active-class='bg-primary text-white')
            q-item-section(avatar)
              q-icon(name='img:/_assets/icons/fluent-protect.svg')
            q-item-section {{ t('admin.security.title') }}
          q-item(to='/_admin/ssl', v-ripple, active-class='bg-primary text-white', disabled, v-if='flagsStore.experimental')
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
  footer-nav.admin-footer(generic)
</template>

<script setup>
import { useMeta, useQuasar, setCssVar } from 'quasar'
import { computed, defineAsyncComponent, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useAdminStore } from 'src/stores/admin'
import { useCommonStore } from 'src/stores/common'
import { useFlagsStore } from 'src/stores/flags'
import { useSiteStore } from 'src/stores/site'
import { useUserStore } from 'src/stores/user'

// COMPONENTS

import AccountMenu from '../components/AccountMenu.vue'
import FooterNav from 'src/components/FooterNav.vue'
const overlays = {
  EditorMarkdownConfig: defineAsyncComponent(() => import('../components/EditorMarkdownConfigOverlay.vue')),
  GroupEditOverlay: defineAsyncComponent(() => import('../components/GroupEditOverlay.vue')),
  UserEditOverlay: defineAsyncComponent(() => import('../components/UserEditOverlay.vue'))
}

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()
const commonStore = useCommonStore()
const flagsStore = useFlagsStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

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

// COMPUTED

const siteSectionShown = computed(() => {
  return userStore.can('manage:sites') || userStore.can('manage:navigation') || userStore.can('manage:theme')
})
const usersSectionShown = computed(() => {
  return userStore.can('manage:groups') || userStore.can('manage:users')
})
const overlayIsShown = computed(() => {
  return Boolean(adminStore.overlay)
})

// WATCHERS

watch(() => route.path, async (newValue) => {
  if (!newValue.startsWith('/_admin')) { return }
  if (!userStore.can('access:admin')) {
    router.replace('/_error/unauthorized')
  }
}, { immediate: true })
watch(() => adminStore.sites, (newValue) => {
  if (adminStore.currentSiteId === null && newValue.length > 0) {
    adminStore.$patch({
      currentSiteId: siteStore.id
    })
  }
})
watch(() => adminStore.currentSiteId, (newValue) => {
  if (newValue && route.params.siteid !== newValue) {
    router.push({ params: { siteid: newValue } })
  }
})

// MOUNTED

onMounted(async () => {
  if (!userStore.can('access:admin')) {
    router.replace('/_error/unauthorized')
    return
  }

  adminStore.fetchLocales()
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
    backdrop-filter: blur(5px) saturate(180%);
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
      box-shadow: 0 0 0 1px rgba(0,0,0,.5);
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
