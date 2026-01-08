import { Router } from 'express';

import roleController from '../../controllers/role.controller';
import authenticationMiddleware from '../../middlewares/auth.middleware';
import { validateRequestBody } from '../../validators';
import { CreateRoleSchema, DeleteRoleSchema, UpdateRoleSchema } from '../../validators/role.validator';

const roleRouter = Router();

roleRouter.get('/',authenticationMiddleware, roleController.getRoleByNameHandler);
roleRouter.get('/:id', authenticationMiddleware, roleController.getRoles);
roleRouter.get('/user/:id', authenticationMiddleware, roleController.getUserRolesById);
roleRouter.post('/', authenticationMiddleware, validateRequestBody(CreateRoleSchema), roleController.createRoles);
roleRouter.patch('/:id', authenticationMiddleware, validateRequestBody(UpdateRoleSchema), roleController.updateRoles);
roleRouter.delete('/:id', authenticationMiddleware, validateRequestBody(DeleteRoleSchema), roleController.deleteRoles);

export default roleRouter;