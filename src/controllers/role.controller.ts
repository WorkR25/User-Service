import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import RoleRepository from '../repository/role.repository';
import UserRepository from '../repository/user.repository';
import RoleService from '../services/role.service';
import { AuthRequest } from '../types/AuthRequest';

const userRepository= new UserRepository();
const roleRepository= new RoleRepository();

const roleService= new RoleService(userRepository, roleRepository);

async function createRoles(req: AuthRequest , res: Response, next: NextFunction){
    try {
        const userId = Number(req.user?.id);
        const {name} = req.body;

        const createRolesData = {
            userId : Number(userId),
            name: name
        };

        const response = await roleService.createRoleService(createRolesData);

        res.status(201).json({
            success: true,
            message: 'Role created successfully',
            data: response,
            error: {}
        });

    } catch (error) {
        next(error);
    }
}

async function getRoles(req: Request , res: Response, next: NextFunction){
    try {
        const userId = req.params.id;
        const getRolesData = {
            userId: Number(userId) 
        };

        const response = await roleService.getRoleService(getRolesData);

        res.status(201).json({
            success: true,
            message: 'Role fetched successfully',
            data: response,
            error: {}
        });

    } catch (error) {
        next(error);
    }
}


async function deleteRoles(req: Request , res: Response, next: NextFunction){
    try {
        const userId = req.params.id;
        const {roleId} = req.body ;
        const deleteRolesData={
            userId :Number(userId),
            roleId

        };

        const response = await roleService.deleteRolesService(deleteRolesData);
        res.status(201).json({
            success: true,
            message: 'Role deleted successfully',
            data: response,
            error: {}
        });
        

    } catch (error) {
        next(error);
    }
}


async function updateRoles(req: Request , res: Response, next: NextFunction){
    try {
        const userId = req.params.id;
        const {roleId, name} = req.body;

        const updateRolesData= {
            userId: Number(userId),
            roleId,
            name
        };

        const response = await roleService.updateRolesService(updateRolesData);
        res.status(201).json({
            success: true,
            message: 'Role updated successfully',
            data: response,
            error: {}
        });
    } catch (error) {
        next(error);
    }
}

async function getRoleByNameHandler(req: Request , res: Response, next: NextFunction){
    try {
        const role = req.query.name ;
        const response = await roleService.getRoleByNameService(String(role));
        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Role fetched successfully',
            data: response,
            error: {}
        });
    } catch (error) {
        next(error);
    }
}

async function getUserRolesById(req: Request , res: Response, next: NextFunction){
    try {
        const userId = Number(req.params.id);
        const response = await roleService.getUserRolesByIdService(userId);
        res.status(StatusCodes.OK).json({
            success: true,
            message: 'User roles fetched successfully',
            data: response ,
            error: {}
        });
    } catch (error) {
        next(error);
    }
}


export default {
    createRoles,
    updateRoles,
    deleteRoles,
    getRoles,
    getRoleByNameHandler,
    getUserRolesById
};