import { Op } from 'sequelize';

import Skill from '../db/models/skill.model';
import BaseRepository from './base.repository';

class SkillRepository extends BaseRepository<Skill> {
    constructor() {
        super(Skill);
    }

    async validateSkillIds(skillIds: number[]) {
        const foundSkills = await this.model.findAll({
            where: {
                id: {
                    [Op.in]: skillIds
                }
            }
        });

        return foundSkills.length === skillIds.length;
    }


}

export default SkillRepository;