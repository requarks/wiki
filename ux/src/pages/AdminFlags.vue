<template lang='pug'>
q-page.admin-flags
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-windsock.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ $t('admin.flags.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ $t('admin.flags.subtitle') }}
    .col-auto
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        href='https://docs.requarks.io/admin/flags'
        target='_blank'
        type='a'
        )
      q-btn(
        unelevated
        icon='mdi-check'
        :label='$t(`common.actions.apply`)'
        color='secondary'
        @click='save'
        :loading='loading'
      )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12.col-lg-7
      q-card.shadow-1.q-py-sm
        q-item
          q-item-section
            q-card.bg-negative.text-white.rounded-borders(flat)
              q-card-section.items-center(horizontal)
                q-card-section.col-auto.q-pr-none
                  q-icon(name='las la-exclamation-triangle', size='sm')
                q-card-section
                  span {{ $t('admin.flags.warn.label') }}
                  .text-caption.text-red-1 {{ $t('admin.flags.warn.hint') }}
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='flag-filled')
          q-item-section
            q-item-label {{$t(`admin.flags.ldapdebug.label`)}}
            q-item-label(caption) {{$t(`admin.flags.ldapdebug.hint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='flags.ldapdebug'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='$t(`admin.flags.ldapdebug.label`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='flag-filled')
          q-item-section
            q-item-label {{$t(`admin.flags.sqllog.label`)}}
            q-item-label(caption) {{$t(`admin.flags.sqllog.hint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='flags.sqllog'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='$t(`admin.flags.sqllog.label`)'
              )
      q-card.shadow-1.q-py-sm.q-mt-md
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='heart-outline')
          q-item-section
            q-item-label {{$t(`admin.flags.hidedonatebtn.label`)}}
            q-item-label(caption) {{$t(`admin.flags.hidedonatebtn.hint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='flags.hidedonatebtn'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='$t(`admin.flags.hidedonatebtn.label`)'
              )
</template>

<script>
import gql from 'graphql-tag'
import _transform from 'lodash/transform'
import { createMetaMixin } from 'quasar'

export default {
  mixins: [
    createMetaMixin(function () {
      return {
        title: this.$t('admin.flags.title')
      }
    })
  ],
  data () {
    return {
      loading: false,
      flags: {
        ldapdebug: false,
        sqllog: false,
        hidedonatebtn: false
      }
    }
  },
  methods: {
    async save () {
      try {
        await this.$apollo.mutate({
          mutation: gql`
            mutation updateFlags (
              $flags: [SystemFlagInput]!
            ) {
              updateSystemFlags(
                flags: $flags
              ) {
                status {
                  succeeded
                  slug
                  message
                }
              }
            }
          `,
          variables: {
            flags: _transform(this.flags, (result, value, key) => {
              result.push({ key, value })
            }, [])
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-flags-update')
          }
        })
        this.$store.commit('showNotification', {
          style: 'success',
          message: 'Flags applied successfully.',
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    }
  }
  // apollo: {
  //   flags: {
  //     query: gql``,
  //     fetchPolicy: 'network-only',
  //     update: (data) => _transform(data.system.flags, (result, row) => {
  //       _set(result, row.key, row.value)
  //     }, {}),
  //     watchLoading (isLoading) {
  //       this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-flags-refresh')
  //     }
  //   }
  // }
}
</script>

<style lang='scss'>

</style>
