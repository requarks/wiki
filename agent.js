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
winston.info('[AGENT] Requarks Wiki BgAgent is initializing...');

var appconfig = require('./models/config')('./config.yml');

global.git = require('./models/git').init(appconfig, true);
global.entries = require('./models/entries').init(appconfig);
global.mark = require('./models/markdown');

var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
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

		// ----------------------------------------
		// Compile Jobs
		// ----------------------------------------

		//-> Resync with Git remote

		jobs.push(git.resync().then(() => {

			//-> Purge outdated cache

			return entries.purgeStaleCache();

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
	timeZone: 'UTC'
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