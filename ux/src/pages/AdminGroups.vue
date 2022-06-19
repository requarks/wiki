<template lang='pug'>
q-page.admin-groups
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-people.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.groups.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.groups.subtitle') }}
    .col-auto.flex.items-center
      q-input.denser.q-mr-sm(
        outlined
        v-model='state.search'
        dense
        :class='$q.dark.isActive ? `bg-dark` : `bg-white`'
        )
        template(#prepend)
          q-icon(name='las la-search')
      q-btn.acrylic-btn.q-mr-sm(
        icon='las la-question-circle'
        flat
        color='grey'
        type='a'
        href='https://docs.js.wiki/admin/groups'
        target='_blank'
        )
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        @click='load'
        :loading='state.loading > 0'
        )
      q-btn(
        unelevated
        icon='las la-plus'
        :label='t(`admin.groups.create`)'
        color='primary'
        @click='createGroup'
        )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12
      q-card.shadow-1
        q-table(
          :rows='state.groups'
          :columns='headers'
          row-key='id'
          flat
          hide-header
          hide-bottom
          :rows-per-page-options='[0]'
          :loading='state.loading > 0'
          :filter='state.search'
          )
          template(v-slot:body-cell-id='props')
            q-td(:props='props')
              q-icon(name='las la-users', color='primary', size='sm')
          template(v-slot:body-cell-name='props')
            q-td(:props='props')
              .flex.items-center
                strong {{props.value}}
                q-icon.q-ml-sm(
                  v-if='props.row.isSystem'
                  name='las la-lock'
                  color='pink'
                  )
          template(v-slot:body-cell-usercount='props')
            q-td(:props='props')
              q-chip.text-caption(
                square
                :color='$q.dark.isActive ? `dark-6` : `grey-2`'
                :text-color='$q.dark.isActive ? `white` : `grey-8`'
                dense
              ) {{t('admin.groups.usersCount', { count: props.value })}}
          template(v-slot:body-cell-edit='props')
            q-td(:props='props')
              q-btn.acrylic-btn.q-mr-sm(
                flat
                :to='`/_admin/groups/` + props.row.id'
                icon='las la-pen'
                color='indigo'
                :label='t(`common.actions.edit`)'
                no-caps
                )
              q-btn.acrylic-btn(
                flat
                icon='las la-trash'
                :color='props.row.isSystem ? `grey` : `accent`'
                :disabled='props.row.isSystem'
                @click='deleteGroup(props.row)'
                )
</template>

<script setup>
import gql from 'graphql-tag'
import { cloneDeep } from 'lodash-es'
import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { useAdminStore } from 'src/stores/admin'

import GroupCreateDialog from '../components/GroupCreateDialog.vue'
import GroupDeleteDialog from '../components/GroupDeleteDialog.vue'

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()

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

watch(() => adminStore.overlay, (newValue, oldValue) => {
  if (newValue === '' && oldValue === 'GroupEditOverlay') {
    router.push('/_admin/groups')
    load()
  }
})

watch(() => route.params.id, checkOverlay)

// METHODS

async function load () {
  state.loading++
  $q.loading.show()
  try {
    const resp = await APOLLO_CLIENT.query({
      query: gql`
        query getGroups {
          groups {
            id
            name
            isSystem
            userCount
            createdAt
            updatedAt
          }
        }
      `,
      fetchPolicy: 'network-only'
    })
    state.groups = cloneDeep(resp?.data?.groups)
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to load groups.',
      caption: err.message
    })
  }
  $q.loading.hide()
  state.loading--
}

function checkOverlay () {
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

function createGroup () {
  $q.dialog({
    component: GroupCreateDialog
  }).onOk(() => {
    load()
  })
}

function editGroup (gr) {
  router.push(`/_admin/groups/${gr.id}`)
}

function deleteGroup (gr) {
  $q.dialog({
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

<style lang='scss'>

</style>
