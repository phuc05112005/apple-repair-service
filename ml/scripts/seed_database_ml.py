import os
import datetime
import random
import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text

# Cấu hình CSDL hệ thống
DB_USER = "root"
DB_PASS = "123456"
DB_HOST = "localhost"
DB_PORT = "3307"
DB_NAME = "apple_repair_service"

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL)

# ---------------------------------------------------------------- THAM SỐ MÔ PHỎNG (công khai để báo cáo mô tả đúng)
SEED = 42                      # cố định hạt ngẫu nhiên => cùng một bộ dữ liệu mỗi lần chạy (tái lập được)
N_PASSES = 5                   # mỗi dịch vụ trong danh mục được sinh N_PASSES lần
SIGMA = 0.15                   # nhiễu NHÂN lognormal: thời gian = định mức x hệ số KTV x exp(N(0, SIGMA^2))
SPEED = {"t1": 0.90, "t2": 1.00, "t3": 1.15}   # hệ số tốc độ KTV (nhỏ = nhanh)
P_MULTI = 0.35                 # xác suất phiếu có nhiều dịch vụ
BUNDLE_DISCOUNT = 12           # phút giảm cho mỗi dịch vụ ghép thêm (tháo máy một lần)
# Phân bổ KTV: ca khó (catalog_id chia hết cho 4) và ca thường. KTV nào cũng nhận cả hai loại ca (tránh lẫn độ khó với tay nghề)
P_TECH_HARD = (0.55, 0.35, 0.10)
P_TECH_NORMAL = (0.40, 0.35, 0.25)
# Kịch bản: 1 bình thường | 2 chờ khách duyệt | 3 linh kiện lỗi chờ đổi | 4 hủy | 5 chuyển giao KTV
SCENARIO_WEIGHTS = [0.66, 0.12, 0.08, 0.08, 0.06]
# QUAN TRỌNG: kịch bản 2 và 3 chỉ được tính vào dữ liệu nếu GHI ĐƯỢC lịch sử chờ (resolved_at) để nhãn "thời gian thuần"
# trừ đúng thời gian chờ. Nếu cộng phút chờ vào thời gian sửa mà không ghi lịch sử chờ thì nhãn bị nhiễu không thể học.


def _pause_columns_ok(conn) -> bool:
    """Kiểm tra bảng service_status_histories có đủ cột để ghi thời gian chờ không (và không có cột bắt buộc lạ)."""
    cols = pd.read_sql(text("""SELECT COLUMN_NAME AS c, IS_NULLABLE AS n, COLUMN_DEFAULT AS d, EXTRA AS e
        FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_status_histories'"""), conn)
    if cols.empty:
        return False
    known = {"id", "service_ticket_id", "from_status", "to_status", "changed_at", "resolved_at", "changed_by", "note", "reason", "created_at"}
    names = set(cols["c"].str.lower())
    if not {"service_ticket_id", "to_status", "changed_at", "resolved_at"} <= names:
        return False
    required_unknown = cols[(cols["n"] == "NO") & cols["d"].isna() & ~cols["e"].str.contains("auto_increment", case=False, na=False)
                            & ~cols["c"].str.lower().isin(known)]
    return required_unknown.empty


def run_db_seeder(n_passes=N_PASSES):
    random.seed(SEED)
    np.random.seed(SEED)
    print("=== ĐANG KẾT NỐI CƠ SỞ DỮ LIỆU HỆ THỐNG (PHIÊN BẢN PRODUCTION-GRADE) ===")
    
    with engine.begin() as conn:
        pause_ok = _pause_columns_ok(conn)
        weights = list(SCENARIO_WEIGHTS)
        if not pause_ok:
            print("CẢNH BÁO: không ghi được lịch sử chờ vào service_status_histories (schema khác dự kiến) -> bỏ kịch bản 2, 3 "
                  "để nhãn không bị nhiễu bởi thời gian chờ không ghi nhận.")
            weights[0] += weights[1] + weights[2]
            weights[1] = weights[2] = 0.0
        print("1. Dọn dẹp dữ liệu seed cũ...")
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        conn.execute(text("DELETE FROM part_usages WHERE repair_item_id IN (SELECT id FROM repair_items WHERE service_ticket_id IN (SELECT id FROM service_tickets WHERE ticket_code LIKE 'ST-SEED-%'));"))
        conn.execute(text("DELETE FROM repair_items WHERE service_ticket_id IN (SELECT id FROM service_tickets WHERE ticket_code LIKE 'ST-SEED-%');"))
        conn.execute(text("DELETE FROM assignments WHERE service_ticket_id IN (SELECT id FROM service_tickets WHERE ticket_code LIKE 'ST-SEED-%');"))
        conn.execute(text("DELETE FROM service_status_histories WHERE service_ticket_id IN (SELECT id FROM service_tickets WHERE ticket_code LIKE 'ST-SEED-%');"))
        conn.execute(text("DELETE FROM service_tickets WHERE ticket_code LIKE 'ST-SEED-%';"))
        conn.execute(text("DELETE FROM customer_devices WHERE serial_number LIKE 'DNXSEED%';"))
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))

        print("2. Truy vấn danh mục Dịch vụ & Nhân sự...")
        catalogs = pd.read_sql("""
            SELECT sci.id AS catalog_id, sci.name AS catalog_name, sci.device_model_id, sci.part_id, 
                   sci.standard_duration_minutes, COALESCE(sci.configured_price, 550000.00) AS price
            FROM service_catalog_items sci
            JOIN device_models dm ON sci.device_model_id = dm.id
            WHERE sci.status = 'ACTIVE' AND dm.status = 'ACTIVE';
        """, conn)

        techs = pd.read_sql("SELECT id FROM users WHERE role = 'TECHNICIAN' ORDER BY id ASC;", conn)
        rec = pd.read_sql("SELECT id FROM users WHERE role = 'RECEPTIONIST' LIMIT 1;", conn)
        branch = pd.read_sql("SELECT id FROM branches WHERE status = 'ACTIVE' LIMIT 1;", conn)

        tech_ids = techs["id"].tolist()
        t1 = tech_ids[0]
        t2 = tech_ids[1] if len(tech_ids) > 1 else t1
        t3 = tech_ids[2] if len(tech_ids) > 2 else t1
        
        rec_id = int(rec.iloc[0]["id"]) if not rec.empty else 1
        branch_id = int(branch.iloc[0]["id"]) if not branch.empty else 1

        print("3. Sinh dữ liệu với 5 kịch bản vận hành thực tế...")
        ticket_counter = 1
        ml_records = []
        now = datetime.datetime.now()

        for pass_num in range(1, n_passes + 1):
            for _, cat in catalogs.iterrows():
                # Phân bổ KTV & Trình độ
                probs = P_TECH_HARD if cat["catalog_id"] % 4 == 0 else P_TECH_NORMAL
                k_tech = random.choices([0, 1, 2], weights=probs)[0]
                selected_tech = (t1, t2, t3)[k_tech]
                speed_factor = (SPEED["t1"], SPEED["t2"], SPEED["t3"])[k_tech]

                # Xác suất ca đa dịch vụ
                rand_multi = random.random()
                num_issues = 1
                base_combined = int(cat["standard_duration_minutes"])
                sub_items = []

                if rand_multi < P_MULTI:
                    sub_df = catalogs[(catalogs["device_model_id"] == cat["device_model_id"]) & (catalogs["catalog_id"] != cat["catalog_id"])]
                    if not sub_df.empty:
                        n_extra = 1 if rand_multi < P_MULTI * 0.75 else min(2, len(sub_df))
                        sampled_subs = sub_df.sample(n=n_extra)
                        num_issues = 1 + n_extra
                        base_combined = max(25, int(base_combined + sampled_subs["standard_duration_minutes"].sum() - (BUNDLE_DISCOUNT * n_extra)))
                        sub_items = sampled_subs.to_dict('records')

                # PHÂN BỔ 5 KỊCH BẢN VẬN HÀNH
                scenario = random.choices([1, 2, 3, 4, 5], weights=weights)[0]
                
                # Phân phối thời gian thực tế
                skewed_noise = np.random.lognormal(mean=0, sigma=SIGMA)
                actual_minutes = int(round(base_combined * speed_factor * skewed_noise))

                status = 'HANDED_OVER'
                cancel_reason = None
                
                pause_minutes, pause_status = 0, None
                if scenario == 2:   # chờ khách duyệt: thời gian chờ được GHI lại riêng, không nằm trong thời gian thuần
                    pause_minutes, pause_status = random.randint(15, 35), "WAITING_APPROVAL"
                elif scenario == 3: # linh kiện lỗi, chờ đổi: cũng ghi lại là thời gian chờ
                    pause_minutes, pause_status = random.randint(20, 45), "WAITING_PART"
                elif scenario == 4: # Hủy ca do máy hỏng nặng (Dẫn đến nhãn <= 0)
                    status = 'CANCELLED'
                    actual_minutes = 0 # Đưa về 0 để notebook làm sạch nhãn <= 0
                    cancel_reason = 'Khách hủy: Mainboard nứt hỏng nặng không thể phục hồi'
                elif scenario == 5: # Chuyển giao KTV
                    actual_minutes += random.randint(10, 20)

                if scenario != 4:
                    actual_minutes = max(10, actual_minutes)

                # Mốc thời gian
                t_receive = now - datetime.timedelta(days=random.randint(1, 35), hours=random.randint(8, 18))
                t_assign = t_receive + datetime.timedelta(minutes=random.randint(2, 10))
                t_start = t_assign + datetime.timedelta(minutes=random.randint(5, 12))
                t_finish = t_start + datetime.timedelta(minutes=actual_minutes + pause_minutes)
                t_handover = t_finish + datetime.timedelta(minutes=random.randint(8, 25))

                ticket_code = f"ST-SEED-{ticket_counter:05d}"
                serial_num = f"DNXSEED{ticket_counter:05d}"

                # A. Customer & Device
                cust_res = conn.execute(
                    text("INSERT INTO customers (full_name, phone, created_at, updated_at) VALUES (:name, :phone, :t, :t) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);"),
                    {"name": f"Khách SEED {ticket_counter}", "phone": f"090{ticket_counter:07d}", "t": t_receive}
                )
                cust_id = cust_res.lastrowid

                dev_res = conn.execute(
                    text("INSERT INTO customer_devices (customer_id, device_model_id, serial_number, storage, created_at, updated_at) VALUES (:cid, :dmid, :sn, '128GB', :t, :t);"),
                    {"cid": cust_id, "dmid": int(cat["device_model_id"]), "sn": serial_num, "t": t_receive}
                )
                device_id = dev_res.lastrowid

                # B. Service Ticket
                st_res = conn.execute(
                    text("""
                        INSERT INTO service_tickets (
                            ticket_code, status, branch_id, customer_device_id, created_by, handed_over_by,
                            received_at, actual_repair_started_at, actual_repair_completed_at, handed_over_at, paid_at,
                            discount_percent, payment_status, payment_method, customer_reported_issue, inspection_result,
                            cancel_reason, estimate_source, estimated_duration_minutes, updated_at
                        ) VALUES (
                            :code, :status, :bid, :did, :rec, :rec,
                            :t_rec, :t_start, IF(:status='CANCELLED', NULL, :t_fin), IF(:status='CANCELLED', NULL, :t_ho), IF(:status='CANCELLED', NULL, :t_ho),
                            0.00, IF(:status='CANCELLED', 'PENDING', 'PAID'), 'CASH', :issue, 'Đã kiểm tra chẩn đoán kỹ thuật',
                            :c_reason, 'STANDARD', :est_dur, :t_ho
                        );
                    """),
                    {
                        "code": ticket_code, "status": status, "bid": branch_id, "did": device_id, "rec": rec_id,
                        "t_rec": t_receive, "t_start": t_start, "t_fin": t_finish, "t_ho": t_handover,
                        "issue": f"Yêu cầu: {cat['catalog_name']}", "c_reason": cancel_reason, "est_dur": base_combined
                    }
                )
                ticket_id = st_res.lastrowid

                # C. Assignment (Sửa 'TRANSFERRED' thành 'ENDED' đúng với ENUM của MySQL)
                if scenario == 5:
                    conn.execute(
                        text("INSERT INTO assignments (service_ticket_id, technician_id, assigned_by, assigned_at, ended_at, status, source) VALUES (:tid, :tech, :rec, :t_as, :t_mid, 'ENDED', 'MANUAL_OVERRIDE');"),
                        {"tid": ticket_id, "tech": int(selected_tech), "rec": rec_id, "t_as": t_assign, "t_mid": t_start}
                    )
                    next_tech = t2 if selected_tech != t2 else t1
                    conn.execute(
                        text("INSERT INTO assignments (service_ticket_id, technician_id, assigned_by, assigned_at, ended_at, status, source) VALUES (:tid, :tech, :rec, :t_mid, :t_fin, 'ENDED', 'MANUAL_OVERRIDE');"),
                        {"tid": ticket_id, "tech": int(next_tech), "rec": rec_id, "t_mid": t_start, "t_fin": t_finish}
                    )
                else:
                    conn.execute(
                        text("INSERT INTO assignments (service_ticket_id, technician_id, assigned_by, assigned_at, ended_at, status, source) VALUES (:tid, :tech, :rec, :t_as, :t_fin, 'ENDED', 'MANUAL_OVERRIDE');"),
                        {"tid": ticket_id, "tech": int(selected_tech), "rec": rec_id, "t_as": t_assign, "t_fin": t_finish}
                    )

                # C2. Lịch sử chờ (để nhãn thuần = tổng thời gian - thời gian chờ)
                if pause_status:
                    t_pause = t_start + datetime.timedelta(minutes=max(1, actual_minutes // 3))
                    conn.execute(
                        text("INSERT INTO service_status_histories (service_ticket_id, to_status, changed_at, resolved_at) VALUES (:tid, :st, :t1, :t2);"),
                        {"tid": ticket_id, "st": pause_status, "t1": t_pause, "t2": t_pause + datetime.timedelta(minutes=pause_minutes)}
                    )

                # D. Repair Items
                app_status = 'REJECTED' if status == 'CANCELLED' else 'APPROVED'
                ri_res = conn.execute(
                    text("INSERT INTO repair_items (service_ticket_id, service_catalog_item_id, item_name_snapshot, base_price, final_price, approval_status, created_at, updated_at) VALUES (:tid, :cid, :name, :p, :p, :app, :t, :t);"),
                    {"tid": ticket_id, "cid": int(cat["catalog_id"]), "name": cat["catalog_name"], "p": cat["price"], "app": app_status, "t": t_start}
                )
                repair_item_id = ri_res.lastrowid

                for sub in sub_items:
                    conn.execute(
                        text("INSERT INTO repair_items (service_ticket_id, service_catalog_item_id, item_name_snapshot, base_price, final_price, approval_status, created_at, updated_at) VALUES (:tid, :cid, :name, :p, :p, :app, :t, :t);"),
                        {"tid": ticket_id, "cid": int(sub["catalog_id"]), "name": sub["catalog_name"], "p": sub["price"], "app": app_status, "t": t_start}
                    )

                # E. Part Usages
                if status != 'CANCELLED' and pd.notnull(cat["part_id"]):
                    if scenario == 3:
                        conn.execute(
                            text("INSERT INTO part_usages (repair_item_id, part_id, quantity, used_at, recorded_by, status, defective_return_note) VALUES (:riid, :pid, 1, :t, :tech, 'REVERSED', 'Lỗi nguồn NSX');"),
                            {"riid": repair_item_id, "pid": int(cat["part_id"]), "t": t_start, "tech": int(selected_tech)}
                        )
                        conn.execute(
                            text("INSERT INTO part_usages (repair_item_id, part_id, quantity, used_at, recorded_by, status) VALUES (:riid, :pid, 1, :t2, :tech, 'ACTIVE');"),
                            {"riid": repair_item_id, "pid": int(cat["part_id"]), "t2": t_start + datetime.timedelta(minutes=15), "tech": int(selected_tech)}
                        )
                    else:
                        conn.execute(
                            text("INSERT INTO part_usages (repair_item_id, part_id, quantity, used_at, recorded_by, status) VALUES (:riid, :pid, 1, :t, :tech, 'ACTIVE');"),
                            {"riid": repair_item_id, "pid": int(cat["part_id"]), "t": t_start, "tech": int(selected_tech)}
                        )

                # F. ML Record
                ml_records.append({
                    "ticket_id": ticket_code,
                    "device_model_id": cat["device_model_id"],
                    "technician_id": selected_tech,
                    "num_issues": num_issues,
                    "catalog_duration_minutes": base_combined,
                    "actual_duration_minutes": actual_minutes,
                    "status": status,
                    "scenario": scenario
                })

                ticket_counter += 1

        print(f"=== ĐÃ SINH THÀNH CÔNG {len(ml_records)} PHIẾU ĐA DẠNG VÀO CSDL HỆ THỐNG ===")
        
        df_ml = pd.DataFrame(ml_records)
        df_ml.to_csv("repair_dataset_clean.csv", index=False)
        print("Đã ghi đè dữ liệu huấn luyện ML thực tế: repair_dataset_clean.csv")

if __name__ == "__main__":
    run_db_seeder()