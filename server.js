// ===========================================
// REQUARKS WIKI
// 1.0.0
// Licensed under AGPLv3
// ===========================================

global.ROOTPATH = __dirname;

// ----------------------------------------
// Load global modules
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

winston.info('[SERVER] Requarks Wiki is initializing...');

var appconfig = require('./models/config')('./config.yml');
let lcdata = require('./models/localdata');

global.db = require('./models/db')(appconfig);
global.git = require('./models/git').init(appconfig, false);
global.entries = require('./models/entries').init(appconfig);
global.mark = require('./models/markdown');

// ----------------------------------------
// Load modules
// ----------------------------------------

var _ = require('lodash');
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var session = require('express-session');
var lokiStore = require('connect-loki')(session);
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var flash = require('connect-flash');
var compression = require('compression');
var passport = require('passport');
var autoload = require('auto-load');
var expressValidator = require('express-validator');
var http = require('http');

global.lang = require('i18next');
var i18next_backend = require('i18next-node-fs-backend');
var i18next_mw = require('i18next-express-middleware');

var mw = autoload(path.join(ROOTPATH, '/middlewares'));
var ctrl = autoload(path.join(ROOTPATH, '/controllers'));

// ----------------------------------------
// Define Express App
// ----------------------------------------

global.app = express();
var _isDebug = (app.get('env') === 'development');

// ----------------------------------------
// Security
// ----------------------------------------

app.use(mw.security);

// ----------------------------------------
// Passport Authentication
// ----------------------------------------

var strategy = require('./models/auth')(passport, appconfig);

app.use(cookieParser());
app.use(session({
  name: 'requarkswiki.sid',
  store: new lokiStore({ path: path.join(appconfig.datadir.db, 'sessions.db') }),
  secret: appconfig.sessionSecret,
  resave: false,
  saveUninitialized: false
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// ----------------------------------------
// Localization Engine
// ----------------------------------------

lang
  .use(i18next_backend)
  .use(i18next_mw.LanguageDetector)
  .init({
    load: 'languageOnly',
    ns: ['common'],
    defaultNS: 'common',
    saveMissing: false,
    supportedLngs: ['en', 'fr'],
    preload: ['en', 'fr'],
    fallbackLng : 'en',
    backend: {
      loadPath: './locales/{{lng}}/{{ns}}.json'
    }
  });

// ----------------------------------------
// View Engine Setup
// ----------------------------------------

app.use(compression());

app.use(i18next_mw.handle(lang));
app.set('views', path.join(ROOTPATH, 'views'));
app.set('view engine', 'pug');

app.use(favicon(path.join(ROOTPATH, 'assets', 'favicon.ico')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(expressValidator());

// ----------------------------------------
// Public Assets
// ----------------------------------------

app.use(express.static(path.join(ROOTPATH, 'assets')));

// ----------------------------------------
// View accessible data
// ----------------------------------------

app.locals._ = require('lodash');
app.locals.moment = require('moment');
app.locals.appconfig = appconfig;
app.use(mw.flash);

// ----------------------------------------
// Controllers
// ----------------------------------------

app.use('/', ctrl.auth);

app.use('/', ctrl.pages);
app.use('/admin', mw.auth, ctrl.admin);

// ----------------------------------------
// Error handling
// ----------------------------------------

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: _isDebug ? err : {}
  });
});

// ----------------------------------------
// Start HTTP server
// ----------------------------------------

winston.info('[SERVER] Starting HTTP server on port ' + appconfig.port + '...');

app.set('port', appconfig.port);
var server = http.createServer(app);
server.listen(appconfig.port);
server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  // handle specific listen errors with friendly messages
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

server.on('listening', () => {
  winston.info('[SERVER] HTTP server started successfully! [RUNNING]');
});

// ----------------------------------------
// Start child processes
// ----------------------------------------

var fork = require('child_process').fork,
    libInternalAuth = require('./lib/internalAuth'),
    internalAuthKey = libInternalAuth.generateKey();

var wsSrv = fork('ws-server.js', [internalAuthKey]),
    bgAgent = fork('agent.js', [internalAuthKey]);

process.on('exit', (code) => {
  wsSrv.disconnect();
  bgAgent.disconnect();
});