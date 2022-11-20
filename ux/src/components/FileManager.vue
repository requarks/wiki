<template lang="pug">
q-layout(view='hHh lpR lFr', container)
  q-header.card-header
    q-toolbar(dark)
      q-icon(name='img:/_assets/icons/fluent-folder.svg', left, size='md')
      span {{t(`fileman.title`)}}
    q-toolbar(dark)
      q-input(
        dark
        v-model='state.search'
        standout='bg-white text-dark'
        dense
        ref='searchField'
        style='width: 100%;'
        label='Search folder...'
        )
        template(v-slot:prepend)
          q-icon(name='las la-search')
        template(v-slot:append)
          q-icon.cursor-pointer(
            name='las la-times'
            @click='state.search=``'
            v-if='state.search.length > 0'
            :color='$q.dark.isActive ? `blue` : `grey-4`'
            )
    q-toolbar(dark)
      q-space
      q-btn(
        flat
        dense
        color='white'
        :label='t(`common.actions.close`)'
        :aria-label='t(`common.actions.close`)'
        icon='las la-times'
        @click='close'
        )
        q-tooltip(anchor='bottom middle', self='top middle') {{t(`common.actions.close`)}}
  q-drawer.bg-blue-grey-1(:model-value='true', :width='350')
    .q-px-md.q-pb-sm
      tree(
        :nodes='state.treeNodes'
        :roots='state.treeRoots'
        v-model:selected='state.currentFolderId'
      )
  q-drawer.bg-grey-1(:model-value='true', :width='350', side='right')
    .q-pa-md
      q-img.rounded-borders(
        src='https://picsum.photos/id/134/340/340'
        width='100%'
        fit='cover'
        :ratio='16/10'
      )
  q-page-container
    q-page.bg-white
      q-toolbar.bg-grey-1
        q-space
        q-btn.q-mr-sm(
          flat
          dense
          no-caps
          color='grey'
          :aria-label='t(`common.actions.refresh`)'
          icon='las la-redo-alt'
          @click=''
          )
          q-tooltip(anchor='bottom middle', self='top middle') {{t(`common.actions.refresh`)}}
        q-separator.q-mr-sm(inset, vertical)
        q-btn.q-mr-sm(
          flat
          dense
          no-caps
          color='blue'
          :label='t(`common.actions.new`)'
          :aria-label='t(`common.actions.new`)'
          icon='las la-plus-circle'
          @click=''
          )
          new-menu(hide-asset-btn)
        q-btn(
          flat
          dense
          no-caps
          color='positive'
          :label='t(`common.actions.upload`)'
          :aria-label='t(`common.actions.upload`)'
          icon='las la-cloud-upload-alt'
          @click=''
          )
      q-list.fileman-filelist
        q-item(clickable)
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-folder.svg', size='xl')
          q-item-section
            q-item-label Beep Boop
            q-item-label(caption) 19 Items
          q-item-section(side)
            .text-caption 1
        q-item(clickable)
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/fluent-folder.svg', size='xl')
          q-item-section
            q-item-label Beep Boop
            q-item-label(caption) 19 Items
          q-item-section(side)
            .text-caption 1
        q-item(clickable)
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/color-document.svg', size='xl')
          q-item-section
            q-item-label Beep Boop
            q-item-label(caption) Markdown
          q-item-section(side)
            .text-caption 1
        q-item(clickable)
          q-item-section(avatar)
            q-icon(name='img:/_assets/icons/color-pdf.svg', size='xl')
          q-item-section
            q-item-label Beep Boop
            q-item-label(caption) 4 pages
          q-item-section(side)
            .text-caption 2022/01/01

  q-footer
    q-bar.bg-blue-grey-1
      small.text-caption.text-grey-7 / foo / bar
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { reactive } from 'vue'

import NewMenu from './PageNewMenu.vue'
import Tree from './TreeNav.vue'

import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  loading: 0,
  search: '',
  currentFolderId: 'boop',
  treeNodes: {
    beep: {
      text: 'Beep',
      children: ['foo', 'bar']
    },
    foo: {
      text: 'Foo'
    },
    bar: {
      text: 'Bar',
      children: ['boop']
    },
    boop: {
      text: 'Boop'
    },
    bop: {
      text: 'Bop',
      children: ['bap']
    },
    bap: {
      text: 'Bap'
    }
  },
  treeRoots: ['beep', 'bop']
})

// METHODS

function close () {
  siteStore.overlay = null
}

function openFolder (node, noder) {
  console.info(node, noder)
}

</script>

<style lang="scss">
.fileman {
  &-filelist {
    padding: 8px 12px;

    > .q-item {
      padding: 8px 6px;
      border-radius: 8px;
    }
  }
}
</style>
