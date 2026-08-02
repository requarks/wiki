<template>
  <div class="welcome">
    <div class="welcome-bg" />
    <div class="welcome-content">
      <div class="welcome-logo"><img src="/_assets/logo-wikijs.svg" /></div>
      <div class="welcome-title">{{ t('welcome.title') }}</div>
      <div class="welcome-subtitle">{{ t('welcome.subtitle') }}</div>
      <div class="welcome-actions">
        <w-btn push color="primary" :label="t(`welcome.createHome`)" icon="la:plus" no-caps>
          <w-menu class="translucent-menu" auto-close anchor="top left" self="bottom left">
            <w-list padding>
              <w-item
                clickable
                @click="createHomePage(`wysiwyg`)"
                v-if="flagsStore.experimental && siteStore.editors.wysiwyg">
                <blueprint-icon icon="google-presentation" />
                <w-item-section class="pr-2">Using the Visual Editor</w-item-section>
                <w-item-section side><w-icon name="mdi:chevron-right" /></w-item-section>
              </w-item>
              <w-item
                clickable
                @click="createHomePage(`markdown`)"
                v-if="siteStore.editors.markdown">
                <blueprint-icon icon="markdown" />
                <w-item-section class="pr-2">Using the Markdown Editor</w-item-section>
                <w-item-section side><w-icon name="mdi:chevron-right" /></w-item-section>
              </w-item>
              <w-item
                clickable
                @click="createHomePage(`asciidoc`)"
                v-if="flagsStore.experimental && siteStore.editors.asciidoc">
                <blueprint-icon icon="asciidoc" />
                <w-item-section class="pr-2">Using the AsciiDoc Editor</w-item-section>
                <w-item-section side><w-icon name="mdi:chevron-right" /></w-item-section>
              </w-item>
            </w-list>
          </w-menu>
        </w-btn>
        <!--
          -> Same test the admin area itself makes on arrival: this screen greets whoever may write the
             first page, which on a wiki with an editors group is not necessarily somebody who may
             administer it -- and the button would land them on the unauthorized screen.
        -->
        <w-btn
          v-if="userStore.can(`access:admin`)"
          push
          color="primary"
          :label="t(`welcome.admin`)"
          icon="la:cog"
          no-caps
          @click="loadAdmin" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { loading } from '@/composables/loading'
import { notify } from '@/composables/notify'
import { useMeta } from '@/composables/meta'

import { useFlagsStore } from '@/stores/flags'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

// STORES

const flagsStore = useFlagsStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// ROUTER

const router = useRouter()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('welcome.title')
})

// METHODS

async function createHomePage(editor) {
  loading.show()
  siteStore.overlay = ''
  try {
    await pageStore.pageCreate({
      editor,
      locale: siteStore.locales.primary,
      path: 'home',
      title: t('welcome.homeDefault.title'),
      description: t('welcome.homeDefault.description'),
      content: t('welcome.homeDefault.content')
    })
  } catch (err) {
    // -> Opening the editor is what this button does, so a failure has to be said out loud rather
    //    than leaving the spinner up over a screen that never changed
    siteStore.overlay = 'Welcome'
    notify({
      type: 'negative',
      message: 'Failed to open the editor.',
      caption: err.message
    })
  }
  loading.hide()
}

function loadAdmin() {
  siteStore.overlay = ''
  router.push('/_admin')
}
</script>

<style lang="scss">
.welcome {
  background: #fff radial-gradient(ellipse, #fff, #ddd);
  color: $grey-9;
  height: 100vh;
  border: 1px solid #eee;
  border-radius: 25px !important;

  &-bg {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 320px;
    height: 320px;
    background: linear-gradient(0, #fff 50%, $blue-5 50%);
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

    > .w-btn {
      margin: 0 5px 5px 5px;
    }
  }
}
</style>
