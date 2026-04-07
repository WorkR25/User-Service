import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import logger from '../configs/logger.config';
import CountryRepository from '../repository/country.repository';
import CountryService from '../services/country.service';

const countryRepository = new CountryRepository();

const countryService = new CountryService(countryRepository);

async function getCountryHandler(req: Request, res: Response, next: NextFunction){
    try {
        const country = req.query.name ;

        const response = await countryService.getCountryService(String(country));
        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Country fetched successfully',
            data: response,
            error: {}
        });
    } catch (error) {
        logger.error('country.controller/getCountryHandler ', {error});
        next(error);
    }
}

export default {
    getCountryHandler
};