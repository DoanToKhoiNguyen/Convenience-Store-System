export const ROLE = {
    OWNER: 1,
    MANAGER: 2,
    STAFF: 3,
} as const;

export const ROLE_LABEL: Record<number, string> = {
    1: 'Chủ doanh nghiệp',
    2: 'Quản lý',
    3: 'Nhân viên',
};