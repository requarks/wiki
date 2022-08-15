<template lang='pug'>
.errorpage
  .errorpage-bg
  .errorpage-content
    .errorpage-code {{error.code}}
    .errorpage-title {{error.title}}
    .errorpage-hint {{error.hint}}
    .errorpage-actions
      q-btn(
        push
        color='primary'
        label='Go to home'
        icon='las la-home'
        to='/'
      )
      q-btn.q-ml-md(
        v-if='error.showLoginBtn'
        push
        color='primary'
        label='Login As...'
        icon='las la-sign-in-alt'
        to='/login'
      )

</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useMeta } from 'quasar'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const actions = {
  unauthorized: {
    code: 403,
    showLoginBtn: true
  },
  notfound: {
    code: 404
  },
  generic: {
    code: '!?0'
  }
}

// ROUTER

const route = useRoute()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('common.error.title')
})

// COMPUTED

const error = computed(() => {
  if (route.params.action && actions[route.params.action]) {
    return {
      ...actions[route.params.action],
      title: t(`common.error.${route.params.action}.title`),
      hint: t(`common.error.${route.params.action}.hint`)
    }
  } else {
    return {
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
    color: #FFF;
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
