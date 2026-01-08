import { json2csv } from 'json-2-csv';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

import logger from '../configs/logger.config';
import sequelize from '../db/models/sequelize';
import User from '../db/models/user.model';
import { FindUserByNameDto, LoginUserDto, RegisterUserDto } from '../dtos/user.dto';
import { UpdateUserDto } from '../dtos/userProfile.dto';
import RoleRepository from '../repository/role.repository';
import UserRepository from '../repository/user.repository';
import UserProfileRepository from '../repository/userProfile.repository';
import UserRoleRepository from '../repository/userRole.repository';
import { checkPassword, createToken, verifyToken } from '../utils/auth/auth';
import { BadRequestError, InternalServerError, NotFoundError, UnauthorizedError } from '../utils/errors/app.error';


class UserService {
    private userRepository: UserRepository;
    private userProfileRepository : UserProfileRepository;
    private roleRepository: RoleRepository;
    private userRoleRepository: UserRoleRepository;

    constructor(userRepository: UserRepository, userProfileRepository: UserProfileRepository, roleRepository: RoleRepository, userRoleRepository: UserRoleRepository) {
        this.userRepository = userRepository;
        this.userProfileRepository = userProfileRepository;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
    }

    async findByNameService(data: FindUserByNameDto){
        try{
            const limit = Number.isNaN(data.limit) ? 10 : Number(data.limit);
            const page = Number.isNaN(data.page) ? 1 : Number(data.page);
            const offset = (page - 1) * limit;
            
            const users =await this.userRepository.findByName(data.fullName, limit, offset);
            return users ;
        }catch (error){
            logger.error('Something went wrong ', {error});
            throw new InternalServerError('Error while searching by full name ');
        }
    }

    async findByEmailService(email: string){
        try{
            const user = await this.userRepository.findByEmailWithoutPassword(email);
            return user ;
        }catch(error){
            logger.error('Something went wrong ', {error});
            throw new InternalServerError('Error while searching by email ');
        }
    }

    async createService(userData: RegisterUserDto) {
        try {
            const checkUser = await this.userRepository.findByEmail(userData.email);
            if (checkUser) {
                throw new BadRequestError('User already registered');
            }
            const roles = await this.roleRepository.getRoles('jobseeker');
            const roleId = roles[0].id ;
            const transaction = await sequelize.transaction();
            try {
                const newUser = await this.userRepository.create(userData, transaction);
                await this.userProfileRepository.create({ userId: newUser.id}, transaction);
                await this.userRoleRepository.createUserRole({userId: newUser.id, roleId: roleId, transaction});
                await transaction.commit();

                const jwtToken = createToken({id: newUser.id, email: newUser.email});

                return jwtToken ;

            } catch (error){
                await transaction.rollback();
                logger.error('Something went wrong ', {error});
                throw new InternalServerError('Error while creating user ');
            }
        } catch (error) {
            logger.error( error);
            throw new InternalServerError('Error While Creating User ');
        }
    }

    async loginService(userData: LoginUserDto){
        try {
            const checkUser = await this.userRepository.findByEmail(userData.email);

            if (!checkUser) {
                throw new NotFoundError('User not found');
            }
            
            const verified = await checkPassword(userData.password , checkUser.password);

            if(!verified) {
                throw new BadRequestError('Incorrect password');
            }

            const jwtToken = createToken({id: checkUser.id, email: checkUser.email});
            return jwtToken;

        } catch (error) {
            logger.error(error);
            throw new InternalServerError('Error while logging in');
        }
    }

    async findAllCandidatesService(userId: number, page: number, limit: number) {
        try {
            const userRoles = await this.userRepository.getUserRolesById(userId);
        
            const roleNames = userRoles.roles?.map((role) => role.name);
            if(!roleNames) {
                throw new NotFoundError('No roles found ');
            }
                
            if(!roleNames.includes('admin')){
                throw new UnauthorizedError('Not an admin');
            }

            const offset = (page - 1) * limit;


            const { rows: records, count: totalCount } = await this.userRepository.findAllCandidates({limit, offset});
            const totalPages = Math.ceil(totalCount / limit);

            return {
                records: records,
                pagination: {
                    totalCount,
                    totalPages,
                    currentPage: page,
                    limit,
                },
            };
        } catch (error) {
            logger.error(error);
            throw new InternalServerError('Error while creating user '); 
        }
    }

    async findByIdService(id: number) {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new NotFoundError('User not found');
        }
        return user;
    }

    async updateByIdService(userUpdateData: UpdateUserDto){
        const {id, ...data} = userUpdateData;
        return await this.userRepository.updateById(id, data);
    }

    async deleteById() {}

    async softDeleteService(id: number) {
        return await this.userRepository.softDelete(id);
    }

    async getAllCandidatesForCSVService({ userId }: { userId: number }) {
        try {
            const userRoles = await this.userRepository.getUserRolesById(userId);

            const roleNames = userRoles.roles?.map(r => r.name);
            if (!roleNames) throw new NotFoundError('No roles found');
            if (!roleNames.includes('admin'))
                throw new UnauthorizedError('Not an admin');

            const raw = await this.userRepository.findAllCandidatesForCSV();

            const records = raw.map((c) => {
                return c.get({ plain: true }) as User;
            });

            const csv = json2csv(records, { keys: [ 'fullName', 'email', 'phoneNo', 'graduationYear'] });
            return csv;

        } catch (error) {
            logger.error(error);
    
            if (error instanceof UnauthorizedError) throw error;

            throw new InternalServerError('Error while creating CSV');
        }
    }


    isAuthenticated(authToken: string){
        try {
            const decoded = verifyToken(authToken as string);
            return decoded;
            
        } catch (error) {
            if (error instanceof TokenExpiredError) {
                return new UnauthorizedError('Session expired. Please login again.');
            } else if (error instanceof JsonWebTokenError) {
                throw new UnauthorizedError('Invalid token');
            } else {
                throw new UnauthorizedError('Verification of token failed');
            }
      
        }
    }
}
export default UserService;