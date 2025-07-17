import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import UserRepository from '../repository/user.repository';
import UserProfileRepository from '../repository/userProfile.repository';
import UserService from '../services/user.service';

const userRepository = new UserRepository();
const userProfileRepository = new UserProfileRepository();

const userService = new UserService(userRepository, userProfileRepository);

async function uploadResumeHandler(req: Request, res: Response) {
    if (!req.file) {
        res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: 'No file uploaded',
            data: {},
            error: {
                message: 'Bad Request'
            }
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fileUrl = (req.file as any).location;

    res.status(StatusCodes.OK).json({
        success: true,
        message: 'Succesfully uploaded the resume',
        data: {
            fileUrl
        },
        error: {}
    });
}

async function getUserDetailsById(req: Request, res: Response, next: NextFunction) {
    try {
        const id = req.params.id;
        const userDetails = await userService.findByIdService(Number(id));
        
        res.status(StatusCodes.OK).json({
            success: true,
            message: 'User details retrieved successfully',
            data: userDetails,
            error: {}
        });

    } catch (error) {
        next(error); 
    }
    
}

export {
    getUserDetailsById,
    uploadResumeHandler};