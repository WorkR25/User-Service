import { CreationAttributes, Transaction } from 'sequelize';

import User from '../db/models/user.model';
import UserProfile from '../db/models/userProfile.model';
import { BadRequestError, NotFoundError } from '../utils/errors/app.error';
import BaseRepository from './base.repository';

class UserRepository extends BaseRepository<User> {
    constructor() {
        super(User);
    }

    async findByEmail(email: string): Promise<User | null>{
        const checkUser = await User.findOne({where : {email}});
        return checkUser;
    }
    async create(data: CreationAttributes<User>, transaction?: Transaction ): Promise<User> {
        const record = await this.model.create(data, { transaction });
        return record;
    }

    async softDelete(id: number): Promise<boolean> {
        const record = await this.model.findByPk(id);

        if (!record) {
            throw new NotFoundError('User not found');
        }

        if (record.deletedAt) {
            throw new BadRequestError('User already deleted');
        }

        record.deletedAt = new Date();
        await record.save();
        return true;
    }

    async findById (id: number): Promise<User | null> {
        const user = await this.model.findByPk(id, {
            attributes: ['fullName','email', 'phoneNo'],
            include: [
                {
                    association: User.associations.profile,
                    attributes: { exclude: ['userId']},
                    include: [
                        {
                            association: UserProfile.associations.currentLocation,
                            attributes: ['name']
                        }
                    ]
                },
                {
                    association: User.associations.skills,
                    attributes: ['name']
                }
            ]
        });
        return user;
    }
    
}

export default UserRepository;