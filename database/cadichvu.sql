-- ============================================================================
-- MASTER DATASET EXTRACTION FOR MACHINE LEARNING TRAINING
-- Target Variable: pure_repair_duration_minutes (Net Technician Working Time)
-- Database: apple_repair_service
-- ============================================================================

SELECT 
    -- 1. IDENTIFIERS & CONTEXT FEATURES
    st.ticket_code,
    st.branch_id,
    st.created_by AS receptionist_id,
    
    -- 2. TECHNICIAN FEATURES (CORE)
    a.technician_id,
    a.source AS assignment_source,                      -- ENUM: MANUAL_OVERRIDE, TRANSFER
    
    -- 3. DEVICE FEATURES (SIMPLIFIED MODEL GRANULARITY)
    cd.device_model_id,
    dm.name AS device_model_name,                       -- Raw Device Model Name (e.g. 'iPhone 17 Pro')
    
    -- 4. SERVICE SCOPE FEATURES (AGGREGATED & CLEANED)
    COUNT(DISTINCT ri.id) AS total_repair_items,        -- Total items count in ticket (Multi-item feature)
    GROUP_CONCAT(DISTINCT styp.code SEPARATOR ',') AS service_type_codes, -- ENUM: REPLACEMENT, REPAIR, CLEANING
    GROUP_CONCAT(DISTINCT ri.service_catalog_item_id SEPARATOR ',') AS service_catalog_item_ids,
    COALESCE(SUM(ri.final_price), 0) AS total_repair_price, -- Ticket total value
    
    -- 5. INTERRUPTION & TRANSFER FLAGS
    IF(COUNT(DISTINCT tr.id) > 0, 1, 0) AS is_transferred, -- Transfer flag: 1 if transferred, 0 otherwise
    
    -- 6. TEMPORAL FEATURES (DERIVED FROM RECEIVE TIME)
    HOUR(st.received_at) AS receive_hour,               -- Hour of day (8 to 18)
    DAYOFWEEK(st.received_at) AS receive_day_of_week,   -- Day of week (1: Sunday, 2: Monday, ..., 7: Saturday)
    
    -- 7. BASELINE ESTIMATE (SYSTEM STANDARD DURATION)
    st.estimated_duration_minutes,                      -- System baseline standard duration
    
    -- 8. RAW TIMESTAMP MILESTONES
    st.actual_repair_started_at,
    st.actual_repair_completed_at,
    
    -- 9. WAITING TIME FEATURES (INTERRUPTIONS)
    COALESCE(wa.approval_wait_minutes, 0) AS approval_wait_minutes,
    COALESCE(wp.part_wait_minutes, 0) AS part_wait_minutes,
    (COALESCE(wa.approval_wait_minutes, 0) + COALESCE(wp.part_wait_minutes, 0)) AS total_interruption_minutes,

    -- 10. GROSS DURATION (START TO FINISH)
    TIMESTAMPDIFF(MINUTE, st.actual_repair_started_at, st.actual_repair_completed_at) AS gross_repair_duration_minutes,

    -- ========================================================================
    -- 11. TARGET VARIABLE FOR ML TRAINING (PURE TECHNICIAN ACTION DURATION)
    -- ========================================================================
    (
        TIMESTAMPDIFF(MINUTE, st.actual_repair_started_at, st.actual_repair_completed_at) 
        - COALESCE(wa.approval_wait_minutes, 0) 
        - COALESCE(wp.part_wait_minutes, 0)
    ) AS pure_repair_duration_minutes

FROM service_tickets st
JOIN customer_devices cd ON st.customer_device_id = cd.id
JOIN device_models dm ON cd.device_model_id = dm.id
JOIN assignments a ON st.id = a.service_ticket_id AND a.status = 'ENDED'
JOIN users u_tech ON a.technician_id = u_tech.id AND u_tech.role = 'TECHNICIAN'
JOIN repair_items ri ON st.id = ri.service_ticket_id
LEFT JOIN service_catalog_items sci ON ri.service_catalog_item_id = sci.id
LEFT JOIN service_types styp ON sci.service_type_id = styp.id
LEFT JOIN transfers tr ON a.id = tr.from_assignment_id

-- Subquery 1: Calculate exact wait time for customer approval (WAITING_APPROVAL)
LEFT JOIN (
    SELECT 
        h1.service_ticket_id,
        SUM(TIMESTAMPDIFF(MINUTE, h1.changed_at, h2.changed_at)) AS approval_wait_minutes
    FROM service_status_histories h1
    JOIN service_status_histories h2 
      ON h1.service_ticket_id = h2.service_ticket_id 
     AND h1.id < h2.id 
     AND h2.id = (
         SELECT MIN(id) 
         FROM service_status_histories 
         WHERE service_ticket_id = h1.service_ticket_id AND id > h1.id
     )
    WHERE h1.to_status = 'WAITING_APPROVAL'
    GROUP BY h1.service_ticket_id
) wa ON st.id = wa.service_ticket_id

-- Subquery 2: Calculate exact wait time for part dispatch (WAITING_PART)
LEFT JOIN (
    SELECT 
        h1.service_ticket_id,
        SUM(TIMESTAMPDIFF(MINUTE, h1.changed_at, h2.changed_at)) AS part_wait_minutes
    FROM service_status_histories h1
    JOIN service_status_histories h2 
      ON h1.service_ticket_id = h2.service_ticket_id 
     AND h1.id < h2.id 
     AND h2.id = (
         SELECT MIN(id) 
         FROM service_status_histories 
         WHERE service_ticket_id = h1.service_ticket_id AND id > h1.id
     )
    WHERE h1.to_status = 'WAITING_PART'
    GROUP BY h1.service_ticket_id
) wp ON st.id = wp.service_ticket_id

WHERE st.actual_repair_started_at IS NOT NULL 
  AND st.actual_repair_completed_at IS NOT NULL

GROUP BY 
    st.id, st.ticket_code, st.branch_id, st.created_by,
    st.received_at, a.id, a.technician_id, a.source,
    cd.device_model_id, dm.name,
    st.estimated_duration_minutes, st.actual_repair_started_at, st.actual_repair_completed_at,
    wa.approval_wait_minutes, wp.part_wait_minutes

ORDER BY st.id ASC;