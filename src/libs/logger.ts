import winston, { createLogger, transports, format } from "winston";
import path from 'path'

type LogLevel = 'warn' | 'debug' | 'info' | 'error';
type WinstonLogLevel = 'warning' | 'debug' | 'info' | 'error';

const logToWinstonLevel = (level: LogLevel): WinstonLogLevel => level === 'warn' ? 'warning' : level;
const winstonToLevel = (level: WinstonLogLevel): LogLevel => level === 'warning' ? 'warn' : level;


export class Logger {

    private logger: winston.Logger;
    private name: string;
    private transportsToUse: winston.transport[];
    private level : LogLevel;
    static logLevel : LogLevel ;

    constructor(name: string,level?: LogLevel) {
        name = path.basename(name);
        console.log("create logger "+name);
        this.transportsToUse = [new transports.Console()];
        this.level =  level || 'info'

        this.logger = createLogger({
            transports: this.transportsToUse,
            format: format.combine(
                format((info) => {
                    info.level = info.level.toUpperCase();
                    return info;
                })(),
                format.colorize(),
                format.label({ label: name }),
                format.timestamp({ format: 'YYYY-MM-DD hh:mm:ss' }),
                format.printf(({ timestamp, label, level, message }) => {
                    return `[${timestamp}][${label}] ${level}: ${name}: ${message}`;
                })
            ),
          });
        this.name = name;
        if(! Logger.logLevel) {
            Logger.logLevel = level || 'info';
        }
        this.setLevel(level || Logger.logLevel);
    }


    getLevel(): LogLevel {
        return winstonToLevel(this.transportsToUse[0].level as WinstonLogLevel);
    }
    
    setLevel(level: LogLevel): void {
        this.level = level;
        this.logger.transports.forEach((transport) => transport.level = logToWinstonLevel(level as LogLevel));
        Logger.logLevel = level;
    }

    warn(message: string): void {
        // winston.config.syslog.levels doesn't have warn, but is required for syslog.
        this.logger.warn(message);
    }
    
    warning(message: string): void {
        this.logger.warn(message);
    }
    
    info(message: string): void {
        this.logger.info(message);
    }
    
    debug(message: string): void {
        this.logger.debug(message);
    }
    
    error(message: string): void {
        this.logger.error(message);
    }
    
    isDebug() {
        return this.level === 'debug';
    }

    public static getLogger(name: string): Logger {
        return new Logger(name);
    }
}

const logger = Logger.getLogger("RFXCOM2HASS");
export default logger;