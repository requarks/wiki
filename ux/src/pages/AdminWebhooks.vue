<template lang='pug'>
q-page.admin-webhooks
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-lightning-bolt.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ $t('admin.webhooks.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ $t('admin.webhooks.subtitle') }}
    .col-auto
      q-spinner-tail.q-mr-md(
        v-show='loading'
        color='accent'
        size='sm'
      )
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        href='https://docs.js.wiki/admin/webhooks'
        target='_blank'
        type='a'
        )
      q-btn.acrylic-btn.q-mr-sm(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='loading > 0'
        @click='load'
        )
      q-btn(
        unelevated
        icon='las la-plus'
        :label='$t(`admin.webhooks.new`)'
        color='primary'
        @click='createHook'
        )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12(v-if='hooks.length < 1')
      q-card.rounded-borders(
        flat
        :class='$q.dark.isActive ? `bg-dark-5 text-white` : `bg-grey-3 text-dark`'
        )
        q-card-section.items-center(horizontal)
          q-card-section.col-auto.q-pr-none
            q-icon(name='las la-info-circle', size='sm')
          q-card-section.text-caption {{ $t('admin.webhooks.none') }}
    .col-12(v-else)
      q-card
        q-list(separator)
          q-item(v-for='hook of hooks', :key='hook.id')
            q-item-section(side)
              q-icon(name='las la-bolt', color='primary')
            q-item-section
              q-item-label {{hook.name}}
              q-item-label(caption) {{hook.url}}
            q-item-section(side, style='flex-direction: row; align-items: center;')
              template(v-if='hook.state === `pending`')
                q-spinner-clock.q-mr-sm(
                  color='indigo'
                  size='xs'
                )
                .text-caption.text-indigo {{$t('admin.webhooks.statePending')}}
                q-tooltip(anchor='center left', self='center right') {{$t('admin.webhooks.statePendingHint')}}
              template(v-else-if='hook.state === `success`')
                q-spinner-infinity.q-mr-sm(
                  color='positive'
                  size='xs'
                )
                .text-caption.text-positive {{$t('admin.webhooks.stateSuccess')}}
                q-tooltip(anchor='center left', self='center right') {{$t('admin.webhooks.stateSuccessHint')}}
              template(v-else-if='hook.state === `error`')
                q-icon.q-mr-sm(
                  color='negative'
                  size='xs'
                  name='las la-exclamation-triangle'
                )
                .text-caption.text-negative {{$t('admin.webhooks.stateError')}}
                q-tooltip(anchor='center left', self='center right') {{$t('admin.webhooks.stateErrorHint')}}
            q-separator.q-ml-md(vertical)
            q-item-section(side, style='flex-direction: row; align-items: center;')
              q-btn.acrylic-btn.q-mr-sm(
                color='indigo'
                icon='las la-pen'
                label='Edit'
                flat
                no-caps
                @click='editHook(hook.id)'
              )
              q-btn.acrylic-btn(
                color='red'
                icon='las la-trash'
                flat
                @click='deleteHook(hook)'
              )

</template>

<script>
import cloneDeep from 'lodash/cloneDeep'
import gql from 'graphql-tag'

import { createMetaMixin, QSpinnerClock, QSpinnerInfinity } from 'quasar'
import WebhookDeleteDialog from '../components/WebhookDeleteDialog.vue'
import WebhookEditDialog from '../components/WebhookEditDialog.vue'

export default {
  components: {
    QSpinnerClock,
    QSpinnerInfinity
  },
  mixins: [
    createMetaMixin(function () {
      return {
        title: this.$t('admin.webhooks.title')
      }
    })
  ],
  data () {
    return {
      hooks: [],
      loading: 0
    }
  },
  mounted () {
    this.load()
  },
  methods: {
    async load () {
      this.loading++
      this.$q.loading.show()
      const resp = await this.$apollo.query({
        query: gql`
          query getHooks {
            hooks {
              id
              name
              url
              state
            }
          }
        `,
        fetchPolicy: 'network-only'
      })
      this.config = cloneDeep(resp?.data?.hooks) ?? []
      this.$q.loading.hide()
      this.loading--
    },
    createHook () {
      this.$q.dialog({
        component: WebhookEditDialog,
        componentProps: {
          hookId: null
        }
      }).onOk(() => {
        this.load()
      })
    },
    editHook (id) {
      this.$q.dialog({
        component: WebhookEditDialog,
        componentProps: {
          hookId: id
        }
      }).onOk(() => {
        this.load()
      })
    },
    deleteHook (hook) {
      this.$q.dialog({
        component: WebhookDeleteDialog,
        componentProps: {
          hook
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
