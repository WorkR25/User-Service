import { Request } from 'express';

import { UserTokenPayload } from './UserTokenPayload';

export type AuthRequest = Request & {
    user?: UserTokenPayload
};
