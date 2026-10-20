<template>
  <w-page class="py-4">
    <div class="w-section-header flex items-center">
      <span>{{ t('profile.liveNotes') }}</span>
      <w-space />
      <!--
        Dense, and pulled into the heading's own line height, so it does not make it taller. Its size,
        weight and colour are set back, since a field inherits them and the heading's are its own.
      -->
      <w-input
        v-if="notesEnabled"
        v-model="state.search"
        class="-my-1 text-sm font-normal"
        style="width: 240px; max-width: 50vw"
        outlined
        dense
        clearable
        :placeholder="t(`profile.liveNotesSearch`)"
        :aria-label="t(`profile.liveNotesSearch`)"
        :class="dark.isActive ? `bg-dark text-white` : `bg-white text-black`">
        <template #prepend><w-icon class="opacity-50" name="la:search" size="20px" /></template>
      </w-input>
    </div>
    <div class="p-4">
      <div class="text-body2">{{ t('profile.liveNotesInfo') }}</div>
      <w-banner
        v-if="!notesEnabled"
        class="mt-4"
        rounded
        :class="dark.isActive ? `bg-dark-4 text-grey-4` : `bg-grey-2 text-grey-8`">
        <template #avatar>
          <w-icon name="la:info-circle" />
        </template>
        {{ t('liveNote.disabledHint') }}
      </w-banner>
      <template v-else>
        <!-- -> Two empty states: none at all says what a note is for, none matching says only that -->
        <div
          v-if="state.notes.length < 1 && state.loading < 1"
          class="mt-6 flex flex-col items-center rounded border border-dashed border-black/12 px-6 py-12 text-center dark:border-white/15">
          <img src="/_assets/icons/ultraviolet-note.svg" alt="" width="80" height="80" />
          <template v-if="state.appliedSearch">
            <div class="text-h6 mt-4">{{ t('profile.liveNotesNoMatch') }}</div>
          </template>
          <template v-else>
            <div class="text-h6 mt-4">{{ t('profile.liveNotesNone') }}</div>
            <div class="text-body2 mt-1 max-w-lg opacity-60">
              {{ t('profile.liveNotesNoneHint') }}
            </div>
            <!-- -> Only for somebody who may still create one: the list is open to readers too -->
            <w-btn
              v-if="liveNoteStore.canCreate"
              class="acrylic-btn mt-6"
              flat
              icon="la:plus"
              color="primary"
              padding="xs md"
              :label="t(`common.createPage.liveNote`)"
              to="/n" />
          </template>
        </div>
        <w-list v-else class="mt-4" bordered separator>
          <w-item v-for="note of state.notes" :key="note.id" clickable :to="`/n/${note.key}`">
            <w-item-section avatar>
              <w-avatar color="secondary" text-color="white" icon="la:sticky-note" rounded />
            </w-item-section>
            <w-item-section>
              <w-item-label>
                <strong v-if="note.title">{{ note.title }}</strong>
                <em v-else class="opacity-60">{{ t('liveNote.untitled') }}</em>
              </w-item-label>
              <w-item-label caption>
                {{ t('profile.liveNotesCreated', { date: formattedDate(note.createdAt) }) }}
                ·
                {{
                  isEdited(note)
                    ? t('profile.liveNotesLastEdited', { date: formattedDate(note.updatedAt) })
                    : t('profile.liveNotesNeverEdited')
                }}
              </w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-chip square dense size="sm" class="text-black/70 dark:text-white/70">
                <w-icon class="me-1" :name="ACCESS_ICONS[note.access]" size="14px" />
                {{ t(`liveNote.access.${note.access}`) }}
              </w-chip>
            </w-item-section>
          </w-item>
        </w-list>
        <div class="flex items-center justify-center mt-6" v-if="state.totalPages > 1">
          <w-pagination
            v-model="state.currentPage"
            :max="state.totalPages"
            :max-pages="9"
            boundary-numbers
            direction-links />
        </div>
      </template>
    </div>

    <w-inner-loading :showing="state.loading > 0" />
  </w-page>
</template>

<script setup>
import { computed, onMounted, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { debounce } from 'es-toolkit/function'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'

import { useLiveNoteStore } from '@/stores/liveNote'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

/**
 * The live notes this account created on this site, newest first -- `GET /sites/:siteId/notes`,
 * which lists nobody else's. A row opens the note.
 *
 * Open to `read:notes` as well as `write:notes`, so that somebody who has lost the second can still
 * get back to what they wrote; they read it from there, as its creator, private or not.
 */

const PAGE_SIZE = 20

/** What each access reads as at a glance, beside its name. */
const ACCESS_ICONS = {
  editable: 'la:pen',
  locked: 'la:lock',
  private: 'la:user-lock'
}

const dark = useDark()

const liveNoteStore = useLiveNoteStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

const { t } = useI18n()

useMeta(() => ({
  title: t('profile.liveNotes')
}))

const state = reactive({
  notes: [],
  loading: 0,
  search: '',
  /** What the list on screen was filtered by, which is what decides which empty state it shows. */
  appliedSearch: '',
  currentPage: 1,
  totalPages: 1
})

/** Asked here as `LiveNote.vue` asks it, so that a site without notes is not a red toast. */
const notesEnabled = computed(
  () => siteStore.features.liveNotes && siteStore.features.collaborativeEditing
)

// -> A new search starts from the first page, which is itself a reload when it was not on it already
watch(
  () => state.search,
  debounce(() => {
    if (state.currentPage === 1) {
      load()
    } else {
      state.currentPage = 1
    }
  }, 400)
)

watch(() => state.currentPage, load)

async function load() {
  if (!notesEnabled.value) {
    return
  }
  const search = state.search?.trim() ?? ''
  state.loading++
  try {
    const resp = await API_CLIENT.get(`sites/${siteStore.id}/notes`, {
      searchParams: {
        ...(search ? { filter: search } : {}),
        page: state.currentPage,
        limit: PAGE_SIZE
      }
    }).json()
    state.notes = resp?.notes ?? []
    state.totalPages = Math.max(1, Math.ceil((resp?.total ?? 0) / PAGE_SIZE))
    state.appliedSearch = search
  } catch (err) {
    notify({
      type: 'negative',
      message: t('profile.liveNotesLoadFailed'),
      caption: apiErrorMessage(err)
    })
  } finally {
    state.loading--
  }
}

function formattedDate(val) {
  return userStore.formatDateTime(t, val)
}

/** A note nobody has typed into still carries its creation time as `updatedAt`. */
function isEdited(note) {
  return (
    Temporal.Instant.compare(
      Temporal.Instant.from(note.updatedAt),
      Temporal.Instant.from(note.createdAt)
    ) > 0
  )
}

onMounted(load)
</script>
