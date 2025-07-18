import { CreateUserSkillDto, DeleteUserSkillDto } from '../dtos/userSkill.dto';
import SkillRepository from '../repository/skill.repository';
import UserRepository from '../repository/user.repository';
import UserSkillRepository from '../repository/userSkill.repository';
import { NotFoundError } from '../utils/errors/app.error';

class UserSkillService {
    private userSkillRepository: UserSkillRepository;
    private userRepository: UserRepository;
    private skillRepository: SkillRepository; 

    constructor(userSkillRepository: UserSkillRepository, userRepository: UserRepository, skillRepository: SkillRepository) {
        this.userSkillRepository = userSkillRepository;
        this.userRepository = userRepository;
        this.skillRepository = skillRepository;
    }

    async createUserSkillsService(data: CreateUserSkillDto ) {
        const user = await this.userRepository.findById(data.userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        const checkValidSkill = await this.skillRepository.validateSkillIds(data.skilldIds);
        if(!checkValidSkill) {
            throw new NotFoundError('Invalid skill IDs provided');
        }

        const existingUserSkills = await this.userSkillRepository.findByUserId(data.userId);
        const newUserSkills = data.skilldIds.filter(item => !existingUserSkills.includes(item));

        const updatedUserSkills = await this.userSkillRepository.createUserSkills(data.userId, newUserSkills);
        return updatedUserSkills;
    }

    async deleteUserSkillsService(data: DeleteUserSkillDto  ) {
        const user = await this.userRepository.findById(data.userId);
        if (!user) {
            throw new NotFoundError('User not found');
        }

        const skillExists = await this.userSkillRepository.findByBothId(data.userId, data.skillId);
        if (!skillExists) {
            throw new NotFoundError('Skill not found');
        }
        const userSkills = await this.userSkillRepository.deleteUserSkills(data.userId, data.skillId);
        return userSkills;
    }

    
}

export default UserSkillService;