# Deployment runbook

Trạng thái hiện tại: `VPS_DEPLOYMENT = PENDING_EXTERNAL_INFRASTRUCTURE`. Phase chưa có VPS/SSH/domain/production secrets nên không deploy thật.

## Chuẩn bị VPS

1. Linux VPS có Docker Engine + Compose plugin, user deploy được phép chạy Docker.
2. Tạo `/srv/apple-repair-service`, giới hạn quyền user deploy.
3. Cấu hình firewall chỉ mở 22, 80, 443; không mở MySQL/FastAPI.
4. Tạo production env từ [deploy/.env.production.example](../deploy/.env.production.example), dùng secret ngẫu nhiên dài và image tag immutable.
5. Áp dụng canonical schema bằng quy trình migration/restore đã duyệt trước khi Spring `validate` khởi động.

## Deploy thủ công

```bash
cd /srv/apple-repair-service
chmod 600 .env
docker login ghcr.io
docker compose -f docker-compose.production.yml config --quiet
./deploy.sh
```

`deploy.sh` pull image, `up -d --wait`, in trạng thái service. Khi healthcheck thất bại, script khôi phục `.env.previous` và chạy lại image tag trước.

## Start, stop, restart và health

```bash
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml stop
docker compose -f docker-compose.production.yml start
docker compose -f docker-compose.production.yml restart backend
docker compose -f docker-compose.production.yml logs --tail 200 backend
curl -fsS https://YOUR_DOMAIN/api/v1/device-types
```

Không dùng `down -v` trong production. Health PASS khi MySQL, ML, backend, frontend đều healthy và public API trả 2xx.

## Domain và HTTPS

1. Lấy public IPv4 của VPS.
2. Tạo DNS A record `@` → IPv4; `www` → IPv4 hoặc CNAME về apex.
3. Chờ propagate, thay domain placeholder trong [nginx-site.conf.example](../deploy/nginx-site.conf.example).
4. Enable site Nginx, kiểm tra `nginx -t`, reload.
5. Dùng Certbot/Nginx hoặc ACME tương đương cấp certificate, rồi redirect HTTP → HTTPS.
6. Đặt `PUBLIC_ORIGIN=https://domain-thật` trong production env.

## Rollback

Workflow giữ `.env.previous`. Có thể rollback thủ công bằng cách khôi phục file này, xác nhận các image tag cũ còn trong GHCR, chạy `./deploy.sh`, rồi kiểm tra health và log. Database rollback chỉ thực hiện từ backup đã kiểm chứng; không tự đảo migration bằng cách xóa bảng/cột.
