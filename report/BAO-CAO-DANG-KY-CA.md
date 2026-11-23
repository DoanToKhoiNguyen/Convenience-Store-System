# Báo cáo triển khai: Đăng ký ca làm việc & Thời khóa biểu

Ngày lập: 23/11/2026
Phạm vi: xử lý các mục **1 → 2 → 3 → 4 → 9** trong danh sách 20 điểm chưa ổn của tính năng đăng ký ca.

---

## 1. Tóm tắt

| Mục | Nội dung | Trạng thái |
|---|----------|-----------|
| 1 | Chống race condition khi nhiều người lưu cùng lúc | Đã sửa |
| 2 | Giao diện tự đồng bộ khi backend từ chối (422) | Đã sửa |
| 3 | Ca chỉ có quản lý không còn trông như ca trống trên thời khóa biểu | Đã sửa |
| 4 | Tooltip ô bị khóa nêu đúng lý do | Đã sửa |
| 9 | Feature test tự động cho quy tắc 2 NV / 1 QL | Đã thêm, 11 test pass |

Kết quả kiểm chứng:

- `php -l` trên controller: không lỗi cú pháp.
- `vendor/bin/phpunit` toàn bộ backend: **13 tests, 64 assertions — OK** (11 test mới + 2 test có sẵn).
- `npx tsc -p tsconfig.app.json --noEmit` (frontend): không lỗi.

Quy tắc nghiệp vụ được bảo đảm:

- Mỗi ca tối đa **2 nhân viên**.
- Quản lý/chủ được đăng ký chung ca với nhân viên, tổng tối đa **3 người**.
- Mỗi ca tối đa **1 quản lý/chủ**.
- Thời khóa biểu chỉ hiện **tên nhân viên**; sự có mặt của quản lý/chủ được đánh dấu bằng chip "Quản lý" kèm số lượng, không lộ tên.

---

## 2. Mục 1 — Chống race condition khi lưu đăng ký

### Vấn đề

`lockForUpdate()` chỉ khóa các dòng **đã tồn tại**. Khi một ca đang trống và nhiều người bấm lưu đồng thời, các request đều đọc thấy "0 người" rồi cùng ghi, có thể vượt giới hạn. Ràng buộc unique hiện có chỉ là `(MaTaiKhoan, NgayDangKy, MaCa)` — chống trùng của cùng một người, không chống vượt số chỗ.

### Giải pháp

Khóa theo tuần bằng cache lock của Laravel, bao trọn toàn bộ phần "đếm chỗ + ghi dữ liệu". Mọi lượt lưu trong cùng tuần được xếp hàng tuần tự.

`backend/app/Domains/CaLamViec/Http/Controllers/LichDangKyController.php` — `luuTuanSau()`:

```php
Cache::lock('dang-ky-ca:' . $tuan['tu_ngay'], 10)->block(
    5,
    function () use ($chon, $tuan, $user, $laQuanLy, $tenCa) {
        DB::transaction(function () use (...) {
            // xóa đăng ký cũ của chính người dùng trong tuần
            // đếm số NV/QL từng ca, ném ValidationException nếu vượt giới hạn
            // ghi đăng ký mới
        });
    },
);
```

Xử lý lỗi khóa:

```php
} catch (LockTimeoutException) {
    return response()->json([
        'message' => 'Có người khác đang lưu đăng ký cùng lúc, vui lòng thử lại sau vài giây.',
    ], 409);
} catch (UniqueConstraintViolationException $e) {
    return response()->json(['message' => 'Bạn vừa gửi đăng ký hai lần, vui lòng thử lại.'], 409);
}
```

Vì sao chọn cache lock thay vì đổi schema:

- Không cần bảng "chỗ ngồi" mới, không ảnh hưởng dữ liệu hiện có.
- `CACHE_STORE=database` trong môi trường thật và `array` trong test đều hỗ trợ `Cache::lock`.
- Thời gian giữ khóa 10 giây, chờ tối đa 5 giây: request xử lý xong rất nhanh, người chờ không bị treo lâu; quá hạn trả 409 để người dùng thử lại thay vì ghi sai dữ liệu.

---

## 3. Mục 2 — Đồng bộ giao diện khi lưu bị từ chối

### Vấn đề

Khi backend trả 422 (ca đã đầy hoặc đã có quản lý), frontend chỉ hiện lỗi. Các ô vẫn tick xanh theo lựa chọn cũ, người dùng bấm "Lưu" lại vẫn lỗi, trạng thái hiển thị lệch so với server. Ngoài ra banner thành công và banner lỗi có thể chồng nhau.

### Giải pháp — `frontend/src/app/features/shifts/shift-register.ts`

1. **Tải lại âm thầm** — thêm tham số `silent` cho `load()`:

```ts
load(silent = false) {
  if (!silent) { this.loading.set(true); this.error.set(null); }
  this.service.registration().subscribe({
    next: (d) => {
      this.data.set(d);
      if (silent) {
        // giữ lựa chọn chưa lưu, chỉ bỏ các ô đã hết chỗ
        const conCho = new Map<string, boolean>();
        for (const s of d.da_ky) {
          conCho.set(slotKey(String(s.Ngay).slice(0, 10), Number(s.MaCa)), s.con_cho);
        }
        this.selected.update((cur) => new Set([...cur].filter((k) => conCho.get(k) !== false)));
      } else {
        const set = new Set(d.da_chon.map((s) => slotKey(s.Ngay, s.MaCa)));
        this.selected.set(new Set(set));
        this.original.set(set);
      }
      this.loading.set(false);
    },
    error: (e) => { this.loading.set(false); if (!silent) this.error.set(...); },
  });
}
```

   - Chế độ thường: dựng lại `selected`/`original` từ server.
   - Chế độ âm thầm: không bật spinner, không đổi banner; lựa chọn đang có được giữ lại trừ những ô server báo `con_cho === false`.

2. **Sau khi lưu thành công**: xóa lỗi cũ, hiện thông báo thành công, rồi `load(true)` để cập nhật số chỗ mà bảng không nháy spinner (đồng thời xử lý luôn mục 7 trong danh sách gốc).

3. **Khi lưu lỗi**: xóa banner thành công trước khi hiện lỗi (hai banner loại trừ nhau), và nếu lỗi là 422 thì `load(true)` để kéo trạng thái mới nhất, tự bỏ các ô không còn hợp lệ.

---

## 4. Mục 3 — Hiển thị sự có mặt của quản lý trên thời khóa biểu

### Vấn đề

Backend cố ý ẩn tên quản lý/chủ khỏi thời khóa biểu, nhưng frontend cũng bỏ luôn dấu vết của họ: ca chỉ có quản lý trực hiện "—" như ca trống, dòng tổng kết cũng bỏ qua họ.

### Giải pháp

**Backend** — `thoiKhoaBieu()` trả thêm danh sách **đếm** quản lý theo từng ca, không kèm tên:

```php
$quanLy = DB::table('lich_dang_ky as ld')
    ->join('tai__khoan as tk', 'tk.MaTaiKhoan', '=', 'ld.MaTaiKhoan')
    ->where('ld.TrangThai', self::DA_DANG_KY)
    ->where('tk.TrangThai', true)
    ->whereIn('tk.MaVaiTro', [1, 2])
    ->whereBetween('ld.NgayDangKy', [$tuan['tu_ngay'], $tuan['den_ngay']])
    ->groupBy('ld.NgayDangKy', 'ld.MaCa')
    ->get([DB::raw('ld.NgayDangKy as Ngay'), 'ld.MaCa', DB::raw('COUNT(*) as so_luong')])
    ->map(fn ($r) => [
        'Ngay'     => Carbon::parse($r->Ngay)->toDateString(),
        'MaCa'     => (int) $r->MaCa,
        'so_luong' => (int) $r->so_luong,
    ])
    ->values();
```

Response bổ sung khóa `quan_ly` bên cạnh `tuan`, `ca`, `data`.

**Frontend**:

- `shift.model.ts`: thêm `TimetableManager { Ngay, MaCa, so_luong }` và `quan_ly` trong `TimetableData`.
- `shift.service.ts`: map `quan_ly` (mặc định `[]` nếu thiếu).
- `shift-timetable.ts`:
  - `managerGrid` (computed) + `managers(date, ca)` tra số quản lý theo ô.
  - Ô không còn hiện "—" nếu chỉ có quản lý; thay bằng chip trung tính khiên + "Quản lý" (không tên).
  - Góc phải mỗi ô hiện `x NV · y QL` khi có người.
  - Tiêu đề đổi thành "Tổng số ca của nhân viên" (khớp dữ liệu thực tế), header trang hiện "x lượt nhân viên", thêm ghi chú giải thích chip "Quản lý".

---

## 5. Mục 4 — Tooltip nêu đúng lý do khóa

### Vấn đề

`cellTitle()` cũ trả "Ca đã đủ người đăng ký" cho mọi ô bị khóa. Với quản lý, ô bị khóa vì **đã có quản lý khác**, không phải vì đủ nhân viên.

### Giải pháp

**Backend** — mỗi phần tử `da_ky` có thêm `ly_do_khoa`:

```php
$conCho = $laQuanLy
    ? $qlKhac < self::TOI_DA_QUAN_LY
    : $nvKhac < self::TOI_DA_NHAN_VIEN;

'ly_do_khoa' => $conCho ? null : ($laQuanLy ? 'da_co_quan_ly' : 'du_nhan_vien'),
```

**Frontend** — `cellTitle()` dùng lý do đó:

```ts
cellTitle(date: string, ca: number): string {
  if (!this.open()) return '';
  if (this.blocked(date, ca)) {
    return this.slotInfo(date, ca)?.ly_do_khoa === 'da_co_quan_ly'
      ? 'Ca đã có quản lý/chủ đăng ký'
      : `Ca đã đủ ${this.maxStaff()} nhân viên`;
  }
  const info = this.slotInfo(date, ca);
  return info
    ? `Đã đăng ký ${info.so_nhan_vien}/${this.maxStaff()} nhân viên`
    : `Còn trống ${this.maxStaff()}/${this.maxStaff()} nhân viên`;
}
```

Lưu ý thiết kế: `con_cho` được tính **loại trừ chính người đang xem** (xem `$nguoiKhac` trong controller). Nhờ vậy người đã đăng ký một ca vẫn giữ/hủy được ca đó kể cả khi ca đã đủ người; ô chỉ bị khóa với người **chưa** đăng ký.

---

## 6. Mục 9 — Feature test tự động

### File mới

`backend/tests/Feature/LichDangKyTest.php` — dùng `RefreshDatabase`, đóng băng thời gian ở **thứ 2, 23/11/2026 10:00** để tuần đăng ký luôn đang mở và ngày tháng ổn định.

Cấu trúc chung:

- 2 helper môi trường: một `Ca lam viec` (Ca sáng 06:00–12:00), `$this->thuHai` lấy từ `TuanLamViec::tuanDangKy()`.
- `nguoiDung($maVaiTro, $ten)` tạo tài khoản (`MaVaiTro`: `'1'` chủ, `'2'` quản lý, `'3'` nhân viên).
- `dangNhap($user)` tạo token Sanctum thật và gắn header `Bearer`. `TaiKhoan` không implement `Authenticatable` nên `Sanctum::actingAs()` không dùng được; đồng thời gọi `auth->forgetGuards()` vì trong một test, Laravel cache user đã resolve giữa các request.
- `luu($user, $slots)` gọi `PUT /api/dang-ky-ca/tuan-sau` với body `{ ChiTiet: [{ Ngay, MaCa }] }`.

### Danh sách test (11)

| # | Test | Kỳ vọng |
|---|------|---------|
| 1 | `test_hai_nhan_vien_dang_ky_cung_ca_thanh_cong` | 2 NV lưu OK, DB có 2 dòng |
| 2 | `test_nhan_vien_thu_ba_bi_chan_khi_ca_du_hai_nguoi` | 422, message "Ca Ca sáng ngày 30/11/2026 đã đủ 2 nhân viên.", DB vẫn 2 dòng |
| 3 | `test_quan_ly_dang_ky_chung_ca_voi_hai_nhan_vien` | QL + 2 NV OK, tổng 3 dòng |
| 4 | `test_quan_ly_thu_hai_bi_chan_trong_cung_ca` | QL thứ hai (chủ) bị 422 "đã có quản lý đăng ký. Mỗi ca chỉ một quản lý hoặc chủ." |
| 5 | `test_quan_ly_dang_ky_chung_ca_voi_mot_nhan_vien` | QL + 1 NV OK |
| 6 | `test_luu_danh_sach_rong_huy_toan_bo_dang_ky` | `ChiTiet: []` xóa hết, message "Đã hủy toàn bộ đăng ký tuần sau." |
| 7 | `test_ngay_ngoai_tuan_sau_bi_tu_choi` | 422 "Ngày 2026-12-10 không thuộc tuần sau." |
| 8 | `test_tuan_sau_tra_ve_tinh_trang_cho_trong_theo_vai_tro` | NV thứ ba thấy `con_cho=false`, `ly_do_khoa='du_nhan_vien'`; quản lý thấy `con_cho=true`, `ly_do_khoa=null`; `gioi_han` = 2/1 |
| 9 | `test_nhan_vien_da_dang_ky_van_thay_ca_cua_minh_con_cho` | Người đã đăng ký vẫn thấy `con_cho=true` và `da_chon` đúng |
| 10 | `test_thoi_khoa_bieu_chi_hien_ten_nhan_vien_va_dem_so_quan_ly` | `data` chỉ có tên NV; `quan_ly` = `[{ Ngay, MaCa, so_luong: 2 }]` (quản lý + chủ) |
| 11 | `test_tai_khoan_bi_khoa_khong_hien_trong_thoi_khoa_bieu_va_khong_tinh_cho` | Tài khoản bị khóa không tính chỗ, không hiện tên, nhưng dòng đăng ký vẫn còn trong DB |

### Lưu ý vận hành môi trường test

- `phpunit.xml` cấu hình SQLite `:memory:`. PHP trên máy hiện tại **chưa bật** `pdo_sqlite` trong `php.ini` (DLL đã có trong `D:\php\ext`), nên chạy test bằng:

```bash
cd backend
php -d extension=pdo_sqlite vendor/bin/phpunit
```

  (`php artisan test` không dùng được vì lệnh này sinh tiến trình con không kế thừa cờ `-d`.)
- Nếu sau này cần `artisan test`, bật `extension=pdo_sqlite` trong `php.ini` hoặc cài PHP có sẵn driver.

### Kết quả chạy

```
PHPUnit 12.5.40 ... OK (13 tests, 64 assertions)
```

Frontend: `npx tsc -p tsconfig.app.json --noEmit` → không lỗi.

### Sự cố phát sinh khi chạy PostgreSQL (đã sửa)

Lần đầu triển khai, truy vấn tổng hợp quản lý dùng `DB::raw('ld.NgayDangKy as Ngay')`. PostgreSQL hạ chữ thường mọi định danh không có ngoặc kép, nên câu SQL thành `ld.ngaydangky` và báo:

```
SQLSTATE[42703]: Undefined column: column ld.ngaydangky does not exist
```

Nguyên nhân: cột thật được tạo bằng `$table->date('NgayDangKy')` → Postgres lưu là `"NgayDangKy"` (phân biệt hoa thường). SQLite không phân biệt hoa thường nên test không phát hiện.

Cách sửa: truyền tên cột qua `select([...])` để query grammar tự bọc ngoặc kép, chỉ giữ `DB::raw` cho biểu thức `COUNT(*)`:

```php
->select([
    'ld.NgayDangKy as Ngay',
    'ld.MaCa',
    DB::raw('COUNT(*) as so_luong'),
])
->get()
```

SQL sinh ra trên Postgres: `"ld"."NgayDangKy" as "Ngay"`. Sau khi sửa, endpoint `/api/lich-lam-viec` chạy đúng trên PostgreSQL.

---

## 7. Tổng hợp file thay đổi

| File | Thay đổi |
|------|----------|
| `backend/app/Domains/CaLamViec/Http/Controllers/LichDangKyController.php` | Cache lock theo tuần + bắt `LockTimeoutException` (mục 1); `ly_do_khoa` trong `da_ky` (mục 4); tổng hợp `quan_ly` trong `thoiKhoaBieu` (mục 3) |
| `frontend/src/app/features/shifts/shift.model.ts` | `SlotInfo.ly_do_khoa`, `TimetableManager`, `TimetableData.quan_ly` |
| `frontend/src/app/features/shifts/shift.service.ts` | Map `da_ky`, `gioi_han`, `quan_ly` từ response |
| `frontend/src/app/features/shifts/shift-register.ts` | `load(silent)`, đồng bộ sau 422/thành công, banner loại trừ nhau, `cellTitle()` theo `ly_do_khoa` |
| `frontend/src/app/features/shifts/shift-timetable.ts` | Chip "Quản lý", bộ đếm `NV · QL`, tiêu đề tổng kết rõ nghĩa |
| `backend/tests/Feature/LichDangKyTest.php` | **Mới** — 11 feature test |
| `report/BAO-CAO-DANG-KY-CA.md` | **Mới** — báo cáo này |

Không đổi schema, không đổi route, không đổi payload request. Response chỉ **bổ sung** khóa (`ly_do_khoa`, `quan_ly`, `gioi_han`) nên client cũ không vỡ.

---

## 8. Hợp đồng API sau thay đổi

`GET /api/dang-ky-ca/tuan-sau` (vai trò 1, 2, 3):

```jsonc
{
  "tuan": { "tu_ngay": "2026-11-30", "den_ngay": "2026-12-06", "han": "...", "dang_mo": true },
  "ca": [ { "MaCa": 1, "TenCa": "Ca sáng", "GioBatDau": "06:00", "GioKetThuc": "12:00" } ],
  "da_chon": [ { "Ngay": "2026-11-30", "MaCa": 1 } ],
  "da_ky": [
    {
      "Ngay": "2026-11-30",
      "MaCa": 1,
      "so_nhan_vien": 2,
      "so_quan_ly": 1,
      "con_cho": false,          // tính theo vai trò người xem, loại trừ chính họ
      "ly_do_khoa": "du_nhan_vien" // hoặc "da_co_quan_ly" / null
    }
  ],
  "gioi_han": { "nhan_vien": 2, "quan_ly": 1 }
}
```

`PUT /api/dang-ky-ca/tuan-sau`:

- 200: `{ message }` ("Đã lưu N ca đăng ký cho tuần sau." / "Đã hủy toàn bộ đăng ký tuần sau.")
- 422: hết hạn tuần, ngày ngoài tuần, vượt giới hạn (message nêu tên ca + ngày).
- 409: tranh khóa hoặc gửi trùng.

`GET /api/lich-lam-viec?tu_ngay=YYYY-MM-DD` (vai trò 1, 2):

```jsonc
{
  "tuan": { "tu_ngay": "...", "den_ngay": "...", "la_tuan_dang_ky": true },
  "ca": [ ... ],
  "data": [ { "Ngay": "...", "MaCa": 1, "MaTaiKhoan": 5, "HoTen": "Nguyễn Văn A" } ], // chỉ nhân viên
  "quan_ly": [ { "Ngay": "2026-11-24", "MaCa": 1, "so_luong": 2 } ]                    // chỉ đếm, không tên
}
```

---

## 9. Các mục chưa xử lý (ngoài phạm vi lần này)

| # | Nội dung | Ghi chú |
|---|---------|---------|
| 5–6 | Nhãn `x/2` gây hiểu nhầm với quản lý | Đề xuất hiển thị `x/3` tổng hoặc tách "NV + QL" |
| 7 | Nhấp nháy sau khi lưu | Đã giải quyết một phần nhờ `load(true)` của mục 2 |
| 8 | Nhãn "Tổng số ca của nhân viên" | Đã đổi chữ ở mục 3 |
| 10 | Hardcode "tối đa 3 người" trong ghi chú | Nên dùng `gioi_han.nhan_vien + gioi_han.quan_ly` |
| 11 | Dữ liệu cũ vượt giới hạn (quản lý chèn thành người thứ 4) | Cần bước rà dữ liệu một lần |
| 12 | Đổi vai trò giữa tuần tạo 2 quản lý trong ca cũ | Edge case, cần kiểm tra khi đổi vai trò |
| 13 | Icon khiên `text-[8px]` khó thấy, thiếu legend | Nên tăng lên `text-[10px]` + chú giải dưới bảng |
| 14 | Ô khóa chưa có `aria-label` lý do | Cải thiện khả năng tiếp cận |
| 15 | Câu "Còn trống 2/2 nhân viên" chưa tự nhiên | Đổi thành "Còn 2 chỗ" |
| 16 | Ô trống không hiện `0/2` | Nhất quán số đếm |
| 17 | "x người" trên thời khóa biểu | Đã đổi thành `x NV · y QL` ở mục 3 |
| 18 | Thiếu index `lich_dang_ky (NgayDangKy, MaCa)` | Cân nhắc migration index khi dữ liệu lớn |
| 19 | Chưa kiểm chứng AOT trên trình duyệt | `ng build` đang fail sẵn do thiếu `@angular/animations` |
| 20 | Xác nhận cách hiểu "không trùng ca" | Đang hiểu là mỗi ca tối đa 1 quản lý/chủ |

Ngoài ra, message lỗi hiện dựng bằng `"Ca {$tenCa}..."` trong khi `TenCa` đã có chữ "Ca" (ra "Ca Ca sáng..."). Đây là lỗi chữ nghĩa nhỏ, test đang bám đúng hành vi hiện tại; có thể sửa thành `"{$tenCa}"` nếu muốn.

---

## 10. Cách kiểm tra lại nhanh

```bash
# Backend — lint + test
cd backend
php -l app/Domains/CaLamViec/Http/Controllers/LichDangKyController.php
php -d extension=pdo_sqlite vendor/bin/phpunit

# Frontend — type-check
cd ../frontend
npx tsc -p tsconfig.app.json --noEmit
```

Kịch bản thủ công đề xuất trên UI (2 tài khoản trình duyệt ẩn danh):

1. NV A đăng ký ca sáng thứ 2 → lưu OK.
2. NV B đăng ký cùng ca → ô hiện 2/2.
3. NV C mở trang → ô khóa, tooltip "Ca đã đủ 2 nhân viên".
4. Quản lý D mở trang → ô còn chọn được, đăng ký → ô hiện 2/2 + khiên.
5. Quản lý E (hoặc chủ) mở trang → ô khóa, tooltip "Ca đã có quản lý/chủ đăng ký".
6. Thời khóa biểu: ca hiện tên A, B + chip "Quản lý" + dòng "2 NV · 1 QL", không có tên D/E.
