<?php

namespace App\Domains\ThongBao\Http\Controllers;

use App\Domains\LoHang\Services\LoHangService;
use App\Models\ChiTietPhieuNhap;
use App\Models\LoHang;
use App\Models\LoHangDaLoai;
use App\Models\PhieuNhap;
use App\Models\SanPham;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ThongBaoController
{
    // Chỉ đếm, không trả danh sách: sidebar gọi định kỳ nên phải thật nhẹ.
    public function chiSo(Request $request, LoHangService $loHang): JsonResponse
    {
        // Lô quá hạn được trừ khỏi tồn kho ngay khi ứng dụng hỏi số liệu
        $loHang->loaiLoHetHan();

        $laQuanLy = in_array((int) $request->user()->MaVaiTro, [1, 2], true);

        $pn = (new PhieuNhap)->getTable();
        $ct = (new ChiTietPhieuNhap)->getTable();

        // Hàng đang về (chờ duyệt + đã duyệt) thì không nhắc nữa.
        $dangNhap = DB::table("$ct as ct")
            ->join("$pn as pn", 'pn.MaPhieuNhap', '=', 'ct.MaPhieuNhap')
            ->whereIn('pn.TrangThai', [1, 2])
            ->groupBy(DB::raw('"ct"."MaSanPham"'))
            ->selectRaw('"ct"."MaSanPham", SUM("ct"."SoLuong") as tong')
            ->pluck('tong', 'MaSanPham');

        $canhBao = SanPham::where('TrangThai', true)
            ->whereColumn('SoLuongHienTai', '<=', 'TonKhoToiThieu')
            ->pluck('MaSanPham');

        // Đếm lô còn hàng sắp hết hạn theo ngưỡng CanhBaoHSD của từng sản phẩm.
        // Lô đã hết hạn được loại khỏi tồn kho ở trên nên không còn nằm trong cảnh báo.
        $soLoSapHetHan = 0;
        $los = LoHang::with('sanPham')
            ->where('SoLuongCon', '>', 0)
            ->whereNotNull('HanSuDung')
            ->get();
        foreach ($los as $lo) {
            $sp = $lo->sanPham;
            if (!$sp || ($sp->TrangThai !== null && !$sp->TrangThai)) {
                continue;
            }

            $trangThai = $loHang->moTa($lo, (int) ($sp->CanhBaoHSD ?? 0))['trang_thai'];
            if ($trangThai === 'sap_het_han') {
                $soLoSapHetHan++;
            }
        }

        return response()->json([
            'canh_bao_kho'      => $canhBao->filter(fn ($id) => (int) ($dangNhap[$id] ?? 0) === 0)->count(),
            'canh_bao_kho_tong' => $canhBao->count(),
            'lo_sap_het_han'    => $soLoSapHetHan,
            'lo_da_loai'        => LoHangDaLoai::count(),
            // Nhân viên không duyệt phiếu nên không cần nhắc.
            'phieu_cho_duyet'   => $laQuanLy ? PhieuNhap::where('TrangThai', 1)->count() : 0,
            'phieu_cho_nhan'    => PhieuNhap::where('TrangThai', 2)->count(),
        ]);
    }
}
