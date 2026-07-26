<template lang="pug">
q-layout(view='hHh lpR fFf', container)
  q-header.card-header.q-px-md.q-py-sm
    q-icon(name='img:/_assets/icons/fluent-sidebar-menu.svg', left, size='md')
    span {{t(`navEdit.editMenuItems`)}}
    q-space
    transition(name='syncing')
      q-spinner-tail.q-mr-sm(
        v-show='state.loading > 0'
        color='accent'
        size='24px'
      )
    q-btn.q-mr-sm(
      flat
      rounded
      color='white'
      :aria-label='t(`common.actions.viewDocs`)'
      icon='las la-question-circle'
      :href='siteStore.docsBase + `/admin/editors/markdown`'
      target='_blank'
      type='a'
    )
    q-btn-group(push)
      q-btn(
        push
        color='white'
        text-color='grey-7'
        :label='t(`common.actions.cancel`)'
        :aria-label='t(`common.actions.cancel`)'
        icon='las la-times'
        @click='close'
      )
      q-btn(
        push
        color='positive'
        text-color='white'
        :label='t(`common.actions.save`)'
        :aria-label='t(`common.actions.save`)'
        icon='las la-check'
        :disabled='state.loading > 0'
        @click='save'
      )

  q-drawer.bg-dark-6(:model-value='true', :width='295', dark)
    q-scroll-area.nav-edit(
      :thumb-style='thumbStyle'
      :bar-style='barStyle'
      )
      sortable(
        class='q-list q-list--dense q-list--dark nav-edit-list'
        :list='state.items'
        item-key='id'
        :options='sortableOptions'
        @end='updateItemPosition'
        )
        template(#item='{element}')
          .nav-edit-item.nav-edit-item-header(
            v-if='element.type === `header`'
            :class='state.selected === element.id ? `is-active` : ``'
            @click='setItem(element)'
            )
            q-item-label.text-caption(
              header
              ) {{ element.label }}
            q-space
            q-item-section(side)
              q-icon.handle(name='mdi-drag-horizontal', size='sm')
          q-item.nav-edit-item.nav-edit-item-link(
            v-else-if='element.type === `link`'
            :class='{ "is-active": state.selected === element.id, "is-nested": element.isNested }'
            @click='setItem(element)'
            clickable
            )
            q-item-section(side)
              wiki-icon(:name='element.icon', color='white')
            q-item-section.text-wordbreak-all {{ element.label }}
            q-item-section(side)
              q-icon.handle(name='mdi-drag-horizontal', size='sm')
          .nav-edit-item.nav-edit-item-separator(
            v-else
            :class='state.selected === element.id ? `is-active` : ``'
            @click='setItem(element)'
            )
            q-separator(
              dark
              inset
              style='flex: 1; margin-top: 11px;'
              )
            q-item-section(side)
              q-icon.handle(name='mdi-drag-horizontal', size='sm')

      .q-pa-md.flex
        q-btn.acrylic-btn(
          style='flex: 1;'
          flat
          color='positive'
          :label='t(`common.actions.add`)'
          :aria-label='t(`common.actions.add`)'
          icon='las la-plus-circle'
          )
          q-menu(fit, :offset='[0, 10]', auto-close)
            q-list(separator)
              q-item(clickable, @click='addItem(`header`)')
                q-item-section(side)
                  q-icon(name='las la-heading')
                q-item-section
                  q-item-label {{t('navEdit.header')}}
              q-item(clickable, @click='addItem(`link`)')
                q-item-section(side)
                  q-icon(name='las la-link')
                q-item-section
                  q-item-label {{t('navEdit.link')}}
              q-item(clickable, @click='addItem(`separator`)')
                q-item-section(side)
                  q-icon(name='las la-minus')
                q-item-section
                  q-item-label {{t('navEdit.separator')}}
        q-btn.q-ml-sm.acrylic-btn(
          flat
          color='grey'
          :aria-label='t(`common.actions.add`)'
          icon='las la-ellipsis-v'
          padding='xs sm'
          )
          q-menu(:offset='[0, 10]' anchor='bottom right' self='top right' auto-close)
            q-list(separator)
              q-item(clickable, @click='clearItems', :disable='state.items.length < 1')
                q-item-section(side)
                  q-icon(name='las la-trash-alt', color='negative')
                q-item-section
                  q-item-label {{t('navEdit.clearItems')}}
              //- q-item(clickable)
              //-   q-item-section(side)
              //-     q-icon(name='mdi-import')
              //-   q-item-section
              //-     q-item-label Copy from...

  q-page-container
    q-page.q-pa-md
      template(v-if='state.items.length < 1')
        q-card
          q-card-section
            q-icon.q-mr-sm(name='las la-arrow-left', size='xs')
            span {{ t('navEdit.emptyMenuText') }}
      template(v-else-if='!state.selected')
        q-card
          q-card-section
            q-icon.q-mr-sm(name='las la-arrow-left', size='xs')
            span {{ t('navEdit.noSelection') }}

      template(v-if='state.current.type === `header`')
        q-card.q-pb-sm
          q-card-section
            .text-subtitle1 {{t('navEdit.header')}}
          q-item
            blueprint-icon(icon='typography')
            q-item-section
              q-item-label {{t(`navEdit.label`)}}
              q-item-label(caption) {{t(`navEdit.labelHint`)}}
            q-item-section
              q-input(
                outlined
                v-model='state.current.label'
                dense
                hide-bottom-space
                :aria-label='t(`navEdit.label`)'
                )
          q-item
            blueprint-icon(icon='user-groups')
            q-item-section
              q-item-label {{t(`navEdit.visibility`)}}
              q-item-label(caption) {{t(`navEdit.visibilityHint`)}}
            q-item-section(avatar)
              q-btn-toggle(
                v-model='state.current.visibilityLimited'
                push
                glossy
                no-caps
                toggle-color='primary'
                :options='visibilityOptions'
              )
          q-item.items-center(v-if='state.current.visibilityLimited')
            q-space
            .text-caption.q-mr-md {{ t('navEdit.selectGroups') }}
            q-select(
              style='width: 100%; max-width: calc(50% - 34px);'
              outlined
              v-model='state.current.visibilityGroups'
              :options='state.groups'
              option-value='id'
              option-label='name'
              emit-value
              map-options
              dense
              multiple
              :aria-label='t(`navEdit.selectGroups`)'
              )
        q-card.q-pa-md.q-mt-md.flex
          q-space
          q-btn.acrylic-btn(
            flat
            icon='las la-trash-alt'
            :label='t(`common.actions.delete`)'
            color='negative'
            padding='xs md'
            @click='removeItem(state.current.id)'
          )

      template(v-if='state.current.type === `link`')
        q-card.q-pb-sm
          q-card-section
            .text-subtitle1 {{t('navEdit.link')}}
          q-item
            blueprint-icon(icon='typography')
            q-item-section
              q-item-label {{t(`navEdit.label`)}}
              q-item-label(caption) {{t(`navEdit.labelHint`)}}
            q-item-section
              q-input(
                outlined
                v-model='state.current.label'
                dense
                hide-bottom-space
                :aria-label='t(`navEdit.label`)'
                )
          q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='spring')
            q-item-section
              q-item-label {{t(`navEdit.icon`)}}
              q-item-label(caption) {{t(`navEdit.iconHint`)}}
            q-item-section
              q-input(
                outlined
                v-model='state.current.icon'
                dense
                :aria-label='t(`navEdit.icon`)'
                )
                template(#append)
                  q-icon.cursor-pointer(
                    name='las la-icons'
                    color='primary'
                    )
                    q-menu(content-class='shadow-7')
                      icon-picker-dialog(v-model='state.current.icon')
          q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='link')
            q-item-section
              q-item-label {{t(`navEdit.target`)}}
              q-item-label(caption) {{t(`navEdit.targetHint`)}}
            q-item-section
              q-input(
                outlined
                v-model='state.current.target'
                dense
                hide-bottom-space
                :aria-label='t(`navEdit.target`)'
                )
          q-separator.q-my-sm(inset)
          q-item(tag='label')
            blueprint-icon(icon='external-link')
            q-item-section
              q-item-label {{t(`navEdit.openInNewWindow`)}}
              q-item-label(caption) {{t(`navEdit.openInNewWindowHint`)}}
            q-item-section(avatar)
              q-toggle(
                v-model='state.current.openInNewWindow'
                color='primary'
                checked-icon='las la-check'
                unchecked-icon='las la-times'
                :aria-label='t(`navEdit.openInNewWindow`)'
                )
          q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='user-groups')
            q-item-section
              q-item-label {{t(`navEdit.visibility`)}}
              q-item-label(caption) {{t(`navEdit.visibilityHint`)}}
            q-item-section(avatar)
              q-btn-toggle(
                v-model='state.current.visibilityLimited'
                push
                glossy
                no-caps
                toggle-color='primary'
                :options='visibilityOptions'
              )
          q-item.items-center(v-if='state.current.visibilityLimited')
            q-space
            .text-caption.q-mr-md {{ t('navEdit.selectGroups') }}
            q-select(
              style='width: 100%; max-width: calc(50% - 34px);'
              outlined
              v-model='state.current.visibilityGroups'
              :options='state.groups'
              option-value='id'
              option-label='name'
              emit-value
              map-options
              dense
              multiple
              :aria-label='t(`navEdit.selectGroups`)'
              )

        q-card.q-pa-md.q-mt-md.flex.items-start
          div
            q-btn.acrylic-btn(
              v-if='state.current.isNested'
              flat
              :label='t(`navEdit.unnestItem`)'
              icon='mdi-format-indent-decrease'
              color='teal'
              padding='xs md'
              @click='state.current.isNested = false'
            )
            q-btn.acrylic-btn(
              v-else
              flat
              :label='t(`navEdit.nestItem`)'
              icon='mdi-format-indent-increase'
              color='teal'
              padding='xs md'
              @click='state.current.isNested = true'
            )
            .text-caption.q-mt-md.text-grey-7 {{ t('navEdit.nestingWarn') }}
          q-space
          q-btn.acrylic-btn(
            flat
            icon='las la-trash-alt'
            :label='t(`common.actions.delete`)'
            color='negative'
            padding='xs md'
            @click='removeItem(state.current.id)'
          )

      template(v-if='state.current.type === `separator`')
        q-card.q-pb-sm
          q-card-section
            .text-subtitle1 {{t('navEdit.separator')}}
          q-item
            blueprint-icon(icon='user-groups')
            q-item-section
              q-item-label {{t(`navEdit.visibility`)}}
              q-item-label(caption) {{t(`navEdit.visibilityHint`)}}
            q-item-section(avatar)
              q-btn-toggle(
                v-model='state.current.visibilityLimited'
                push
                glossy
                no-caps
                toggle-color='primary'
                :options='visibilityOptions'
              )
          q-item.items-center(v-if='state.current.visibilityLimited')
            q-space
            .text-caption.q-mr-md {{ t('navEdit.selectGroups') }}
            q-select(
              style='width: 100%; max-width: calc(50% - 34px);'
              outlined
              v-model='state.current.visibilityGroups'
              :options='state.groups'
              option-value='id'
              option-label='name'
              emit-value
              map-options
              dense
              multiple
              :aria-label='t(`navEdit.selectGroups`)'
              )
        q-card.q-pa-md.q-mt-md.flex
          q-space
          q-btn.acrylic-btn(
            flat
            icon='las la-trash-alt'
            :label='t(`common.actions.delete`)'
            color='negative'
            padding='xs md'
            @click='removeItem(state.current.id)'
          )

</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { v4 as uuid } from 'uuid'

import { pick } from 'es-toolkit/object'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

import { Sortable } from 'sortablejs-vue3'

import IconPickerDialog from '@/components/IconPickerDialog.vue'

// QUASAR

const $q = useQuasar()

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
 * that the sidebar draws it through `wiki-icon` like every other item. Kept to `mdi`, a set seeded on
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

function setItem (item) {
  state.selected = item.id
  state.current = item
}

function addItem (type) {
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

function removeItem (id) {
  state.items = state.items.filter(item => item.id !== id)
  state.selected = null
  state.current = {}
}

function clearItems () {
  state.items = []
  state.selected = null
  state.current = {}
}

function updateItemPosition (ev) {
  const item = state.items.splice(ev.oldIndex, 1)[0]
  state.items.splice(ev.newIndex, 0, item)
}

function close () {
  siteStore.$patch({ overlay: '' })
}

/**
 * The message an API failure should be reported with — the server's own if it sent one, since ky
 * throws before the caller ever sees the body.
 */
async function apiErrorMessage (err) {
  const message = await err.response?.json().then(b => b?.message).catch(() => null)
  return message || err.message || 'An unexpected error occured.'
}

async function loadGroups () {
  state.loading++
  try {
    const groups = await API_CLIENT.get('groups').json()
    state.groups = (groups ?? []).map(g => ({ id: g.id, name: g.name }))
  } catch (err) {
    // -> Without the list, per-group visibility cannot be set, but the rest of the editor still works
    $q.notify({
      type: 'warning',
      message: t('navEdit.groupsFailed'),
      caption: await apiErrorMessage(err)
    })
  }
  state.loading--
}

async function loadMenuItems () {
  state.loading++
  $q.loading.show()
  try {
    // -> `full`, because the editor has to see items limited to groups the editor is not in: saving
    //    without them would delete them
    const items = await API_CLIENT.get(
      `sites/${siteStore.id}/navigation/${navId.value}`,
      { searchParams: { full: true } }
    ).json()
    for (const item of items ?? []) {
      state.items.push({
        ...pick(item, ['id', 'type', 'label', 'icon', 'target', 'openInNewWindow', 'visibilityGroups']),
        visibilityLimited: item.visibilityGroups?.length > 0
      })
      for (const child of (item?.children ?? [])) {
        state.items.push({
          ...pick(child, ['id', 'type', 'label', 'icon', 'target', 'openInNewWindow', 'visibilityGroups']),
          visibilityLimited: child.visibilityGroups?.length > 0,
          isNested: true
        })
      }
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: await apiErrorMessage(err)
    })
    close()
  }
  $q.loading.hide()
  state.loading--
}

function cleanMenuItem (item, isNested = false) {
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
        ...!isNested && { children: [] }
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

async function save () {
  state.loading++
  $q.loading.show()
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
    const resp = await API_CLIENT.put(
      `sites/${siteStore.id}/navigation/pages/${pageStore.id}`,
      {
        json: {
          mode: siteStore.overlayOpts.mode ?? pageStore.navigationMode,
          items
        }
      }
    ).json()
    // -> The API client does not throw on 400, so a refusal comes back as a parsed error
    if (resp?.ok === false) {
      throw new Error(resp.message || 'An unexpected error occured.')
    }
    $q.notify({
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
    $q.notify({
      type: 'negative',
      message: await apiErrorMessage(err)
    })
  }
  $q.loading.hide()
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

.nav-edit {
  height: 100%;

  .handle {
    cursor: grab;
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

.nav-edit-item-header, .nav-edit-item-separator {
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
  .nav-edit-item-separator + .nav-edit-item-header > .q-item__label {
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
