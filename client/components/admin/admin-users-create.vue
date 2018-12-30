<template lang="pug">
  v-dialog(v-model='isShown', max-width='550')
    v-card.wiki-form
      .dialog-header.is-short New Local User
      v-card-text
        v-text-field.md2(
          outline
          prepend-icon='email'
          v-model='email'
          label='Email Address'
          ref='emailInput'
          )
        v-text-field.md2(
          outline
          prepend-icon='person'
          v-model='name'
          label='Name'
          )
        v-text-field.md2(
          outline
          prepend-icon='lock'
          append-icon='casino'
          v-model='password'
          label='Password'
          counter='255'
          @click:append='generatePwd'
          )
      v-card-chin
        v-spacer
        v-btn(flat, @click='isShown = false') Cancel
        v-btn(color='primary', @click='createUser') Create User
</template>

<script>
import uuidv4 from 'uuid/v4'

export default {
  props: {
    value: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      email: '',
      name: '',
      password: '',
      jobTitle: '',
      location: ''
    }
  },
  computed: {
    isShown: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    }
  },
  watch: {
    value(newValue, oldValue) {
      if (newValue) {
        this.$nextTick(() => {
          this.$refs.emailInput.focus()
        })
      }
    }
  },
  methods: {
    async createUser() {

    },
    generatePwd() {
      this.password = uuidv4().slice(-12)
    }
  }
}
</script>
