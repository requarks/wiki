<template>
  <div class="page-header flex flex-wrap">
    <!-- PAGE ICON -->
    <div class="flex-none pl-4 flex items-center">
      <w-btn
        class="rounded"
        v-if="isEditing"
        padding="none"
        size="64px"
        color="primary"
        flat
        :aria-label="t(`editor.props.icon`)"
        style="min-height: 64px">
        <!-- -> 64px, the size the icon has when the page is merely being read; see the branch below -->
        <w-icon :name="pageStore.icon" size="64px" />
        <w-menu content-class="shadow-7"><icon-picker-dialog v-model="pageStore.icon" /></w-menu>
      </w-btn>
      <w-icon class="rounded" v-else :name="pageStore.icon" size="64px" color="primary" />
    </div>
    <!-- PAGE HEADER -->
    <!--
      In the editor the title and the description are the fields, edited where they sit rather than
      through a button and a popup. They keep the heading type they have when the page is being read:
      what tells an author they can type here is the hover tint and the caret, not a box drawn around
      the text.

      The text is NOT interpolated into the editable elements. Vue would rewrite the text node on every
      keystroke as the store echoes it back, and a rewritten text node puts the caret at the start of
      it. `syncEditable` writes it instead, and only when the two have actually diverged.
    -->
    <!--
      Centred rather than top-aligned: with no description the title is the only line in this column,
      and left at the top it sat above the middle of the icon beside it. A page that has one is taller
      than everything else in the row, so there is nothing to centre and this changes nothing.
    -->
    <div class="min-w-0 flex-1 flex flex-col justify-center p-4">
      <div class="text-h4 page-header-title">
        <span
          v-if="isEditing"
          ref="titleEl"
          class="page-header-editable"
          :class="{ 'is-empty': !pageStore.title }"
          contenteditable="plaintext-only"
          role="textbox"
          aria-multiline="false"
          :aria-label="t(`editor.props.title`)"
          :data-placeholder="t(`editor.props.title`)"
          @input="onEditableInput(`title`, $event)"
          @blur="onEditableBlur(`title`, $event)"
          @keydown.enter.prevent="$event.target.blur()" />
        <span v-else>{{ pageStore.title }}</span>
      </div>
      <div class="text-subtitle2 page-header-subtitle">
        <span
          v-if="isEditing"
          ref="descriptionEl"
          class="page-header-editable"
          :class="{ 'is-empty': !pageStore.description }"
          contenteditable="plaintext-only"
          role="textbox"
          aria-multiline="false"
          :aria-label="t(`editor.props.shortDescription`)"
          :data-placeholder="t(`editor.props.shortDescription`)"
          @input="onEditableInput(`description`, $event)"
          @blur="onEditableBlur(`description`, $event)"
          @keydown.enter.prevent="$event.target.blur()" />
        <span v-else>{{ pageStore.description }}</span>
      </div>
    </div>
    <!-- PAGE ACTIONS -->
    <div class="flex-none p-4 flex items-center justify-end">
      <template v-if="!editorStore.isActive">
        <!--
          Whoever is looking at a draft can already see it, so the badge is not gated on being logged
          in the way the actions beside it are: it is telling a reader what they are reading, not
          offering them something to do.
        -->
        <w-badge
          v-if="pageStore.publishState === `draft`"
          class="uppercase"
          color="negative"
          :label="t(`editor.props.draft`)" />
        <w-btn
          class="ml-4"
          v-if="userStore.authenticated"
          flat
          dense
          icon="la:bell"
          color="grey"
          aria-label="Watch Page"
          @click="notImplemented">
          <w-tooltip>Watch Page</w-tooltip>
        </w-btn>
        <w-btn
          class="ml-4"
          v-if="userStore.authenticated"
          flat
          dense
          icon="la:bookmark"
          color="grey"
          aria-label="Bookmark Page"
          @click="notImplemented">
          <w-tooltip>Bookmark Page</w-tooltip>
        </w-btn>
        <w-btn
          class="ml-4"
          v-if="siteStore.theme.showPrintBtn"
          flat
          dense
          icon="la:print"
          color="grey"
          aria-label="Print"
          @click="printPage">
          <w-tooltip>Print</w-tooltip>
        </w-btn>
      </template>
      <template v-if="editorStore.isActive">
        <!--
          Whoever else has this page open in an editor. Renders nothing when that is nobody, which is
          also what it renders whenever there is no collaboration session at all.
        -->
        <collab-presence class="mr-2" />
        <w-btn
          class="ml-4 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :href="siteStore.docsBase + `/editor/${editorStore.editor}`"
          target="_blank"
          type="a">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="ml-2 acrylic-btn"
          icon="la:cog"
          flat
          color="grey"
          :aria-label="t(`editor.settings`)"
          @click="openEditorSettings">
          <w-tooltip>{{ t(`editor.settings`) }}</w-tooltip>
        </w-btn>
      </template>
      <!--
        Not `v-else-if` on the block below: changes made from the page properties panel put the header
        into the pending state without an editor behind it, and hiding Edit there left no way back into
        the content at all. Ahead of the commit actions so those stay rightmost.
      -->
      <template v-if="!editorStore.isActive && userStore.can(`edit:pages`)">
        <w-btn
          class="acrylic-btn ml-4"
          flat
          icon="la:edit"
          color="deep-orange-9"
          :label="t(`common.actions.edit`)"
          :aria-label="t(`common.actions.edit`)"
          no-caps
          @click="editPage" />
      </template>
      <!--
        For a reader who may read the page but not change it, and whose groups an approval rule lets
        suggest edits to it. Same place and same shape as Edit, because it is the same intent -- what
        differs is where the result goes.
      -->
      <template v-else-if="!editorStore.isActive && pageStore.canSuggestEdits">
        <w-btn
          class="acrylic-btn ml-4"
          flat
          icon="la:edit"
          color="deep-orange-9"
          :label="
            pageStore.hasOpenSuggestion
              ? t(`common.actions.continueSuggestion`)
              : t(`common.actions.suggestEdits`)
          "
          :aria-label="
            pageStore.hasOpenSuggestion
              ? t(`common.actions.continueSuggestion`)
              : t(`common.actions.suggestEdits`)
          "
          no-caps
          @click="suggestEdits" />
      </template>
      <template v-if="editorStore.isActive || editorStore.hasPendingChanges">
        <w-btn
          class="acrylic-btn ml-2"
          flat
          icon="la:times"
          color="negative"
          :label="
            editorStore.hasPendingChanges ? t(`common.actions.discard`) : t(`common.actions.close`)
          "
          :aria-label="
            editorStore.hasPendingChanges ? t(`common.actions.discard`) : t(`common.actions.close`)
          "
          no-caps
          @click="discardChanges" />
        <w-btn
          class="acrylic-btn ml-2"
          v-if="isSuggesting"
          flat
          icon="la:paper-plane"
          color="positive"
          :label="t(`common.actions.submitEdits`)"
          :aria-label="t(`common.actions.submitEdits`)"
          :disabled="!editorStore.hasPendingChanges"
          no-caps
          @click="submitSuggestion" />
        <w-btn
          class="acrylic-btn ml-2"
          v-else-if="editorStore.mode === `create`"
          flat
          icon="la:check"
          color="positive"
          :label="t(`editor.createPage`)"
          :aria-label="t(`editor.createPage`)"
          no-caps
          @click="createPage" />
        <w-btn-group class="ml-2" v-else flat>
          <w-btn
            class="acrylic-btn"
            flat
            icon="la:check"
            color="positive"
            :label="t(`common.actions.saveChanges`)"
            :aria-label="t(`common.actions.saveChanges`)"
            :disabled="!editorStore.hasPendingChanges"
            no-caps
            @click.exact="saveChanges(false)"
            @click.ctrl.exact="saveChanges(true)" />
          <template v-if="editorStore.isActive">
            <w-separator vertical dark />
            <w-btn
              class="acrylic-btn"
              flat
              icon="la:check-double"
              color="positive"
              :aria-label="t(`common.actions.saveAndClose`)"
              :disabled="!editorStore.hasPendingChanges"
              @click="saveChanges(true)">
              <w-tooltip>{{ t(`common.actions.saveAndClose`) }}</w-tooltip>
            </w-btn>
          </template>
        </w-btn-group>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { dialog } from '@/composables/dialog'
import { loading } from '@/composables/loading'
import { notify } from '@/composables/notify'

import { useEditorStore } from '@/stores/editor'
import { useFlagsStore } from '@/stores/flags'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import CollabPresence from '@/components/CollabPresence.vue'
import IconPickerDialog from '@/components/IconPickerDialog.vue'

// STORES

const editorStore = useEditorStore()
const flagsStore = useFlagsStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// COMPUTED

/**
 * Suggesting an edit rather than making one: the editor is open on a submission, and everything about
 * the page other than its content is out of scope.
 */
const isSuggesting = computed(() => editorStore.isActive && editorStore.mode === 'suggest')

/**
 * Editing the page itself, which is what makes the icon, title and description editable in place.
 * Excludes suggest mode, where those are page properties the submitter has no say over.
 */
const isEditing = computed(() => editorStore.isActive && !isSuggesting.value)

// REFS

/** The two in-place fields, which only exist while the page itself is being edited. */
const titleEl = ref(null)
const descriptionEl = ref(null)

// WATCHERS

/*
  Opening the editor is what mounts the two fields, so it is also what fills them. `immediate` covers
  arriving with the editor already open, where the elements appear in the same tick as this runs.
*/
watch(
  () => isEditing.value,
  (editing) => editing && seedEditables(),
  { immediate: true }
)

/*
  Changed from somewhere else -- the properties panel edits both of these, and a save replaces the whole
  page -- so the field follows. A change that came FROM the field is already in the element and
  `syncEditable` leaves it alone.
*/
watch(
  () => pageStore.title,
  (title) => syncEditable(titleEl.value, title)
)
watch(
  () => pageStore.description,
  (description) => syncEditable(descriptionEl.value, description)
)

// METHODS

/**
 * Put a value into a contenteditable without disturbing a caret that is already in it.
 *
 * Writing `textContent` replaces the node's text and collapses the selection to its start, so it is
 * only done when the element and the store have actually diverged — which is never mid-keystroke,
 * since the keystroke is where the store's value came from.
 */
function syncEditable(el, value) {
  if (el && el.textContent !== (value ?? '')) {
    el.textContent = value ?? ''
  }
}

/** Both fields, from the store. Call after they mount; they do not exist outside the editor. */
async function seedEditables() {
  await nextTick()
  syncEditable(titleEl.value, pageStore.title)
  syncEditable(descriptionEl.value, pageStore.description)
}

function onEditableInput(field, event) {
  // -> Clearing the field leaves a browser-inserted `<br>` behind, which contributes nothing to the
  //    text but does hold a second line open under the placeholder
  if (event.target.textContent === '' && event.target.innerHTML !== '') {
    event.target.innerHTML = ''
  }
  pageStore[field] = event.target.textContent
  // -> What the tag editor and the properties panel do for their own edits: the header is a place a
  //    page gets changed, so it owes the same "unsaved changes" signal
  editorStore.lastChangeTimestamp = Temporal.Now.instant()
}

/*
  Tidied on the way out rather than as it is typed: a pasted line break or a run of spaces has no
  business in a title, but collapsing them under the caret would move it while someone is still going.
*/
function onEditableBlur(field, event) {
  const tidied = event.target.textContent.replace(/\s+/g, ' ').trim()
  if (tidied !== pageStore[field]) {
    pageStore[field] = tidied
    editorStore.lastChangeTimestamp = Temporal.Now.instant()
  }
  syncEditable(event.target, tidied)
}

function openEditorSettings() {
  EVENT_BUS.emit('openEditorSettings')
}

async function discardChanges() {
  // From create mode
  if (editorStore.mode === 'create') {
    editorStore.$patch({
      isActive: false,
      editor: ''
    })

    // Is it the home page in create mode?
    if ((pageStore.path === '' || pageStore.path === 'home') && pageStore.locale === 'en') {
      siteStore.overlay = 'Welcome'
    }

    router.replace('/')
    return
  }

  const hadPendingChanges = editorStore.hasPendingChanges
  const wasSuggesting = isSuggesting.value

  loading.show()
  try {
    editorStore.$patch({
      isActive: false,
      editor: '',
      // -> Back to the ordinary meaning of the editor, or the next thing opened would inherit this one
      mode: 'edit'
    })
    await pageStore.cancelPageEdit()
    if (hadPendingChanges) {
      notify({
        type: 'positive',
        // -> Nothing was reverted in the suggest case: the page never changed, the draft did
        message: wasSuggesting
          ? t('common.page.suggestDiscarded')
          : 'Page has been reverted to the last saved state.'
      })
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: 'Failed to reload page state.'
    })
  }
  loading.hide()
}

async function saveChanges(closeAfter = false) {
  if (siteStore.features.reasonForChange !== 'off') {
    dialog({
      component: defineAsyncComponent(() => import('../components/PageReasonForChangeDialog.vue')),
      componentProps: {
        required: siteStore.features.reasonForChange === 'required'
      }
    }).onOk(async ({ reason }) => {
      editorStore.$patch({
        reasonForChange: reason
      })
      saveChangesCommit(closeAfter)
    })
  } else {
    saveChangesCommit(closeAfter)
  }
}

async function saveChangesCommit(closeAfter = false) {
  await processPendingAssets()
  loading.show()
  try {
    await pageStore.pageSave()
    notify({
      type: 'positive',
      message: 'Page saved successfully.'
    })
    if (closeAfter) {
      editorStore.$patch({
        isActive: false,
        editor: ''
      })
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: 'Failed to save page changes.',
      caption: err.message
    })
  }
  loading.hide()
}

async function createPage() {
  // Handle home page creation flow
  if (pageStore.path === 'home') {
    await processPendingAssets()
    loading.show()
    try {
      await pageStore.pageSave()
      notify({
        type: 'positive',
        message: 'Homepage created successfully.'
      })
      editorStore.$patch({
        isActive: false
      })
      router.replace('/')
    } catch (err) {
      notify({
        type: 'negative',
        message: 'Failed to create homepage.',
        caption: err.message
      })
    }
    loading.hide()
    return
  }

  // All other pages
  dialog({
    component: defineAsyncComponent(() => import('../components/TreeBrowserDialog.vue')),
    componentProps: {
      mode: 'savePage',
      folderPath: '',
      itemTitle: pageStore.title,
      itemFileName: pageStore.path
    }
  }).onOk(async ({ path, title }) => {
    await processPendingAssets()

    loading.show()
    try {
      pageStore.$patch({
        title,
        path
      })
      await pageStore.pageSave()
      notify({
        type: 'positive',
        message: 'Page created successfully.'
      })
      editorStore.$patch({
        isActive: false
      })
    } catch (err) {
      notify({
        type: 'negative',
        message: 'Failed to create page.',
        caption: err.message
      })
    }
    loading.hide()
  })
}

async function processPendingAssets() {
  if (editorStore.pendingAssets?.length > 0) {
    return new Promise((resolve, reject) => {
      dialog({
        component: defineAsyncComponent(
          () => import('../components/UploadPendingAssetsDialog.vue')
        ),
        persistent: true
      })
        .onOk(resolve)
        .onCancel(reject)
    })
  }
}

async function editPage() {
  loading.show()
  await pageStore.pageEdit()
  loading.hide()
}

/**
 * Open the editor on an edit suggestion. Picks up the reader's own pending suggestion if they have
 * one, which the server decides -- see `pageSuggest`.
 */
async function suggestEdits() {
  loading.show()
  try {
    await pageStore.pageSuggest()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('common.page.suggestFailed'),
      caption: err.message
    })
  }
  loading.hide()
}

/**
 * Send the suggestion, asking a guest who they are first: nothing else records that, and a reviewer
 * has to be able to answer them.
 */
async function submitSuggestion() {
  if (!userStore.authenticated) {
    dialog({
      component: defineAsyncComponent(() => import('../components/SuggestionGuestDialog.vue'))
    }).onOk((guest) => submitSuggestionCommit(guest))
    return
  }
  submitSuggestionCommit()
}

async function submitSuggestionCommit(guest = {}) {
  loading.show()
  try {
    await pageStore.pageSubmitSuggestion(guest)
    // -> Back to the page as everyone else sees it: what was typed is now a suggestion waiting for a
    //    reviewer, not a version of the page, so leaving the editor open on it would be a lie
    editorStore.$patch({
      isActive: false,
      editor: '',
      mode: 'edit'
    })
    await pageStore.pageLoad({ id: pageStore.id })
    notify({
      type: 'positive',
      message: t('common.page.suggestSubmitted'),
      // -> Only an account can be matched to a suggestion afterwards, so only a logged in author is
      //    told they can come back to it; for a guest that would be a promise nothing here can keep
      caption: userStore.authenticated
        ? t('common.page.suggestSubmittedHint')
        : t('common.page.suggestSubmittedHintGuest')
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('common.page.suggestSubmitFailed'),
      caption:
        (await err.response
          ?.json()
          .then((b) => b?.message)
          .catch(() => null)) ?? err.message
    })
  }
  loading.hide()
}

function printPage() {
  window.print()
}

function notImplemented() {
  notify({
    type: 'negative',
    message: 'Not implemented'
  })
}
</script>

<style scoped lang="scss">
/*
  The two headings, while they are also the fields.

  No border and no focus ring: at rest each one has to read exactly as it does when the page is being
  read, which is the whole point of editing them where they sit. What says "type here" is the hover
  tint, the caret, and -- while a field is empty -- the placeholder below.

  The padding is cancelled by an equal negative margin, so the text keeps the position it has outside
  the editor and only the tint is inset from it.
*/
.page-header-editable {
  display: inline-block;
  padding: 0 4px;
  margin: 0 -4px;
  border-radius: 4px;
  outline: none;
  cursor: text;
  transition: background-color 0.15s var(--ease-standard);

  &:hover {
    background-color: rgb(0 0 0 / 0.06);
  }
  &:focus {
    background-color: rgb(0 0 0 / 0.09);
  }

  @at-root .body--dark & {
    &:hover {
      background-color: rgb(255 255 255 / 0.08);
    }
    &:focus {
      background-color: rgb(255 255 255 / 0.12);
    }
  }
}

/*
  Keyed off the store rather than `:empty`, which a cleared field can fail: the browser leaves a `<br>`
  behind and the element stops counting as empty even though it looks it.
*/
.page-header-editable.is-empty::before {
  content: attr(data-placeholder);
  opacity: 0.4;
  /* -> Decoration: it must not be selectable, and it must never end up in the value */
  pointer-events: none;
  user-select: none;
}
</style>
