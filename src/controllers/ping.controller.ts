import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export function pingHandler(_req: Request, res: Response) {
    res.status(StatusCodes.OK).json({
        success: true,
        message: 'Pong'
    });
}