import pino from 'pino';
import config from '../config/config.js';

const baseConfig = {
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'no-cache-parser' }
};

const transport = config.env.IS_DEVELOPMENT
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    }
  : undefined;

const logger = pino({ ...baseConfig, transport });

export function createLogger(context = {}) {
  if (!context || Object.keys(context).length === 0) {
    return logger;
  }
  return logger.child(context);
}

export default logger;
