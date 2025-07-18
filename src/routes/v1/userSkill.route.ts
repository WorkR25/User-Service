import { Router } from 'express';

import userSkillController from '../../controllers/userSkill.controller';
import authenticationMiddleware from '../../middlewares/auth.middleware';
import { validateRequestBody } from '../../validators';
import { createUserSkillSchema, deleteUserSkillSchema } from '../../validators/userSkill.validator';
const userSkillRouter = Router();

userSkillRouter.post('/:id', authenticationMiddleware, validateRequestBody(createUserSkillSchema), userSkillController.createUserSkillHandler);
userSkillRouter.delete('/:id', authenticationMiddleware, validateRequestBody(deleteUserSkillSchema), userSkillController.deleteUserSkillHandler);
export default userSkillRouter;