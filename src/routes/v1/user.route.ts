import { Router } from 'express';

import { upload } from '../../configs/aws.config';
import {  getUserDetailsById, uploadResumeHandler } from '../../controllers/user.controller';
import authenticationMiddleware from '../../middlewares/auth.middleware';

const userRouter = Router();

userRouter.post('/upload-resume',authenticationMiddleware, upload.single('file'), uploadResumeHandler);
userRouter.get('/:id',authenticationMiddleware, getUserDetailsById);
export default userRouter;