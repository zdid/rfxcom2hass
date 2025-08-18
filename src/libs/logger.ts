import winston, { createLogger, transports, format } from "winston";
import path from 'path'

export type LogLevel = 'warn' | 'debug' | 'info' | 'error';
type WinstonLogLevel = 'warning' | 'debug' | 'info' | 'error';

const logToWinstonLevel = (level: LogLevel): WinstonLogLevel => level === 'warn' ? 'warning' : level;
const winstonToLevel = (level: WinstonLogLevel): LogLevel => level === 'warning' ? 'warn' : level;

const loggers: {[s:string]:Logger} = {}

export class Logger {
    private logger: winston.Logger;
    private name: string;
    private transportsToUse: winston.transport[];
    private level : LogLevel;
    static logLevel : LogLevel ;

    constructor(name: string,level?: LogLevel) {
        loggers[name] = this;
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
                    return `[${timestamp}][${label}] ${level}: ${message}`;
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
    
    setLevel(level: LogLevel, onlyMe: boolean = false): void {
        if(onlyMe == false ) {
            Object.values(loggers).forEach((log)=>{
                log.setLevel(level,true)
            })
        } else {
            this.level = level;
            this.logger.transports.forEach((transport) => transport.level = logToWinstonLevel(level as LogLevel));
            Logger.logLevel = level;
        }
    }
    formatMessage(...args: any[]): string {
        let message = '';
        if (args.length === 0) {
            return message;
        }
        for(let i = 0; i < args.length; i++) {
            if (typeof args[i] === 'object' && args[i] !== null) {
                message += ' '+JSON.stringify(args[i]);
            } else {
                message += ' '+args[i].toString();
            }
        }
        return message.trim();

    }
    warn(...args: any[]): void {
        this.logger.warn(this.formatMessage(...args));
    }
    
    warning(...args: any[]): void {
        this.logger.warn(this.formatMessage(...args));
    }
    
    info(...args: any[]): void {
        this.logger.info(this.formatMessage(...args));
    }

       
    debug(...args: any[]): void {
        this.logger.debug(this.formatMessage(...args));
    }
    
    error(...args: any[]): void {
        this.logger.error(this.formatMessage(...args));
    }
    
    isDebug() {
        return this.level === 'debug';
    }

    public static getLogger(name: string): Logger {
        return new Logger(name);
    }
}

const logger = Logger.getLogger('main');
export default logger;