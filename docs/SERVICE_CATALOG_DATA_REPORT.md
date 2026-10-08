# Service Catalog Data Completion Report

Ngày kiểm chứng: 07/10/2026, múi giờ `Asia/Ho_Chi_Minh`.

## Phạm vi và nguyên tắc

Catalog được hoàn thiện trên schema hiện hành, không migration. `service_catalog_items` cho phép nhiều bản ghi cùng model, lỗi và loại dịch vụ khi mỗi lựa chọn gắn một `part_id` khác nhau; đây là cách biểu diễn các lựa chọn replacement mà không thêm bảng hoặc cột mới. Tên dịch vụ được backend sinh từ model, issue và part; trường `name` gửi từ seed để trống có chủ ý.

Giá trong catalog là giá niêm yết nội bộ của TáoCare, xây dựng từ tham chiếu thị trường hiện tại và đã gồm công thay theo semantics dịch vụ. Đây không phải giá chính thức của Apple nếu báo cáo không ghi rõ nguồn Apple. Giá lưu là giá gốc trước ưu đãi đặt lịch trực tuyến; giảm giá được booking engine tính sau đó. `standardDurationMinutes` là thời lượng thao tác kỹ thuật chuẩn, độc lập với ETA, hàng đợi và dự đoán ML.

## Kết quả dữ liệu

- Schema sau preflight: 33 bảng, 305 cột; không thay đổi schema.
- Model ACTIVE: 64 (iPhone 25, iPad 8, MacBook 13, Apple Watch 10, AirPods 8).
- Catalog trước: 4; sau: 304.
- Parts trước: 2 trong database sạch trước seed; sau: 9 (7 part mới, 2 part Pisen có sẵn).
- Catalog sửa chữa thêm: 294, một cho từng model và issue hợp lệ của loại thiết bị.
- Catalog replacement thêm: 6; 2 lựa chọn pin iPhone 13, 1 màn hình iPhone 13, và 1 lựa chọn cho iPad thế hệ 9, MacBook Air M1, Apple Watch Series 6, AirPods thế hệ 2.
- 64/64 model ACTIVE có ít nhất một catalog; mọi issue hợp lệ theo device type đều có catalog REPAIR.
- Không tạo mapping issue sai loại thiết bị; không tạo Camera cho AirPods, và không tạo issue ngoài năm issue hiện có.
- Tồn kho demo: mỗi part replacement mới có tối đa 3 đơn vị tại chi nhánh 1070, qua lot và stock-in API. Không tạo customer, appointment, ticket, assignment, part usage hay ML prediction.

## Replacement options và provenance

| Nhóm | Model / issue | Lựa chọn | Giá TáoCare | Thời lượng | Độ tin cậy / nguồn |
|---|---|---|---:|---:|---|
| iPhone battery | iPhone 13 / Pin | Deji chuẩn 3227mAh; Deji cao 3510mAh | 690.000; 780.000 | 30 phút | HIGH: Deji Việt Nam công bố model và dung lượng; giá dịch vụ tham chiếu được làm tròn và giữ riêng khỏi giá part-only |
| iPhone display | iPhone 13 / Màn hình | Deji OLED | 1.500.000 | 45 phút | HIGH: Deji Việt Nam công bố OLED iPhone 13; không gắn nhãn Apple Genuine |
| iPad battery | iPad thế hệ 9 / Pin | Apple Genuine – dịch vụ thay thế | 1.590.000 | 90 phút | MEDIUM: biểu diễn semantics dịch vụ Apple, không tuyên bố giá chính thức Apple; cần đối soát nhà cung cấp trước triển khai thương mại |
| MacBook battery | MacBook Air M1 A2337 / Pin | Pisen A2389 | 2.400.000 | 90 phút | HIGH: tham chiếu dịch vụ công bố Pisen tương thích A2337/A2389 |
| Apple Watch battery | Series 6 / Pin | Apple Genuine – dịch vụ thay thế | 1.390.000 | 60 phút | MEDIUM: chỉ biểu diễn dịch vụ thay thế, không invent capacity; cần xác nhận availability từng thời điểm |
| AirPods battery | AirPods thế hệ 2 / Pin | Apple Genuine – dịch vụ thay thế | 1.190.000 | 45 phút | HIGH về semantics: Apple mô tả repair/replacement và linh kiện thay thế; giá là bảng nội bộ, không phải báo giá Apple |

Tham chiếu nghiên cứu: [Deji iPhone 13 chuẩn 3227mAh](https://deji.vn/thay-pin-iphone-13-dung-luong-chuan-3227mah-deji), [Deji iPhone 13 dung lượng cao](https://deji.vn/), [Deji iPhone 13 Pro Max high-capacity](https://deji.vn/thay-pin-iphone-13-pro-max-dung-luong-sieu-cao-4750mah-deji), [Pisen MacBook Air M1 A2337/A2389](https://dienthoaivui.com.vn/thay-pin-macbook-air-m1-2020-2021-a2337-pisen), [Apple AirPods repair/replacement semantics](https://support.apple.com/vi-vn/airpods/repair).

Các model khác được phủ bằng catalog REPAIR với tier giá và thời lượng theo nhóm thiết bị. Không thêm replacement khi chưa có evidence tương thích model cụ thể; các mục này được ghi là cần business input thay vì bịa brand/capacity.

## Các tiêu chí đã kiểm tra

- Không có duplicate exact catalog key `(device_model_id, service_type_id, service_issue_id, part_id)`.
- Replacement luôn có part ACTIVE; repair không bị ép phải có part.
- Capacity chỉ xuất hiện ở hai part iPhone 13 có nguồn trực tiếp; không copy capacity giữa model.
- Apple Genuine được ghi riêng, không trộn với Deji/Pisen.
- Giá base không trừ 10% online discount.
- Tất cả catalog có standard duration dương; ML contract, model CatBoost và synthetic dataset không thay đổi.
- Seed dùng `scripts/seed-service-catalog.ps1`, có guard `-AllowCanonical`, nhận diện theo part code/catalog key và chạy lại không nhân đôi.
- Kiểm tra read-only hậu seed vẫn ghi nhận các bảng nghiệp vụ không có dữ liệu mới; 1 lot và 2 transaction cũ được giữ nguyên, 7 lot/7 transaction mới là stock-in cho parts catalog.

## Giới hạn có chủ ý

Schema `parts` không có cột compatibility/capacity riêng. Compatibility được bảo đảm bằng việc chỉ liên kết part vào catalog model cụ thể; capacity/type chỉ nằm trong variant khi đã có nguồn. AirPods và Apple Watch không được gán aftermarket khi chưa có bằng chứng trực tiếp. Catalog này đủ cho demo và kiểm thử booking/intake; chưa phải bảng giá thương mại cuối cùng.
## Verification after seed

- Public API filter `deviceModelId=1401&serviceIssueId=298&serviceTypeId=318` returns two iPhone 13 battery options: Deji 3227mAh (690,000; online 621,000) and Deji 3510mAh (780,000; online 702,000), both with a 30-minute standard duration.
- Seed rerun is idempotent: `catalogItemsAfter=304`, `partsAfter=9`, with no new additions.
- Maven test on an isolated 33-table database: 232 tests, 0 failures, 0 errors, 1 skipped — PASS.
- ML regression suite: 102 passed. Frontend typecheck/lint/build: PASS; the remaining Rollup messages are dependency warnings from Zod.
- Frozen artifact SHA-256 values are unchanged: CatBoost `147B5153BCEA0E56651D5535B2B09184208C0E832CC2DE42E01657D9B55CF1AE`, feature contract `18D6EB1C0BDAC678473FB87F79024AFADCFD10B5F271E97B82394AC594282959`, synthetic dataset `A0D7BFD0ACE36C7FB940A62203DCD8EF75875391455F65B11E52DF66E3E43C2F`.
- Note on cumulative checkpoints: the canonical seed summary used for this verification started at 298 existing catalog rows and 3 existing parts, then added 6 parts and 6 replacement catalog rows to reach 304/9. Earlier historical counts in this report describe the pre-catalog phase baseline; they are not a second mutation during this run.
