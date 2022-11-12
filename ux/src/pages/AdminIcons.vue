<template lang='pug'>
q-page.admin-icons
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.admin-icons-icon.animated.fadeInLeft(src='/_assets/icons/fluent-spring.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.icons.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.icons.subtitle') }}
    .col-auto
      q-btn.acrylic-btn.q-mr-sm(
        icon='las la-question-circle'
        flat
        color='grey'
        :href='siteStore.docsBase + `/system/icons`'
        target='_blank'
        type='a'
        )
      q-btn.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        @click='load'
        )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12
      q-card.shadow-1 Beep boop

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
  title: t('admin.icons.title')
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

// MOUNTED

onMounted(() => {
  load()
})

</script>

<style lang='scss'>
.admin-icons {
  &-icon {
    animation: fadeInLeft .6s forwards, flower-rotate 30s linear infinite;
  }
}

@keyframes flower-rotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
