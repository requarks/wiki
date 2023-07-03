<template lang="pug">
q-layout(view='hHh Lpr lff')
  header-nav
  q-page-container.layout-search
    .layout-search-card
      .layout-search-sd
        .text-header {{ t('search.sortBy') }}
        q-list(dense, padding)
          q-item(clickable, active)
            q-item-section(side)
              q-icon(name='las la-stream', color='primary')
            q-item-section
              q-item-label Relevance
            q-item-section(side)
              q-icon(name='mdi-chevron-double-down', size='sm', color='primary')
          q-item(clickable)
            q-item-section(side)
              q-icon(name='las la-heading')
            q-item-section Title
          q-item(clickable)
            q-item-section(side)
              q-icon(name='las la-calendar')
            q-item-section Last Updated
        .text-header {{ t('search.filters') }}
        .q-pa-sm
          q-input(
            outlined
            dense
            placeholder='Path starting with...'
            prefix='/'
            v-model='state.filterPath'
            )
            template(v-slot:prepend)
              q-icon(name='las la-caret-square-right', size='xs')
          q-input.q-mt-sm(
            outlined
            dense
            placeholder='Tags'
            )
            template(v-slot:prepend)
              q-icon(name='las la-hashtag', size='xs')
          q-input.q-mt-sm(
            outlined
            dense
            placeholder='Last updated...'
            )
            template(v-slot:prepend)
              q-icon(name='las la-calendar', size='xs')
          q-input.q-mt-sm(
            outlined
            dense
            placeholder='Last edited by...'
            )
            template(v-slot:prepend)
              q-icon(name='las la-user-edit', size='xs')
          q-select.q-mt-sm(
            outlined
            v-model='state.filterLocale'
            emit-value
            map-options
            dense
            :aria-label='t(`admin.groups.ruleLocales`)'
            :options='siteStore.locales.active'
            option-value='code'
            option-label='name'
            multiple
            :display-value='t(`admin.groups.selectedLocales`, { n: state.filterLocale.length > 0 ? state.filterLocale[0].toUpperCase() : state.filterLocale.length }, state.filterLocale.length)'
            )
            template(v-slot:prepend)
              q-icon(name='las la-language', size='xs')
          q-select.q-mt-sm(
            outlined
            v-model='state.filterEditor'
            emit-value
            map-options
            dense
            aria-label='Editor'
            :options='editors'
            )
            template(v-slot:prepend)
              q-icon(name='las la-pen-nib', size='xs')
          q-select.q-mt-sm(
            outlined
            v-model='state.filterPublishState'
            emit-value
            map-options
            dense
            aria-label='Publish State'
            :options='publishStates'
            )
            template(v-slot:prepend)
              q-icon(name='las la-traffic-light', size='xs')
      q-page(:style-fn='pageStyle')
        .text-header.flex
          span {{t('search.results')}}
          q-space
          span.text-caption #[strong 12] results
        q-list(separator, padding)
          q-item(v-for='item of 12', clickable)
            q-item-section(avatar)
              q-avatar(color='primary' text-color='white' rounded icon='las la-file-alt')
            q-item-section
              q-item-label Page ABC def {{ item }}
              q-item-label(caption) Lorem ipsum beep boop foo bar
              q-item-label(caption) ...Abc def #[span.text-highlight home] efg hig klm...
            q-item-section(side)
              .flex
                q-chip(
                  v-for='tag of 3'
                  square
                  :color='$q.dark.isActive ? `dark-2` : `grey-3`'
                  :text-color='$q.dark.isActive ? `grey-4` : `grey-8`'
                  icon='las la-hashtag'
                  size='sm'
                  ) tag {{ tag }}
              .flex
                .text-caption.q-mr-sm.text-grey /beep/boop/hello
                .text-caption 2023-01-25

      q-inner-loading(:showing='state.loading > 0')
  main-overlay-dialog
  footer-nav
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { computed, onMounted, reactive, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { useFlagsStore } from 'src/stores/flags'
import { useSiteStore } from 'src/stores/site'
import { useUserStore } from 'src/stores/user'

import HeaderNav from 'src/components/HeaderNav.vue'
import FooterNav from 'src/components/FooterNav.vue'
import MainOverlayDialog from 'src/components/MainOverlayDialog.vue'

// QUASAR

const $q = useQuasar()

// STORES

const flagsStore = useFlagsStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// META

useMeta({
  titleTemplate: title => `${title} - ${t('profile.title')} - Wiki.js`
})

// DATA

const state = reactive({
  loading: 0,
  filterPath: '',
  filterTags: [],
  filterLocale: ['en'],
  filterEditor: '',
  filterPublishState: ''
})

const editors = computed(() => {
  return [
    { label: 'Any editor', value: '' },
    { label: 'AsciiDoc', value: 'asciidoc' },
    { label: 'Markdown', value: 'markdown' },
    { label: 'Visual Editor', value: 'wysiwyg' }
  ]
})

const publishStates = computed(() => {
  return [
    { label: 'Any publish state', value: '' },
    { label: 'Draft', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Scheduled', value: 'scheduled' }
  ]
})

// WATCHERS

watch(() => route.query, async (newQueryObj) => {
  if (newQueryObj.q) {
    siteStore.search = newQueryObj.q
  }
}, { immediate: true })

// METHODS

function pageStyle (offset, height) {
  return {
    'min-height': `${height - 100 - offset}px`
  }
}
</script>

<style lang="scss">
.layout-search {
  @at-root .body--light & {
    background-color: $grey-3;
  }
  @at-root .body--dark & {
    background-color: $dark-6;
  }

  &:before {
    content: '';
    height: 200px;
    position: fixed;
    top: 0;
    width: 100%;
    background: radial-gradient(ellipse at bottom, $dark-3, $dark-6);
    border-bottom: 1px solid #FFF;

    @at-root .body--dark & {
      border-bottom-color: $dark-3;
    }
  }

  &:after {
    content: '';
    height: 1px;
    position: fixed;
    top: 64px;
    width: 100%;
    background: linear-gradient(to right, transparent 0%, rgba(255,255,255,.1) 50%, transparent 100%);
  }

  &-card {
    position: relative;
    width: 90%;
    max-width: 1400px;
    margin: 50px auto;
    box-shadow: $shadow-2;
    border-radius: 7px;
    display: flex;
    align-items: stretch;
    height: 100%;

    @at-root .body--light & {
      background-color: #FFF;
    }
    @at-root .body--dark & {
      background-color: $dark-3;
    }
  }

  &-sd {
    flex: 0 0 300px;
    border-radius: 8px 0 0 8px;
    overflow: hidden;

    @at-root .body--light & {
      background-color: $grey-1;
      border-right: 1px solid rgba($dark-3, .1);
      box-shadow: inset -1px 0 0 #FFF;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      border-right: 1px solid rgba(#FFF, .12);
      box-shadow: inset -1px 0 0 rgba($dark-6, .5);
    }
  }

  .text-header {
    padding: .75rem 1rem;
    font-weight: 500;

    @at-root .body--light & {
      background-color: $grey-1;
      border-bottom: 1px solid $grey-3;
    }
    @at-root .body--dark & {
      background-color: $dark-3;
      border-bottom: 1px solid $dark-2;
    }
  }

  .text-highlight {
    background-color: rgba($yellow-7, .5);
    padding: 0 3px;
    border-radius: 3px;
  }

  .q-page {
    flex: 1 1;

    .text-header:first-child {
      border-top-right-radius: 7px;
    }

    @at-root .body--light & {
      border-left: 1px solid #FFF;
    }
    @at-root .body--dark & {
      border-left: 1px solid rgba($dark-6, .75);
    }
  }
}

body.body--dark {
  background-color: $dark-6;
}

.q-footer {
  .q-bar {
    @at-root .body--light & {
      background-color: $grey-3;
      color: $grey-7;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      color: rgba(255,255,255,.3);
    }
  }
}
</style>
