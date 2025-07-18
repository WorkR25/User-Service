import { z } from 'zod';

export const createUserSkillSchema = z.object({
    skillIds: z
        .array(z
            .number({ required_error: 'Skill ID must be a number' })
            .int({ message: 'Skill ID must be an integer' })
        ).nonempty({ message: 'At least one skill ID is required' })
});

export const deleteUserSkillSchema = z.object({
    skillId: z
        .number({ required_error: 'Skill ID is required' })
        .int({ message: 'Skill ID must be an integer' })
        .nonnegative({ message: 'Skill ID must be a non-negative number' })
});
