<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card class="user-search-dialog" style="width: 600px; max-width: 90vw">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-account.svg" size="sm" class="mr-2" />
        <span>{{ props.title || t('admin.users.selectUsers') }}</span>
      </w-card-section>
      <w-card-section class="py-2">
        <w-input
          v-model="state.search"
          outlined
          dense
          :placeholder="t(`admin.users.searchUsers`)"
          :aria-label="t(`admin.users.searchUsers`)"
          clearable
          hide-bottom-space
          autofocus>
          <template #prepend>
            <w-icon name="la:search" />
          </template>
        </w-input>
      </w-card-section>
      <w-separator />
      <div class="user-search-dialog-list relative">
        <w-inner-loading :showing="state.loading > 0" />
        <div
          v-if="state.users.length < 1 && state.loading < 1"
          class="flex h-full flex-wrap items-center justify-center p-4">
          <div class="text-grey">{{ t('admin.users.searchNoResults') }}</div>
        </div>
        <w-list v-else separator>
          <w-item v-for="usr of state.users" :key="usr.id" clickable @click="toggle(usr)">
            <w-item-section side>
              <!-- .stop keeps the click from also reaching the item handler, which would toggle twice -->
              <w-checkbox
                :model-value="isSelected(usr.id)"
                :aria-label="usr.name"
                dense
                @update:model-value="toggle(usr)"
                @click.stop />
            </w-item-section>
            <w-item-section avatar>
              <w-avatar v-if="usr.hasAvatar" size="md">
                <img :src="`/_user/` + usr.id + `/avatar`" />
              </w-avatar>
              <w-avatar v-else size="md" color="primary" text-color="white" icon="la:user" />
            </w-item-section>
            <w-item-section>
              <w-item-label>{{ usr.name }}</w-item-label>
              <w-item-label caption>{{ usr.email }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <div class="flex flex-nowrap items-center">
                <span v-if="usr.isSystem" class="ml-2 inline-flex">
                  <w-icon name="la:lock" color="pink" />
                  <w-tooltip>{{ t('admin.users.systemUser') }}</w-tooltip>
                </span>
                <span v-if="!usr.isActive" class="ml-2 inline-flex">
                  <w-icon name="la:ban" color="pink" />
                  <w-tooltip>{{ t('admin.users.inactive') }}</w-tooltip>
                </span>
                <span v-if="!usr.isVerified" class="ml-2 inline-flex">
                  <w-icon name="la:envelope" color="orange" />
                  <w-tooltip>{{ t('admin.users.unverified') }}</w-tooltip>
                </span>
              </div>
            </w-item-section>
          </w-item>
        </w-list>
      </div>
      <w-separator />
      <div v-if="totalPages > 1" class="flex flex-wrap items-center justify-center py-2">
        <w-pagination
          v-model="state.currentPage"
          :max="totalPages"
          :max-pages="7"
          boundary-numbers
          direction-links />
      </div>
      <w-card-actions class="card-actions">
        <div v-if="state.selected.length > 0" class="text-caption text-grey ml-2">
          {{ t('admin.users.selectedCount', { count: state.selected.length }) }}
        </div>
        <w-space />
        <w-btn
          class="acrylic-btn"
          flat
          :label="t(`common.actions.cancel`)"
          color="grey"
          padding="xs md"
          @click="onDialogCancel" />
        <w-btn
          unelevated
          :label="t(`common.actions.select`)"
          color="primary"
          padding="xs md"
          :disable="state.selected.length < 1"
          @click="confirm" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { debounce } from 'es-toolkit/function'
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { computed, onMounted, reactive, watch } from 'vue'

// PROPS

const props = defineProps({
  /** Dialog title. Defaults to a generic "Select Users". */
  title: {
    type: String,
    required: false,
    default: ''
  },
  /**
   * Offer only the users that may be assigned to this group. Filtering happens server-side, as
   * group membership can span more pages than are displayed.
   */
  assignableToGroupId: {
    type: String,
    required: false,
    default: ''
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  users: [],
  selected: [],
  search: '',
  loading: 0,
  total: 0,
  currentPage: 1,
  pageSize: 10
})

// COMPUTED

const totalPages = computed(() => Math.ceil(state.total / state.pageSize))

// WATCHERS

watch(
  () => state.search,
  debounce(() => {
    state.currentPage = 1
    load()
  }, 400)
)

watch(() => state.currentPage, load)

// METHODS

async function load() {
  state.loading++
  try {
    const resp = await API_CLIENT.get('users', {
      searchParams: {
        ...(state.search ? { filter: state.search } : {}),
        ...(props.assignableToGroupId ? { assignableToGroupId: props.assignableToGroupId } : {}),
        page: state.currentPage,
        limit: state.pageSize
      }
    }).json()
    state.total = resp?.total ?? 0
    state.users = resp?.users ?? []
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.users.loadFailed'),
      caption: err.message
    })
  }
  state.loading--
}

function isSelected(id) {
  return state.selected.some((usr) => usr.id === id)
}

/** Selection survives filtering and paging, so users from several pages can be picked at once. */
function toggle(usr) {
  state.selected = isSelected(usr.id)
    ? state.selected.filter((sel) => sel.id !== usr.id)
    : [...state.selected, usr]
}

function confirm() {
  onDialogOK(state.selected)
}

// MOUNTED

onMounted(load)
</script>

<style lang="scss">
.user-search-dialog {
  &-list {
    position: relative;
    height: 360px;
    max-height: 50vh;
    overflow-y: auto;
  }
}
</style>
