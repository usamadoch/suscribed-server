import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createValidationError } from './errorHandler.js';

export const validate = (schema: z.ZodType) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        try {
            schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                const details: Record<string, string[]> = {};
                error.issues.forEach((issue) => {
                    const path = issue.path.join('.');
                    if (!details[path]) {
                        details[path] = [];
                    }
                    details[path].push(issue.message);
                });
                console.log('Validation failed details:', JSON.stringify(details, null, 2));
                return next(createValidationError(details));
            }
            next(error);
        }
    };
};
