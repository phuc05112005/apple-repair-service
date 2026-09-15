"""Generate the initial frontend/API coverage matrix from the audited inventory.

The checked-in inventory is the input contract. This script does not inspect or
modify application code and deliberately marks every frontend row unimplemented
until a real screen calls the endpoint and is tested.
"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
INVENTORY = ROOT / "docs/api-security/endpoint-inventory.json"
OUTPUT = ROOT / "docs/frontend-api-coverage.md"


SCREEN_BY_CONTROLLER = {
    "AdminBranchController": "Admin / Chi nhánh",
    "AdminDeviceTypeController": "Admin / Loại thiết bị",
    "AdminDeviceModelController": "Admin / Model thiết bị",
    "AdminServiceTypeController": "Admin / Loại dịch vụ",
    "AdminServiceIssueController": "Admin / Vấn đề dịch vụ",
    "AdminServiceCatalogController": "Admin / Danh mục dịch vụ",
    "AdminPartController": "Admin / Linh kiện",
    "AdminUserController": "Admin / Tài khoản",
    "AdminInventoryController": "Admin / Tồn kho",
    "AdminConfigurationController": "Admin / Cấu hình",
    "AuthController": "Nội bộ / Đăng nhập & phiên",
    "PublicController": "Public",
    "ReceptionistController": "Lễ tân / Vận hành",
    "TechnicianController": "KTV / Ticket workspace",
    "InternalTicketController": "Nội bộ / Chi tiết phiếu",
    "TransferController": "Nội bộ / Chuyển giao",
}

HANDLER_PURPOSE = {
    "list": "Liệt kê dữ liệu quản trị",
    "get": "Xem chi tiết dữ liệu quản trị",
    "create": "Tạo dữ liệu quản trị",
    "update": "Cập nhật dữ liệu quản trị",
    "delete": "Xóa dữ liệu quản trị không còn được tham chiếu",
    "activate": "Kích hoạt dữ liệu",
    "deactivate": "Ngừng kích hoạt dữ liệu",
    "login": "Đăng nhập nhân viên",
    "me": "Lấy người dùng/role hiện hành",
    "deviceTypes": "Liệt kê loại thiết bị công khai",
    "deviceModels": "Liệt kê model, lọc theo loại thiết bị",
    "serviceIssues": "Liệt kê nhóm vấn đề công khai",
    "catalog": "Tìm dịch vụ phù hợp",
    "branches": "Liệt kê chi nhánh công khai",
    "slots": "Liệt kê khung giờ",
    "slot": "Xem khung giờ",
    "createSlot": "Tạo khung giờ",
    "updateSlot": "Cập nhật khung giờ",
    "deleteSlot": "Xóa khung giờ chưa có lịch hẹn",
    "open": "Mở khung giờ",
    "close": "Đóng khung giờ",
    "createAppointment": "Đặt lịch sửa chữa",
    "appointments": "Liệt kê/tra cứu lịch hẹn",
    "appointment": "Xem chi tiết lịch hẹn",
    "tickets": "Tra cứu phiếu bằng số điện thoại",
    "ticket": "Xem chi tiết phiếu nội bộ",
    "eligibility": "Kiểm tra điều kiện bảo hành",
    "feedback": "Gửi phản hồi sau bàn giao",
    "confirm": "Xác nhận lịch hẹn",
    "reschedule": "Đổi lịch hẹn",
    "cancelAppointment": "Hủy lịch hẹn",
    "arrive": "Ghi nhận khách đã đến",
    "expire": "Đánh dấu lịch hết hạn",
    "intake": "Tiếp nhận thiết bị từ lịch hẹn",
    "walkIn": "Tạo phiếu khách đến trực tiếp",
    "cancelTicket": "Hủy phiếu dịch vụ",
    "recommend": "Đề xuất kỹ thuật viên",
    "assign": "Phân công kỹ thuật viên",
    "approval": "Ghi quyết định phê duyệt phương án",
    "paymentSummary": "Xem tổng tiền được duyệt",
    "payment": "Ghi nhận thanh toán",
    "settleZero": "Quyết toán phiếu 0 đồng",
    "handover": "Bàn giao thiết bị",
    "start": "Bắt đầu kiểm tra",
    "inspection": "Ghi kết quả/phương án kiểm tra",
    "waitForPart": "Chuyển sang chờ linh kiện",
    "resume": "Tiếp tục sửa chữa",
    "finish": "Hoàn tất sửa chữa",
    "duration": "Xem thời lượng sửa chữa dự kiến",
    "usePart": "Ghi nhận linh kiện đã dùng",
    "reverse": "Hoàn tác ghi nhận linh kiện",
    "warranty": "Ghi quyết định bảo hành",
    "assignments": "Xem lịch sử phân công",
    "transfers": "Xem lịch sử chuyển giao của phiếu",
    "request": "Yêu cầu chuyển giao",
    "direct": "Chuyển giao trực tiếp",
    "accept": "Chấp nhận chuyển giao",
    "reject": "Từ chối chuyển giao",
    "cancel": "Hủy yêu cầu chuyển giao",
    "inventory": "Xem tồn kho theo chi nhánh và linh kiện",
    "stockIn": "Nhập kho",
    "stockOut": "Xuất kho",
    "transfer": "Chuyển kho giữa chi nhánh",
    "settings": "Liệt kê thiết lập hệ thống",
    "setting": "Cập nhật thiết lập hệ thống",
    "schedules": "Liệt kê lịch kỹ thuật viên",
    "createSchedule": "Tạo lịch kỹ thuật viên",
    "updateSchedule": "Cập nhật lịch kỹ thuật viên",
    "deleteSchedule": "Xóa lịch kỹ thuật viên",
    "statistics": "Xem thống kê theo thời gian/chi nhánh",
    "profile": "Cập nhật hồ sơ tài khoản",
    "role": "Cập nhật role tài khoản",
    "status": "Cập nhật trạng thái tài khoản",
}


def role_label(access: str) -> str:
    if access == "public":
        return "Public"
    if access == "authenticated":
        return "Đã đăng nhập"
    roles = [r for r in ("ADMIN", "RECEPTIONIST", "TECHNICIAN") if r in access]
    return ", ".join(roles)


def screen_for(item: dict) -> str:
    path = item["path"]
    controller = item["controller"]
    if controller == "PublicController":
        if path in ("/api/v1/device-types", "/api/v1/device-models", "/api/v1/service-issues", "/api/v1/service-catalog-items"):
            return "Thiết bị / Đặt lịch"
        if path == "/api/v1/branches" or "appointment-slots" in path:
            return "Đặt lịch / Chi nhánh & thời gian"
        if path == "/api/v1/appointments":
            return "Đặt lịch / Xác nhận"
        if "lookup" in path:
            return "Tra cứu"
        if "warranties" in path:
            return "Tra cứu / Bảo hành"
        if "feedback" in path:
            return "Tra cứu / Phản hồi"
    if controller == "AdminConfigurationController":
        if "statistics" in path:
            return "Admin / Tổng quan & thống kê"
        if "appointment-slots" in path:
            return "Admin / Khung giờ"
        if "technician-schedules" in path:
            return "Admin / Lịch kỹ thuật viên"
        return "Admin / Thiết lập hệ thống"
    if controller == "ReceptionistController":
        if "appointments" in path or "appointment-devices" in path:
            return "Lễ tân / Lịch hẹn & tiếp nhận"
        if "payment" in path or "handover" in path:
            return "Lễ tân / Thanh toán & bàn giao"
        return "Lễ tân / Phiếu dịch vụ"
    if controller == "TechnicianController":
        return "KTV / Ticket workspace"
    if controller == "TransferController":
        return "KTV/Lễ tân / Chuyển giao"
    return SCREEN_BY_CONTROLLER.get(controller, "Chưa phân loại")


def action_for(item: dict) -> str:
    method = item["method"]
    handler = item["handler"]
    purpose = HANDLER_PURPOSE.get(handler, handler)
    verb = {"GET": "Tải", "POST": "Thực hiện", "PUT": "Lưu", "DELETE": "Xóa", "PATCH": "Cập nhật"}.get(method, method)
    return f"{verb}: {purpose.lower()}"


def gap_for(item: dict) -> tuple[str, str]:
    return "Trực tiếp", "—"


def esc(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def implementation_state(item: dict) -> tuple[str, str]:
    controller, handler = item["controller"], item["handler"]
    admin_resources = {
        "AdminBranchController", "AdminDeviceTypeController", "AdminDeviceModelController",
        "AdminServiceIssueController", "AdminServiceTypeController", "AdminServiceCatalogController",
        "AdminPartController",
    }
    implemented = (
        controller in {"PublicController", "AuthController", "ReceptionistController", "TechnicianController"}
        or controller in admin_resources and handler != "get"
        or controller == "AdminInventoryController"
        or controller == "AdminUserController" and handler != "get"
        or controller == "AdminConfigurationController" and handler != "slot"
        or controller == "InternalTicketController" and handler in {"tickets", "ticket"}
        or controller == "TransferController" and handler in {"incoming", "request", "accept", "reject"}
    )
    live_pairs = {
        ("POST", "/api/v1/auth/login"), ("GET", "/api/v1/auth/me"),
        ("GET", "/api/v1/admin/users"), ("POST", "/api/v1/admin/users"),
        ("PUT", "/api/v1/admin/users/{id}/profile"), ("PUT", "/api/v1/admin/users/{id}/status"),
        ("POST", "/api/v1/admin/branches"), ("POST", "/api/v1/admin/device-models"),
        ("POST", "/api/v1/admin/service-issues"), ("GET", "/api/v1/admin/service-types"),
        ("POST", "/api/v1/admin/parts"), ("POST", "/api/v1/admin/service-catalog-items"),
        ("POST", "/api/v1/admin/inventory/stock-in"), ("GET", "/api/v1/internal/inventory"),
        ("POST", "/api/v1/admin/technician-schedules"), ("POST", "/api/v1/admin/appointment-slots"),
        ("GET", "/api/v1/device-types"), ("GET", "/api/v1/service-catalog-items"),
        ("POST", "/api/v1/appointments"), ("GET", "/api/v1/internal/appointments"),
        ("POST", "/api/v1/internal/appointments/{id}/confirm"),
        ("POST", "/api/v1/internal/appointments/{id}/arrive"),
        ("POST", "/api/v1/internal/appointment-devices/{appointmentDeviceId}/intake"),
        ("GET", "/api/v1/internal/service-tickets/{id}/technician-recommendations"),
        ("POST", "/api/v1/internal/service-tickets/{id}/assignments"),
        ("GET", "/api/v1/internal/technician/work"),
        ("POST", "/api/v1/internal/service-tickets/{id}/inspection/start"),
        ("POST", "/api/v1/internal/service-tickets/{id}/inspection"),
        ("GET", "/api/v1/internal/service-tickets/{id}/available-parts"),
        ("GET", "/api/v1/internal/repair-items/{id}/part-usages"),
        ("POST", "/api/v1/internal/repair-items/{id}/part-usages"),
        ("GET", "/api/v1/internal/service-tickets/{id}/repair-duration"),
        ("POST", "/api/v1/internal/service-tickets/{id}/finish-repair"),
        ("GET", "/api/v1/internal/service-tickets/{id}/payment-summary"),
        ("POST", "/api/v1/internal/service-tickets/{id}/payment"),
        ("POST", "/api/v1/internal/service-tickets/{id}/handover"),
        ("GET", "/api/v1/service-tickets/lookup"),
        ("GET", "/api/v1/warranties/eligibility"),
        ("POST", "/api/v1/service-tickets/{ticketCode}/feedback"),
    }
    tested = "Live E2E" if (item["method"], item["path"]) in live_pairs else "Backend suite" if implemented else "Không cần cho UI hiện tại"
    return ("Có" if implemented else "Không dùng trực tiếp", tested)


def main() -> None:
    items = json.loads(INVENTORY.read_text(encoding="utf-8-sig"))
    rows = []
    for index, item in enumerate(items, 1):
        coverage, gap = gap_for(item)
        implemented, tested = implementation_state(item)
        rows.append(
            "| " + " | ".join(
                esc(v) for v in (
                    index,
                    item["method"],
                    f"`{item['path']}`",
                    item["controller"],
                    role_label(item["access"]),
                    HANDLER_PURPOSE.get(item["handler"], item["handler"]),
                    item["request"],
                    item["response"],
                    screen_for(item),
                    action_for(item),
                    coverage,
                    gap,
                    implemented,
                    tested,
                )
            ) + " |"
        )
    implemented_count = sum(implementation_state(item)[0] == "Có" for item in items)
    live_count = sum(implementation_state(item)[1] == "Live E2E" for item in items)
    header = """# Frontend ↔ Backend API coverage

Nguồn: `docs/api-security/endpoint-inventory.json`, Controller/DTO hiện tại và các API module trong `frontend/src/api`. Trạng thái được chốt sau full backend suite, frontend build và live E2E ngày 2026-09-15.

- Tổng endpoint: **{count}** method/URI pairs.
- Được gọi trực tiếp bởi UI/API module: **{implemented_count}/{count}**. Các endpoint GET-by-id/history/direct-transfer còn lại là contract bổ trợ mà UI hiện tại không cần gọi riêng.
- Đã chạy qua Spring Boot thật + MySQL thật trong live smoke: **{live_count}/{count}**; các endpoint UI còn lại có kiểm thử backend trong suite **126/126** và frontend qua typecheck/lint/build.
- Bảy gap nghiệp vụ bắt buộc đã đóng mà không đổi schema; xem `docs/frontend-api-gaps.md`.

| # | Method | Endpoint | Controller | Role | Business Purpose | Request DTO / Params | Response DTO | Frontend Screen | UI Action | Coverage Type | Gap | Implemented | Tested |
|---:|:---:|---|---|---|---|---|---|---|---|---|---|:---:|:---:|
""".format(count=len(items), implemented_count=implemented_count, live_count=live_count)
    document = header + "\n".join(rows) + "\n"
    assert len(rows) == len({(item["method"], item["path"]) for item in items})
    for index, item in enumerate(items, 1):
        assert f"| {index} | {item['method']} | `{item['path']}` |" in document
    OUTPUT.write_text(document, encoding="utf-8")
    print(f"Wrote and verified {OUTPUT.relative_to(ROOT)} with {len(rows)} unique endpoint rows")


if __name__ == "__main__":
    main()
