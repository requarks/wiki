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

  /*
    What went wrong, above the panel. Solid negative rather than a tinted box with a coloured border:
    this sits on a white page in light mode and a near-black one in dark, and one surface that carries
    its own foreground reads the same on both.

    Mixed towards black rather than used neat, which is a departure from the `bg-negative text-white`
    banners in the admin area: `--q-negative` is #f03a47, and white on it is 3.9:1 — under AA for text
    this size, and worse again for the caption. Mixing rather than naming a darker red keeps the hue a
    re-themed site set, the same way `--color-primary-light` is built.
  */
  &-error {
    background-color: color-mix(in srgb, var(--color-negative) 80%, black);
    color: #fff;
    /* -> Top as well as bottom: this is the first thing in the panel, so with none it sits flush
          against the site title above it */
    margin: 1rem 0;
    /*
      The banner leaves its row on the default `stretch`, which is right for one carrying actions and
      wrong here: the icon is 24px and the message is a 20px line, so the text column stretched to the
      icon's height and drew its line at the top of it — 4px high of centre, against both the icon
      beside it and the box's own padding.
    */
    align-items: center;

    &-message {
      font-weight: 500;
    }

    &-caption {
      margin-top: 0.25rem;
      font-size: 0.875rem;
      color: rgb(255 255 255 / 0.8);
    }
  }

  /*
    The line under the heading on every screen of the panel — "Enter your credentials", "Fill-in the
    form below to create an account", and so on. Tailwind's preflight zeroes `p` margins, so without
    this the subtitle sits flush against the site title above it and the first field below it, reading
    as part of neither. Margins rather than padding, so two stacked lines (the 2FA setup screen)
    collapse into one gap instead of doubling it.
  */
  &-subtitle {
    margin: 1rem 0;
  }

  /*
    The end of a flow, in place of the form that started it. Centred rather than left-aligned like
    every other screen in the panel: there is nothing to fill in here, so the checkmark and what it
    says are the whole column.
  */
  &-success {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 1rem 0 0.5rem;

    &-message {
      font-size: 1.25rem;
      line-height: 1.75rem;
      font-weight: 600;
      margin: 1rem 0 0;
    }

    &-caption {
      margin: 0.5rem 0 0;
      color: $blue-grey-5;

      @at-root .body--dark & {
        color: $blue-grey-4;
      }
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
