export type UpdateUserProfileDto = {
    id: number;
    bio?: string;
    yearsOfExperience?: number;
    isFresher?: boolean;
    currentCtc?: number;
    linkedinUrl?: string;
    currentLocationId?: number; 
    currentCompanyId?: number;
}

export type UpdateUserDto = {
    id: number;
    fullName?: string;
    email?: string;
    phoneNo?: string;
    password?: string;
}