import UserProfile from '../db/models/userProfile.model';
import { UpdateUserProfileDto } from '../dtos/userProfile.dto';
import UserProfileRepository from '../repository/userProfile.repository';

class UserProfileService {
    private userProfileRepository: UserProfileRepository;

    constructor(userProfileRepository: UserProfileRepository) {
        this.userProfileRepository = userProfileRepository;
    }

    async updateByIdService(updateUserProfileData : UpdateUserProfileDto): Promise<UserProfile> {
        const {id, ...data} = updateUserProfileData;
        const userProfile = await this.userProfileRepository.updateById(id, data);
        return userProfile;
    };
}

export default UserProfileService;