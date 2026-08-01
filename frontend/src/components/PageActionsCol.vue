<template>
  <!--
    `flex flex-col` in place of the `column` this carried: that was Quasar's flex helper and nothing
    defines it any more, so the rail was a plain block. Which is why `items-stretch` never stretched
    the buttons to its width, and why `<w-space />` -- a `flex-grow: 1` spacer -- could not push the
    last group to the bottom.
  -->
  <!--
    Page Properties keeps the rail's full square; every other button is 48px. The primary action for
    the page reads as the largest target, and the rest sit quieter beneath it.
  -->
  <div
    class="page-actions flex flex-col items-stretch order-last"
    :class="editorStore.isActive ? `is-editor` : ``">
    <template v-if="userStore.can(`edit:pages`)">
      <w-btn
        class="aspect-square"
        flat
        icon="la:pen-nib"
        :color="editorStore.isActive ? `white` : `deep-orange-9`"
        aria-label="Page Properties"
        @click="togglePageProperties">
        <w-tooltip anchor="center left" self="center right">Page Properties</w-tooltip>
      </w-btn>
    </template>
    <!--
      Between the two halves of the authoring group on purpose: it sits under the Edit button for
      somebody who has one, and at the top of the rail for a reviewer who may not edit at all -- which
      is why it is outside that group rather than in it.

      Only for whoever reviews this page: the server answers `canReview` from the approval rules and
      the reviewer's own permissions, so nothing here has to know how that is decided.
    -->
    <w-btn
      class="h-12"
      v-if="state.canReview"
      flat
      :color="editorStore.isActive ? `white` : `deep-orange-9`"
      aria-label="Pending Edit Suggestions">
      <!--
        The badge is a sibling of the icon, not a child of it: WIcon renders a bare `<svg>` and no
        slot, so anything written inside it is dropped -- and an HTML badge could not live inside an
        SVG in any case. It floats against the button, which is the positioned box here.
      -->
      <w-icon name="la:inbox" />
      <!--
        The same expression as the button's own colour, so the badge cannot drift from the icon it
        sits on: `deep-orange-9` on the resting rail, and inverted in the editor, where the rail is
        already that orange and an orange badge would disappear into it.
      -->
      <w-badge
        v-if="pendingCount > 0"
        :color="editorStore.isActive ? `white` : `deep-orange-9`"
        :text-color="editorStore.isActive ? `deep-orange-9` : `white`"
        rounded
        floating>
        <strong>{{ pendingCount }}</strong>
      </w-badge>
      <w-tooltip anchor="center left" self="center right">
        {{ t('inbox.pendingReview') }}
      </w-tooltip>
      <w-menu
        class="translucent-menu"
        anchor="top left"
        self="top right"
        auto-close
        transition-show="jump-left">
        <w-list padding style="min-width: 320px">
          <w-item v-if="pendingCount < 1">
            <w-item-section>
              <w-item-label caption>{{ t('inbox.reviewNone') }}</w-item-label>
            </w-item-section>
          </w-item>
          <w-item
            v-for="submission of state.submissions"
            :key="submission.id"
            clickable
            @click="reviewSubmission(submission)">
            <w-item-section class="items-center" avatar>
              <w-icon class="text-deep-orange-9" name="la:file-alt" size="sm" />
            </w-item-section>
            <w-item-section>
              <w-item-label>
                {{ submission.author.name || t('inbox.reviewUnknownAuthor') }}
              </w-item-label>
              <w-item-label caption>{{ humanizeDate(submission.createdAt) }}</w-item-label>
            </w-item-section>
            <w-item-section side v-if="submission.isStale">
              <w-badge color="warning" rounded>{{ t('inbox.reviewStale') }}</w-badge>
            </w-item-section>
          </w-item>
        </w-list>
      </w-menu>
    </w-btn>
    <template v-if="userStore.can(`edit:pages`)">
      <w-btn
        class="h-12"
        v-if="flagsStore.experimental"
        flat
        icon="la:project-diagram"
        :color="editorStore.isActive ? `white` : `deep-orange-9`"
        aria-label="Page Data"
        @click="togglePageData"
        disable>
        <w-tooltip anchor="center left" self="center right">Page Data</w-tooltip>
      </w-btn>
      <w-btn
        class="h-12"
        v-if="editorStore.isActive"
        flat
        color="white"
        :text-color="hasPendingAssets ? `white` : `deep-orange-3`"
        aria-label="Pending Asset Uploads">
        <!-- Outside the icon for the same reason as the review badge above -->
        <w-icon name="mdi:image-sync-outline" />
        <w-badge
          class="page-actions-pending-badge"
          v-if="hasPendingAssets"
          color="white"
          text-color="orange-9"
          rounded
          floating>
          <strong>{{ editorStore.pendingAssets.length * 1 }}</strong>
        </w-badge>
        <w-tooltip anchor="center left" self="center right">Pending Asset Uploads</w-tooltip>
        <w-menu ref="menuPendingAssets" anchor="top left" self="top right" :offset="[10, 0]">
          <w-card style="width: 450px">
            <w-card-section class="card-header">
              <w-icon name="img:/_assets/icons/color-data-pending.svg" left size="sm" />
              <span>Pending Asset Uploads</span>
            </w-card-section>
            <w-card-section v-if="!hasPendingAssets"
              >There are no assets pending uploads.</w-card-section
            >
            <w-list v-else separator>
              <w-item v-for="item of editorStore.pendingAssets" :key="item.id">
                <w-item-section side><w-icon name="la:file-image" /></w-item-section>
                <w-item-section>{{ item.fileName }}</w-item-section>
                <w-item-section side>
                  <w-btn
                    class="acrylic-btn"
                    color="negative"
                    round
                    icon="la:times"
                    size="xs"
                    flat
                    @click="removePendingAsset(item)" />
                </w-item-section>
              </w-item>
            </w-list>
            <w-card-section class="card-actions">
              <em class="text-caption"
                >Assets that are pasted or dropped onto this page will be held here until the page
                is saved.</em
              >
            </w-card-section>
          </w-card>
        </w-menu>
      </w-btn>
      <w-separator class="my-2" inset />
    </template>
    <!--
      `read:history` is the permission that exists to say who may see what a page used to contain, so
      the button follows it rather than page read access. The API asks the same question.
    -->
    <w-btn
      class="h-12"
      v-if="userStore.can(`read:history`)"
      flat
      icon="la:history"
      :color="editorStore.isActive ? `white` : `grey`"
      aria-label="Page History"
      @click="viewPageHistory">
      <w-tooltip anchor="center left" self="center right">Page History</w-tooltip>
    </w-btn>
    <w-btn
      class="h-12"
      flat
      icon="la:code"
      :color="editorStore.isActive ? `white` : `grey`"
      aria-label="Page Source"
      @click="viewPageSource">
      <w-tooltip anchor="center left" self="center right">Page Source</w-tooltip>
    </w-btn>
    <template v-if="!(editorStore.isActive && editorStore.mode === `create`)">
      <w-separator class="my-2" inset />
      <w-btn
        class="h-12"
        flat
        icon="la:ellipsis-h"
        :color="editorStore.isActive ? `deep-orange-2` : `grey`"
        aria-label="Page Actions">
        <w-tooltip anchor="center left" self="center right">Page Actions</w-tooltip>
        <!--
          Literal colour classes, not WIcon's `color` prop: that builds `text-<name>` at runtime and
          Tailwind only emits a utility it can see spelled out, so these three icons had been drawing
          in the inherited text colour rather than the rail's orange.
        -->
        <w-menu
          class="translucent-menu"
          anchor="top left"
          self="top right"
          auto-close
          transition-show="jump-left">
          <w-list padding style="min-width: 225px">
            <w-item clickable disabled v-if="userStore.can(`manage:pages`)">
              <w-item-section class="items-center" avatar>
                <w-icon class="text-deep-orange-9" name="la:atom" size="sm" />
              </w-item-section>
              <w-item-section><w-item-label>Convert Page</w-item-label></w-item-section>
            </w-item>
            <w-item clickable v-if="userStore.can(`edit:pages`)" @click="rerenderPage">
              <w-item-section class="items-center" avatar>
                <w-icon class="text-deep-orange-9" name="la:magic" size="sm" />
              </w-item-section>
              <w-item-section><w-item-label>Rerender Page</w-item-label></w-item-section>
            </w-item>
            <w-item clickable disabled>
              <w-item-section class="items-center" avatar>
                <w-icon class="text-deep-orange-9" name="la:sun" size="sm" />
              </w-item-section>
              <w-item-section><w-item-label>View Backlinks</w-item-label></w-item-section>
            </w-item>
          </w-list>
        </w-menu>
      </w-btn>
    </template>
    <w-space />
    <!--
      Hidden outright while a suggestion is being written: duplicating, moving or deleting the page is
      not part of suggesting a change to it, and a submitter who happens to hold those rights elsewhere
      would otherwise find them here.
    -->
    <template v-if="!(editorStore.isActive && [`create`, `suggest`].includes(editorStore.mode))">
      <w-btn
        class="h-12"
        v-if="userStore.can(`create:pages`)"
        flat
        icon="la:copy"
        :color="editorStore.isActive ? `deep-orange-2` : `grey`"
        aria-label="Duplicate Page"
        @click="duplicatePage">
        <w-tooltip anchor="center left" self="center right">Duplicate Page</w-tooltip>
      </w-btn>
      <w-btn
        class="h-12"
        v-if="userStore.can(`manage:pages`)"
        flat
        icon="la:share"
        :color="editorStore.isActive ? `deep-orange-2` : `grey`"
        aria-label="Rename / Move Page"
        @click="renamePage">
        <w-tooltip anchor="center left" self="center right">Rename / Move Page</w-tooltip>
      </w-btn>
      <w-btn
        class="h-12"
        v-if="userStore.can(`delete:pages`)"
        flat
        icon="la:trash"
        :color="editorStore.isActive ? `deep-orange-2` : `grey`"
        aria-label="Delete Page"
        @click="deletePage">
        <w-tooltip anchor="center left" self="center right">Delete Page</w-tooltip>
      </w-btn>
    </template>
    <!-- What the rail says instead: which of the two write modes the editor is in. -->
    <span class="page-actions-mode" v-else>{{
      editorStore.mode === `suggest`
        ? t('common.actions.suggestedEdit')
        : t('common.actions.newPage')
    }}</span>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { dialog } from '@/composables/dialog'
import { notify } from '@/composables/notify'

import { useEditorStore } from '@/stores/editor'
import { useFlagsStore } from '@/stores/flags'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

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

// REFS

const menuPendingAssets = ref(null)

// DATA

const state = reactive({
  /** Whether this user reviews this page at all, which is what shows the button. */
  canReview: false,
  /** What is waiting on it, oldest first. */
  submissions: []
})

// COMPUTED

const hasPendingAssets = computed(() => editorStore.pendingAssets?.length > 0)

const pendingCount = computed(() => state.submissions.length)

// WATCHERS

// -> Per page, so navigating between pages asks again rather than carrying the last one's answer
watch(() => pageStore.id, loadSubmissions)

// MOUNTED

onMounted(loadSubmissions)

// METHODS

function humanizeDate(val) {
  return Temporal.Instant.from(val).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

/**
 * What is waiting on this page, if this user is one of its reviewers.
 *
 * Quietly on failure: the rail is not where a reader finds out that a request went wrong, and a
 * button that does not appear is the same outcome as not being a reviewer.
 */
async function loadSubmissions() {
  state.canReview = false
  state.submissions = []
  if (!pageStore.id || !userStore.authenticated) {
    return
  }
  try {
    const resp = await API_CLIENT.get(
      `sites/${siteStore.id}/pages/${pageStore.id}/submissions`
    ).json()
    state.canReview = resp?.canReview === true
    state.submissions = resp?.submissions ?? []
  } catch (err) {
    console.warn(err)
  }
}

/**
 * Open one for review, remembering where it was opened from.
 *
 * `from=page` is what sends the reviewer back here when they are done rather than to the inbox queue
 * they never came through.
 */
function reviewSubmission(submission) {
  router.push({ path: `/_inbox/review/${submission.id}`, query: { from: 'page' } })
}

function togglePageProperties() {
  siteStore.$patch({
    sideDialogComponent: 'PagePropertiesDialog',
    sideDialogShown: true
  })
}

function togglePageData() {
  siteStore.$patch({
    sideDialogComponent: 'PageDataDialog',
    sideDialogShown: true
  })
}

function viewPageHistory() {
  siteStore.$patch({ overlay: 'PageHistory', overlayOpts: {} })
}

function viewPageSource() {
  siteStore.$patch({ overlay: 'PageSource', overlayOpts: {} })
}

function rerenderPage() {
  dialog({
    component: defineAsyncComponent(() => import('../components/RerenderPageDialog.vue')),
    componentProps: {
      id: pageStore.id
    }
  }).onOk(() => {
    pageStore.pageLoad({ id: pageStore.id })
  })
}

function duplicatePage() {
  dialog({
    component: defineAsyncComponent(() => import('../components/TreeBrowserDialog.vue')),
    componentProps: {
      mode: 'duplicatePage',
      folderPath: '',
      itemId: pageStore.id,
      itemTitle: pageStore.title,
      itemFileName: pageStore.path
    }
  }).onOk((newPageOpts) => {
    pageStore.pageDuplicate({
      sourecePageId: pageStore.id,
      path: newPageOpts.path,
      title: newPageOpts.title
    })
  })
}

function renamePage() {
  dialog({
    component: defineAsyncComponent(() => import('../components/TreeBrowserDialog.vue')),
    componentProps: {
      mode: 'renamePage',
      folderPath: '',
      itemId: pageStore.id,
      itemTitle: pageStore.title,
      itemFileName: pageStore.path
    }
  }).onOk(async (renamedPageOpts) => {
    try {
      if (renamedPageOpts.path === pageStore.path) {
        await pageStore.pageRename({ id: pageStore.id, title: renamedPageOpts.title })
        notify({
          type: 'positive',
          message: 'Page renamed successfully.'
        })
      } else {
        await pageStore.pageMove({
          id: pageStore.id,
          path: renamedPageOpts.path,
          title: renamedPageOpts.title
        })
        notify({
          type: 'positive',
          message: 'Page moved successfully.'
        })
      }
    } catch (err) {
      notify({
        type: 'negative',
        message: err.message
      })
    }
  })
}

function deletePage() {
  dialog({
    component: defineAsyncComponent(() => import('../components/PageDeleteDialog.vue')),
    componentProps: {
      pageId: pageStore.id,
      pageName: pageStore.title
    }
  }).onOk(() => {
    router.replace('/')
  })
}

function removePendingAsset(item) {
  URL.revokeObjectURL(item.blobUrl)
  editorStore.pendingAssets = editorStore.pendingAssets.filter((a) => a.id !== item.id)
  if (editorStore.pendingAssets.length < 1) {
    menuPendingAssets.value.hide()
  }
}
</script>

<style lang="scss">
.page-actions {
  flex: 0 0 56px;

  @at-root .body--light & {
    background-color: $grey-3;
  }
  @at-root .body--dark & {
    background-color: $dark-4;
  }

  &.is-editor {
    @at-root .body--light & {
      background-color: $deep-orange-9;
    }
    @at-root .body--dark & {
      background-color: $deep-orange-9;
    }
  }

  /* -> Taller than the shell only on a very short window, and then it scrolls rather than clipping */
  overflow-y: auto;
  scrollbar-width: none;

  &-mode {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    padding: 1.75rem 1rem 1.75rem 0;
    color: $deep-orange-3;
    font-weight: 500;
  }

  &-pending-badge {
    animation: pageActionsBadgePulsate 2s ease infinite;
  }
}

@keyframes pageActionsBadgePulsate {
  0% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(3px, -3px);
  }
  100% {
    transform: translate(0, 0);
  }
}
</style>
