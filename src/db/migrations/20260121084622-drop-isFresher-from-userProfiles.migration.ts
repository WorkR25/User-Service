import { QueryInterface } from 'sequelize';

export default {
    async up (queryInterface: QueryInterface) {
        await queryInterface.sequelize.query(`
            ALTER TABLE user_profiles
            DROP COLUMN is_fresher;
        `);
    },

    async down (queryInterface: QueryInterface) {
        await queryInterface.sequelize.query(`
            ALTER TABLE users
            ADD COLUMN is_fresher BOOLEAN;
        `);
    }
};
