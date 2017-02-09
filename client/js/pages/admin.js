
if ($('#page-type-admin-profile').length) {
  let vueProfile = new Vue({
    el: '#page-type-admin-profile',
    data: {
      password: '********',
      passwordVerify: '********',
      name: ''
    },
    methods: {
      saveUser: (ev) => {
        if (vueProfile.password !== vueProfile.passwordVerify) {
          alerts.pushError('Error', "Passwords don't match!")
          return
        }
        $.post(window.location.href, {
          password: vueProfile.password,
          name: vueProfile.name
        }).done((resp) => {
          alerts.pushSuccess('Saved successfully', 'Changes have been applied.')
        }).fail((jqXHR, txtStatus, resp) => {
          alerts.pushError('Error', resp)
        })
      }
    },
    created: function () {
      this.name = usrDataName
    }
  })
} else if ($('#page-type-admin-users').length) {

	// =include ../modals/admin-users-create.js

} else if ($('#page-type-admin-users-edit').length) {
  let vueEditUser = new Vue({
    el: '#page-type-admin-users-edit',
    data: {
      id: '',
      email: '',
      password: '********',
      name: '',
      rights: [],
      roleoverride: 'none'
    },
    methods: {
      addRightsRow: (ev) => {
        vueEditUser.rights.push({
          role: 'write',
          path: '/',
          exact: false,
          deny: false
        })
      },
      removeRightsRow: (idx) => {
        _.pullAt(vueEditUser.rights, idx)
        vueEditUser.$forceUpdate()
      },
      saveUser: (ev) => {
        let formattedRights = _.cloneDeep(vueEditUser.rights)
        switch (vueEditUser.roleoverride) {
          case 'admin':
            formattedRights.push({
              role: 'admin',
              path: '/',
              exact: false,
              deny: false
            })
            break
        }
        $.post(window.location.href, {
          password: vueEditUser.password,
          name: vueEditUser.name,
          rights: JSON.stringify(formattedRights)
        }).done((resp) => {
          alerts.pushSuccess('Saved successfully', 'Changes have been applied.')
        }).fail((jqXHR, txtStatus, resp) => {
          alerts.pushError('Error', resp)
        })
      }
    },
    created: function () {
      this.id = usrData._id
      this.email = usrData.email
      this.name = usrData.name

      if (_.find(usrData.rights, { role: 'admin' })) {
        this.rights = _.reject(usrData.rights, ['role', 'admin'])
        this.roleoverride = 'admin'
      } else {
        this.rights = usrData.rights
      }
    }
  })

	// =include ../modals/admin-users-delete.js
}
