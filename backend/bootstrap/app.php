<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use App\Http\Middleware\CheckRole;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Cấu hình alias middleware của bạn
        $middleware->alias([
            'role' => CheckRole::class,
            'active' => \App\Http\Middleware\CheckAccountStatus::class,
        ]);

        // (Tùy chọn) Đảm bảo CORS middleware được bật cho API nếu gặp lỗi chặn preflight request
        // Laravel 11 mặc định đã bật CORS global qua file config/cors.php, 
        // nhưng nếu vẫn bị chặn, bạn có thể kiểm tra lại config/cors.php xem đã cho phép 'http://localhost:4200' chưa.
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();