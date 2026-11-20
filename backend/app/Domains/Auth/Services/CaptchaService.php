<?php

namespace App\Domains\Auth\Services;

use Illuminate\Support\Facades\Cache;

class CaptchaService
{
    // Bỏ các ký tự dễ nhầm: 0 O 1 I
    private const KY_TU = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    public function batHay(): bool
    {
        return (bool) config('captcha.enabled', true);
    }

    /** Tạo mã mới. Trả về ['id' => ..., 'image' => 'data:image/png;base64,...'] */
    public function tao(): array
    {
        $do = (int) config('captcha.length', 5);
        $code = '';
        for ($i = 0; $i < $do; $i++) {
            $code .= self::KY_TU[random_int(0, strlen(self::KY_TU) - 1)];
        }

        $id = bin2hex(random_bytes(16));
        Cache::put($this->key($id), $this->bam($code), (int) config('captcha.ttl', 300));

        return [
            'id'    => $id,
            'image' => 'data:image/png;base64,' . base64_encode($this->ve($code)),
        ];
    }

    /** Kiểm tra và HỦY mã ngay (dùng một lần, kể cả khi nhập sai). */
    public function kiemTra(?string $id, ?string $code): bool
    {
        if (!$this->batHay()) {
            return true;
        }
        if (!$id || !$code || !preg_match('/^[a-f0-9]{32}$/', $id)) {
            return false;
        }

        $mong = Cache::pull($this->key($id));
        if (!$mong) {
            return false;
        }

        return hash_equals($mong, $this->bam($code));
    }

    private function key(string $id): string
    {
        return 'captcha:' . $id;
    }

    private function bam(string $code): string
    {
        return hash_hmac('sha256', strtoupper(trim($code)), (string) config('app.key'));
    }

    private function ve(string $code): string
    {
        if (!function_exists('imagecreatetruecolor')) {
            throw new \RuntimeException('Máy chủ chưa bật thư viện GD để vẽ mã xác nhận.');
        }

        $w = 170;
        $h = 56;
        $img = imagecreatetruecolor($w, $h);
        $nen = imagecolorallocate($img, 248, 250, 252);
        imagefilledrectangle($img, 0, 0, $w, $h, $nen);

        // Chấm nhiễu nền
        for ($i = 0; $i < 220; $i++) {
            $x = imagecolorallocate($img, ...array_fill(0, 3, random_int(200, 235)));
            imagesetpixel($img, random_int(0, $w - 1), random_int(0, $h - 1), $x);
        }

        // Vẽ từng ký tự: phóng to, kéo méo, xoay nghiêng ngẫu nhiên
        $n = strlen($code);
        $o = $w / $n;
        for ($i = 0; $i < $n; $i++) {
            $glyph = imagecreatetruecolor(9, 15);
            imagefilledrectangle($glyph, 0, 0, 9, 15, $nen);
            $mau = imagecolorallocate($glyph, random_int(20, 90), random_int(30, 110), random_int(120, 220));
            imagestring($glyph, 5, 0, 0, $code[$i], $mau);

            $sw = (int) round(9 * random_int(24, 32) / 10);
            $sh = (int) round(15 * random_int(28, 35) / 10);
            $lon = imagecreatetruecolor($sw, $sh);
            imagefilledrectangle($lon, 0, 0, $sw, $sh, $nen);
            imagecopyresampled($lon, $glyph, 0, 0, 0, 0, $sw, $sh, 9, 15);

            $xoay = imagerotate($lon, random_int(-28, 28), $nen);
            imagecolortransparent($xoay, $nen);

            $rw = imagesx($xoay);
            $rh = imagesy($xoay);
            $dx = (int) ($i * $o + ($o - $rw) / 2 + random_int(-2, 2));
            $dy = (int) (($h - $rh) / 2 + random_int(-4, 4));
            imagecopy($img, $xoay, $dx, $dy, 0, 0, $rw, $rh);
        }

        // Đường nhiễu và cung cong vẽ đè lên chữ
        for ($i = 0; $i < 6; $i++) {
            $c = imagecolorallocate($img, random_int(40, 120), random_int(60, 140), random_int(150, 230));
            imageline($img, random_int(0, $w), random_int(0, $h), random_int(0, $w), random_int(0, $h), $c);
        }
        for ($i = 0; $i < 2; $i++) {
            $c = imagecolorallocate($img, random_int(60, 140), random_int(80, 160), random_int(160, 230));
            imagearc($img, random_int(20, $w - 20), random_int(10, $h - 10), random_int(60, 140), random_int(20, 60), random_int(0, 180), random_int(180, 360), $c);
        }
        for ($i = 0; $i < 120; $i++) {
            $c = imagecolorallocate($img, random_int(30, 130), random_int(50, 150), random_int(140, 230));
            imagesetpixel($img, random_int(0, $w - 1), random_int(0, $h - 1), $c);
        }

        ob_start();
        imagepng($img);

        return (string) ob_get_clean();
    }
}