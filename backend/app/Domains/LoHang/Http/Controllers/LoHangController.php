<?php

namespace App\Domains\LoHang\Http\Controllers;

use App\Domains\LoHang\Services\LoHangService;
use App\Http\Controllers\Controller;
use App\Models\LoHang;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LoHangController extends Controller
{
    public function __construct(private LoHangService $service)
    {
    }

    /** Các lô đã hết hạn hoặc sắp hết hạn theo CanhBaoHSD của từng sản phẩm. */
    public function canhBao(): JsonResponse
    {
        $ds = [];
        $los = LoHang::with('sanPham')
            ->where('SoLuongCon', '>', 0)
            ->whereNotNull('HanSuDung')
            ->orderBy('HanSuDung')
            ->get();

        foreach ($los as $lo) {
            $sp = $lo->sanPham;
            if (!$sp || ($sp->TrangThai !== null && !$sp->TrangThai)) {
                continue;
            }

            $nguong = (int) ($sp->CanhBaoHSD ?? 0);
            $mo = $this->service->moTa($lo, $nguong);
            if (!in_array($mo['trang_thai'], ['het_han', 'sap_het_han'], true)) {
                continue;
            }

            $ds[] = $mo + [
                'TenSanPham'  => $sp->TenSanPham,
                'LoaiSanPham' => $sp->LoaiSanPham,
                'CanhBaoHSD'  => $nguong,
            ];
        }

        return response()->json(['data' => $ds]);
    }

    public function huy(Request $request, $id): JsonResponse
    {
        $data = $request->validate(['LyDo' => 'nullable|string|max:150']);

        try {
            $lo = DB::transaction(fn () => $this->service->huyLo(
                (int) $id,
                $data['LyDo'] ?? 'Hàng hết hạn',
                $request->user()->MaTaiKhoan
            ));
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], $e->getCode() ?: 400);
        }

        return response()->json(['message' => "Đã hủy lô {$lo->MaLo} và trừ khỏi tồn kho."]);
    }

    public function capNhatHan(Request $request, $id): JsonResponse
    {
        $data = $request->validate(['HanSuDung' => 'nullable|date_format:Y-m-d']);

        try {
            $lo = DB::transaction(fn () => $this->service->datHanSuDung((int) $id, $data['HanSuDung'] ?? null));
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], $e->getCode() ?: 400);
        }

        return response()->json(['message' => "Đã cập nhật hạn sử dụng của lô {$lo->MaLo}."]);
    }
}