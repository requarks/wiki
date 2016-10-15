// ===========================================
// REQUARKS WIKI - WebSocket Server
// 1.0.0
// Licensed under AGPLv3
// ===========================================

global.ROOTPATH = __dirname;
global.PROCNAME = 'WS';

// ----------------------------------------
// Load Winston
// ----------------------------------------

var _isDebug = process.env.NODE_ENV === 'development';
global.winston = require('./lib/winston')(_isDebug);

// ----------------------------------------
// Fetch internal handshake key
// ----------------------------------------

if(!process.argv[2] || process.argv[2].length !== 40) {
	winston.error('[WS] Illegal process start. Missing handshake key.');
	process.exit(1);
}
global.internalAuth = require('./lib/internalAuth').init(process.argv[2]);;

// ----------------------------------------
// Load global modules
// ----------------------------------------

winston.info('[WS] WS Server is initializing...');

var appconfig = require('./models/config')('./config.yml');
global.db = require('./models/mongo').init(appconfig);
global.upl = require('./models/ws/uploads').init(appconfig);
global.entries = require('./models/entries').init(appconfig);
global.mark = require('./models/markdown');
global.search = require('./models/ws/search').init(appconfig);

// ----------------------------------------
// Load local modules
// ----------------------------------------

var _ = require('lodash');
var express = require('express');
var path = require('path');
var http = require('http');
var socketio = require('socket.io');
var moment = require('moment');

// ----------------------------------------
// Define Express App
// ----------------------------------------

global.app = express();

// ----------------------------------------
// Controllers
// ----------------------------------------

app.get('/', function(req, res){
	res.send('Requarks Wiki WebSocket server');
});

// ----------------------------------------
// Start WebSocket server
// ----------------------------------------

winston.info('[SERVER] Starting WebSocket server on port ' + appconfig.wsPort + '...');

app.set('port', appconfig.wsPort);
var server = http.Server(app);
var io = socketio(server);

server.on('error', (error) => {
	if (error.syscall !== 'listen') {
		throw error;
	}

	switch (error.code) {
		case 'EACCES':
			console.error('Listening on port ' + appconfig.port + ' requires elevated privileges!');
			process.exit(1);
			break;
		case 'EADDRINUSE':
			console.error('Port ' + appconfig.port + ' is already in use!');
			process.exit(1);
			break;
		default:
			throw error;
	}
});

server.listen(appconfig.wsPort, () => {
	winston.info('[WS] WebSocket server started successfully! [RUNNING]');
});

io.on('connection', (socket) => {

	//-----------------------------------------
	// SEARCH
	//-----------------------------------------

	socket.on('searchAdd', (data) => {
		if(internalAuth.validateKey(data.auth)) {
			search.add(data.content);
		}
	});

	socket.on('searchDel', (data, cb) => {
		cb = cb || _.noop;
		if(internalAuth.validateKey(data.auth)) {
			search.delete(data.entryPath);
		}
	});

	socket.on('search', (data, cb) => {
		cb = cb || _.noop;
		search.find(data.terms).then((results) => {
			cb(results);
		});
	});

	//-----------------------------------------
	// UPLOADS
	//-----------------------------------------

	socket.on('uploadsSetFolders', (data) => {
		if(internalAuth.validateKey(data.auth)) {
			upl.setUploadsFolders(data.content);
		}
	});

	socket.on('uploadsGetFolders', (data, cb) => {
		cb = cb || _.noop;
		cb(upl.getUploadsFolders());
	});

	socket.on('uploadsValidateFolder', (data, cb) => {
		cb = cb || _.noop;
		if(internalAuth.validateKey(data.auth)) {
			cb(upl.validateUploadsFolder(data.content));
		}
	});

	socket.on('uploadsCreateFolder', (data, cb) => {
		cb = cb || _.noop;
		upl.createUploadsFolder(data.foldername).then((fldList) => {
			cb(fldList);
		});
	});

	socket.on('uploadsSetFiles', (data) => {
		if(internalAuth.validateKey(data.auth)) {
			upl.setUploadsFiles(data.content);
		}
	});

	socket.on('uploadsAddFiles', (data) => {
		if(internalAuth.validateKey(data.auth)) {
			upl.addUploadsFiles(data.content);
		}
	});

	socket.on('uploadsGetImages', (data, cb) => {
		cb = cb || _.noop;
		cb(upl.getUploadsFiles('image', data.folder));
	});

});

// ----------------------------------------
// Shutdown gracefully
// ----------------------------------------

process.on('disconnect', () => {
	winston.warn('[WS] Lost connection to main server. Exiting... [' + moment().toISOString() + ']');
	server.close();
	process.exit();
});

process.on('exit', () => {
	server.stop();
});