<?php

namespace App\Domains\PhieuNhap\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\PhieuNhap;
use App\Models\ChiTietPhieuNhap;
use App\Models\SanPham;
use App\Models\NhaCungCap;
use App\Models\CapNhatTonKho;
use App\Domains\LoHang\Services\LoHangService;
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
        $nhaCungCap = NhaCungCap::find($validated['MaNhaCungCap']);
        if (!$nhaCungCap->TrangThai) {
            return response()->json([
                'success' => false,
                'message' => 'Nhà cung cấp đã ngừng hợp tác, không thể lập phiếu nhập.',
            ], 422);
        }
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
            $query = PhieuNhap::with(['nhaCungCap', 'chiTietPhieuNhap.loHang'])
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

    public function xacNhanNhanHang(Request $request, LoHangService $loHang, $id)
    {
        $validated = $request->validate([
            'ChiTiet'                      => 'required|array|min:1',
            'ChiTiet.*.MaChiTietPhieuNhap' => 'required|integer',
            'ChiTiet.*.HanSuDung'          => 'nullable|date_format:Y-m-d|after_or_equal:today',
        ], [
            'ChiTiet.*.HanSuDung.after_or_equal' => 'Hạn sử dụng không được trước ngày hôm nay (hàng đã hết hạn không thể nhập kho).',
            'ChiTiet.*.HanSuDung.date_format'    => 'Hạn sử dụng không hợp lệ.',
        ]);

        $maTaiKhoan = $request->user()->MaTaiKhoan;
        $han = collect($validated['ChiTiet'])->mapWithKeys(
            fn ($c) => [(int) $c['MaChiTietPhieuNhap'] => $c['HanSuDung'] ?? null]
        );

        try {
            $phieu = DB::transaction(function () use ($id, $han, $loHang, $maTaiKhoan) {
                $phieuNhap = PhieuNhap::with('chiTietPhieuNhap')->where('MaPhieuNhap', $id)->lockForUpdate()->first();
                if (!$phieuNhap) {
                    throw new \DomainException('Không tìm thấy phiếu nhập.', 404);
                }
                if ($phieuNhap->TrangThai == 4) {
                    throw new \DomainException('Phiếu nhập này đã được xác nhận nhận hàng trước đó rồi!', 400);
                }
                if ($phieuNhap->TrangThai != 2) {
                    throw new \DomainException('Phiếu nhập chưa được duyệt hoặc không ở trạng thái hợp lệ để nhận hàng!', 400);
                }

                $ids = $phieuNhap->chiTietPhieuNhap->pluck('MaChiTietPhieuNhap')->map(fn ($v) => (int) $v);
                if ($han->keys()->diff($ids)->isNotEmpty()) {
                    throw new \DomainException('Có dòng chi tiết không thuộc phiếu nhập này.', 422);
                }
                foreach ($ids as $maCT) {
                    if (!$han->has($maCT)) {
                        throw new \DomainException("Thiếu thông tin hạn sử dụng cho dòng chi tiết #{$maCT}.", 422);
                    }
                }

                // Mỗi dòng nhận hàng tạo một lô riêng
                foreach ($phieuNhap->chiTietPhieuNhap->sortBy('MaSanPham') as $ct) {
                    $loHang->nhapLo(
                        (int) $ct->MaSanPham,
                        (int) $ct->SoLuong,
                        $han->get((int) $ct->MaChiTietPhieuNhap),
                        "Nhận hàng - phiếu nhập #{$phieuNhap->MaPhieuNhap}",
                        $maTaiKhoan,
                        (int) $phieuNhap->MaPhieuNhap,
                        (int) $ct->MaChiTietPhieuNhap
                    );
                }

                // Giữ nguyên người lập và ngày lập của phiếu
                $phieuNhap->TrangThai = 4;
                $phieuNhap->save();

                return $phieuNhap->load('chiTietPhieuNhap.loHang');
            });
        } catch (\DomainException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], $e->getCode() ?: 400);
        } catch (\Throwable $e) {
            Log::error('Lỗi xác nhận nhận hàng: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Xác nhận nhận hàng thất bại: ' . $e->getMessage()], 500);
        }

        return response()->json(['success' => true, 'message' => 'Xác nhận nhận hàng thành công!', 'data' => $phieu], 200);
    }
}