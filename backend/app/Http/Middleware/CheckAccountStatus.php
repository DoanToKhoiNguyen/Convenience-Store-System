<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckAccountStatus
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && !$user->TrangThai) {
            $user->tokens()->delete();

            return response()->json([
                'message' => 'Tài khoản đã bị khóa.',
                'code'    => 'ACCOUNT_LOCKED',
            ], 403);
        }

        return $next($request);
    }
}
