<template lang='pug'>
q-page.admin-locale
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-change-theme.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.sites.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.sites.subtitle') }}
    .col-auto
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        type='a'
        href='https://docs.js.wiki/admin/sites'
        target='_blank'
        )
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        @click='refresh'
        )
      q-btn(
        unelevated
        icon='las la-plus'
        :label='t(`admin.sites.new`)'
        color='primary'
        @click='createSite'
        )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12
      q-card.shadow-1
        q-list(separator)
          q-item(
            v-for='site of adminStore.sites'
            :key='site.id'
            )
            q-item-section(side)
              q-icon(name='las la-chalkboard', color='primary')
            q-item-section
              strong {{site.title}}
            q-item-section
              div
                q-chip.q-mx-none(
                  v-if='site.hostname !== `*`'
                  square
                  color='blue-7'
                  text-color='white'
                  size='sm'
                  )
                  q-avatar(
                    icon='las la-angle-right'
                    color='blue-5'
                    text-color='white'
                  )
                  span {{site.hostname}}
                q-chip.q-mx-none(
                  v-else
                  square
                  color='indigo-7'
                  text-color='white'
                  size='sm'
                  )
                  q-avatar(
                    icon='las la-asterisk'
                    color='indigo-5'
                    text-color='white'
                  )
                  span catch-all
            q-item-section(side)
              q-toggle(
                :model-value='site.isEnabled'
                color='primary'
                checked-icon='las la-check'
                unchecked-icon='las la-times'
                :label='t(`admin.sites.isActive`)'
                :aria-label='t(`admin.sites.isActive`)'
                @update:model-value ='(val) => { toggleSiteState(site, val) }'
                )
            q-separator.q-ml-md(vertical)
            q-item-section(side, style='flex-direction: row; align-items: center;')
              q-btn.acrylic-btn.q-mr-sm(
                flat
                @click='editSite(site)'
                icon='las la-pen'
                color='indigo'
                :label='t(`common.actions.edit`)'
                no-caps
                )
              q-btn.acrylic-btn(
                flat
                icon='las la-trash'
                color='negative'
                @click='deleteSite(site)'
                )
</template>

<script setup>
import { useMeta, useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { useAdminStore } from '../stores/admin'

// COMPONENTS

import SiteActivateDialog from '../components/SiteActivateDialog.vue'
import SiteCreateDialog from '../components/SiteCreateDialog.vue'
import SiteDeleteDialog from '../components/SiteDeleteDialog.vue'

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()

// ROUTER

const router = useRouter()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.sites.title')
})

// METHODS

async function refresh () {
  await adminStore.fetchSites()
  $q.notify({
    type: 'positive',
    message: t('admin.sites.refreshSuccess')
  })
}
function createSite () {
  $q.dialog({
    component: SiteCreateDialog
  })
}
function editSite (st) {
  adminStore.$patch({
    currentSiteId: st.id
  })
  nextTick(() => {
    router.push(`/_admin/${st.id}/general`)
  })
}
function toggleSiteState (st, newState) {
  console.info(newState)
  $q.dialog({
    component: SiteActivateDialog,
    componentProps: {
      site: st,
      targetState: newState
    }
  })
}
function deleteSite (st) {
  $q.dialog({
    component: SiteDeleteDialog,
    componentProps: {
      site: st
    }
  })
}

// MOUNTED

onMounted(async () => {
  await adminStore.fetchSites()
})
</script>
