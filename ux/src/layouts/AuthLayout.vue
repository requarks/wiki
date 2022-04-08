<template lang='pug'>
q-layout(view='hHh lpr lff')
  q-page-container
    router-view
</template>

<script>

export default {
  name: 'AuthLayout',
  data () {
    return {
      bgUrl: '_assets/bg/login-v3.jpg'
      // bgUrl: 'https://docs.requarks.io/_assets/img/splash/1.jpg'
    }
  }
}
</script>

<style lang="scss">
  .auth {
    background-color: #FFF;
    background-size: cover;
    background-position: center center;
    height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;

    &-box {
      background-color: rgba(255,255,255,.25);
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
      padding: 32px;
      border-radius: 8px;
      width: 500px;
      max-width: 95vw;

      @at-root .no-backdropfilter & {
        background-color: rgba(255,255,255,.95);
      }

      @media (max-width: $breakpoint-md-max) {
        margin-left: 0;
        width: 100%;
      }
    }
  }
</style>
