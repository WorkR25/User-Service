import UserSkill from '../db/models/userSkill.model';
import BaseRepository from './base.repository';

class UserSkillRepository extends BaseRepository<UserSkill>{

    constructor(){
        super(UserSkill);
    }

    async createUserSkills(userId: number, skillIds: number[]) {
        const updateUserSkills = await this.model.bulkCreate(
            skillIds.map((skillId) => ({ userId, skillId }))
        );
        return updateUserSkills;
    }

    async deleteUserSkills(userId: number, skillId: number) {
        await this.model.destroy({
            where: {
                userId,
                skillId
            }
        });
    }

    async findByBothId(id: number, skillId: number) {
        const record = await this.model.findOne({
            where: {
                userId: id,
                skillId
            }
        });
        return record;
    }

    async findByUserId(userId: number) {
        const userSkills = await this.model.findAll({
            where: {
                userId
            },
            attributes: ['skillId'],
        });
        return userSkills.map(skill => skill.skillId);
    }
}

export default UserSkillRepository;