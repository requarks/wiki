<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="width: 600px; max-width: 90vw">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/ultraviolet-template.svg" size="sm" class="mr-2" />
        <span>{{ t('pageTemplateDialog.title') }}</span>
      </w-card-section>
      <w-card-section class="pb-2">
        <!-- -> Enter takes the first match, so a template known by name is a few keys away -->
        <w-input
          ref="iptSearch"
          v-model="state.query"
          outlined
          dense
          clearable
          :label="t('pageTemplateDialog.search')"
          :aria-label="t('pageTemplateDialog.search')"
          @keydown.enter.prevent="pickFirst">
          <template #prepend><w-icon name="la:search" /></template>
        </w-input>
      </w-card-section>
      <div class="page-template-list relative">
        <w-inner-loading :showing="state.isLoading" />
        <div
          v-if="!state.isLoading && templates.length < 1"
          class="text-caption text-black/54 dark:text-white/60 px-4 py-6 text-center">
          {{ t('pageTemplateDialog.empty') }}
        </div>
        <div
          v-else-if="!state.isLoading && matches.length < 1"
          class="text-caption text-black/54 dark:text-white/60 px-4 py-6 text-center">
          {{ t('pageTemplateDialog.noMatch') }}
        </div>
        <w-list v-else separator>
          <w-item v-for="template of matches" :key="template.id" clickable @click="pick(template)">
            <w-item-section avatar>
              <w-icon
                :name="template.icon || DEFAULT_PAGE_ICON"
                :class="pageIconColorClass(template.iconColor)" />
            </w-item-section>
            <w-item-section>
              <w-item-label :dir="siteStore.localeDir(template.locale)">
                {{ template.title }}
              </w-item-label>
              <w-item-label v-if="template.description" caption :lines="2">
                {{ template.description }}
              </w-item-label>
              <w-item-label caption class="font-mono">/{{ template.path }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-icon
                :name="`img:/_assets/icons/ultraviolet-${EDITOR_ICONS[template.editor]}.svg`" />
            </w-item-section>
          </w-item>
        </w-list>
      </div>
      <w-card-actions class="card-actions">
        <w-space />
        <w-btn
          class="acrylic-btn"
          flat
          :label="t(`common.actions.cancel`)"
          color="cancel"
          padding="xs md"
          @click="onDialogCancel" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'
import { EDITOR_ICONS } from '@/helpers/editors'
import { pageIconColorClass } from '@/helpers/pageIconColors'
import { templateMatches } from '@/helpers/pageTemplates'

import { DEFAULT_PAGE_ICON } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

/**
 * Lists the templates a new page can be started from, and resolves with the one picked.
 *
 * Only what this reader could actually start from -- the server cuts the list to the templates whose
 * source they may open (`GET …/pages/templates`) -- and then to the editors this menu offers: the
 * site's own, narrowed by the menu's `only`, so that a blog's New Post is not offered a redirection
 * template, and a site that has switched an editor off is not offered pages in it.
 *
 * Opening the page is left to whoever opened this, which knows where the new page is to go.
 */

// PROPS

const props = defineProps({
  /** The locale the new page will be written in, whose templates are listed. */
  locale: {
    type: String,
    required: true
  },
  /** As `PageNewMenu`'s `only`: offer only templates in these editors. Empty for no restriction. */
  only: {
    type: Array,
    default: () => []
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// REFS

const iptSearch = ref(null)

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent({
  autofocus: () => iptSearch.value
})

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  query: '',
  isLoading: true,
  templates: []
})

// COMPUTED

/** The templates this menu offers: in an editor the site has on, and that the caller asked for. */
const templates = computed(() =>
  state.templates.filter(
    (template) =>
      siteStore.activeEditors.includes(template.editor) &&
      (props.only.length < 1 || props.only.includes(template.editor))
  )
)

/** The templates answering the search. */
const matches = computed(() => templates.value.filter((tpl) => templateMatches(tpl, state.query)))

// METHODS

function pick(template) {
  onDialogOK(template)
}

function pickFirst() {
  if (matches.value.length > 0) {
    pick(matches.value[0])
  }
}

async function load() {
  state.isLoading = true
  try {
    const resp = await API_CLIENT.get(`sites/${siteStore.id}/pages/templates`, {
      searchParams: { locale: props.locale }
    }).json()
    state.templates = resp.templates ?? []
  } catch (err) {
    notify({
      type: 'negative',
      message: t('pageTemplateDialog.loadFailed'),
      caption: apiErrorMessage(err)
    })
  } finally {
    state.isLoading = false
  }
}

// MOUNTED

onMounted(load)
</script>

<style lang="scss" scoped>
.page-template-list {
  min-height: 120px;
  max-height: 50vh;
  overflow-y: auto;
}
</style>
