<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('ca_lam_viec', function (Blueprint $table) {
            $table->id('MaCa');
            $table->string('TenCa'); 
            $table->time('GioBatDau');
            $table->time('GioKetThuc');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ca_lam_viec');
    }
};
