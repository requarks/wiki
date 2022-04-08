<template>
  <router-view />
</template>

<script>
import { defineComponent, nextTick, onMounted } from 'vue'

export default defineComponent({
  name: 'App',
  setup () {
    onMounted(() => {
      nextTick(() => {
        document.querySelector('.init-loading').remove()
      })
    })
  }
})
</script>
