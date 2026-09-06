<template>
  <w-layout class="block-content-editor" view="hHh lpR fFf" container>
    <w-header class="card-header px-4 py-2">
      <w-icon
        :name="`img:/_assets/icons/ultraviolet-${block.isCustom ? 'plugin' : block.icon}.svg`"
        left
        size="md" />
      <div>
        <span>{{ t('editor.blockContent.title') }}</span>
        <div class="text-caption">{{ block.name }}</div>
      </div>
      <w-space />
      <w-btn-group push>
        <w-btn
          push
          color="white"
          text-color="grey-7"
          :label="t(`common.actions.cancel`)"
          :aria-label="t(`common.actions.cancel`)"
          icon="la:times"
          @click="close" />
        <w-btn
          push
          color="positive"
          text-color="white"
          :label="t(`common.actions.apply`)"
          :aria-label="t(`common.actions.apply`)"
          icon="la:check"
          @click="apply" />
      </w-btn-group>
    </w-header>
    <w-page-container>
      <!--
        No padding around the editor: every one of these is a whole working surface -- a canvas, a
        source pane -- and wants the screen it is given rather than a card's worth of it.
      -->
      <w-page class="block-content-editor-body">
        <component
          :is="editorComponent"
          v-if="editorComponent"
          v-model="state.source"
          :params="params"
          @save="apply" />
        <div v-else class="p-6">
          <w-card class="bg-negative rounded text-white" flat>
            <w-card-section class="items-center" horizontal>
              <w-card-section class="shrink-0 pr-0">
                <w-icon name="la:ban" size="lg" />
              </w-card-section>
              <w-card-section>
                <span>{{ t('editor.blockContent.unknownEditor') }}</span>
                <div class="text-caption text-red-1">{{ editorKey }}</div>
              </w-card-section>
            </w-card-section>
          </w-card>
        </div>
      </w-page>
    </w-page-container>
  </w-layout>
</template>

<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSiteStore } from '@/stores/site'

import LoadingGeneric from './LoadingGeneric.vue'

/**
 * The body of a block, in whatever editor the block named for it.
 *
 * The chrome and the plumbing are the block system's; what goes in the middle is not. A block
 * declares `contentEditor: '<key>'` in its `static definition`, the markdown editor offers an "Edit
 * Content" lens above it, and this resolves that key against the registry below — so adding an editor
 * is adding one component and one line to that map, and nothing anywhere else has to know what it
 * edits.
 *
 * What an editor component has to be, and the whole of it:
 *
 *   - a `modelValue` of the block's body as text, and `update:modelValue` when it changes;
 *   - a `params` object of the block's own parameters, for an editor that is configured by one — the
 *     server it talks to, say. Which of them mean anything is the editor's business alone;
 *   - optionally `@save`, for an editor with a save gesture of its own, which applies and closes.
 *     An editor without one is applied by the button up here, which is always there either way.
 *
 * Text in and text out: the fence it lives in, the line it goes back on and the undo it lands in are
 * the markdown editor's, and it receives the result over the event bus the way the table editor and
 * the file manager hand theirs back.
 */

/**
 * The editors a block may name, by the key it names them with.
 *
 * Async, so a block nobody on this page uses costs nothing to have — an embedded drawing editor is a
 * whole application, and it should not be in the bundle of a wiki that has never drawn one.
 */
const EDITORS = {
  drawio: defineAsyncComponent({
    loader: () => import('./BlockContentDrawio.vue'),
    loadingComponent: LoadingGeneric
  })
}

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

/*
  Read once, on the way in. The overlay is opened by a store patch and closes by clearing it, so
  holding the block and its parameters here keeps them from going out from under the editor as it
  closes -- and the source is a copy, so leaving without applying leaves the page as it was.
*/
const editorKey = siteStore.overlayOpts?.editor ?? ''
const block = siteStore.overlayOpts?.block ?? {}
const params = siteStore.overlayOpts?.params ?? {}
const replace = siteStore.overlayOpts?.replace ?? null

const state = reactive({
  source: siteStore.overlayOpts?.source ?? ''
})

// COMPUTED

const editorComponent = computed(() => EDITORS[editorKey] ?? null)

// METHODS

function apply() {
  if (replace) {
    EVENT_BUS.emit('replaceBlockContent', { source: state.source, replace })
  }
  close()
}

function close() {
  siteStore.$patch({ overlay: '' })
}

// -> Cleared whichever way the overlay was left, so a body left behind in the options is not the one
//    the next block opens on
onBeforeUnmount(() => {
  siteStore.overlayOpts = {}
})
</script>

<style lang="scss">
.block-content-editor {
  /*
    A foreground to go with the surface, as the table editor needs for the same reason: nothing in
    here sits on a `w-card`, and that is what declares the app's text colour -- so without this
    everything that merely inherits it stays black on the dark overlay.
  */
  @at-root .body--light & {
    color: var(--color-black);
  }
  @at-root .body--dark & {
    color: var(--color-white);
  }

  /*
    The editor fills the overlay. `min-height: 0` because this is a flex item of the page container:
    without it the box is sized by its content, and an editor asking for 100% of a box that is as tall
    as itself resolves to nothing at all.
  */
  &-body {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 0;

    > * {
      flex: 1 1 auto;
      min-height: 0;
    }
  }
}
</style>
