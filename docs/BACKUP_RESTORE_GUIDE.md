# Backup và restore MySQL

## Backup

Chạy trên VPS, ghi file ngoài container và giới hạn quyền đọc:

```bash
set -a; . /srv/apple-repair-service/.env; set +a
umask 077
docker compose -f /srv/apple-repair-service/docker-compose.production.yml exec -T mysql \
  mysqldump --single-transaction --routines --triggers --set-gtid-purged=OFF \
  -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" \
  | gzip > "/srv/backups/apple-repair-$(date +%Y%m%d-%H%M%S).sql.gz"
```

Mã hóa/đẩy backup sang storage khác VPS, áp dụng retention, và định kỳ test restore. Không ghi password vào repository hoặc log CI.

## Restore diễn tập

Luôn restore vào database/container thử trước:

```bash
gunzip -c backup.sql.gz | docker compose exec -T mysql \
  mysql -u root -p"$MYSQL_ROOT_PASSWORD" restore_verification_db
```

Sau restore, xác minh 33 bảng/schema hiện hành, FK, row count/checksum quan trọng và chạy Spring `ddl-auto=validate`. Chỉ lên lịch maintenance restore production sau khi backup hiện tại đã tạo và checksum file backup khớp.

## Restore production

1. Dừng frontend/backend/ML, giữ MySQL.
2. Chụp backup tức thời của trạng thái hiện tại.
3. Restore đúng database đích trong maintenance window.
4. Chạy schema validation và smoke read-only.
5. Khởi động ML → backend → frontend, kiểm tra health/public lookup.
6. Nếu validation fail, dừng ứng dụng và khôi phục backup trước restore; không disable FK hoặc sửa dữ liệu thủ công để ép start.
