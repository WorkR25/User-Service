import { QueryInterface } from 'sequelize';

export default {
    async up (queryInterface: QueryInterface) {
        await queryInterface.sequelize.query(`
            UPDATE user_profiles
            SET details = 'Student'
            WHERE details = 'Fresher';
        `);
    },

    async down (queryInterface: QueryInterface) {
        await queryInterface.sequelize.query(`
            UPDATE user_profiles
            SET details = 'Fresher'
            WHERE details = 'Student';
        `);
    }
};
