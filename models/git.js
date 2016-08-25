"use strict";

var NodeGit = require("nodegit"),
	Promise = require('bluebird'),
	path = require('path'),
	os = require('os'),
	fs = Promise.promisifyAll(require("fs")),
	moment = require('moment'),
	_ = require('lodash');

/**
 * Git Model
 */
module.exports = {

	_git: null,
	_repo: {
		path: '',
		branch: 'master',
		exists: false,
		inst: null,
		sync: true
	},
	_signature: {
		name: 'Wiki',
		email: 'user@example.com'
	},
	_opts: {
		clone: {},
		push: {}
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

			if(self._repo.sync) {
				self.resync();
			}

		});

		// Define signature

		self._signature.name = appconfig.git.userinfo.name || 'Wiki';
		self._signature.email = appconfig.git.userinfo.email || 'user@example.com';

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
			self._repo.branch = appconfig.git.branch;
			self._repo.sync = appconfig.git.remote;
			self._opts.clone = self._generateCloneOptions(appconfig);
			self._opts.push = self._generatePushOptions(appconfig);

			if(self._repo.exists) {

				winston.info('[GIT] Using existing repository...');
				repoInitOperation = NodeGit.Repository.open(self._repo.path);

			} else if(appconfig.git.remote) {

				winston.info('[GIT] Cloning remote repository for first time...');
				repoInitOperation = NodeGit.Clone(appconfig.git.url, self._repo.path, self._opts.clone);

			} else {

				winston.info('[GIT] Using offline local repository...');
				repoInitOperation = NodeGit.Repository.init(self._repo.path, 0);

			}

			return repoInitOperation;

		}).catch((err) => {
			winston.error('Unable to open or clone Git repository!');
			winston.error(err);
		}).then((repo) => {

			if(self._repo.sync) {
				NodeGit.Remote.setPushurl(repo, 'origin', appconfig.git.url);
			}

			return repo;

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

		let cloneOptions = new NodeGit.CloneOptions();
		cloneOptions.fetchOpts = this._generateFetchOptions(appconfig);
		return cloneOptions;

	},

	_generateFetchOptions(appconfig) {

		let fetchOptions = new NodeGit.FetchOptions();
		fetchOptions.callbacks = this._generateRemoteCallbacks(appconfig);
		return fetchOptions;

	},

	_generatePushOptions(appconfig) {

		let pushOptions = new NodeGit.PushOptions();
		pushOptions.callbacks = this._generateRemoteCallbacks(appconfig);
		return pushOptions;

	},

	_generateRemoteCallbacks(appconfig) {

		let remoteCallbacks = new NodeGit.RemoteCallbacks();
		let credFunc = this._generateCredentials(appconfig);
		remoteCallbacks.credentials = () => { return credFunc; };
		remoteCallbacks.transferProgress = _.noop;

		if(os.type() === 'Darwin') {
			remoteCallbacks.certificateCheck = () => { return 1; }; // Bug in OS X, bypass certs check workaround
		} else {
			remoteCallbacks.certificateCheck = _.noop;
		}

		return remoteCallbacks;

	},

	_generateCredentials(appconfig) {

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

	},

	resync() {

		let self = this;

		// Fetch

		return self._repo.inst.fetch('origin', self._opts.clone.fetchOpts)
		.catch((err) => {
			winston.error('Unable to fetch from git origin!' + err);
		})

		// Merge

		.then(() => {
			return self._repo.inst.mergeBranches(self._repo.branch, 'origin/' + self._repo.branch);
		})
		.catch((err) => {
			winston.error('Unable to merge from remote head!' + err);
		})

		// Push

		.then(() => {
			return self._repo.inst.getRemote('origin').then((remote) => {

				// Get modified files

				return self._repo.inst.refreshIndex().then((index) => {
					return self._repo.inst.getStatus().then(function(arrayStatusFile) {

						let addOp = [];

						// Add to next commit

						_.forEach(arrayStatusFile, (v) => {
							addOp.push(arrayStatusFile[0].path());
						});

						console.log('DUDE1');

						// Create Commit

						let sig = NodeGit.Signature.create(self._signature.name, self._signature.email, moment().utc().unix(),  0);
						return self._repo.inst.createCommitOnHead(addOp, sig, sig, "Wiki Sync").then(() => {

							console.log('DUDE2');

							return remote.connect(NodeGit.Enums.DIRECTION.PUSH, self._opts.push.callbacks).then(() => {

								console.log('DUDE3');

								// Push to remote

								return remote.push( ["refs/heads/master:refs/heads/master"], self._opts.push).then((errNum) => {
									console.log('DUDE' + errNum);
								}).catch((err) => {
									console.log(err);
								});

							});

						});

					});
				})

				/**/
			});
		}).catch((err) => {
			winston.error('Unable to push to git origin!' + err);
		});

	}

};