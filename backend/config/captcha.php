<?php

return [
    // Đặt CAPTCHA_ENABLED=false trong .env nếu cần thử đăng nhập bằng Postman
    'enabled' => env('CAPTCHA_ENABLED', true),
    'length'  => 5,
    'ttl'     => 300, // giây
];