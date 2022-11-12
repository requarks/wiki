<template lang="pug">
q-layout(view='hHh lpR fFf', container)
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
      q-btn.q-mr-sm(
        flat
        dense
        color='blue-4'
        :aria-label='t(`common.actions.upload`)'
        icon='las la-plus-circle'
        @click=''
        )
        q-tooltip(anchor='bottom middle', self='top middle') {{t(`common.actions.upload`)}}
      q-btn(
        flat
        dense
        color='positive'
        :aria-label='t(`common.actions.upload`)'
        icon='las la-cloud-upload-alt'
        @click=''
        )
        q-tooltip(anchor='bottom middle', self='top middle') {{t(`common.actions.upload`)}}
      q-separator.q-mx-sm(vertical, dark, inset)
      q-btn.q-mr-sm(
        flat
        dense
        color='blue-grey-4'
        :aria-label='t(`common.actions.upload`)'
        icon='las la-check-square'
        @click=''
        )
        q-tooltip(anchor='bottom middle', self='top middle') {{t(`common.actions.upload`)}}
      q-btn.q-mr-sm(
        flat
        dense
        color='blue-grey-4'
        :aria-label='t(`common.actions.upload`)'
        icon='las la-list'
        @click=''
        )
        q-tooltip(anchor='bottom middle', self='top middle') {{t(`common.actions.upload`)}}
      q-btn(
        flat
        dense
        color='blue-grey-4'
        :aria-label='t(`common.actions.refresh`)'
        icon='las la-redo-alt'
        @click=''
        :loading='state.loading > 0'
        )
        q-tooltip(anchor='bottom middle', self='top middle') {{t(`common.actions.refresh`)}}
      q-separator.q-mx-sm(vertical, dark, inset)
      q-btn(
        flat
        dense
        color='white'
        :aria-label='t(`common.actions.close`)'
        icon='las la-times'
        @click='close'
        )
        q-tooltip(anchor='bottom middle', self='top middle') {{t(`common.actions.close`)}}
  q-drawer.bg-blue-grey-1(:model-value='true', :width='350')
    q-list(padding, v-if='state.loading < 1')
  q-drawer.bg-grey-1(:model-value='true', :width='350', side='right')
    q-list(padding, v-if='state.loading < 1')
  q-page-container
    q-page.bg-white
      q-bar.bg-grey-1
        small.text-caption.text-grey-7 / foo / bar
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

</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { reactive } from 'vue'

import { useSiteStore } from 'src/stores/site'

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  loading: 0,
  search: ''
})

// METHODS

function close () {
  siteStore.overlay = null
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
