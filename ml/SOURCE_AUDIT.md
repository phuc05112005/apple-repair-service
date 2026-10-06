# Source audit — ML Experiment V3

Ngày audit: 06/10/2026. Chỉ ml/ được sửa; source Java/schema và tài liệu môn học
được đọc, không thay đổi.

## Tài liệu môn học đã đọc

| File | Nội dung áp dụng |
|---|---|
| D:\Class\AI\Hoc_may_Hoi_quy_Phan_loai\01_Hoi_quy.ipynb | regression, baseline, tree/RF, MAE/MSE/RMSE/R², pipeline và CV |
| D:\Class\AI\Hoc_may_Hoi_quy_Phan_loai\02_Phan_loai.ipynb | phân biệt classification; không dùng accuracy/F1/ROC cho bài toán này |
| ...\apple_repair_ml_study\docs\01_COURSE_KNOWLEDGE_MAP.md | ánh xạ kiến thức sang duration regression |
| ...\apple_repair_ml_study\docs\02_REGRESSION_THEORY.md | công thức regression, boosting, gradient/Hessian |
| ...\apple_repair_ml_study\docs\04_EXPERIMENT_DESIGN.md | temporal selection và untouched holdout |
| D:\Class\AI\Bao_cao_Hoi_quy_va_Phan_loai.md | fit preprocessing trên train, không tune test, lưu fitted pipeline |

## Source production đã đối chiếu

| Source | Kết luận |
|---|---|
| entity/RepairItem.java | có concrete catalog, approval, warrantyRemedy, warrantySourceItem |
| entity/ServiceCatalogItem.java | có model, issue, service type, standard duration, warranty remedy/replacement catalog |
| entity/ServiceType.java, ServiceTypeCode.java | legacy code vẫn có WARRANTY; V3 không refactor DB |
| entity/ServiceStatusHistory.java | status và changedAt cho interval có thứ tự |
| entity/Assignment.java | technician, assignedAt, optional endedAt |
| service/RepairDurationService.java | active status đúng là INSPECTING và REPAIRING; history phải liên tục |
| service/TimingMetricsService.java | attribution giao active interval với assignment interval |
| WarrantyService.java, WarrantyPolicy.java, WarrantyClaimService.java | warranty item nối source item; remedy cuối là sửa hoặc thay |
| database/schema.sql | xác nhận FK/cột remedy/source, assignments, histories, interruptions; không có full canonical seed |

## Quyết định V3

- Warranty là context: is_warranty; thao tác kỹ thuật chỉ REPAIR/REPLACEMENT.
- Extractor thật sẽ lấy warranty từ warranty_source_item_id và resolve action từ
  repair-item/catalog remedy hoặc catalog thực thi.
- Target giữ nguyên active intervals giao assignment; interruption chưa bị trừ.
- Grain bảo thủ loại multi-item, transfer và history không đầy đủ.
- Ba tầng history overall/issue/catalog đều dùng completion strictly before
  prediction; test dựng lại độc lập.
- V2 CSV, notebook, contract, report và artifacts vẫn tồn tại để audit.
- Chỉ chạy synthetic experiment; không đọc/ghi database nghiệp vụ.
