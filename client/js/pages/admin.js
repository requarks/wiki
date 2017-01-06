
if($('#page-type-admin-users').length) {

	//=include ../modals/admin-users-create.js

} else if($('#page-type-admin-users-edit').length) {

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
				vueEditUser.rights.push({});
			},
			removeRightsRow: (ev) => {

			},
			saveUser: (ev) => {


			}
		},
		created: function() {

			this.id = usrData._id;
			this.email = usrData.email;
			this.name = usrData.name;

			console.log(_.find(usrData.rights, { role: 'admin' }));

			if(_.find(usrData.rights, { role: 'admin' })) {
				this.rights = _.reject(usrData.rights, ['role', 'admin']);
				this.roleoverride = 'admin';
			} else {
				this.rights = usrData.rights;
			}

		}
	});

	//=include ../modals/admin-users-delete.js

}