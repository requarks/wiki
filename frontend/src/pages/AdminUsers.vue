<template>
  <w-page class="admin-groups">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-account.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.users.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.users.subtitle') }}
        </div>
      </div>
      <div class="flex-none flex items-center">
        <w-input
          class="denser mr-2"
          outlined
          v-model="state.search"
          dense
          :class="dark.isActive ? `bg-dark text-white` : `bg-white`">
          <template #prepend><w-icon class="opacity-50" name="la:search" size="20px" /></template>
        </w-input>
        <w-btn
          class="acrylic-btn mr-2"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/groups`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:redo-alt"
          flat
          color="secondary"
          :aria-label="t(`common.actions.refresh`)"
          @click="load"
          :loading="state.loading > 0">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="mr-2"
          icon="la:user-cog"
          unelevated
          color="secondary"
          :aria-label="t(`admin.users.defaults`)">
          <w-tooltip>{{ t(`admin.users.defaults`) }}</w-tooltip>
          <user-defaults-menu />
        </w-btn>
        <w-btn
          unelevated
          icon="la:plus"
          :label="t(`admin.users.create`)"
          color="primary"
          @click="createUser"
          :disabled="state.loading > 0" />
      </div>
    </div>
    <w-separator inset />
    <div class="grid grid-cols-12 p-4 gap-4">
      <div class="col-span-12">
        <w-card>
          <w-table
            :rows="state.users"
            :columns="headers"
            row-key="id"
            flat
            hide-header
            :loading="state.loading > 0">
            <template #body-cell-id="props">
              <w-td :props="props"><w-icon name="la:user" color="primary" size="sm" /></w-td>
            </template>
            <template #body-cell-name="props">
              <w-td :props="props">
                <div class="flex items-center">
                  <strong>{{ props.value }}</strong>
                  <w-icon class="ml-2" v-if="props.row.isSystem" name="la:lock" color="pink" />
                  <w-icon class="ml-2" v-if="!props.row.isActive" name="la:ban" color="pink" />
                </div>
              </w-td>
            </template>
            <template #body-cell-email="props">
              <w-td :props="props"
                ><em>{{ props.value }}</em></w-td
              >
            </template>
            <template #body-cell-date="props">
              <w-td :props="props">
                <i18n-t class="text-caption" keypath="admin.users.createdAt" tag="div">
                  <template #date
                    ><strong>{{ formattedDate(props.value) }}</strong></template
                  >
                </i18n-t>
                <i18n-t
                  class="text-caption"
                  v-if="props.row.lastLoginAt"
                  keypath="admin.users.lastLoginAt"
                  tag="div">
                  <template #date>
                    <strong>{{ relativeDate(props.row.lastLoginAt) }}</strong>
                  </template>
                </i18n-t>
              </w-td>
            </template>
            <template #body-cell-edit="props">
              <w-td :props="props">
                <w-btn
                  class="acrylic-btn mr-2"
                  v-if="!props.row.isSystem"
                  flat
                  :to="`/_admin/users/` + props.row.id"
                  icon="la:pen"
                  :color="dark.isActive ? `indigo-4` : `indigo`"
                  :label="t(`common.actions.edit`)"
                  no-caps />
                <w-btn
                  class="acrylic-btn"
                  v-if="!props.row.isSystem"
                  flat
                  icon="la:trash"
                  color="negative"
                  @click="deleteUser(props.row)" />
              </w-td>
            </template>
          </w-table>
        </w-card>
        <div class="flex items-center justify-center mt-6" v-if="state.totalPages > 1">
          <w-pagination
            v-model="state.currentPage"
            :max="state.totalPages"
            :max-pages="9"
            boundary-numbers
            direction-links />
        </div>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'
import { dialog } from '@/composables/dialog'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import { relativeDate } from '@/helpers/datetime'

import { debounce } from 'es-toolkit/function'
import UserCreateDialog from '../components/UserCreateDialog.vue'
import UserDefaultsMenu from '@/components/UserDefaultsMenu.vue'

// COMPOSABLES

const dark = useDark()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.users.title')
})

// DATA

const state = reactive({
  users: [],
  loading: 0,
  search: '',
  currentPage: 1,
  pageSize: 20,
  totalPages: 15
})

const headers = [
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

// WATCHERS

watch(
  () => adminStore.overlay,
  (newValue, oldValue) => {
    if (newValue === '' && oldValue === 'UserEditOverlay') {
      router.push('/_admin/users')
      load()
    }
  }
)

watch(() => route.params.id, checkOverlay)

watch(
  () => state.search,
  debounce(() => {
    load({ page: 1 })
  }, 400)
)
watch(
  () => state.currentPage,
  (newValue) => {
    load({ page: newValue })
  }
)

// METHODS

async function load({ page } = {}) {
  state.loading++
  loading.show()
  try {
    const resp = await API_CLIENT.get('users', {
      searchParams: {
        ...(state.search ? { filter: state.search } : {}),
        page: page ?? state.currentPage ?? 1,
        limit: state.pageSize ?? 20
      }
    }).json()
    state.totalPages = Math.ceil((resp?.total || 1) / state.pageSize)
    state.users = resp?.users ?? []
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.users.loadFailed'),
      caption: err.message
    })
  }
  loading.hide()
  state.loading--
}

/** Largest-first. `week` is deliberately absent, so output reads e.g. "21 days ago". */
function formattedDate(val) {
  return userStore.formatDateTime(t, val)
}

function checkOverlay() {
  if (route.params?.id) {
    adminStore.$patch({
      overlayOpts: { id: route.params.id },
      overlay: 'UserEditOverlay'
    })
  } else {
    adminStore.$patch({
      overlay: ''
    })
  }
}

function createUser() {
  dialog({
    component: UserCreateDialog
  }).onOk(() => {
    load()
  })
}

function deleteUser(usr) {
  dialog({
    // component: UserDeleteDialog,
    componentProps: {
      user: usr
    }
  }).onOk(load)
}

// MOUNTED

onMounted(() => {
  checkOverlay()
  load({ page: 1 })
})

// BEFORE UNMOUNT

onBeforeUnmount(() => {
  adminStore.$patch({
    overlay: ''
  })
})
</script>

<style lang="scss"></style>
