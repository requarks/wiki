<template lang='pug'>
q-page.admin-groups
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-account.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.users.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.users.subtitle') }}
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
        :href='siteStore.docsBase + `/admin/groups`'
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
        :label='t(`admin.users.create`)'
        color='primary'
        @click='createUser'
        :disabled='state.loading > 0'
        )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12
      q-card.shadow-1
        q-table(
          :rows='state.users'
          :columns='headers'
          row-key='id'
          flat
          hide-header
          hide-bottom
          :rows-per-page-options='[0]'
          :loading='state.loading > 0'
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
                icon='las la-trash'
                color='negative'
                @click='deleteUser(props.row)'
                )
</template>

<script setup>
import gql from 'graphql-tag'
import { cloneDeep } from 'lodash-es'
import { DateTime } from 'luxon'
import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { useAdminStore } from 'src/stores/admin'
import { useSiteStore } from 'src/stores/site'

import UserCreateDialog from '../components/UserCreateDialog.vue'

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
  title: t('admin.users.title')
})

// DATA

const state = reactive({
  users: [],
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

watch(() => adminStore.overlay, (newValue, oldValue) => {
  if (newValue === '' && oldValue === 'UserEditOverlay') {
    router.push('/_admin/users')
    load()
  }
})

watch(() => route.params.id, checkOverlay)

// METHODS

async function load () {
  state.loading++
  $q.loading.show()
  const resp = await APOLLO_CLIENT.query({
    query: gql`
      query getUsers {
        users {
          id
          name
          email
          isSystem
          isActive
          createdAt
          lastLoginAt
        }
      }
    `,
    fetchPolicy: 'network-only'
  })
  state.users = cloneDeep(resp?.data?.users)
  $q.loading.hide()
  state.loading--
}

function humanizeDate (val) {
  return DateTime.fromISO(val).toRelative()
}

function checkOverlay () {
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

function createUser () {
  $q.dialog({
    component: UserCreateDialog
  }).onOk(() => {
    this.load()
  })
}

function deleteUser (usr) {
  $q.dialog({
    // component: UserDeleteDialog,
    componentProps: {
      user: usr
    }
  }).onOk(load)
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
