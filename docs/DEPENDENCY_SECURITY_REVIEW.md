# Dependency security review

Ngày chạy `npm audit`: 07/10/2026.

Kết quả: 18 high, 0 critical, 0 moderate/low; 14 production dependencies, 216 dev dependencies, 53 optional. Chuỗi bị báo nằm trong build/lint tooling:

- Direct dev: `@eslint/js`, `eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `typescript-eslint`, `@vitejs/plugin-react`, `vite`.
- Transitive: ESLint config/utils/parser/type-utils, `minimatch`, `brace-expansion`, `postcss`, `source-map-js`.

`npm audit` không báo direct production runtime package React/TanStack/Zod bị lỗ hổng. Các package ảnh hưởng được dùng lúc lint/build/dev, không được đóng gói như server-side runtime trong frontend Nginx image. Rủi ro vẫn cần theo dõi vì source/build pipeline có thể bị ảnh hưởng.

NPM trả `fixAvailable=false` cho các direct top-level package liên quan. Không chạy `npm audit fix --force` và không ép breaking upgrade trong phase này. Kế hoạch: theo dõi bản vá upstream, nâng đồng bộ Vite/ESLint ecosystem trên branch riêng, chạy lại toàn bộ frontend + Playwright + Docker build trước khi merge.

Evidence: `target/full-stack/npm-audit.json`. Không có secret trong report.
