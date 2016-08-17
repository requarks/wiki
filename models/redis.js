"use strict";

var Redis = require('ioredis'),
	_ = require('lodash');

/**
 * Redis module
 *
 * @param      {Object}  appconfig  Application config
 * @return     {Redis}   Redis instance
 */
module.exports = (appconfig) => {

	let rd = null;

	if(_.isArray(appconfig.redis)) {
		rd = new Redis.Cluster(appconfig.redis, {
			scaleReads: 'master',
			redisOptions: {
				lazyConnect: false
			}
		});
	} else {
		rd = new Redis(_.defaultsDeep(appconfig.redis), {
			lazyConnect: false
		});
	}

	// Handle connection errors

	rd.on('error', (err) => {
		winston.error('Failed to connect to Redis instance(s). [err-1]');
	});

	rd.on('node error', (err) => {
		winston.error('Failed to connect to Redis instance(s). [err-2]');
	});

	return rd;

};