import { useQuery } from '@tanstack/react-query'
import { publicApi } from '../../api/publicApi'
import { PremiumHero } from '../../components/public/home/PremiumHero'
import { DeviceShowcase } from '../../components/public/home/DeviceShowcase'
import { ServiceEditorial } from '../../components/public/home/ServiceEditorial'
import { ServiceProcess } from '../../components/public/home/ServiceProcess'
import { TransparencySection } from '../../components/public/home/TransparencySection'
import { FinalCta } from '../../components/public/home/FinalCta'

export function HomePage() {
  const devices = useQuery({ queryKey: ['public', 'device-types'], queryFn: ({ signal }) => publicApi.deviceTypes(signal) })
  const issues = useQuery({ queryKey: ['public', 'service-issues'], queryFn: ({ signal }) => publicApi.serviceIssues(signal) })
  const catalog = useQuery({ queryKey: ['public', 'catalog', 'landing'], queryFn: ({ signal }) => publicApi.catalog({}, signal) })
  const branches = useQuery({ queryKey: ['public', 'branches'], queryFn: ({ signal }) => publicApi.branches(signal) })

  return <div className="studio-home">
    <PremiumHero />
    <section className="studio-principles section-pad" aria-label="Giá trị dịch vụ">
      <p>Chăm sóc kỹ thuật độc lập cho thiết bị bạn sử dụng mỗi ngày.</p>
      <ul><li>Tư vấn trước khi sửa</li><li>Chi phí được ghi nhận</li><li>Lịch sử có thể tra cứu</li></ul>
    </section>
    <DeviceShowcase query={devices} />
    <ServiceEditorial issues={issues} catalog={catalog} />
    <ServiceProcess />
    <TransparencySection />
    <section className="studio-branches section-pad studio-reveal">
      <header className="studio-section-heading studio-section-heading--split">
        <div><span className="studio-kicker">Mạng lưới tiếp nhận</span><h2>Một điểm đến rõ ràng<br />cho từng lịch hẹn.</h2></div>
        <p>Chi nhánh hiển thị từ hệ thống vận hành. Bạn chọn địa điểm và khung giờ phù hợp khi đặt lịch.</p>
      </header>
      {branches.isLoading ? <div className="studio-loading">Đang tải chi nhánh…</div> : branches.isError ? <div className="studio-error">Không thể tải danh sách chi nhánh.</div> : <div className="studio-branch-list">{branches.data?.map((branch, index) => <article key={branch.id}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{branch.name}</h3><p>{branch.address}</p></div><a href={`tel:${branch.phone}`}>{branch.phone}<i aria-hidden="true">↗</i></a></article>)}</div>}
    </section>
    <FinalCta />
  </div>
}
