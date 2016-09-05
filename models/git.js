"use strict";

var Git = require("git-wrapper2-promise"),
	Promise = require('bluebird'),
	path = require('path'),
	os = require('os'),
	fs = Promise.promisifyAll(require("fs")),
	moment = require('moment'),
	_ = require('lodash'),
	URL = require('url');

/**
 * Git Model
 */
module.exports = {

	_git: null,
	_url: '',
	_repo: {
		path: '',
		branch: 'master',
		exists: false
	},
	_signature: {
		name: 'Wiki',
		email: 'user@example.com'
	},
	_opts: {
		clone: {},
		push: {}
	},
	onReady: null,

	/**
	 * Initialize Git model
	 *
	 * @param      {Object}  appconfig  The application config
	 * @return     {Object}  Git model instance
	 */
	init(appconfig) {

		let self = this;

		//-> Build repository path
		
		if(_.isEmpty(appconfig.datadir.repo)) {
			self._repo.path = path.join(ROOTPATH, 'repo');
		} else {
			self._repo.path = appconfig.datadir.repo;
		}

		//-> Initialize repository

		self.onReady = self._initRepo(appconfig);

		// Define signature

		self._signature.name = appconfig.git.signature.name || 'Wiki';
		self._signature.email = appconfig.git.signature.email || 'user@example.com';

		return self;

	},

	/**
	 * Initialize Git repository
	 *
	 * @param      {Object}  appconfig  The application config
	 * @return     {Object}  Promise
	 */
	_initRepo(appconfig) {

		let self = this;

		winston.info('[GIT] Checking Git repository...');

		//-> Check if path is accessible

		return fs.mkdirAsync(self._repo.path).catch((err) => {
			if(err.code !== 'EEXIST') {
				winston.error('Invalid Git repository path or missing permissions.');
			}
		}).then(() => {

			self._git = new Git({ 'git-dir': self._repo.path });

			//-> Check if path already contains a git working folder

			return self._git.isRepo().then((isRepo) => {
				self._repo.exists = isRepo;
				return (!isRepo) ? self._git.exec('init') : true;
			}).catch((err) => {
				self._repo.exists = false;
			});

		}).then(() => {

			// Initialize remote

			let urlObj = URL.parse(appconfig.git.url);
			urlObj.auth = appconfig.git.auth.username + ((appconfig.git.auth.type !== 'ssh') ? ':' + appconfig.git.auth.password : '');
			self._url = URL.format(urlObj);

			return self._git.exec('remote', 'show').then((cProc) => {
				let out = cProc.stdout.toString();
				if(_.includes(out, 'origin')) {
					return true;
				} else {
					return Promise.join(
						self._git.exec('config', ['--local', 'user.name', self._signature.name]),
						self._git.exec('config', ['--local', 'user.email', self._signature.email])
					).then(() => {
						return self._git.exec('remote', ['add', 'origin', self._url]);
					})
				}
			});

		}).catch((err) => {
			winston.error('Git remote error!');
			throw err;
		}).then(() => {
			winston.info('[GIT] Git repository is now ready.');
			return true;
		});

	},

	/**
	 * Sync with the remote repository
	 *
	 * @return     {Promise}  Resolve on sync success
	 */
	resync() {

		let self = this;

		// Fetch

		winston.info('[GIT] Performing pull from remote repository...');
		return self._git.pull('origin', self._repo.branch).then((cProc) => {
			winston.info('[GIT] Pull completed.');
		})
		.catch((err) => {
			winston.error('Unable to fetch from git origin!');
			throw err;
		})
		.then(() => {

			// Check for changes

			return self._git.exec('log', 'origin/' + self._repo.branch + '..HEAD').then((cProc) => {
				let out = cProc.stdout.toString();

				if(_.includes(out, 'commit')) {

					winston.info('[GIT] Performing push to remote repository...');
					return self._git.push('origin', self._repo.branch).then(() => {
						return winston.info('[GIT] Push completed.');
					});

				} else {

					winston.info('[GIT] Push skipped. Repository is already in sync.');

				}

				return true;

			});

		})
		.catch((err) => {
			winston.error('Unable to push changes to remote!');
			throw err;
		});

	},

	/**
	 * Commits a document.
	 *
	 * @param      {String}   entryPath  The entry path
	 * @return     {Promise}  Resolve on commit success
	 */
	commitDocument(entryPath) {

		let self = this;
		let gitFilePath = entryPath + '.md';
		let commitMsg = '';

		return self._git.exec('ls-files', gitFilePath).then((cProc) => {
			let out = cProc.stdout.toString();
			return _.includes(out, gitFilePath);
		}).then((isTracked) => {
			commitMsg = (isTracked) ? 'Updated ' + gitFilePath : 'Added ' + gitFilePath;
			return self._git.add(gitFilePath);
		}).then(() => {
			return self._git.commit(commitMsg);
		});

	}

};