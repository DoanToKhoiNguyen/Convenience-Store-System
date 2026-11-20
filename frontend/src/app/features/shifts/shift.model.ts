export interface Shift {
    MaCa: number;
    TenCa: string;
    GioBatDau: string;
    GioKetThuc: string;
}

export interface WeekInfo {
    tu_ngay: string;
    den_ngay: string;
    han?: string;
    dang_mo?: boolean;
    la_tuan_dang_ky?: boolean;
}

export interface Slot {
    Ngay: string;
    MaCa: number;
}

export interface SlotInfo {
    Ngay: string;
    MaCa: number;
    so_nhan_vien: number;
    so_quan_ly: number;
    con_cho: boolean;
}

export interface ShiftLimit {
    nhan_vien: number;
    quan_ly: number;
}

export interface RegisterData {
    tuan: WeekInfo;
    ca: Shift[];
    da_chon: Slot[];
    da_ky: SlotInfo[];
    gioi_han: ShiftLimit;
}

export interface TimetableEntry {
    Ngay: string;
    MaCa: number;
    MaTaiKhoan: number;
    HoTen: string;
}

export interface TimetableData {
    tuan: WeekInfo;
    ca: Shift[];
    data: TimetableEntry[];
}