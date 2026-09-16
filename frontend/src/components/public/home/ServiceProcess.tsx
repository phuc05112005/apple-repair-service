const steps = [
  ['Chọn thiết bị', 'Xác định loại thiết bị, model và vấn đề.'],
  ['Chọn dịch vụ', 'Xem đúng phương án đang có trong danh mục.'],
  ['Đặt lịch', 'Chọn chi nhánh và thời gian phù hợp.'],
  ['Tiếp nhận & kiểm tra', 'Ghi nhận tình trạng và kết quả kiểm tra.'],
  ['Sửa chữa / thay thế', 'Thực hiện phương án đã được phê duyệt.'],
  ['Thanh toán & bàn giao', 'Hoàn tất thanh toán, lịch sử và bảo hành.'],
]

export function ServiceProcess() {
  return <section className="studio-process section-pad studio-reveal">
    <header className="studio-section-heading"><span className="studio-kicker">Quy trình dịch vụ</span><h2>Sáu điểm chạm.<br />Một hành trình liền mạch.</h2><p>Mỗi bước được nối tiếp bằng dữ liệu đã ghi nhận, từ lịch hẹn đến bàn giao.</p></header>
    <ol className="studio-process__track">{steps.map(([title, description], index) => <li key={title}><div className="studio-process__marker"><span>{String(index + 1).padStart(2, '0')}</span><i /></div><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol>
  </section>
}
