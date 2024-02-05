<template lang='pug'>
.welcome
  .welcome-bg
  .welcome-content
    .welcome-logo
      img(src='/_assets/logo-wikijs.svg')
    .welcome-title {{ t('welcome.title') }}
    .welcome-subtitle {{ t('welcome.subtitle') }}
    .welcome-actions
      q-btn(
        push
        color='primary'
        :label='t(`welcome.createHome`)'
        icon='las la-plus'
        no-caps
        )
        q-menu.translucent-menu(
          auto-close
          anchor='top left'
          self='bottom left'
          )
          q-list(padding)
            q-item(
              clickable
              @click='createHomePage(`wysiwyg`)'
              v-if='flagsStore.experimental && siteStore.editors.wysiwyg'
              )
              blueprint-icon(icon='google-presentation')
              q-item-section.q-pr-sm Using the Visual Editor
              q-item-section(side): q-icon(name='mdi-chevron-right')
            q-item(
              clickable
              @click='createHomePage(`markdown`)'
              v-if='siteStore.editors.markdown'
              )
              blueprint-icon(icon='markdown')
              q-item-section.q-pr-sm Using the Markdown Editor
              q-item-section(side): q-icon(name='mdi-chevron-right')
            q-item(
              clickable
              @click='createHomePage(`asciidoc`)'
              v-if='flagsStore.experimental && siteStore.editors.asciidoc'
              )
              blueprint-icon(icon='asciidoc')
              q-item-section.q-pr-sm Using the AsciiDoc Editor
              q-item-section(side): q-icon(name='mdi-chevron-right')
      q-btn(
        push
        color='primary'
        :label='t(`welcome.admin`)'
        icon='las la-cog'
        no-caps
        @click='loadAdmin'
      )

</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useMeta, useQuasar } from 'quasar'

import { useFlagsStore } from 'src/stores/flags'
import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const flagsStore = useFlagsStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()

// ROUTER

const router = useRouter()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('welcome.title')
})

// METHODS

async function createHomePage (editor) {
  $q.loading.show()
  siteStore.overlay = ''
  await pageStore.pageCreate({
    editor,
    locale: 'en',
    path: 'home',
    title: t('welcome.homeDefault.title'),
    description: t('welcome.homeDefault.description'),
    content: t('welcome.homeDefault.content')
  })
  $q.loading.hide()
}

function loadAdmin () {
  siteStore.overlay = ''
  router.push('/_admin')
}

</script>

<style lang="scss">
  .welcome {
    background: #FFF radial-gradient(ellipse, #FFF, #DDD);
    color: $grey-9;
    height: 100vh;
    border: 1px solid #EEE;
    border-radius: 25px !important;

    &-bg {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 320px;
      height: 320px;
      background: linear-gradient(0, #FFF 50%, $blue-5 50%);
      border-radius: 50%;
      filter: blur(100px);
      transform: translate(-50%, -55%);
    }

    &-content {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      width: 90vw;
    }

    &-logo {
      user-select: none;

      > img {
        height: 200px;
        user-select: none;
      }
    }

    &-title {
      font-size: 4rem;
      font-weight: 500;
      line-height: 4rem;
      text-align: center;

      @media (max-width: $breakpoint-md-max) {
        font-size: 2.5rem;
        line-height: 2.5rem;
      }
    }

    &-subtitle {
      font-size: 1.2rem;
      font-weight: 500;
      color: $blue-7;
      line-height: 1.2rem;
      margin-top: 1rem;
    }

    &-actions {
      margin-top: 2rem;
      text-align: center;

      > .q-btn {
        margin: 0 5px 5px 5px;
      }
    }
  }
</style>
