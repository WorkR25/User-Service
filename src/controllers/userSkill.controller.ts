import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { CreateUserSkillDto, DeleteUserSkillDto } from '../dtos/userSkill.dto';
import SkillRepository from '../repository/skill.repository';
import UserRepository from '../repository/user.repository';
import UserSkillRepository from '../repository/userSkill.repository';
import UserSkillService from '../services/userSkill.service';

const userSkillRepository = new UserSkillRepository();
const userRepository = new UserRepository(); 
const skillRepository = new SkillRepository(); 
const userSkillService = new UserSkillService(userSkillRepository, userRepository, skillRepository);

async function createUserSkillHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.params.id;
        const {skillIds} = req.body;
        const data : CreateUserSkillDto = {
            userId: Number(userId),
            skilldIds: skillIds
        };
        const updatedUserSkills = await userSkillService.createUserSkillsService(data);
        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Succesfully added the user skills',
            data: {
                updatedUserSkills
            },
            error: {}
        });
    } catch (error) {
        next(error);
    }
}

async function deleteUserSkillHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.params.id;
        const {skillId} = req.body;
        const data : DeleteUserSkillDto = {
            userId: Number(userId),
            skillId: skillId
        };

        await userSkillService.deleteUserSkillsService(data);
        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Succesfully deleted the user skills',
            data: {
            },
            error: {}
        });
    } catch (error) {
        next(error);
    }
}


export default {
    createUserSkillHandler,
    deleteUserSkillHandler
};
