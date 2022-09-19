<template lang='pug'>
.welcome
  .welcome-bg
  .welcome-content
    .welcome-logo
      img(src='/_assets/logo-wikijs.svg')
    .welcome-title {{t('welcome.title')}}
    .welcome-subtitle {{t('welcome.subtitle')}}
    .welcome-actions
      q-btn(
        push
        color='primary'
        :label='t(`welcome.createHome`)'
        icon='las la-plus'
        no-caps
        href='/_edit'
      )
      q-btn(
        push
        color='primary'
        :label='t(`welcome.admin`)'
        icon='las la-cog'
        no-caps
        to='/_admin'
      )

</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useMeta } from 'quasar'

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('welcome.title')
})

</script>

<style lang="scss">
  .welcome {
    background: $dark-6 radial-gradient(ellipse, $dark-4, $dark-6);
    color: #FFF;
    height: 100vh;

    &-bg {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 320px;
      height: 320px;
      background: linear-gradient(0, $purple-6 50%, $blue-9 50%);
      border-radius: 50%;
      filter: blur(80px);
      transform: translate(-50%, -50%);
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
      color: $purple-2;
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
