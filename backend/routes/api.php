<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Domains\Auth\Http\Controllers\AuthController;
use App\Domains\NhanVien\Http\Controllers\NhanVienController;
use App\Domains\SanPham\Http\Controllers\SanPhamController;
use App\Models\SanPham;
use Illuminate\Routing\Router;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('/login', [AuthController::class, 'login']);
Route::get('/san-pham/tra-cuu', [SanPhamController::class, 'search']);
Route::get('/san-pham/', [SanPhamController::class, 'index']);
Route::get('/san-pham/{id}', [SanPhamController::class, 'show']);

// Route yêu cầu phải có Token hợp lệ mới được gọi
Route::middleware(['auth:sanctum' , 'active'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::middleware(['role:1,2'])->group(function () {
        Route::get('/nhan-vien', [NhanVienController::class, 'index']);      // Xem danh sách nhân viên
        Route::get('/nhan-vien/{id}', [NhanVienController::class, 'show']); // Xem chi tiết 1 nhân viên
    });

    Route::middleware(['role:1'])->group(function () {
        Route::post('/nhan-vien', [NhanVienController::class, 'store']);  
        Route::put('/nhan-vien/{id}', [NhanVienController::class, 'update']);     
        Route::delete('/nhan-vien/{id}', [NhanVienController::class, 'destroy']); 
    });
});