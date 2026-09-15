# Frontend architecture

## 1. Mục tiêu và ranh giới

Frontend là React SPA phục vụ hai bề mặt tách biệt:

- **Public service site:** mobile-first, dành cho khách không có tài khoản; khám phá dịch vụ, đặt lịch và tra cứu.
- **Internal workspaces:** desktop/tablet-first, đăng nhập JWT; Admin, Receptionist và Technician có navigation, dashboard và workflow riêng.

Backend Spring Boot là nguồn contract duy nhất. Frontend không tạo API giả, không suy đoán ID/enum, không chứa secret, không thay business state bằng dropdown tự do và không dùng admin API để lách quyền.

## 2. Stack đề xuất

| Concern | Lựa chọn | Lý do |
|---|---|---|
| Runtime UI | React + TypeScript | Component model rõ, type-safe contract |
| Build | Vite | SPA độc lập với Maven, dev proxy gọn |
| Routing | React Router | Public/internal route tree và role guard |
| Server state | TanStack Query | Cache/invalidation, loading/error, abort request |
| Forms | React Hook Form + Zod | Form nhiều bước và validation client có cấu trúc |
| HTTP | Native `fetch` qua một API client | Không cần thêm Axios; kiểm soát auth/error tập trung |
| Contract | Types viết từ OpenAPI snapshot; về sau tự động hóa bằng `openapi-typescript` | Chỉ sinh type từ HTTP schema thực, không từ mọi Java DTO |
| Styling | Global CSS + CSS custom properties | Một design system thống nhất, responsive, không thêm runtime styling |
| Test | TypeScript, ESLint, Vite build, backend integration suite và Chrome headless smoke | Kiểm tra contract, build, HTTP thật và role routing |
| 3D tùy chọn | Three.js + React Three Fiber + Drei | Chỉ lazy-load cho hero/device explorer sau khi có asset rõ license |

Theo tài liệu React, Vite là một build tool phù hợp khi dựng React app từ đầu; routing và data fetching cần được chọn riêng cho SPA. Tham khảo [React: build from scratch](https://react.dev/learn/build-a-react-app-from-scratch), [React Router](https://reactrouter.com/start/data/installation), [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview), và [OpenAPI TypeScript](https://openapi-ts.dev/introduction).

Máy hiện có Node `25.9.0`, nhưng Node 25 đã EOL. Project nên pin Node 24 LTS bằng `.nvmrc`/`engines`; Node khuyến nghị production chỉ dùng Active LTS hoặc Maintenance LTS ([Node.js releases](https://nodejs.org/en/about/previous-releases)).

## 3. Route tree

```text
/
├─ devices
│  └─ :deviceTypeId/:deviceModelId?       khám phá từ dữ liệu public
├─ booking                               wizard bốn bước
├─ lookup                                một entry: phone hoặc ticket code
├─ service-tickets/:ticketCode           public-safe detail nếu contract hỗ trợ
├─ warranty-booking/:repairItemId         chỉ mở từ lịch sử đủ điều kiện
└─ internal
   ├─ login                              URL trực tiếp, không link từ public
   ├─ admin
   │  ├─ index / statistics
   │  ├─ users / branches
   │  ├─ device-types / device-models
   │  ├─ service-issues / service-types / catalog
   │  ├─ parts / inventory
   │  ├─ appointment-slots / technician-schedules
   │  └─ settings
   ├─ receptionist
   │  ├─ index / appointments / intake
   │  ├─ customers / tickets
   │  ├─ assignments
   │  └─ payment-handover
   └─ technician
      ├─ index                            Công việc của tôi
      └─ tickets/:ticketId                một workspace, action theo state
```

Public header chỉ có **Trang chủ, Thiết bị, Đặt lịch sửa chữa, Tra cứu**. Không link internal login hay warranty top-level. Warranty xuất hiện theo ngữ cảnh của repair item đã hoàn tất.

## 4. Folder structure

```text
frontend/
├─ public/
├─ src/
│  ├─ app/                 bootstrap, providers, router
│  ├─ api/                 client, errors, generated/curated contract, modules
│  ├─ auth/                auth store/provider, session lifecycle, guards
│  ├─ components/          reusable primitives and feedback states
│  ├─ layouts/             Public, Admin, Receptionist, Technician layouts
│  ├─ pages/               public và internal role pages
│  ├─ styles/              tokens, reset, global typography
│  ├─ types/               UI-only types and centralized enum labels
│  └─ utils/               date, money, validation-safe formatting
├─ .env.example
├─ vite.config.ts
└─ package.json
```

Feature modules own query keys, API wrappers, schemas and screen components. Route pages compose them; components do not call `fetch` directly.

## 5. API client

- `VITE_API_BASE_URL` is public configuration only; empty means same-origin. Local Vite proxy forwards `/api` to `http://localhost:8080` without changing backend CORS.
- Public calls explicitly omit Authorization, even while a staff user is logged in.
- Internal calls request auth and attach `Authorization: Bearer <token>` from memory.
- JSON errors are normalized from `ApiErrorResponse`: status, code, message, path and field errors. UI maps field errors to form controls and never prints stack traces.
- Dates remain backend forms: `LocalDate` as `YYYY-MM-DD`, `LocalTime` as wall-clock time, `LocalDateTime` without pretending it has an offset. Money is displayed with `Intl.NumberFormat('vi-VN', { currency: 'VND' })`; nullable price is not converted to zero.
- GET requests may retry only transient network/server failures with a small bound. Mutations are not auto-retried because the API has no idempotency key contract.
- Abort signals cancel obsolete catalog/filter requests. Query invalidation follows successful command responses.

## 6. Auth and authorization

1. Login sends username/password once to `POST /api/v1/auth/login`.
2. Access token is kept in memory by default; password is never stored. Reload therefore requires login again until backend supplies refresh/session support.
3. Immediately call `GET /api/v1/auth/me`; its user/role/status is authoritative for routing.
4. `RequireAuth` blocks unauthenticated internal routes. `RequireRole` routes ADMIN, RECEPTIONIST and TECHNICIAN to distinct workspace trees.
5. On 401 for the current token: clear auth/query cache, redirect to `/internal/login`, show “Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.”
6. On 403: preserve the session, remove unavailable action/entity cache, and show “Bạn không có quyền thực hiện thao tác này.” A 403 after transfer/finish may mean object access ended, not token expiry.
7. Frontend guards improve UX only; backend remains the security authority. JWT is not decoded to grant role access.

## 7. State strategy

- **TanStack Query:** all server state, separate keys by public/internal and parameters; clear internal cache on logout/role change.
- **Auth context/store:** token, current user, auth lifecycle only.
- **URL state:** non-sensitive filters such as status/date/branch. Không đưa phone, token hoặc private lookup data vào URL.
- **Local component/form state:** modal, selected row, wizard step.
- **Booking draft:** React state/context for repeatable device/service groups; no shopping cart semantics. Persist nowhere by default because it contains customer phone.
- No Redux in foundation; add only if a concrete cross-feature client state problem appears.

## 8. Booking and public discovery

Order is fixed:

```text
Device type → Model → Issue → Service type/service
→ Part brand/variant only for REPLACEMENT when API supports it
→ Customer name + phone → Branch → Date → Slot → Confirm
```

The appointment request supports multiple devices, so step 1 uses repeatable device/service groups while preserving order. No cart, checkout, customer account, required email or address. Slot UI displays `activeBookingCount`; only backend status `CLOSED` disables a slot. It never invents capacity or “còn X chỗ”.

Price, duration, warranty and discount use response values. A null configured price is shown as “Giá được xác nhận sau khi kiểm tra”. The frontend does not reproduce `PricePolicy.DEFAULT_ONLINE_DISCOUNT` or calculate an authoritative quote.

## 9. Role-specific internal UX

### Admin

Admin uses a selected-branch context for operational statistics, inventory, appointments and schedules. Global master data remains outside branch context. Statistics requests always pass the selected `branchId` when the screen claims branch-specific metrics; cross-branch comparison shows branches separately.

### Receptionist

The workspace follows appointment → confirm → arrive → intake → ticket → recommend/assign → approval → payment → handover. Ticket queue/search và rich detail dùng API nội bộ, nên người dùng có thể tìm lại ticket sau refresh.

### Technician

Navigation stays minimal: “Công việc của tôi” and a single ticket workspace. Inspection, proposal, part usage, waiting part, transfer and finish are sections/actions inside that workspace and appear only for compatible backend state. My Work, incoming transfers, transfer candidates, available inventory và usage history đều lấy theo current actor từ JWT. Không có status dropdown tùy ý.

## 10. Design system

- Direction: refined technical service, white and warm gray surfaces, near-black text, restrained blue accent; public pages spacious, internal pages denser.
- Typography: Inter as explicitly required by the project, with careful weight/spacing hierarchy. This project requirement overrides the generic skill preference against common fonts.
- Core tokens: background `#FFFFFF`, secondary `#F5F5F7`, text `#111111`, muted `#6E6E73`, accessible semantic success/warning/error.
- Components: Button, Link, Field, Select, Stepper, StatusBadge, DataTable, Drawer, Dialog, Toast, EmptyState, ErrorState, Skeleton, Timeline.
- Vietnamese labels are centralized for all backend enums. Unknown future enum values fall back to “Chưa xác định” and are logged in development.
- Semantic HTML, full labels, visible focus, keyboard dialogs/navigation, adequate contrast, and `prefers-reduced-motion` are baseline requirements.

## 11. 3D feasibility

No GLB/GLTF or licensed device asset exists in the repository. Three.js dependencies are deferred until an owned/approved asset and a measurable use case exist. The component boundary can still be prepared as `DeviceExplorer` with a static illustration fallback.

When enabled, 3D is limited to hero/device explorer, route-lazy-loaded, one model at a time, compressed GLB/GLTF, capped DPR, on-demand rendering, no continuous auto-rotate, and static fallback for mobile, reduced motion or no WebGL. React Three Fiber documents `frameloop="demand"` to avoid an idle 60fps loop and adaptive DPR/performance monitoring ([R3F performance guidance](https://github.com/pmndrs/react-three-fiber/blob/master/docs/advanced/scaling-performance.mdx)). Device hotspots must use curated business mappings; never infer service issue IDs from a model name.

## 12. Responsive and quality strategy

- Public: mobile-first; booking controls remain one-column on narrow screens with sticky step actions where safe.
- Internal: desktop/tablet-first; sidebar collapses, data tables switch to horizontal scroll or compact record cards without hiding critical state/actions.
- Every async screen has loading, empty, recoverable error and success feedback.
- Foundation gates: `npm run typecheck`, `npm run lint`, `npm run build`.
- Backend gate: `mvn test` và `mvn package` trên MySQL 3307.
- E2E gate: Spring Boot/Vite thật, live HTTP workflow và Chrome headless cho login/role routing.

## 13. Delivery sequence

1. F1 foundation: scaffold, API client, auth, guards, four layouts, common states — complete.
2. F2 public discovery/booking/lookup/warranty/feedback — complete.
3. F3 receptionist appointments, intake, ticket queue, assignment, payment/handover — complete.
4. F4 technician My Work, workspace, transfer, part usage và state actions — complete.
5. F5 admin master data, account, inventory, slot, schedule, settings, statistics — complete.
6. F6 build, authorization, live E2E và coverage docs — complete for current scope.
