<template lang='pug'>
q-page.admin-groups
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-people.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ $t('admin.groups.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ $t('admin.groups.subtitle') }}
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
        href='https://docs.js.wiki/admin/groups'
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
        :label='$t(`admin.groups.create`)'
        color='primary'
        @click='createGroup'
        )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12
      q-card.shadow-1
        q-table(
          :rows='groups'
          :columns='headers'
          row-key='id'
          flat
          hide-header
          hide-bottom
          :rows-per-page-options='[0]'
          :loading='loading > 0'
          :filter='search'
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
              ) {{$t('admin.groups.usersCount', { count: props.value })}}
          template(v-slot:body-cell-edit='props')
            q-td(:props='props')
              q-btn.acrylic-btn.q-mr-sm(
                flat
                :to='`/_admin/groups/` + props.row.id'
                icon='las la-pen'
                color='indigo'
                :label='$t(`common.actions.edit`)'
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

<script>
import gql from 'graphql-tag'
import cloneDeep from 'lodash/cloneDeep'
import { createMetaMixin } from 'quasar'
import { sync } from 'vuex-pathify'

import GroupCreateDialog from '../components/GroupCreateDialog.vue'
import GroupDeleteDialog from '../components/GroupDeleteDialog.vue'

export default {
  mixins: [
    createMetaMixin(function () {
      return {
        title: this.$t('admin.groups.title')
      }
    })
  ],
  data () {
    return {
      groups: [],
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
          label: this.$t('admin.groups.userCount'),
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
    }
  },
  watch: {
    overlay (newValue, oldValue) {
      if (newValue === '' && oldValue === 'GroupEditOverlay') {
        this.$router.push('/_admin/groups')
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
      this.groups = cloneDeep(resp?.data?.groups)
      this.$q.loading.hide()
      this.loading--
    },
    checkOverlay () {
      if (this.$route.params && this.$route.params.id) {
        this.$store.set('admin/overlayOpts', { id: this.$route.params.id })
        this.$store.set('admin/overlay', 'GroupEditOverlay')
      } else {
        this.$store.set('admin/overlay', '')
      }
    },
    createGroup () {
      this.$q.dialog({
        component: GroupCreateDialog
      }).onOk(() => {
        this.load()
      })
    },
    editGroup (gr) {
      this.$router.push(`/_admin/groups/${gr.id}`)
    },
    deleteGroup (gr) {
      this.$q.dialog({
        component: GroupDeleteDialog,
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
