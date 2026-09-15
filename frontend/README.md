# TáoCare frontend

React SPA cho hệ thống quản lý và hỗ trợ kỹ thuật dịch vụ sửa chữa thiết bị Apple.

## Chạy local

Yêu cầu Node 24 LTS. Backend mặc định chạy tại `http://localhost:8080`.

```bash
npm install
npm run dev
```

Vite phục vụ frontend tại `http://localhost:5173` và proxy `/api` tới backend local.

## Biến môi trường

Sao chép `.env.example` thành `.env.local` khi cần dùng API origin khác:

```text
VITE_API_BASE_URL=https://api.example.com
```

Đây là cấu hình public. Không đặt JWT secret, DB password, account hay access token vào file frontend.

## Kiểm tra

```bash
npm run typecheck
npm run lint
npm run build
```

Contract và blocker hiện tại được ghi ở `../docs/frontend-api-coverage.md` và `../docs/frontend-api-gaps.md`.
