import { z } from 'zod';

export const updateUserSchema = z.object({
    fullName: z
        .string({ required_error: 'Full name is required'})
        .min(4, { message: 'Full name must be at least 4 characters' })
        .max(50, { message: 'Full name must be less than 50 characters' })
        .optional(),
    email: z
        .string({ required_error: 'Email is required' })
        .email({ message: 'Invalid email address' })
        .optional(),
    password: z
        .string({ required_error: 'Password is required' })
        .min(8, { message: 'Password must be at least 8 characters' })
        .max(32, { message: 'Password must be less than 32 characters' })
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&^_-])[A-Za-z\d@$!%*#?&^_-]{8,}$/, {
            message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        })
        .optional(),
    phoneNo: z
        .string({ required_error: 'Phone number is required' })
        .regex(/^[6-9]\d{9}$/, { message: 'Phone number must be a valid 10-digit Indian mobile number' })
        .optional()
});

export const updateUserProfileSchema = z.object({
    bio: z
        .string({
            required_error: 'Bio is required',
        })
        .max(255, 'Bio must be at most 255 characters')
        .optional(),

    yearsOfExperience: z
        .number({
            required_error: 'Years of experience is required',
        })
        .int('Years of experience must be an integer')
        .nonnegative('Years of experience cannot be negative')
        .optional(),

    isFresher: z
        .boolean({
            required_error: 'Fresher status is required',
        })
        .optional(),

    currentCtc: z
        .number({
            required_error: 'Current CTC is required',
        })
        .nonnegative('CTC must be a non-negative number')
        .max(99999.99, 'CTC must be within 5 digits and 2 decimal places')
        .optional(),

    resumeUrl: z
        .string({
            required_error: 'Resume URL is required',
        })
        .url('Resume URL must be a valid URL')
        .max(255, 'Resume URL must be at most 255 characters')
        .optional(),

    linkedinUrl: z
        .string({
            required_error: 'LinkedIn URL is required',
        })
        .url('LinkedIn URL must be a valid URL')
        .max(255, 'LinkedIn URL must be at most 255 characters')
        .optional(),

    currentLocationId: z
        .number({
            required_error: 'Current location ID is required'
        })
        .int('Location ID must be an integer')
        .nonnegative('Location ID must be a non-negative number')
        .optional(),

    currentCompanyId: z
        .number({
            required_error: 'Current company ID is required'
        })
        .int('Company ID must be an integer')
        .nonnegative('Company ID must be a non-negative number')
        .optional(),
});


