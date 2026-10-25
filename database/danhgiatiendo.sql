-- ============================================================================
-- TRUY VẤN THỜI GIAN SỬA CHỮA THỰC TẾ & ĐỘ LỆCH SO VỚI CẤU HÌNH THEO TỪNG CA
-- ============================================================================

SELECT 
    st.ticket_code AS 'Mã Phiếu',
    u.full_name AS 'KTV Thực Hiện',
    sci.name AS 'Hạng Mục Dịch Vụ',
    DATE_FORMAT(st.actual_repair_started_at, '%H:%i %d/%m/%Y') AS 'Bắt Đầu Sửa',
    DATE_FORMAT(st.actual_repair_completed_at, '%H:%i %d/%m/%Y') AS 'Hoàn Thành Sửa',
    
    -- Thời gian sửa thực tế (tính bằng Phút)
    TIMESTAMPDIFF(MINUTE, st.actual_repair_started_at, st.actual_repair_completed_at) AS 'Thực Tế (Phút)',
    
    -- Thời gian chuẩn cấu hình trong hệ thống (tính bằng Phút)
    sci.standard_duration_minutes AS 'Cấu Hình Chuẩn (Phút)',
    
    -- Độ lệch thời gian = Thực tế - Cấu hình chuẩn
    (TIMESTAMPDIFF(MINUTE, st.actual_repair_started_at, st.actual_repair_completed_at) - sci.standard_duration_minutes) AS 'Độ Lệch (Phút)',
    
    -- Đánh giá tiến độ làm việc
    CASE 
        WHEN TIMESTAMPDIFF(MINUTE, st.actual_repair_started_at, st.actual_repair_completed_at) < sci.standard_duration_minutes 
            THEN CONCAT('Nhanh hơn ', (sci.standard_duration_minutes - TIMESTAMPDIFF(MINUTE, st.actual_repair_started_at, st.actual_repair_completed_at)), ' phút')
        WHEN TIMESTAMPDIFF(MINUTE, st.actual_repair_started_at, st.actual_repair_completed_at) > sci.standard_duration_minutes 
            THEN CONCAT('Trễ ', (TIMESTAMPDIFF(MINUTE, st.actual_repair_started_at, st.actual_repair_completed_at) - sci.standard_duration_minutes), ' phút')
        ELSE 'Đúng tiến độ'
    END AS 'Đánh Giá Tiến Độ'

FROM service_tickets st
JOIN assignments a ON a.service_ticket_id = st.id
JOIN users u ON a.technician_id = u.id
JOIN repair_items ri ON ri.service_ticket_id = st.id
JOIN service_catalog_items sci ON ri.service_catalog_item_id = sci.id
WHERE st.actual_repair_started_at IS NOT NULL 
  AND st.actual_repair_completed_at IS NOT NULL
ORDER BY st.id DESC;