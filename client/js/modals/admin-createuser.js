
// Vue Create User instance

let vueCreateUser = new Vue({
	el: '#modal-admin-createuser',
	data: {
		email: '',
		provider: 'local',
		password: '',
		name: ''
	},
	methods: {
		open: (ev) => {
			$('#modal-admin-createuser').addClass('is-active');
			$('#modal-admin-createuser input').first().focus();
		},
		cancel: (ev) => {
			$('#modal-admin-createuser').removeClass('is-active');
			vueCreateUser.email = '';
			vueCreateUser.provider = 'local';
		},
		create: (ev) => {

			vueCreateUser.cancel();

		}
	}
});

$('.btn-create-prompt').on('click', vueCreateUser.open);