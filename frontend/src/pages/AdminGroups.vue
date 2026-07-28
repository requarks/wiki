<template>
  <w-page class="admin-groups">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-people.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.groups.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.groups.subtitle') }}
        </div>
      </div>
      <div class="flex-none flex items-center">
        <w-input
          class="denser mr-2"
          outlined
          v-model="state.search"
          dense
          :class="dark.isActive ? `bg-dark` : `bg-white`">
          <template #prepend><w-icon name="la:search" /></template>
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
          unelevated
          icon="la:plus"
          :label="t(`admin.groups.create`)"
          color="primary"
          @click="createGroup" />
      </div>
    </div>
    <w-separator inset />
    <div class="grid grid-cols-12 p-4 gap-4">
      <div class="col-span-12">
        <w-card>
          <w-table
            :rows="state.groups"
            :columns="headers"
            row-key="id"
            flat
            hide-header
            :loading="state.loading > 0"
            :filter="state.search">
            <template v-slot:body-cell-id="props">
              <w-td :props="props"
                ><w-icon name="la:users" color="primary" size="sm"
              /></w-td>
            </template>
            <template v-slot:body-cell-name="props">
              <w-td :props="props">
                <div class="flex items-center">
                  <strong>{{ props.value }}</strong>
                  <w-icon
                    class="ml-2"
                    v-if="props.row.isSystem"
                    name="la:lock"
                    color="pink" />
                </div>
              </w-td>
            </template>
            <template v-slot:body-cell-usercount="props">
              <w-td :props="props">
                <w-chip
                  class="text-caption"
                  square
                  :color="dark.isActive ? `dark-6` : `grey-2`"
                  :text-color="dark.isActive ? `white` : `grey-8`"
                  dense
                  >{{ t('admin.groups.usersCount', { count: props.value }) }}</w-chip
                >
              </w-td>
            </template>
            <template v-slot:body-cell-edit="props">
              <w-td :props="props">
                <w-btn
                  class="acrylic-btn mr-2"
                  flat
                  :to="`/_admin/groups/` + props.row.id"
                  icon="la:pen"
                  color="indigo"
                  :label="t(`common.actions.edit`)"
                  no-caps />
                <w-btn
                  class="acrylic-btn"
                  flat
                  icon="la:trash"
                  :color="props.row.isSystem ? `grey` : `negative`"
                  :disabled="props.row.isSystem"
                  @click="deleteGroup(props.row)" />
              </w-td>
            </template>
          </w-table>
        </w-card>
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

import GroupCreateDialog from '../components/GroupCreateDialog.vue'
import GroupDeleteDialog from '../components/GroupDeleteDialog.vue'

// COMPOSABLES

const dark = useDark()

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
  title: t('admin.groups.title')
})

// DATA

const state = reactive({
  groups: [],
  loading: 0,
  search: ''
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
    label: t('admin.groups.userCount'),
    align: 'center',
    field: 'userCount',
    name: 'usercount',
    sortable: false,
    style: 'width: 150px'
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
    if (newValue === '' && oldValue === 'GroupEditOverlay') {
      router.push('/_admin/groups')
      load()
    }
  }
)

watch(() => route.params.id, checkOverlay)

// METHODS

async function load() {
  state.loading++
  loading.show()
  try {
    state.groups = await API_CLIENT.get('groups').json()
  } catch (err) {
    notify({
      type: 'negative',
      message: 'Failed to load groups.',
      caption: err.message
    })
  }
  loading.hide()
  state.loading--
}

function checkOverlay() {
  if (route.params?.id) {
    adminStore.$patch({
      overlayOpts: { id: route.params.id },
      overlay: 'GroupEditOverlay'
    })
  } else {
    adminStore.$patch({
      overlay: ''
    })
  }
}

function createGroup() {
  dialog({
    component: GroupCreateDialog
  }).onOk(() => {
    load()
  })
}

function editGroup(gr) {
  router.push(`/_admin/groups/${gr.id}`)
}

function deleteGroup(gr) {
  dialog({
    component: GroupDeleteDialog,
    componentProps: {
      group: gr
    }
  }).onOk(() => {
    load()
  })
}

// MOUNTED

onMounted(() => {
  checkOverlay()
  load()
})

// BEFORE UNMOUNT

onBeforeUnmount(() => {
  adminStore.$patch({
    overlay: ''
  })
})
</script>

<style lang="scss"></style>
