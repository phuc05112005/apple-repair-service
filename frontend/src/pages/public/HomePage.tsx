import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { publicApi } from '../../api/publicApi'
import { ErrorState, LoadingState } from '../../components/AsyncState'

export function HomePage() {
  const devices = useQuery({ queryKey: ['public', 'device-types'], queryFn: ({ signal }) => publicApi.deviceTypes(signal) })
  const branches = useQuery({ queryKey: ['public', 'branches'], queryFn: ({ signal }) => publicApi.branches(signal) })
  return <>
    <section className="hero section-pad">
      <div className="hero-copy">
        <span className="eyebrow">Dịch vụ kỹ thuật, rõ ràng từ đầu</span>
        <h1>Thiết bị của bạn,<br /><em>được chăm sóc đúng cách.</em></h1>
        <p>Chọn đúng dịch vụ, đặt lịch thuận tiện và theo dõi tiến trình sửa chữa trong một trải nghiệm liền mạch.</p>
        <div className="button-row"><Link className="button button--primary" to="/booking">Đặt lịch sửa chữa</Link><Link className="button button--secondary" to="/lookup">Tra cứu tiến trình</Link></div>
        <dl className="trust-strip"><div><dt>01</dt><dd>Chẩn đoán rõ ràng</dd></div><div><dt>02</dt><dd>Phê duyệt trước khi sửa</dd></div><div><dt>03</dt><dd>Theo dõi từng trạng thái</dd></div></dl>
      </div>
      <div className="device-stage" aria-label="Minh họa thiết bị trong khu vực kiểm tra kỹ thuật">
        <div className="stage-grid" aria-hidden="true" />
        <div className="device-silhouette" aria-hidden="true"><span /><i /></div>
        <div className="inspection-chip chip-one"><span>01</span> Kiểm tra</div>
        <div className="inspection-chip chip-two"><span>02</span> Xử lý</div>
        <p className="stage-caption">MÔ PHỎNG TĨNH · SẴN SÀNG CHO 3D KHI CÓ ASSET ĐƯỢC CẤP PHÉP</p>
      </div>
    </section>

    <section className="device-band section-pad">
      <div className="section-heading"><span className="eyebrow">Thiết bị hỗ trợ</span><h2>Bắt đầu từ thiết bị bạn đang dùng.</h2><Link to="/devices">Khám phá dịch vụ <span aria-hidden="true">→</span></Link></div>
      {devices.isLoading ? <LoadingState /> : devices.isError ? <ErrorState error={devices.error} retry={() => devices.refetch()} /> :
        <div className="device-name-grid">{devices.data?.map((device, index) => <Link key={device.id} to={`/devices?type=${device.id}`}><span>0{index + 1}</span><strong>{device.name}</strong><i aria-hidden="true">↗</i></Link>)}</div>}
    </section>

    <section className="process section-pad">
      <div className="section-heading"><span className="eyebrow">Một quy trình có thể theo dõi</span><h2>Mỗi bước đều có lý do.</h2></div>
      <ol className="process-list"><li><span>01</span><h3>Đặt lịch</h3><p>Chọn thiết bị, nhu cầu và thời gian phù hợp.</p></li><li><span>02</span><h3>Tiếp nhận & kiểm tra</h3><p>Kỹ thuật viên đánh giá và đề xuất phương án.</p></li><li><span>03</span><h3>Sửa chữa</h3><p>Chỉ thực hiện theo phương án đã được phê duyệt.</p></li><li><span>04</span><h3>Bàn giao</h3><p>Hoàn tất thanh toán và nhận thông tin bảo hành.</p></li></ol>
    </section>

    <section className="tracking-panel section-pad"><div><span className="eyebrow">Tra cứu dịch vụ</span><h2>Thiết bị của bạn đang được xử lý đến đâu?</h2><p>Dùng số điện thoại đã đăng ký để xem các phiếu đang xử lý và lịch sử đã hoàn tất.</p></div><Link className="button button--light" to="/lookup">Tra cứu tiến trình</Link></section>

    <section className="branches-section section-pad"><div className="section-heading"><span className="eyebrow">Mạng lưới tiếp nhận</span><h2>Chọn chi nhánh ở cuối quy trình đặt lịch.</h2><p>Thông tin dưới đây được tải trực tiếp từ hệ thống.</p></div>{branches.isLoading ? <LoadingState /> : branches.isError ? <ErrorState error={branches.error} retry={() => branches.refetch()} /> : <div className="branch-grid">{branches.data?.map(branch => <article key={branch.id}><span className="map-dot" /><h3>{branch.name}</h3><p>{branch.address}</p><a href={`tel:${branch.phone}`}>{branch.phone}</a></article>)}</div>}</section>
  </>
}
