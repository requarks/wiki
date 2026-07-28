<template>
  <w-page class="admin-webhooks">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img
          class="admin-icon animated fadeInLeft"
          src="/_assets/icons/fluent-lightning-bolt.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.webhooks.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.webhooks.subtitle') }}
        </div>
      </div>
      <div class="flex-none">
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/system/webhooks`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="acrylic-btn mr-2"
          icon="la:redo-alt"
          flat
          color="secondary"
          :loading="state.loading > 0"
          :aria-label="t(`common.actions.refresh`)"
          @click="load">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
        <w-btn
          unelevated
          icon="la:plus"
          :label="t(`admin.webhooks.new`)"
          color="primary"
          @click="createHook" />
      </div>
    </div>
    <w-separator inset />
    <div class="grid grid-cols-12 p-4 gap-4">
      <div class="col-span-12" v-if="state.hooks.length < 1">
        <w-card
          class="rounded"
          flat
          :class="dark.isActive ? `bg-dark-5 text-white` : `bg-grey-3 text-dark`">
          <w-card-section class="items-center" horizontal>
            <w-card-section class="flex-none pr-0">
              <w-icon name="la:info-circle" size="sm" />
            </w-card-section>
            <w-card-section class="text-caption">{{ t('admin.webhooks.none') }}</w-card-section>
          </w-card-section>
        </w-card>
      </div>
      <div class="col-span-12" v-else>
        <w-card>
          <w-list separator>
            <w-item v-for="hook of state.hooks" :key="hook.id">
              <w-item-section side><w-icon name="la:bolt" color="primary" /></w-item-section>
              <w-item-section>
                <w-item-label>{{ hook.name }}</w-item-label>
                <w-item-label caption>{{ hook.url }}</w-item-label>
              </w-item-section>
              <w-item-section side style="flex-direction: row; align-items: center">
                <template v-if="hook.state === `pending`">
                  <w-spinner class="mr-2" color="indigo" size="xs" />
                  <div class="text-caption text-indigo">{{ t('admin.webhooks.statePending') }}</div>
                  <w-tooltip anchor="center left" self="center right">{{
                    t('admin.webhooks.statePendingHint')
                  }}</w-tooltip>
                </template>
                <template v-else-if="hook.state === `success`">
                  <w-spinner class="mr-2" color="positive" size="xs" />
                  <div class="text-caption text-positive">
                    {{ t('admin.webhooks.stateSuccess') }}
                  </div>
                  <w-tooltip anchor="center left" self="center right">{{
                    t('admin.webhooks.stateSuccessHint')
                  }}</w-tooltip>
                </template>
                <template v-else-if="hook.state === `error`">
                  <w-icon
                    class="mr-2"
                    color="negative"
                    size="xs"
                    name="la:exclamation-triangle" />
                  <div class="text-caption text-negative">{{ t('admin.webhooks.stateError') }}</div>
                  <w-tooltip anchor="center left" self="center right">{{
                    t('admin.webhooks.stateErrorHint')
                  }}</w-tooltip>
                </template>
              </w-item-section>
              <w-separator class="ml-4" vertical />
              <w-item-section side style="flex-direction: row; align-items: center">
                <w-btn
                  class="acrylic-btn mr-2"
                  color="indigo"
                  icon="la:pen"
                  label="Edit"
                  flat
                  no-caps
                  @click="editHook(hook.id)" />
                <w-btn
                  class="acrylic-btn"
                  color="red"
                  icon="la:trash"
                  flat
                  @click="deleteHook(hook)" />
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
import { onMounted, reactive } from 'vue'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'
import { dialog } from '@/composables/dialog'

import { useSiteStore } from '@/stores/site'

import WebhookEditDialog from '@/components/WebhookEditDialog.vue'
import WebhookDeleteDialog from '@/components/WebhookDeleteDialog.vue'

// COMPOSABLES

const dark = useDark()

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.webhooks.title')
})

// DATA

const state = reactive({
  hooks: [],
  loading: 0
})

// METHODS

async function load() {
  state.loading++
  loading.show()
  try {
    state.hooks = (await API_CLIENT.get('hooks').json()) ?? []
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.webhooks.loadFailed'),
      caption: err.message
    })
  }
  loading.hide()
  state.loading--
}

function createHook() {
  dialog({
    component: WebhookEditDialog,
    componentProps: {
      hookId: null
    }
  }).onOk(() => {
    load()
  })
}

function editHook(id) {
  dialog({
    component: WebhookEditDialog,
    componentProps: {
      hookId: id
    }
  }).onOk(() => {
    load()
  })
}

function deleteHook(hook) {
  dialog({
    component: WebhookDeleteDialog,
    componentProps: {
      hook
    }
  }).onOk(() => {
    load()
  })
}

// MOUNTED

onMounted(() => {
  load()
})
</script>

<style lang="scss"></style>
