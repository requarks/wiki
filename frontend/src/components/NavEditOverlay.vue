<template>
  <w-layout view="hHh lpR fFf" container>
    <w-header class="card-header px-4 py-2">
      <w-icon name="img:/_assets/icons/fluent-sidebar-menu.svg" left size="md" />
      <span>{{ t(`navEdit.editMenuItems`) }}</span>
      <w-space />
      <transition name="syncing">
        <w-spinner class="mr-2" v-show="state.loading > 0" color="accent" size="24px" />
      </transition>
      <w-btn
        class="mr-2"
        flat
        rounded
        color="white"
        :aria-label="t(`common.actions.viewDocs`)"
        icon="la:question-circle"
        :href="siteStore.docsBase + `/admin/editors/markdown`"
        target="_blank">
        <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
      </w-btn>
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
          :label="t(`common.actions.save`)"
          :aria-label="t(`common.actions.save`)"
          icon="la:check"
          :disabled="state.loading > 0"
          @click="save" />
      </w-btn-group>
    </w-header>
    <w-drawer class="bg-dark-6" :model-value="true" :width="295" dark>
      <w-scroll-area class="nav-edit" :thumb-style="thumbStyle" :bar-style="barStyle">
        <!--
          The `q-list q-list--dense q-list--dark` this carried were the old framework's classes and
          nothing defines them any more, which is why the rows had drifted to full height: the density
          now comes from `dense` on each item, matching what NavSidebar renders.
        -->
        <sortable
          class="nav-edit-list"
          :list="state.items"
          item-key="id"
          :options="sortableOptions"
          @end="updateItemPosition">
          <template #item="{ element }">
            <div
              class="nav-edit-item nav-edit-item-header"
              v-if="element.type === `header`"
              :class="state.selected === element.id ? `is-active` : ``"
              @click="setItem(element)">
              <w-item-label class="text-caption" header>{{ element.label }}</w-item-label>
              <w-space />
              <w-item-section side>
                <w-icon class="handle" name="mdi:drag-horizontal" size="sm" />
              </w-item-section>
            </div>
            <w-item
              class="nav-edit-item nav-edit-item-link"
              v-else-if="element.type === `link`"
              dense
              :class="{ 'is-active': state.selected === element.id, 'is-nested': element.isNested }"
              @click="setItem(element)"
              clickable>
              <w-item-section side><w-icon :name="element.icon" color="white" /></w-item-section>
              <w-item-section class="text-wordbreak-all">{{ element.label }}</w-item-section>
              <w-item-section side>
                <w-icon class="handle" name="mdi:drag-horizontal" size="sm" />
              </w-item-section>
            </w-item>
            <div
              class="nav-edit-item nav-edit-item-separator"
              v-else
              :class="state.selected === element.id ? `is-active` : ``"
              @click="setItem(element)">
              <w-separator dark inset style="flex: 1; margin-top: 11px" />
              <w-item-section side>
                <w-icon class="handle" name="mdi:drag-horizontal" size="sm" />
              </w-item-section>
            </div>
          </template>
        </sortable>
        <div class="p-4 flex">
          <w-btn
            class="acrylic-btn"
            style="flex: 1"
            flat
            color="positive"
            :label="t(`common.actions.add`)"
            :aria-label="t(`common.actions.add`)"
            icon="la:plus-circle">
            <w-menu fit :offset="[0, 10]" auto-close>
              <w-list separator>
                <w-item clickable @click="addItem(`header`)">
                  <w-item-section side><w-icon name="la:heading" /></w-item-section>
                  <w-item-section>
                    <w-item-label>{{ t('navEdit.header') }}</w-item-label>
                  </w-item-section>
                </w-item>
                <w-item clickable @click="addItem(`link`)">
                  <w-item-section side><w-icon name="la:link" /></w-item-section>
                  <w-item-section>
                    <w-item-label>{{ t('navEdit.link') }}</w-item-label>
                  </w-item-section>
                </w-item>
                <w-item clickable @click="addItem(`separator`)">
                  <w-item-section side><w-icon name="la:minus" /></w-item-section>
                  <w-item-section>
                    <w-item-label>{{ t('navEdit.separator') }}</w-item-label>
                  </w-item-section>
                </w-item>
              </w-list>
            </w-menu>
          </w-btn>
          <w-btn
            class="ml-2 acrylic-btn"
            flat
            color="grey"
            :aria-label="t(`common.actions.add`)"
            icon="la:ellipsis-v"
            padding="xs sm">
            <w-menu :offset="[0, 10]" anchor="bottom right" self="top right" auto-close>
              <w-list separator>
                <w-item clickable @click="clearItems" :disable="state.items.length < 1">
                  <w-item-section side>
                    <w-icon name="la:trash-alt" color="negative" />
                  </w-item-section>
                  <w-item-section>
                    <w-item-label>{{ t('navEdit.clearItems') }}</w-item-label>
                  </w-item-section>
                </w-item>
                <!-- q-item(clickable) -->
                <!-- q-item-section(side) -->
                <!-- q-icon(name='mdi:import') -->
                <!-- q-item-section -->
                <!-- q-item-label Copy from... -->
              </w-list>
            </w-menu>
          </w-btn>
        </div>
      </w-scroll-area>
    </w-drawer>
    <w-page-container>
      <w-page class="p-4">
        <template v-if="state.items.length < 1">
          <w-card>
            <w-card-section>
              <w-icon class="mr-2" name="la:arrow-left" size="xs" />
              <span>{{ t('navEdit.emptyMenuText') }}</span>
            </w-card-section>
          </w-card>
        </template>
        <template v-else-if="!state.selected">
          <w-card>
            <w-card-section>
              <w-icon class="mr-2" name="la:arrow-left" size="xs" />
              <span>{{ t('navEdit.noSelection') }}</span>
            </w-card-section>
          </w-card>
        </template>
        <template v-if="state.current.type === `header`">
          <w-card class="pb-2">
            <w-card-section>
              <div class="text-subtitle1">{{ t('navEdit.header') }}</div>
            </w-card-section>
            <w-item>
              <blueprint-icon icon="typography" />
              <w-item-section>
                <w-item-label>{{ t(`navEdit.label`) }}</w-item-label>
                <w-item-label caption>{{ t(`navEdit.labelHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section>
                <w-input
                  outlined
                  v-model="state.current.label"
                  dense
                  hide-bottom-space
                  :aria-label="t(`navEdit.label`)" />
              </w-item-section>
            </w-item>
            <w-item>
              <blueprint-icon icon="user-groups" />
              <w-item-section>
                <w-item-label>{{ t(`navEdit.visibility`) }}</w-item-label>
                <w-item-label caption>{{ t(`navEdit.visibilityHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section avatar>
                <w-btn-toggle
                  v-model="state.current.visibilityLimited"
                  push
                  glossy
                  no-caps
                  toggle-color="primary"
                  :options="visibilityOptions" />
              </w-item-section>
            </w-item>
            <w-item class="items-center" v-if="state.current.visibilityLimited">
              <w-space />
              <div class="text-caption mr-4">{{ t('navEdit.selectGroups') }}</div>
              <w-select
                style="width: 100%; max-width: calc(50% - 34px)"
                outlined
                v-model="state.current.visibilityGroups"
                :options="state.groups"
                option-value="id"
                option-label="name"
                emit-value
                map-options
                dense
                multiple
                :aria-label="t(`navEdit.selectGroups`)" />
            </w-item>
          </w-card>
          <w-card class="p-4 mt-4 flex">
            <w-space />
            <w-btn
              class="acrylic-btn"
              flat
              icon="la:trash-alt"
              :label="t(`common.actions.delete`)"
              color="negative"
              padding="xs md"
              @click="removeItem(state.current.id)" />
          </w-card>
        </template>
        <template v-if="state.current.type === `link`">
          <w-card class="pb-2">
            <w-card-section
              ><div class="text-subtitle1">{{ t('navEdit.link') }}</div></w-card-section
            >
            <w-item>
              <blueprint-icon icon="typography" />
              <w-item-section>
                <w-item-label>{{ t(`navEdit.label`) }}</w-item-label>
                <w-item-label caption>{{ t(`navEdit.labelHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section>
                <w-input
                  outlined
                  v-model="state.current.label"
                  dense
                  hide-bottom-space
                  :aria-label="t(`navEdit.label`)" />
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="spring" />
              <w-item-section>
                <w-item-label>{{ t(`navEdit.icon`) }}</w-item-label>
                <w-item-label caption>{{ t(`navEdit.iconHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section>
                <w-input
                  outlined
                  v-model="state.current.icon"
                  dense
                  :aria-label="t(`navEdit.icon`)">
                  <template #append>
                    <!--
                      A button, not a bare `w-icon`: for a bundled icon WIcon renders an <svg> whose
                      body is set through `v-html`, and that branch renders no slot -- so the menu
                      inside it never existed and the control did nothing. It was also just the glyph,
                      with no hit area of its own. Same fix as the page-properties dialog.
                    -->
                    <w-btn
                      flat
                      dense
                      round
                      icon="la:icons"
                      color="primary"
                      :aria-label="t(`iconPicker.open`)">
                      <w-tooltip>{{ t('iconPicker.open') }}</w-tooltip>
                      <w-menu content-class="shadow-7">
                        <icon-picker-dialog v-model="state.current.icon" />
                      </w-menu>
                    </w-btn>
                  </template>
                </w-input>
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="link" />
              <w-item-section>
                <w-item-label>{{ t(`navEdit.target`) }}</w-item-label>
                <w-item-label caption>{{ t(`navEdit.targetHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section>
                <w-input
                  outlined
                  v-model="state.current.target"
                  dense
                  hide-bottom-space
                  :aria-label="t(`navEdit.target`)">
                  <template #append>
                    <!--
                      Beside the field rather than in place of it: a path someone knows is quicker
                      typed than browsed to, and an external URL has nothing to browse. Same shape as
                      the icon picker's button one row up, for the same reason -- both open a chooser
                      for the field they sit in.
                    -->
                    <w-btn
                      flat
                      dense
                      round
                      icon="la:folder-open"
                      color="primary"
                      :aria-label="t(`common.actions.browse`)"
                      @click="browseTarget">
                      <w-tooltip>{{ t('common.actions.browse') }}</w-tooltip>
                    </w-btn>
                  </template>
                </w-input>
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
            <w-item tag="label">
              <blueprint-icon icon="external-link" />
              <w-item-section>
                <w-item-label>{{ t(`navEdit.openInNewWindow`) }}</w-item-label>
                <w-item-label caption>{{ t(`navEdit.openInNewWindowHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section avatar>
                <w-toggle
                  v-model="state.current.openInNewWindow"
                  color="primary"
                  checked-icon="la:check"
                  unchecked-icon="la:times"
                  :aria-label="t(`navEdit.openInNewWindow`)" />
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="user-groups" />
              <w-item-section>
                <w-item-label>{{ t(`navEdit.visibility`) }}</w-item-label>
                <w-item-label caption>{{ t(`navEdit.visibilityHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section avatar>
                <w-btn-toggle
                  v-model="state.current.visibilityLimited"
                  push
                  glossy
                  no-caps
                  toggle-color="primary"
                  :options="visibilityOptions" />
              </w-item-section>
            </w-item>
            <w-item class="items-center" v-if="state.current.visibilityLimited">
              <w-space />
              <div class="text-caption mr-4">{{ t('navEdit.selectGroups') }}</div>
              <w-select
                style="width: 100%; max-width: calc(50% - 34px)"
                outlined
                v-model="state.current.visibilityGroups"
                :options="state.groups"
                option-value="id"
                option-label="name"
                emit-value
                map-options
                dense
                multiple
                :aria-label="t(`navEdit.selectGroups`)" />
            </w-item>
          </w-card>
          <w-card class="p-4 mt-4 flex items-start">
            <div>
              <w-btn
                class="acrylic-btn"
                v-if="state.current.isNested"
                flat
                :label="t(`navEdit.unnestItem`)"
                icon="mdi:format-indent-decrease"
                color="teal"
                padding="xs md"
                @click="state.current.isNested = false" />
              <w-btn
                class="acrylic-btn"
                v-else
                flat
                :label="t(`navEdit.nestItem`)"
                icon="mdi:format-indent-increase"
                color="teal"
                padding="xs md"
                @click="state.current.isNested = true" />
              <div class="text-caption mt-4 text-grey-7">{{ t('navEdit.nestingWarn') }}</div>
            </div>
            <w-space />
            <w-btn
              class="acrylic-btn"
              flat
              icon="la:trash-alt"
              :label="t(`common.actions.delete`)"
              color="negative"
              padding="xs md"
              @click="removeItem(state.current.id)" />
          </w-card>
        </template>
        <template v-if="state.current.type === `separator`">
          <w-card class="pb-2">
            <w-card-section>
              <div class="text-subtitle1">{{ t('navEdit.separator') }}</div>
            </w-card-section>
            <w-item>
              <blueprint-icon icon="user-groups" />
              <w-item-section>
                <w-item-label>{{ t(`navEdit.visibility`) }}</w-item-label>
                <w-item-label caption>{{ t(`navEdit.visibilityHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section avatar>
                <w-btn-toggle
                  v-model="state.current.visibilityLimited"
                  push
                  glossy
                  no-caps
                  toggle-color="primary"
                  :options="visibilityOptions" />
              </w-item-section>
            </w-item>
            <w-item class="items-center" v-if="state.current.visibilityLimited">
              <w-space />
              <div class="text-caption mr-4">{{ t('navEdit.selectGroups') }}</div>
              <w-select
                style="width: 100%; max-width: calc(50% - 34px)"
                outlined
                v-model="state.current.visibilityGroups"
                :options="state.groups"
                option-value="id"
                option-label="name"
                emit-value
                map-options
                dense
                multiple
                :aria-label="t(`navEdit.selectGroups`)" />
            </w-item>
          </w-card>
          <w-card class="p-4 mt-4 flex">
            <w-space />
            <w-btn
              class="acrylic-btn"
              flat
              icon="la:trash-alt"
              :label="t(`common.actions.delete`)"
              color="negative"
              padding="xs md"
              @click="removeItem(state.current.id)" />
          </w-card>
        </template>
      </w-page>
    </w-page-container>
  </w-layout>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

import { dialog } from '@/composables/dialog'
import { loading } from '@/composables/loading'
import { notify } from '@/composables/notify'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

import { v4 as uuid } from 'uuid'
import { pick } from 'es-toolkit/object'
import { Sortable } from 'sortablejs-vue3'
import IconPickerDialog from '@/components/IconPickerDialog.vue'
import { apiErrorMessage } from '@/helpers/apiError'

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  loading: 0,
  selected: null,
  items: [],
  current: {
    label: '',
    icon: '',
    target: '/',
    openInNewWindow: false,
    visibilityGroups: [],
    visibilityLimited: false,
    isNested: false
  },
  groups: []
})

/**
 * The icon a new link item starts with.
 *
 * An Iconify reference, so that the icon picker opens on its search tab with this one selected, and so
 * that the sidebar draws it through `w-icon` like every other item. Kept to `mdi`, a set seeded on
 * every instance.
 */
const DEFAULT_LINK_ICON = 'mdi:text-box-outline'

const sortableOptions = {
  handle: '.handle',
  animation: 150
}

const visibilityOptions = [
  { value: false, label: t('navEdit.visibilityAll') },
  { value: true, label: t('navEdit.visibilityLimited') }
]

// COMPUTED

/**
 * The menu being edited.
 *
 * The home page edits the site-wide menu — the one every other page inherits — which is why it goes
 * through its resolved id rather than its own. Any other page owns a menu keyed by its own id, which
 * the server creates on the first save.
 */
const navId = computed(() => (pageStore.isHome ? pageStore.navigationId : pageStore.id))

const thumbStyle = {
  right: '2px',
  borderRadius: '5px',
  backgroundColor: '#FFF',
  width: '5px',
  opacity: 0.5
}
const barStyle = {
  backgroundColor: '#000',
  width: '9px',
  opacity: 0.1
}

// METHODS

function setItem(item) {
  state.selected = item.id
  state.current = item
}

/**
 * Picks the link's target: a page of this wiki, or any URL.
 *
 * The same dialog the markdown editor's Insert Link opens, with both of its tabs — a navigation link
 * goes to either, and which one it is is the reader's question rather than this panel's. It opens on
 * whatever the field already holds, so coming back to a link that exists starts from that link.
 *
 * Its "open in a new tab" offer is turned off: this panel asks that one row down and stores the
 * answer, so a second control for it could only disagree with the toggle that is actually saved.
 */
function browseTarget() {
  dialog({
    component: defineAsyncComponent(() => import('./LinkPickerDialog.vue')),
    componentProps: {
      title: t('navEdit.target'),
      okLabel: t('common.actions.select'),
      initialHref: state.current.target,
      newTabOption: false
    }
  }).onOk(({ href }) => {
    state.current.target = href
  })
}

function addItem(type) {
  const newItem = {
    id: uuid(),
    type,
    visibilityGroups: [],
    visibilityLimited: false
  }
  switch (type) {
    case 'header': {
      newItem.label = t('navEdit.header')
      break
    }
    case 'link': {
      newItem.label = t('navEdit.link')
      newItem.icon = DEFAULT_LINK_ICON
      newItem.target = '/'
      newItem.openInNewWindow = false
      newItem.isNested = false
      break
    }
  }
  state.items.push(newItem)
  state.selected = newItem.id
  state.current = newItem
}

function removeItem(id) {
  state.items = state.items.filter((item) => item.id !== id)
  state.selected = null
  state.current = {}
}

function clearItems() {
  state.items = []
  state.selected = null
  state.current = {}
}

function updateItemPosition(ev) {
  const item = state.items.splice(ev.oldIndex, 1)[0]
  state.items.splice(ev.newIndex, 0, item)
}

function close() {
  siteStore.$patch({ overlay: '' })
}

async function loadGroups() {
  state.loading++
  try {
    const groups = await API_CLIENT.get('groups').json()
    state.groups = (groups ?? []).map((g) => ({ id: g.id, name: g.name }))
  } catch (err) {
    // -> Without the list, per-group visibility cannot be set, but the rest of the editor still works
    notify({
      type: 'warning',
      message: t('navEdit.groupsFailed'),
      caption: apiErrorMessage(err, 'An unexpected error occured.')
    })
  }
  state.loading--
}

async function loadMenuItems() {
  state.loading++
  loading.show()
  try {
    // -> `full`, because the editor has to see items limited to groups the editor is not in: saving
    //    without them would delete them
    const items = await API_CLIENT.get(`sites/${siteStore.id}/navigation/${navId.value}`, {
      searchParams: { full: true }
    }).json()
    for (const item of items ?? []) {
      state.items.push({
        ...pick(item, [
          'id',
          'type',
          'label',
          'icon',
          'target',
          'openInNewWindow',
          'visibilityGroups'
        ]),
        visibilityLimited: item.visibilityGroups?.length > 0
      })
      for (const child of item?.children ?? []) {
        state.items.push({
          ...pick(child, [
            'id',
            'type',
            'label',
            'icon',
            'target',
            'openInNewWindow',
            'visibilityGroups'
          ]),
          visibilityLimited: child.visibilityGroups?.length > 0,
          isNested: true
        })
      }
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: apiErrorMessage(err, 'An unexpected error occured.')
    })
    close()
  }
  loading.hide()
  state.loading--
}

function cleanMenuItem(item, isNested = false) {
  switch (item.type) {
    case 'header': {
      return {
        ...pick(item, ['id', 'type', 'label']),
        visibilityGroups: item.visibilityLimited ? item.visibilityGroups : []
      }
    }
    case 'link': {
      return {
        ...pick(item, ['id', 'type', 'label', 'icon', 'target', 'openInNewWindow']),
        visibilityGroups: item.visibilityLimited ? item.visibilityGroups : [],
        ...(!isNested && { children: [] })
      }
    }
    case 'separator': {
      return {
        ...pick(item, ['id', 'type', 'label', 'icon', 'target', 'openInNewWindow']),
        visibilityGroups: item.visibilityLimited ? item.visibilityGroups : []
      }
    }
  }
}

async function save() {
  state.loading++
  loading.show()
  try {
    const items = []
    for (const item of state.items) {
      if (item.isNested) {
        if (items.length < 1 || items.at(-1)?.type !== 'link') {
          throw new Error('One or more nested link items are not under a parent link!')
        }
        items[items.length - 1].children.push(cleanMenuItem(item, true))
      } else {
        items.push(cleanMenuItem(item))
      }
    }

    // -> The mode goes with the items: saving a menu for a page that only inherits would store items
    //    nothing points at
    const resp = await API_CLIENT.put(`sites/${siteStore.id}/navigation/pages/${pageStore.id}`, {
      json: {
        mode: siteStore.overlayOpts.mode ?? pageStore.navigationMode,
        items
      }
    }).json()
    // -> The API client does not throw on 400, so a refusal comes back as a parsed error
    if (resp?.ok === false) {
      throw new Error(resp.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('navEdit.saveSuccess')
    })
    pageStore.$patch({
      navigationMode: resp.navigationMode,
      navigationId: resp.navigationId ?? null
    })
    // -> Redraw the sidebar from what was just saved, rather than waiting for a navigation
    await siteStore.fetchNavigation(resp.navigationId ?? navId.value)
    close()
  } catch (err) {
    notify({
      type: 'negative',
      message: apiErrorMessage(err, 'An unexpected error occured.')
    })
  }
  loading.hide()
  state.loading--
}

onMounted(() => {
  loadMenuItems()
  loadGroups()
})

onBeforeUnmount(() => {
  siteStore.overlayOpts = {}
})
</script>

<style lang="scss" scoped>
@use 'sass:color';

/*
  Light ink on an always-dark surface.

  This drawer is dark whatever the site theme is, but the shared components' own dark treatments are
  `dark:` variants -- keyed off `body.body--dark`, i.e. the APP theme. On a light-themed site their
  light-mode colours therefore applied here: `WItemLabel`'s header variant resolved to black at 54%
  and `WItemSection`'s side variant likewise, which on `dark-6` is invisible. WDrawer's `dark` prop
  covers plain inherited text, not a component that states a colour of its own, so each one that does
  is restated here at the value its dark variant would have used.
*/
.nav-edit {
  height: 100%;

  .handle {
    cursor: grab;
    color: rgba(255, 255, 255, 0.7);
  }

  /*
    Same padding NavSidebar gives its own headings: `WItemLabel`'s uniform `p-4` made this row 52px
    against the sidebar's 40px, so a heading looked considerably heavier here than the thing being
    edited.
  */
  .w-item-label--header {
    color: rgba(255, 255, 255, 0.7);
    padding-bottom: 4px;
  }

  /* -> A rule between nav items is content here, not trim: 15% white is too faint to aim at */
  .nav-edit-item-separator .w-separator {
    --w-hairline-color: rgb(255 255 255 / 0.32);
  }
}

.nav-edit-item {
  position: relative;
  &.is-active {
    background-color: $blue-8;
  }

  &.sortable-chosen {
    background-color: $blue-5;
  }
}

.nav-edit-item-header {
  display: flex;
  cursor: pointer;
}
.nav-edit-item-link {
  &.is-nested {
    border-left: 10px solid $dark-1;
    background-color: $dark-4;
    &.is-active {
      background-color: $primary;
    }

    & + div:not(.is-nested) {
      &::before {
        content: '';
        display: 'block';
        position: absolute;
        top: 0;
        left: 0;
        width: 10px;
        height: 10px;
        border-style: solid;
        border-color: $dark-1 transparent transparent $dark-1;
        border-width: 10px 10px 10px 0;
      }
    }
  }

  &:not(.is-nested) + &.is-nested {
    &::before {
      content: '';
      display: 'block';
      position: absolute;
      top: -10px;
      left: -10px;
      width: 10px;
      height: 10px;
      border-style: solid;
      border-color: transparent transparent $dark-1 $dark-1;
      border-width: 0 10px 10px 0;
    }
  }
}
.nav-edit-item-separator {
  display: flex;
  cursor: pointer;
}

.nav-edit-item-header,
.nav-edit-item-separator {
  & + .nav-edit-item-link.is-nested {
    background-color: $negative !important;
    border-left-color: color.adjust($negative, $lightness: -10%) !important;

    & + div:not(.is-nested) {
      &::before {
        display: none !important;
      }
    }
  }
}

.nav-edit-list {
  .nav-edit-item-separator + .nav-edit-item-header > .w-item-label {
    padding-top: 8px;
  }

  .is-nested:first-child {
    background-color: $negative !important;
    border-left-color: color.adjust($negative, $lightness: -10%) !important;

    & + div:not(.is-nested) {
      &::before {
        display: none !important;
      }
    }
  }
}
</style>
