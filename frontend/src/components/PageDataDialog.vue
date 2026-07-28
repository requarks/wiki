<template>
  <w-card class="page-data-dialog" style="width: 750px;">
    <w-toolbar class="bg-primary text-white flex">
      <div class="text-subtitle2">{{t('editor.pageData.title')}}</div>
      <w-space />
      <w-btn icon="la:times" dense flat @click="siteStore.sideDialogShown = false" />
    </w-toolbar>
    <w-card-section class="page-data-dialog-selector">
      <!-- .text-overline.text-white {{t('editor.pageData.template')}} -->
      <div class="flex gap-2">
        <w-select
          dark
          v-model="state.templateId"
          :label="t(`editor.pageData.template`)"
          :aria-label="t(`editor.pageData.template`)"
          :options="templates"
          option-value="id"
          map-options
          emit-value
          standout
          dense
          style="flex: 1 0 auto;" />
        <w-btn
          class="acrylic-btn"
          dark
          icon="la:pen"
          :label="t(`common.actions.manage`)"
          unelevated
          no-caps
          color="deep-orange-9"
          @click="editTemplates" />
      </div>
    </w-card-section>
    <w-tabs class="alt-card" v-model="state.mode" inline-label no-caps>
      <w-tab name="visual" label="Visual" />
      <w-tab name="code" label="YAML" />
    </w-tabs>
    <w-scroll-area
      :thumb-style="siteStore.thumbStyle"
      :bar-style="siteStore.barStyle"
      style="height: calc(100% - 50px - 75px - 48px);">
      <w-card-section v-if="state.mode === `visual`">
        <div class="gap-2">
          <w-input label="Attribute Text" dense outlined>
            <template v-slot:before><w-icon name="la:font" color="primary" /></template>
          </w-input>
          <w-input label="Attribute Number" dense outlined type="number">
            <template v-slot:before><w-icon name="la:infinity" color="primary" /></template>
          </w-input>
          <div class="py-1">
            <w-checkbox label="Attribute Boolean" color="primary" dense size="lg" />
          </div>
        </div>
      </w-card-section>
      <!--
        The `v-else` moves onto the editor itself: the wrapper it sat on only deferred rendering
        until hydration, which this app has no server renderer to need, so unwrapping it would
        otherwise have taken the branch with it and orphaned the `v-if` above.
      -->
      <codemirror
        v-else
        class="admin-theme-cm"
        ref="cmData"
        v-model="state.content"
        :options="{ mode: `text/yaml` }" />
    </w-scroll-area>
    <w-dialog v-model="state.showDataTemplateDialog">
      <page-data-template-dialog @close="state.showDataTemplateDialog = false" />
    </w-dialog>
  </w-card>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { nextTick, onMounted, reactive, ref, watch } from 'vue'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

import PageDataTemplateDialog from './PageDataTemplateDialog.vue'


// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  showDataTemplateDialog: false,
  templateId: '',
  content: '',
  mode: 'visual'
})

const templates = [
  {
    id: '',
    label: 'None',
    data: []
  },
  ...siteStore.pageDataTemplates,
  {
    id: 'basic',
    label: 'Basic',
    data: []
  }
]

// METHODS

function editTemplates() {
  state.showDataTemplateDialog = !state.showDataTemplateDialog
}
</script>

<style lang="scss">
@use 'sass:color';

.page-data-dialog {
  &-selector {
    @at-root .body--light & {
      background-color: $dark-3;
      box-shadow:
        inset 0px 1px 0 0 rgba(0, 0, 0, 0.75),
        inset 0px -1px 0 0 rgba(0, 0, 0, 0.75),
        0 -1px 0 0 rgba(255, 255, 255, 0.1);
      border-bottom: 1px solid #fff;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      box-shadow:
        inset 0px 1px 0 0 rgba(0, 0, 0, 0.75),
        inset 0px -1px 0 0 rgba(0, 0, 0, 0.75),
        0 -1px 0 0 rgba(255, 255, 255, 0.1);
      border-bottom: 1px solid color.adjust($dark-3, $lightness: 10%);
    }
  }
}
</style>
