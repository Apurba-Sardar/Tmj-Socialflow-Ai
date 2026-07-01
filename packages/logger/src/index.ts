import pino, { type LoggerOptions } from 'pino';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export const createLogger = (name: string, level: LogLevel = 'info') => {
  const options: LoggerOptions = {
    level,
    name,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  return pino(options);
};
