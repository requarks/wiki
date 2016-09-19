// ===========================================
// REQUARKS WIKI - Background Agent
// 1.0.0
// Licensed under AGPLv3
// ===========================================

global.ROOTPATH = __dirname;

// ----------------------------------------
// Load Winston
// ----------------------------------------

var _isDebug = process.env.NODE_ENV === 'development';

global.winston = require('winston');
winston.remove(winston.transports.Console)
winston.add(winston.transports.Console, {
  level: (_isDebug) ? 'info' : 'warn',
  prettyPrint: true,
  colorize: true,
  silent: false,
  timestamp: true
});

// ----------------------------------------
// Fetch internal handshake key
// ----------------------------------------

if(!process.argv[2] || process.argv[2].length !== 40) {
	winston.error('[WS] Illegal process start. Missing handshake key.');
	process.exit(1);
}
global.WSInternalKey = process.argv[2];

// ----------------------------------------
// Load modules
// ----------------------------------------

winston.info('[AGENT] Background Agent is initializing...');

var appconfig = require('./models/config')('./config.yml');

global.git = require('./models/git').init(appconfig);
global.entries = require('./models/entries').init(appconfig);
global.mark = require('./models/markdown');

var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require("fs-extra"));
var path = require('path');
var cron = require('cron').CronJob;
var wsClient = require('socket.io-client');
global.ws = wsClient('http://localhost:' + appconfig.wsPort, { reconnectionAttempts: 10 });

// ----------------------------------------
// Start Cron
// ----------------------------------------

var jobIsBusy = false;
var job = new cron({
	cronTime: '0 */5 * * * *',
	onTick: () => {

		// Make sure we don't start two concurrent jobs

		if(jobIsBusy) {
			winston.warn('[AGENT] Previous job has not completed gracefully or is still running! Skipping for now. (This is not normal, you should investigate)');
			return;
		}
		winston.info('[AGENT] Running all jobs...');
		jobIsBusy = true;

		// Prepare async job collector

		let jobs = [];
		let repoPath = path.resolve(ROOTPATH, appconfig.datadir.repo);
		let uploadsPath = path.join(repoPath, 'uploads');

		// ----------------------------------------
		// Compile Jobs
		// ----------------------------------------

		//*****************************************
		//-> Resync with Git remote
		//*****************************************

		jobs.push(git.onReady.then(() => {
			return git.resync().then(() => {

				//-> Stream all documents

				let cacheJobs = [];
				let jobCbStreamDocs_resolve = null,
						jobCbStreamDocs = new Promise((resolve, reject) => {
							jobCbStreamDocs_resolve = resolve;
						});

				fs.walk(repoPath).on('data', function (item) {
					if(path.extname(item.path) === '.md') {

						let entryPath = entries.parsePath(entries.getEntryPathFromFullPath(item.path));
						let cachePath = entries.getCachePath(entryPath);
						
						//-> Purge outdated cache

						cacheJobs.push(
							fs.statAsync(cachePath).then((st) => {
								return moment(st.mtime).isBefore(item.stats.mtime) ? 'expired' : 'active';
							}).catch((err) => {
								return (err.code !== 'EEXIST') ? err : 'new';
							}).then((fileStatus) => {

								//-> Delete expired cache file

								if(fileStatus === 'expired') {
									return fs.unlinkAsync(cachePath).return(fileStatus);
								}

								return fileStatus;

							}).then((fileStatus) => {

								//-> Update cache and search index

								if(fileStatus !== 'active') {
									return entries.updateCache(entryPath);
								}

								return true;

							})

						);

					}
				}).on('end', () => {
					jobCbStreamDocs_resolve(Promise.all(cacheJobs));
				});

				return jobCbStreamDocs;

			});
		}));

		//*****************************************
		//-> Refresh uploads data
		//*****************************************

		jobs.push(fs.readdirAsync(uploadsPath).then((ls) => {

			return Promise.map(ls, (f) => {
				return fs.statAsync(path.join(uploadsPath, f)).then((s) => { return { filename: f, stat: s }; });
			}).filter((s) => { return s.stat.isDirectory(); }).then((arrStats) => {
				ws.emit('uploadsSetFolders', {
					auth: WSInternalKey,
					content: _.map(arrStats, 'filename')
				});
				return true;
			});

		}));

		// ----------------------------------------
		// Run
		// ----------------------------------------

		Promise.all(jobs).then(() => {
			winston.info('[AGENT] All jobs completed successfully! Going to sleep for now.');
		}).catch((err) => {
			winston.error('[AGENT] One or more jobs have failed: ', err);
		}).finally(() => {
			jobIsBusy = false;
		});

	},
	start: false,
	timeZone: 'UTC',
	runOnInit: true
});

// ----------------------------------------
// Connect to local WebSocket server
// ----------------------------------------

ws.on('connect', function () {
	winston.info('[AGENT] Background Agent started successfully! [RUNNING]');
	job.start();
});

ws.on('connect_error', function () {
	winston.warn('[AGENT] Unable to connect to WebSocket server! Retrying...');
});
ws.on('reconnect_failed', function () {
	winston.error('[AGENT] Failed to reconnect to WebSocket server too many times! Stopping agent...');
	process.exit(1);
});

// ----------------------------------------
// Shutdown gracefully
// ----------------------------------------

process.on('disconnect', () => {
	winston.warn('[AGENT] Lost connection to main server. Exiting...');
	job.stop();
	process.exit();
});

process.on('exit', () => {
	job.stop();
});