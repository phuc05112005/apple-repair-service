import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import type { AppointmentDeviceRequest, PublicAppointmentResponse, PublicCatalogResponse, PublicRepairItemResponse, ServiceTypeCode } from '../../api/contracts'
import { publicApi } from '../../api/publicApi'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { businessDate, formatDate, formatDateTime, formatMoney, formatTime } from '../../utils/format'

const customerSchema = z.object({ customerFullName: z.string().trim().min(1, 'Vui lòng nhập họ tên.').max(255), phone: z.string().trim().min(1, 'Vui lòng nhập số điện thoại.').max(255), note: z.string().optional() })
type CustomerFields = z.infer<typeof customerSchema>
interface DraftDevice extends AppointmentDeviceRequest { label: string; issueLabel: string; serviceLabel: string; catalog: PublicCatalogResponse }
interface WarrantyCandidate { ticketCode: string; deviceModelName: string; item: PublicRepairItemResponse; remainingDays: number }
const serviceLabels: Record<ServiceTypeCode, string> = { REPAIR: 'Sửa chữa', REPLACEMENT: 'Thay thế linh kiện', WARRANTY: 'Bảo hành' }
const stepLabels = ['Thiết bị', 'Dịch vụ', 'Thông tin khách hàng', 'Chi nhánh & thời gian', 'Xác nhận']

export function BookingPage() {
  const [params] = useSearchParams()
  const location = useLocation()
  const initialWarrantySourceId = Number(params.get('warrantySourceItem')) || undefined
  const [bookingMode, setBookingMode] = useState<'repair' | 'warranty'>(initialWarrantySourceId ? 'warranty' : 'repair')
  const [warrantyPhone, setWarrantyPhone] = useState(() => (location.state as { warrantyPhone?: string } | null)?.warrantyPhone ?? '')
  const [lookupPhone, setLookupPhone] = useState(() => (location.state as { warrantyPhone?: string } | null)?.warrantyPhone ?? '')
  const [warrantySourceItemId, setWarrantySourceItemId] = useState<number>()
  const [warrantyDraft, setWarrantyDraft] = useState<{ deviceModelId: number; label: string; issueLabel: string; serviceLabel: string; catalog: PublicCatalogResponse }>()
  const [step, setStep] = useState(1)
  const [deviceTypeId, setDeviceTypeId] = useState<number | undefined>(() => Number(params.get('type')) || undefined)
  const [modelId, setModelId] = useState<number | undefined>(() => Number(params.get('model')) || undefined)
  const [issueId, setIssueId] = useState<number | undefined>(() => Number(params.get('issue')) || undefined)
  const [serviceId, setServiceId] = useState<number | undefined>(() => initialWarrantySourceId ? undefined : Number(params.get('service')) || undefined)
  const [serviceType, setServiceType] = useState<ServiceTypeCode>()
  const [partBrand, setPartBrand] = useState<string>()
  const [symptom, setSymptom] = useState('')
  const [devices, setDevices] = useState<DraftDevice[]>([])
  const [branchId, setBranchId] = useState<number>()
  const [date, setDate] = useState('')
  const [slotId, setSlotId] = useState<number>()
  const [success, setSuccess] = useState<PublicAppointmentResponse>()
  const types = useQuery({ queryKey: ['public', 'device-types'], queryFn: ({ signal }) => publicApi.deviceTypes(signal) })
  const models = useQuery({ queryKey: ['public', 'device-models', deviceTypeId], queryFn: ({ signal }) => publicApi.deviceModels(deviceTypeId, signal), enabled: Boolean(deviceTypeId) })
  const issues = useQuery({ queryKey: ['public', 'service-issues', deviceTypeId], queryFn: ({ signal }) => publicApi.serviceIssues(deviceTypeId, signal), enabled: Boolean(deviceTypeId) })
  const catalog = useQuery({ queryKey: ['public', 'catalog', modelId, issueId], queryFn: ({ signal }) => publicApi.catalog({ deviceModelId: modelId, serviceIssueId: issueId }, signal), enabled: Boolean(modelId && issueId) })
  const branches = useQuery({ queryKey: ['public', 'branches'], queryFn: ({ signal }) => publicApi.branches(signal), enabled: step >= 4 })
  const slots = useQuery({ queryKey: ['public', 'slots', branchId, date], queryFn: ({ signal }) => publicApi.slots(branchId!, date, signal), enabled: Boolean(branchId && date) })
  const form = useForm<CustomerFields>({ resolver: zodResolver(customerSchema), defaultValues: { customerFullName: '', phone: '', note: '' } })
  const warrantyCandidates = useQuery({
    queryKey: ['public', 'warranty-candidates', lookupPhone],
    enabled: bookingMode === 'warranty' && Boolean(lookupPhone),
    queryFn: async ({ signal }): Promise<WarrantyCandidate[]> => {
      const tickets = await publicApi.ticketsByPhone(lookupPhone, signal)
      const candidates = tickets.flatMap(ticket => ticket.repairItems
        .filter(item => item.warrantyEndDate !== null && item.warrantySourceItemId === null && item.warrantyRemedy !== null)
        .map(item => ({ ticket, item })))
      const checked = await Promise.all(candidates.map(async ({ ticket, item }) => ({
        ticketCode: ticket.ticketCode, deviceModelName: ticket.deviceModelName, item,
        eligibility: await publicApi.warrantyEligibility(lookupPhone, item.repairItemId, signal),
      })))
      return checked.filter(candidate => candidate.eligibility.eligible)
        .map(({ ticketCode, deviceModelName, item, eligibility }) => ({ ticketCode, deviceModelName, item, remainingDays: eligibility.remainingDays }))
    },
  })
  const warrantyCandidate = warrantyCandidates.data?.find(candidate => candidate.item.repairItemId === warrantySourceItemId)
  const create = useMutation({ mutationFn: publicApi.createAppointment, onSuccess: setSuccess })
  const selectedModel = models.data?.find(item => item.id === modelId)
  const selectedIssue = issues.data?.find(item => item.id === issueId)
  const selectedService = catalog.data?.find(item => item.id === serviceId)
  const effectiveServiceType = serviceType ?? selectedService?.serviceTypeCode
  const effectivePartBrand = partBrand ?? selectedService?.partBrand ?? undefined
  const allowedCatalog = (catalog.data ?? []).filter(item => item.serviceTypeCode !== 'WARRANTY')
  const serviceTypes = Array.from(new Set(allowedCatalog.map(item => item.serviceTypeCode)))
  const brands = Array.from(new Set(allowedCatalog.filter(item => item.serviceTypeCode === 'REPLACEMENT').map(item => item.partBrand).filter((brand): brand is string => Boolean(brand)))).sort((a, b) => a.localeCompare(b, 'vi'))
  const serviceOptions = allowedCatalog.filter(item => item.serviceTypeCode === effectiveServiceType && (effectiveServiceType !== 'REPLACEMENT' || item.partBrand === effectivePartBrand))
  const chosenBranch = branches.data?.find(item => item.id === branchId)
  const chosenSlot = slots.data?.find(item => item.slotId === slotId)
  const today = useMemo(() => businessDate(), [])
  const isWarrantyBooking = bookingMode === 'warranty'
  const warrantyStep = step > 1 ? step - 1 : step

  function resetService() { setServiceType(undefined); setPartBrand(undefined); setServiceId(undefined) }
  function resetDevice() { setDeviceTypeId(undefined); setModelId(undefined); setIssueId(undefined); resetService(); setSymptom('') }
  function switchMode(next: 'repair' | 'warranty') {
    setBookingMode(next)
    setWarrantySourceItemId(undefined)
    setDevices([])
    setWarrantyDraft(undefined)
    resetDevice()
    setStep(1)
  }
  function selectWarranty(candidate: WarrantyCandidate) {
    setWarrantySourceItemId(candidate.item.repairItemId)
    setDeviceTypeId(candidate.item.deviceTypeId)
    setModelId(candidate.item.deviceModelId)
    setIssueId(candidate.item.serviceIssueId)
    setServiceType(undefined)
    setServiceId(undefined)
    setPartBrand(undefined)
    setDevices([])
    form.setValue('phone', lookupPhone)
    const remedyType: ServiceTypeCode = candidate.item.warrantyRemedy === 'REPLACEMENT' ? 'REPLACEMENT' : 'REPAIR'
    const placeholderCatalog: PublicCatalogResponse = {
      id: candidate.item.serviceCatalogItemId, deviceModelId: candidate.item.deviceModelId,
      serviceIssueId: candidate.item.serviceIssueId, serviceTypeId: 0, serviceTypeCode: remedyType,
      serviceTypeName: serviceLabels[remedyType], partId: candidate.item.partId, partName: candidate.item.partName,
      partBrand: candidate.item.partBrand, partVariant: candidate.item.partVariant,
      name: candidate.item.name, configuredPrice: 0, displayPrice: 0, onlineDiscountPercent: 0,
      onlinePrice: 0, standardDurationMinutes: 0, warrantyDays: 0,
    }
    setWarrantyDraft({ deviceModelId: candidate.item.deviceModelId, label: candidate.deviceModelName,
      issueLabel: 'Bảo hành theo chính sách đã cấu hình', serviceLabel: 'Bảo hành miễn phí', catalog: placeholderCatalog })
    setDevices([{ deviceModelId: candidate.item.deviceModelId,
      serviceItems: [{ warrantySourceItemId: candidate.item.repairItemId }],
      label: candidate.deviceModelName, issueLabel: 'Bảo hành theo chính sách đã cấu hình',
      serviceLabel: 'Bảo hành miễn phí', catalog: placeholderCatalog }])
    setStep(2)
  }
  function addDevice() {
    if (!modelId || !issueId || !serviceId || !selectedModel || !selectedIssue || !selectedService) return
    const draft = { deviceModelId: modelId, symptomDescription: symptom.trim() || undefined, serviceItems: [{ serviceCatalogItemId: serviceId, warrantySourceItemId }], label: selectedModel.name, issueLabel: selectedIssue.name, serviceLabel: selectedService.name, catalog: selectedService }
    setDevices(current => bookingMode === 'warranty' ? [draft] : [...current, draft])
    if (bookingMode === 'repair') resetDevice()
  }
  async function submit() { if (!slotId || !devices.length || (bookingMode === 'warranty' && !warrantySourceItemId)) return; await create.mutateAsync({ ...form.getValues(), appointmentSlotId: slotId, devices: devices.map(({ deviceModelId: id, symptomDescription, serviceItems }) => ({ deviceModelId: id, symptomDescription, serviceItems })) }) }
  if (success) return <BookingSuccess appointment={success} />

  return <div className="page-shell booking-shell section-pad"><header className="page-intro page-intro--compact"><span className="eyebrow">{bookingMode === 'warranty' ? 'Đặt lịch bảo hành' : 'Đặt lịch sửa chữa'}</span><h1>Rõ ràng từng bước.<br />Thuận tiện từ đầu.</h1><p>Chọn dịch vụ phù hợp và theo dõi chi phí trước khi xác nhận lịch hẹn.</p></header>
    <div className="booking-mode-choice" role="group" aria-label="Hình thức đặt lịch"><button type="button" aria-pressed={bookingMode === 'repair'} className={bookingMode === 'repair' ? 'selected' : ''} onClick={() => switchMode('repair')}><span>01</span><strong>Sửa chữa / thay thế</strong><small>Chọn thiết bị và dịch vụ cần thực hiện</small></button><button type="button" aria-pressed={bookingMode === 'warranty'} className={bookingMode === 'warranty' ? 'selected' : ''} onClick={() => switchMode('warranty')}><span>02</span><strong>Bảo hành</strong><small>Tra cứu dịch vụ đã hoàn thành còn bảo hành</small></button></div>
    <ol className="stepper stepper--five" aria-label="Các bước đặt lịch">{(isWarrantyBooking ? ['Tra cứu bảo hành', 'Xác nhận bảo hành', 'Thông tin khách hàng', 'Chi nhánh & thời gian', 'Xác nhận'] : stepLabels).map((label, index) => { const stepNumber = isWarrantyBooking ? index === 0 ? 1 : index + 2 : index + 1; const isDone = isWarrantyBooking ? index === 0 ? step > 1 : warrantyStep > index + 1 : step > stepNumber; const isActive = isWarrantyBooking ? index === 0 ? step === 1 : warrantyStep === index + 1 : step === stepNumber; return <li key={label} aria-current={isActive ? 'step' : undefined} className={isActive ? 'active' : isDone ? 'done' : ''}><span>{isDone ? '✓' : String(index + 1).padStart(2, '0')}</span><p>{label}</p></li> })}</ol>
    <div className="booking-layout"><div className="booking-main">
      {step === 1 && bookingMode === 'warranty' && <section className="form-panel booking-step"><div className="panel-heading"><span>01</span><div><h2>Chọn hạng mục còn bảo hành</h2><p>Nhập số điện thoại đã dùng khi nhận máy. Dịch vụ sửa chữa hoặc thay thế sẽ theo chính sách gốc, không cần chọn lại dịch vụ.</p></div></div><form className="booking-warranty-search" onSubmit={event => { event.preventDefault(); setLookupPhone(warrantyPhone.trim()); setWarrantySourceItemId(undefined); setWarrantyDraft(undefined); setDevices([]) }}><label className="field"><span>Số điện thoại đã đăng ký</span><input type="tel" inputMode="tel" autoComplete="tel" placeholder="Nhập số điện thoại" value={warrantyPhone} onChange={event => setWarrantyPhone(event.target.value)} /></label><button className="button button--primary" disabled={!warrantyPhone.trim() || warrantyCandidates.isFetching}>Tra cứu bảo hành</button></form>{warrantyCandidates.isLoading && <LoadingState label="Đang kiểm tra các dịch vụ còn bảo hành…" />}{warrantyCandidates.isError && <ErrorState error={warrantyCandidates.error} retry={() => warrantyCandidates.refetch()} />}{lookupPhone && !warrantyCandidates.isLoading && !warrantyCandidates.isError && !warrantyCandidates.data?.length && <EmptyState title="Không tìm thấy dịch vụ còn bảo hành cho số điện thoại này" />}{Boolean(warrantyCandidates.data?.length) && <div className="booking-warranty-results"><p>Chọn hạng mục bảo hành muốn tiếp nhận:</p>{warrantyCandidates.data?.map(candidate => <button type="button" className={candidate.item.repairItemId === initialWarrantySourceId ? 'featured' : ''} key={candidate.item.repairItemId} onClick={() => selectWarranty(candidate)}><span><strong>{candidate.deviceModelName}</strong><small>{candidate.item.name} · Phiếu {candidate.ticketCode}</small></span><em>Còn {candidate.remainingDays} ngày <span aria-hidden="true">→</span></em></button>)}</div>}</section>}
      {bookingMode === 'warranty' && step === 2 && warrantyDraft && <section className="form-panel booking-step"><div className="panel-heading"><span>02</span><div><h2>Đặt lịch bảo hành</h2><p>Dịch vụ kỹ thuật được xác định theo chính sách sửa chữa/thay thế mà cửa hàng đã cấu hình.</p></div></div><div className="warranty-booking-card"><strong>{warrantyDraft.label}</strong><span>{warrantyDraft.issueLabel}</span><b>Bảo hành miễn phí · {warrantyCandidate?.item.warrantyRemedy === 'REPLACEMENT' ? 'Thay thế linh kiện' : 'Sửa chữa'}</b></div><div className="panel-actions"><button type="button" className="button button--quiet" onClick={() => setStep(1)}>Quay lại tra cứu</button><button type="button" className="button button--primary" onClick={() => setStep(3)}>Tiếp tục</button></div></section>}
      {step === 1 && bookingMode === 'repair' && <section className="form-panel booking-step"><div className="panel-heading"><span>01</span><div><h2>Chọn thiết bị</h2><p>Xác định loại thiết bị, model và vấn đề cần xử lý.</p></div></div><div className="form-grid form-grid--three"><FieldSelect label="Loại thiết bị" value={deviceTypeId} onChange={id => { setDeviceTypeId(id); setModelId(undefined); setIssueId(undefined); resetService() }} loading={types.isLoading} options={types.data} /><FieldSelect label="Model" value={modelId} onChange={id => { setModelId(id); setIssueId(undefined); resetService() }} loading={models.isLoading} disabled={!deviceTypeId} options={models.data} /><FieldSelect label="Vấn đề" value={issueId} onChange={id => { setIssueId(id); resetService() }} loading={issues.isLoading} disabled={!modelId} options={issues.data} /></div>{types.isError || models.isError || issues.isError ? <ErrorState error={types.error ?? models.error ?? issues.error} /> : null}<label className="field"><span>Mô tả thêm <i>Không bắt buộc</i></span><textarea value={symptom} onChange={event => setSymptom(event.target.value)} placeholder="Nhập mô tả tình trạng thiết bị" /></label><div className="panel-actions"><span /><button className="button button--primary" disabled={!modelId || !issueId} onClick={() => setStep(2)}>Chọn dịch vụ <span aria-hidden="true">→</span></button></div></section>}
      {step === 2 && bookingMode === 'repair' && <section className="form-panel booking-step"><div className="panel-heading"><span>02</span><div><h2>Chọn dịch vụ</h2><p>{selectedModel?.name} · {selectedIssue?.name}</p></div></div>{catalog.isLoading ? <LoadingState label="Đang tìm dịch vụ phù hợp…" /> : catalog.isError ? <ErrorState error={catalog.error} retry={() => catalog.refetch()} /> : !allowedCatalog.length ? <EmptyState title="Hiện chưa có dịch vụ phù hợp cho thiết bị và vấn đề đã chọn."><button className="text-action" onClick={() => setStep(1)}>Chọn lại thiết bị hoặc vấn đề</button></EmptyState> : <><fieldset className="choice-fieldset"><legend>Loại dịch vụ</legend><div className="service-type-choice">{serviceTypes.map(code => <button type="button" aria-pressed={effectiveServiceType === code} className={effectiveServiceType === code ? 'selected' : ''} key={code} onClick={() => { setServiceType(code); setPartBrand(undefined); setServiceId(undefined) }}><span>Loại dịch vụ</span><strong>{serviceLabels[code]}</strong></button>)}</div></fieldset>{effectiveServiceType === 'REPLACEMENT' && <><fieldset className="choice-fieldset"><legend>Hãng linh kiện</legend><div className="brand-choice">{brands.map(brand => <button type="button" aria-pressed={effectivePartBrand === brand} className={effectivePartBrand === brand ? 'selected' : ''} key={brand} onClick={() => { setPartBrand(brand); setServiceId(undefined) }}>{brand}</button>)}</div></fieldset>{effectivePartBrand && <ServiceOptionGrid options={serviceOptions} selectedId={serviceId} onSelect={setServiceId} />}</>}{effectiveServiceType && effectiveServiceType !== 'REPLACEMENT' && <ServiceOptionGrid options={serviceOptions} selectedId={serviceId} onSelect={setServiceId} />}</>}{selectedService && <ServiceSummary service={selectedService} />}
        <div className="panel-actions"><button className="button button--quiet" onClick={() => setStep(1)}>Quay lại</button><button className="button button--primary" disabled={!selectedService} onClick={() => { addDevice(); setStep(3) }}>Thêm vào lịch và tiếp tục</button></div></section>}
      {step === 3 && <form className="form-panel booking-step" onSubmit={form.handleSubmit(() => setStep(4))}><div className="panel-heading"><span>03</span><div><h2>Thông tin khách hàng</h2><p>{bookingMode === 'warranty' ? 'Số điện thoại được giữ đúng với dịch vụ đã tra cứu để xác minh bảo hành.' : 'Chỉ cần họ tên và số điện thoại để xác nhận, tra cứu.'}</p></div></div><div className="form-grid"><label className="field"><span>Họ và tên</span><input placeholder="Nhập họ và tên" autoComplete="name" aria-invalid={Boolean(form.formState.errors.customerFullName)} {...form.register('customerFullName')} />{form.formState.errors.customerFullName && <small role="alert">{form.formState.errors.customerFullName.message}</small>}</label><label className="field"><span>Số điện thoại</span><input readOnly={bookingMode === 'warranty'} placeholder="Nhập số điện thoại" inputMode="tel" autoComplete="tel" aria-invalid={Boolean(form.formState.errors.phone)} {...form.register('phone')} />{form.formState.errors.phone && <small role="alert">{form.formState.errors.phone.message}</small>}</label></div><label className="field"><span>Ghi chú lịch hẹn <i>Không bắt buộc</i></span><textarea placeholder="Nhập ghi chú cho lịch hẹn" {...form.register('note')} /></label><div className="panel-actions"><button type="button" className="button button--quiet" onClick={() => setStep(bookingMode === 'warranty' ? 2 : 2)}>Quay lại</button><button className="button button--primary">Tiếp tục</button></div></form>}
      {step === 4 && <section className="form-panel booking-step"><div className="panel-heading"><span>04</span><div><h2>Chi nhánh & thời gian</h2><p>Chọn nơi và thời điểm tiếp nhận phù hợp.</p></div></div>{branches.isLoading ? <LoadingState /> : branches.isError ? <ErrorState error={branches.error} retry={() => branches.refetch()} /> : <div className="branch-choice-grid">{branches.data?.map(branch => <button aria-pressed={branchId === branch.id} className={branchId === branch.id ? 'selected' : ''} key={branch.id} onClick={() => { setBranchId(branch.id); setSlotId(undefined) }}><strong>{branch.name}</strong><span>{branch.address}</span></button>)}</div>}<label className="field date-field"><span>Ngày tiếp nhận</span><input type="date" min={today} value={date} onChange={event => { setDate(event.target.value); setSlotId(undefined) }} /></label>{branchId && date && (slots.isLoading ? <LoadingState label="Đang tải khung giờ…" /> : slots.isError ? <ErrorState error={slots.error} retry={() => slots.refetch()} /> : !slots.data?.length ? <EmptyState title="Không có khung giờ mở trong ngày này" /> : <div className="slot-grid">{slots.data.map(slot => <button disabled={slot.status === 'CLOSED'} aria-pressed={slotId === slot.slotId} className={slotId === slot.slotId ? 'selected' : ''} key={slot.slotId} onClick={() => setSlotId(slot.slotId)}><strong>{formatTime(slot.startTime)} – {formatTime(slot.endTime)}</strong><span>{slot.status === 'CLOSED' ? 'Đã đóng' : `${slot.activeBookingCount} lượt đã đặt`}</span></button>)}</div>)}<div className="panel-actions"><button className="button button--quiet" onClick={() => setStep(3)}>Quay lại</button><button className="button button--primary" disabled={!slotId} onClick={() => setStep(5)}>Kiểm tra thông tin</button></div></section>}
      {step === 5 && <section className="form-panel booking-step"><div className="panel-heading"><span>05</span><div><h2>Xác nhận lịch hẹn</h2><p>Kiểm tra lần cuối trước khi gửi tới chi nhánh.</p></div></div><div className="review-grid"><article><span>Khách hàng</span><strong>{form.getValues('customerFullName')}</strong><p>{form.getValues('phone')}</p></article><article><span>Chi nhánh</span><strong>{chosenBranch?.name}</strong><p>{chosenSlot && `${formatDate(chosenSlot.slotDate)} · ${formatTime(chosenSlot.startTime)}–${formatTime(chosenSlot.endTime)}`}</p></article>{devices.map((device, index) => <article key={`${device.deviceModelId}-${index}`}><span>Thiết bị {index + 1}</span><strong>{device.label}</strong><p>{device.issueLabel} · {device.serviceLabel}</p></article>)}</div>{bookingMode === 'warranty' ? <div className="warranty-booking-card"><strong>{warrantyCandidate?.item.warrantyRemedy === 'REPLACEMENT' ? 'Bảo hành thay thế linh kiện' : 'Bảo hành sửa chữa'}</strong><span>Hạng mục bảo hành theo dịch vụ gốc còn hạn</span><b>Miễn phí phần bảo hành</b></div> : <BookingPriceBreakdown services={devices.map(device => device.catalog)} title="Chi phí dịch vụ khi đặt trực tuyến" />}{create.isError && <ErrorState error={create.error} />}<div className="panel-actions"><button className="button button--quiet" onClick={() => setStep(4)}>Quay lại</button><button className="button button--primary" disabled={create.isPending} onClick={submit}>{create.isPending ? 'Đang gửi…' : 'Xác nhận đặt lịch'}</button></div></section>}
    </div><BookingSummary devices={devices} selectedModel={selectedModel?.name} selectedIssue={selectedIssue?.name} selectedService={selectedService} branch={chosenBranch?.name} slot={chosenSlot} canAddAnother={bookingMode === 'repair'} onRemove={index => setDevices(items => items.filter((_, position) => position !== index))} onAddAnother={() => { resetDevice(); setStep(1) }} /></div>
  </div>
}

function FieldSelect<T extends { id: number; name: string }>({ label, value, onChange, options, disabled, loading }: { label: string; value?: number; onChange: (value: number) => void; options?: T[]; disabled?: boolean; loading?: boolean }) { return <label className="field"><span>{label}</span><select disabled={disabled || loading} value={value ?? ''} onChange={event => onChange(Number(event.target.value))}><option value="">{loading ? 'Đang tải…' : `Chọn ${label.toLowerCase()}`}</option>{options?.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label> }
type QuotedPrice = {
  displayPrice: number | null
  onlinePrice: number | null
  onlineDiscountPercent: number
}

const includedServiceNote = 'Giá đã bao gồm vệ sinh máy. Không cần thanh toán thêm nếu chỉ sử dụng đúng dịch vụ đã đặt.'

function BookingPriceBreakdown({ services, title, compact = false }: { services: QuotedPrice[]; title: string; compact?: boolean }) {
  if (!services.length) return null
  const knownPrices = services.every(service => service.displayPrice !== null && service.onlinePrice !== null)
  if (!knownPrices) return <div className="booking-price booking-price--unknown"><span className="booking-price__eyebrow">{title}</span><strong>Giá sẽ được xác nhận sau khi kiểm tra thiết bị</strong></div>
  const original = services.reduce((sum, service) => sum + (service.displayPrice ?? 0), 0)
  const final = services.reduce((sum, service) => sum + (service.onlinePrice ?? 0), 0)
  const discount = original - final
  const discountLabel = services.every(service => service.onlineDiscountPercent === services[0].onlineDiscountPercent)
    ? `Ưu đãi đặt lịch trực tuyến (${services[0].onlineDiscountPercent}%)`
    : 'Ưu đãi đặt lịch trực tuyến'

  return <div className={`booking-price${compact ? ' booking-price--compact' : ''}`}>
    <span className="booking-price__eyebrow">{title}</span>
    <div className="booking-price__row"><span>Giá dịch vụ</span><strong>{formatMoney(original)}</strong></div>
    <div className="booking-price__row booking-price__row--discount"><span>{discountLabel}</span><strong>−{formatMoney(discount)}</strong></div>
    <div className="booking-price__total"><span>Giá sau ưu đãi</span><strong>{formatMoney(final)}</strong></div>
    <p>{includedServiceNote}</p>
  </div>
}

function ServiceOptionGrid({ options, selectedId, onSelect }: { options: PublicCatalogResponse[]; selectedId?: number; onSelect: (id: number) => void }) {
  return <fieldset className="choice-fieldset"><legend>Phương án dịch vụ</legend><div className="catalog-choice-grid">{options.map(item => <button type="button" key={item.id} aria-pressed={selectedId === item.id} className={selectedId === item.id ? 'selected' : ''} onClick={() => onSelect(item.id)}>
    <span>{item.partVariant ?? item.partName ?? serviceLabels[item.serviceTypeCode]}</span>
    <strong>{item.name}</strong>
    {item.displayPrice !== null && item.onlinePrice !== null ? <span className="catalog-choice-price"><del>{formatMoney(item.displayPrice)}</del><b>{formatMoney(item.onlinePrice)}</b><em>Giảm {item.onlineDiscountPercent}% khi đặt trực tuyến</em></span> : <small>Giá xác nhận sau khi kiểm tra</small>}
    <small>{item.standardDurationMinutes ? `${item.standardDurationMinutes} phút` : 'Thời lượng sẽ được xác nhận'}</small>
  </button>)}</div></fieldset>
}

function ServiceSummary({ service }: { service: PublicCatalogResponse }) {
  return <div className="booking-service-detail">
    <div className="service-summary service-summary--booking"><div><span>Dịch vụ đã chọn</span><strong>{service.name}</strong></div>{service.partId && <div><span>Linh kiện</span><strong>{service.partBrand} · {service.partVariant}</strong></div>}<div><span>Thời lượng</span><strong>{service.standardDurationMinutes ? `${service.standardDurationMinutes} phút` : 'Xác nhận sau'}</strong></div><div><span>Bảo hành</span><strong>{service.warrantyDays ? `${service.warrantyDays} ngày` : 'Không áp dụng'}</strong></div></div>
    <BookingPriceBreakdown services={[service]} title="Giá khi đặt lịch trực tuyến" />
  </div>
}

function BookingSummary({ devices, selectedModel, selectedIssue, selectedService, branch, slot, canAddAnother, onRemove, onAddAnother }: { devices: DraftDevice[]; selectedModel?: string; selectedIssue?: string; selectedService?: PublicCatalogResponse; branch?: string; slot?: { slotDate: string; startTime: string; endTime: string }; canAddAnother: boolean; onRemove: (index: number) => void; onAddAnother: () => void }) {
  return <aside className="booking-summary" aria-label="Tóm tắt lịch hẹn"><span className="eyebrow">Tóm tắt</span><h2>Lịch hẹn của bạn</h2>{devices.length ? <div className="summary-devices">{devices.map((device, index) => <article key={`${device.deviceModelId}-${index}`}><div><span>Thiết bị {index + 1}</span><strong>{device.label}</strong><p>{device.issueLabel}</p><small>{device.serviceLabel}</small></div><button aria-label={`Xóa ${device.label} khỏi lịch`} onClick={() => onRemove(index)}>×</button></article>)}{canAddAnother && <button className="text-action" onClick={onAddAnother}>+ Thêm thiết bị khác</button>}</div> : <div className="summary-placeholder"><span aria-hidden="true">◇</span><p>{selectedModel ? `${selectedModel} · ${selectedIssue}` : 'Thiết bị và dịch vụ đã chọn sẽ xuất hiện tại đây.'}</p>{selectedService && <strong>{selectedService.name}</strong>}</div>}
    <BookingPriceBreakdown services={devices.length ? devices.map(device => device.catalog) : selectedService ? [selectedService] : []} title="Tạm tính" compact />
    <dl><div><dt>Chi nhánh</dt><dd>{branch ?? 'Chưa chọn'}</dd></div><div><dt>Thời gian</dt><dd>{slot ? `${formatDate(slot.slotDate)} · ${formatTime(slot.startTime)}–${formatTime(slot.endTime)}` : 'Chưa chọn'}</dd></div></dl>
  </aside>
}

function BookingSuccess({ appointment }: { appointment: PublicAppointmentResponse }) {
  const prices = appointment.devices.flatMap(device => device.services.map(service => ({ displayPrice: service.basePrice, onlinePrice: service.finalPrice, onlineDiscountPercent: appointment.discountPercent })))
  const warrantyBooking = appointment.devices.some(device => device.services.some(service => service.name.startsWith('Bảo hành · ')))
  return <div className="success-page section-pad"><div className="success-mark">✓</div><span className="eyebrow">Đã ghi nhận lịch hẹn</span><h1>Cảm ơn bạn. Chi nhánh sẽ xác nhận lịch.</h1><div className="success-ticket"><span>Mã lịch hẹn</span><strong>#{appointment.appointmentId}</strong><dl><div><dt>Chi nhánh</dt><dd>{appointment.branchName}</dd></div><div><dt>Thời gian</dt><dd>{formatDate(appointment.date)} · {formatTime(appointment.startTime)}–{formatTime(appointment.endTime)}</dd></div><div><dt>Trạng thái</dt><dd>Chờ xác nhận</dd></div><div><dt>Đặt lúc</dt><dd>{formatDateTime(appointment.bookedAt)}</dd></div></dl>{warrantyBooking ? <div className="warranty-booking-card"><strong>Lịch hẹn bảo hành đã ghi nhận</strong><span>Chi nhánh sẽ tiếp nhận theo chính sách của dịch vụ gốc.</span><b>Miễn phí phần bảo hành</b></div> : <BookingPriceBreakdown services={prices} title="Chi phí dịch vụ đã ghi nhận" />}</div><p>Dùng số điện thoại vừa đăng ký để tra cứu lịch hẹn và phiếu dịch vụ.</p><div className="button-row"><Link className="button button--primary" to="/lookup">Đi tới tra cứu</Link><Link className="button button--secondary" to="/">Về trang chủ</Link></div></div>
}
