// ===========================================
// REQUARKS WIKI - Background Agent
// 1.0.0
// Licensed under AGPLv3
// ===========================================

global.ROOTPATH = __dirname;

// ----------------------------------------
// Load modules
// ----------------------------------------

global.winston = require('winston');
winston.info('[AGENT] Background Agent is initializing...');

var appconfig = require('./models/config')('./config.yml');

global.git = require('./models/git').init(appconfig);
global.entries = require('./models/entries').init(appconfig);
global.mark = require('./models/markdown');
global.search = require('./models/search').init(appconfig);

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
var job = new cron({
	cronTime: '0 */5 * * * *',
	onTick: () => {

		// Make sure we don't start two concurrent jobs

		if(jobIsBusy) {
			winston.warn('[AGENT] Previous job has not completed gracefully or is still running! Skipping for now. (This is not normal, you should investigate)');
			return;
		}
		jobIsBusy = true;

		// Prepare async job collector

		let jobs = [];
		let repoPath = path.resolve(ROOTPATH, appconfig.datadir.repo);

		// ----------------------------------------
		// Compile Jobs
		// ----------------------------------------

		//-> Resync with Git remote

		jobs.push(git.onReady.then(() => {
			return git.resync().then(() => {

				//-> Stream all documents

				let cacheJobs = [];

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

								//-> Update search index

								if(fileStatus !== 'active') {
									return entries.fetchTextVersion(entryPath).then((content) => {
										console.log(content);
									});
								}

								return true;

							})

						);

					}
				});

				return Promise.all(cacheJobs);

			});
		}));

		// ----------------------------------------
		// Run
		// ----------------------------------------

		Promise.all(jobs).then(() => {
			winston.info('[AGENT] All jobs completed successfully! Going to sleep for now... [' + moment().toISOString() + ']');
		}).catch((err) => {
			winston.error('[AGENT] One or more jobs have failed [' + moment().toISOString() + ']: ', err);
		}).finally(() => {
			jobIsBusy = false;
		});

	},
	start: true,
	timeZone: 'UTC',
	runOnInit: true
});

// ----------------------------------------
// Shutdown gracefully
// ----------------------------------------

process.on('disconnect', () => {
	winston.warn('[AGENT] Lost connection to main server. Exiting... [' + moment().toISOString() + ']');
	job.stop();
	process.exit();
});

process.on('exit', () => {
	job.stop();
});