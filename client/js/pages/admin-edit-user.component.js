'use strict'

export default {
  name: 'admin-edit-user',
  props: ['usrdata'],
  data() {
    return {
      id: '',
      email: '',
      password: '********',
      name: '',
      rights: [],
      roleoverride: 'none'
    }
  },
  methods: {
    addRightsRow() {
      this.rights.push({
        role: 'write',
        path: '/',
        exact: false,
        deny: false
      })
    },
    removeRightsRow(idx) {
      this._.pullAt(this.rights, idx)
      this.$forceUpdate()
    },
    saveUser() {
      let self = this
      let formattedRights = this._.cloneDeep(this.rights)
      switch (this.roleoverride) {
        case 'admin':
          formattedRights.push({
            role: 'admin',
            path: '/',
            exact: false,
            deny: false
          })
          break
      }
      this.$http.post(window.location.href, {
        password: this.password,
        name: this.name,
        rights: JSON.stringify(formattedRights)
      }).then(resp => {
        self.$store.dispatch('alert', {
          style: 'green',
          icon: 'check',
          msg: 'Changes have been applied successfully.'
        })
      }).catch(err => {
        self.$store.dispatch('alert', {
          style: 'red',
          icon: 'square-cross',
          msg: 'Error: ' + err.body.msg
        })
      })
    }
  },
  mounted() {
    let usr = JSON.parse(this.usrdata)
    this.id = usr._id
    this.email = usr.email
    this.name = usr.name

    if (this._.find(usr.rights, { role: 'admin' })) {
      this.rights = this._.reject(usr.rights, ['role', 'admin'])
      this.roleoverride = 'admin'
    } else {
      this.rights = usr.rights
    }
  }
}
