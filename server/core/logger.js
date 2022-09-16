// const _ = require('lodash')
const winston = require('winston')


/* global WIKI */

let WikiErrorFormat = winston.format((info)=>{
	
	var errorObject = null;
	
	if(info instanceof Error){
		errorObject = info;
	}
	else if(info.message instanceof Error){
		errorObject = info.message;
	}
	
	info._wiki_error = errorObject;
	
	return info;
})


let WikiLoggerPrintf = (info) =>{
		var msg = info.message;
		
		if(info._wiki_error){
			msg = info._wiki_error.stack;
		}
		
		
		
		return `${info.timestamp} [${info.label}] ${info.level}: ${msg}`;
		
	}



module.exports = {
  loggers: {},
  init(uid) {
    const loggerFormats = [
	  WikiErrorFormat(),
      winston.format.label({ label: uid }),
      winston.format.timestamp()
    ]

    if (WIKI.config.logFormat === 'json') {
      loggerFormats.push(winston.format.json())
    } else {
      loggerFormats.push(winston.format.colorize())
	  loggerFormats.push(winston.format.printf(WikiLoggerPrintf))
    }

    const logger = winston.createLogger({
      level: WIKI.config.logLevel
      ,format: winston.format.combine(...loggerFormats)
    })

    // Init Console (default)

    logger.add(new winston.transports.Console({
      level: WIKI.config.logLevel,
      prettyPrint: true,
      colorize: true,
      silent: false,
      timestamp: true
    }))

    // _.forOwn(_.omitBy(WIKI.config.logging.loggers, s => s.enabled === false), (loggerConfig, loggerKey) => {
    //   let loggerModule = require(`../modules/logging/${loggerKey}`)
    //   loggerModule.init(logger, loggerConfig)
    //   this.loggers[logger.key] = loggerModule
    // })

    return logger
  }
}
