import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ServiceTypeCode } from '../../../api/contracts'
import { receptionistApi } from '../../../api/receptionistApi'
import { publicApi } from '../../../api/publicApi'
import { ErrorState, LoadingState } from '../../../components/AsyncState'
import { formatMoney } from '../../../utils/format'

const serviceTypeLabels: Record<ServiceTypeCode, string> = {
  REPAIR: 'Sửa chữa',
  REPLACEMENT: 'Thay thế linh kiện',
  INSPECTION: 'Kiểm tra / tư vấn',
  WARRANTY: 'Bảo hành',
}

const keyOf = (value: string | null) => JSON.stringify(value)
const unique = <T,>(items: T[]) => [...new Set(items)]

export function IntakePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const appointmentDeviceId = Number(params.get('appointmentDeviceId')) || undefined
  const [mode, setMode] = useState<'appointment' | 'walk-in'>(appointmentDeviceId ? 'appointment' : 'walk-in')
  const [serialNumber, setSerialNumber] = useState('')
  const [storage, setStorage] = useState('')
  const [condition, setCondition] = useState('')
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

  const branches = useQuery({ queryKey: ['public', 'branches'], queryFn: ({ signal }) => publicApi.branches(signal), enabled: mode === 'walk-in' })
  const types = useQuery({ queryKey: ['public', 'device-types'], queryFn: ({ signal }) => publicApi.deviceTypes(signal), enabled: mode === 'walk-in' })
  const models = useQuery({ queryKey: ['public', 'device-models', typeId], queryFn: ({ signal }) => publicApi.deviceModels(typeId, signal), enabled: mode === 'walk-in' && Boolean(typeId) })
  const issues = useQuery({ queryKey: ['public', 'service-issues', typeId], queryFn: ({ signal }) => publicApi.serviceIssues(typeId, signal), enabled: mode === 'walk-in' && Boolean(typeId) })
  const catalog = useQuery({ queryKey: ['public', 'catalog', modelId, issueId], queryFn: ({ signal }) => publicApi.catalog({ deviceModelId: modelId, serviceIssueId: issueId }, signal), enabled: mode === 'walk-in' && Boolean(modelId && issueId) })

  const catalogItems = catalog.data ?? []
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
  const displayPrice = selectedService && (serviceType === 'REPLACEMENT' ? selectedService.displayPrice : selectedService.configuredPrice)

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
      })
      : receptionistApi.walkIn({
        customerFullName: fullName.trim(),
        phone: phone.trim(),
        branchId: branchId!,
        deviceModelId: modelId!,
        serialNumber: serialNumber || undefined,
        storage: storage || undefined,
        receivedCondition: condition.trim(),
        serviceCatalogItemIds: selectedService ? [selectedService.id] : undefined,
      }),
    onSuccess: detail => navigate('/internal/receptionist/tickets/' + detail.ticket.id, { state: { created: true } }),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (valid) create.mutate()
  }

  const valid = Boolean(condition.trim() && (mode === 'appointment'
    ? appointmentDeviceId
    : fullName.trim() && phone.trim() && branchId && modelId && (!serviceType || selectedService)))

  return <div className="workspace-page intake-page">
    <header>
      <span className="eyebrow">Tiếp nhận thiết bị</span>
      <h1>Tạo phiếu dịch vụ</h1>
      <p>Ghi nhận thiết bị từ lịch hẹn hoặc tiếp nhận khách đến trực tiếp tại chi nhánh.</p>
    </header>

    <div className="segmented" aria-label="Hình thức tiếp nhận">
      <button type="button" className={mode === 'appointment' ? 'active' : ''} onClick={() => setMode('appointment')}>Từ lịch hẹn</button>
      <button type="button" className={mode === 'walk-in' ? 'active' : ''} onClick={() => setMode('walk-in')}>Khách đến trực tiếp</button>
    </div>

    <form className="ops-form intake-form" onSubmit={submit}>
      {mode === 'appointment' ? <section className="intake-section">
        <div className="intake-section__heading"><span>01</span><div><h2>Thiết bị theo lịch hẹn</h2><p>Tiếp nhận thiết bị sau khi khách đã đến chi nhánh.</p></div></div>
        <label className="field">
          <span>Mã thiết bị trong lịch hẹn</span>
          <input readOnly value={appointmentDeviceId ?? ''} placeholder="Mở từ lịch hẹn đã ghi nhận khách đến" />
        </label>
        {!appointmentDeviceId && <p className="intake-hint">Hãy mở lịch hẹn đã ghi nhận khách đến rồi chọn “Tiếp nhận thiết bị này”.</p>}
      </section> : <>
        <section className="intake-section">
          <div className="intake-section__heading"><span>01</span><div><h2>Khách hàng và thiết bị</h2><p>Chọn đúng dòng máy để xem các dịch vụ đã được cấu hình.</p></div></div>
          <div className="form-grid">
            <label className="field"><span>Họ tên khách hàng</span><input required placeholder="Nhập họ tên khách hàng" value={fullName} onChange={event => setFullName(event.target.value)} /></label>
            <label className="field"><span>Số điện thoại</span><input required type="tel" placeholder="Ví dụ: 0901234567" inputMode="tel" value={phone} onChange={event => setPhone(event.target.value)} /></label>
            <label className="field"><span>Chi nhánh tiếp nhận</span><select required value={branchId ?? ''} onChange={event => setBranchId(Number(event.target.value) || undefined)}><option value="">Chọn chi nhánh</option>{branches.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="field"><span>Loại thiết bị</span><select required value={typeId ?? ''} onChange={event => { setTypeId(Number(event.target.value) || undefined); setModelId(undefined); setIssueId(undefined); resetService() }}><option value="">Chọn loại thiết bị</option>{types.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="field"><span>Dòng máy</span><select required disabled={!typeId} value={modelId ?? ''} onChange={event => { setModelId(Number(event.target.value) || undefined); setIssueId(undefined); resetService() }}><option value="">Chọn dòng máy</option>{models.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="field"><span>Vấn đề khách gặp phải <i>Chọn để xem dịch vụ phù hợp</i></span><select disabled={!modelId} value={issueId ?? ''} onChange={event => { setIssueId(Number(event.target.value) || undefined); resetService() }}><option value="">Chọn vấn đề</option>{issues.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          </div>
        </section>

        <section className="intake-section intake-section--service">
          <div className="intake-section__heading"><span>02</span><div><h2>Dịch vụ dự kiến</h2><p>Có thể để trống và xác định dịch vụ sau khi kỹ thuật viên kiểm tra.</p></div></div>
          {catalog.isLoading && issueId && <LoadingState label="Đang tải dịch vụ phù hợp…" />}
          {catalog.isError && <ErrorState error={catalog.error} retry={() => catalog.refetch()} />}
          {issueId && !catalog.isLoading && !catalog.isError && !catalogItems.length && <p className="intake-hint">Chưa có dịch vụ được cấu hình cho dòng máy và vấn đề này. Bạn vẫn có thể tạo phiếu để kiểm tra thiết bị.</p>}
          <label className="field">
            <span>Loại dịch vụ <i>Không bắt buộc</i></span>
            <select disabled={!issueId || catalog.isLoading || catalog.isError || !serviceTypes.length} value={serviceType ?? ''} onChange={event => { setServiceType(event.target.value as ServiceTypeCode || undefined); setPartName(''); setPartBrandKey(''); setPartVariantKey(''); setServiceId(undefined) }}>
              <option value="">Chưa chọn dịch vụ</option>
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
            <div><span>{serviceType === 'REPAIR' ? 'Giá sửa chữa đã thiết lập' : 'Giá dịch vụ dự kiến'}</span><strong>{displayPrice != null ? formatMoney(displayPrice) : 'Chưa thiết lập giá'}</strong><small>{displayPrice != null ? 'Giá được ghi vào phiếu khi tiếp nhận.' : 'Giá sẽ được xác nhận sau khi kiểm tra.'}</small></div>
          </div>}
        </section>
      </>}

      <section className="intake-section">
        <div className="intake-section__heading"><span>{mode === 'walk-in' ? '03' : '02'}</span><div><h2>Thông tin khi nhận máy</h2><p>Ghi nhận tình trạng ban đầu để đối chiếu trong quá trình xử lý.</p></div></div>
        <div className="form-grid">
          <label className="field"><span>Số sê-ri <i>Không bắt buộc</i></span><input placeholder="Ví dụ: F2LX…" maxLength={255} value={serialNumber} onChange={event => setSerialNumber(event.target.value)} /></label>
          <label className="field"><span>Dung lượng lưu trữ <i>Không bắt buộc</i></span><input placeholder="Ví dụ: 128 GB" maxLength={255} value={storage} onChange={event => setStorage(event.target.value)} /></label>
        </div>
        <label className="field"><span>Tình trạng khi tiếp nhận</span><textarea placeholder="Mô tả ngoại quan, lỗi hiện tại và phụ kiện khách giao kèm" required maxLength={5000} value={condition} onChange={event => setCondition(event.target.value)} /></label>
      </section>

      {create.isError && <ErrorState error={create.error} />}
      <div className="panel-actions"><button className="button button--primary" disabled={!valid || create.isPending}>{create.isPending ? 'Đang tạo phiếu…' : 'Tạo phiếu dịch vụ'}</button></div>
    </form>
  </div>
}
