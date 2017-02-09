
// Vue Create User instance

let vueCreateUser = new Vue({
  el: '#modal-admin-users-create',
  data: {
    email: '',
    provider: 'local',
    password: '',
    name: ''
  },
  methods: {
    open: (ev) => {
      $('#modal-admin-users-create').addClass('is-active')
      $('#modal-admin-users-create input').first().focus()
    },
    cancel: (ev) => {
      $('#modal-admin-users-create').removeClass('is-active')
      vueCreateUser.email = ''
      vueCreateUser.provider = 'local'
    },
    create: (ev) => {
      vueCreateUser.cancel()
    }
  }
})

$('.btn-create-prompt').on('click', vueCreateUser.open)
