export type UpdateUserProfileDto = {
    id: number;
    bio?: string;
    yearsOfExperience?: number;
    details?: string;
    currentCtc?: string;
    linkedinUrl?: string;
    currentLocationId?: number; 
    currentCompany?: string;
    domain: string;
}

export type UpdateUserDto = {
    id: number;
    fullName?: string;
    email?: string;
    phoneNo?: string;
    password?: string;
}