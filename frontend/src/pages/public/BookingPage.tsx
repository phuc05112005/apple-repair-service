import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import type { AppointmentDeviceRequest, PublicAppointmentResponse, ServiceTypeCode } from '../../api/contracts'
import { publicApi } from '../../api/publicApi'
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState'
import { formatDate, formatMoney, formatTime } from '../../utils/format'

const customerSchema = z.object({
  customerFullName: z.string().trim().min(1, 'Vui lòng nhập họ tên.').max(255),
  phone: z.string().trim().min(1, 'Vui lòng nhập số điện thoại.').max(255),
  note: z.string().optional(),
})
type CustomerFields = z.infer<typeof customerSchema>
interface DraftDevice extends AppointmentDeviceRequest { label: string; serviceLabel: string }
const serviceLabels: Record<ServiceTypeCode, string> = { REPAIR: 'Sửa chữa', REPLACEMENT: 'Thay thế', INSPECTION: 'Kiểm tra / Tư vấn', WARRANTY: 'Bảo hành' }

export function BookingPage() {
  const [params] = useSearchParams()
  const [step, setStep] = useState(1)
  const [deviceTypeId, setDeviceTypeId] = useState<number | undefined>(() => Number(params.get('type')) || undefined)
  const [modelId, setModelId] = useState<number | undefined>(() => Number(params.get('model')) || undefined)
  const [issueId, setIssueId] = useState<number | undefined>(() => Number(params.get('issue')) || undefined)
  const [serviceId, setServiceId] = useState<number | undefined>(() => Number(params.get('service')) || undefined)
  const [serviceType, setServiceType] = useState<ServiceTypeCode>()
  const [partBrand, setPartBrand] = useState<string>()
  const warrantySourceItemId = Number(params.get('warrantySourceItem')) || undefined
  const [symptom, setSymptom] = useState('')
  const [devices, setDevices] = useState<DraftDevice[]>([])
  const [branchId, setBranchId] = useState<number>()
  const [date, setDate] = useState('')
  const [slotId, setSlotId] = useState<number>()
  const [success, setSuccess] = useState<PublicAppointmentResponse>()

  const types = useQuery({ queryKey: ['public', 'device-types'], queryFn: ({ signal }) => publicApi.deviceTypes(signal) })
  const models = useQuery({ queryKey: ['public', 'device-models', deviceTypeId], queryFn: ({ signal }) => publicApi.deviceModels(deviceTypeId, signal), enabled: Boolean(deviceTypeId) })
  const issues = useQuery({ queryKey: ['public', 'service-issues'], queryFn: ({ signal }) => publicApi.serviceIssues(signal) })
  const catalog = useQuery({ queryKey: ['public', 'catalog', modelId, issueId], queryFn: ({ signal }) => publicApi.catalog({ deviceModelId: modelId, serviceIssueId: issueId }, signal), enabled: Boolean(modelId && issueId) })
  const branches = useQuery({ queryKey: ['public', 'branches'], queryFn: ({ signal }) => publicApi.branches(signal), enabled: step >= 3 })
  const slots = useQuery({ queryKey: ['public', 'slots', branchId, date], queryFn: ({ signal }) => publicApi.slots(branchId!, date, signal), enabled: Boolean(branchId && date) })
  const form = useForm<CustomerFields>({ resolver: zodResolver(customerSchema), defaultValues: { customerFullName: '', phone: '', note: '' } })
  const create = useMutation({ mutationFn: publicApi.createAppointment, onSuccess: setSuccess })
  const selectedModel = models.data?.find(item => item.id === modelId)
  const selectedService = catalog.data?.find(item => item.id === serviceId)
  const effectiveServiceType = serviceType ?? selectedService?.serviceTypeCode
  const effectivePartBrand = partBrand ?? selectedService?.partBrand ?? undefined
  const serviceTypes = useMemo(() => Array.from(new Map((catalog.data ?? []).filter(item => item.serviceTypeCode !== 'WARRANTY' || warrantySourceItemId).map(item => [item.serviceTypeCode, item.serviceTypeName])).entries()), [catalog.data, warrantySourceItemId])
  const brands = useMemo(() => Array.from(new Set((catalog.data ?? []).filter(item => item.serviceTypeCode === 'REPLACEMENT').map(item => item.partBrand).filter((brand): brand is string => Boolean(brand)))), [catalog.data])
  const serviceOptions = (catalog.data ?? []).filter(item => item.serviceTypeCode === effectiveServiceType && (effectiveServiceType !== 'REPLACEMENT' || item.partBrand === effectivePartBrand))
  const chosenBranch = branches.data?.find(item => item.id === branchId)
  const chosenSlot = slots.data?.find(item => item.slotId === slotId)
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  function resetService() { setServiceType(undefined); setPartBrand(undefined); setServiceId(undefined) }
  function addDevice() {
    if (!modelId || !serviceId || !selectedModel || !selectedService) return
    setDevices(current => [...current, { deviceModelId: modelId, symptomDescription: symptom.trim() || undefined, serviceItems: [{ serviceCatalogItemId: serviceId, warrantySourceItemId }], label: selectedModel.name, serviceLabel: selectedService.name }])
    setDeviceTypeId(undefined); setModelId(undefined); setIssueId(undefined); resetService(); setSymptom('')
  }
  async function submit() {
    if (!slotId || !devices.length) return
    await create.mutateAsync({ ...form.getValues(), appointmentSlotId: slotId, devices: devices.map(({ deviceModelId: id, symptomDescription, serviceItems }) => ({ deviceModelId: id, symptomDescription, serviceItems })) })
  }
  if (success) return <BookingSuccess appointment={success} />

  return <div className="page-shell booking-shell section-pad"><header className="page-intro page-intro--compact"><span className="eyebrow">{warrantySourceItemId ? 'Đặt lịch bảo hành' : 'Đặt lịch sửa chữa'}</span><h1>Một lịch hẹn, đủ thông tin cần thiết.</h1></header>
    <ol className="stepper" aria-label="Các bước đặt lịch">{['Thiết bị & dịch vụ', 'Thông tin khách hàng', 'Chi nhánh & thời gian', 'Xác nhận'].map((label, index) => <li key={label} className={step === index + 1 ? 'active' : step > index + 1 ? 'done' : ''}><span>{step > index + 1 ? '✓' : index + 1}</span><p>{label}</p></li>)}</ol>
    {step === 1 && <section className="form-panel"><div className="panel-heading"><span>01</span><div><h2>Thiết bị & dịch vụ</h2><p>Chọn theo thứ tự để backend xác định đúng catalog item.</p></div></div>
      {devices.length > 0 && <div className="draft-list">{devices.map((device, index) => <div key={`${device.deviceModelId}-${index}`}><span>{index + 1}</span><div><strong>{device.label}</strong><p>{device.serviceLabel}</p></div><button onClick={() => setDevices(items => items.filter((_, i) => i !== index))}>Xóa</button></div>)}</div>}
      <div className="form-grid form-grid--four"><FieldSelect label="Loại thiết bị" value={deviceTypeId} onChange={id => { setDeviceTypeId(id); setModelId(undefined); setIssueId(undefined); resetService() }} loading={types.isLoading} options={types.data} /><FieldSelect label="Model" value={modelId} onChange={id => { setModelId(id); setIssueId(undefined); resetService() }} loading={models.isLoading} disabled={!deviceTypeId} options={models.data} /><FieldSelect label="Vấn đề" value={issueId} onChange={id => { setIssueId(id); resetService() }} loading={issues.isLoading} disabled={!modelId} options={issues.data} /><label className="field"><span>Loại dịch vụ</span><select disabled={!issueId || catalog.isLoading} value={effectiveServiceType ?? ''} onChange={event => { setServiceType(event.target.value as ServiceTypeCode); setPartBrand(undefined); setServiceId(undefined) }}><option value="">Chọn loại dịch vụ</option>{serviceTypes.map(([code, name]) => <option key={code} value={code}>{serviceLabels[code] || name}</option>)}</select></label></div>
      {effectiveServiceType === 'REPLACEMENT' && <div className="form-grid"><label className="field"><span>Hãng linh kiện</span><select value={effectivePartBrand ?? ''} onChange={event => { setPartBrand(event.target.value || undefined); setServiceId(undefined) }}><option value="">Chọn hãng linh kiện</option>{brands.map(brand => <option key={brand}>{brand}</option>)}</select></label><label className="field"><span>Model / Phiên bản linh kiện</span><select disabled={!effectivePartBrand} value={serviceId ?? ''} onChange={event => setServiceId(Number(event.target.value) || undefined)}><option value="">Chọn phiên bản</option>{serviceOptions.map(item => <option key={item.id} value={item.id}>{item.partVariant || item.partName || item.name}</option>)}</select></label></div>}
      {effectiveServiceType && effectiveServiceType !== 'REPLACEMENT' && <FieldSelect label="Phương án dịch vụ" value={serviceId} onChange={setServiceId} options={serviceOptions} />}
      {selectedService && <div className="service-summary"><div><span>Dịch vụ đã chọn</span><strong>{selectedService.name}</strong></div><div><span>Giá dự kiến</span><strong>{formatMoney(selectedService.displayPrice)}</strong></div><div><span>Thời lượng</span><strong>{selectedService.standardDurationMinutes ? `${selectedService.standardDurationMinutes} phút` : 'Xác nhận sau'}</strong></div><div><span>Bảo hành</span><strong>{selectedService.warrantyDays ? `${selectedService.warrantyDays} ngày` : 'Không áp dụng'}</strong></div></div>}
      <label className="field"><span>Mô tả thêm <i>Không bắt buộc</i></span><textarea value={symptom} onChange={event => setSymptom(event.target.value)} placeholder="Mô tả triệu chứng cụ thể…" /></label><div className="panel-actions"><button className="button button--secondary" disabled={!selectedService} onClick={addDevice}>+ Thêm thiết bị vào lịch</button><button className="button button--primary" disabled={!devices.length} onClick={() => setStep(2)}>Tiếp tục</button></div>
    </section>}
    {step === 2 && <form className="form-panel" onSubmit={form.handleSubmit(() => setStep(3))}><div className="panel-heading"><span>02</span><div><h2>Thông tin khách hàng</h2><p>Chỉ cần họ tên và số điện thoại để xác nhận, tra cứu.</p></div></div><div className="form-grid"><label className="field"><span>Họ và tên</span><input autoComplete="name" {...form.register('customerFullName')} />{form.formState.errors.customerFullName && <small>{form.formState.errors.customerFullName.message}</small>}</label><label className="field"><span>Số điện thoại</span><input inputMode="tel" autoComplete="tel" {...form.register('phone')} />{form.formState.errors.phone && <small>{form.formState.errors.phone.message}</small>}</label></div><label className="field"><span>Ghi chú lịch hẹn <i>Không bắt buộc</i></span><textarea {...form.register('note')} /></label><div className="panel-actions"><button type="button" className="button button--quiet" onClick={() => setStep(1)}>Quay lại</button><button className="button button--primary">Tiếp tục</button></div></form>}
    {step === 3 && <section className="form-panel"><div className="panel-heading"><span>03</span><div><h2>Chi nhánh & thời gian</h2><p>Chọn nơi tiếp nhận sau khi đã xác định dịch vụ.</p></div></div>{branches.isLoading ? <LoadingState /> : branches.isError ? <ErrorState error={branches.error} retry={() => branches.refetch()} /> : <div className="branch-choice-grid">{branches.data?.map(branch => <button className={branchId === branch.id ? 'selected' : ''} key={branch.id} onClick={() => { setBranchId(branch.id); setSlotId(undefined) }}><strong>{branch.name}</strong><span>{branch.address}</span></button>)}</div>}<label className="field date-field"><span>Ngày tiếp nhận</span><input type="date" min={today} value={date} onChange={event => { setDate(event.target.value); setSlotId(undefined) }} /></label>{branchId && date && (slots.isLoading ? <LoadingState label="Đang tải khung giờ…" /> : slots.isError ? <ErrorState error={slots.error} retry={() => slots.refetch()} /> : !slots.data?.length ? <EmptyState title="Không có khung giờ mở trong ngày này" /> : <div className="slot-grid">{slots.data.map(slot => <button disabled={slot.status === 'CLOSED'} className={slotId === slot.slotId ? 'selected' : ''} key={slot.slotId} onClick={() => setSlotId(slot.slotId)}><strong>{formatTime(slot.startTime)} – {formatTime(slot.endTime)}</strong><span>{slot.status === 'CLOSED' ? 'Đã đóng' : `${slot.activeBookingCount} lượt đã đặt`}</span></button>)}</div>)}<div className="panel-actions"><button className="button button--quiet" onClick={() => setStep(2)}>Quay lại</button><button className="button button--primary" disabled={!slotId} onClick={() => setStep(4)}>Kiểm tra thông tin</button></div></section>}
    {step === 4 && <section className="form-panel"><div className="panel-heading"><span>04</span><div><h2>Xác nhận lịch hẹn</h2><p>Kiểm tra lần cuối trước khi gửi tới chi nhánh.</p></div></div><div className="review-grid"><article><span>Khách hàng</span><strong>{form.getValues('customerFullName')}</strong><p>{form.getValues('phone')}</p></article><article><span>Chi nhánh</span><strong>{chosenBranch?.name}</strong><p>{chosenSlot && `${formatDate(chosenSlot.slotDate)} · ${formatTime(chosenSlot.startTime)}–${formatTime(chosenSlot.endTime)}`}</p></article>{devices.map((device, index) => <article key={index}><span>Thiết bị {index + 1}</span><strong>{device.label}</strong><p>{device.serviceLabel}</p></article>)}</div>{create.isError && <ErrorState error={create.error} />}<div className="panel-actions"><button className="button button--quiet" onClick={() => setStep(3)}>Quay lại</button><button className="button button--primary" disabled={create.isPending} onClick={submit}>{create.isPending ? 'Đang gửi…' : 'Xác nhận đặt lịch'}</button></div></section>}
  </div>
}

function FieldSelect<T extends { id: number; name: string }>({ label, value, onChange, options, disabled, loading }: { label: string; value?: number; onChange: (value: number) => void; options?: T[]; disabled?: boolean; loading?: boolean }) {
  return <label className="field"><span>{label}</span><select disabled={disabled || loading} value={value ?? ''} onChange={event => onChange(Number(event.target.value))}><option value="">{loading ? 'Đang tải…' : `Chọn ${label.toLowerCase()}`}</option>{options?.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
}

function BookingSuccess({ appointment }: { appointment: PublicAppointmentResponse }) {
  return <div className="success-page section-pad"><div className="success-mark">✓</div><span className="eyebrow">Đã ghi nhận lịch hẹn</span><h1>Cảm ơn bạn. Chi nhánh sẽ xác nhận lịch.</h1><div className="success-ticket"><span>Mã lịch hẹn</span><strong>#{appointment.appointmentId}</strong><dl><div><dt>Chi nhánh</dt><dd>{appointment.branchName}</dd></div><div><dt>Thời gian</dt><dd>{formatDate(appointment.date)} · {formatTime(appointment.startTime)}–{formatTime(appointment.endTime)}</dd></div><div><dt>Trạng thái</dt><dd>Chờ xác nhận</dd></div><div><dt>Ưu đãi thực tế</dt><dd>{appointment.discountPercent}%</dd></div></dl></div><p>Dùng số điện thoại vừa đăng ký để tra cứu lịch hẹn và phiếu dịch vụ.</p><div className="button-row"><Link className="button button--primary" to="/lookup">Đi tới tra cứu</Link><Link className="button button--secondary" to="/">Về trang chủ</Link></div></div>
}
