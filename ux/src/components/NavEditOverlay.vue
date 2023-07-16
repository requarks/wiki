<template lang="pug">
q-layout(view='hHh lpR fFf', container)
  q-header.card-header.q-px-md.q-py-sm
    q-icon(name='img:/_assets/icons/fluent-sidebar-menu.svg', left, size='md')
    span {{t(`navEdit.editMenuItems`)}}
    q-space
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
              q-icon(:name='element.icon', color='white')
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

      .q-pa-md
        q-btn.full-width.acrylic-btn(
          flat
          color='positive'
          :label='t(`common.actions.add`)'
          :aria-label='t(`common.actions.add`)'
          icon='las la-plus-circle'
          )
          q-menu(fit, :offset='[0, 10]')
            q-list(separator)
              q-item(clickable)
                q-item-section(side)
                  q-icon(name='las la-heading')
                q-item-section
                  q-item-label Header
              q-item(clickable)
                q-item-section(side)
                  q-icon(name='las la-link')
                q-item-section
                  q-item-label {{t('navEdit.link')}}
              q-item(clickable)
                q-item-section(side)
                  q-icon(name='las la-minus')
                q-item-section
                  q-item-label Separator
              q-item(clickable, style='border-top-width: 5px;')
                q-item-section(side)
                  q-icon(name='mdi-import')
                q-item-section
                  q-item-label Copy from...

  q-page-container
    q-page.q-pa-md
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
        q-card.q-pa-md.q-mt-md.flex
          q-space
          q-btn.acrylic-btn(
            flat
            :label='t(`common.actions.delete`)'
            color='negative'
            padding='xs md'
            @click=''
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
          q-item(v-if='state.current.visibilityLimited')
            q-item-section
            q-item-section
              q-select(
                outlined
                v-model='state.current.visibility'
                :options='state.groups'
                option-value='value'
                option-label='label'
                emit-value
                map-options
                dense
                options-dense
                :virtual-scroll-slice-size='1000'
                :aria-label='t(`admin.general.uploadConflictBehavior`)'
                )

        q-card.q-pa-md.q-mt-md.flex
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
          q-space
          q-btn.acrylic-btn(
            flat
            :label='t(`common.actions.delete`)'
            color='negative'
            padding='xs md'
            @click=''
          )

      template(v-if='state.current.type === `separator`')
        q-card
          q-card-section
            .text-subtitle1 {{t('navEdit.separator')}}
        q-card.q-pa-md.q-mt-md.flex
          q-space
          q-btn.acrylic-btn(
            flat
            :label='t(`common.actions.delete`)'
            color='negative'
            padding='xs md'
            @click=''
          )

</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { onMounted, reactive, ref } from 'vue'
import gql from 'graphql-tag'
import { cloneDeep } from 'lodash-es'

import { useSiteStore } from 'src/stores/site'

import { Sortable } from 'sortablejs-vue3'

// QUASAR

const $q = useQuasar()

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  loading: 0,
  selected: '3',
  items: [
    {
      id: '1',
      type: 'header',
      label: 'General'
    },
    {
      id: '2',
      type: 'link',
      label: 'Dogs',
      icon: 'las la-dog'
    },
    {
      id: '3',
      type: 'link',
      label: 'Cats',
      icon: 'las la-cat'
    },
    {
      id: '4',
      type: 'separator'
    },
    {
      id: '5',
      type: 'header',
      label: 'User Guide'
    },
    {
      id: '6',
      type: 'link',
      label: 'Editing Pages',
      icon: 'las la-file-alt'
    },
    {
      id: '7',
      type: 'link',
      label: 'Permissions',
      icon: 'las la-key',
      isNested: true
    },
    {
      id: '8',
      type: 'link',
      label: 'Supersuperlongtitleveryveryversupersupersupersupersuper long word',
      icon: 'las la-key'
    },
    {
      id: '9',
      type: 'link',
      label: 'Users',
      icon: 'las la-users'
    },
    {
      id: '10',
      type: 'link',
      label: 'Locales',
      icon: 'las la-globe'
    }
  ],
  current: {
    label: '',
    icon: '',
    target: '/',
    openInNewWindow: false,
    visibility: [],
    visibilityLimited: false,
    isNested: false
  },
  groups: []
})

const sortableOptions = {
  handle: '.handle',
  animation: 150
}

const visibilityOptions = [
  { value: false, label: t('navEdit.visibilityAll') },
  { value: true, label: t('navEdit.visibilityLimited') }
]

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

function close () {
  siteStore.$patch({ overlay: '' })
}

onMounted(() => {

})
</script>

<style lang="scss" scoped>
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
    border-left-color: darken($negative, 10%) !important;

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
    border-left-color: darken($negative, 10%) !important;

    & + div:not(.is-nested) {
      &::before {
        display: none !important;
      }
    }
  }
}
</style>
