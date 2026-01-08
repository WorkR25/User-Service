  
export const allROLE = {
    ADMIN: 'admin',
    OPERATIONS_ADMIN: 'operations_admin',
} as const;

export type allRole = typeof allROLE[keyof typeof allROLE];