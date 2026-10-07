# Hướng dẫn Docker Compose local

## Kiến trúc

- `frontend`: Nginx phục vụ React production build, SPA fallback và proxy `/api` tới backend; chỉ bind `127.0.0.1:8088`.
- `backend`: Java 21/Spring Boot, internal network, `ddl-auto=validate`.
- `ml`: FastAPI/CatBoost, internal network, không retrain.
- `mysql`: MySQL 8.4, internal network và named volume `mysql-data`.

MySQL và FastAPI không publish port ra host. Frontend nối cả `edge` và `internal`; ba service còn lại chỉ ở `internal`.

## Chạy stack

```powershell
Copy-Item .env.example .env
# Sửa toàn bộ placeholder trong .env trước khi chạy.
docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 180
docker compose ps
```

Truy cập `http://127.0.0.1:8088`. Kiểm tra health public qua `GET /api/v1/device-types`; FastAPI health được Docker gọi nội bộ tại `/health/ready`.

## Vận hành

```powershell
docker compose stop
docker compose start
docker compose restart backend
docker compose logs -f --tail 200 backend
docker compose down
```

`docker compose down` giữ named volume. Không thêm `-v` nếu cần giữ demo DB.

## Cấu hình

Secret chỉ nằm trong `.env` đã git-ignore. Các biến chính: `MYSQL_*`, `JWT_SECRET`, bootstrap admin, `FRONTEND_PORT`. Backend dùng service DNS `mysql` và `ml`; CORS local chấp nhận cả `localhost` và `127.0.0.1` đúng port frontend.
