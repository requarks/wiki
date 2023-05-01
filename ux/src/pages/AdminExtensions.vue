<template lang='pug'>
q-page.admin-extensions
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-module.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.extensions.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.extensions.subtitle') }}
    .col-auto
      q-btn.acrylic-btn.q-mr-sm(
        icon='las la-question-circle'
        flat
        color='grey'
        :aria-label='t(`common.actions.viewDocs`)'
        :href='siteStore.docsBase + `/system/extensions`'
        target='_blank'
        type='a'
        )
        q-tooltip {{ t(`common.actions.viewDocs`) }}
      q-btn.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        :aria-label='t(`common.actions.refresh`)'
        @click='load'
        )
        q-tooltip {{ t(`common.actions.refresh`) }}
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12
      q-card
        q-list(separator)
          q-item(
            v-for='(ext, idx) of state.extensions'
            :key='`ext-` + ext.key'
            )
            blueprint-icon(icon='module')
            q-item-section
              q-item-label {{ext.title}}
              q-item-label(caption) {{ext.description}}
            q-item-section(side)
              .row
                q-btn-group(unelevated)
                  q-btn(
                    icon='las la-check'
                    size='sm'
                    color='positive'
                    padding='xs sm'
                    v-if='ext.isInstalled'
                    :ripple='false'
                    )
                    q-tooltip(
                      anchor='center left'
                      self='center right'
                      ) {{t('admin.extensions.installed')}}
                  q-btn(
                    :label='t(`admin.extensions.install`)'
                    color='blue-7'
                    v-if='ext.isCompatible && !ext.isInstalled && ext.isInstallable'
                    @click='install(ext)'
                    no-caps
                  )
                  q-btn(
                    v-else-if='ext.isCompatible && ext.isInstalled && ext.isInstallable'
                    :label='t(`admin.extensions.reinstall`)'
                    color='blue-7'
                    @click='install(ext)'
                    no-caps
                  )
                  q-btn(
                    v-else-if='ext.isCompatible && ext.isInstalled && !ext.isInstallable'
                    :label='t(`admin.extensions.installed`)'
                    color='positive'
                    no-caps
                    :ripple='false'
                  )
                  q-btn(
                    v-else-if='ext.isCompatible'
                    :label='t(`admin.extensions.instructions`)'
                    icon='las la-info-circle'
                    color='indigo'
                    outline
                    type='a'
                    :href='`https://docs.js.wiki/admin/extensions/` + ext.key'
                    target='_blank'
                    no-caps
                    )
                    q-tooltip(
                      anchor='center left'
                      self='center right'
                      ) {{t('admin.extensions.instructionsHint')}}
                  q-btn(
                    v-else
                    color='negative'
                    outline
                    :label='t(`admin.extensions.incompatible`)'
                    no-caps
                    :ripple='false'
                  )

</template>

<script setup>
import gql from 'graphql-tag'
import { cloneDeep } from 'lodash-es'
import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { computed, onMounted, reactive, watch } from 'vue'

import { useAdminStore } from 'src/stores/admin'
import { useSiteStore } from 'src/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.extensions.title')
})

// DATA

const state = reactive({
  loading: false,
  extensions: []
})

// METHODS

async function load () {
  state.loading++
  $q.loading.show()
  const resp = await APOLLO_CLIENT.query({
    query: gql`
      query fetchExtensions {
        systemExtensions {
          key
          title
          description
          isInstalled
          isInstallable
          isCompatible
        }
      }
    `,
    fetchPolicy: 'network-only'
  })
  state.extensions = cloneDeep(resp?.data?.systemExtensions)
  $q.loading.hide()
  state.loading--
}

async function install (ext) {
  $q.loading.show({
    message: t('admin.extensions.installing') + '<br>' + t('admin.extensions.installingHint'),
    html: true
  })
  try {
    const respRaw = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation installExtension (
          $key: String!
        ) {
          installExtension (
            key: $key
          ) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        key: ext.key
      }
    })
    if (respRaw.data?.installExtension?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('admin.extensions.installSuccess')
      })
      ext.isInstalled = true
      // this.$forceUpdate()
    } else {
      throw new Error(respRaw.data?.installExtension?.operation?.message || 'An unexpected error occured')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: t('admin.extensions.installFailed'),
      caption: err.message
    })
  }
  $q.loading.hide()
}

// MOUNTED

onMounted(() => {
  load()
})

</script>

<style lang='scss'>
.admin-extensions {
  .q-expansion-item__content .q-card {
    @at-root .body--light & {
      background-color: $grey-1;
    }
    @at-root .body--dark & {
      background-color: $dark-3;
    }
  }
}
</style>
