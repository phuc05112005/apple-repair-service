# Tài liệu học máy: dự đoán thời gian sửa chữa theo kỹ thuật viên

Hệ thống: Nền tảng quản lý dịch vụ sửa chữa (apple-repair-service). Phiên bản tài liệu: ML v3.1.
Tài liệu này giải thích **vì sao** và **như thế nào** cho toàn bộ phần học máy: bài toán, dữ liệu, quy trình từng bước, từng mô hình (ý tưởng, thuật toán, công thức), cách so sánh, cách đọc kết quả, cách tích hợp và cách viết báo cáo. Đọc từ đầu đến cuối là hiểu bản chất; dùng mục lục để tra khi cần.

## Mục lục
0. Cách dùng tài liệu và tình trạng số liệu
1. Bài toán học máy
2. Dữ liệu
3. Bức tranh toàn bộ quy trình và các nguyên tắc chống sai phạm
4. Quy trình chi tiết từng bước (khớp 19 bước của notebook)
5. Các mô hình: vì sao chọn, thuật toán, so sánh
6. Cơ sở thống kê của việc đánh giá và so sánh
7. Cách đọc kết quả và ra quyết định
8. Tích hợp vào hệ thống và vận hành
9. Bảng điền số cho báo cáo
10. Giới hạn và các mối đe dọa tính hợp lệ
11. Mẫu viết báo cáo
12. Câu hỏi thường gặp của hội đồng
13. Phụ lục: ghi chú kiểm toán lần chạy đầu, ký hiệu, tài liệu tham khảo

---

## 0. Cách dùng tài liệu và tình trạng số liệu

**Quan trọng nhất.** Tài liệu này cố ý **không** ghi sẵn các con số kết quả (MAE, R², hệ số KTV...) của lần chạy đầu, vì lần chạy đó dùng dữ liệu trộn hai nguồn (xem Phụ lục 13.1) nên số liệu không dùng được cho báo cáo. Mọi con số phải lấy từ lần chạy lại trên dữ liệu một nguồn và điền vào **mục 9**. Phần giải thích, công thức, quy trình và cách lập luận dưới đây không phụ thuộc vào con số.

Ba quy ước đọc:
* **"Notebook Bước n"** là bước thứ n trong `notebooks/model_selection.ipynb`.
* Chữ **nên viết vào báo cáo** đánh dấu câu có thể dùng gần như nguyên văn (sau khi điền số).
* Chữ **không nói** đánh dấu cách diễn đạt sai hoặc quá tay mà hội đồng dễ bắt lỗi.

---

## 1. Bài toán học máy

### 1.1 Phát biểu bằng lời
Khi khách giao máy, nhân viên lập các hạng mục sửa chữa. Hệ thống cần trả lời hai câu hỏi: "nếu giao phiếu này cho kỹ thuật viên A thì bao lâu xong?" và "giao cho ai thì xong sớm nhất?". Câu trả lời dùng để tính **giờ hoàn thành dự kiến (ETA)** cho khách và để **gợi ý phân công**.

### 1.2 Phát biểu bằng toán
Đây là bài toán **học có giám sát, dạng hồi quy**: học một hàm $f$ từ đặc trưng $\mathbf x$ sang một số thực dương $y$ (phút).

$$\hat y = f_\theta(\mathbf x), \qquad \mathbf x = (\text{đời máy},\ \text{KTV},\ \text{tập mã lỗi},\ \text{số dịch vụ},\ \text{định mức catalog})$$

Tại sao là hồi quy và không phải phân loại: đầu ra là đại lượng liên tục (số phút), cần sai số tính bằng phút để tính ETA. Tại sao là học có giám sát: có nhãn lịch sử $y$ (thời gian đã đo) cho mỗi phiếu đã xong.

Học $f_\theta$ nghĩa là chọn tham số $\theta$ để cực tiểu hóa rủi ro kỳ vọng trên dữ liệu **chưa thấy**, không phải trên dữ liệu đã học:

$$\theta^{*}=\arg\min_{\theta}\ \mathbb E_{(\mathbf x,y)}\big[\,L\big(y,f_\theta(\mathbf x)\big)\big]$$

Vì không biết phân phối thật, ta xấp xỉ bằng trung bình trên mẫu huấn luyện (có điều chuẩn) và **ước lượng sai số tổng quát hóa bằng dữ liệu giữ lại** (cross-validation và tập test). Toàn bộ quy trình ở mục 3 và 4 là cách làm điều này một cách không thiên lệch.

### 1.3 Nhãn: "thời gian thi công thuần"
$$y_i=\underbrace{(t^{\text{hoàn thành}}_i-t^{\text{bắt đầu}}_i)}_{\text{thời gian thực tế}}-\sum_{k}\underbrace{(\text{thời gian chờ linh kiện / chờ khách duyệt})_{i,k}}_{\text{lấy từ lịch sử trạng thái}}$$

Lý do trừ thời gian chờ: chờ linh kiện hay chờ khách duyệt không phản ánh tay nghề hay độ khó của ca; để lẫn vào nhãn sẽ tạo ra nhiễu không thể học (nhãn dài do chờ chứ không do sửa lâu). Hệ thống tính ETA riêng cho thời gian chờ nếu cần.

### 1.4 Thời điểm dự báo $t_0$ và vì sao phải nói rõ
Dự đoán diễn ra **trước khi sửa**, lúc phiếu đã có hạng mục và đã biết (hoặc đang thử) KTV. Mọi đặc trưng chỉ được dùng nếu **biết được tại $t_0$**. Đặc trưng chỉ có sau khi sửa (thời gian chờ thực tế, số linh kiện đã xuất kho...) làm mô hình "biết đáp án" lúc học nhưng không có lúc chạy thật. Hiện tượng đó gọi là **rò rỉ dữ liệu từ tương lai** (data leakage; Kaufman và cs., 2012) và là sai phạm nghiêm trọng nhất trong đánh giá học máy vì làm điểm cao giả tạo.

### 1.5 Chỉ số mục tiêu (KPI)
**MAE** (sai số tuyệt đối trung bình, phút) là KPI chính: cùng đơn vị với nghiệp vụ ("trung bình lệch bao nhiêu phút"), ít bị vài ca ngoại lai kéo lệch, và đúng với mục đích ETA. RMSE, R², P90, tỉ lệ ca lệch không quá 5 phút và bias là chỉ số phụ (công thức ở mục 6.1).

### 1.6 Vì sao cần học máy thay vì quy tắc đơn giản
Hệ thống đã có **định mức catalog** (thời gian chuẩn của từng dịch vụ). Định mức bỏ qua: (i) KTV nhanh/chậm khác nhau, (ii) ghép nhiều dịch vụ trong một phiếu thường nhanh hơn tổng định mức (tháo máy một lần), (iii) đời máy khác nhau. Học máy chỉ đáng giá nếu **thắng được định mức và các quy tắc đơn giản**. Vì vậy quy trình đặt 5 mốc so sánh (baseline) và chỉ kết luận ML có giá trị khi thắng mốc mạnh nhất một cách có ý nghĩa thống kê.

---

## 2. Dữ liệu

### 2.1 Dữ liệu là mô phỏng: phải nói thẳng
Hệ thống chưa vận hành lâu nên chưa có đủ phiếu thật. Dữ liệu huấn luyện được **sinh bằng script** `scripts/seed_database_ml.py` vào MySQL theo quy luật nghiệp vụ, rồi xuất ra CSV. Cách làm này gọi là khởi động lạnh (cold start). Hệ quả cần nói rõ trong báo cáo:
* Kết quả đo **mức độ học lại đúng quy luật mô phỏng**, chưa phải hiệu năng ngoài thực địa.
* Quy trình (làm sạch, chia dữ liệu, chọn mô hình, đánh giá, tích hợp) là thật và áp dụng nguyên cho dữ liệu thật; chỉ cần đổi cờ `SYNTHETIC_DATA=False`, đặt `TICKET_CODE_PREFIX=None` và chạy lại.
* API trả cờ `syntheticData=true` và `productionValidated=false` để hệ thống phía ngoài không hiểu nhầm.

**Không nói:** "mô hình đạt độ chính xác X% trong thực tế". **Nên viết:** "trên dữ liệu mô phỏng có kiểm soát, mô hình đạt MAE ...".

### 2.2 Quy luật sinh dữ liệu (tham số công khai ở đầu `seed_database_ml.py`)
Với mỗi phiếu:

$$y=\max\!\Big(10,\ \text{round}\big[\,(\textstyle\sum_{s}d_s-12\cdot n_{\text{extra}})\times v_{\text{KTV}}\times \varepsilon\,\big]\Big),\qquad \ln\varepsilon\sim\mathcal N(0,\sigma^2),\ \sigma=0{,}15$$

* $d_s$: định mức catalog của dịch vụ $s$; $n_{\text{extra}}$: số dịch vụ ghép thêm; **giảm 12 phút cho mỗi dịch vụ ghép thêm** (`BUNDLE_DISCOUNT`).
* $v_{\text{KTV}}\in\{0{,}90;\ 1{,}00;\ 1{,}15\}$: hệ số tốc độ của ba KTV (nhỏ hơn là nhanh hơn).
* $\varepsilon$: nhiễu **nhân** lognormal, nên ca càng dài thì sai lệch tuyệt đối càng lớn.
* Khoảng 35% phiếu có nhiều dịch vụ (`P_MULTI`; thêm 1 hoặc 2 dịch vụ ghép, nên một phiếu có 1 đến 3 dịch vụ); tổng định mức đã giảm có sàn 25 phút. Kịch bản chuyển giao cộng thêm 10 đến 20 phút (và bị loại ở bước làm sạch). KTV nào cũng nhận cả ca khó lẫn ca thường (xác suất khác nhau), tránh lẫn độ khó với tay nghề.
* Năm kịch bản vận hành (trọng số `SCENARIO_WEIGHTS`): bình thường; chờ khách duyệt; linh kiện lỗi chờ đổi; hủy; chuyển giao KTV. Hai kịch bản chờ có **ghi lịch sử chờ** nên nhãn thuần được trừ đúng. Ca hủy không có giờ hoàn thành nên không vào dữ liệu; ca chuyển giao bị loại ở bước làm sạch.
* `SEED=42` cố định hạt ngẫu nhiên nên sinh lại ra đúng bộ dữ liệu cũ.

**Vì sao nhiễu nhân và sinh bằng quy luật như vậy:** thời gian sửa chữa là đại lượng dương, lệch phải, và sai lệch tỉ lệ với độ dài ca; đây là mô hình nhiễu tự nhiên cho thời gian. Việc biết **quy luật gốc** là lợi thế duy nhất của dữ liệu mô phỏng: ta kiểm chứng được phương pháp có thu hồi đúng hệ số KTV đã cài hay không (Phụ lục 13.1 cho thấy có).

**Điều phải thừa nhận:** hiệu ứng KTV là một hệ số duy nhất, không phụ thuộc loại lỗi hay đời máy; chỉ có 3 KTV; không có hàng chờ, ca làm hay hiệu ứng học dần. Dữ liệu mô phỏng này **đơn giản hơn thực tế**, và cấu trúc nhân do chính ta cài vào nên một mô hình nhân đơn giản có lợi thế tự nhiên (mục 7.3).

### 2.3 Lược đồ dữ liệu xuất ra (22 cột)
Script `01_extract_raw_data.py` chạy một truy vấn SQL, mỗi phiếu đã hoàn tất một dòng:

| Nhóm | Cột | Dùng làm đặc trưng? |
|---|---|---|
| Định danh | `ticket_id`, `ticket_code` | Không. `ticket_id` chỉ làm "nhóm" khi chia dữ liệu; `ticket_code` để kiểm tra nguồn |
| Biết tại $t_0$ | `device_model_id`, `technician_id`, `service_issue_ids_list`, `total_services_count`, `total_catalog_standard_duration_minutes` | **Có (5 đặc trưng gốc)** |
| Hằng số | `branch_id` | Không (một chi nhánh, không mang thông tin) |
| Chỉ biết sau khi sửa | `actual_repair_*`, `total_pause_*`, `count_waiting_*`, `is_reassigned`, `total_parts_quantity_used` | **Không** (rò rỉ tương lai hoặc lệch train/serve) |
| Nhãn | `net_repair_duration_minutes` | Là $y$ |

### 2.4 Phải là một nguồn dữ liệu duy nhất
Dữ liệu huấn luyện phải do **một quy luật sinh** tạo ra và quy luật đó phải được mô tả trong báo cáo. Nếu trộn các đợt sinh khác nhau (hệ số KTV khác, nhiễu khác) thì: (i) mô hình học một quy luật "trung bình" không đúng quy luật nào; (ii) trần nhiễu và mọi kiểm định bị méo; (iii) báo cáo mô tả nguồn dữ liệu sai sự thật. Script `01_extract_raw_data.py` chỉ xuất phiếu có mã bắt đầu bằng `TICKET_CODE_PREFIX` (không xóa gì trong DB). Notebook Bước 2 in số phiếu theo từng **dạng mã phiếu**; Bước 3 chỉ giữ phiếu có mã bắt đầu bằng `TICKET_CODE_PREFIX` (`ST-SEED-`) và in số phiếu bị loại.

---

## 3. Bức tranh toàn bộ quy trình và các nguyên tắc chống sai phạm

### 3.1 Sơ đồ tổng thể

```text
 [Sinh dữ liệu mô phỏng]  seed_database_ml.py  -->  MySQL
            |
 [Xuất CSV]  01_extract_raw_data.py  -->  data/raw/raw_tickets_active.csv
            |
 ===================  notebook model_selection.ipynb  ===================
 B1  Môi trường, seed, thư viện
 B2  Nạp dữ liệu, kiểm tra kiểu/thiếu/dạng mã phiếu
 B3  Làm sạch (6 luật) + assert hậu điều kiện
 B4  Xác định t0, bảng chính sách cột, assert không có cột rò rỉ
 B5  TÁCH train/test theo phiếu  (test bị "khóa" đến B14)
        |------------------------------- chỉ train từ đây -------------------------------|
 B6  EDA + kiểm định tín hiệu KTV (ANOVA, Kruskal, ANCOVA)  -> Hình 1
 B7  Đặc trưng (RepairFeatureBuilder)
 B8  Chỉ số đánh giá + kiểm thử công thức bằng tính tay
 B9  Giao thức cross-validation theo phiếu (5 fold)
 B10 Baseline (5 mốc) + trần nhiễu
 B11 7 mô hình ứng viên, NESTED CV (5 ngoài x 3 trong) + tinh chỉnh triển khai
 B12 Bảng xếp hạng CV, nhóm hòa thống kê, chọn mô hình       -> Hình 2
 B13 Ablation: sinh thêm dữ liệu có giúp không?
        |------------------------------ mở khóa test, dùng đúng 1 lần ------------------|
 B14 Đánh giá trên test, CI bootstrap, Wilcoxon + Bonferroni  -> Hình 3, 4
 B15 Đường cong học                                           -> Hình 5
 B16 Giải thích: permutation importance, what-if KTV          -> Hình 6
 B17 Khoảng dự báo 90% (conformal)                            -> Hình 7
 B18 Refit trên toàn bộ dữ liệu sạch, đóng gói bundle, kiểm tra nạp lại
 B19 Tổng kết tự động + cảnh báo trung thực
 ========================================================================
            |
 [models/v2/repair_duration_bundle.joblib]  -->  app.py (FastAPI) / 06_db_service.py
            |                                        |
 [reports/*.png, *.csv, metrics.json]          [Spring Boot gọi API]  -->  ETA, gợi ý KTV
            |
 [07_monitor_feedback.py]  so dự đoán với thực tế, báo RETRAIN_RECOMMENDED khi cần
```

### 3.2 Bảy nguyên tắc và sai phạm mà mỗi nguyên tắc ngăn chặn

| # | Nguyên tắc | Sai phạm nếu vi phạm | Làm thế nào trong dự án | Bước |
|---|---|---|---|---|
| 1 | Chỉ dùng thông tin biết tại $t_0$ | Rò rỉ tương lai, điểm cao giả tạo | Bảng chính sách cột; `assert` không có cột cấm trong đặc trưng | 4 |
| 2 | Test độc lập, dùng một lần, tách **trước** mọi phân tích | Rò rỉ qua EDA, chọn đặc trưng, chọn mô hình; test thành tập validation thứ hai | Tách theo phiếu ở B5; EDA chỉ trên train; chạm test ở B14 | 5, 6, 14 |
| 3 | Bước học (mã hóa, chuẩn hóa) chỉ nhìn dữ liệu học | Rò rỉ qua bộ mã hóa/chuẩn hóa fit trên cả fold kiểm định | `Pipeline(builder, mô hình)`: bộ mã hóa fit lại trong từng fold | 7, 11 |
| 4 | Tinh chỉnh siêu tham số nằm **trong** vòng đánh giá | Điểm CV lạc quan (thiên lệch chọn lọc) | **Nested cross-validation** | 11 |
| 5 | Mốc so sánh công bằng và chọn mốc bằng CV | "Giảm 70%" nhưng so với mốc yếu; chọn mốc theo test là nhìn trộm | 5 baseline; baseline mạnh nhất chọn bằng CV | 10, 12 |
| 6 | Không phóng đại khác biệt nhỏ | Nói "vượt trội" khi chênh lệch nằm trong nhiễu lấy mẫu | SE, nhóm hòa 1-SE, Wilcoxon + Bonferroni, bootstrap CI | 12, 14 |
| 7 | Báo cáo độ không chắc chắn | Một con số "47 phút" không nói được độ tin cậy | Khoảng dự báo conformal có bảo đảm độ phủ | 17 |

Ghi nhớ một câu: **"mọi thứ được học, chọn, hay tinh chỉnh chỉ được nhìn dữ liệu học; tập test chỉ được dùng một lần để đo."**

---

## 4. Quy trình chi tiết từng bước (khớp 19 bước của notebook)

Mỗi bước có bốn phần: **Làm gì**, **Vì sao**, **Cách đọc kết quả**, **Nên viết vào báo cáo**.

### Bước 1. Môi trường
**Làm gì.** Nạp thư viện, cố định `RANDOM_STATE=42`, đọc cấu hình từ `config/config.py`, in phiên bản thư viện. **Vì sao.** Kết quả phải tái lập được: cùng dữ liệu, cùng seed, cùng phiên bản cho cùng kết quả. Dùng chung `config/` và `src/` với script và API để đặc trưng lúc huấn luyện và lúc dự đoán chỉ định nghĩa một nơi (tránh train/serve skew: đặc trưng khi chạy thật được tính khác khi huấn luyện). **Đọc.** Nếu in dòng `QUICK_MODE=True` thì lưới rút gọn, kết quả không dùng cho báo cáo. **Báo cáo.** Ghi phiên bản Python, scikit-learn, XGBoost, LightGBM, CatBoost và seed.

### Bước 2. Nạp dữ liệu thô
**Làm gì.** Đọc CSV, kiểm tra đủ cột, in kiểu dữ liệu, số giá trị thiếu, số giá trị khác nhau, và **đếm phiếu theo dạng mã phiếu**. **Vì sao.** Phát hiện sớm dữ liệu hỏng và dữ liệu trộn nguồn. **Đọc.** Nếu có nhiều hơn một dạng mã phiếu, notebook cảnh báo; đó là dấu hiệu dữ liệu đến từ nhiều đợt sinh (mục 2.4). **Báo cáo.** Số phiếu thô, số cột, nguồn sinh.

### Bước 3. Làm sạch
**Làm gì.** Hàm `clean_training_data` áp sáu luật tuần tự, mỗi luật đếm số dòng bị loại:

| Luật | Lý do |
|---|---|
| 0. Giữ phiếu có mã bắt đầu bằng `TICKET_CODE_PREFIX` | Một nguồn, một quy luật sinh |
| 1. Loại phiếu chuyển giao KTV (`is_reassigned≠0`) | Thời gian là của nhiều người, nhãn không thuộc một KTV |
| 2. Loại nhãn $y\le0$ hoặc không có dịch vụ | Nhãn vô nghĩa |
| 3. Loại phiếu thiếu KTV | Không thể dự đoán "theo KTV" |
| 4. Loại nhãn $>480$ phút | Nhập liệu lỗi (quên đóng phiếu). **Không** cắt ngoại lai thông thường |
| 5. Mỗi phiếu đúng một dòng | Một phiếu ở cả train và test là rò rỉ |

Sau đó chạy `assert` làm hậu điều kiện: nếu còn phiếu khác nguồn, phiếu trùng, nhãn $\le0$ hoặc thiếu KTV thì dừng.
**Vì sao không cắt ngoại lai.** Ca dài thật (ghép nhiều dịch vụ) là thông tin hợp lệ; cắt chúng làm mô hình chưa từng thấy ca dài và đánh giá sai. Chỉ loại giá trị phi thực tế (trên 8 giờ). **Báo cáo.** Bảng "dữ liệu thô → sạch" với số dòng bị loại theo từng luật.

### Bước 4. Thời điểm dự báo và chống rò rỉ
**Làm gì.** Lập bảng quyết định cho từng cột (dùng hay bỏ và vì sao) và `assert` rằng danh sách đặc trưng không giao với tập cột cấm. **Vì sao.** Mục 1.4. Đây là chốt chặn bằng mã chống rò rỉ tương lai: ai lỡ thêm `total_pause_duration_minutes` vào đặc trưng thì notebook dừng ngay. **Báo cáo.** Chép bảng chính sách cột vào chương phương pháp.

### Bước 5. Tách train/test theo phiếu
**Làm gì.** `GroupShuffleSplit` tách 80/20 **theo `ticket_id`**, sau đó xáo thứ tự train một lần (seed cố định). Kiểm tra bằng `assert` rằng không phiếu nào ở cả hai tập, và so hai tập bằng KS-test (nhãn) và chi-bình-phương (tỉ lệ KTV).

$$D=D_{\text{train}}\cup D_{\text{test}},\qquad \text{tickets}(D_{\text{train}})\cap\text{tickets}(D_{\text{test}})=\emptyset$$

**Vì sao.** Tập test đóng vai "phiếu tương lai"; nó chỉ có giá trị nếu mô hình chưa từng thấy nó dưới bất kỳ hình thức nào. Tách theo phiếu (nhóm) thay vì theo dòng để không có phiếu bị chia đôi (nếu một phiếu có nhiều dòng, các dòng giống nhau ở cả hai phía làm test dễ giả tạo). Chế độ `SPLIT_MODE="time"` (20% phiếu mới nhất làm test) là chuẩn vàng khi có dữ liệu thật theo thời gian; với dữ liệu mô phỏng mốc thời gian là ngẫu nhiên nên chế độ `group` là phù hợp. **Đọc.** KS và chi-bình-phương có $p>0{,}05$ nghĩa là không có bằng chứng hai tập khác nhau. **Báo cáo.** Tỉ lệ chia, số phiếu mỗi tập, nêu rõ tách theo phiếu và test chỉ dùng một lần.

### Bước 6. EDA và kiểm định tín hiệu KTV (chỉ trên train)
Mỗi phân tích trả lời một câu hỏi ảnh hưởng đến thiết kế phía sau.

1. **Nhãn phân bố thế nào?** Độ lệch $g_1>0$ nghĩa là đuôi phải dài → dùng MAE làm KPI chính, thử hàm mất mát tuyệt đối, khoảng dự báo nên tỉ lệ.
2. **Định mức catalog dự đoán tốt tới đâu?** Hệ số Pearson $r$ giữa định mức và nhãn. $r$ cao nghĩa là định mức đã giải thích phần lớn; ML chỉ cần phần còn lại.
3. **KTV có thật sự khác nhau về tốc độ không?** Định nghĩa **tỉ lệ hiệu suất** $\rho_i=y_i/\text{catalog}_i$ ($\rho=1$ là đúng định mức). Hai lớp kiểm định:

   * **ANOVA một yếu tố / Kruskal–Wallis** trên $\rho$ của ca một dịch vụ (kiểm định thô; Kruskal không giả định phân phối chuẩn).
   $$F=\frac{SS_B/(k-1)}{SS_W/(N-k)},\qquad \eta^2=\frac{SS_B}{SS_{\text{tot}}}$$
   * **ANCOVA bằng F-test từng phần** trên $\log y$ **sau khi hiệu chỉnh độ khó ca**: mô hình giảm $\log y\sim 1+\log(\text{catalog})+\text{số dịch vụ}+\text{mã lỗi}+\text{đời máy}$; mô hình đầy đủ thêm biến KTV.
   $$F_{\text{partial}}=\frac{(RSS_0-RSS_1)/\Delta df}{RSS_1/df_1},\qquad \eta^2_{\text{partial}}=\frac{RSS_0-RSS_1}{RSS_0}$$

**Vì sao cần ANCOVA.** KTV **không được giao ca ngẫu nhiên** (KTV nhanh có thể nhận nhiều ca khó hoặc ngược lại). ANOVA thô lẫn "ca dễ" với "KTV giỏi". ANCOVA so sánh KTV **trong cùng độ khó ca**, nên mới là bằng chứng cho "tốc độ KTV" thật sự. Hệ số tốc độ nhân của từng KTV được suy ra từ hệ số của biến KTV, chuẩn hóa để **trung bình nhân của các KTV bằng 1**.
**Đọc Hình 1.** (a) phân phối nhãn lệch phải; (b) định mức so với thực tế, các điểm quanh đường $y=x$; (c) hộp $\rho$ theo KTV, mỗi KTV một mức; (d) nhiệt đồ $\rho$ theo mã lỗi và KTV: nếu mỗi cột cùng một màu thì hiệu ứng KTV mang tính **nhân** (đều trên mọi mã lỗi). Cấu trúc nhân này giải thích hai thiết kế sau: mô hình Ridge log-nhân (Bước 11) và khoảng dự báo tỉ lệ (Bước 17).
**Nếu ANCOVA không có ý nghĩa** thì "dự đoán theo KTV" không có cơ sở và phải xem lại dữ liệu. **Báo cáo.** $g_1$, $r$, kết quả ANOVA/Kruskal/ANCOVA, bảng hệ số tốc độ đã hiệu chỉnh. **Không nói** "KTV A nhanh hơn B X%" dựa riêng trên $\rho$ thô; dùng hệ số đã hiệu chỉnh.

### Bước 7. Xây dựng đặc trưng
**Làm gì.** `RepairFeatureBuilder` biến bảng thô (5 cột gốc) thành ma trận số. Chế độ `ohe` cho 35 cột (tùy dữ liệu), chế độ `native` (CatBoost) giữ ID dạng chuỗi.

| Nhóm | Công thức | Lý do |
|---|---|---|
| Số dịch vụ, định mức tổng | giữ nguyên | Đặc trưng mạnh nhất |
| Định mức trung bình mỗi dịch vụ | $\text{catalog}/\text{số dịch vụ}$ | Cây khó tự tạo phép chia |
| Log định mức | $\log(1+\text{catalog})$ | Mô hình nhân cần thang log |
| Tập mã lỗi (multi-hot) | $v_{i,k}=\mathbb 1[k\in\mathcal S_i]$ | Một phiếu có thể nhiều lỗi |
| Đời máy, KTV (one-hot) | $u_{i,c}=\mathbb 1[\text{id}_i=c]$ | ID là nhãn danh định (KTV 5345 không "lớn hơn" 5343) |

**Hai điểm kỹ thuật quan trọng.** (1) Giá trị **chưa từng thấy** (KTV mới, đời máy mới) cho toàn số 0 ở chế độ one-hot thay vì báo lỗi, và hàm `unknown_values` cảnh báo; notebook kiểm thử điều này bằng một phiếu giả. (2) Builder là một **transformer của scikit-learn** nằm trong `Pipeline`, nên khi cross-validation nó được **fit lại chỉ trên phần học của từng fold**. Ô trong Bước 7 chỉ minh họa trên toàn train. **Báo cáo.** Bảng nhóm đặc trưng, nêu rõ one-hot cho ID và multi-hot cho tập lỗi.

### Bước 8. Chỉ số đánh giá và kiểm thử công thức
Công thức ở mục 6.1. Điểm đáng nói: ô này **tính tay** một ví dụ nhỏ (4 điểm) và `assert` hàm `regression_report` cho đúng kết quả tay, làm bằng chứng mọi con số về sau được tính đúng. **Báo cáo.** Nêu MAE là KPI chính và vì sao (mục 1.5).

### Bước 9. Giao thức cross-validation theo nhóm phiếu
**Làm gì.** Chia train thành 5 fold theo phiếu bằng `make_group_folds`: xáo các phiếu duy nhất bằng seed cố định rồi gán fold theo vị trí mod 5. Kiểm tra bằng `assert` mỗi mẫu được kiểm định đúng một lần và không phiếu nào ở hai phía của một fold. **Vì sao.** Ước lượng hiệu năng để **chọn mô hình mà không chạm test**. Mọi mô hình và baseline dùng **đúng cùng các fold** ("cùng một đề thi") nên so sánh công bằng. **Báo cáo.** 5-fold theo phiếu, cùng fold cho mọi mô hình.

### Bước 10. Baseline và trần nhiễu
**Baseline.** Mỗi baseline được **học lại trong từng fold**:

| Mốc | Dự đoán | Vai trò |
|---|---|---|
| B0 Trung bình | $\hat y=\bar y_{\text{train}}$ | Không dùng thông tin: sàn tuyệt đối |
| B1 Định mức catalog | $\hat y=\text{catalog}$ | Cách hệ thống đang làm |
| B2 Tuyến tính theo catalog | $\hat y=a\cdot\text{catalog}+b$ | Hiệu chỉnh tuyến tính định mức |
| B3 Định mức × hệ số KTV | $\hat y=\text{catalog}\times\bar\rho_{\text{KTV}}$ | Mô hình nhân đơn giản nhất, hệ số học từ dữ liệu |
| B4 Bảng tra | trung bình $y$ của cùng (đời máy, tổ hợp lỗi, KTV), lùi dần khi thiếu | "Học thuộc" tổ hợp đã gặp |

**Baseline mạnh nhất được chọn bằng CV** (không bằng test, vì chọn theo test là nhìn trộm). Đó là mốc dùng để tính "ML giảm sai số bao nhiêu %".

**Trần nhiễu (pure error).** Các phiếu có **đặc trưng giống hệt nhau** (cùng đời máy, tổ hợp lỗi, KTV, số dịch vụ, định mức) chỉ khác nhau ở nhiễu. Với nhóm $g$ có $n_g\ge2$ phiếu, phương sai nội nhóm không chệch là $s_g^2$ (chia cho $n_g-1$). Phương sai nhiễu gộp:

$$\sigma^2=\frac{\sum_g (n_g-1)\,s_g^2}{\sum_g (n_g-1)}\quad\Rightarrow\quad \text{RMSE bất khả giảm}\approx\sigma$$

MAE bất khả giảm xấp xỉ độ lệch tuyệt đối trung bình quanh trung bình nhóm nhân $\sqrt{n_g/(n_g-1)}$ (bù việc trung bình nhóm ước lượng từ chính các điểm). Ý nghĩa: không mô hình nào, dù phức tạp đến đâu, có thể sai ít hơn nhiễu bản chất. Mô hình sai thấp hơn rõ rệt trần này là dấu hiệu **đáng ngờ** (rò rỉ, nhớ vẹt, dữ liệu trùng); mô hình sát trần là đã khai thác hết thông tin có trong đặc trưng.

**Một cạm bẫy phải tránh.** Trần chỉ đo được trên **các phiếu có song sinh**, thường là ca ngắn và dễ hơn. So MAE của mô hình trên **toàn bộ** phiếu với trần đó là so hai tập khác nhau (so táo với cam). So sánh đúng: sai số out-of-fold của mô hình **trên chính tập phiếu có song sinh** so với trần. Notebook v3.1 in đúng so sánh này ở Bước 12 (tỉ lệ $\approx1$ là đã chạm trần). **Không nói** "mô hình đạt trần nhiễu" khi chỉ so sai số toàn tập với trần.

### Bước 11. Các mô hình ứng viên và nested cross-validation
Mục 5 giải thích từng mô hình. Ở đây là **cơ chế đánh giá**.

**Vì sao nested CV.** Nếu chọn siêu tham số tốt nhất trên các fold rồi báo luôn điểm CV của các fold đó thì điểm **lạc quan** (thiên lệch chọn lọc): cấu hình được chọn *vì* nó tốt trên chính các fold này (Varma và Simon, 2006; Cawley và Talbot, 2010). Nested CV tách hai việc:

```text
Vòng NGOÀI (5 fold, để ĐÁNH GIÁ)
  với mỗi fold ngoài k:
      train_k = 4 fold còn lại ;  val_k = fold k   (val_k không bao giờ tham gia chọn tham số)
      Vòng TRONG (3 fold, chỉ trên train_k, để CHỌN siêu tham số):
          theta* = argmin_theta  MAE trung bình 3 fold trong
      refit trên cả train_k với theta*  ->  dự đoán val_k
  gộp dự đoán val_k của 5 fold  =  dự đoán OUT-OF-FOLD cho mọi mẫu train
  CV-MAE = trung bình MAE 5 fold ngoài ;  SE = s / sqrt(5)
```

Dự đoán out-of-fold vừa cho **CV-MAE không thiên lệch**, vừa là **phần dư sạch** để hiệu chuẩn khoảng dự báo (Bước 17). Thêm vào đó, mỗi mô hình được tinh chỉnh **một lần nữa trên toàn bộ train** (5 fold) để có **cấu hình triển khai**; cấu hình này dùng cho test (Bước 14) và cho bundle.

**Mọi mô hình là `Pipeline(builder → mô hình)`** nhận bảng thô, nên bộ mã hóa fit lại trong từng lần fit. Số lần huấn luyện mỗi mô hình $=G\times(5\times3+5)$, với $G$ là số cấu hình trong lưới; notebook in bảng này. Thời gian chạy vài phút đến vài chục phút (CatBoost chậm nhất).

**Báo cáo.** Mô tả đúng sơ đồ trên (5 ngoài × 3 trong), nói rõ vì sao dùng nested (tránh lạc quan), và nêu các lưới tham số (mục 5).

### Bước 12. Bảng xếp hạng CV và chọn mô hình
**Quy tắc chọn đặt trước khi nhìn test:** mô hình ML có **CV-MAE nhỏ nhất** (nested). Đồng thời xác định **nhóm hòa thống kê**: các mô hình có CV-MAE trong khoảng $[\text{CV-MAE}^*,\ \text{CV-MAE}^*+\text{SE}^*]$ (quy tắc một độ lệch chuẩn, Hastie và cs., 2009, mục 7.10). Mô hình trong nhóm hòa **không tách bạch được bằng CV**; chọn theo con số chỉ là chọn theo quy tắc, không phải "vượt trội". Notebook cũng in so với baseline mạnh nhất ("giảm bao nhiêu % CV-MAE") và **cảnh báo** nếu mô hình tốt nhất không hơn baseline quá 1 SE. **Đọc Hình 2.** Thanh đỏ là mô hình được chọn, xám là baseline; khoảng cách tới baseline xám gần nhất là **giá trị ML tạo ra**. **Báo cáo.** Bảng xếp hạng, mô hình được chọn "theo CV-MAE nhỏ nhất (nested CV)", và liệt kê nhóm hòa nếu có.

### Bước 13. Ablation: sinh thêm dữ liệu có thật sự giúp?
**Giả thuyết kiểm chứng.** Hàm `augment_repair_dataset` nhân bản các dòng train rồi cộng nhiễu Gauss vào nhãn ($y'=\max(15,y+\varepsilon)$, $\varepsilon\sim\mathcal N(0,3{,}5^2)$). Bản sao giữ nguyên $\mathbf x$ nên **không tạo thông tin mới** về quan hệ $\mathbf x\to y$; nó chỉ làm mô hình tin hơn vào các điểm đã có. Thay vì giả định, ta **kiểm chứng**.
**Thiết kế.** Lặp 8 lần chia **bên trong tập train** (không đụng test), huấn luyện mô hình đã chọn **có và không có** augmentation (augmentation chỉ áp cho phần học con; phần kiểm định luôn là phiếu thật), so MAE ghép cặp bằng Wilcoxon. **Quy tắc:** chỉ coi augmentation có lợi khi MAE giảm hơn một độ lệch chuẩn **và** $p<0{,}05$. Nếu không đạt (kết quả mong đợi) thì huấn luyện chỉ trên phiếu thật. **Báo cáo.** "Thử nghiệm sinh thêm dữ liệu không cải thiện (p = ...), nên không sử dụng."

### Bước 14. Đánh giá cuối cùng trên test (chạm một lần)
**Làm gì.** Lấy cấu hình triển khai của **mọi** mô hình, dự đoán test (đi qua cùng sàn `MIN_PREDICTED_MINUTES=10` như khi chạy thật), tính các chỉ số và CI bootstrap 95% cho MAE. Sau đó:
* So mô hình được chọn với từng đối thủ bằng **Wilcoxon ghép cặp** trên $|e|$ cùng các phiếu test, với ngưỡng **Bonferroni** $\alpha'=0{,}05/m$ ($m$ = số đối thủ).
* Tính chênh lệch MAE ghép cặp so với baseline mạnh nhất, kèm CI bootstrap.
* Hình 4: chẩn đoán sai số.

**Vì sao không quay lại đổi mô hình theo điểm test.** Nếu chọn mô hình theo test thì test trở thành tập validation thứ hai và con số test bị lạc quan. Mô hình đã chốt ở Bước 12.
**Đọc Hình 4.** (a) dự đoán so với thực tế, càng sát đường chéo càng tốt; (b) phần dư so với dự đoán, hình **phễu** (loe ra) nghĩa là sai số tăng theo độ dài ca (nhiễu nhân), hình **cong** nghĩa là mô hình bỏ sót cấu trúc; (c) phân phối phần dư nên đối xứng quanh 0; (d) MAE theo KTV: một KTV sai nhiều hơn hẳn nghĩa là mô hình không công bằng với người đó.
**Hai lưu ý phải tự kiểm.** (1) Nếu MAE test lệch CV-MAE hơn 2 SE, notebook in lưu ý: **báo cả hai con số**. Với test vài trăm phiếu, một lần chia ngẫu nhiên có thể may hoặc rủi; CI bootstrap cho biết mức dao động. (2) So sánh "tốt hơn có ý nghĩa" chỉ khi $p<\alpha'$ **và** chênh lệch trung bình dương; còn lại là "hòa thống kê". **Báo cáo.** Bảng test với CI, kết luận ghép cặp, và chênh lệch so với baseline mạnh nhất kèm CI.

### Bước 15. Đường cong học
**Làm gì.** Huấn luyện mô hình đã chọn với 20% đến 100% dữ liệu học của mỗi fold, đo MAE trên phần học và trên fold kiểm định. **Vì sao.** Trả lời "**có nên thu thêm dữ liệu không?**" bằng số liệu, dựa trên phân rã sai số

$$\text{Sai số kiểm định}\approx\underbrace{\text{độ chệch}^2}_{\text{mô hình quá đơn giản}}+\underbrace{\text{phương sai}}_{\text{quá ít dữ liệu}}+\underbrace{\sigma^2}_{\text{nhiễu không giảm được}}$$

Hai đường hội tụ và đường kiểm định đã phẳng: mô hình đã khai thác hết thông tin trong đặc trưng; muốn tốt hơn phải thêm đặc trưng hoặc giảm nhiễu nhãn. Khoảng cách còn lớn và đường kiểm định còn đi xuống: thêm dữ liệu thật sẽ giúp. **Báo cáo.** Kết luận về việc thu thập thêm dữ liệu thật.

### Bước 16. Giải thích mô hình
**Permutation importance** trên test: xáo ngẫu nhiên giá trị của **một đặc trưng gốc** (cột thô, nên không bị one-hot chia nhỏ) và đo MAE tăng bao nhiêu, lặp 20 lần (Breiman, 2001; Fisher và cs., 2019):

$$\text{PI}_g=\mathbb E_\pi\big[\text{MAE}(\mathbf X^{\pi(g)})\big]-\text{MAE}(\mathbf X)$$

Đặc trưng tương quan với nhau (định mức và số dịch vụ) chia sẻ mức quan trọng, nên đọc như thứ tự chứ không như con số tuyệt đối.
**What-if theo KTV.** Giữ nguyên các phiếu test, chỉ đổi KTV, lấy trung bình dự đoán; chỉ số tốc độ $=$ trung bình dự đoán của KTV / trung bình các KTV. Đối chiếu với hai ước lượng độc lập: $\bar\rho$ thô (Bước 6) và **hệ số đã hiệu chỉnh độ khó ca** (ANCOVA). Nếu mô hình học đúng thì ba cột gần nhau; hệ số hiệu chỉnh là chuẩn đối chiếu đáng tin hơn $\bar\rho$ thô. Chênh lệch dự đoán giữa KTV nhanh nhất và chậm nhất trên cùng một phiếu là **cơ sở để hệ thống gợi ý KTV**. **Báo cáo.** Hình 6 và câu "mô hình dựa chủ yếu vào ... và tách được hiệu ứng KTV phù hợp ước lượng độc lập".

### Bước 17. Khoảng dự báo 90% (split conformal)
**Vì sao cần.** Một con số "47 phút" không nói lên độ chắc chắn. **Làm gì.** Dùng **split conformal** trên phần dư out-of-fold của nested CV (mỗi mẫu được dự đoán bởi mô hình chưa thấy nó và chưa tham gia chọn tham số của nó), có hiệu chỉnh cỡ mẫu hữu hạn (Vovk và cs., 2005; Lei và cs., 2018):

$$\hat q=\text{Quantile}_{\lceil(n+1)(1-\alpha)\rceil/n}\big(\{s_i\}\big),\qquad \alpha=0{,}10$$

Hai kiểu độ đo bất tương thích $s_i$:
* **absolute:** $s_i=|y_i-\hat y_i|$, khoảng $\hat y\pm\hat q$ (độ rộng cố định).
* **relative:** $s_i=|y_i-\hat y_i|/\hat y_i$, khoảng $\hat y(1\pm\hat q)$ (độ rộng tỉ lệ với dự đoán).

**Chọn kiểu chỉ bằng dữ liệu hiệu chuẩn (không nhìn test):** nếu $|r_i|$ tăng theo $\hat y_i$ (Spearman $\rho>0{,}15$ và $p<0{,}01$) thì nhiễu là nhân và khoảng tỉ lệ công bằng hơn (ca ngắn không bị khoảng quá rộng, ca dài không bị quá hẹp).
**Ý nghĩa đúng của "độ tin cậy".** Với dữ liệu hoán đổi được, xác suất khoảng chứa giá trị thật không nhỏ hơn 90% **tính trung bình trên các phiếu**, không phải xác suất đúng cho từng phiếu. Độ phủ thực trên test có sai số lấy mẫu vài điểm phần trăm nên "90,4%" đọc là "khoảng 90%". Bảo đảm cần giả định dữ liệu mới giống dữ liệu cũ; nếu phân phối trôi thì độ phủ giảm, vì vậy cần giám sát (mục 8.4). Cột `confidence` trong CSDL được ghi bằng **mức phủ danh nghĩa 0,90**, không phải $R^2$ hay độ chính xác.
**Đọc Hình 7.** (a) dải dự báo trên test với điểm ngoài khoảng tô đỏ; (b) độ phủ theo độ dài ca của hai kiểu. Mỗi kiểu có thể phủ thiếu ở một nhóm; phải **báo cả độ phủ theo nhóm** chứ không chỉ độ phủ chung. **Báo cáo.** Kiểu khoảng được chọn và lý do, độ phủ chung và theo nhóm, độ rộng trung bình.

### Bước 18. Đóng gói bundle
**Làm gì.** (1) **Refit** mô hình đã chọn (đúng tham số) trên **toàn bộ dữ liệu sạch** (train + test); hợp lệ vì mô hình đã chọn và đánh giá xong, hiệu năng báo cáo vẫn là con số train-only trên test. (2) Lập **metadata**: tên, phiên bản, cờ dữ liệu mô phỏng, tham số, chỉ số test và CI, kiểu và hệ số khoảng dự báo, kết quả chọn mô hình, trần nhiễu, phiên bản thư viện. (3) Lưu **một file** `repair_duration_bundle.joblib` chứa bộ mã hóa, mô hình và metadata (tránh lỗi "bộ mã hóa một nơi, mô hình một nẻo"), ghi `metrics.json` và các bảng CSV. (4) **Kiểm tra nạp lại**: nạp bundle từ đĩa, dự đoán 5 phiếu, `assert` trùng mô hình trong bộ nhớ. Bảng 5 phiếu in ra **không dùng để đánh giá** vì mô hình đã học các phiếu đó.

### Bước 19. Tổng kết tự động
Ô cuối **tự tổng hợp kết luận từ kết quả vừa chạy** (không điền tay) và in các **cảnh báo trung thực**: dữ liệu mô phỏng, có nhóm hòa thống kê, mô hình không hơn rõ baseline mạnh nhất, sai số thấp hơn trần nhiễu (nghi rò rỉ). Nên **nói chủ động** các cảnh báo này trước hội đồng; chủ động nêu hạn chế làm báo cáo đáng tin hơn.

---

## 5. Các mô hình: vì sao chọn, thuật toán, so sánh

### 5.1 Nguyên tắc chọn danh sách mô hình
Không biết trước mô hình nào hợp với dữ liệu (định lý "không có bữa trưa miễn phí": không thuật toán nào thắng trên mọi bài toán). Cách làm khoa học là **cho các họ thuật toán đại diện cho những giả định khác nhau thi đấu công bằng** (cùng đặc trưng, cùng fold, cùng KPI, cùng cách tinh chỉnh) rồi để dữ liệu quyết định. Bảy mô hình được chọn để **phủ toàn bộ phổ độ phức tạp**:

| Vị trí trên phổ độ chệch–phương sai | Mô hình | Giả định |
|---|---|---|
| Rất đơn giản, độ chệch cao, phương sai thấp | Ridge (tuyến tính) | Hiệu ứng **cộng** tuyến tính |
| Đơn giản nhưng đúng cấu trúc nhân | Ridge (log-nhân) | Hiệu ứng **nhân**: $y\propto\text{catalog}^b\times\text{tốc độ KTV}$ |
| Phi tuyến, một cây | Decision Tree | Chia vùng, tương tác tự động |
| Phi tuyến, giảm phương sai | Random Forest | Trung bình nhiều cây độc lập |
| Phi tuyến, giảm độ chệch lẫn phương sai | XGBoost | Cây nối tiếp sửa lỗi, có điều chuẩn |
| Phi tuyến, tối ưu tốc độ | LightGBM | Boosting leaf-wise trên histogram |
| Phi tuyến, xử lý biến danh định tốt | CatBoost | Ordered boosting, mã hóa danh định tự động |

Nếu cấu trúc thật đơn giản và dữ liệu ít, mô hình đơn giản (Ridge log-nhân) có thể thắng; nếu có tương tác phức tạp và dữ liệu nhiều, boosting thắng. Việc **cả hai đầu của phổ đều có mặt** là điều làm kết luận "vì sao chọn mô hình này" có sức thuyết phục (mục 7.3).

### 5.2 Các mốc so sánh (baseline) và vai trò
Đã mô tả ở Bước 10 (B0 đến B4). Vai trò khoa học: baseline cho biết **giá trị tăng thêm** của học máy. Hai điều đáng nhớ: B3 ($\text{catalog}\times\bar\rho_{\text{KTV}}$) là trường hợp riêng của mô hình log-nhân bỏ qua số dịch vụ và đời máy, nên nếu Ridge log-nhân thắng B3 là nhờ học được **giảm giá khi ghép dịch vụ** và hiệu ứng đời máy; B4 (bảng tra) cho thấy việc "học thuộc" tổ hợp đã gặp không đủ vì nhiều tổ hợp trong test chưa có đủ phiếu cùng loại trong train.

### 5.3 Ridge (tuyến tính)

**Ý tưởng.** Hồi quy tuyến tính có phạt độ lớn hệ số để chống quá khớp và xử lý đa cộng tuyến (Hoerl và Kennard, 1970). Các đặc trưng của ta tương quan mạnh (định mức, định mức trung bình, log định mức, số dịch vụ) nên hồi quy tuyến tính thường (OLS) cho hệ số bất ổn; Ridge làm ổn định.

**Thuật toán.** Với đặc trưng đã chuẩn hóa (trung bình 0, độ lệch chuẩn 1) $\mathbf X$ và nhãn $\mathbf y$:

$$\hat{\mathbf w}=\arg\min_{\mathbf w,b}\ \sum_{i}\big(y_i-b-\mathbf w^\top\mathbf x_i\big)^2+\alpha\lVert\mathbf w\rVert_2^2 \quad\Rightarrow\quad \hat{\mathbf w}=(\mathbf X^\top\mathbf X+\alpha\mathbf I)^{-1}\mathbf X^\top\mathbf y$$

Hệ số chặn $b$ không bị phạt. $\alpha\to0$ cho OLS (phương sai cao); $\alpha\to\infty$ co hệ số về 0 (độ chệch cao). **Cần chuẩn hóa** vì phạt $\lVert\mathbf w\rVert^2$ phụ thuộc thang đo; Pipeline đặt `StandardScaler` trước Ridge (fit chỉ trên phần học).

**Siêu tham số tinh chỉnh.** $\alpha\in\{0{,}1;\ 1;\ 10;\ 100\}$.
**Mạnh.** Nhanh, ổn định với ít dữ liệu, diễn giải được, ít quá khớp. **Yếu.** Chỉ cộng tính tuyến tính: không biểu diễn được cấu trúc nhân hay tương tác (ví dụ KTV chậm hơn **nhiều phút hơn** trên ca dài). **Vì sao đưa vào.** Mốc tham số cơ bản và đầu "đơn giản" của phổ.

### 5.4 Ridge (log-nhân)

**Ý tưởng.** Nếu thời gian = định mức × hệ số KTV × nhiễu (cấu trúc nhân), thì sau khi lấy log mọi thứ trở thành **cộng**, và mô hình tuyến tính trở nên đúng cấu trúc:

$$\ln y=b+\mathbf w^\top\mathbf x+\varepsilon\quad\Longleftrightarrow\quad y=e^{b}\ \prod_j e^{w_jx_j}\ \cdot e^{\varepsilon}$$

Hệ số của biến KTV cho **hệ số tốc độ nhân** $e^{w_{\text{KTV}}}$ (diễn giải trực tiếp: "KTV này làm lâu gấp bao nhiêu lần"); hệ số trên $\log(\text{catalog})$ là **độ co giãn** (catalog tăng 1% thì thời gian tăng bao nhiêu %).

**Cài đặt.** `TransformedTargetRegressor(Ridge, func=log, inverse_func=exp)`: huấn luyện Ridge trên $\ln y$, dự đoán $\exp(\cdot)$. Lưới $\alpha$ như Ridge.

**Điều cần biết về dự đoán.** $\exp(\mathbb E[\ln y\mid\mathbf x])$ là **trung vị có điều kiện** (hay trung bình nhân), không phải trung bình. Với nhiễu lognormal, trung bình lớn hơn trung vị một hệ số $e^{\sigma^2/2}$ (Duan, 1983, nói về lệch khi đổi thang log). Điều này **phù hợp với KPI MAE** vì trung vị là cực tiểu của sai số tuyệt đối; bias của mô hình sẽ hơi âm hoặc gần 0. Không cần hiệu chỉnh (smearing) vì KPI là MAE.

**Mạnh.** Đúng cấu trúc nhân; ít tham số nên ổn định khi dữ liệu ít (vài trăm đến vài nghìn phiếu); nhiễu nhân thành nhiễu cộng đồng đều nên giả định của bình phương tối thiểu hợp lý hơn; hệ số diễn giải được. **Yếu.** Giả định cấu trúc nhân; không tự bắt tương tác phức tạp ngoài những gì đặc trưng mô tả. **Vì sao đưa vào.** Đây là mô hình tham số **đúng với quy luật nghiệp vụ** mà EDA (Hình 1c, 1d) gợi ý; không có nó thì cuộc thi thiên về cây và không công bằng với phương án đơn giản.

### 5.5 Decision Tree (cây quyết định hồi quy, CART)

**Ý tưởng.** Chia không gian đặc trưng thành các vùng chữ nhật bằng chuỗi câu hỏi "đặc trưng $j$ có nhỏ hơn ngưỡng $s$ không?", dự đoán hằng số (trung bình nhãn) trong mỗi vùng (Breiman và cs., 1984). Tương tác tự động xuất hiện: nhánh "KTV=5345" rồi "ghép 2 dịch vụ" là một tương tác.

**Thuật toán (tham lam, từ trên xuống).** Tại mỗi nút với tập mẫu $R$, tìm cặp (đặc trưng $j$, ngưỡng $s$) giảm tổng bình phương sai số nhiều nhất:

$$(j^*,s^*)=\arg\min_{j,s}\Big[\sum_{i\in R_L(j,s)}(y_i-\bar y_{R_L})^2+\sum_{i\in R_R(j,s)}(y_i-\bar y_{R_R})^2\Big]$$

rồi đệ quy cho hai nhánh, dừng khi đạt độ sâu tối đa hoặc nút quá ít mẫu. Dự đoán lá là trung bình nhãn của lá.

**Siêu tham số.** `max_depth` ∈ {3, 5, 8, không giới hạn}: độ sâu càng lớn càng linh hoạt, càng dễ quá khớp. `min_samples_leaf` ∈ {1, 5, 20}: số mẫu tối thiểu mỗi lá, tăng lên làm mượt dự đoán.
**Mạnh.** Dễ diễn giải, bắt tương tác và phi tuyến, không cần chuẩn hóa. **Yếu.** Dự đoán là hàm bậc thang (xấp xỉ quan hệ trơn như $y\propto\text{catalog}$ bằng nhiều bậc nên cần nhiều dữ liệu); phương sai cao: thay đổi nhỏ trong dữ liệu đổi cả cây. **Vì sao đưa vào.** Mốc phi tuyến đơn giản và là "viên gạch" của Random Forest và boosting.

### 5.6 Random Forest

**Ý tưởng.** Trung bình nhiều cây sâu, mỗi cây học trên mẫu bootstrap khác nhau và chỉ xét một tập con ngẫu nhiên đặc trưng ở mỗi lần chia, để các cây **ít tương quan** với nhau (Breiman, 2001).

$$\hat y(\mathbf x)=\frac1B\sum_{b=1}^{B}T_b(\mathbf x),\qquad \text{Var}[\hat y]=\rho\,\sigma^2+\frac{1-\rho}{B}\sigma^2$$

Với $\rho$ là tương quan giữa các cây và $\sigma^2$ là phương sai một cây: tăng $B$ làm số hạng thứ hai về 0; giảm $\rho$ (nhờ bootstrap và chọn đặc trưng ngẫu nhiên) làm số hạng thứ nhất giảm. Kết quả: **giảm phương sai** mà gần như không tăng độ chệch.

**Siêu tham số.** $B=300$ cây (cố định). `max_depth` ∈ {không giới hạn, 6, 10}; `min_samples_leaf` ∈ {1, 3, 5}.
**Mạnh.** Bền vững, ít cần tinh chỉnh, bắt phi tuyến và tương tác, có ước lượng lỗi nội tại. **Yếu.** Không ngoại suy: dự đoán luôn nằm trong khoảng nhãn đã thấy (ca dài hơn mọi ca đã gặp bị dự đoán thấp); xấp xỉ quan hệ trơn kém khi dữ liệu ít; mô hình lớn. **Vì sao đưa vào.** Đại diện họ bagging, mốc phi tuyến mạnh và ổn định.

### 5.7 XGBoost

**Ý tưởng.** Gradient boosting: xây mô hình cộng tính từng cây một, mỗi cây mới học **phần sai còn lại** của tập cây trước (Friedman, 2001), với điều chuẩn rõ ràng và tối ưu bậc hai (Chen và Guestrin, 2016).

$$\hat y_i^{(m)}=\hat y_i^{(m-1)}+\eta\, f_m(\mathbf x_i),\qquad f_m\in\text{cây}$$

Ở vòng $m$, tối thiểu hóa hàm mục tiêu có điều chuẩn và khai triển Taylor bậc hai quanh dự đoán hiện tại, với $g_i=\partial_{\hat y}L$ và $h_i=\partial^2_{\hat y}L$:

$$\mathcal L^{(m)}\approx\sum_i\Big[g_if_m(\mathbf x_i)+\tfrac12h_if_m(\mathbf x_i)^2\Big]+\gamma T+\tfrac12\lambda\sum_{j}w_j^2$$

Với cấu trúc cây cố định, trọng số tối ưu của lá $j$ và độ lợi khi chia một nút:

$$w_j^*=-\frac{G_j}{H_j+\lambda},\qquad \text{Gain}=\tfrac12\Big[\frac{G_L^2}{H_L+\lambda}+\frac{G_R^2}{H_R+\lambda}-\frac{(G_L+G_R)^2}{H_L+H_R+\lambda}\Big]-\gamma$$

với $G=\sum g_i$, $H=\sum h_i$ trong nút. $\eta$ (learning rate) co từng bước để chống quá khớp; $\lambda,\gamma$ phạt lá nhiều và trọng số lớn.

**Hàm mất mát được tinh chỉnh.** `reg:squarederror` (bình phương, hướng về **trung bình**) hoặc `reg:absoluteerror` (tuyệt đối, hướng về **trung vị**). KPI là MAE và nhãn lệch phải nên hàm tuyệt đối có thể hợp hơn; để dữ liệu quyết định.

**Siêu tham số.** `max_depth` ∈ {2, 3, 4, 6} (độ phức tạp mỗi cây; cây nông = tương tác bậc thấp), `learning_rate` ∈ {0,02; 0,05}, `n_estimators` ∈ {300, 600} (số cây; learning rate nhỏ cần nhiều cây hơn), `objective` ∈ {2 hàm mất mát}. 32 cấu hình.
**Mạnh.** Thường là mô hình tốt nhất trên dữ liệu bảng cỡ vừa đến lớn; điều chuẩn tốt; bắt phi tuyến và tương tác. **Yếu.** Nhiều siêu tham số; **dễ quá khớp khi chỉ có vài trăm mẫu**; xấp xỉ quan hệ trơn bằng cây nên cần nhiều dữ liệu hơn mô hình tham số đúng cấu trúc. **Vì sao đưa vào.** Chuẩn mực hiện nay cho dữ liệu bảng; nếu nó không thắng được mô hình đơn giản thì đó là bằng chứng cấu trúc dữ liệu đơn giản.

### 5.8 LightGBM

**Ý tưởng.** Cùng họ gradient boosting nhưng thiết kế cho tốc độ và bộ nhớ (Ke và cs., 2017): (i) **histogram**: gom giá trị liên tục vào số ít ngăn để tìm ngưỡng chia nhanh; (ii) tăng trưởng cây **leaf-wise** (luôn chia lá có độ lợi lớn nhất) thay vì theo tầng, cho độ lợi lớn hơn cùng số lá nhưng **dễ quá khớp** với dữ liệu nhỏ; (iii) các kỹ thuật GOSS và EFB cho dữ liệu lớn nhiều chiều.

**Siêu tham số.** `num_leaves` ∈ {4, 7, 15} (độ phức tạp cây, tham số quan trọng nhất của leaf-wise), `min_child_samples` ∈ {5, 20} (số mẫu tối thiểu mỗi lá; mặc định 20 là hạn chế khi dữ liệu nhỏ), `n_estimators` ∈ {200, 400}, `objective` ∈ {bình phương, tuyệt đối}. 24 cấu hình.
**Mạnh.** Rất nhanh, hiệu quả trên dữ liệu lớn. **Yếu.** Trên dữ liệu nhỏ (vài trăm đến vài nghìn mẫu) lợi thế tốc độ không cần thiết và leaf-wise dễ quá khớp; thường kém XGBoost hoặc CatBoost ở quy mô này. **Vì sao đưa vào.** Đại diện thuật toán boosting phổ biến thứ hai để so sánh; kết quả kém hơn trên dữ liệu nhỏ là điều **dự báo được**, không phải lỗi. **Lưu ý trung thực:** nếu cấu hình thắng của LightGBM nằm ở biên lưới (giá trị nhỏ nhất của mọi tham số) thì lưới chưa chắc bao phủ vùng tối ưu; hãy nêu điều này như một hạn chế.

### 5.9 CatBoost (xử lý biến danh định tự nhiên)

**Ý tưởng.** Boosting trên **cây đối xứng** (oblivious trees: mọi nút cùng độ sâu dùng chung một điều kiện chia, nên cây là bộ điều chuẩn mạnh) với hai đóng góp (Prokhorenkova và cs., 2018): (i) **ordered boosting** chống "rò rỉ mục tiêu" (prediction shift) bằng cách tính độ dốc của mỗi mẫu từ mô hình **chưa thấy mẫu đó**; (ii) **ordered target statistics** mã hóa biến danh định (ID đời máy, ID KTV) theo thứ tự ngẫu nhiên, mỗi mẫu chỉ dùng thống kê của các mẫu đứng trước nó, nên không rò rỉ nhãn của chính nó.

**Cách dùng trong dự án.** Chế độ mã hóa `native`: ID đời máy và ID KTV được giữ dạng chuỗi và CatBoost tự mã hóa, khác các mô hình còn lại dùng one-hot. Điều này kiểm tra xem **mã hóa danh định tự động** có giúp ích hay không.
**Siêu tham số.** `depth` ∈ {4, 6}, `learning_rate` ∈ {0,05; 0,1}, `iterations` = 300, `loss_function` ∈ {RMSE, MAE}. 8 cấu hình.
**Mạnh.** Mặc định tốt, ổn định trên dữ liệu nhỏ, mã hóa danh định chuẩn mực. **Yếu.** Chậm hơn (nhiều thời gian nhất trong cuộc thi), ít linh hoạt hơn khi tinh chỉnh. **Vì sao đưa vào.** Đại diện cách tiếp cận khác về biến danh định, nhất là đời máy có nhiều giá trị.

### 5.10 Bảng so sánh tổng hợp

| Tiêu chí | Ridge | Ridge log-nhân | Decision Tree | Random Forest | XGBoost | LightGBM | CatBoost |
|---|---|---|---|---|---|---|---|
| Bắt cấu trúc nhân | Không | **Có** (qua log) | Xấp xỉ bậc thang | Xấp xỉ bậc thang | Xấp xỉ bằng cây | Xấp xỉ bằng cây | Xấp xỉ bằng cây |
| Bắt tương tác | Không | Không (trừ đặc trưng tạo sẵn) | Có | Có | Có | Có | Có |
| Cần chuẩn hóa | Có | Có | Không | Không | Không | Không | Không |
| Lượng dữ liệu cần | Ít | Ít | Vừa | Vừa | Vừa đến nhiều | Vừa đến nhiều | Vừa |
| Rủi ro quá khớp | Thấp | Thấp | Cao | Trung bình | Trung bình | Cao khi dữ liệu nhỏ | Trung bình |
| Ngoại suy ca dài | Có (tuyến tính) | Có (theo hàm mũ) | Không | Không | Không | Không | Không |
| Diễn giải | Rất tốt | Rất tốt (hệ số nhân) | Tốt | Trung bình | Trung bình | Trung bình | Trung bình |
| Thời gian huấn luyện | Rất nhanh | Rất nhanh | Nhanh | Trung bình | Trung bình | Nhanh | Chậm |
| Vai trò trong dự án | Mốc tham số cộng | Mốc tham số nhân (đúng cấu trúc) | Mốc cây đơn | Bagging | Boosting chuẩn mực | Boosting tốc độ | Boosting + danh định |

### 5.11 Những mô hình không đưa vào và lý do
* **Mạng nơ-ron.** Cần nhiều dữ liệu và tinh chỉnh; trên dữ liệu bảng cỡ vừa, các mô hình dựa trên cây thường vượt chúng (Grinsztajn và cs., 2022); với vài trăm đến vài nghìn phiếu, mạng nơ-ron thường chỉ thêm rủi ro quá khớp.
* **k-láng giềng gần nhất (kNN).** Sau one-hot, khoảng cách trong không gian nhiều chiều với đặc trưng hỗn hợp kém ý nghĩa; nhạy với thang đo.
* **SVR (máy vector hỗ trợ hồi quy).** Cần chuẩn hóa và chọn nhân; với quan hệ gần tuyến tính theo log, không có lợi thế hơn Ridge log-nhân và khó diễn giải.
* **Hồi quy Gamma (GLM, liên kết log).** Đây thực ra là mô hình thống kê **tự nhiên** cho thời gian dương lệch phải (phương sai tỉ lệ với bình phương trung bình). Ridge log-nhân là xấp xỉ gần với nó và đơn giản hơn để so với các mô hình khác; GLM Gamma là hướng mở rộng hợp lý khi có dữ liệu thật.
* **Ensemble/stacking.** Làm mất khả năng diễn giải và thêm độ phức tạp tích hợp mà khó chứng minh lợi ích với dữ liệu hiện tại.

### 5.12 Đọc kết quả so sánh một cách khoa học
1. **Khoảng cách giữa các mô hình thường nhỏ hơn nhiễu lấy mẫu.** Nhìn SE và nhóm hòa 1-SE trước khi nhìn thứ hạng.
2. **Mô hình phức tạp không tự động tốt hơn.** Độ phức tạp chỉ đáng giá khi dữ liệu đủ nhiều để học thêm cấu trúc mà mô hình đơn giản bỏ lỡ (đường cong học ở Bước 15 cho biết điều này).
3. **Tất cả mô hình bị chặn bởi trần nhiễu.** Khi các mô hình đều tiến sát trần thì khác biệt giữa chúng nhỏ về bản chất, và việc chọn nên dựa thêm vào **tính đơn giản, diễn giải được và chi phí vận hành**.

---

## 6. Cơ sở thống kê của việc đánh giá và so sánh

### 6.1 Chỉ số đo
Với sai số $e_i=\hat y_i-y_i$ (phút) trên $N$ mẫu:

$$\text{MAE}=\frac1N\sum|e_i|,\quad \text{RMSE}=\sqrt{\frac1N\sum e_i^2},\quad R^2=1-\frac{\sum(y_i-\hat y_i)^2}{\sum(y_i-\bar y)^2},\quad \text{P90}=Q_{0{,}9}(|e_i|),\quad \text{bias}=\frac1N\sum e_i,\quad \text{within-5}=\frac1N\sum\mathbb 1[|e_i|\le5]$$

* **MAE** là KPI chính (Willmott và Matsuura, 2005 bàn về ưu điểm của MAE khi cần diễn giải đơn vị): trung bình lệch bao nhiêu phút.
* **RMSE** phạt nặng ca lệch lớn. Tỉ số MAE/RMSE khoảng 0,80 nếu sai số gần Gauss; thấp hơn nhiều nghĩa là có vài ca lệch rất lớn.
* **$R^2$** là tỉ lệ biến thiên được giải thích so với dự đoán bằng trung bình; $R^2$ có thể âm nếu mô hình tệ hơn B0.
* **bias** dương là đoán dôi, âm là đoán hụt (ảnh hưởng ETA khách thấy).
* **P90** cho biết 90% ca lệch không quá bao nhiêu phút (đuôi sai số).

### 6.2 Cross-validation, SE và quy tắc 1-SE
Với $K$ fold, $\text{MAE}_k$ là MAE trên fold $k$:

$$\text{CV-MAE}=\frac1K\sum_k\text{MAE}_k,\qquad s=\sqrt{\tfrac1{K-1}\sum_k(\text{MAE}_k-\text{CV-MAE})^2},\qquad \text{SE}=\frac{s}{\sqrt K}$$

SE đo mức dao động của CV-MAE do cách chia fold. Hai mô hình cách nhau ít hơn một SE là **hòa thống kê** (không tách bạch được). Lưu ý: SE tính từ 5 fold là ước lượng thô và hơi lạc quan vì các fold dùng chung dữ liệu (Arlot và Celisse, 2010); đó là lý do ta bổ sung kiểm định ghép cặp trên test.

### 6.3 Thiên lệch chọn lọc và nested CV
Chọn tham số rồi báo điểm trên cùng dữ liệu cho điểm lạc quan vì $\min_\theta \widehat{\text{lỗi}}(\theta)$ có kỳ vọng thấp hơn lỗi thật của $\theta^*$ (nhiễu lấy mẫu làm một số cấu hình "may mắn"). Nested CV đo lỗi của **cả quy trình** "tinh chỉnh rồi huấn luyện" trên dữ liệu chưa tham gia chọn tham số, nên không thiên lệch theo nghĩa này (Varma và Simon, 2006).

### 6.4 Bootstrap cho khoảng tin cậy MAE
Lấy mẫu **có hoàn lại** $|e_i|$ trên test 2000 lần, tính MAE mỗi lần, lấy phân vị 2,5% và 97,5% (Efron, 1979). Cho biết mức dao động của MAE test do cỡ mẫu test nhỏ. Hai CI chồng nhau nhiều thì chưa kết luận được hai mô hình khác nhau; kiểm định **ghép cặp** (mục sau) mạnh hơn vì loại được phần biến thiên chung giữa các phiếu.

### 6.5 Wilcoxon ghép cặp và hiệu chỉnh Bonferroni
Trên **cùng các phiếu test**, đặt $d_j=|e_j^{\text{đối thủ}}|-|e_j^{\text{chọn}}|$. Kiểm định Wilcoxon signed-rank (Wilcoxon, 1945) kiểm tra $H_0$: phân phối $d_j$ đối xứng quanh 0 (hai mô hình sai như nhau), **không giả định phân phối chuẩn**. Vì so với $m$ đối thủ nên xác suất sai lầm loại I tích lũy; hiệu chỉnh **Bonferroni** dùng ngưỡng $\alpha'=0{,}05/m$ (Dunn, 1961). Khi $m=11$, $\alpha'\approx0{,}0045$. Kết luận "tốt hơn có ý nghĩa" cần $p<\alpha'$ **và** chênh lệch trung bình dương; ngược lại "hòa thống kê". Cần nhớ: $p$ lớn **không** chứng minh hai mô hình bằng nhau, chỉ là không đủ bằng chứng để phân biệt với cỡ mẫu hiện có (Demšar, 2006 bàn kỹ về so sánh nhiều thuật toán).

### 6.6 ANCOVA và kiểm định tín hiệu KTV
Đã nêu ở Bước 6. Điểm phương pháp: so sánh hai mô hình lồng nhau bằng $F_{\text{partial}}$ cho biết biến KTV có giải thích **thêm** biến thiên của $\log y$ sau khi đã kiểm soát độ khó ca hay không. Hệ số tốc độ nhân của KTV là $e^{\hat\beta_{\text{KTV}}}$, chuẩn hóa để trung bình nhân bằng 1. Phép kiểm tra tính đúng đắn của phương pháp: trên dữ liệu mô phỏng ta biết hệ số thật (0,90; 1,00; 1,15; sau chuẩn hóa trung bình nhân bằng 1 là 0,890; 0,988; 1,137) và có thể kiểm tra ước lượng có thu hồi đúng không. Khi so hệ số ước lượng với giá trị cài, phải chuẩn hóa cùng cách.

### 6.7 Trần nhiễu
Đã nêu ở Bước 10 (phương sai pure error). Điểm cần nhớ: (i) chỉ đo trên phiếu có song sinh; (ii) so sánh công bằng là trên **cùng tập** đó; (iii) là ước lượng có sai số, nên chênh lệch nhỏ (±10%) không đáng kể.

### 6.8 Conformal và permutation importance
Đã nêu ở Bước 16 và 17. Hai điểm bổ sung: bảo đảm conformal là **độ phủ trung bình** dưới giả định hoán đổi được, không phải độ phủ có điều kiện cho từng nhóm (nên phải báo cáo theo nhóm); permutation importance đo độ quan trọng **của mô hình đã huấn luyện**, không phải quan hệ nhân quả.

---

## 7. Cách đọc kết quả và ra quyết định

### 7.1 Cây quyết định của việc đọc kết quả

```text
1. Dữ liệu sạch và một nguồn?            Không -> dừng, sửa dữ liệu (Bước 2, 3)
2. ANCOVA KTV có ý nghĩa?                Không -> "dự đoán theo KTV" chưa có cơ sở
3. Mô hình tốt nhất hơn baseline mạnh nhất quá 1 SE (CV) và có ý nghĩa ghép cặp (test)?
        Có    -> ML tạo giá trị; báo % giảm MAE kèm CI
        Không -> nói thẳng: mô hình nhân đơn giản (baseline) đủ tốt; cân nhắc triển khai baseline
4. Nhiều mô hình hòa thống kê?           Có -> "chọn theo CV-MAE nhỏ nhất", KHÔNG nói "vượt trội"
5. Sai số mô hình (cùng tập có song sinh) / trần < 0,8?   Có -> nghi rò rỉ, kiểm tra trước khi báo cáo
6. MAE test lệch CV-MAE hơn 2 SE?        Có -> báo cả hai con số, kèm CI test
7. Độ phủ khoảng dự báo gần 90% và theo nhóm?   Không -> nêu nhóm bị phủ thiếu như hạn chế
```

### 7.2 Từ kết quả sang câu viết (bảng tra nhanh)

| Quan sát trong notebook | Nên viết | Không nói |
|---|---|---|
| Nhóm hòa có nhiều mô hình | "Mô hình X được chọn theo CV-MAE nhỏ nhất; X, Y, Z không khác biệt có ý nghĩa thống kê trong 1 SE." | "X vượt trội hẳn các mô hình khác." |
| Wilcoxon $p>\alpha'$ | "Chưa đủ bằng chứng để phân biệt X với Y trên tập test." | "X và Y bằng nhau." |
| MAE test thấp hơn CV-MAE nhiều | "MAE test là ...; CV-MAE là ...; chênh lệch nằm trong dao động của test nhỏ (CI ...)." | Chỉ báo con số test đẹp hơn |
| Mô hình sát trần nhiễu (cùng tập) | "Sai số của mô hình gần mức nhiễu bản chất ước lượng từ phiếu song sinh." | "Mô hình đạt giới hạn lý thuyết" (trần là ước lượng) |
| Augmentation không lợi | "Thử nghiệm sinh thêm dữ liệu không cải thiện (p = ...), nên không dùng." | Ngầm dùng mà không kiểm chứng |
| Độ phủ nhóm ca dài thấp | "Khoảng dự báo phủ ... ở nhóm ca dài, thấp hơn mục tiêu 90%." | Chỉ báo độ phủ chung |
| Dữ liệu mô phỏng | "Trên dữ liệu mô phỏng có kiểm soát ..." | "Độ chính xác thực tế là ..." |

### 7.3 Vì sao một mô hình đơn giản có thể thắng (và cách nói cho đúng)
Nếu Ridge log-nhân thắng hoặc hòa với boosting, đó **không phải** dấu hiệu quy trình sai; nó có lời giải thích khoa học:
1. **Quy luật sinh dữ liệu là nhân** (mục 2.2) và Ridge log-nhân biểu diễn đúng cấu trúc đó với ít tham số; cây và boosting phải xấp xỉ quan hệ trơn bằng nhiều bậc nên cần nhiều dữ liệu hơn.
2. **Dữ liệu ít** (vài trăm đến vài nghìn phiếu): mô hình ít tham số có phương sai thấp; mô hình linh hoạt dễ khớp nhiễu.
3. **Nhiễu lớn** quyết định trần: khi mọi mô hình đều gần trần, mô hình linh hoạt không còn gì để học thêm (Bước 15 và so với trần nhiễu).

**Phải nói thêm, để trung thực:** cấu trúc nhân do **chính ta cài vào** dữ liệu mô phỏng, nên lợi thế của mô hình nhân một phần là phản ánh quy luật mô phỏng. Trên dữ liệu thật, cấu trúc có thể phức tạp hơn (tương tác KTV với loại lỗi, hiệu ứng ca làm...), và boosting có thể thắng. Nhờ quy trình đã sẵn, chỉ cần chạy lại notebook để biết. Đây cũng là lý do giữ **cả hai đầu của phổ** trong cuộc thi.

### 7.4 Triển khai mô hình thắng hay mô hình đơn giản?
Nếu mô hình ML không hơn baseline mạnh nhất một cách có ý nghĩa, **nguyên tắc tiết kiệm** (parsimony) khuyên chọn cái đơn giản hơn: rẻ hơn, dễ giải thích, dễ vận hành. Nếu một mô hình đơn giản và một mô hình phức tạp hòa thống kê, nên ưu tiên đơn giản. Quy tắc chọn tự động của notebook là CV-MAE nhỏ nhất; quyết định cuối có thể kèm lập luận parsimony **nếu nêu rõ trong báo cáo** và dựa trên nhóm hòa 1-SE đã công bố.

---

## 8. Tích hợp vào hệ thống và vận hành

### 8.1 Bundle: một file gồm gì
`models/v2/repair_duration_bundle.joblib` chứa ba thứ: **builder** (bộ mã hóa đặc trưng đã fit), **model** (bộ ước lượng cuối của Pipeline) và **metadata**. Gói chung để bộ mã hóa và mô hình luôn khớp phiên bản.

Các khóa metadata quan trọng: `model_name`, `model_version`, `synthetic_data`, `use_augmentation`, `best_params`, `test_metrics`, `test_mae_ci95`, `baseline_primary_name`, `baseline_primary_test_metrics`, `selection` (quy tắc, CV-MAE, SE, nhóm hòa), `noise_floor`, `interval_method`, `interval_q_abs`, `interval_q_rel`, `interval_halfwidth_minutes`, `interval_coverage`, `interval_test_coverage`, `technician_ids`, `features`, `cleaning`, `versions`. `app.py` và `06_db_service.py` chỉ đọc các khóa này nên **không cần sửa khi đổi mô hình**.

### 8.2 Luồng dự đoán khi chạy thật

```text
Spring Boot  --POST /api/v1/repair-duration/predict-candidates-->  app.py
     (ticketId, danh sách KTV ứng viên)                               |
                                                    06_db_service.fetch_ticket_features(ticketId)   (SQL: 5 đặc trưng gốc)
                                                                      |
                                       predict_for_technician_ids: với mỗi KTV, thay technician_id rồi
                                       builder.transform -> model.predict -> sàn 10 phút -> khoảng dự báo
                                                                      |
Spring Boot  <--  predictedTechnicalMinutes, lower/upper, warnings, model {name, version, syntheticData, productionValidated=false, testMae...}
```

* **Phiếu chưa phân công KTV:** `predict_mean_over_technicians` lấy trung bình dự đoán trên các KTV đã biết.
* **Cảnh báo:** KTV hoặc đời máy hoặc mã lỗi chưa từng thấy lúc huấn luyện được đưa vào `warnings` (không dự đoán lặng lẽ).
* **`/api/v1/predict-and-update`:** dự đoán rồi ghi vào `ml_predictions` (với `confidence = interval_coverage`), cập nhật `service_tickets` (thời lượng ước tính, giờ bắt đầu, giờ hoàn thành dự kiến) và ghi `service_time_estimate_histories`.
* **`/api/v1/model-info`:** trả metadata để trang quản trị hiển thị minh bạch mô hình đang chạy.
* **Dự đoán lại** mỗi khi hạng mục sửa chữa của phiếu thay đổi (vì đặc trưng đổi).

### 8.3 Các bước đưa vào hệ thống
1. Chạy notebook (Restart & Run All) để sinh bundle và `reports/`.
2. `python scripts/05_predict_demo.py` kiểm tra bundle không cần DB.
3. `python app.py` (cổng 8001); kiểm tra `/health` và `/api/v1/model-info`.
4. Spring Boot gọi các endpoint ở mục 8.2; kiểm tra `modelVersion` khớp bundle mới.
5. Đổi mô hình không cần khởi động lại dịch vụ: `load_bundle` tự nạp lại khi file đổi.

### 8.4 Giám sát và huấn luyện lại
`scripts/07_monitor_feedback.py` so dự đoán đã ghi (`ml_predictions`) với thời gian thi công thực tế của các phiếu đã xong và tính: MAE thực tế, bias, độ phủ khoảng dự báo thực tế, MAE theo KTV. Nếu MAE thực tế lớn hơn `RETRAIN_MAE_RATIO` (1,5) lần MAE lúc test thì trạng thái là `RETRAIN_RECOMMENDED`. Huấn luyện lại bằng `scripts/03_train_evaluate.py` (cùng pipeline với notebook) khi: đủ dữ liệu thật, có KTV hoặc đời máy mới, hoặc giám sát cảnh báo trôi dữ liệu (data drift).

### 8.5 Chuyển sang dữ liệu thật
Đặt `SYNTHETIC_DATA=False`, `TICKET_CODE_PREFIX=None`, cân nhắc `SPLIT_MODE="time"`, xuất lại CSV, chạy lại notebook. Khi có dữ liệu thật hiệu năng có thể khác dữ liệu mô phỏng, và mô hình thắng cuộc có thể đổi.

---

## 9. Bảng điền số cho báo cáo

Điền sau khi chạy lại notebook trên dữ liệu một nguồn. Cột "Lấy ở đâu" chỉ vị trí đầu ra.

| Mục | Giá trị | Lấy ở đâu |
|---|---|---|
| Số phiếu thô, số bị loại theo từng luật, số phiếu sạch | ... | Notebook Bước 3 |
| Số KTV, đời máy, tổ hợp mã lỗi | ... | Bước 3 |
| Số phiếu train / test | ... | Bước 5 |
| KS (nhãn) p, chi-bình-phương (KTV) p | ... | Bước 5 |
| Độ lệch $g_1$, Pearson $r$ (định mức–nhãn) | ... | Bước 6 |
| ANOVA, Kruskal–Wallis p; ANCOVA $F$, $p$, partial $\eta^2$ | ... | Bước 6 |
| Hệ số tốc độ KTV (đã hiệu chỉnh) | ... | Bước 6, 16 |
| CV-MAE ± SE của 5 baseline | ... | Bước 10 |
| Baseline mạnh nhất theo CV | ... | Bước 10 |
| Trần nhiễu (RMSE, MAE, phần phiếu được phủ) | ... | Bước 10 |
| Bảng xếp hạng nested CV (7 mô hình) | ... | Bước 12 |
| Tham số triển khai của từng mô hình | ... | Bước 11, 12 |
| Mô hình được chọn; nhóm hòa 1-SE | ... | Bước 12 |
| MAE out-of-fold trên tập có song sinh vs trần; tỉ lệ | ... | Bước 12 |
| Ablation augmentation: MAE hai nhánh, $p$ | ... | Bước 13 |
| Bảng test: MAE, CI 95%, RMSE, $R^2$, P90, within-5, bias | ... | Bước 14 |
| Chênh lệch MAE so với baseline mạnh nhất + CI | ... | Bước 14 |
| Kết quả Wilcoxon + Bonferroni | ... | Bước 14 (`paired_tests.csv`) |
| MAE theo KTV; top ca sai lớn | ... | Bước 14 (`top_errors.csv`) |
| Đường cong học: khoảng cách, độ dốc cuối | ... | Bước 15 |
| Permutation importance; chỉ số KTV (3 cột) | ... | Bước 16 (`technician_effect.csv`) |
| Kiểu khoảng dự báo, $\hat q$, độ phủ chung và theo nhóm, độ rộng | ... | Bước 17 |
| Phiên bản mô hình, phiên bản thư viện | ... | `metrics.json` |

---

## 10. Giới hạn và các mối đe dọa tính hợp lệ

**Tính hợp lệ nội tại** (kết luận có đúng với dữ liệu này không):
* Đã kiểm soát: rò rỉ tương lai, rò rỉ qua tách dữ liệu và bộ mã hóa, thiên lệch chọn lọc tham số, chọn baseline theo test, so sánh nhiều lần.
* Còn lại: **một lần chia** train/test duy nhất, nên MAE test dao động theo cách chia (CI bootstrap chỉ phản ánh dao động của mẫu test, không phản ánh dao động do cách chia); SE từ 5 fold là ước lượng thô; lưới tham số hữu hạn (cấu hình thắng ở biên lưới nghĩa là có thể chưa tối ưu).

**Tính hợp lệ ngoại tại** (kết luận có áp dụng ra ngoài không):
* **Dữ liệu mô phỏng** với quy luật đơn giản do ta cài (một hệ số KTV, 3 KTV, nhiễu nhân lognormal). Kết quả chứng minh quy trình, không chứng minh hiệu năng thực địa.
* **Test cùng phân phối với train:** phiếu "song sinh" (cùng đời máy, mã lỗi, KTV) xuất hiện ở cả hai tập; chưa đo dự đoán cho đời máy hay dịch vụ **hoàn toàn mới**.
* **Ca nhiều dịch vụ ít hơn ca một dịch vụ**, nên sai số ở ca ghép lớn hơn và ít bằng chứng hơn.
* **Phân phối có thể trôi** theo thời gian (mùa vụ, KTV mới, máy đời mới); khoảng dự báo chỉ bảo đảm khi dữ liệu mới giống dữ liệu cũ.
* **Nhãn lấy từ phiếu đã hoàn tất:** lúc dự đoán sớm có thể thiếu hạng mục phát sinh sau đó.

**Hạn chế phương pháp nên nêu:** trần nhiễu là ước lượng và chỉ đo trên phiếu có song sinh; permutation importance bị ảnh hưởng bởi đặc trưng tương quan; ANCOVA giả định tuyến tính trên thang log; chưa thử hồi quy Gamma (GLM) và chưa có kiểm tra theo thời gian vì dữ liệu mô phỏng.

**Hướng phát triển:** thu dữ liệu thật rồi chạy lại toàn bộ quy trình; chia lặp nhiều lần (repeated nested CV) để SE đáng tin hơn; kiểm tra theo thời gian (`SPLIT_MODE="time"`); thử GLM Gamma; thêm hiệu ứng tương tác KTV × loại lỗi nếu dữ liệu thật cho thấy cần; theo dõi drift.

---

## 11. Mẫu viết báo cáo

Các đoạn dưới đây dùng được sau khi điền số từ mục 9. Chỗ `[...]` là số hoặc tên cần điền.

**Chương phương pháp, dữ liệu.** "Do hệ thống chưa vận hành đủ lâu để có dữ liệu thật, nhóm sinh dữ liệu mô phỏng có kiểm soát bằng script `seed_database_ml.py` theo quy luật nghiệp vụ: thời gian sửa chữa bằng định mức dịch vụ (đã giảm 12 phút cho mỗi dịch vụ ghép thêm) nhân với hệ số tốc độ của kỹ thuật viên (0,90; 1,00; 1,15) và nhiễu nhân lognormal ($\sigma=0{,}15$), có cố định hạt ngẫu nhiên để tái lập. Sau làm sạch còn [N] phiếu của [K] kỹ thuật viên và [D] đời máy. Nhãn là thời gian thi công thuần, đã trừ thời gian chờ linh kiện và chờ khách duyệt. Vì dữ liệu là mô phỏng, kết quả phản ánh khả năng học lại quy luật mô phỏng và chưa phải hiệu năng thực địa."

**Chương phương pháp, chống rò rỉ và đánh giá.** "Chỉ các thuộc tính biết được tại thời điểm lập hạng mục (đời máy, kỹ thuật viên, tập mã lỗi, số dịch vụ, định mức) được dùng làm đặc trưng. Dữ liệu được tách 80/20 theo phiếu trước mọi phân tích; tập test chỉ được dùng một lần. Bộ mã hóa đặc trưng được đặt trong Pipeline nên được học lại trong từng fold. Để chọn mô hình, nhóm dùng nested cross-validation (5 fold ngoài để đánh giá, 3 fold trong để chọn siêu tham số), tránh thiên lệch lạc quan do chọn tham số trên chính dữ liệu đánh giá."

**Chương phương pháp, mô hình.** "Nhóm so sánh bảy mô hình đại diện cho các giả định khác nhau: Ridge (cộng tuyến tính), Ridge log-nhân (cấu trúc nhân), Decision Tree, Random Forest, XGBoost, LightGBM và CatBoost, cùng năm mốc so sánh từ trung bình đến mô hình định mức nhân hệ số kỹ thuật viên. Tiêu chí chọn mô hình được đặt trước khi xem tập test: CV-MAE nhỏ nhất, kèm nhóm hòa thống kê trong một sai số chuẩn."

**Kết quả, tín hiệu KTV.** "Phân tích ANCOVA trên log thời gian sau khi hiệu chỉnh độ khó ca cho thấy kỹ thuật viên giải thích thêm [x]% biến thiên ($F=[..]$, $p=[..]$). Hệ số tốc độ đã hiệu chỉnh của ba kỹ thuật viên là [..], [..], [..], phù hợp với quy luật mô phỏng đã cài."

**Kết quả, so sánh mô hình.** "Mô hình [X] đạt nested CV-MAE [..] ± [..] phút, [thấp hơn baseline mạnh nhất ([tên], [..] phút) [..]%]. Nhóm các mô hình không khác biệt có ý nghĩa trong một sai số chuẩn gồm [..]; vì vậy [X] được chọn theo quy tắc CV-MAE nhỏ nhất và không khẳng định vượt trội. Trên tập test độc lập ([n] phiếu), [X] đạt MAE [..] phút (CI 95%: [..]–[..]), RMSE [..], $R^2$ [..]; [..]% ca lệch không quá 5 phút. So với baseline mạnh nhất, MAE giảm [..] phút (CI 95%: [..]–[..])."

**Kết quả, khoảng dự báo.** "Khoảng dự báo 90% theo split conformal kiểu [absolute/relative] đạt độ phủ [..]% trên test (mục tiêu 90%), độ rộng trung bình [..] phút; độ phủ theo nhóm ca ngắn, vừa, dài lần lượt là [..], [..], [..]."

**Thảo luận và hạn chế.** "Nhóm lưu ý ba hạn chế chính: dữ liệu là mô phỏng với quy luật đơn giản nên chưa chứng minh hiệu năng thực địa; tập test chỉ đo dự đoán các loại phiếu đã gặp; và kết quả dựa trên một lần chia dữ liệu. Khi có dữ liệu vận hành thật, quy trình được chạy lại nguyên vẹn bằng một cờ cấu hình, đồng thời hệ thống giám sát so sánh dự đoán với thực tế để phát hiện suy giảm hiệu năng."

---

## 12. Câu hỏi thường gặp của hội đồng

**1. Vì sao là hồi quy mà không phân loại?** Đầu ra là số phút liên tục, cần sai số tính bằng phút cho ETA.

**2. Vì sao dùng MAE chứ không phải RMSE hay $R^2$?** MAE cùng đơn vị nghiệp vụ, ít nhạy ngoại lai, trả lời "trung bình lệch bao nhiêu phút". RMSE và $R^2$ vẫn báo như chỉ số phụ.

**3. Dữ liệu mô phỏng thì kết quả có ý nghĩa gì?** Chứng minh quy trình đúng và phương pháp thu hồi được quy luật đã biết (hệ số KTV); không chứng minh hiệu năng thực địa. Cờ `syntheticData` được trả ra API để minh bạch.

**4. Làm sao biết không có rò rỉ dữ liệu?** Bảng chính sách cột kèm `assert` không có cột cấm trong đặc trưng; tách theo phiếu trước mọi phân tích; bộ mã hóa nằm trong Pipeline; test chỉ dùng một lần; so sai số với trần nhiễu (sai số thấp hơn trần hẳn mới nghi).

**5. Nested CV là gì và vì sao cần?** Vòng trong chọn tham số, vòng ngoài đánh giá; tránh điểm lạc quan do chọn tham số trên chính dữ liệu đánh giá.

**6. Vì sao mô hình đơn giản được chọn mà không phải XGBoost?** Chọn theo luật CV-MAE nhỏ nhất đặt trước. Quy luật dữ liệu có cấu trúc nhân mà Ridge log-nhân biểu diễn đúng với ít tham số, phù hợp dữ liệu vài trăm đến vài nghìn phiếu. Khi các mô hình hòa thống kê, ưu tiên đơn giản và diễn giải được. (Nói thêm: cấu trúc nhân do ta cài, trên dữ liệu thật có thể khác.) *Chỉ dùng câu này nếu kết quả chạy lại đúng như vậy.*

**7. "Hòa thống kê" nghĩa là sao?** Chênh lệch CV-MAE nhỏ hơn một sai số chuẩn, và/hoặc Wilcoxon ghép cặp không có ý nghĩa sau Bonferroni: không đủ bằng chứng để tách bạch các mô hình.

**8. Vì sao phải hiệu chỉnh Bonferroni?** So nhiều cặp làm xác suất "tìm thấy khác biệt giả" tích lũy; chia ngưỡng cho số lần so sánh để kiểm soát.

**9. Vì sao ANCOVA mà không chỉ ANOVA?** KTV không được giao ca ngẫu nhiên; ANCOVA so KTV trong cùng độ khó ca nên không lẫn độ khó với tay nghề.

**10. Trần nhiễu là gì và dùng để làm gì?** Sai số bất khả giảm ước lượng từ các phiếu có đặc trưng giống hệt nhau; dùng để biết còn dư địa cải thiện không và phát hiện số liệu quá đẹp.

**11. Vì sao dùng log cho nhãn?** Thời gian dương, lệch phải, nhiễu nhân; sau log nhiễu nhân thành cộng và mô hình tuyến tính đúng cấu trúc. Dự đoán là trung vị có điều kiện, hợp với MAE.

**12. Khoảng dự báo 90% có nghĩa là 90% phiếu rơi trong khoảng?** Đúng theo nghĩa trung bình trên các phiếu (với dữ liệu hoán đổi được); không phải xác suất cho từng phiếu; độ phủ theo nhóm có thể lệch và được báo cáo.

**13. Cột `confidence` trong CSDL là gì?** Mức phủ danh nghĩa 0,90 của khoảng dự báo, không phải $R^2$ hay độ chính xác.

**14. Vì sao không dùng augmentation?** Ablation trong train cho thấy [không cải thiện, $p=..$]; bản sao chỉ nhiễu hóa nhãn, không tạo thông tin mới.

**15. Khi KTV hoặc đời máy mới thì sao?** One-hot cho toàn 0 và `warnings` báo giá trị chưa từng thấy; dự đoán kém tin cậy hơn; cần huấn luyện lại khi có đủ dữ liệu mới.

**16. Làm sao biết mô hình còn tốt sau triển khai?** Script giám sát so dự đoán với thực tế, báo MAE thực tế, độ phủ thực tế; vượt 1,5 lần MAE lúc test thì khuyến nghị huấn luyện lại.

**17. Vì sao MAE test khác CV-MAE?** Test chỉ có vài trăm phiếu và chỉ một lần chia nên dao động; CI bootstrap cho biết mức dao động; báo cả hai con số.

**18. Vì sao không dùng mạng nơ-ron?** Dữ liệu bảng cỡ nhỏ, mô hình dựa trên cây và mô hình tuyến tính thường tốt hơn hoặc ngang mà đơn giản hơn nhiều (Grinsztajn và cs., 2022).

**19. Có thể tái lập kết quả không?** Có: seed cố định cho sinh dữ liệu, chia dữ liệu, fold và mô hình; phiên bản thư viện lưu trong metadata. Ngoại lệ nhỏ: một số thư viện có thể cho khác biệt rất nhỏ giữa phiên bản.

**20. Chuyển sang dữ liệu thật cần làm gì?** Đổi hai cờ cấu hình, xuất lại CSV, chạy lại notebook; quy trình giữ nguyên.

---

## 13. Phụ lục

### 13.1 Ghi chú kiểm toán lần chạy đầu (để bạn hiểu vì sao phải chạy lại; không đưa vào báo cáo)

Lần chạy đầu tiên (gói v3) đã chạy hết notebook không lỗi, và **số liệu được tái lập độc lập** (tính lại cho ra đúng CV-MAE đã báo của các mô hình sklearn và baseline, đúng trần nhiễu và ANCOVA). Tức phần mã và tính toán đúng. Vấn đề nằm ở **dữ liệu đầu vào**:

* CSV có 1.029 dòng thuộc **hai nguồn**: 621 dòng mã `ST-SEED-...` (đợt sinh của script hiện tại, ID từ 17622) và 408 dòng mã `ST-2026xx-...` (đợt khác, ID từ 4072 đến 12646). Script seed chỉ xóa phiếu `ST-SEED-%` khi chạy lại nên phiếu đợt cũ còn nguyên, còn truy vấn xuất CSV lấy tất cả.
* Hai đợt có **quy luật khác nhau**. Tỉ lệ $\rho$ trung bình của ca một dịch vụ theo KTV (5343, 5344, 5345): đợt `ST-SEED` là 0,914; 1,009; 1,143 (khớp 0,90; 1,00; 1,15 cài sẵn); đợt cũ là 1,081; 1,130; 1,330. Độ lệch chuẩn log: 0,147 (khớp $\sigma=0{,}15$) so với 0,18. Đợt cũ không có phiếu chờ, 12% ca ghép so với 34%.
* **Hệ quả:** hệ số KTV ước lượng là một giá trị "trung bình" không đúng đợt nào; trần nhiễu bị thổi phồng (MAE 7,10 so với 5,21 nếu chỉ lấy `ST-SEED`); mọi kiểm định bị méo; và nếu báo cáo mô tả dữ liệu là "sinh từ script seed theo quy luật X" thì **sai sự thật** với 40% dữ liệu.
* **Kiểm tra phương pháp trên đợt sạch.** Chỉ với 539 phiếu `ST-SEED` sạch, ANCOVA thu hồi hệ số KTV 0,898; 0,991; 1,124; giá trị cài 0,90; 1,00; 1,15 sau khi chuẩn hóa cùng cách (trung bình nhân bằng 1) là 0,890; 0,988; 1,137, nên sai lệch khoảng 1%, chứng tỏ phương pháp thu hồi đúng quy luật khi dữ liệu thuần nhất. Ước lượng sơ bộ trên đợt này (chỉ các mô hình sklearn, 431 phiếu train): Ridge log-nhân nested CV-MAE khoảng 7,8, baseline "định mức × hệ số KTV" khoảng 8,4, baseline tuyến tính khoảng 9,0; sai số out-of-fold của mô hình trên tập phiếu có song sinh khoảng 5,7 so với trần 5,2 (tỉ lệ 1,09). **Đây chỉ là ước lượng của quá trình kiểm toán**, không dùng trong báo cáo; số chính thức lấy từ lần chạy lại.
* **Một lỗi trình bày đã sửa ở v3.1:** dòng tổng kết cũ so MAE trên toàn bộ phiếu với trần nhiễu đo trên tập phiếu song sinh (ca ngắn hơn), nên cho kết luận "cách trần −0,09 phút" không có cơ sở. Bản v3.1 so trên đúng tập. Lưới XGBoost/LightGBM có cấu hình thắng nằm ở biên lưới nên đã dịch lưới; `N_PASSES` tăng lên 10 để có khoảng 1.000 phiếu một nguồn.
* **Việc còn lại với file cũ:** xóa `scripts/04_ablation_augmentation.py`, `data/synthetic/`, `repair_dataset_clean.csv` và các hình/CSV cũ trong `reports/`; README cũ (mô tả XGBoost cố định) được thay bằng README mới.

### 13.2 Bảng ký hiệu

| Ký hiệu | Ý nghĩa |
|---|---|
| $\mathbf x$ | Vector đặc trưng của một phiếu |
| $y,\ \hat y$ | Nhãn thật và dự đoán (phút) |
| $e=\hat y-y$ | Sai số (phần dư) |
| $\rho=y/\text{catalog}$ | Tỉ lệ hiệu suất (1 = đúng định mức) |
| $\alpha$ | Hệ số phạt Ridge (mục 5.3); mức sai lầm loại I (mục 6.5); mức bao phủ $1-\alpha$ (mục 17) |
| $\eta$ | Learning rate của boosting; hoặc eta-bình-phương (kích thước hiệu ứng) tùy ngữ cảnh |
| SE | Sai số chuẩn $=s/\sqrt K$ |
| OOF | Out-of-fold: dự đoán cho mẫu từ mô hình chưa thấy mẫu đó |
| $\hat q$ | Phân vị conformal (nửa độ rộng khoảng dự báo) |
| $t_0$ | Thời điểm dự báo (lúc lập hạng mục) |

### 13.3 Tra cứu nhanh: file nào làm việc gì

| File | Vai trò |
|---|---|
| `config/config.py` | Hằng số: cột, seed, số fold, nguồn dữ liệu, cờ mô phỏng, tham số phục vụ |
| `src/features.py` | `clean_training_data`, `RepairFeatureBuilder` |
| `src/evaluation.py` | Chỉ số, `baseline_predictions`, `twin_noise_floor`, `technician_effect_test`, `calibrate_interval` |
| `src/modeling.py` | `split_train_test`, `make_group_folds`, `make_candidates`, `nested_cv`, `fit_deployable` |
| `src/bundle.py` | `fit_final_pipeline`, `package_bundle`, `reload_check` |
| `src/inference.py` | `load_bundle`, `predict_minutes`, `interval_bounds`, dự đoán theo KTV |
| `scripts/03_train_evaluate.py` | Chạy cùng pipeline không đồ thị |
| `scripts/06_db_service.py`, `app.py` | Dịch vụ dự đoán và API |
| `scripts/07_monitor_feedback.py` | Giám sát sau triển khai |

### 13.4 Tài liệu tham khảo
* Arlot, S., và Celisse, A. (2010). A survey of cross-validation procedures for model selection. *Statistics Surveys*, 4, 40–79.
* Breiman, L. (2001). Random forests. *Machine Learning*, 45(1), 5–32.
* Breiman, L., Friedman, J., Olshen, R., và Stone, C. (1984). *Classification and Regression Trees*. Wadsworth.
* Cawley, G. C., và Talbot, N. L. C. (2010). On over-fitting in model selection and subsequent selection bias in performance evaluation. *Journal of Machine Learning Research*, 11, 2079–2107.
* Chen, T., và Guestrin, C. (2016). XGBoost: A scalable tree boosting system. *Proceedings of KDD '16*.
* Demšar, J. (2006). Statistical comparisons of classifiers over multiple data sets. *Journal of Machine Learning Research*, 7, 1–30.
* Duan, N. (1983). Smearing estimate: a nonparametric retransformation method. *Journal of the American Statistical Association*, 78(383), 605–610.
* Dunn, O. J. (1961). Multiple comparisons among means. *Journal of the American Statistical Association*, 56(293), 52–64.
* Efron, B. (1979). Bootstrap methods: another look at the jackknife. *The Annals of Statistics*, 7(1), 1–26.
* Fisher, A., Rudin, C., và Dominici, F. (2019). All models are wrong, but many are useful. *Journal of Machine Learning Research*, 20(177).
* Friedman, J. H. (2001). Greedy function approximation: a gradient boosting machine. *The Annals of Statistics*, 29(5), 1189–1232.
* Grinsztajn, L., Oyallon, E., và Varoquaux, G. (2022). Why do tree-based models still outperform deep learning on typical tabular data? *NeurIPS Datasets and Benchmarks Track*.
* Hastie, T., Tibshirani, R., và Friedman, J. (2009). *The Elements of Statistical Learning* (ấn bản 2). Springer.
* Hoerl, A. E., và Kennard, R. W. (1970). Ridge regression: biased estimation for nonorthogonal problems. *Technometrics*, 12(1), 55–67.
* Kaufman, S., Rosset, S., Perlich, C., và Stitelman, O. (2012). Leakage in data mining: formulation, detection, and avoidance. *ACM Transactions on Knowledge Discovery from Data*, 6(4).
* Ke, G., và cs. (2017). LightGBM: A highly efficient gradient boosting decision tree. *Advances in Neural Information Processing Systems*, 30.
* Kruskal, W. H., và Wallis, W. A. (1952). Use of ranks in one-criterion variance analysis. *Journal of the American Statistical Association*, 47(260), 583–621.
* Lei, J., G'Sell, M., Rinaldo, A., Tibshirani, R. J., và Wasserman, L. (2018). Distribution-free predictive inference for regression. *Journal of the American Statistical Association*, 113(523), 1094–1111.
* Pedregosa, F., và cs. (2011). Scikit-learn: Machine learning in Python. *Journal of Machine Learning Research*, 12, 2825–2830.
* Prokhorenkova, L., Gusev, G., Vorobev, A., Dorogush, A. V., và Gulin, A. (2018). CatBoost: unbiased boosting with categorical features. *Advances in Neural Information Processing Systems*, 31.
* Varma, S., và Simon, R. (2006). Bias in error estimation when using cross-validation for model selection. *BMC Bioinformatics*, 7, 91.
* Vovk, V., Gammerman, A., và Shafer, G. (2005). *Algorithmic Learning in a Random World*. Springer.
* Wilcoxon, F. (1945). Individual comparisons by ranking methods. *Biometrics Bulletin*, 1(6), 80–83.
* Willmott, C. J., và Matsuura, K. (2005). Advantages of the mean absolute error (MAE) over the root mean square error (RMSE) in assessing average model performance. *Climate Research*, 30, 79–82.

*Các trích dẫn nên được đối chiếu lại với nguồn gốc (số trang, năm) trước khi đưa vào danh mục tài liệu tham khảo của báo cáo.*
