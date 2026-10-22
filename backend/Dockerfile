FROM php:8.3-fpm

# Cài đặt các extension hệ thống cần thiết cho PostgreSQL và PHP
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    libpq-dev \
    zip \
    unzip

# Xóa cache để giảm dung lượng image
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Cài đặt các PHP extension (trong đó có pdo_pgsql để kết nối PostgreSQL)
RUN docker-php-ext-install pdo pdo_pgsql mbstring exif pcntl bcmath gd

# Cài đặt Composer (quản lý thư viện PHP)
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Thiết lập thư mục làm việc bên trong container
WORKDIR /var/www/html

# Copy toàn bộ mã nguồn hiện tại vào container
COPY . .

# Cài đặt các thư viện PHP bằng Composer
RUN composer install --no-interaction --prefer-dist --optimize-autoloader

# Phân quyền thư mục storage và cache của Laravel
RUN chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache

EXPOSE 9000
CMD ["php-fpm"]