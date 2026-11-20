<?php

namespace App\Domains\Auth\Http\Controllers;

use App\Domains\Auth\Services\CaptchaService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class CaptchaController extends Controller
{
    public function tao(CaptchaService $captcha): JsonResponse
    {
        if (!$captcha->batHay()) {
            return response()->json(['enabled' => false]);
        }

        return response()
            ->json(['enabled' => true] + $captcha->tao())
            ->header('Cache-Control', 'no-store');
    }
}