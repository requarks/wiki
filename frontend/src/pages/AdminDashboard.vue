<template>
  <w-page class="admin-dashboard">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img
          class="admin-icon animated fadeInLeft"
          src="/_assets/icons/fluent-apps-tab-animated.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.dashboard.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.dashboard.subtitle') }}
        </div>
      </div>
      <div class="flex-none flex">
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin`"
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
          @click="load">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
      </div>
    </div>
    <div class="grid grid-cols-12 px-4 gap-2">
      <div class="col-span-12 sm:col-span-6 lg:col-span-3">
        <w-card>
          <w-card-section class="admin-dashboard-card">
            <img src="/_assets/icons/fluent-change-theme.svg" />
            <div>
              <strong>{{ t('admin.sites.title') }}</strong>
              <span>{{ adminStore.sites.length }}</span>
            </div>
          </w-card-section>
          <w-separator />
          <w-card-actions align="right">
            <w-btn
              flat
              :color="actionColor"
              icon="la:plus-circle"
              :label="t(`common.actions.new`)"
              :disable="!userStore.can(`manage:sites`)"
              @click="newSite" />
            <w-separator vertical />
            <w-btn
              flat
              :color="actionColor"
              icon="la:sitemap"
              :label="t(`common.actions.manage`)"
              :disable="!userStore.can(`manage:sites`)"
              to="/_admin/sites" />
          </w-card-actions>
        </w-card>
      </div>
      <div class="col-span-12 sm:col-span-6 lg:col-span-3">
        <w-card>
          <w-card-section class="admin-dashboard-card">
            <img src="/_assets/icons/fluent-people.svg" />
            <div>
              <strong>{{ t('admin.groups.title') }}</strong>
              <span>{{ adminStore.info.groupsTotal }}</span>
            </div>
          </w-card-section>
          <w-separator />
          <w-card-actions align="right">
            <w-btn
              flat
              :color="actionColor"
              icon="la:plus-circle"
              :label="t(`common.actions.new`)"
              :disable="!userStore.can(`manage:groups`)"
              @click="newGroup" />
            <w-separator vertical />
            <w-btn
              flat
              :color="actionColor"
              icon="la:users"
              :label="t(`common.actions.manage`)"
              :disable="!groupsAreVisible"
              to="/_admin/groups" />
          </w-card-actions>
        </w-card>
      </div>
      <div class="col-span-12 sm:col-span-6 lg:col-span-3">
        <w-card>
          <w-card-section class="admin-dashboard-card">
            <img src="/_assets/icons/fluent-account.svg" />
            <div>
              <strong>{{ t('admin.users.title') }}</strong>
              <span>{{ adminStore.info.usersTotal }}</span>
            </div>
          </w-card-section>
          <w-separator />
          <w-card-actions align="right">
            <w-btn
              flat
              :color="actionColor"
              icon="la:user-plus"
              :label="t(`common.actions.new`)"
              :disable="!userStore.can(`manage:users`)"
              @click="newUser" />
            <w-separator vertical />
            <w-btn
              flat
              :color="actionColor"
              icon="la:user-friends"
              :label="t(`common.actions.manage`)"
              :disable="!usersAreVisible"
              to="/_admin/users" />
          </w-card-actions>
        </w-card>
      </div>
      <!-- .col-12.col-sm-6.col-lg-3 -->
      <!-- q-card -->
      <!-- q-card-section.admin-dashboard-card -->
      <!-- img(src='/_assets/icons/fluent-tag.svg') -->
      <!-- div -->
      <!-- strong {{ t('admin.tags.title') }} -->
      <!-- span {{adminStore.info.tagsTotal}} -->
      <!-- q-separator -->
      <!-- q-card-actions(align='right') -->
      <!-- q-btn( -->
      <!-- flat -->
      <!-- color='primary' -->
      <!-- icon='la:tags' -->
      <!-- :label='t(`common.actions.manage`)' -->
      <!-- :disable='!userStore.can(`manage:sites`)' -->
      <!-- :to='`/_admin/` + adminStore.currentSiteId + `/tags`' -->
      <!-- ) -->
      <div class="col-span-12 sm:col-span-6 lg:col-span-3">
        <w-card>
          <w-card-section class="admin-dashboard-card">
            <img src="/_assets/icons/fluent-female-working-with-a-laptop.svg" />
            <div>
              <strong>Logins</strong>
              <small>{{ adminStore.info.loginsPastDay }} <i>/ past 24h</i></small>
            </div>
          </w-card-section>
          <w-separator />
          <w-card-actions align="right">
            <w-btn
              flat
              :color="actionColor"
              icon="la:chart-area"
              :label="t(`admin.analytics.title`)"
              :disable="!flagsStore.experimental"
              :to="`/_admin/` + adminStore.currentSiteId + `/analytics`" />
          </w-card-actions>
        </w-card>
      </div>
      <div class="col-span-12 sm:col-span-6 lg:col-span-3">
        <w-card>
          <w-card-section class="admin-dashboard-card">
            <img :src="versionCard.icon" />
            <div>
              <strong>Wiki.js version</strong>
              <small :class="{ pending: versionCard.pending }"
                >{{ versionCard.status }}
                <i v-if="versionCard.version"
                  >({{ versionCard.version
                  }}<w-icon
                    v-if="versionCard.latestVersion"
                    name="mdi:arrow-right"
                    class="mx-1 align-middle" />{{ versionCard.latestVersion }})</i
                ></small
              >
            </div>
          </w-card-section>
          <w-separator />
          <w-card-actions align="right">
            <w-btn
              flat
              :color="actionColor"
              icon="la:sync-alt"
              :label="t(`admin.system.checkForUpdates`)"
              :disable="!userStore.can(`manage:system`)"
              @click="checkForUpdates" />
            <w-separator vertical />
            <w-btn
              flat
              :color="actionColor"
              icon="la:info-circle"
              :label="t(`admin.system.title`)"
              :disable="!userStore.can(`manage:system`)"
              to="/_admin/system" />
          </w-card-actions>
        </w-card>
      </div>
      <div class="col-span-12 sm:col-span-6 lg:col-span-3">
        <w-card>
          <w-card-section class="admin-dashboard-card">
            <img src="/_assets/icons/fluent-bot.svg" />
            <div>
              <strong>{{ t('admin.dashboard.activeWorkers') }}</strong>
              <span>{{ adminStore.info.activeWorkers }}</span>
            </div>
          </w-card-section>
          <w-separator />
          <w-card-actions align="right">
            <w-btn
              flat
              :color="actionColor"
              icon="la:tasks"
              :label="t(`admin.scheduler.title`)"
              :disable="!userStore.can(`manage:system`)"
              to="/_admin/scheduler" />
          </w-card-actions>
        </w-card>
      </div>
      <div class="col-span-12 sm:col-span-6 lg:col-span-3">
        <w-card>
          <w-card-section class="admin-dashboard-card">
            <img src="/_assets/icons/fluent-network.svg" />
            <div>
              <strong>{{ t('admin.instances.title') }}</strong>
              <span>{{ adminStore.info.instancesTotal }}</span>
            </div>
          </w-card-section>
          <w-separator />
          <w-card-actions align="right">
            <w-btn
              flat
              :color="actionColor"
              icon="la:server"
              :label="t(`common.actions.view`)"
              :disable="!userStore.can(`manage:system`)"
              to="/_admin/instances" />
          </w-card-actions>
        </w-card>
      </div>
      <div class="col-span-12 sm:col-span-6 lg:col-span-3">
        <w-card>
          <w-card-section class="admin-dashboard-card">
            <img src="/_assets/icons/fluent-lightning-bolt.svg" />
            <div>
              <strong>{{ t('admin.webhooks.title') }}</strong>
              <span>{{ adminStore.info.webhooksTotal }}</span>
            </div>
          </w-card-section>
          <w-separator />
          <w-card-actions align="right">
            <w-btn
              flat
              :color="actionColor"
              icon="la:bolt"
              :label="t(`common.actions.manage`)"
              :disable="!userStore.can(`manage:system`)"
              to="/_admin/webhooks" />
          </w-card-actions>
        </w-card>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { computed, reactive } from 'vue'

import { useMeta } from '@/composables/meta'
import { dialog } from '@/composables/dialog'
import { useDark } from '@/composables/dark'
import { notify } from '@/composables/notify'

import { useFlagsStore } from '@/stores/flags'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import { useAdminStore } from '../stores/admin'
import CheckUpdateDialog from '@/components/CheckUpdateDialog.vue'
import SiteCreateDialog from '@/components/SiteCreateDialog.vue'
import UserCreateDialog from '@/components/UserCreateDialog.vue'
import GroupCreateDialog from '@/components/GroupCreateDialog.vue'

// STORES

const adminStore = useAdminStore()
const flagsStore = useFlagsStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// COMPOSABLES

const dark = useDark()

/*
  WBtn emits its colour as an inline style, so no `dark:` class can reach it -- the theme has to be
  read here. `primary` is a mid-tone picked to read on white; on the dark card it needs the lightened
  mix, the same one the section headings use.
*/
const actionColor = computed(() => (dark.isActive ? 'primary-light' : 'primary'))

/*
  Manage only opens the list, which `read:*` is enough for -- the same rule the nav entries in
  `AdminLayout` use. Creating one is what needs `manage:*`.
*/
const groupsAreVisible = computed(
  () => userStore.can('read:groups') || userStore.can('manage:groups')
)
const usersAreVisible = computed(() => userStore.can('read:users') || userStore.can('manage:users'))

// ROUTER

const router = useRouter()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  loading: 0
})

// COMPUTED

const versionCard = computed(() => {
  switch (adminStore.versionStatus) {
    case 'latest':
      return {
        icon: '/_assets/icons/fluent-done.svg',
        status: t('admin.dashboard.versionUpToDate'),
        version: adminStore.info.currentVersion,
        latestVersion: null,
        pending: false
      }
    case 'outdated':
      return {
        icon: '/_assets/icons/fluent-double-up.svg',
        status: t('admin.dashboard.versionUpdateAvailable'),
        version: adminStore.info.currentVersion,
        latestVersion: adminStore.info.latestVersion,
        pending: false
      }
    default:
      return {
        icon: '/_assets/icons/fluent-refresh.svg',
        status: t('admin.dashboard.versionChecking'),
        version: null,
        latestVersion: null,
        pending: true
      }
  }
})

// META

useMeta({
  title: t('admin.dashboard.title')
})

// METHODS

/*
  Every card reads from the admin store, which `AdminLayout` fills once on mount -- `fetchInfo` for
  the counters on `info`, `fetchSites` for the sites card, which counts the list itself. Refreshing
  the dashboard is therefore both of them, not a call of its own.
*/
async function load() {
  state.loading++
  try {
    await Promise.all([adminStore.fetchInfo(), adminStore.fetchSites()])
  } catch (err) {
    notify({
      type: 'negative',
      message: 'Failed to refresh the dashboard.',
      caption: err.message
    })
  }
  state.loading--
}

function newSite() {
  dialog({
    component: SiteCreateDialog
  }).onOk(() => {
    router.push('/_admin/sites')
  })
}
function newUser() {
  dialog({
    component: UserCreateDialog
  }).onOk(() => {
    router.push('/_admin/users')
  })
}
function newGroup() {
  dialog({
    component: GroupCreateDialog
  }).onOk(() => {
    router.push('/_admin/groups')
  })
}
function checkForUpdates() {
  dialog({
    component: CheckUpdateDialog
  })
}
</script>

<style lang="scss">
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

      /*
        Amber itself (#ffc107) is picked to read on the dark surface; on the white card it lands
        around 1.7:1, so the light theme takes the darker end of the ramp instead.
      */
      &.pending {
        color: var(--color-amber-9);

        @at-root .body--dark & {
          color: var(--color-amber);
        }
      }
    }
  }

  .w-card-actions {
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.03));

    @at-root .body--dark & {
      background: linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.2));
    }
  }
}
</style>
