import { NextFunction,  Response } from 'express';

import logger from '../configs/logger.config';
import UserRepository from '../repository/user.repository';
import UserProfileRepository from '../repository/userProfile.repository';                           
import UserService from '../services/user.service';
import { AuthRequest } from '../types/AuthRequest';
import { UserTokenPayload } from '../types/UserTokenPayload';
import { UnauthorizedError } from '../utils/errors/app.error';


const userRepository = new UserRepository();
const userProfileRepository = new UserProfileRepository();
const userService = new UserService(userRepository, userProfileRepository);

const authenticationMiddleware = (req : AuthRequest, _res: Response, next: NextFunction)=>{
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        logger.error('Authentication failed: No token provided');
        throw new UnauthorizedError('No token provided');
    }

    const decoded  = userService.isAuthenticated(authHeader);
    req.user = decoded as UserTokenPayload;
    next();
};

export default authenticationMiddleware;