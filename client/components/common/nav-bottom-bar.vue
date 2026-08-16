<template lang='pug'>
  .nav-bottom-bar(:class='$vuetify.theme.dark ? `nav-bottom-bar--dark` : ``')
    nav-action-items(preset='mobile-bottom', layout='bottom-bar')
</template>

<script>
import NavActionItems from './nav-action-items.vue'

export default {
  components: {
    NavActionItems
  }
}
</script>

<style lang='scss'>
.nav-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-width: 100vw;
  height: 56px;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: mc('theme', 'primary');
  border-top: 1px solid rgba(255, 255, 255, 0.24);
  box-shadow: 0 -1px 4px rgba(0, 0, 0, 0.12);
  z-index: 220;
  padding: 0 env(safe-area-inset-right, 0) 0 env(safe-area-inset-left, 0);
  padding-bottom: env(safe-area-inset-bottom, 0);
  overflow: visible;

  &--dark {
    background-color: mc('blue', '900');
    border-top-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 -1px 4px rgba(0, 0, 0, 0.35);
  }
}
</style>
