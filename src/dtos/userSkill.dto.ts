export type CreateUserSkillDto = {
    userId: number;
    skilldIds: number[];
}

export type DeleteUserSkillDto = {
    userId: number;
    skillId: number;
}