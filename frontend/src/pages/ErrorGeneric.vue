<template>
  <div class="errorpage">
    <div class="errorpage-bg" />
    <div class="errorpage-content">
      <div class="errorpage-code">{{ error.code }}</div>
      <div class="errorpage-title">{{ error.title }}</div>
      <div class="errorpage-hint">{{ error.hint }}</div>
      <div class="errorpage-actions">
        <w-btn
          v-if="error.showHomeBtn"
          push
          color="primary"
          label="Go to home"
          icon="la:home"
          to="/" />
        <w-btn
          class="ml-4"
          v-if="error.showLoginBtn"
          push
          color="primary"
          label="Login As..."
          icon="la:sign-in-alt"
          to="/login" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useMeta } from '@/composables/meta'

import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

const actions = {
  unauthorized: {
    code: 403,
    showLoginBtn: true
  },
  notfound: {
    code: 404
  },
  unknownsite: {
    code: 'X!?',
    showHomeBtn: false
  },
  generic: {
    code: '!?0'
  }
}

// ROUTER

const route = useRoute()
const router = useRouter()

// STORES

const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('common.error.title')
})

// MOUNTED

/*
  A site can choose to skip this screen entirely for a visitor who is not logged in: with
  `bypassUnauthorized` on, being refused a page sends them to sign in rather than to a page whose only
  purpose is to offer them a login button.

  Only when nobody is logged in. Somebody who IS signed in and still refused has nothing to gain from
  the login screen, and sending them there would bounce them straight back.
*/
onMounted(() => {
  if (
    route.params.action === 'unauthorized' &&
    siteStore.auth.bypassUnauthorized &&
    !userStore.authenticated
  ) {
    router.replace('/login')
  }
})

// COMPUTED

const error = computed(() => {
  if (route.params.action && actions[route.params.action]) {
    return {
      showHomeBtn: true,
      ...actions[route.params.action],
      title: t(`common.error.${route.params.action}.title`),
      hint: t(`common.error.${route.params.action}.hint`)
    }
  } else {
    return {
      showHomeBtn: true,
      ...actions.generic,
      title: t('common.error.generic.title'),
      hint: t('common.error.generic.hint')
    }
  }
})
</script>

<style lang="scss">
.errorpage {
  background: $dark-6 radial-gradient(ellipse, $dark-4, $dark-6);
  color: #fff;
  height: 100vh;

  &-bg {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 320px;
    height: 320px;
    background: linear-gradient(0, transparent 50%, $red-9 50%);
    border-radius: 50%;
    filter: blur(80px);
    transform: translate(-50%, -50%);
    visibility: hidden;
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
  }

  &-code {
    font-size: 12rem;
    line-height: 12rem;
    font-weight: 700;
    background: linear-gradient(45deg, $red-9, $red-3);
    background-clip: text;
    -webkit-text-fill-color: transparent;
    user-select: none;
  }

  &-title {
    font-size: 5rem;
    font-weight: 500;
    line-height: 5rem;
  }

  &-hint {
    font-size: 1.2rem;
    font-weight: 500;
    color: $red-3;
    line-height: 1.2rem;
    margin-top: 1rem;
  }

  &-actions {
    margin-top: 2rem;
  }
}
</style>
