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
              <w-item clickable @click="createHomePage(`visual`)" v-if="siteStore.editors.visual">
                <blueprint-icon icon="google-presentation" />
                <w-item-section class="pr-2">{{ t(`welcome.createHomeVisual`) }}</w-item-section>
                <w-item-section side><w-icon name="mdi:chevron-right" /></w-item-section>
              </w-item>
              <w-item
                clickable
                @click="createHomePage(`markdown`)"
                v-if="siteStore.editors.markdown">
                <blueprint-icon icon="markdown" />
                <w-item-section class="pr-2">{{ t(`welcome.createHomeMarkdown`) }}</w-item-section>
                <w-item-section side><w-icon name="mdi:chevron-right" /></w-item-section>
              </w-item>
              <w-item
                clickable
                @click="createHomePage(`asciidoc`)"
                v-if="siteStore.editors.asciidoc">
                <blueprint-icon icon="asciidoc" />
                <w-item-section class="pr-2">{{ t(`welcome.createHomeAsciidoc`) }}</w-item-section>
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

useMeta(() => ({
  title: t('welcome.title')
}))

// METHODS

async function createHomePage(editor) {
  loading.show()
  siteStore.overlay = ''
  try {
    await pageStore.pageCreate({
      // -> No locale: the one being written is the one the reader is looking at, which the store
      //    already holds. Pinning it to the site's primary meant that arriving at `/fr` with no
      //    French home page yet offered to create one and then tried to write the English one
      editor,
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
      message: t('welcome.createHomeFailed'),
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
  // -> The panel this is slotted into is what owns the shape: WDialog rounds it and clips to that
  //    radius, and hands the radius down to its child with `border-radius: inherit`. A radius of its
  //    own here was the larger of the two, so the panel's own top corners -- the dark first 10px of
  //    the gradient `.main-overlay` paints on it -- showed in the gap between the two curves.
  height: 100%;
  border: 1px solid #eee;

  // -> This sheet paints over the dialog surface underneath it, so it carries its own colours in
  //    both themes rather than letting `.main-overlay`'s show through -- which is why it was white
  //    on a dark wiki, with the menu it opens correctly dark and the two disagreeing. Dark mirrors
  //    light a step at a time: the sheet, the vignette at its edges, the rule round it, the text.
  @at-root .body--dark & {
    background: $dark-5 radial-gradient(ellipse, $dark-4, $dark-6);
    color: $grey-4;
    border-color: $dark-2;
  }

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

    // -> The lower half of the blob is the sheet's own colour, so what shows is the glow above it
    //    and not a pale smear across the middle. $blue-8 rather than the lighter $blue-5: the same
    //    glow needs less lightness to read against near-black than it does against white.
    @at-root .body--dark & {
      background: linear-gradient(0, $dark-5 50%, $blue-8 50%);
    }
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

    @at-root .body--dark & {
      color: $blue-4;
    }
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
