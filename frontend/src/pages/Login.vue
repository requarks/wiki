<template>
  <div class="auth">
    <div class="auth-content">
      <div class="auth-logo"><img :src="`/_site/current/logo`" :alt="siteStore.title" /></div>
      <h2 class="auth-site-title" v-if="siteStore.logoText">{{ siteStore.title }}</h2>
      <!-- -> The panel says what each of its screens is for; a subtitle here would sit above all of
              them and only be true of the first -->
      <auth-login-panel />
    </div>
    <div class="auth-bg" aria-hidden="true"><img :src="`/_site/current/loginBg`" alt="" /></div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { useMeta } from '@/composables/meta'

import { useSiteStore } from '@/stores/site'

import AuthLoginPanel from '@/components/AuthLoginPanel.vue'

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('auth.login.title')
})
</script>

<style lang="scss">
.auth {
  background-color: #fff;
  /*
    The foreground the background needs, and the reason it has to be said here: the only thing in the
    app that turns text white in dark mode is `.w-card`, and this screen is not in a card — the panel
    sits straight on the page. So the surface went dark and everything on it that had not named its
    own colour stayed black: the subtitle under each screen's heading, the icons at the head of every
    field, and the value being typed into them, which is a text input inheriting from here.
  */
  color: var(--color-black);
  display: flex;

  @at-root .body--dark & {
    background-color: $dark-6;
    color: var(--color-white);
  }

  &-content {
    flex: 1 0 100%;
    width: 100%;
    max-width: 500px;
    padding: 3rem 4rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: stretch;

    @media (max-width: $breakpoint-xs-max) {
      padding: 1rem 2rem;
      max-width: 100vw;
    }
  }

  &-logo {
    margin-bottom: 6px;

    img {
      height: 72px;
    }
  }

  &-site-title {
    font-size: 1.875rem;
    line-height: 2.25rem;
    font-weight: 700;
    margin: 0;
    color: $blue-grey-9;

    @at-root .body--dark & {
      color: $blue-grey-1;
    }
  }

  &-strategies {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(45%, 1fr));
    gap: 10px;
  }

  &-bg {
    flex: 1;
    flex-basis: 0;
    position: relative;
    height: 100vh;
    overflow: hidden;

    img {
      position: relative;
      width: 100%;
      height: 100%;
      object-fit: cover;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      margin: 0;
      padding: 0;
    }
  }
}
</style>
