<template lang='pug'>
q-layout(view='hHh lpr lff')
  q-page-container
    router-view
</template>

<script setup>

</script>

<style lang="scss">
  .auth {
    background-color: #FFF;
    display: flex;

    @at-root .body--dark & {
      background-color: $dark-6;
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
