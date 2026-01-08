import { CreationAttributes, Op, Transaction } from 'sequelize';

import User from '../db/models/user.model';
import UserProfile from '../db/models/userProfile.model';
import { BadRequestError, NotFoundError } from '../utils/errors/app.error';
import BaseRepository from './base.repository';

class UserRepository extends BaseRepository<User> {
    constructor() {
        super(User);
    }


    async findByName(
        fullName: string,
        limit: number ,
        offset: number
    ){
        const data = await this.model.findAndCountAll({
            where: {
                fullName: {
                    [Op.like]: `${fullName}%`,
                },
            },
            attributes: { exclude: ['password'] },
            limit,
            offset,
            order: [['createdAt', 'DESC']],
        });

        return data;
    }

    async findByEmailWithoutPassword(email: string): Promise<User | null>{
        const checkUser = await User.findOne({where : {email}, attributes: { exclude: ['password']}});
        return checkUser;
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
            attributes: ['fullName','email', 'phoneNo', 'id', 'graduationYear'],
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
                    attributes: ['id','name']
                },
                {
                    association: User.associations.roles,
                    attributes: ['id','name']
                }
            ]
        });
        return user;
    }

    async findAllCandidates({limit, offset}:{limit: number, offset: number}){
        const users = await this.model.findAndCountAll({
            attributes: ['fullName','email', 'phoneNo', 'id', 'graduationYear', 'created_at'],
            where: {
                deletedAt: {
                    [Op.eq]: null
                }
            },
            include: [
                {
                    association: User.associations.roles,
                    where: {
                        name: 'jobseeker'
                    }
                }
            ],
            order: [['created_at', 'DESC']],
            limit,
            offset,
        });

        return users ;
    }

    async findAllCandidatesForCSV(): Promise<User[]>{
        const users = await this.model.findAll({
            attributes: ['fullName','email', 'phoneNo', 'graduationYear'],
            where: {
                deletedAt: {
                    [Op.eq]: null
                }
            },
            include: [
                {
                    association: User.associations.roles,
                    where: {
                        name: 'jobseeker'
                    },
                }
            ],
            order: [['created_at', 'DESC']],
        });

        return users ;
    }

    async getUserRolesById(userId: number){
        const user = await this.model.findByPk(userId, {
            include: [
                {
                    association: User.associations.roles,
                    attributes: ['name']
                }
            ]
        });
        
        if (!user) {
            throw new NotFoundError('User not found');
        }

        return user;
    }
    
}

export default UserRepository;