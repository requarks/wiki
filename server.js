// ===========================================
// REQUARKS WIKI
// 1.0.0
// Licensed under AGPLv3
// ===========================================

// ----------------------------------------
// Load modules
// ----------------------------------------

global.winston = require('winston');
winston.info('Requarks Wiki is initializing...');

global.ROOTPATH = __dirname;

var appconfig = require('./models/config')('./config.yml');
global.db = require('./models/db')(appconfig);
global.red = require('./models/redis')(appconfig);