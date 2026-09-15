import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { receptionistApi } from '../../../api/receptionistApi'
import { publicApi } from '../../../api/publicApi'
import { ErrorState } from '../../../components/AsyncState'

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
  const [serviceId, setServiceId] = useState<number>()
  const branches = useQuery({ queryKey: ['public', 'branches'], queryFn: ({ signal }) => publicApi.branches(signal), enabled: mode === 'walk-in' })
  const types = useQuery({ queryKey: ['public', 'device-types'], queryFn: ({ signal }) => publicApi.deviceTypes(signal), enabled: mode === 'walk-in' })
  const models = useQuery({ queryKey: ['public', 'device-models', typeId], queryFn: ({ signal }) => publicApi.deviceModels(typeId, signal), enabled: mode === 'walk-in' && Boolean(typeId) })
  const issues = useQuery({ queryKey: ['public', 'service-issues'], queryFn: ({ signal }) => publicApi.serviceIssues(signal), enabled: mode === 'walk-in' })
  const catalog = useQuery({ queryKey: ['public', 'catalog', modelId, issueId], queryFn: ({ signal }) => publicApi.catalog({ deviceModelId: modelId, serviceIssueId: issueId }, signal), enabled: mode === 'walk-in' && Boolean(modelId && issueId) })
  const create = useMutation({ mutationFn: async () => mode === 'appointment'
    ? receptionistApi.intake(appointmentDeviceId!, { serialNumber: serialNumber || undefined, storage: storage || undefined, receivedCondition: condition })
    : receptionistApi.walkIn({ customerFullName: fullName, phone, branchId: branchId!, deviceModelId: modelId!, serialNumber: serialNumber || undefined, storage: storage || undefined, receivedCondition: condition, serviceCatalogItemIds: serviceId ? [serviceId] : undefined }),
    onSuccess: detail => navigate(`/internal/receptionist/tickets/${detail.ticket.id}`, { state: { created: true } }),
  })
  function submit(event: FormEvent) { event.preventDefault(); create.mutate() }
  const valid = condition.trim() && (mode === 'appointment' ? appointmentDeviceId : fullName.trim() && phone.trim() && branchId && modelId)
  return <div className="workspace-page"><header><span className="eyebrow">Tiếp nhận thiết bị</span><h1>Tạo phiếu dịch vụ.</h1><p>Tiếp nhận từ lịch đã đến hoặc ghi nhận khách walk-in bằng contract backend hiện có.</p></header><div className="segmented"><button className={mode === 'appointment' ? 'active' : ''} onClick={() => setMode('appointment')}>Từ lịch hẹn</button><button className={mode === 'walk-in' ? 'active' : ''} onClick={() => setMode('walk-in')}>Khách trực tiếp</button></div><form className="ops-form" onSubmit={submit}>{mode === 'appointment' ? <label className="field"><span>Appointment device ID</span><input readOnly value={appointmentDeviceId ?? ''} placeholder="Mở từ lịch hẹn đã ARRIVED" /></label> : <><div className="form-grid"><label className="field"><span>Họ tên khách</span><input value={fullName} onChange={event => setFullName(event.target.value)} /></label><label className="field"><span>Số điện thoại</span><input inputMode="tel" value={phone} onChange={event => setPhone(event.target.value)} /></label><label className="field"><span>Chi nhánh</span><select value={branchId ?? ''} onChange={event => setBranchId(Number(event.target.value) || undefined)}><option value="">Chọn chi nhánh</option>{branches.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Loại thiết bị</span><select value={typeId ?? ''} onChange={event => { setTypeId(Number(event.target.value) || undefined); setModelId(undefined) }}><option value="">Chọn loại</option>{types.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Model</span><select disabled={!typeId} value={modelId ?? ''} onChange={event => setModelId(Number(event.target.value) || undefined)}><option value="">Chọn model</option>{models.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Vấn đề</span><select disabled={!modelId} value={issueId ?? ''} onChange={event => setIssueId(Number(event.target.value) || undefined)}><option value="">Chọn vấn đề</option>{issues.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><label className="field"><span>Dịch vụ ban đầu <i>Không bắt buộc theo DTO</i></span><select disabled={!issueId} value={serviceId ?? ''} onChange={event => setServiceId(Number(event.target.value) || undefined)}><option value="">Chưa chọn</option>{catalog.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></>}<div className="form-grid"><label className="field"><span>Serial number <i>Không bắt buộc</i></span><input maxLength={255} value={serialNumber} onChange={event => setSerialNumber(event.target.value)} /></label><label className="field"><span>Dung lượng/thông tin lưu trữ <i>Không bắt buộc</i></span><input maxLength={255} value={storage} onChange={event => setStorage(event.target.value)} /></label></div><label className="field"><span>Tình trạng khi tiếp nhận</span><textarea required maxLength={5000} value={condition} onChange={event => setCondition(event.target.value)} /></label>{create.isError && <ErrorState error={create.error} />}<div className="panel-actions"><button className="button button--primary" disabled={!valid || create.isPending}>{create.isPending ? 'Đang tạo phiếu…' : 'Tạo phiếu dịch vụ'}</button></div></form></div>
}
