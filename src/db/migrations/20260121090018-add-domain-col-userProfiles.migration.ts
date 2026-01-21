import { QueryInterface } from 'sequelize';

export default {
    async up (queryInterface: QueryInterface) {
        await queryInterface.sequelize.query(`
            ALTER TABLE user_profiles
            ADD COLUMN domain VARCHAR(255);
        `);
    },

    async down (queryInterface: QueryInterface) {
        await queryInterface.sequelize.query(`
            ALTER TABLE users
            DROP COLUMN domain;
        `);
    }
};
