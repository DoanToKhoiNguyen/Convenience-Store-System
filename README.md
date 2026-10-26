## Công nghệ sử dụng

| Phần | Công nghệ |
|---|---|
| Backend | PHP 8.3+, **Laravel 12** (chế độ API) |
| Frontend | **Angular 19/20**, TypeScript (strict), Tailwind CSS, PrimeNG |
| Database | **PostgreSQL** |
| Cache / Queue | **Redis**, Laravel Horizon |
| Xác thực / Phân quyền | Laravel Sanctum, spatie/laravel-permission |
| Real-time | Laravel Reverb (WebSocket) |
| Test | Pest / PHPUnit (backend), Jest + Playwright (frontend) |
| Chất lượng code | Larastan (PHPStan), Laravel Pint, ESLint, Prettier |
| Hạ tầng | Docker, Nginx, GitHub Actions |

## Kiến trúc tổng quan

```
Angular (Quản trị + POS + Trang khách)
        │  REST API (JSON, token Sanctum)
        ▼
Nginx → Laravel API (PHP 8.3)
        │
        ├─ PostgreSQL (dữ liệu chính)
        ├─ Redis (cache, queue, real-time)
        └─ S3 / MinIO (ảnh sản phẩm)
```

## Cấu trúc thư mục

```
convenience-store/
 ├─ backend/        # Laravel API (app/Domains chia theo nghiệp vụ)
 ├─ frontend/       # Angular (src/app/features chia theo tính năng)
 ├─ docker/         # Cấu hình nginx, php, postgres
 ├─ docs/           # Tài liệu: database, API, deploy, quy ước
 ├─ .github/
 │   └─ workflows/  # CI/CD
 ├─ docker-compose.yml
 └─ README.md
```

- **Backend:** mỗi nghiệp vụ (Catalog, Inventory, Sales, Staff, Promotion, Report, Auth) nằm trong `backend/app/Domains/`. Logic nghiệp vụ đặt ở `Actions/` và `Services/`, controller chỉ nhận request và trả response.
- **Frontend:** `core/` (auth, guard, interceptor), `shared/` (component dùng chung), `layouts/` (admin, POS, public), `features/` (pos, catalog, inventory, staff, promotion, reports, public).

## Yêu cầu cài đặt

| Công cụ | Phiên bản tối thiểu |
|---|---|
| PHP | 8.3 |
| Composer | 2.x |
| Node.js | LTS (20 trở lên) |
| Angular CLI | 19 trở lên |
| PostgreSQL | 15 |
| Redis | 7 |
| Docker + Docker Compose | bản mới nhất (nếu chạy bằng Docker) |
| Git | bản mới nhất |

## Cài đặt và chạy

### Dùng Docker (khuyên dùng)

```bash
git clone <URL-repo>
cd convenience-store

cp backend/.env.example backend/.env
docker compose up -d --build

docker compose exec backend composer install
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan migrate --seed

cd frontend
npm install
npm start
```

### Địa chỉ mặc định

| Dịch vụ | URL |
|---|---|
| Frontend (Angular) | http://localhost:4200 |
| Backend (Laravel API) | http://localhost:8000/api |
| Tài liệu API | http://localhost:8000/docs/api |

## Cấu hình môi trường

Các biến quan trọng trong `backend/.env`:

| Biến | Ý nghĩa |
|---|---|
| `APP_URL` | URL của backend |
| `FRONTEND_URL` | URL của frontend (dùng cho CORS, Sanctum) |
| `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | Kết nối PostgreSQL |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Kết nối Redis |
| `QUEUE_CONNECTION` | Nên đặt là `redis` |
| `SANCTUM_STATEFUL_DOMAINS` | Domain frontend được phép đăng nhập |
| `FILESYSTEM_DISK`, `AWS_*` | Nơi lưu ảnh sản phẩm (S3/MinIO) |
| `PAYMENT_*` | Khóa tích hợp thanh toán (VNPay, MoMo, PayOS), nếu có |

Frontend: chỉnh URL API trong `frontend/src/environments/`.

> **Không** commit file `.env` và không ghi mật khẩu, khóa API thật vào README hay mã nguồn.

## Tài khoản mẫu (chỉ dùng cho môi trường dev)

Được tạo bởi `php artisan migrate --seed`:

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Chủ | owner@example.com | `password` |
| Quản lý | manager@example.com | `password` |
| Nhân viên | staff@example.com | `password` |

> Đổi hoặc xóa các tài khoản này trước khi đưa lên môi trường thật.

## Chạy test và kiểm tra code

**Backend**

```bash
cd backend
php artisan test                    # Chạy test (Pest)
./vendor/bin/phpstan analyse        # Kiểm tra kiểu (Larastan)
./vendor/bin/pint                   # Format code
```

**Frontend**

```bash
cd frontend
npm run lint                        # ESLint
npm test                            # Test đơn vị
npx playwright test                 # Test E2E
```

## Tài liệu API

- Tài liệu tự sinh (Scramble/Swagger): `/docs/api`
- Quy ước API: xem `docs/api.md`

## Tài liệu khác

| File | Nội dung |
|---|---|
| `docs/database.md` | Sơ đồ bảng và quan hệ |
| `docs/api.md` | Quy ước API, mã lỗi, phân quyền endpoint |
| `docs/deploy.md` | Hướng dẫn triển khai |
| `docs/conventions.md` | Quy ước code, commit, nhánh |

## Triển khai (Deploy)

Tóm tắt các bước (chi tiết xem `docs/deploy.md`):

1. Chuẩn bị VPS có Docker, trỏ domain và cấu hình HTTPS (Nginx + Let's Encrypt).
2. Tạo `.env` production (`APP_ENV=production`, `APP_DEBUG=false`).
3. Build và chạy: `docker compose -f docker-compose.prod.yml up -d --build`.
4. Chạy migration: `php artisan migrate --force`.
5. Build frontend: `ng build` và phục vụ bằng Nginx.
6. Bật backup database tự động và giám sát lỗi (Sentry / Laravel Pulse).

## Quy ước làm việc

- **Nhánh:** `main` (ổn định), `develop` (đang phát triển), `feature/<ten-tinh-nang>`, `fix/<ten-loi>`.
- **Commit:** theo Conventional Commits, ví dụ `feat(pos): thêm phím tắt thanh toán`, `fix(inventory): sửa lỗi trừ kho trùng`.
- **Pull Request:** phải qua CI (test, lint, phpstan) trước khi merge.
- **Nguyên tắc nghiệp vụ bắt buộc:**
  - Tiền dùng kiểu `decimal` (hoặc số nguyên theo đồng), không dùng float.
  - Bán hàng và nhập kho phải nằm trong `DB::transaction()`, trừ kho dùng `lockForUpdate()`.
  - Mọi thay đổi tồn kho ghi vào `stock_movements`.
  - Hóa đơn đã chốt không sửa, chỉ tạo phiếu hoàn/hủy.

## Giấy phép và liên hệ

- Giấy phép: *(ghi loại license, hoặc "Nội bộ, không công khai")*
- Người phụ trách: *(tên, email liên hệ)*
