import { QueryInterface } from 'sequelize';

export default {
    async up(queryInterface: QueryInterface) {
        await queryInterface.bulkInsert('roles', [
            { name: 'admin' },
            { name: 'recruiter' },
            { name: 'jobseeker' },
            { name: 'operations_admin' },
        ]);
    },

    async down(queryInterface: QueryInterface) {
        await queryInterface.bulkDelete('roles', {}, {});
    },
};
