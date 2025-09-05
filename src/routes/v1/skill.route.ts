import { Router } from 'express';

import skillController from '../../controllers/skill.controller';
import authenticationMiddleware from '../../middlewares/auth.middleware';
import { validateRequestBody } from '../../validators';
import { createSkillSchema, deleteSkillsSchema, updateSkillSchema } from '../../validators/skill.validator';

const skillRouter = Router();

skillRouter.get('/', skillController.getSkillHandler );
skillRouter.get('/:id', skillController.getSkillByIdHandler );
skillRouter.post('/', authenticationMiddleware, validateRequestBody(createSkillSchema), skillController.createSkillHandler );
skillRouter.patch('/:id', authenticationMiddleware, validateRequestBody(updateSkillSchema), skillController.updateSkillHandler );
skillRouter.delete('/:id', authenticationMiddleware, validateRequestBody(deleteSkillsSchema), skillController.deleteSkillHandler );

export default skillRouter;