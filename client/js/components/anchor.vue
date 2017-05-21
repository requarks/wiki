<template>
    <div>
        <p>{{ msg }}</p>
        <input type="text" v-model="msg" />
    </div>
</template>

<script>
  export default {
    name: 'anchor',
    data () {
      return {
          msg: 'Welcome to Your Vue.js App'
      }
    }
  }
</script>
