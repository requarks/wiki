// ===========================================
// REQUARKS WIKI - Background Agent
// 1.0.0
// Licensed under AGPLv3
// ===========================================

global.PROCNAME = 'AGENT';
global.ROOTPATH = __dirname;
global.CORE_PATH = ROOTPATH + '/../core/';
global.IS_DEBUG = process.env.NODE_ENV === 'development';

// ----------------------------------------
// Load Winston
// ----------------------------------------

global.winston = require(CORE_PATH + 'core-libs/winston')(IS_DEBUG);

// ----------------------------------------
// Load global modules
// ----------------------------------------

winston.info('[AGENT] Background Agent is initializing...');

var appconfig = require(CORE_PATH + 'core-libs/config')('./config.yml');
global.db = require(CORE_PATH + 'core-libs/mongodb').init(appconfig);
global.upl = require('./libs/uploads-agent').init(appconfig);
global.git = require('./libs/git').init(appconfig);
global.entries = require('./libs/entries').init(appconfig);
global.mark = require('./libs/markdown');

// ----------------------------------------
// Load modules
// ----------------------------------------

var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require("fs-extra"));
var path = require('path');
var cron = require('cron').CronJob;

// ----------------------------------------
// Start Cron
// ----------------------------------------

var jobIsBusy = false;
var jobUplWatchStarted = false;

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
		let repoPath = path.resolve(ROOTPATH, appconfig.paths.repo);
		let dataPath = path.resolve(ROOTPATH, appconfig.paths.data);
		let uploadsPath = path.join(repoPath, 'uploads');
		let uploadsTempPath = path.join(dataPath, 'temp-upload');

		// ----------------------------------------
		// REGULAR JOBS
		// ----------------------------------------

		//*****************************************
		//-> Sync with Git remote
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
		//-> Clear failed temporary upload files
		//*****************************************

		jobs.push(
			fs.readdirAsync(uploadsTempPath).then((ls) => {

				let fifteenAgo = moment().subtract(15, 'minutes');

				return Promise.map(ls, (f) => {
					return fs.statAsync(path.join(uploadsTempPath, f)).then((s) => { return { filename: f, stat: s }; });
				}).filter((s) => { return s.stat.isFile(); }).then((arrFiles) => {
					return Promise.map(arrFiles, (f) => {

						if(moment(f.stat.ctime).isBefore(fifteenAgo, 'minute')) {
							return fs.unlinkAsync(path.join(uploadsTempPath, f.filename));
						} else {
							return true;
						}

					});
				});

			})
		);

		// ----------------------------------------
		// Run
		// ----------------------------------------

		Promise.all(jobs).then(() => {
			winston.info('[AGENT] All jobs completed successfully! Going to sleep for now.');

			if(!jobUplWatchStarted) {
				jobUplWatchStarted = true;
				upl.initialScan().then(() => {
					job.start();
				});
			}

			return true;

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