<template lang='pug'>
.fullscreen.bg-blue.text-white.text-center.q-pa-md.flex.flex-center
  div
    .text-h1 Unknown Site
    .text-h2(style="opacity:.4") Oops. Nothing here...
    q-btn(
      class="q-mt-xl"
      color="white"
      text-color="blue"
      unelevated
      to="/"
      label="Go Home"
      no-caps
    )
</template>

<script>
export default {
  name: 'UnknownSite'
}
</script>
