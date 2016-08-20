"use strict";

var NodeGit = require("nodegit"),
	Promise = require('bluebird'),
	path = require('path'),
	os = require('os'),
	fs = Promise.promisifyAll(require("fs")),
	_ = require('lodash');

/**
 * Git Model
 */
module.exports = {

	_git: null,
	_repo: {
		path: '',
		exists: false,
		inst: null
	},

	/**
	 * Initialize Git model
	 *
	 * @param      {Object}  appconfig  The application config
	 * @return     {Object}  Git model instance
	 */
	init(appconfig) {

		let self = this;

		//-> Build repository path
		
		if(_.isEmpty(appconfig.git.path) || appconfig.git.path === 'auto') {
			self._repo.path = path.join(ROOTPATH, 'repo');
		} else {
			self._repo.path = appconfig.git.path;
		}

		//-> Initialize repository

		self._initRepo(appconfig).then((repo) => {
			self._repo.inst = repo;
		});

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

		winston.info('[GIT] Initializing Git repository...');

		//-> Check if path is accessible

		return fs.mkdirAsync(self._repo.path).catch((err) => {
			if(err.code !== 'EEXIST') {
				winston.error('Invalid Git repository path or missing permissions.');
			}
		}).then(() => {

			//-> Check if path already contains a git working folder

			return fs.statAsync(path.join(self._repo.path, '.git')).then((stat) => {
				self._repo.exists = stat.isDirectory();
			}).catch((err) => {
				self._repo.exists = false;
			});

		}).then(() => {

			//-> Init repository

			let repoInitOperation = null;

			if(self._repo.exists) {

				winston.info('[GIT] Using existing repository...');
				repoInitOperation = NodeGit.Repository.open(self._repo.path);

			} else if(appconfig.git.remote) {

				winston.info('[GIT] Cloning remote repository for first time...');
				let cloneOptions = self._generateCloneOptions(appconfig);
				repoInitOperation = NodeGit.Clone(appconfig.git.url, self._repo.path, cloneOptions);

			} else {

				winston.info('[GIT] Using offline local repository...');
				repoInitOperation = NodeGit.Repository.init(self._repo.path, 0);

			}

			return repoInitOperation;

		}).catch((err) => {
			winston.error('Unable to open or clone Git repository!');
			winston.error(err);
		}).then((repo) => {

			self._repo.inst = repo;

			winston.info('[GIT] Git repository is now ready.');
		});

	},

	/**
	 * Generate Clone Options object
	 *
	 * @param      {Object}  appconfig  The application configuration
	 * @return     {Object}  CloneOptions object
	 */
	_generateCloneOptions(appconfig) {

		let cloneOptions = {};

		cloneOptions.fetchOpts = {
			callbacks: {
				credentials: () => {

					let cred = null;
					switch(appconfig.git.auth.type) {
						case 'basic':
							cred = NodeGit.Cred.userpassPlaintextNew(
								appconfig.git.auth.user,
								appconfig.git.auth.pass
							);
						break;
						case 'oauth':
							cred = NodeGit.Cred.userpassPlaintextNew(
								appconfig.git.auth.token,
								"x-oauth-basic"
							);
						break;
						case 'ssh':
							cred = NodeGit.Cred.sshKeyNew(
								appconfig.git.auth.user,
								appconfig.git.auth.publickey,
								appconfig.git.auth.privatekey,
								appconfig.git.auth.passphrase
							);
						break;
						default:
							cred = NodeGit.Cred.defaultNew();
						break;
					}

					return cred;
				}
			}
		};

		if(os.type() === 'Darwin') {
			cloneOptions.fetchOpts.callbacks.certificateCheck = () => { return 1; }; // Bug in OS X, bypass certs check workaround
		}

		return cloneOptions;

	}

};