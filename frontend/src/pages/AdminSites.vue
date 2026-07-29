<template>
  <w-page class="admin-locale">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-change-theme.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.sites.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.sites.subtitle') }}
        </div>
      </div>
      <div class="flex-none">
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/sites`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:redo-alt"
          flat
          color="secondary"
          :aria-label="t(`common.actions.refresh`)"
          @click="refresh">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
        <w-btn
          unelevated
          icon="la:plus"
          :label="t(`admin.sites.new`)"
          color="primary"
          @click="createSite" />
      </div>
    </div>
    <w-separator inset />
    <div class="grid grid-cols-12 p-4 gap-4">
      <div class="col-span-12">
        <w-card>
          <w-list separator>
            <w-item v-for="site of adminStore.sites" :key="site.id">
              <w-item-section side>
                <w-icon name="la:chalkboard" color="primary" />
              </w-item-section>
              <w-item-section
                ><strong>{{ site.title }}</strong></w-item-section
              >
              <w-item-section>
                <div>
                  <w-chip
                    class="mx-0"
                    v-if="site.hostname !== `*`"
                    square
                    color="blue-7"
                    text-color="white"
                    size="sm">
                    <w-avatar icon="la:angle-right" color="blue-5" text-color="white" />
                    <span>{{ site.hostname }}</span>
                  </w-chip>
                  <w-chip class="mx-0" v-else square color="indigo-7" text-color="white" size="sm">
                    <w-avatar icon="la:asterisk" color="indigo-5" text-color="white" />
                    <span>catch-all</span>
                  </w-chip>
                </div>
              </w-item-section>
              <w-item-section side>
                <w-toggle
                  :model-value="site.isEnabled"
                  :label="t(`admin.sites.isActive`)"
                  :aria-label="t(`admin.sites.isActive`)"
                  @update:model-value="
                    (val) => {
                      toggleSiteState(site, val)
                    }
                  " />
              </w-item-section>
              <w-separator class="ml-4" vertical />
              <w-item-section side style="flex-direction: row; align-items: center">
                <w-btn
                  class="acrylic-btn mr-2"
                  flat
                  @click="editSite(site)"
                  icon="la:pen"
                  :color="dark.isActive ? `indigo-4` : `indigo`"
                  :label="t(`common.actions.edit`)"
                  no-caps />
                <w-btn
                  class="acrylic-btn"
                  flat
                  icon="la:trash"
                  color="negative"
                  @click="deleteSite(site)"
                  :aria-label="t(`common.actions.delete`)" />
              </w-item-section>
            </w-item>
          </w-list>
        </w-card>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { dialog } from '@/composables/dialog'

import { useSiteStore } from '@/stores/site'

import { useAdminStore } from '../stores/admin'
import SiteActivateDialog from '../components/SiteActivateDialog.vue'
import SiteCreateDialog from '../components/SiteCreateDialog.vue'
import SiteDeleteDialog from '../components/SiteDeleteDialog.vue'

// COMPOSABLES

const dark = useDark()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// ROUTER

const router = useRouter()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.sites.title')
})

// METHODS

async function refresh() {
  await adminStore.fetchSites()
  notify({
    type: 'positive',
    message: t('admin.sites.refreshSuccess')
  })
}
function createSite() {
  dialog({
    component: SiteCreateDialog
  })
}
function editSite(st) {
  adminStore.$patch({
    currentSiteId: st.id
  })
  nextTick(() => {
    router.push(`/_admin/${st.id}/general`)
  })
}
function toggleSiteState(st, newState) {
  dialog({
    component: SiteActivateDialog,
    componentProps: {
      site: st,
      targetState: newState
    }
  })
}
function deleteSite(st) {
  dialog({
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
