import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { ServiceTypeCode } from '../../../api/contracts'
import { receptionistApi } from '../../../api/receptionistApi'
import { publicApi } from '../../../api/publicApi'
import { ErrorState, LoadingState } from '../../../components/AsyncState'
import { formatMoney } from '../../../utils/format'

const serviceTypeLabels: Record<ServiceTypeCode, string> = {
  REPAIR: 'Sửa chữa',
  REPLACEMENT: 'Thay thế linh kiện',
  WARRANTY: 'Bảo hành',
}

const keyOf = (value: string | null) => JSON.stringify(value)
const unique = <T,>(items: T[]) => [...new Set(items)]

export function IntakePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const initialAppointmentDeviceId = Number(params.get('appointmentDeviceId')) || undefined
  const [appointmentDeviceId, setAppointmentDeviceId] = useState<number | undefined>(initialAppointmentDeviceId)
  const [mode, setMode] = useState<'appointment' | 'walk-in'>(appointmentDeviceId ? 'appointment' : 'walk-in')
  const [changeBookedService, setChangeBookedService] = useState(false)
  const [serialNumber, setSerialNumber] = useState('')
  const [storage, setStorage] = useState('')
  const [condition, setCondition] = useState('')
  const [reportedIssue, setReportedIssue] = useState('')
  const [authorizedScope, setAuthorizedScope] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [branchId, setBranchId] = useState<number>()
  const [typeId, setTypeId] = useState<number>()
  const [modelId, setModelId] = useState<number>()
  const [issueId, setIssueId] = useState<number>()
  const [serviceType, setServiceType] = useState<ServiceTypeCode>()
  const [partName, setPartName] = useState('')
  const [partBrandKey, setPartBrandKey] = useState('')
  const [partVariantKey, setPartVariantKey] = useState('')
  const [serviceId, setServiceId] = useState<number>()

  const readyAppointments = useQuery({ queryKey: ['internal', 'appointments', 'ready-for-intake'], queryFn: ({ signal }) => receptionistApi.readyForIntake(signal), enabled: mode === 'appointment' })
  const readyDevices = (readyAppointments.isSuccess ? readyAppointments.data : []).flatMap(appointment => appointment.devices.map(entry => ({ appointment: appointment.appointment, entry })))
  const selectedBooking = readyDevices.find(option => option.entry.device.id === appointmentDeviceId)
  const appointmentModelId = selectedBooking?.entry.device.deviceModelId
  const appointmentCatalog = useQuery({ queryKey: ['public', 'catalog', appointmentModelId], queryFn: ({ signal }) => publicApi.catalog({ deviceModelId: appointmentModelId }, signal), enabled: mode === 'appointment' && Boolean(appointmentModelId) })
  const appointmentOptions = (appointmentCatalog.data ?? []).filter(item => item.serviceTypeCode === 'REPAIR' || item.serviceTypeCode === 'REPLACEMENT')
  const appointmentTypes = unique(appointmentOptions.map(item => item.serviceTypeCode))
  const appointmentTypeItems = appointmentOptions.filter(item => item.serviceTypeCode === serviceType)
  const appointmentPartNames = unique(appointmentTypeItems.filter(item => item.partId !== null).map(item => item.partName || item.name))
  const appointmentNamedParts = appointmentTypeItems.filter(item => (item.partName || item.name) === partName)
  const appointmentBrands = [...new Map(appointmentNamedParts.map(item => [keyOf(item.partBrand), item.partBrand])).entries()]
  const appointmentBrandedParts = appointmentNamedParts.filter(item => keyOf(item.partBrand) === partBrandKey)
  const appointmentVariants = [...new Map(appointmentBrandedParts.map(item => [keyOf(item.partVariant), item.partVariant])).entries()]
  const appointmentMatches = appointmentBrandedParts.filter(item => keyOf(item.partVariant) === partVariantKey)
  const appointmentServiceOptions = serviceType === 'REPLACEMENT' ? appointmentMatches : appointmentTypeItems
  const appointmentSelectedService = appointmentServiceOptions.find(item => item.id === serviceId) ?? (appointmentServiceOptions.length === 1 ? appointmentServiceOptions[0] : undefined)

  const branches = useQuery({ queryKey: ['public', 'branches'], queryFn: ({ signal }) => publicApi.branches(signal), enabled: mode === 'walk-in' })
  const types = useQuery({ queryKey: ['public', 'device-types'], queryFn: ({ signal }) => publicApi.deviceTypes(signal), enabled: mode === 'walk-in' })
  const models = useQuery({ queryKey: ['public', 'device-models', typeId], queryFn: ({ signal }) => publicApi.deviceModels(typeId, signal), enabled: mode === 'walk-in' && Boolean(typeId) })
  const issues = useQuery({ queryKey: ['public', 'service-issues', typeId], queryFn: ({ signal }) => publicApi.serviceIssues(typeId, signal), enabled: mode === 'walk-in' && Boolean(typeId) })
  const catalog = useQuery({ queryKey: ['public', 'catalog', modelId, issueId], queryFn: ({ signal }) => publicApi.catalog({ deviceModelId: modelId, serviceIssueId: issueId }, signal), enabled: mode === 'walk-in' && Boolean(modelId && issueId) })

  const catalogItems = (catalog.data ?? []).filter(item => item.serviceTypeCode === 'REPAIR' || item.serviceTypeCode === 'REPLACEMENT')
  const serviceTypes = unique(catalogItems.map(item => item.serviceTypeCode))
  const typeItems = catalogItems.filter(item => item.serviceTypeCode === serviceType)
  const replacementItems = typeItems.filter(item => item.partId !== null)
  const partNames = unique(replacementItems.map(item => item.partName || item.name))
  const namedParts = replacementItems.filter(item => (item.partName || item.name) === partName)
  const brandOptions = [...new Map(namedParts.map(item => [keyOf(item.partBrand), item.partBrand])).entries()]
  const brandedParts = namedParts.filter(item => keyOf(item.partBrand) === partBrandKey)
  const variantOptions = [...new Map(brandedParts.map(item => [keyOf(item.partVariant), item.partVariant])).entries()]
  const matchingParts = brandedParts.filter(item => keyOf(item.partVariant) === partVariantKey)
  const serviceOptions = serviceType === 'REPLACEMENT' ? matchingParts : typeItems
  const selectedService = serviceOptions.find(item => item.id === serviceId) ?? (serviceOptions.length === 1 ? serviceOptions[0] : undefined)
  const displayPrice = selectedService?.displayPrice

  function resetService() {
    setServiceType(undefined)
    setPartName('')
    setPartBrandKey('')
    setPartVariantKey('')
    setServiceId(undefined)
  }

  const create = useMutation({
    mutationFn: async () => mode === 'appointment'
      ? receptionistApi.intake(appointmentDeviceId!, {
        serialNumber: serialNumber || undefined,
        storage: storage || undefined,
        receivedCondition: condition,
        serviceCatalogItemIds: changeBookedService && appointmentSelectedService ? [appointmentSelectedService.id] : undefined,
      })
      : receptionistApi.walkIn({
        customerFullName: fullName.trim(),
        phone: phone.trim(),
        branchId: branchId!,
        deviceModelId: modelId!,
        serialNumber: serialNumber || undefined,
        storage: storage || undefined,
        receivedCondition: condition.trim(),
        customerReportedIssue: reportedIssue.trim() || undefined,
        authorizedScope: authorizedScope.trim() || undefined,
        serviceCatalogItemIds: [selectedService!.id],
      }),
    onSuccess: detail => navigate('/internal/receptionist/tickets/' + detail.ticket.id, { state: { created: true } }),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (valid) create.mutate()
  }

  const valid = Boolean(condition.trim() && (mode === 'appointment'
    ? selectedBooking && (!changeBookedService || appointmentSelectedService)
    : fullName.trim() && phone.trim() && branchId && modelId && issueId && selectedService))

  return <div className="workspace-page intake-page">
    <header>
      <span className="eyebrow">Tiếp nhận thiết bị</span>
      <h1>Tạo phiếu dịch vụ</h1>
      <p>Ghi nhận thiết bị từ lịch hẹn hoặc khách đến trực tiếp. Thời điểm tiếp nhận được lưu tự động khi tạo phiếu.</p>
    </header>

    <div className="segmented" aria-label="Hình thức tiếp nhận">
      <button type="button" className={mode === 'appointment' ? 'active' : ''} onClick={() => setMode('appointment')}>Từ lịch hẹn</button>
      <button type="button" className={mode === 'walk-in' ? 'active' : ''} onClick={() => setMode('walk-in')}>Khách đến trực tiếp</button>
    </div>

    <form className="ops-form intake-form" onSubmit={submit}>
      {mode === 'appointment' ? <><section className="intake-section">
        <div className="intake-section__heading"><span>01</span><div><h2>Thiết bị theo lịch hẹn</h2><p>Tiếp nhận thiết bị sau khi khách đã đến chi nhánh.</p></div></div>
        {readyAppointments.isLoading && <LoadingState label="Đang tải các lịch hẹn đã đến…" />}
        {readyAppointments.isError && <ErrorState error={readyAppointments.error} title="Chưa tải được lịch chờ tiếp nhận" description="Vui lòng tải lại danh sách. Nếu lỗi vẫn còn, bạn có thể kiểm tra trạng thái khách tại trang Lịch hẹn và thử lại sau." retry={() => readyAppointments.refetch()} />}
        {readyAppointments.isSuccess && readyDevices.length > 0 && <label className="field"><span>Chọn lịch hẹn và thiết bị đã đến</span><select value={appointmentDeviceId ?? ''} onChange={event => { setAppointmentDeviceId(Number(event.target.value) || undefined); setChangeBookedService(false); resetService() }}><option value="">Chọn khách đã đến để tiếp nhận</option>{readyAppointments.data.map(appointment => <optgroup key={appointment.appointment.id} label={`Lịch #${appointment.appointment.id} · ${appointment.appointment.customerFullName} · ${appointment.appointment.customerPhone}`}>{appointment.devices.map((entry, index) => <option key={entry.device.id} value={entry.device.id}>Thiết bị {index + 1} · {entry.serviceItems.map(item => item.serviceNameSnapshot).join(', ') || 'Chưa chọn dịch vụ'}</option>)}</optgroup>)}</select></label>}
        {readyAppointments.isSuccess && !readyDevices.length && <div className="intake-empty" role="status"><span className="intake-empty__icon" aria-hidden="true">✓</span><h3>Chưa có khách chờ tiếp nhận</h3><p>Lịch hẹn sẽ xuất hiện tại đây sau khi bạn ghi nhận <strong>Khách đã đến</strong>. Những thiết bị đã tiếp nhận sẽ tự rời khỏi danh sách.</p><div className="button-row"><Link className="button button--primary" to="/internal/receptionist/appointments">Xem lịch hẹn</Link><button type="button" className="button button--quiet" disabled={readyAppointments.isFetching} onClick={() => readyAppointments.refetch()}>{readyAppointments.isFetching ? 'Đang tải lại…' : 'Tải lại danh sách'}</button></div></div>}
        {selectedBooking && <div className="intake-booking-card"><strong>Lịch #{selectedBooking.appointment.id} · {selectedBooking.appointment.customerFullName}</strong><span>{selectedBooking.appointment.customerPhone}</span><p>Dịch vụ đã đặt: {selectedBooking.entry.serviceItems.map(item => item.serviceNameSnapshot).join(', ')}</p><small>Ưu đãi của lịch hẹn: {selectedBooking.appointment.discountPercent}%</small></div>}
      </section>
      {selectedBooking && <section className="intake-section intake-section--service">
        <div className="intake-section__heading"><span>02</span><div><h2>Phương án dịch vụ khi tiếp nhận</h2><p>Giữ dịch vụ đã đặt hoặc đổi giữa sửa chữa và thay thế theo yêu cầu của khách.</p></div></div>
        <div className="intake-choice-row"><button type="button" className={!changeBookedService ? 'selected' : ''} onClick={() => { setChangeBookedService(false); resetService() }}>Giữ dịch vụ đã đặt</button><button type="button" className={changeBookedService ? 'selected' : ''} onClick={() => setChangeBookedService(true)}>Đổi phương án dịch vụ</button></div>
        {changeBookedService && <div className="intake-service-picker">
          {appointmentCatalog.isLoading && <LoadingState label="Đang tải phương án dịch vụ…" />}
          {appointmentCatalog.isError && <ErrorState error={appointmentCatalog.error} retry={() => appointmentCatalog.refetch()} />}
          <label className="field"><span>Loại dịch vụ mới</span><select value={serviceType ?? ''} onChange={event => { setServiceType(event.target.value as ServiceTypeCode || undefined); setPartName(''); setPartBrandKey(''); setPartVariantKey(''); setServiceId(undefined) }}><option value="">Chọn sửa chữa hoặc thay thế</option>{appointmentTypes.map(type => <option key={type} value={type}>{serviceTypeLabels[type]}</option>)}</select></label>
          {serviceType === 'REPLACEMENT' && <div className="form-grid"><label className="field"><span>Loại linh kiện</span><select value={partName} onChange={event => { setPartName(event.target.value); setPartBrandKey(''); setPartVariantKey(''); setServiceId(undefined) }}><option value="">Chọn linh kiện</option>{appointmentPartNames.map(name => <option key={name} value={name}>{name}</option>)}</select></label><label className="field"><span>Hãng linh kiện</span><select disabled={!partName} value={partBrandKey} onChange={event => { setPartBrandKey(event.target.value); setPartVariantKey(''); setServiceId(undefined) }}><option value="">Chọn hãng</option>{appointmentBrands.map(([key, value]) => <option key={key} value={key}>{value || 'Chưa xác định hãng'}</option>)}</select></label><label className="field"><span>Phiên bản linh kiện</span><select disabled={!partBrandKey} value={partVariantKey} onChange={event => { setPartVariantKey(event.target.value); setServiceId(undefined) }}><option value="">Chọn phiên bản</option>{appointmentVariants.map(([key, value]) => <option key={key} value={key}>{value || 'Bản tiêu chuẩn'}</option>)}</select></label></div>}
          {serviceType && appointmentServiceOptions.length > 1 && <label className="field"><span>Dịch vụ cụ thể</span><select value={serviceId ?? ''} onChange={event => setServiceId(Number(event.target.value) || undefined)}><option value="">Chọn dịch vụ</option>{appointmentServiceOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
          {appointmentSelectedService && <div className="intake-price-card"><div><span>Dịch vụ mới</span><strong>{appointmentSelectedService.name}</strong></div><div><span>Giá sau ưu đãi {selectedBooking.appointment.discountPercent}%</span><strong>{appointmentSelectedService.displayPrice == null ? 'Xác nhận sau kiểm tra' : formatMoney(Math.round(appointmentSelectedService.displayPrice * (100 - selectedBooking.appointment.discountPercent)) / 100)}</strong><small>Ưu đãi của lịch hẹn được giữ khi đổi phương án.</small></div></div>}
        </div>}
      </section>}</> : <>
        <section className="intake-section">
          <div className="intake-section__heading"><span>01</span><div><h2>Khách hàng và thiết bị</h2><p>Chọn đúng dòng máy để xem các dịch vụ đã được cấu hình.</p></div></div>
          <div className="form-grid">
            <label className="field"><span>Họ tên khách hàng</span><input required placeholder="Nhập họ tên khách hàng" value={fullName} onChange={event => setFullName(event.target.value)} /></label>
            <label className="field"><span>Số điện thoại</span><input required type="tel" placeholder="Nhập số điện thoại" inputMode="tel" value={phone} onChange={event => setPhone(event.target.value)} /></label>
            <label className="field"><span>Chi nhánh tiếp nhận</span><select required value={branchId ?? ''} onChange={event => setBranchId(Number(event.target.value) || undefined)}><option value="">Chọn chi nhánh</option>{branches.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="field"><span>Loại thiết bị</span><select required value={typeId ?? ''} onChange={event => { setTypeId(Number(event.target.value) || undefined); setModelId(undefined); setIssueId(undefined); resetService() }}><option value="">Chọn loại thiết bị</option>{types.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="field"><span>Dòng máy</span><select required disabled={!typeId} value={modelId ?? ''} onChange={event => { setModelId(Number(event.target.value) || undefined); setIssueId(undefined); resetService() }}><option value="">Chọn dòng máy</option>{models.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="field"><span>Vấn đề khách gặp phải <i>Chọn để xem dịch vụ phù hợp</i></span><select disabled={!modelId} value={issueId ?? ''} onChange={event => { setIssueId(Number(event.target.value) || undefined); resetService() }}><option value="">Chọn vấn đề</option>{issues.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          </div>
          <div className="intake-notes-grid">
            <label className="field"><span>Vấn đề khách mô tả ban đầu</span><textarea placeholder="Nhập triệu chứng hoặc vấn đề khách gặp phải" maxLength={5000} value={reportedIssue} onChange={event => setReportedIssue(event.target.value)} /><small>Được lưu riêng với tình trạng thiết bị khi nhận và kết luận của kỹ thuật viên.</small></label>
            <label className="field"><span>Phạm vi khách cho phép trước <i>Không bắt buộc</i></span><textarea placeholder="Nhập phương án, giới hạn chi phí và điều kiện khách đã đồng ý khi giao máy" maxLength={5000} value={authorizedScope} onChange={event => setAuthorizedScope(event.target.value)} /><small>Kỹ thuật viên chỉ xử lý trong phạm vi này; phát sinh mới cần trao đổi lại với khách.</small></label>
          </div>
        </section>
        <section className="intake-section intake-section--service">
          <div className="intake-section__heading"><span>02</span><div><h2>Dịch vụ tiếp nhận</h2><p>Chọn ít nhất một dịch vụ đã được cấu hình trước khi tạo phiếu.</p></div></div>
          {catalog.isLoading && issueId && <LoadingState label="Đang tải dịch vụ phù hợp…" />}
          {catalog.isError && <ErrorState error={catalog.error} retry={() => catalog.refetch()} />}
          {issueId && !catalog.isLoading && !catalog.isError && !catalogItems.length && <p className="intake-hint" role="status">Chưa có dịch vụ phù hợp cho dòng máy và vấn đề này. Vui lòng nhờ quản trị viên cấu hình dịch vụ trước khi tiếp nhận.</p>}
          <label className="field">
            <span>Loại dịch vụ</span>
            <select required disabled={!issueId || catalog.isLoading || catalog.isError || !serviceTypes.length} value={serviceType ?? ''} onChange={event => { setServiceType(event.target.value as ServiceTypeCode || undefined); setPartName(''); setPartBrandKey(''); setPartVariantKey(''); setServiceId(undefined) }}>
              <option value="">Chọn sửa chữa hoặc thay thế</option>
              {serviceTypes.map(code => <option key={code} value={code}>{serviceTypeLabels[code]}</option>)}
            </select>
          </label>

          {serviceType === 'REPLACEMENT' && <div className="intake-part-options">
            <div className="intake-part-options__intro"><strong>Chọn linh kiện thay thế</strong><p>Danh sách chỉ gồm linh kiện đã gắn với dịch vụ của dòng máy này.</p></div>
            <div className="form-grid">
              <label className="field"><span>Loại linh kiện</span><select required value={partName} onChange={event => { setPartName(event.target.value); setPartBrandKey(''); setPartVariantKey(''); setServiceId(undefined) }}><option value="">Chọn loại linh kiện</option>{partNames.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
              <label className="field"><span>Hãng linh kiện</span><select required disabled={!partName} value={partBrandKey} onChange={event => { setPartBrandKey(event.target.value); setPartVariantKey(''); setServiceId(undefined) }}><option value="">Chọn hãng linh kiện</option>{brandOptions.map(([key, value]) => <option key={key} value={key}>{value || 'Chưa xác định hãng'}</option>)}</select></label>
              <label className="field"><span>Phiên bản linh kiện</span><select required disabled={!partBrandKey} value={partVariantKey} onChange={event => { setPartVariantKey(event.target.value); setServiceId(undefined) }}><option value="">Chọn phiên bản</option>{variantOptions.map(([key, value]) => <option key={key} value={key}>{value || 'Bản tiêu chuẩn'}</option>)}</select></label>
            </div>
          </div>}

          {serviceType && serviceType !== 'REPLACEMENT' && <label className="field"><span>Dịch vụ phù hợp</span><select required value={selectedService?.id ?? ''} onChange={event => setServiceId(Number(event.target.value) || undefined)}><option value="">Chọn dịch vụ</option>{serviceOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
          {serviceType === 'REPLACEMENT' && matchingParts.length > 1 && <label className="field"><span>Phương án dịch vụ</span><select required value={selectedService?.id ?? ''} onChange={event => setServiceId(Number(event.target.value) || undefined)}><option value="">Chọn phương án</option>{matchingParts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}

          {selectedService && <div className="intake-price-card" aria-live="polite">
            <div><span>{serviceType === 'REPLACEMENT' ? 'Linh kiện và dịch vụ đã chọn' : 'Dịch vụ đã chọn'}</span><strong>{selectedService.name}</strong>{serviceType === 'REPLACEMENT' && <small>{[selectedService.partName, selectedService.partBrand, selectedService.partVariant].filter(Boolean).join(' · ')}</small>}</div>
            <div><span>{serviceType === 'REPAIR' ? 'Giá sửa chữa dự kiến' : 'Giá dịch vụ dự kiến'}</span><strong>{displayPrice != null ? formatMoney(displayPrice) : 'Chưa thiết lập giá'}</strong><small>{displayPrice != null ? 'Giá được ghi vào phiếu khi tiếp nhận.' : 'Giá sẽ được xác nhận sau khi kiểm tra.'}</small></div>
          </div>}
        </section>
      </>}

      {(mode === 'walk-in' || selectedBooking) && <section className="intake-section">
        <div className="intake-section__heading"><span>03</span><div><h2>Thông tin khi nhận máy</h2><p>Ghi nhận tình trạng ban đầu để đối chiếu trong quá trình xử lý.</p></div></div>
        <div className="form-grid">
          <label className="field"><span>Số sê-ri <i>Không bắt buộc</i></span><input placeholder="Nhập số sê-ri thiết bị" maxLength={255} value={serialNumber} onChange={event => setSerialNumber(event.target.value)} /></label>
          <label className="field"><span>Dung lượng lưu trữ <i>Không bắt buộc</i></span><input placeholder="Nhập dung lượng lưu trữ" maxLength={255} value={storage} onChange={event => setStorage(event.target.value)} /></label>
        </div>
        <label className="field"><span>Tình trạng khi tiếp nhận</span><textarea placeholder="Nhập tình trạng máy và phụ kiện khách giao kèm" required maxLength={5000} value={condition} onChange={event => setCondition(event.target.value)} /></label>
      </section>}

      {create.isError && <ErrorState error={create.error} />}
      {(mode === 'walk-in' || selectedBooking) && <div className="panel-actions"><button className="button button--primary" disabled={!valid || create.isPending}>{create.isPending ? 'Đang tạo phiếu…' : 'Tạo phiếu dịch vụ'}</button></div>}
    </form>
  </div>
}
