<template>
  <!--
    `h-full` so the card fills the panel: the scroll area below is sized `calc(100% - 50px)`, which
    against an auto-height card resolves to `auto` and let the card grow past the panel instead of
    scrolling inside it -- the white surface and the panel's shadow ending in different places.
  -->
  <w-card class="page-properties-dialog h-full">
    <!-- -> Offset comes from the stylesheet now, relative to this card; see SideDialog -->
    <div class="floating-sidepanel-quickaccess animated fadeIn" v-if="state.showQuickAccess">
      <template v-for="(qa, idx) of quickaccess" :key="`qa-` + qa.key">
        <w-btn :icon="qa.icon" flat padding="sm xs" size="sm" @click="jumpToSection(qa.key)">
          <w-tooltip anchor="center left" self="center right">{{ qa.label }}</w-tooltip>
        </w-btn>
        <w-separator dark v-if="idx < quickaccess.length - 1" />
      </template>
    </div>
    <w-toolbar class="bg-primary text-white flex">
      <div class="text-subtitle2">{{ t('editor.props.pageProperties') }}</div>
      <w-space />
      <w-btn
        class="mr-2"
        dense
        flat
        rounded
        color="white"
        icon="la:question-circle"
        :href="siteStore.docsBase + `/editor/properties`"
        target="_blank"
        type="a" />
      <w-btn icon="la:times" dense flat @click="siteStore.sideDialogShown = false" />
    </w-toolbar>
    <w-scroll-area
      ref="scrollArea"
      :thumb-style="siteStore.scrollStyle.thumb"
      :bar-style="siteStore.scrollStyle.bar"
      style="height: calc(100% - 50px)">
      <w-card-section id="refCardInfo">
        <div class="w-section-header">{{ t('editor.props.info') }}</div>
        <w-form class="gap-2">
          <w-input
            ref="iptTitle"
            v-model="pageStore.title"
            :label="t(`editor.props.title`)"
            outlined
            dense />
          <w-input
            v-model="pageStore.description"
            :label="t(`editor.props.shortDescription`)"
            outlined
            dense />
          <w-input v-model="pageStore.icon" :label="t(`editor.props.icon`)" outlined dense>
            <template #prepend>
              <w-icon :name="pageStore.icon" size="20px" color="primary" />
            </template>
            <template #append>
              <!--
                A button, not a bare `w-icon`: for a bundled icon WIcon renders an <svg> whose body is
                set through `v-html`, which renders no slot -- so the menu inside it never existed and
                the control did nothing. It was also just the 14px glyph, with no hit area of its own.
              -->
              <w-btn
                flat
                dense
                round
                icon="la:icons"
                color="primary"
                :aria-label="t(`iconPicker.open`)">
                <w-tooltip>{{ t('iconPicker.open') }}</w-tooltip>
                <!-- The properties panel is docked to the right edge, so the picker has to grow leftwards -->
                <w-menu content-class="shadow-7" anchor="bottom right" self="top right">
                  <icon-picker-dialog v-model="pageStore.icon" />
                </w-menu>
              </w-btn>
            </template>
          </w-input>
          <w-input
            v-if="pageStore.path !== `home`"
            v-model="pageStore.alias"
            :label="t(`editor.props.alias`)"
            outlined
            dense
            prefix="/a/" />
        </w-form>
      </w-card-section>
      <w-card-section class="alt-card" id="refCardPublishState">
        <div class="w-section-header">{{ t('editor.props.publishState') }}</div>
        <w-form class="gap-4">
          <div>
            <w-btn-toggle
              v-model="pageStore.publishState"
              push
              glossy
              no-caps
              toggle-color="primary"
              :options="[
                { label: t('editor.props.draft'), value: 'draft' },
                { label: t('editor.props.published'), value: 'published' },
                { label: t('editor.props.dateRange'), value: 'scheduled' }
              ]" />
          </div>
          <div class="text-caption" v-if="pageStore.publishState === `published`">
            <em>{{ t('editor.props.publishedHint') }}</em>
          </div>
          <div class="text-caption" v-else-if="pageStore.publishState === `draft`">
            <em>{{ t('editor.props.draftHint') }}</em>
          </div>
          <template v-else-if="pageStore.publishState === `scheduled`">
            <div class="text-caption">
              <em>{{ t('editor.props.dateRangeHint') }}</em>
            </div>
            <w-date v-model="publishingRange" range flat bordered landscape minimal />
          </template>
        </w-form>
      </w-card-section>
      <w-card-section id="refCardRelations">
        <div class="w-section-header">{{ t('editor.props.relations') }}</div>
        <w-list
          class="rounded mb-2 bg-white dark:bg-black/20"
          v-if="pageStore.relations.length > 0"
          separator
          bordered>
          <w-item v-for="rel of pageStore.relations" :key="`rel-id-` + rel.id">
            <w-item-section side><w-icon :name="rel.icon" /></w-item-section>
            <w-item-section>
              <w-item-label
                ><strong>{{ rel.label }}</strong></w-item-label
              >
              <w-item-label caption>{{ rel.caption }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-chip class="px-2" dense square color="primary" text-color="white">
                <div class="text-caption">{{ rel.position }}</div>
              </w-chip>
            </w-item-section>
            <w-item-section side>
              <w-btn icon="la:pen" dense flat padding="none" @click="editRelation(rel)" />
            </w-item-section>
            <w-item-section side>
              <w-btn icon="la:times" dense flat padding="none" @click="removeRelation(rel)" />
            </w-item-section>
          </w-item>
        </w-list>
        <w-btn
          class="w-full"
          :label="t(`editor.props.relationAdd`)"
          icon="la:plus"
          no-caps
          unelevated
          color="secondary"
          @click="newRelation">
          <w-tooltip>{{ t('editor.props.relationAddHint') }}</w-tooltip>
        </w-btn>
      </w-card-section>
      <w-card-section class="alt-card" id="refCardScripts">
        <div class="w-section-header">{{ t('editor.props.scripts') }}</div>
        <w-btn
          class="w-full"
          :label="t(`editor.props.jsLoad`)"
          icon="la:js-square"
          no-caps
          unelevated
          color="secondary"
          @click="editScripts(`jsLoad`)">
          <w-tooltip>{{ t('editor.props.jsLoadHint') }}</w-tooltip>
        </w-btn>
        <w-btn
          class="w-full mt-2"
          :label="t(`editor.props.jsUnload`)"
          icon="la:js-square"
          no-caps
          unelevated
          color="secondary"
          @click="editScripts(`jsUnload`)">
          <w-tooltip>{{ t('editor.props.jsUnloadHint') }}</w-tooltip>
        </w-btn>
        <w-btn
          class="w-full mt-2"
          :label="t(`editor.props.styles`)"
          icon="la:css3-alt"
          no-caps
          unelevated
          color="secondary"
          @click="editScripts(`styles`)">
          <w-tooltip>{{ t('editor.props.stylesHint') }}</w-tooltip>
        </w-btn>
      </w-card-section>
      <w-card-section class="pb-6" id="refCardSidebar">
        <div class="w-section-header">{{ t('editor.props.sidebar') }}</div>
        <w-form class="gap-4 pt-2">
          <div>
            <w-toggle
              v-model="pageStore.showSidebar"
              dense
              :label="t(`editor.props.showSidebar`)"
              color="primary"
              checked-icon="la:check"
              unchecked-icon="la:times" />
          </div>
          <div>
            <w-toggle
              v-if="pageStore.showSidebar"
              v-model="pageStore.showToc"
              dense
              :label="t(`editor.props.showToc`)"
              color="primary"
              checked-icon="la:check"
              unchecked-icon="la:times" />
          </div>
          <div v-if="pageStore.showSidebar && pageStore.showToc" style="padding-left: 40px">
            <div class="text-caption">
              {{ t('editor.props.tocMinMaxDepth') }}
              <strong>(H{{ pageStore.tocDepth.min }} &rarr; H{{ pageStore.tocDepth.max }})</strong>
            </div>
            <w-range
              v-model="pageStore.tocDepth"
              :min="1"
              :max="6"
              color="primary"
              :left-label-value="`H` + pageStore.tocDepth.min"
              :right-label-value="`H` + pageStore.tocDepth.max"
              snap
              label
              markers />
          </div>
          <div>
            <w-toggle
              v-if="pageStore.showSidebar"
              v-model="pageStore.showTags"
              dense
              :label="t(`editor.props.showTags`)"
              color="primary"
              checked-icon="la:check"
              unchecked-icon="la:times" />
          </div>
        </w-form>
      </w-card-section>
      <w-card-section class="alt-card pb-6" id="refCardSocial">
        <div class="w-section-header">{{ t('editor.props.social') }}</div>
        <w-form class="gap-4 pt-2">
          <div>
            <w-toggle
              v-model="pageStore.allowComments"
              dense
              :label="t(`editor.props.allowComments`)"
              color="primary"
              checked-icon="la:check"
              unchecked-icon="la:times" />
          </div>
          <div>
            <w-toggle
              v-model="pageStore.allowContributions"
              dense
              :label="t(`editor.props.allowContributions`)"
              color="primary"
              checked-icon="la:check"
              unchecked-icon="la:times" />
          </div>
          <div>
            <w-toggle
              v-model="pageStore.allowRatings"
              dense
              :label="t(`editor.props.allowRatings`)"
              color="primary"
              checked-icon="la:check"
              unchecked-icon="la:times" />
          </div>
        </w-form>
      </w-card-section>
      <w-card-section class="pb-6" id="refCardTags">
        <div class="w-section-header">{{ t('editor.props.tags') }}</div>
        <page-tags edit />
      </w-card-section>
      <w-card-section class="alt-card pb-6" id="refCardVisibility">
        <div class="w-section-header">{{ t('editor.props.visibility') }}</div>
        <w-form class="gap-4 pt-2">
          <div>
            <w-toggle
              v-model="pageStore.isBrowsable"
              dense
              :label="$t(`editor.props.showInTree`)"
              color="primary"
              checked-icon="la:check"
              unchecked-icon="la:times" />
          </div>
          <div>
            <w-toggle
              v-model="pageStore.isSearchable"
              dense
              :label="$t(`editor.props.isSearchable`)"
              color="primary"
              checked-icon="la:check"
              unchecked-icon="la:times" />
          </div>
          <div>
            <w-toggle
              v-model="state.requirePassword"
              @update:model-value="toggleRequirePassword"
              dense
              :label="$t(`editor.props.requirePassword`)"
              color="primary"
              checked-icon="la:check"
              unchecked-icon="la:times" />
          </div>
          <div v-if="state.requirePassword" style="padding-left: 40px">
            <!-- -> Masked, with WInput's own reveal toggle: this is a secret to hand out rather than
                    one to remember, so the author has to be able to read back what they typed -->
            <w-input
              ref="iptPagePassword"
              v-model="pageStore.password"
              type="password"
              revealable
              autocomplete="off"
              :label="t(`editor.props.password`)"
              :hint="t(`editor.props.passwordHint`)"
              outlined
              dense />
          </div>
        </w-form>
      </w-card-section>
    </w-scroll-area>
    <w-dialog v-model="state.showRelationDialog">
      <page-relation-dialog
        :edit-id="state.editRelationId"
        @close="state.showRelationDialog = false" />
    </w-dialog>
    <w-dialog v-model="state.showScriptsDialog">
      <page-scripts-dialog :mode="state.pageScriptsMode" @close="state.showScriptsDialog = false" />
    </w-dialog>
  </w-card>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'

import { useEditorStore } from '@/stores/editor'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

import IconPickerDialog from './IconPickerDialog.vue'
import PageRelationDialog from './PageRelationDialog.vue'
import PageScriptsDialog from './PageScriptsDialog.vue'
import PageTags from './PageTags.vue'

// STORES

const editorStore = useEditorStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  showRelationDialog: false,
  showScriptsDialog: false,
  requirePassword: false,
  editRelationId: null,
  pageScriptsMode: 'jsLoad',
  showQuickAccess: true
})

const quickaccess = [
  { key: 'refCardInfo', icon: 'la:info-circle', label: t('editor.props.info') },
  { key: 'refCardPublishState', icon: 'la:power-off', label: t('editor.props.publishState') },
  { key: 'refCardRelations', icon: 'la:sun', label: t('editor.props.relations') },
  { key: 'refCardScripts', icon: 'la:code', label: t('editor.props.scripts') },
  { key: 'refCardSidebar', icon: 'la:ruler-vertical', label: t('editor.props.sidebar') },
  { key: 'refCardSocial', icon: 'la:comments', label: t('editor.props.social') },
  { key: 'refCardTags', icon: 'la:tags', label: t('editor.props.tags') },
  { key: 'refCardVisibility', icon: 'la:eye', label: t('editor.props.visibility') }
]

// REFS

const iptTitle = ref(null)
const iptPagePassword = ref(null)

// COMPUTED

const publishingRange = computed({
  get() {
    return {
      from: pageStore.publishStartDate,
      to: pageStore.publishEndDate
    }
  },
  set(newValue) {
    pageStore.publishStartDate = newValue?.from
    pageStore.publishEndDate = newValue?.to
  }
})

// WATCHERS

pageStore.$subscribe(() => {
  editorStore.$patch({
    lastChangeTimestamp: Temporal.Now.instant()
  })
})

// METHODS

function editScripts(mode) {
  state.pageScriptsMode = mode
  state.showScriptsDialog = true
}
function newRelation() {
  state.editRelationId = null
  state.showRelationDialog = true
}
function editRelation(rel) {
  state.editRelationId = rel.id
  state.showRelationDialog = true
}
function removeRelation(rel) {
  pageStore.relations = pageStore.relations.filter((r) => r.id !== rel.id)
}
function jumpToSection(id) {
  document.querySelector(`#${id}`).scrollIntoView({
    behavior: 'smooth'
  })
}
function toggleRequirePassword(newValue) {
  if (newValue) {
    nextTick(() => {
      iptPagePassword.value.focus()
      iptPagePassword.value.$el.scrollIntoView({
        behavior: 'smooth'
      })
    })
  } else {
    pageStore.password = ''
  }
}

// MOUNTED

onMounted(() => {
  state.requirePassword = pageStore.password?.length > 0

  // -> Title is the field this panel is opened to edit, so the caret starts there
  nextTick(() => {
    iptTitle.value?.focus()
  })

  setTimeout(() => {
    state.showQuickAccess = true
  }, 300)
})
</script>

<style lang="scss">
/*
  The panel is inset from the window and rounded now, so the two children that reach its corners have
  to be rounded too -- a square toolbar or scroll area paints straight over the radius. `inherit`
  takes the card's own value, so these stay right if that radius ever changes.

  The scroll area is what makes the BOTTOM corners work: it already clips its overflow, so giving it
  the radius clips the last section (grey, `alt-card`) to the corner instead of letting it square off.
*/
.page-properties-dialog {
  > .w-toolbar {
    border-top-left-radius: inherit;
    border-top-right-radius: inherit;
  }

  > .w-scroll-area {
    border-bottom-left-radius: inherit;
    border-bottom-right-radius: inherit;
  }

  /*
    The section headings, in the treatment the profile pages use.

    `.w-section-header` carries its own 16px inset and expects to sit in a column that has none --
    inside a `w-card-section` it would be indented twice, and its wash would stop short of the panel
    on both sides. So the section's padding is cancelled around it: the band then spans the panel and
    its text lines up with the fields beneath it, exactly as on a profile page. The top padding is
    given back so the heading sits where the section's own padding had it.

    The tinted `alt-card` sections keep their stripe: the heading is inside the section, so the wash
    is drawn over whichever surface that section has.
  */
  .w-section-header {
    margin: -16px -16px 10px;
    padding-top: 16px;
  }
}
</style>
