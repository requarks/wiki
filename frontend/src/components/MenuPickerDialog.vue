<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card class="menu-picker-dialog" style="width: 600px; max-width: 90vw">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-sidebar-menu.svg" size="sm" class="mr-2" />
        <span>{{ t('navEdit.menuTargetSelect') }}</span>
      </w-card-section>
      <w-card-section class="py-2">
        <w-input
          v-model="state.search"
          outlined
          dense
          :placeholder="t(`navEdit.menuTargetSearch`)"
          :aria-label="t(`navEdit.menuTargetSearch`)"
          clearable
          hide-bottom-space
          autofocus>
          <template #prepend>
            <w-icon name="la:search" />
          </template>
        </w-input>
      </w-card-section>
      <w-separator />
      <div class="menu-picker-dialog-list">
        <w-inner-loading :showing="state.loading > 0" />
        <div
          v-if="filtered.length < 1 && state.loading < 1"
          class="flex h-full flex-wrap items-center justify-center p-4">
          <div class="text-grey">{{ t('navEdit.menuTargetNoResults') }}</div>
        </div>
        <w-list v-else separator>
          <w-item
            v-for="menu of filtered"
            :key="menu.id"
            clickable
            :active="state.selectedId === menu.id"
            active-class="bg-primary text-white"
            @click="state.selectedId = menu.id"
            @dblclick="choose(menu)">
            <w-item-section side>
              <w-icon :name="menu.isRoot ? `la:home` : `mdi:folder-outline`" />
            </w-item-section>
            <w-item-section class="text-wordbreak-all">/{{ menu.path }}</w-item-section>
          </w-item>
        </w-list>
      </div>
      <w-separator />
      <w-card-actions class="card-actions">
        <w-space />
        <w-btn
          class="acrylic-btn"
          flat
          :label="t(`common.actions.cancel`)"
          color="cancel"
          padding="xs md"
          @click="onDialogCancel" />
        <w-btn
          unelevated
          :label="t(`common.actions.select`)"
          color="primary"
          padding="xs md"
          :disable="!selected"
          @click="choose(selected)" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { computed, onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'

/**
 * Picks the menu a navigation `menu` item opens.
 *
 * Lists what `navigation/targets` answers for the locale: the menus this editor may point an item at,
 * which is a page rule on the page owning each one, so the server draws the list up. A site holds one
 * menu per locale plus one per page that overrides its sidebar -- few enough to fetch whole and filter
 * here as the search is typed.
 *
 * `onOk` receives `{ id, path, hasPage }` — the last being whether there is a page at the menu's
 * location for a `showLink` item to link to.
 */
const props = defineProps({
  /** The site the menus belong to: the admin area's selected one, which need not be the one served. */
  siteId: {
    type: String,
    required: true
  },
  /** The locale of the menu being edited, which a target has to share. */
  locale: {
    type: String,
    required: true
  },
  /** The menu being edited, which an item cannot open from inside itself. */
  excludeId: {
    type: String,
    default: null
  },
  /** The target already picked, to open on. */
  selectedId: {
    type: String,
    default: null
  }
})

defineEmits([...dialogComponentEmits])

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

const { t } = useI18n()

const state = reactive({
  menus: [],
  search: '',
  selectedId: props.selectedId,
  loading: 0
})

const filtered = computed(() => {
  const needle = (state.search ?? '').trim().toLowerCase()
  return state.menus.filter(
    (menu) => menu.id !== props.excludeId && (!needle || `/${menu.path}`.includes(needle))
  )
})

const selected = computed(() => filtered.value.find((menu) => menu.id === state.selectedId))

async function load() {
  state.loading++
  try {
    const resp = await API_CLIENT.get(`sites/${props.siteId}/navigation/targets`, {
      searchParams: { locale: props.locale }
    }).json()
    state.menus = resp?.menus ?? []
  } catch (err) {
    notify({
      type: 'negative',
      message: apiErrorMessage(err, 'An unexpected error occured.')
    })
  }
  state.loading--
}

function choose(menu) {
  if (menu) {
    onDialogOK({ id: menu.id, path: menu.path, hasPage: menu.hasPage })
  }
}

onMounted(load)
</script>

<style lang="scss">
.menu-picker-dialog {
  &-list {
    position: relative;
    height: 360px;
    max-height: 50vh;
    overflow-y: auto;
  }
}
</style>
