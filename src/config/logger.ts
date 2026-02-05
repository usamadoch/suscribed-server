import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';
import config from './index.js';

// Log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp, correlationId, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        const corrId = correlationId ? ` [${correlationId}]` : '';
        return `${timestamp}${corrId} ${level}: ${message}${metaStr}`;
    })
);

// Create logger
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || (config.env === 'production' ? 'info' : 'debug'),
    format: logFormat,
    defaultMeta: { service: 'patreon-mvp' },
    transports: [
        // Console transport
        new winston.transports.Console({
            format: config.env === 'production' ? logFormat : consoleFormat,
        }),
    ],
});

// Add file transports in production
if (config.env === 'production') {
    logger.add(new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }));
    logger.add(new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880,
        maxFiles: 5,
    }));
}

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            correlationId?: string;
        }
    }
}

// Correlation ID middleware
export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
            correlationId: req.correlationId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userAgent: req.headers['user-agent'],
            ip: req.ip,
        };

        if (res.statusCode >= 400) {
            logger.warn('Request completed with error', logData);
        } else {
            logger.info('Request completed', logData);
        }
    });

    next();
};

// Create child logger with correlation ID
export const createLogger = (correlationId?: string) => {
    return logger.child({ correlationId });
};

export default logger;
