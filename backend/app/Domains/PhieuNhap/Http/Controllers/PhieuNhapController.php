<?php

namespace App\Domains\PhieuNhap\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\PhieuNhap;
use App\Models\ChiTietPhieuNhap;
use App\Models\SanPham;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PhieuNhapController extends Controller
{
    public function store(Request $request)
    {
        // 1. Validate: Chỉ cần gửi MaNhaCungCap và danh sách sản phẩm kèm số lượng
        // Không cần bắt client gửi DonGia nữa vì Backend sẽ tự động tra cứu từ bảng SAN_PHAM
        $validated = $request->validate([
            'MaNhaCungCap' => 'required|exists:nha_cung_cap,MaNhaCungCap',
            'ChiTiet' => 'required|array|min:1',
            'ChiTiet.*.MaSanPham' => 'required|exists:san_pham,MaSanPham',
            'ChiTiet.*.SoLuong' => 'required|integer|min:1',
        ]);

        DB::beginTransaction();

        try {
            $tongGiaTri = 0;
            $chiTietData = [];

            // 2. DUYỆT QUA VÀ TỰ ĐỘNG LẤY ĐƠN GIÁ NHẬP TỪ BẢNG SẢN PHẨM
            foreach ($validated['ChiTiet'] as $item) {
                $sanPham = SanPham::find($item['MaSanPham']);

                $daCoPhieu = ChiTietPhieuNhap::where('MaSanPham', $item['MaSanPham'])
                    ->whereHas('phieuNhap', fn ($q) => $q->whereIn('TrangThai', [1, 2]))
                    ->exists();

                if ($daCoPhieu) {
                    throw new \Exception("Sản phẩm '{$sanPham->TenSanPham}' đang nằm trong một phiếu nhập chưa nhận hàng.");
                }

                // Kiểm tra xem sản phẩm có thực sự thuộc về nhà cung cấp này không (tùy chọn nhưng an toàn)
                if ($sanPham->MaNhaCungCap != $validated['MaNhaCungCap']) {
                    throw new \Exception("Sản phẩm '{$sanPham->TenSanPham}' không thuộc nhà cung cấp này.");
                }

                $soLuong = $item['SoLuong'];
                $donGiaNhap = $sanPham->DonGiaNhap; // 👈 Tự động lấy giá nhập chuẩn từ bảng sản phẩm
                
                // Backend tự tính: Tổng giá dòng = Số lượng * Đơn giá nhập
                $tongGiaDung = $soLuong * $donGiaNhap; 

                // Cộng dồn vào tổng giá trị của cả phiếu nhập
                $tongGiaTri += $tongGiaDung;

                // Gom dữ liệu chi tiết
                $chiTietData[] = [
                    'MaSanPham'     => $item['MaSanPham'],
                    'TenSanPham'    => $sanPham->TenSanPham, // Snapshot tên sản phẩm
                    'SoLuong'  => $soLuong,
                    'DonGia'   => $donGiaNhap,     // Lưu đơn giá nhập tại thời điểm tạo
                    'TongGia'  => $tongGiaDung,    // Lưu tổng giá dòng
                ];
            }

            $user = $request->user();
            $maTaiKhoan = $user ? $user->MaTaiKhoan : null;

            // 3. Tạo phiếu nhập chính (Header)
            $phieuNhap = PhieuNhap::create([
                'MaNhaCungCap' => $validated['MaNhaCungCap'],
                'MaTaiKhoan'   => $maTaiKhoan,
                'NgayLap'      => now(),
                'TrangThai'    => 1, // 1 = Chờ duyệt
                'TongGiaTri'   => $tongGiaTri, // Tổng tiền tự động cộng dồn
            ]);

            // 4. Lưu danh sách chi tiết vào database (Detail)
            foreach ($chiTietData as $chiTiet) {
                $chiTiet['MaPhieuNhap'] = $phieuNhap->MaPhieuNhap;
                ChiTietPhieuNhap::create($chiTiet);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Lập phiếu nhập hàng tự động thành công!',
                'data'    => $phieuNhap->load('chiTietPhieuNhap')
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            
            Log::error('Lỗi tạo phiếu nhập: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Lập phiếu nhập thất bại: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function duyetPhieuNhap($id)
    {
        DB::beginTransaction();

        try {
            // 1. Tìm phiếu nhập theo ID
            $phieuNhap = PhieuNhap::findOrFail($id);

            // 2. Kiểm tra nếu phiếu đã được duyệt rồi thì thông báo
            if ($phieuNhap->TrangThai == 2) {
                return response()->json([
                    'success' => false,
                    'message' => 'Phiếu nhập này đã ở trạng thái đã duyệt trước đó!',
                ], 400);
            }

            // 3. Chỉ thực hiện thay đổi trạng thái thành "Đã duyệt" (Ví dụ: TrangThai = 2)
            $phieuNhap->TrangThai = 2;
            $phieuNhap->save();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Duyệt phiếu nhập thành công!',
                'data'    => $phieuNhap
            ], 200);

        } catch (\Exception $e) {
            DB::rollBack();

            Log::error('Lỗi duyệt phiếu nhập: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Duyệt phiếu thất bại: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function huyPhieuNhap($id)
    {
        DB::beginTransaction();

        try {
            // 1. Tìm phiếu nhập theo ID
            $phieuNhap = PhieuNhap::findOrFail($id);

            // 2. Kiểm tra nếu phiếu đã ở trạng thái Đã hủy rồi thì không cho hủy nữa
            if ($phieuNhap->TrangThai == 3) { // Giả sử 3 là trạng thái Đã hủy
                return response()->json([
                    'success' => false,
                    'message' => 'Phiếu nhập này đã bị hủy trước đó rồi!',
                ], 400);
            }

            // (Tùy chọn) Nếu phiếu đã duyệt rồi (TrangThai == 2) thì có cho hủy không? 
            // Thường thì nếu đã duyệt kho rồi thì không cho hủy trực tiếp mà phải làm phiếu trả hàng, 
            // nhưng ở đây bạn đang để tách biệt kho nên có thể tùy chỉnh logic chặn ở đây nếu cần.

            // 3. Cập nhật trạng thái thành "Đã hủy" (Ví dụ: TrangThai = 3)
            $phieuNhap->TrangThai = 3; 
            $phieuNhap->save();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Hủy phiếu nhập thành công!',
                'data'    => $phieuNhap
            ], 200);

        } catch (\Exception $e) {
            DB::rollBack();

            Log::error('Lỗi hủy phiếu nhập: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Hủy phiếu thất bại: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function index(Request $request)
    {
        try {
            $query = PhieuNhap::with(['nhaCungCap', 'chiTietPhieuNhap'])
                ->orderBy('created_at', 'desc');

            // Nhân viên (vai trò 3) chỉ thấy phiếu đã duyệt (2) và đã nhận hàng (4)
            if ((int) $request->user()->MaVaiTro === 3) {
                $query->whereIn('TrangThai', [2, 4]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Lấy danh sách phiếu nhập thành công!',
                'data'    => $query->paginate(10),
            ], 200);
        } catch (\Exception $e) {
            Log::error('Lỗi lấy danh sách phiếu nhập: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Lấy danh sách thất bại: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function xacNhanNhanHang(Request $request, $id)
    {
        // 3. Validate: Yêu cầu truyền danh sách ngày sản xuất cho từng dòng chi tiết
        $validated = $request->validate([
            'ChiTiet' => 'required|array|min:1',
            'ChiTiet.*.MaChiTietPhieuNhap' => 'required|exists:chi_tiet_phieu_nhap,MaChiTietPhieuNhap',
            'ChiTiet.*.NgaySanXuat' => 'required|date',
        ]);

        DB::beginTransaction();

        try {
            // 1 & 2. Tìm phiếu nhập kèm theo chi tiết
            $phieuNhap = PhieuNhap::with('chiTietPhieuNhap')->findOrFail($id);

            // Kiểm tra trạng thái: Phải đã duyệt (TrangThai == 2) mới được nhận hàng
            if ($phieuNhap->TrangThai != 2) {
                return response()->json([
                    'success' => false,
                    'message' => 'Phiếu nhập chưa được duyệt hoặc không ở trạng thái hợp lệ để nhận hàng!',
                ], 400);
            }

            // Kiểm tra xem đã nhận hàng trước đó chưa (Tránh nhận 2 lần cộng kho nhầm)
            if ($phieuNhap->TrangThai == 4) { // 4 = Đã nhận hàng
                return response()->json([
                    'success' => false,
                    'message' => 'Phiếu nhập này đã được xác nhận nhận hàng trước đó rồi!',
                ], 400);
            }

            // Lấy thông tin nhân viên đang thực hiện xác nhận
            $user = $request->user();
            $maTaiKhoan = $user ? $user->MaTaiKhoan : null;

            // Chuyển mảng dữ liệu ngày sản xuất thành dạng key-value để dễ tra cứu theo MaChiTietPhieuNhap
            $ngaySanXuatMap = collect($validated['ChiTiet'])->pluck('NgaySanXuat', 'MaChiTietPhieuNhap');

            // 5 & 6. Duyệt qua từng dòng chi tiết để kiểm tra, lưu Ngày sản xuất và cộng tồn kho
            // 5 & 6. Duyệt qua từng dòng chi tiết để kiểm tra, lưu Ngày sản xuất và cộng tồn kho
            foreach ($phieuNhap->chiTietPhieuNhap as $chiTiet) {
                if (!isset($ngaySanXuatMap[$chiTiet->MaChiTietPhieuNhap])) {
                    throw new \Exception("Thiếu ngày sản xuất cho chi tiết sản phẩm ID: {$chiTiet->MaChiTietPhieuNhap}");
                }

                // DÙNG QUERY BUILDER ĐỂ CẬP NHẬT TRỰC TIẾP CỘT (VIẾT THƯỜNG) TRONG DB
                DB::table('chi_tiet_phieu_nhap')
                    ->where('MaChiTietPhieuNhap', $chiTiet->MaChiTietPhieuNhap)
                    ->update([
                        'ngay_san_xuat' => $ngaySanXuatMap[$chiTiet->MaChiTietPhieuNhap]
                    ]);

                // Cộng số lượng vào kho của sản phẩm tương ứng
                $sanPham = SanPham::find($chiTiet->MaSanPham);
                if ($sanPham) {
                    $sanPham->SoLuongHienTai += $chiTiet->SoLuong; 
                    $sanPham->save();
                }
            }

            // 7. Cập nhật trạng thái phiếu thành "Đã nhận hàng", lưu nhân viên xác nhận và thời gian
            $phieuNhap->TrangThai = 4; // 4 = Đã nhận hàng
            $phieuNhap->MaTaiKhoan = $maTaiKhoan; // Hoặc tên cột lưu mã nhân viên xác nhận của bạn
            $phieuNhap->NgayLap = now();
            $phieuNhap->save();

            DB::commit();

            // 8. Trả về thông báo thành công
            return response()->json([
                'success' => true,
                'message' => 'Xác nhận nhận hàng thành công!',
                'data'    => $phieuNhap->load('chiTietPhieuNhap')
            ], 200);

        } catch (\Exception $e) 
        {
            DB::rollBack();

            Log::error('Lỗi xác nhận nhận hàng: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Xác nhận nhận hàng thất bại: ' . $e->getMessage(),
            ], 500);
        }
    }
}