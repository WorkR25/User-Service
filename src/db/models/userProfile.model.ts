import { Association, CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, NonAttribute} from 'sequelize';

import City from './city.model';
import sequelize from './sequelize';
import User from './user.model';

class UserProfile extends Model<InferAttributes<UserProfile>, InferCreationAttributes<UserProfile>> {
    declare userId: ForeignKey<User['id']>;
    declare bio: CreationOptional<string | null>;
    declare yearsOfExperience: CreationOptional<number | null>;
    declare details: CreationOptional<string | null>;
    declare currentCtc: CreationOptional<string | null>;
    declare resumeUrl: CreationOptional<string | null>;
    declare linkedinUrl: CreationOptional<string | null>;
    declare currentCompany: CreationOptional<string | null>;
    declare domain: CreationOptional<string | null>;
    declare currentLocationId: CreationOptional<ForeignKey<City['id'] | null>>;

    declare user?: NonAttribute<User>;
    declare currentLocation?: NonAttribute<City>;

    static associations: { 
        user: Association<UserProfile, User>
        currentLocation: Association<UserProfile, City>
    };
}

UserProfile.init({
    userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        },
        onDelete: 'CASCADE',
    },

    bio: {
        type: DataTypes.STRING(255),
        allowNull: true
    },

    yearsOfExperience: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
    },

    details: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },

    currentCtc: {
        type: DataTypes.STRING(255),
        allowNull: true
    },

    resumeUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },

    linkedinUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },

    currentLocationId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
            model: City,
            key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
    },

    currentCompany: {
        type: DataTypes.STRING(255),
        allowNull: true
    },

    domain: {
        type: DataTypes.STRING(255),
        allowNull: true
    }
}, {
    tableName: 'user_profiles',
    sequelize,
    underscored: true,
    timestamps: false
});

export default UserProfile;