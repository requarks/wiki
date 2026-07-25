<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card.user-search-dialog(style='width: 600px; max-width: 90vw;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-account.svg', left, size='sm')
      span {{ props.title || t('admin.users.selectUsers') }}
    q-card-section.q-py-sm
      q-input(
        outlined
        dense
        v-model='state.search'
        :placeholder='t(`admin.users.searchUsers`)'
        :aria-label='t(`admin.users.searchUsers`)'
        clearable
        hide-bottom-space
        autofocus
        )
        template(#prepend)
          q-icon(name='las la-search')
    q-separator
    .user-search-dialog-list
      q-inner-loading(:showing='state.loading > 0')
      .flex.flex-center.full-height.q-pa-md(v-if='state.users.length < 1 && state.loading < 1')
        .text-grey {{ t('admin.users.searchNoResults') }}
      q-list(v-else, separator)
        q-item(
          v-for='usr of state.users'
          :key='usr.id'
          clickable
          v-ripple
          @click='toggle(usr)'
          )
          q-item-section(side)
            //- .stop keeps the click from also reaching the item handler, which would toggle twice
            q-checkbox(
              :model-value='isSelected(usr.id)'
              @update:model-value='toggle(usr)'
              @click.stop
              :aria-label='usr.name'
              dense
              )
          q-item-section(avatar)
            q-avatar(v-if='usr.hasAvatar', size='md')
              img(:src='`/_user/` + usr.id + `/avatar`')
            q-avatar(v-else, size='md', color='primary', text-color='white', icon='las la-user')
          q-item-section
            q-item-label {{ usr.name }}
            q-item-label(caption) {{ usr.email }}
          q-item-section(side)
            .flex.items-center
              q-icon.q-ml-sm(v-if='usr.isSystem', name='las la-lock', color='pink')
                q-tooltip {{ t('admin.users.systemUser') }}
              q-icon.q-ml-sm(v-if='!usr.isActive', name='las la-ban', color='pink')
                q-tooltip {{ t('admin.users.inactive') }}
              q-icon.q-ml-sm(v-if='!usr.isVerified', name='las la-envelope', color='orange')
                q-tooltip {{ t('admin.users.unverified') }}
    q-separator
    .flex.flex-center.q-py-sm(v-if='totalPages > 1')
      q-pagination(
        v-model='state.currentPage'
        :max='totalPages'
        :max-pages='7'
        boundary-numbers
        direction-links
      )
    q-card-actions.card-actions
      .text-caption.text-grey.q-ml-sm(v-if='state.selected.length > 0')
        | {{ t('admin.users.selectedCount', { count: state.selected.length }) }}
      q-space
      q-btn.acrylic-btn(
        flat
        :label='t(`common.actions.cancel`)'
        color='grey'
        padding='xs md'
        @click='onDialogCancel'
        )
      q-btn(
        unelevated
        :label='t(`common.actions.select`)'
        color='primary'
        padding='xs md'
        :disable='state.selected.length < 1'
        @click='confirm'
        )
</template>

<script setup>
import { debounce } from 'es-toolkit/function'
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
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

defineEmits([...useDialogPluginComponent.emits])

// QUASAR

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
const $q = useQuasar()

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
    $q.notify({
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
