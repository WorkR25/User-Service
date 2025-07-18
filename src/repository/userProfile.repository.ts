import { CreationAttributes, Transaction } from 'sequelize';

import UserProfile from '../db/models/userProfile.model';
import BaseRepository from './base.repository';

class UserProfileRepository extends BaseRepository<UserProfile> {
    constructor() {
        super(UserProfile);
    }

    async create(data: CreationAttributes<UserProfile>, transaction?: Transaction ): Promise<UserProfile> {
        const record = await this.model.create(data, { transaction });
        return record;
    }

}

export default UserProfileRepository;