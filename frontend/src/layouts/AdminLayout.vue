<template>
  <w-layout class="admin">
    <w-header class="bg-black text-white">
      <div class="flex flex-nowrap">
        <w-toolbar style="height: 64px">
          <w-btn dense flat to="/">
            <w-avatar size="34px" square><img src="/_assets/logo-wikijs.svg" /></w-avatar>
          </w-btn>
          <w-toolbar-title class="text-h6">Wiki.js</w-toolbar-title>
        </w-toolbar>
        <w-toolbar class="max-md:hidden justify-center" style="height: 64px">
          <div class="text-overline uppercase text-grey">{{ t('admin.adminArea') }}</div>
          <w-badge class="ml-2" label="beta" color="pink" outline />
        </w-toolbar>
        <w-toolbar style="height: 64px">
          <w-space />
          <transition name="syncing">
            <w-spinner v-show="commonStore.routerLoading" color="accent" size="20px" />
          </transition>
          <w-btn
            class="ml-4"
            flat
            dense
            icon="la:times-circle"
            :label="t(`common.actions.exit`)"
            color="pink"
            to="/" />
          <w-btn
            class="ml-4"
            flat
            dense
            icon="la:language"
            :label="commonStore.locale"
            color="grey-4">
            <w-menu
              content-class="translucent-menu"
              auto-close
              anchor="bottom right"
              self="top right">
              <w-list separator padding>
                <w-item
                  v-for="lang of adminStore.locales"
                  :key="lang.code"
                  clickable
                  @click="commonStore.setLocale(lang.code)">
                  <w-item-section side>
                    <w-avatar
                      rounded
                      :color="lang.code === commonStore.locale ? `secondary` : `primary`"
                      text-color="white"
                      size="sm">
                      <div class="text-caption uppercase">
                        <strong>{{ lang.language }}</strong>
                      </div>
                    </w-avatar>
                  </w-item-section>
                  <w-item-section>
                    <w-item-label>{{ lang.nativeName }}</w-item-label>
                    <w-item-label caption>{{ lang.name }}</w-item-label>
                  </w-item-section>
                </w-item>
              </w-list>
            </w-menu>
          </w-btn>
          <account-menu />
        </w-toolbar>
      </div>
    </w-header>
    <w-drawer class="admin-sidebar" v-model="leftDrawerOpen" show-if-above bordered>
      <w-scroll-area class="admin-nav">
        <w-list class="text-white pb-6" padding dense dark>
          <w-item class="mb-2">
            <w-item-section>
              <w-btn
                class="acrylic-btn"
                flat
                color="pink"
                icon="la:heart"
                :label="t(`admin.contribute.title`)"
                no-caps
                href="https://js.wiki/donate"
                target="_blank" />
            </w-item-section>
          </w-item>
          <w-item to="/_admin/dashboard" active-class="bg-primary text-white">
            <w-item-section avatar>
              <w-icon name="img:/_assets/icons/fluent-apps-tab.svg" />
            </w-item-section>
            <w-item-section>{{ t('admin.dashboard.title') }}</w-item-section>
          </w-item>
          <w-item
            to="/_admin/sites"
            active-class="bg-primary text-white"
            v-if="userStore.can(`manage:sites`)">
            <w-item-section avatar>
              <w-icon name="img:/_assets/icons/fluent-change-theme.svg" />
            </w-item-section>
            <w-item-section>{{ t('admin.sites.title') }}</w-item-section>
            <w-item-section side>
              <w-badge
                color="dark-3"
                :label="adminStore.sites.length"
                :class="countBadgeClass(adminStore.sites.length)" />
            </w-item-section>
          </w-item>
          <template v-if="siteSectionShown">
            <w-item-label class="mt-2 text-caption text-blue-grey-4" header>{{
              t('admin.nav.site')
            }}</w-item-label>
            <w-item class="mb-2">
              <w-item-section>
                <w-select
                  dark
                  standout
                  dense
                  hide-bottom-space
                  v-model="adminStore.currentSiteId"
                  :options="adminStore.sites"
                  option-value="id"
                  option-label="title"
                  emit-value
                  map-options />
              </w-item-section>
            </w-item>
            <w-item
              :to="`/_admin/` + adminStore.currentSiteId + `/general`"
              active-class="bg-primary text-white">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-web.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.general.title') }}</w-item-section>
            </w-item>
            <w-item
              :to="`/_admin/` + adminStore.currentSiteId + `/approvals`"
              active-class="bg-primary text-white">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-inspection.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.approval.title') }}</w-item-section>
            </w-item>
            <template v-if="flagsStore.experimental">
              <w-item
                :to="`/_admin/` + adminStore.currentSiteId + `/analytics`"
                active-class="bg-primary text-white"
                disabled>
                <w-item-section avatar>
                  <w-icon name="img:/_assets/icons/fluent-bar-chart.svg" />
                </w-item-section>
                <w-item-section>{{ t('admin.analytics.title') }}</w-item-section>
              </w-item>
              <w-item
                :to="`/_admin/` + adminStore.currentSiteId + `/comments`"
                active-class="bg-primary text-white"
                disabled>
                <w-item-section avatar>
                  <w-icon name="img:/_assets/icons/fluent-comments.svg" />
                </w-item-section>
                <w-item-section>{{ t('admin.comments.title') }}</w-item-section>
              </w-item>
            </template>
            <w-item
              :to="`/_admin/` + adminStore.currentSiteId + `/blocks`"
              active-class="bg-primary text-white"
              v-if="userStore.can(`manage:sites`)">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-plugin.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.blocks.title') }}</w-item-section>
            </w-item>
            <w-item
              :to="`/_admin/` + adminStore.currentSiteId + `/editors`"
              active-class="bg-primary text-white"
              v-if="userStore.can(`manage:sites`)">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-cashbook.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.editors.title') }}</w-item-section>
            </w-item>
            <w-item
              :to="`/_admin/` + adminStore.currentSiteId + `/locale`"
              active-class="bg-primary text-white"
              v-if="userStore.can(`manage:sites`)">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-language.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.locale.title') }}</w-item-section>
            </w-item>
            <w-item
              :to="`/_admin/` + adminStore.currentSiteId + `/login`"
              active-class="bg-primary text-white"
              v-if="userStore.can(`manage:sites`)">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-bunch-of-keys.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.login.title') }}</w-item-section>
            </w-item>
            <w-item
              :to="`/_admin/` + adminStore.currentSiteId + `/navigation`"
              active-class="bg-primary text-white"
              disabled
              v-if="
                flagsStore.experimental &&
                (userStore.can(`manage:sites`) || userStore.can(`manage:navigation`))
              ">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-tree-structure.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.navigation.title') }}</w-item-section>
            </w-item>
            <w-item
              :to="`/_admin/` + adminStore.currentSiteId + `/storage`"
              active-class="bg-primary text-white"
              v-if="userStore.can(`manage:sites`)">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-ssd.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.storage.title') }}</w-item-section>
              <w-item-section side>
                <!-- TODO: Reflect site storage status -->
                <status-light :color="true ? `positive` : `warning`" :pulse="false" />
              </w-item-section>
            </w-item>
            <w-item
              :to="`/_admin/` + adminStore.currentSiteId + `/tags`"
              active-class="bg-primary text-white"
              disabled
              v-if="flagsStore.experimental && userStore.can(`manage:sites`)">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-tag.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.tags.title') }}</w-item-section>
            </w-item>
            <w-item
              :to="`/_admin/` + adminStore.currentSiteId + `/theme`"
              active-class="bg-primary text-white"
              v-if="userStore.can(`manage:sites`) || userStore.can(`manage:theme`)">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-paint-roller.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.theme.title') }}</w-item-section>
            </w-item>
          </template>
          <template v-if="usersSectionShown">
            <w-item-label class="mt-2 text-caption text-blue-grey-4" header>{{
              t('admin.nav.users')
            }}</w-item-label>
            <w-item
              to="/_admin/auth"
              active-class="bg-primary text-white"
              v-if="userStore.can(`manage:system`)">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-security-lock.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.auth.title') }}</w-item-section>
            </w-item>
            <w-item
              to="/_admin/groups"
              active-class="bg-primary text-white"
              v-if="groupsAreVisible">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-people.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.groups.title') }}</w-item-section>
              <w-item-section side>
                <w-badge
                  color="dark-3"
                  :label="adminStore.info.groupsTotal"
                  :class="countBadgeClass(adminStore.info.groupsTotal)" />
              </w-item-section>
            </w-item>
            <w-item to="/_admin/users" active-class="bg-primary text-white" v-if="usersAreVisible">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-account.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.users.title') }}</w-item-section>
              <w-item-section side>
                <w-badge
                  color="dark-3"
                  :label="adminStore.info.usersTotal"
                  :class="countBadgeClass(adminStore.info.usersTotal)" />
              </w-item-section>
            </w-item>
          </template>
          <template v-if="userStore.can(`manage:system`)">
            <w-item-label class="mt-2 text-caption text-blue-grey-4" header>{{
              t('admin.nav.system')
            }}</w-item-label>
            <w-item to="/_admin/api" active-class="bg-primary text-white">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-rest-api.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.api.title') }}</w-item-section>
              <w-item-section side>
                <status-light :color="adminStore.info.isApiEnabled ? `positive` : `negative`" />
              </w-item-section>
            </w-item>
            <w-item
              to="/_admin/audit"
              active-class="bg-primary text-white"
              disabled
              v-if="flagsStore.experimental">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-event-log.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.audit.title') }}</w-item-section>
            </w-item>
            <w-item to="/_admin/extensions" active-class="bg-primary text-white">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-module.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.extensions.title') }}</w-item-section>
            </w-item>
            <w-item to="/_admin/icons" active-class="bg-primary text-white">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-spring.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.icons.title') }}</w-item-section>
            </w-item>
            <w-item to="/_admin/instances" active-class="bg-primary text-white">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-network.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.instances.title') }}</w-item-section>
              <w-item-section side>
                <w-badge
                  color="dark-3"
                  :label="adminStore.info.instancesTotal"
                  :class="countBadgeClass(adminStore.info.instancesTotal)" />
              </w-item-section>
            </w-item>
            <w-item to="/_admin/mail" active-class="bg-primary text-white">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-message-settings.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.mail.title') }}</w-item-section>
              <w-item-section side>
                <status-light
                  :color="adminStore.info.isMailConfigured ? `positive` : `warning`"
                  :pulse="!adminStore.info.isMailConfigured" />
              </w-item-section>
            </w-item>
            <w-item to="/_admin/metrics" active-class="bg-primary text-white">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-graph.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.metrics.title') }}</w-item-section>
              <w-item-section side>
                <status-light :color="adminStore.info.isMetricsEnabled ? `positive` : `negative`" />
              </w-item-section>
            </w-item>
            <w-item
              to="/_admin/rendering"
              active-class="bg-primary text-white"
              v-if="flagsStore.experimental">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-rich-text-converter.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.rendering.title') }}</w-item-section>
            </w-item>
            <w-item to="/_admin/scheduler" active-class="bg-primary text-white">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-bot.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.scheduler.title') }}</w-item-section>
              <w-item-section side>
                <status-light
                  :color="adminStore.info.isSchedulerHealthy ? `positive` : `warning`"
                  :pulse="!adminStore.info.isSchedulerHealthy" />
              </w-item-section>
            </w-item>
            <w-item to="/_admin/search" active-class="bg-primary text-white">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-find-and-replace.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.search.title') }}</w-item-section>
            </w-item>
            <w-item to="/_admin/security" active-class="bg-primary text-white">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-protect.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.security.title') }}</w-item-section>
            </w-item>
            <w-item
              to="/_admin/ssl"
              active-class="bg-primary text-white"
              disabled
              v-if="flagsStore.experimental">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-security-ssl.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.ssl.title') }}</w-item-section>
            </w-item>
            <w-item to="/_admin/system" active-class="bg-primary text-white">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-processor.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.system.title') }}</w-item-section>
              <w-item-section side>
                <status-light :color="adminStore.isVersionLatest ? `positive` : `warning`" />
              </w-item-section>
            </w-item>
            <w-item to="/_admin/terminal" active-class="bg-primary text-white">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-linux-terminal.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.terminal.title') }}</w-item-section>
            </w-item>
            <w-item to="/_admin/utilities" active-class="bg-primary text-white">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-swiss-army-knife.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.utilities.title') }}</w-item-section>
            </w-item>
            <w-item to="/_admin/webhooks" active-class="bg-primary text-white">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-lightning-bolt.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.webhooks.title') }}</w-item-section>
              <w-item-section side>
                <w-badge
                  color="dark-3"
                  :label="adminStore.info.webhooksTotal"
                  :class="countBadgeClass(adminStore.info.webhooksTotal)" />
              </w-item-section>
            </w-item>
            <w-item to="/_admin/flags" active-class="bg-primary text-white">
              <w-item-section avatar>
                <w-icon name="img:/_assets/icons/fluent-windsock.svg" />
              </w-item-section>
              <w-item-section>{{ t('admin.dev.flags.title') }}</w-item-section>
            </w-item>
          </template>
        </w-list>
      </w-scroll-area>
    </w-drawer>
    <w-page-container class="admin-container">
      <router-view v-slot="{ Component }"><component :is="Component" /></router-view>
      <w-footer><footer-nav generic /></w-footer>
    </w-page-container>
    <w-dialog class="admin-overlay" v-model="overlayIsShown" persistent full-width full-height>
      <component :is="overlays[adminStore.overlay]" />
    </w-dialog>
  </w-layout>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useMeta } from '@/composables/meta'

import { useAdminStore } from '@/stores/admin'
import { useCommonStore } from '@/stores/common'
import { useFlagsStore } from '@/stores/flags'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import AccountMenu from '../components/AccountMenu.vue'
import FooterNav from '@/components/FooterNav.vue'
import LoadingGeneric from '@/components/LoadingGeneric.vue'
// -> Each with a loading placeholder, as the overlays opened from the page view have: the dialog
//    around them is already on screen while the chunk is fetched, so without one the panel is empty
//    until it arrives and then fills in all at once
const overlays = {
  EditorMarkdownConfig: defineAsyncComponent({
    loader: () => import('../components/EditorMarkdownConfigOverlay.vue'),
    loadingComponent: LoadingGeneric
  }),
  GroupEditOverlay: defineAsyncComponent({
    loader: () => import('../components/GroupEditOverlay.vue'),
    loadingComponent: LoadingGeneric
  }),
  // MailTemplateEditorOverlay: defineAsyncComponent({ loader: () => import('../components/MailTemplateEditorOverlay.vue'), loadingComponent: LoadingGeneric }),
  UserEditOverlay: defineAsyncComponent({
    loader: () => import('../components/UserEditOverlay.vue'),
    loadingComponent: LoadingGeneric
  })
}

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

// -> The site's own name rather than the literal `Wiki.js`, as the page view does. A getter, so the
//    template is recomputed when the site config arrives -- see the note in `MainLayout`.
useMeta(() => {
  const siteTitle = siteStore.title
  return {
    titleTemplate: (title) => `${title} - ${t('admin.adminArea')} - ${siteTitle}`
  }
})

// DATA

const leftDrawerOpen = ref(true)

// COMPUTED

const siteSectionShown = computed(() => {
  return (
    userStore.can('manage:sites') ||
    userStore.can('manage:navigation') ||
    userStore.can('manage:theme')
  )
})
/*
  `read:*` grants the list and detail routes without the write ones (see `api/users.ts` /
  `api/groups.ts`), so the nav entry has to open for it too -- otherwise the permission grants access
  to pages nothing links to.
*/
const groupsAreVisible = computed(() => {
  return userStore.can('read:groups') || userStore.can('manage:groups')
})
const usersAreVisible = computed(() => {
  return userStore.can('read:users') || userStore.can('manage:users')
})
const usersSectionShown = computed(() => {
  return groupsAreVisible.value || usersAreVisible.value
})
const overlayIsShown = computed(() => {
  return Boolean(adminStore.overlay)
})

// METHODS

/*
  The nav count badges carry a right border saying whether the thing they count exists at all --
  red at zero, green otherwise -- so a section that is empty reads as such without opening it. The
  colours are the status lights' own, so the two markers in the column say the same thing the same
  way; see the `.count-badge` rules for where they come from.
*/
function countBadgeClass(count) {
  return count > 0 ? 'count-badge count-badge--filled' : 'count-badge'
}

// WATCHERS

watch(
  () => route.path,
  async (newValue) => {
    if (!newValue.startsWith('/_admin')) {
      return
    }
    if (!userStore.can('access:admin')) {
      router.replace('/_error/unauthorized')
    }
  },
  { immediate: true }
)
watch(
  () => adminStore.sites,
  (newValue) => {
    if (adminStore.currentSiteId === null && newValue.length > 0) {
      adminStore.$patch({
        currentSiteId: siteStore.id
      })
    }
  }
)
watch(
  () => adminStore.currentSiteId,
  (newValue) => {
    if (newValue && route.params.siteid !== newValue) {
      router.push({ params: { siteid: newValue } })
    }
  }
)

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
@use 'sass:color';

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

  // -> Nav rows are a 24px icon and its label, so the avatar column's 56px track centres the icon
  //    and leaves the pair reading as two columns rather than one item. Sizing the column to the
  //    icon leaves the section's own 16px as the whole gap. Needs the extra `.w-list` to outrank
  //    WItemSection's scoped rule, which matches on specificity alone.
  .w-list .w-item-section--avatar {
    min-width: auto;
  }

  /*
    Nav rows carry two kinds of trailing marker -- a status light and a count badge -- and they have
    to read as one column. Both already end on the same right edge; what did not line up is the
    height. StatusLight is `height: 100%`, so it takes whatever the row gives it (28px on these
    dense rows), while a badge is sized by its own text at 16px, leaving the lights standing 6px
    proud above and below every badge in the column.

    Pinning them to the badge's band fixes that. It is scoped to the sidebar rather than changed in
    StatusLight, because the full-height stripe is the point everywhere else it is used: the storage,
    rendering and auth lists put one beside a two-line item, where it reads as an edge marker for the
    whole row and has no badge to line up with.
  */
  .w-list .status-light {
    height: 16px;
  }

  /*
    `$negative` / `$positive` rather than the `--color-*` custom properties, because these have to
    match the status lights beside them exactly and StatusLight styles itself from the SCSS
    variables -- the custom properties resolve through `--q-*`, which is rewritten at runtime for
    per-site theming and would drift away from the lights on any site that sets its own colours.
  */
  // -> 5px is StatusLight's own width, so the stripe on a badge and the light on the row below it
  //    are the same bar of colour rather than two thicknesses of it
  .count-badge {
    border-right: 5px solid $negative;

    &--filled {
      border-right-color: $positive;
    }
  }

  // -> The section headings between nav groups; the double shadow is the divider above them
  .w-item-label--header {
    box-shadow:
      0 -1px 0 0 rgba(255, 255, 255, 0.15),
      0 -2px 0 0 color.adjust($dark-6, $lightness: -1%);
    padding-top: 16px;
  }
}
// -> No `.w-card` rule here: WCard already paints its own surface with these exact colours, and an
//    unlayered rule in an SFC stylesheet outranks every Tailwind utility however specific, so this
//    restatement did nothing except stop the admin pages tinting a card with `bg-negative` / `bg-info`
.admin-container {
  @at-root .body--light & {
    background-color: $grey-1;
  }
  @at-root .body--dark & {
    background-color: $dark-4;
  }
}

.admin-overlay {
  > .w-dialog-backdrop {
    background-color: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(5px) saturate(180%);
  }
  > .w-dialog-viewport {
    padding: 24px 64px;

    @media (max-width: 1023.98px) {
      padding: 0;
    }

    // -> The radius is WDialog's, and the panel clips to it there; this only adds the depth and the
    //    title-bar strip an overlay wants on top of it
    > .w-dialog-panel {
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);

      @at-root .body--light & {
        background-image: linear-gradient(to bottom, $dark-5 10px, $grey-3 11px, $grey-4);
      }
      @at-root .body--dark & {
        background-image: linear-gradient(to bottom, $dark-4 10px, $dark-4 11px, $dark-3);
      }
    }
  }
}

// -> The `.admin-footer > .q-bar` rule that used to sit here never matched: FooterNav rendered a
//    footer element, never a bar. Its colours come from its own scoped style.
</style>
