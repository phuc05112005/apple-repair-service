# Hướng dẫn CD thủ công qua GitHub Actions

Workflow [deploy-manual.yml](../.github/workflows/deploy-manual.yml) chỉ chạy bằng `workflow_dispatch`. Input `deploy=false` mặc định chỉ verify và publish image; `deploy=true` mới mở job production environment.

Pipeline:

1. Import canonical schema vào MySQL service của runner.
2. Chạy Maven package/tests, frontend typecheck/lint/unit/build, Python pytest.
3. Build và push ba image có tag immutable `${github.sha}` lên GHCR.
4. Nếu deploy được bật: kiểm tra secret, SCP Compose + rollback script, ghi production env an toàn, đăng nhập GHCR trên VPS.
5. Pull, `up -d --wait`, healthcheck; khi fail tự khôi phục `.env.previous` và các image tag trước.

## GitHub Environment secrets

- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, tùy chọn `VPS_PORT`.
- `PRODUCTION_ENV`: toàn bộ nội dung `.env` production, gồm image tag SHA của lần chạy.
- `GHCR_USERNAME`, `GHCR_TOKEN`: token chỉ có quyền đọc package trên VPS.

Dùng GitHub Environment `production` với required reviewer. Không đặt secret trong YAML, repository variable công khai hoặc artifact log. GHCR token nên có phạm vi tối thiểu `read:packages`.

## Kích hoạt

Vào Actions → “Build and optionally deploy production images” → Run workflow. Chạy lần đầu với `deploy=false`. Chỉ chuyển `deploy=true` sau khi VPS, DNS, TLS, database backup và production env đã được review.

Workflow và production Compose đã parse/validate local; deployment thật chưa chạy vì thiếu external infrastructure.
