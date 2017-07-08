<template lang="pug">
  transition(:duration="400")
    .modal(v-show='isShown', v-cloak)
      transition(name='modal-background')
        .modal-background(v-show='isShown')
      .modal-container
        transition(name='modal-content')
          .modal-content(v-show='isShown')
            header.is-blue
              span {{ $t('modal.createusertitle') }}
              p.modal-notify(:class='{ "is-active": isLoading }'): i
            section
              label.label {{ $t('modal.createuseremail') }}
              p.control.is-fullwidth
                input.input(type='text', :placeholder='$t("modal.createuseremailplaceholder")', v-model='email', ref='createUserEmailInput')
            section
              label.label {{ $t('modal.createuserprovider') }}
              p.control.is-fullwidth
                select(v-model='provider')
                  option(value='local') Local Database
                  option(value='windowslive') Microsoft Account
                  option(value='google') Google ID
                  option(value='facebook') Facebook
                  option(value='github') GitHub
                  option(value='slack') Slack
            section(v-if='provider=="local"')
              label.label {{ $t('modal.createuserpassword') }}
              p.control.is-fullwidth
                input.input(type='password', placeholder='', v-model='password')
            section(v-if='provider=="local"')
              label.label {{ $t('modal.createusername') }}
              p.control.is-fullwidth
                input.input(type='text', :placeholder='$t("modal.createusernameplaceholder")', v-model='name')
            footer
              a.button.is-grey.is-outlined(@click='cancel') {{ $t('modal.discard') }}
              a.button(@click='create', v-if='provider=="local"', :disabled='isLoading', :class='{ "is-disabled": isLoading, "is-blue": !loading }') {{ $t('modal.createuser') }}
              a.button(@click='create', v-if='provider!="local"', :disabled='isLoading', :class='{ "is-disabled": isLoading, "is-blue": !loading }') {{ $t('modal.createuserauthorize') }}
</template>

<script>
export default {
  name: 'modal-create-user',
  data() {
    return {
      email: '',
      provider: 'local',
      password: '',
      name: '',
      isLoading: false
    }
  },
  computed: {
    isShown() {
      return this.$store.state.modalCreateUser.shown
    }
  },
  methods: {
    init() {
      let self = this
      self._.delay(() => {
        self.$refs.createUserEmailInput.focus()
      }, 100)
    },
    cancel() {
      this.$store.dispatch('modalCreateUser/close')
      this.email = ''
      this.provider = 'local'
    },
    create() {
      let self = this
      this.isLoading = true
      this.$http.post('/admin/users/create', {
        email: this.email,
        provider: this.provider,
        password: this.password,
        name: this.name
      }).then(resp => {
        return resp.json()
      }).then(resp => {
        this.isLoading = false
        if (resp.ok) {
          this.cancel()
          window.location.reload(true)
        } else {
          self.$store.dispatch('alert', {
            style: 'red',
            icon: 'ui-2_square-remove-09',
            msg: resp.msg
          })
        }
      }).catch(err => {
        this.isLoading = false
        self.$store.dispatch('alert', {
          style: 'red',
          icon: 'ui-2_square-remove-09',
          msg: 'Error: ' + err.body.msg
        })
      })
    }
  },
  mounted() {
    this.$root.$on('modalCreateUser/init', this.init)
  }
}
</script>
