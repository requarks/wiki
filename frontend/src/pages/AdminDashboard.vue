<template>
  <w-page class="admin-dashboard">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-apps-tab-animated.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.dashboard.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.dashboard.subtitle') }}
        </div>
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
              :disable="!userStore.can(`manage:users`)"
              @click="newGroup" />
            <w-separator vertical />
            <w-btn
              flat
              :color="actionColor"
              icon="la:users"
              :label="t(`common.actions.manage`)"
              :disable="!userStore.can(`manage:users`)"
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
              :disable="!userStore.can(`manage:users`)"
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
      <!-- .col-12.col-lg-9 -->
      <!-- q-card -->
      <!-- q-card-section --- -->
      <div class="col-span-12">
        <w-banner
          class="bg-positive text-white"
          :class="adminStore.isVersionLatest ? `bg-positive` : `bg-warning`"
          inline-actions>
          <w-icon name="la:check" class="mr-2" />
          <span class="font-medium" v-if="adminStore.isVersionLatest"
            >Your Wiki.js server is running the latest version!</span
          >
          <span class="font-medium" v-else
            >A new version of Wiki.js is available. Please update to the latest version.</span
          >
          <template #action v-if="userStore.can(`manage:system`)">
            <w-btn flat :label="t(`admin.system.checkForUpdates`)" @click="checkForUpdates" />
            <w-separator class="mx-2" vertical dark />
            <w-btn flat :label="t(`admin.system.title`)" to="/_admin/system" />
          </template>
        </w-banner>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { computed } from 'vue'

import { useMeta } from '@/composables/meta'
import { dialog } from '@/composables/dialog'
import { useDark } from '@/composables/dark'

import { useFlagsStore } from '@/stores/flags'
import { useUserStore } from '@/stores/user'

import { useAdminStore } from '../stores/admin'
import CheckUpdateDialog from '@/components/CheckUpdateDialog.vue'
import SiteCreateDialog from '@/components/SiteCreateDialog.vue'
import UserCreateDialog from '@/components/UserCreateDialog.vue'
import GroupCreateDialog from '@/components/GroupCreateDialog.vue'

// STORES

const adminStore = useAdminStore()
const flagsStore = useFlagsStore()
const userStore = useUserStore()

// COMPOSABLES

const dark = useDark()

/*
  WBtn emits its colour as an inline style, so no `dark:` class can reach it -- the theme has to be
  read here. `primary` is a mid-tone picked to read on white; on the dark card it needs the lightened
  mix, the same one the section headings use.
*/
const actionColor = computed(() => (dark.isActive ? 'primary-light' : 'primary'))

// ROUTER

const router = useRouter()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.dashboard.title')
})

// METHODS

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
