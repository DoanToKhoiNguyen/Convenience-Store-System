<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Chuyển MaPhieuNhap từ số tự tăng sang chuỗi PN01, PN02, ... (chỉ PostgreSQL;
 * cài mới đã tạo cột chuỗi ngay từ migration gốc).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $kieu = DB::selectOne("
            SELECT data_type FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'phieu_nhap'
              AND column_name = 'MaPhieuNhap'
        ")?->data_type;

        if (!in_array($kieu, ['bigint', 'integer'], true)) {
            return;
        }

        $this->boKhoaNgoai();

        $seq = DB::selectOne("SELECT pg_get_serial_sequence('phieu_nhap', 'MaPhieuNhap') AS seq")?->seq;

        DB::statement('ALTER TABLE phieu_nhap ALTER COLUMN "MaPhieuNhap" DROP DEFAULT');
        $this->doiSangChuoi('phieu_nhap');
        $this->doiSangChuoi('chi_tiet_phieu_nhap');
        $this->doiSangChuoi('lo_hang');

        if ($seq) {
            DB::statement('DROP SEQUENCE IF EXISTS ' . $seq);
        }

        DB::statement('
            ALTER TABLE chi_tiet_phieu_nhap
            ADD CONSTRAINT chi_tiet_phieu_nhap_maphieunhap_foreign
            FOREIGN KEY ("MaPhieuNhap") REFERENCES phieu_nhap ("MaPhieuNhap") ON DELETE CASCADE
        ');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $kieu = DB::selectOne("
            SELECT data_type FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'phieu_nhap'
              AND column_name = 'MaPhieuNhap'
        ")?->data_type;

        if ($kieu !== 'character varying') {
            return;
        }

        $this->boKhoaNgoai();

        foreach (['phieu_nhap', 'chi_tiet_phieu_nhap', 'lo_hang'] as $bang) {
            DB::statement("
                ALTER TABLE {$bang} ALTER COLUMN \"MaPhieuNhap\" TYPE bigint
                USING NULLIF(regexp_replace(\"MaPhieuNhap\", '\\D', '', 'g'), '')::bigint
            ");
        }

        DB::statement('CREATE SEQUENCE IF NOT EXISTS "phieu_nhap_MaPhieuNhap_seq"');
        DB::statement("ALTER TABLE phieu_nhap ALTER COLUMN \"MaPhieuNhap\" SET DEFAULT nextval('\"phieu_nhap_MaPhieuNhap_seq\"')");
        DB::statement("SELECT setval('\"phieu_nhap_MaPhieuNhap_seq\"', COALESCE((SELECT MAX(\"MaPhieuNhap\") FROM phieu_nhap), 1))");

        DB::statement('
            ALTER TABLE chi_tiet_phieu_nhap
            ADD CONSTRAINT chi_tiet_phieu_nhap_maphieunhap_foreign
            FOREIGN KEY ("MaPhieuNhap") REFERENCES phieu_nhap ("MaPhieuNhap") ON DELETE CASCADE
        ');
    }

    private function doiSangChuoi(string $bang): void
    {
        DB::statement("
            ALTER TABLE {$bang} ALTER COLUMN \"MaPhieuNhap\" TYPE varchar(10)
            USING 'PN' || lpad(\"MaPhieuNhap\"::text, 2, '0')
        ");
    }

    private function boKhoaNgoai(): void
    {
        $fk = DB::selectOne("
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'chi_tiet_phieu_nhap'::regclass
              AND contype = 'f'
              AND conname LIKE '%maphieunhap%'
        ");

        if ($fk) {
            DB::statement('ALTER TABLE chi_tiet_phieu_nhap DROP CONSTRAINT "' . $fk->conname . '"');
        }
    }
};
