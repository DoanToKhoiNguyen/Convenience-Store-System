# Hệ thống quản lý cửa hàng tiện lợi

Ứng dụng quản lý cửa hàng tiện lợi: bán hàng tại quầy (POS), quản lý kho theo lô và hạn sử dụng, phiếu nhập hàng, khuyến mãi, ca làm việc và báo cáo doanh thu.

- **Backend:** REST API Laravel 13 (PHP 8.3), xác thực bằng token Laravel Sanctum.
- **Frontend:** Angular 22 (standalone component, signals), PrimeNG 22, Tailwind CSS v4.
- **Cơ sở dữ liệu:** PostgreSQL 16.
- **Hạ tầng dev:** Docker Compose (PostgreSQL, Redis, backend).

## 1. Tính năng chính

| Nhóm | Nội dung |
|---|---|
| Bán hàng (POS) | Tạo hóa đơn nháp, thêm sản phẩm, giữ hàng chờ thanh toán, thanh toán và trừ kho, hủy hóa đơn, xem lịch sử hóa đơn |
| Kho hàng | Sản phẩm, danh mục, nhà cung cấp; phiếu nhập (chờ duyệt → duyệt → nhận hàng theo từng lô + hạn sử dụng); cập nhật tồn kho; lịch sử tồn kho |
| Lô & hạn dùng | Mỗi lần nhận hàng tạo một lô riêng; cảnh báo lô sắp hết hạn / hết hạn; hủy lô hỏng |
| Cảnh báo kho | Sản phẩm tồn thấp hơn mức tối thiểu, gợi ý số lượng cần nhập, lập phiếu nhập nhanh theo nhà cung cấp |
| Khuyến mãi | Tạo, sửa, ngưng/bật lại chương trình khuyến mãi |
| Nhân sự | Đăng ký ca làm theo tuần, thời khóa biểu, quản lý tài khoản nhân viên (khóa/mở khóa, đặt lại mật khẩu) |
| Báo cáo | Doanh thu, nhập hàng |
| Khác | Trang sản phẩm công khai cho khách xem, hồ sơ cá nhân, chấm báo việc cần xử lý trên sidebar |

## 2. Quy tắc nghiệp vụ quan trọng

**Ca làm việc**
- Mỗi ca tối đa **2 nhân viên**.
- Quản lý/chủ được đăng ký chung ca với nhân viên, tổng tối đa **3 người** và tối đa **1 quản lý/chủ** mỗi ca.
- Vai trò được đọc tại thời điểm request: nhân viên được thăng chức giữa tuần thì đăng ký cũ lập tức tính là quản lý.
- Lưu đăng ký dùng cache lock theo tuần để chống ghi đè khi nhiều người lưu cùng lúc.
- Thời khóa biểu chỉ hiện tên nhân viên; quản lý/chủ hiển thị bằng chip "Quản lý" kèm số lượng.

**Tồn kho & lô hàng**
- Mọi thay đổi tồn kho đi qua `LoHangService`; `SoLuongHienTai` của sản phẩm luôn bằng tổng `SoLuongCon` của các lô.
- Xuất kho theo **FIFO**: trừ hết lô nhập trước mới sang lô nhập sau; lô đã hết hạn bị bỏ qua khi bán.
- Hủy hóa đơn đang giữ hàng thì hoàn đúng số lượng về từng lô đã trừ.
- Không cho tồn kho vượt mức tối đa của sản phẩm.

**Hóa đơn**
- Hóa đơn đưa vào hàng đợi được giữ hàng tối đa **60 phút**; quá hạn tự động hủy và hoàn kho (lệnh `hoa-don:huy-qua-han`, chạy mỗi phút).
- Hóa đơn nháp bỏ dở quá 1 ngày được dọn tự động.

**Tài khoản**
- Tài khoản bị khóa: request kế tiếp nhận **403** và toàn bộ token bị thu hồi; các request sau trả **401**.
- Mật khẩu mặc định của nhân viên mới là `123123`.
- Không xóa tài khoản, chỉ đặt lại mật khẩu hoặc khóa.

**Chấm báo trên sidebar**
- "Cảnh báo kho": số sản phẩm tồn thấp **chưa có phiếu nhập** đang chờ/đã duyệt.
- "Phiếu nhập": số phiếu **chờ duyệt** (chủ/quản lý) + **chờ nhận hàng** (mọi vai trò).
- Số liệu tự làm mới mỗi 60 giây, khi quay lại tab và khi chuyển trang.

## 3. Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Backend | Laravel 13.17, PHP 8.3, Laravel Sanctum (token), spatie/laravel-permission |
| Frontend | Angular 22 (standalone, signals, zoneless), PrimeNG 22, Tailwind CSS v4, echarts (báo cáo) |
| Cơ sở dữ liệu | PostgreSQL 16 |
| Cache / session / queue | Driver `database` (`.env.example`); Redis có trong docker-compose nhưng chưa dùng cho queue |
| Đóng gói dev | Docker Compose: `postgres`, `redis`, `backend` (`php artisan serve`) |
| Kiểm thử | PHPUnit 12 (backend) |

## 4. Cấu trúc thư mục

```
convenience-store/
├─ backend/                     # Laravel API
│  ├─ app/Domains/              # Chia theo nghiệp vụ
│  │  ├─ Auth/  BanHang/  BaoCao/  CaLamViec/  DanhMuc/
│  │  ├─ KhuyenMai/  LoHang/  NhaCungCap/  NhanVien/
│  │  └─ PhieuNhap/  SanPham/  ThongBao/
│  ├─ app/Http/Middleware/      # CheckRole (role), CheckAccountStatus (active)
│  ├─ routes/api.php            # Toàn bộ endpoint /api
│  ├─ database/seeders/         # Dữ liệu mẫu
│  └─ tests/Feature/            # Feature test
├─ frontend/                    # Angular
│  └─ src/app/
│     ├─ core/                  # auth, guards, interceptors, ui (chấm báo)
│     ├─ layouts/               # admin-layout, pos-layout, public-layout
│     ├─ features/              # sales, bill, purchases, stock, lots, products, ...
│     └─ shared/                # component/pipe dùng chung
├─ report/                      # Báo cáo triển khai
├─ docker-compose.yml
└─ README.md
```

## 5. Yêu cầu môi trường

| Công cụ | Phiên bản |
|---|---|
| PHP | 8.3+ (extension `pdo_pgsql`; `pdo_sqlite` nếu chạy test) |
| Composer | 2.x |
| Node.js | 20+ (khuyến nghị 22/24) |
| PostgreSQL | 16 (hoặc dùng container) |
| Docker + Docker Compose | Bản mới nhất (nếu chạy bằng Docker) |

## 6. Cài đặt và chạy

### 6.1. Chạy bằng Docker (khuyến nghị)

```bash
git clone <URL-repo>
cd convenience-store

cp backend/.env.example backend/.env
docker compose up -d --build

docker compose exec backend composer install
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate --seed
docker compose exec backend php artisan storage:link
```

Chạy frontend trên máy host:

```bash
cd frontend
npm install
npm start        # ng serve, proxy /api và /storage sang http://localhost:8000
```

Địa chỉ mặc định:

| Dịch vụ | URL / cổng |
|---|---|
| Frontend | http://localhost:4200 |
| API | http://localhost:8000/api |
| PostgreSQL | localhost:5432 (db `convenience_store`, user `admin`) |
| Redis | localhost:6379 |

Lệnh thường dùng:

```bash
docker compose exec backend php artisan migrate --force
docker compose exec backend php artisan route:clear
docker compose exec postgres psql -U admin -d convenience_store
```

### 6.2. Chạy trực tiếp trên máy (không Docker)

```bash
cd backend
composer install
cp .env.example .env
# Sửa .env: DB_HOST=127.0.0.1 và thông tin kết nối PostgreSQL
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
php artisan serve --port=8000

cd ../frontend
npm install
npm start
```

### 6.3. Tiến trình nền

`php artisan schedule:work` là bộ lập lịch (scheduler) của Laravel: chạy liên tục, mỗi phút kiểm tra các tác vụ khai báo trong `routes/console.php` và thực thi khi tới giờ. Trong dự án hiện có 2 việc phụ thuộc vào nó:

- Hủy hóa đơn giữ hàng quá hạn.
- Tự động loại các lô đã hết hạn khỏi tồn kho (`lo-hang:loai-het-han`), ghi vào tab "Đã loại" của trang cảnh báo hạn sử dụng.

Docker Compose hiện chỉ chạy web server nên scheduler không tự khởi động. **Mỗi lần khởi động lại dự án/container phải chạy lại lệnh dưới đây** trong một terminal riêng và để terminal mở (chỉ dừng khi `Ctrl+C`, đóng terminal hoặc tắt container):

```bash
docker compose exec backend php artisan schedule:work
```

Nếu không chạy scheduler, chức năng không mất hẳn nhưng có độ trễ: lô hết hạn vẫn được loại khi có người đăng nhập (app gọi `/api/thong-bao` mỗi 60 giây) hoặc khi mở trang cảnh báo hạn sử dụng; còn hóa đơn giữ hàng quá hạn thì chỉ được hủy khi scheduler chạy.

> Sau khi cập nhật code có tác vụ mới trong `routes/console.php`, cần `Ctrl+C` và chạy lại `schedule:work` để nó nạp lại danh sách tác vụ.

### 6.4. Chạy nhanh khi đã cài đặt xong

Mở 2 terminal tại thư mục gốc dự án:

```bash
# Terminal 1 - frontend
cd frontend
ng serve --proxy-config proxy.conf.json

# Terminal 2 - backend
cd backend
docker compose exec backend php artisan serve
```

- `ng serve --proxy-config proxy.conf.json` chạy Angular ở http://localhost:4200 và chuyển tiếp `/api`, `/storage` sang http://localhost:8000, nên phải chạy từ thư mục `frontend` (nơi có `proxy.conf.json`).
- `docker compose exec backend php artisan serve` mở server API trong container. Nếu container đã tự chạy `php artisan serve` (lệnh mặc định trong `docker-compose.yml`) thì bỏ qua lệnh này — chạy thêm sẽ báo lỗi cổng 8000 đã được dùng.

## 7. Tài khoản mẫu (sau khi seed)

| Vai trò | Tên đăng nhập | Mật khẩu |
|---|---|---|
| Chủ doanh nghiệp | `admin` | `123456` |
| Quản lý | `quanly` | `123456` |
| Nhân viên | `nhanvien01` | `123456` |

Nhân viên do chủ tạo mới trong ứng dụng có mật khẩu mặc định `123123`.

## 8. Kiểm thử

Backend (SQLite in-memory; trên Windows cần truyền rõ extension):

```bash
cd backend
php -d extension=pdo_sqlite vendor/bin/phpunit
```

Frontend — kiểm tra kiểu và build template:

```bash
cd frontend
npx tsc -p tsconfig.app.json --noEmit
npx ng build --configuration development
```

Lần chạy gần nhất: **19 test, 99 assertion — OK**; frontend build thành công.

## 9. Tài liệu

- [Báo cáo triển khai đăng ký ca làm việc](report/BAO-CAO-DANG-KY-CA.md)

## 10. API nhanh

- Đăng nhập: `POST /api/login` → trả token Sanctum; gửi kèm `Authorization: Bearer <token>` cho các endpoint khác.
- Thông tin cá nhân: `GET /api/me`, `PUT /api/me`, `PUT /api/me/mat-khau`.
- Bán hàng: `POST /api/hoa-don`, `POST /api/hoa-don/{maHD}/chi-tiet`, `PUT /api/hoa-don/{maHD}/thanh-toan`, `POST /api/hoa-don/{maHD}/cho-thanh-toan`.
- Kho: `GET /api/san-pham`, `GET /api/san-pham/canh-bao`, `GET /api/phieu-nhap`, `POST /api/phieu-nhap/{id}/duyet`, `PUT /api/phieu-nhap/{id}/nhan-hang`.
- Ca làm: `GET|PUT /api/dang-ky-ca/tuan-sau`, `GET /api/lich-lam-viec`.
- Chấm báo: `GET /api/thong-bao` (trả `canh_bao_kho`, `phieu_cho_duyet`, `phieu_cho_nhan`).

Phân quyền route theo vai trò 1 (chủ), 2 (quản lý), 3 (nhân viên) qua middleware `role`.
