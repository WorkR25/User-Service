import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import logger from '../configs/logger.config';
import { AppError } from '../utils/errors/app.error';

export const appErrorHandler = (error: AppError, _req: Request, res: Response, _next: NextFunction) => {
    res.status(error.statusCode).json({
        success: false,
        message: error.message,
        data: {},
        error
    });
};

export const genericErrorHandler = (error: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Generic error handler', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Something went wrong!',
        data: {},
        error
    });
};