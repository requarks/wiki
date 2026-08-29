<template>
  <w-page class="admin-mcp">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-ai.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 admin-page-title animated fadeInLeft">{{ t('admin.mcp.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.mcp.subtitle') }}
        </div>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center">
          <template v-if="state.enabled">
            <w-signal class="mr-2" color="green" size="md" />
            <div class="text-caption text-green">{{ t('admin.mcp.enabled') }}</div>
          </template>
          <template v-else>
            <w-signal class="mr-2" color="red" size="md" />
            <div class="text-caption text-red">{{ t('admin.mcp.disabled') }}</div>
          </template>
        </div>
      </div>
      <!-- -> Nothing behind these yet: there is no endpoint to toggle and no keys to create, so
           the two actions are laid out here permanently disabled and without a handler -->
      <div class="flex-none">
        <w-btn
          class="mr-2 ml-4 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/dev/mcp`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="acrylic-btn mr-2"
          icon="la:redo-alt"
          flat
          color="secondary"
          :loading="state.loading > 0"
          :aria-label="t(`common.actions.refresh`)">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="mr-2"
          unelevated
          icon="la:power-off"
          disabled
          :label="!state.enabled ? t(`admin.mcp.enableButton`) : t(`admin.mcp.disableButton`)"
          :color="!state.enabled ? `positive` : `negative`"
          :loading="state.isToggleLoading"
          :disabled="state.loading > 0" />
        <w-btn
          unelevated
          icon="la:plus"
          :label="t(`admin.mcp.newKeyButton`)"
          color="primary"
          :disabled="state.loading > 0 || true" />
      </div>
    </div>
    <w-separator inset />
    <div class="grid grid-cols-12 p-4 gap-4">
      <div class="col-span-12">
        <w-card
          class="rounded"
          flat
          :class="dark.isActive ? `bg-dark-5 text-white` : `bg-grey-3 text-dark`">
          <w-card-section class="items-center" horizontal>
            <!-- -> The warning tone swaps with the theme like the card ground it sits on does:
                 `orange` is 1.9:1 on the light card and unreadable, `deep-orange-10` 3.4:1 on the
                 dark one. Each is above 4.5:1 on the ground it is paired with -->
            <w-card-section class="flex-none pr-0">
              <w-icon
                name="la:exclamation-triangle"
                size="sm"
                :color="dark.isActive ? `orange` : `deep-orange-10`" />
            </w-card-section>
            <w-card-section
              class="text-caption"
              :class="dark.isActive ? `text-orange` : `text-deep-orange-10`"
              >{{ t('admin.mcp.notImplemented') }}</w-card-section
            >
          </w-card-section>
        </w-card>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { reactive } from 'vue'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'

import { useSiteStore } from '@/stores/site'

// COMPOSABLES

const dark = useDark()

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.mcp.title')
})

// DATA

const state = reactive({
  enabled: false,
  loading: 0,
  isToggleLoading: false
})
</script>

<style lang="scss"></style>
