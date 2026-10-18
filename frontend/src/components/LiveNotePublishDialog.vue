<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="width: 500px; max-width: calc(100vw - 32px)">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-export.svg" size="sm" class="mr-2" />
        <span>{{ t('liveNote.publish.title') }}</span>
      </w-card-section>
      <w-card-section>
        <w-form class="gap-2">
          <w-input
            v-model="state.title"
            :label="t(`editor.props.title`)"
            outlined
            dense
            autofocus />
          <w-input
            v-model="state.description"
            :label="t(`editor.props.shortDescription`)"
            outlined
            dense />
          <!-- -> The properties panel's icon field, picker and all -->
          <w-input v-model="state.icon" :label="t(`editor.props.icon`)" outlined dense>
            <template #prepend>
              <w-icon :name="state.icon" size="20px" />
            </template>
            <template #append>
              <w-btn
                flat
                dense
                round
                icon="la:icons"
                color="primary"
                :aria-label="t(`iconPicker.open`)">
                <w-tooltip>{{ t('iconPicker.open') }}</w-tooltip>
                <w-menu content-class="shadow-7" anchor="bottom right" self="top right">
                  <icon-picker-dialog v-model="state.icon" />
                </w-menu>
              </w-btn>
            </template>
          </w-input>
          <!-- -> As in `PageTags.vue`: the field adds, and the chips under it are what was added -->
          <w-select
            v-model="state.tags"
            :options="sortedTags"
            :label="t(`editor.props.tags`)"
            :placeholder="t(`editor.props.tagsPlaceholder`)"
            :loading="state.tagsLoading"
            outlined
            dense
            options-dense
            use-input
            create
            multiple
            hide-dropdown-icon
            @create="createTag" />
          <div class="flex flex-wrap items-center gap-1" v-if="state.tags.length > 0">
            <w-chip
              v-for="tag of state.tags"
              :key="`tag-` + tag"
              square
              color="secondary"
              text-color="white"
              dense
              removable
              @remove="removeTag(tag)">
              <w-icon class="me-1" name="la:hashtag" size="14px" />
              <span class="text-caption">{{ tag }}</span>
            </w-chip>
          </div>
          <w-toggle
            v-model="state.published"
            class="mt-2"
            color="primary"
            checked-icon="la:check"
            unchecked-icon="la:times"
            :label="state.published ? t(`editor.props.published`) : t(`editor.props.draft`)" />
        </w-form>
      </w-card-section>
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
          icon="la:check"
          :label="t(`liveNote.publish.createPage`)"
          color="primary"
          padding="xs md"
          @click="submit" />
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

import IconPickerDialog from '@/components/IconPickerDialog.vue'

import { DEFAULT_PAGE_ICON } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

/**
 * The page a live note is about to become -- opened from Publish to Page above the note.
 *
 * Answers with the page's properties; where the page goes is the Save As dialog's question, asked by
 * the caller next, and the caller does the publishing.
 */

const props = defineProps({
  /** The note's title, which the page's starts from. */
  title: {
    type: String,
    default: ''
  }
})

defineEmits(dialogComponentEmits)

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

const siteStore = useSiteStore()

const { t } = useI18n()

const state = reactive({
  title: props.title,
  description: '',
  icon: DEFAULT_PAGE_ICON,
  tags: [],
  published: true,
  /** Every tag on the site, as suggestions. */
  tagOptions: [],
  tagsLoading: false
})

/** Alphabetical, for the reason `PageTags.vue` gives. */
const sortedTags = computed(() => [...state.tagOptions].sort((a, b) => a.localeCompare(b)))

/** A comma or a semicolon separates tags, so a list can be pasted in one go -- as in `PageTags.vue`. */
function createTag(val) {
  const tags = val
    .split(/[,;]+/)
    .map((v) => v.trim())
    .filter(Boolean)
  for (const tag of tags) {
    if (!state.tagOptions.includes(tag)) {
      state.tagOptions.push(tag)
    }
    if (!state.tags.includes(tag)) {
      state.tags = [...state.tags, tag]
    }
  }
}

function removeTag(tag) {
  state.tags = state.tags.filter((t) => t !== tag)
}

function submit() {
  const title = state.title.trim()
  if (!title) {
    notify({ type: 'negative', message: t('pageSaveDialog.titleMissing') })
    return
  }
  onDialogOK({
    title,
    description: state.description.trim(),
    icon: state.icon,
    tags: state.tags,
    publishState: state.published ? 'published' : 'draft'
  })
}

onMounted(async () => {
  state.tagsLoading = true
  try {
    await siteStore.fetchTags()
    state.tagOptions = siteStore.tags.map((t) => t.tag)
  } catch (err) {
    // -> Suggestions are a convenience: the field still adds tags without them
    notify({
      type: 'warning',
      message: t('editor.props.tagsFailed'),
      caption: apiErrorMessage(err)
    })
  } finally {
    state.tagsLoading = false
  }
})
</script>
