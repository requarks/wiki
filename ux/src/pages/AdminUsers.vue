<template lang='pug'>
q-page.admin-groups
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-account.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ $t('admin.users.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ $t('admin.users.subtitle') }}
    .col-auto.flex.items-center
      q-input.denser.q-mr-sm(
        outlined
        v-model='search'
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
        href='https://docs.js.wiki/admin/users'
        target='_blank'
        )
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        @click='load'
        :loading='loading > 0'
        )
      q-btn(
        unelevated
        icon='las la-plus'
        :label='$t(`admin.users.create`)'
        color='primary'
        @click='createUser'
        :disabled='loading > 0'
        )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12
      q-card.shadow-1
        q-table(
          :rows='users'
          :columns='headers'
          row-key='id'
          flat
          hide-header
          hide-bottom
          :rows-per-page-options='[0]'
          :loading='loading > 0'
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
                :label='$t(`common.actions.edit`)'
                no-caps
                )
              q-btn.acrylic-btn(
                v-if='!props.row.isSystem'
                flat
                icon='las la-trash'
                color='accent'
                @click='deleteGroup(props.row)'
                )
</template>

<script>
import gql from 'graphql-tag'
import cloneDeep from 'lodash/cloneDeep'
import { DateTime } from 'luxon'
import { sync } from 'vuex-pathify'
import { createMetaMixin } from 'quasar'

import UserCreateDialog from '../components/UserCreateDialog.vue'

export default {
  mixins: [
    createMetaMixin(function () {
      return {
        title: this.$t('admin.users.title')
      }
    })
  ],
  data () {
    return {
      users: [],
      loading: 0,
      search: ''
    }
  },
  computed: {
    overlay: sync('admin/overlay', false),
    headers () {
      return [
        {
          align: 'center',
          field: 'id',
          name: 'id',
          sortable: false,
          style: 'width: 20px'
        },
        {
          label: this.$t('common.field.name'),
          align: 'left',
          field: 'name',
          name: 'name',
          sortable: true
        },
        {
          label: this.$t('admin.users.email'),
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
    }
  },
  watch: {
    overlay (newValue, oldValue) {
      if (newValue === '' && oldValue === 'UserEditOverlay') {
        this.$router.push('/_admin/users')
        this.load()
      }
    },
    $route: 'checkOverlay'
  },
  mounted () {
    this.checkOverlay()
    this.load()
  },
  beforeUnmount () {
    this.overlay = ''
  },
  methods: {
    async load () {
      this.loading++
      this.$q.loading.show()
      const resp = await this.$apollo.query({
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
      this.users = cloneDeep(resp?.data?.users)
      this.$q.loading.hide()
      this.loading--
    },
    humanizeDate (val) {
      return DateTime.fromISO(val).toRelative()
    },
    checkOverlay () {
      if (this.$route.params && this.$route.params.id) {
        this.$store.set('admin/overlayOpts', { id: this.$route.params.id })
        this.$store.set('admin/overlay', 'UserEditOverlay')
      } else {
        this.$store.set('admin/overlay', '')
      }
    },
    createUser () {
      this.$q.dialog({
        component: UserCreateDialog
      }).onOk(() => {
        this.load()
      })
    },
    deleteUser (gr) {
      this.$q.dialog({
        // component: UserDeleteDialog,
        componentProps: {
          group: gr
        }
      }).onOk(() => {
        this.load()
      })
    }
  }
}
</script>

<style lang='scss'>

</style>
