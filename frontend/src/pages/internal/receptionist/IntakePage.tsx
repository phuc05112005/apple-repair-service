import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, useMemo, useEffect, useRef, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ServiceTypeCode } from '../../../api/contracts'
import { ApiError } from '../../../api/client'
import { receptionistApi } from '../../../api/receptionistApi'
import { publicApi } from '../../../api/publicApi'
import { ErrorState, LoadingState } from '../../../components/AsyncState'
import { formatMoney } from '../../../utils/format'

const serviceTypeLabels: Record<ServiceTypeCode, string> = {
  REPAIR: 'Sửa chữa',
  REPLACEMENT: 'Thay thế linh kiện',
  WARRANTY: 'Bảo hành',
}

interface ServiceItemInfo {
  id?: number
  serviceCatalogItemId?: number
  serviceId?: number
  catalogItemId?: number
  serviceNameSnapshot?: string
  [key: string]: unknown
}

interface DeviceInfo {
  id: number
  deviceModelId: number
  deviceTypeId?: number
  typeId?: number
  symptomDescription?: string
  [key: string]: unknown
}

interface AppointmentDeviceEntry {
  device: DeviceInfo
  serviceItems?: ServiceItemInfo[]
  [key: string]: unknown
}

interface AppointmentData {
  id: number
  customerFullName: string
  customerPhone: string
  branchId?: number
  branch_id?: number
  branch?: { id?: number }
  slot?: { branchId?: number; branch_id?: number; branch?: { id?: number } }
  discountPercent?: number
  [key: string]: unknown
}

interface AppointmentRecord {
  appointment: AppointmentData
  devices: AppointmentDeviceEntry[]
  [key: string]: unknown
}

// Hàm bóc tách Chi nhánh an toàn từ mọi vị trí dữ liệu của Lịch hẹn
function extractBranchId(booking: unknown): number | undefined {
  if (!booking || typeof booking !== 'object') return undefined
  const b = booking as Record<string, unknown>
  const appt = (b.appointment ?? b) as Record<string, unknown>
  const entry = b.entry as Record<string, unknown> | undefined
  const slot = (appt.slot ?? b.slot) as Record<string, unknown> | undefined
  const dev = (entry?.device ?? entry) as Record<string, unknown> | undefined

  const candidateKeys = [
    appt.branchId,
    appt.branch_id,
    (appt.branch as Record<string, unknown> | undefined)?.id,
    slot?.branchId,
    slot?.branch_id,
    (slot?.branch as Record<string, unknown> | undefined)?.id,
    b.branchId,
    b.branch_id,
    (b.branch as Record<string, unknown> | undefined)?.id,
    entry?.branchId,
    entry?.branch_id,
    dev?.branchId,
    dev?.branch_id,
  ]

  for (const val of candidateKeys) {
    const num = Number(val)
    if (!isNaN(num) && num > 0) return num
  }
  return undefined
}

export function IntakePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const initialAppointmentDeviceId = Number(params.get('appointmentDeviceId')) || undefined

  // Thông tin thiết bị & khách hàng
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [branchId, setBranchId] = useState<number>()
  const [typeId, setTypeId] = useState<number>()
  const [modelId, setModelId] = useState<number>()
  const [serialNumber, setSerialNumber] = useState('')
  const [storage, setStorage] = useState('')
  const [reportedIssue, setReportedIssue] = useState('')
  const [authorizedScope, setAuthorizedScope] = useState('')
  
  // Tích chọn nhiều vấn đề và dịch vụ
  const [selectedIssueIds, setSelectedIssueIds] = useState<number[]>([])
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([])

  // Quản lý ưu đãi đặt lịch 10%
  const [hasAppointmentDiscount, setHasAppointmentDiscount] = useState<boolean>(Boolean(initialAppointmentDeviceId))
  const [discountPercent, setDiscountPercent] = useState<number>(10)

  // Ref theo dõi việc tự động điền form để tránh ghi đè
  const populatedBookingIdRef = useRef<number | null>(null)
  const resolvedTypeIdRef = useRef<number | undefined>(undefined)
  const populatedIssuesKeyRef = useRef<string>('')

  // 1. Fetch Master Data
  const branches = useQuery({ queryKey: ['public', 'branches'], queryFn: ({ signal }) => publicApi.branches(signal) })
  const types = useQuery({ queryKey: ['public', 'device-types'], queryFn: ({ signal }) => publicApi.deviceTypes(signal) })

  const models = useQuery({ 
    queryKey: ['public', 'device-models', typeId], 
    queryFn: ({ signal }) => publicApi.deviceModels(typeId!, signal), 
    enabled: Boolean(typeId) 
  })

  const issues = useQuery({ 
    queryKey: ['public', 'service-issues', typeId], 
    queryFn: ({ signal }) => publicApi.serviceIssues(typeId!, signal), 
    enabled: Boolean(typeId) 
  })

  // 2. Query dữ liệu lịch hẹn để auto-fill khi điều hướng từ trang Lịch hẹn
  const readyAppointments = useQuery({
    queryKey: ['internal', 'appointments', 'ready-for-intake'],
    queryFn: ({ signal }) => receptionistApi.readyForIntake(signal),
    enabled: Boolean(initialAppointmentDeviceId)
  })

  const allAppointments = useQuery({
    queryKey: ['internal', 'appointments', 'all-recovery'],
    queryFn: ({ signal }) => receptionistApi.appointments({}, signal),
    enabled: Boolean(initialAppointmentDeviceId)
  })

  // 3. Tìm booking tương ứng với initialAppointmentDeviceId
  const selectedBooking = (() => {
    if (!initialAppointmentDeviceId) return null
    const sources = [readyAppointments.data, allAppointments.data]
    for (const source of sources) {
      if (!source) continue
      const items = source as unknown as AppointmentRecord[]
      for (const item of items) {
        const apptObj = item.appointment ?? item
        const devicesArr = item.devices ?? []
        for (const entry of devicesArr) {
          const devObj = entry.device ?? entry
          if (devObj && Number(devObj.id) === initialAppointmentDeviceId) {
            return { appointment: apptObj, entry }
          }
        }
      }
    }
    return null
  })()

  // 4. TỰ ĐỘNG NẠP THÔNG TIN TỪ LỊCH HẸN VÀO FORM
  useEffect(() => {
    if (!selectedBooking) return
    const targetDevId = selectedBooking.entry.device.id
    if (populatedBookingIdRef.current === targetDevId) return
    populatedBookingIdRef.current = targetDevId

    const { appointment, entry } = selectedBooking

    const timer = setTimeout(() => {
      if (appointment.customerFullName) setFullName(appointment.customerFullName)
      if (appointment.customerPhone) setPhone(appointment.customerPhone)

      const detectedBranch = extractBranchId(selectedBooking)
      if (detectedBranch) {
        setBranchId(detectedBranch)
      } else if (branches.data?.length) {
        setBranchId(branches.data[0].id)
      }

      const devObj = entry.device
      const mId = Number(devObj.deviceModelId)
      if (mId) setModelId(mId)

      const directTypeId = Number(devObj.deviceTypeId ?? devObj.typeId)
      if (directTypeId) setTypeId(directTypeId)

      if (devObj.symptomDescription) setReportedIssue(devObj.symptomDescription)

      if (entry.serviceItems?.length) {
        const bookedIds = entry.serviceItems
          .map(s => Number(s.serviceCatalogItemId ?? s.serviceId ?? s.catalogItemId))
          .filter(id => !isNaN(id) && id > 0)
        if (bookedIds.length > 0) {
          setSelectedServiceIds(prev => Array.from(new Set([...prev, ...bookedIds])))
        }
      }

      setHasAppointmentDiscount(true)
      const apptDiscount = Number(appointment.discountPercent)
      if (!isNaN(apptDiscount) && apptDiscount > 0) {
        setDiscountPercent(apptDiscount)
      }
    }, 0)

    return () => clearTimeout(timer)
  }, [selectedBooking, branches.data])

  // Tự động gán chi nhánh nếu danh sách Chi nhánh tải xong sau khi nạp Lịch hẹn
  useEffect(() => {
    if (initialAppointmentDeviceId && !branchId && branches.data?.length) {
      const detectedBranch = extractBranchId(selectedBooking)
      const timer = setTimeout(() => {
        setBranchId(detectedBranch ?? branches.data![0].id)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [initialAppointmentDeviceId, branchId, branches.data, selectedBooking])

  // 5. TỰ ĐỘNG TRA CỨU typeId TỪ modelId MỘT CÁCH AN TOÀN
  useEffect(() => {
    if (!modelId || typeId || !types.data?.length) return
    if (resolvedTypeIdRef.current === modelId) return

    let active = true

    async function autoResolveTypeId() {
      for (const t of types.data!) {
        try {
          const modelList = await publicApi.deviceModels(t.id)
          if (!active) return
          if (modelList.some(m => m.id === modelId)) {
            resolvedTypeIdRef.current = modelId
            setTimeout(() => {
              if (active) setTypeId(t.id)
            }, 0)
            break
          }
        } catch {
          // Bỏ qua lỗi nếu 1 loại thiết bị tải thất bại
        }
      }
    }

    void autoResolveTypeId()
    return () => { active = false }
  }, [modelId, typeId, types.data])

  // Catalog dịch vụ của Dòng máy
  const catalog = useQuery({
    queryKey: ['public', 'catalog', modelId, 'all'],
    queryFn: ({ signal }) => publicApi.catalog({ deviceModelId: modelId }, signal),
    enabled: Boolean(modelId)
  })

  // 6. TỰ ĐỘNG TÍCH CHỌN CÁC Ô VẤN ĐỀ TƯƠNG ỨNG VỚI DỊCH VỤ ĐÃ ĐẶT
  useEffect(() => {
    if (!catalog.data?.length || !selectedServiceIds.length || !modelId) return
    const key = `${modelId}-${selectedServiceIds.slice().sort().join(',')}`
    if (populatedIssuesKeyRef.current === key) return

    const matchedIssueIds = catalog.data
      .filter(item => selectedServiceIds.includes(item.id) && item.serviceIssueId != null)
      .map(item => item.serviceIssueId as number)

    if (matchedIssueIds.length > 0) {
      populatedIssuesKeyRef.current = key
      const timer = setTimeout(() => {
        setSelectedIssueIds(prev => Array.from(new Set([...prev, ...matchedIssueIds])))
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [catalog.data, selectedServiceIds, modelId])

  const catalogItems = useMemo(() => {
    return (catalog.data ?? []).filter(item => item.serviceTypeCode === 'REPAIR' || item.serviceTypeCode === 'REPLACEMENT')
  }, [catalog.data])

  // Phân nhóm dịch vụ theo Vấn đề
  const groupedServicesByIssue = useMemo(() => {
    if (!catalogItems.length) return []
    
    const activeIssueIds = selectedIssueIds.length > 0 
      ? selectedIssueIds 
      : (issues.data ?? []).map(i => i.id)

    return (issues.data ?? [])
      .filter(issue => activeIssueIds.includes(issue.id))
      .map(issue => {
        const services = catalogItems.filter(item => item.serviceIssueId === issue.id)
        return { issue, services }
      })
      .filter(group => group.services.length > 0)
  }, [catalogItems, selectedIssueIds, issues.data])

  // Các dịch vụ đã chọn & Tính giá
  const activeSelectedServices = useMemo(() => {
    return catalogItems.filter(item => selectedServiceIds.includes(item.id))
  }, [catalogItems, selectedServiceIds])

  const totalOriginalPrice = useMemo(() => {
    return activeSelectedServices.reduce((sum, item) => sum + (item.displayPrice ?? 0), 0)
  }, [activeSelectedServices])

  const discountAmount = useMemo(() => {
    if (!hasAppointmentDiscount || !totalOriginalPrice) return 0
    return Math.round(totalOriginalPrice * (discountPercent / 100))
  }, [hasAppointmentDiscount, totalOriginalPrice, discountPercent])

  const finalTotalPrice = useMemo(() => {
    return totalOriginalPrice - discountAmount
  }, [totalOriginalPrice, discountAmount])

  function toggleIssueId(id: number) {
    setSelectedIssueIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  function toggleServiceId(id: number) {
    setSelectedServiceIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  function resetAllForm() {
    setSelectedIssueIds([])
    setSelectedServiceIds([])
  }

  // TÍCH HỢP FALLBACK XỬ LÝ LỖI 409 CONFLICT
  const create = useMutation({
    mutationFn: async () => {
      if (initialAppointmentDeviceId && selectedBooking) {
        try {
          return await receptionistApi.intake(initialAppointmentDeviceId, {
            serialNumber: serialNumber || undefined,
            storage: storage || undefined,
            serviceCatalogItemIds: selectedServiceIds.length > 0 ? selectedServiceIds : undefined,
          })
        } catch (err) {
          // Nếu Backend từ chối với lỗi 409 (Lịch hẹn/thiết bị này đã từng được tiếp nhận hoặc hủy phiếu trước đó),
          // tự động fallback sang tạo phiếu mới trực tiếp (walkIn) với đầy đủ thông tin đã fill.
          const isConflict = err instanceof ApiError && (err.status === 409 || err.code === 'CONFLICT' || String(err.status) === '409')
          if (isConflict) {
            return receptionistApi.walkIn({
              customerFullName: fullName.trim(),
              phone: phone.trim(),
              branchId: branchId!,
              deviceModelId: modelId!,
              serialNumber: serialNumber || undefined,
              storage: storage || undefined,
              customerReportedIssue: reportedIssue.trim() || undefined,
              authorizedScope: authorizedScope.trim() || undefined,
              serviceCatalogItemIds: selectedServiceIds,
            })
          }
          throw err
        }
      }

      return receptionistApi.walkIn({
        customerFullName: fullName.trim(),
        phone: phone.trim(),
        branchId: branchId!,
        deviceModelId: modelId!,
        serialNumber: serialNumber || undefined,
        storage: storage || undefined,
        customerReportedIssue: reportedIssue.trim() || undefined,
        authorizedScope: authorizedScope.trim() || undefined,
        serviceCatalogItemIds: selectedServiceIds,
      })
    },
    onSuccess: detail => navigate('/internal/receptionist/tickets/' + detail.ticket.id, { state: { created: true } }),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (valid && !create.isPending) create.mutate()
  }

  const valid = Boolean(fullName.trim() && phone.trim() && branchId && modelId && selectedServiceIds.length > 0)

  return (
    <div className="workspace-page intake-page">
      <header>
        <span className="eyebrow">Tiếp nhận thiết bị</span>
        <h1>Tạo phiếu dịch vụ</h1>
      </header>

      <form className="ops-form intake-form" onSubmit={submit}>
        <section className="intake-section">
          <div className="intake-section__heading">
            <span>01</span>
            <div>
              <h2>Khách hàng và thiết bị</h2>
              <p>Điền thông tin khách hàng và lựa chọn dòng máy tương ứng.</p>
            </div>
          </div>

          {/* THÔNG BÁO TỰ ĐỘNG NẠP DỮ LIỆU TỪ LỊCH HẸN */}
          {initialAppointmentDeviceId && fullName && (
            <div className="intake-booking-card" style={{ background: '#eef6ff', border: '1px solid #b3d7ff', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
              <strong style={{ color: '#0066cc' }}>Tự động điền thông tin từ Lịch hẹn</strong>
              <p style={{ margin: '0.5rem 0 0', color: '#333' }}>
                Thông tin khách hàng (<strong>{fullName}</strong> - {phone}), dòng máy và dịch vụ đã chọn từ lịch hẹn.
              </p>
            </div>
          )}

          <div className="form-grid">
            <label className="field">
              <span>Họ tên khách hàng</span>
              <input required placeholder="Nhập họ tên khách hàng" value={fullName} onChange={event => setFullName(event.target.value)} />
            </label>
            <label className="field">
              <span>Số điện thoại</span>
              <input required type="tel" placeholder="Nhập số điện thoại" inputMode="tel" value={phone} onChange={event => setPhone(event.target.value)} />
            </label>
            <label className="field">
              <span>Chi nhánh tiếp nhận</span>
              <select required value={branchId ?? ''} onChange={event => setBranchId(Number(event.target.value) || undefined)}>
                <option value="">Chọn chi nhánh</option>
                {branches.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                {branchId && !branches.data?.some(b => b.id === branchId) && (
                  <option value={branchId}>Chi nhánh #{branchId}</option>
                )}
              </select>
            </label>
            <label className="field">
              <span>Loại thiết bị</span>
              <select required value={typeId ?? ''} onChange={event => { setTypeId(Number(event.target.value) || undefined); setModelId(undefined); resetAllForm(); }}>
                <option value="">Chọn loại thiết bị</option>
                {types.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                {typeId && !types.data?.some(t => t.id === typeId) && (
                  <option value={typeId}>Loại thiết bị #{typeId}</option>
                )}
              </select>
            </label>
            <label className="field">
              <span>Dòng máy</span>
              <select required disabled={!typeId && !modelId} value={modelId ?? ''} onChange={event => { setModelId(Number(event.target.value) || undefined); resetAllForm(); }}>
                <option value="">Chọn dòng máy</option>
                {models.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                {modelId && !models.data?.some(m => m.id === modelId) && (
                  <option value={modelId}>Dòng máy #{modelId}</option>
                )}
              </select>
            </label>
          </div>

          {/* CHECKBOX TÍCH CHỌN NHIỀU VẤN ĐỀ KHÁCH GẶP PHẢI */}
          {modelId && (issues.data?.length ?? 0) > 0 && (
            <div className="field" style={{ marginTop: '1rem' }}>
              <span>Dịch vụ</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                {issues.data!.map(issue => {
                  const isChecked = selectedIssueIds.includes(issue.id)
                  return (
                    <label
                      key={issue.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.6rem 0.8rem',
                        border: isChecked ? '2px solid #0066cc' : '1px solid #ccc',
                        borderRadius: '6px',
                        background: isChecked ? '#eef6ff' : '#fff',
                        cursor: 'pointer',
                        fontWeight: isChecked ? '600' : 'normal'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleIssueId(issue.id)}
                      />
                      <span>{issue.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          <div className="intake-notes-grid" style={{ marginTop: '1rem' }}>
            <label className="field">
              <span>Vấn đề khách mô tả ban đầu</span>
              <textarea placeholder="Nhập triệu chứng hoặc vấn đề khách gặp phải" maxLength={5000} value={reportedIssue} onChange={event => setReportedIssue(event.target.value)} />
            </label>
            <label className="field">
              <span>Phạm vi khách cho phép trước <i>Không bắt buộc</i></span>
              <textarea placeholder="Nhập phương án, giới hạn chi phí và điều kiện khách đã đồng ý" maxLength={5000} value={authorizedScope} onChange={event => setAuthorizedScope(event.target.value)} />
            </label>
          </div>
        </section>

        <section className="intake-section intake-section--service">
          <div className="intake-section__heading">
            <span>02</span>
            <div>
              <h2>Dịch vụ tiếp nhận theo từng Vấn đề</h2>
              <p>Danh sách các phương án dịch vụ tương ứng với dòng máy và các vấn đề đã chọn.</p>
            </div>
          </div>

          {catalog.isLoading && modelId && <LoadingState label="Đang tải danh sách dịch vụ phù hợp…" />}
          {catalog.isError && <ErrorState error={catalog.error} retry={() => catalog.refetch()} />}
          
          {modelId && !catalog.isLoading && !groupedServicesByIssue.length && (
            <p className="intake-hint" role="status">Chưa có dịch vụ nào cho dòng máy này hoặc các vấn đề đã chọn.</p>
          )}

          {/* DANH SÁCH DỊCH VỤ GOM NHÓM THEO VẤN ĐỀ */}
          {groupedServicesByIssue.map(({ issue, services }) => (
            <div key={issue.id} style={{ marginBottom: '1.5rem', background: '#fafafa', padding: '1rem', borderRadius: '8px', border: '1px solid #eee' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', color: '#0066cc', borderBottom: '1px solid #e0e0e0', paddingBottom: '0.4rem' }}>
                Dịch vụ: {issue.name}
              </h3>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {services.map(item => {
                  const isChecked = selectedServiceIds.includes(item.id)
                  return (
                    <label
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem',
                        border: isChecked ? '2px solid #0066cc' : '1px solid #ddd',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: isChecked ? '#f0f7ff' : '#fff'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleServiceId(item.id)}
                      />
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: '0.95rem' }}>{item.name}</strong>
                        <small style={{ display: 'block', color: '#666' }}>
                          [{serviceTypeLabels[item.serviceTypeCode]}] {[item.partName, item.partBrand, item.partVariant].filter(Boolean).join(' · ')}
                        </small>
                      </div>
                      <strong style={{ color: '#0066cc' }}>{item.displayPrice != null ? formatMoney(item.displayPrice) : 'Chưa thiết lập giá'}</strong>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Ô THỦ CÔNG TÍCH GIẢM GIÁ ĐẶT LỊCH 10% */}
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#fff8e6', border: '1px solid #ffe599', borderRadius: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: 'bold', color: '#b78103' }}>
              <input
                type="checkbox"
                style={{ width: '1.2rem', height: '1.2rem' }}
                checked={hasAppointmentDiscount}
                onChange={e => setHasAppointmentDiscount(e.target.checked)}
              />
              <span>Ưu đãi giảm giá ({discountPercent}%)</span>
            </label>
            
          </div>

          {/* TỔNG GIÁ DỊCH VỤ & MỨC GIẢM */}
          {activeSelectedServices.length > 0 && (
            <div className="intake-price-card" style={{ marginTop: '1.5rem' }} aria-live="polite">
              <div>
                <span>Danh sách dịch vụ đã chọn ({activeSelectedServices.length})</span>
                <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
                  {activeSelectedServices.map(s => (
                    <li key={s.id}>
                      <strong>{s.name}</strong>: {s.displayPrice != null ? formatMoney(s.displayPrice) : 'Chưa có giá'}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <span>Tổng tiền dịch vụ gốc: <strong>{formatMoney(totalOriginalPrice)}</strong></span>
                {hasAppointmentDiscount && (
                  <span style={{ color: '#28a745', display: 'block', marginTop: '0.25rem' }}>
                    Ưu đãi đặt lịch ({discountPercent}%): -{formatMoney(discountAmount)}
                  </span>
                )}
                <div style={{ marginTop: '0.5rem', borderTop: '1px dashed #ccc', paddingTop: '0.5rem' }}>
                  <span>Tổng giá dự kiến thanh toán</span>
                  <strong style={{ fontSize: '1.3rem', color: '#0066cc' }}>{formatMoney(finalTotalPrice)}</strong>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="intake-section">
          <div className="intake-section__heading">
            <span>03</span>
            <div>
              <h2>Thông tin bổ sung thiết bị</h2>
              <p>Số sê-ri và dung lượng lưu trữ (không bắt buộc).</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Số sê-ri</span>
              <input placeholder="Nhập số sê-ri thiết bị" maxLength={255} value={serialNumber} onChange={event => setSerialNumber(event.target.value)} />
            </label>
            <label className="field">
              <span>Dung lượng lưu trữ</span>
              <input placeholder="Nhập dung lượng lưu trữ" maxLength={255} value={storage} onChange={event => setStorage(event.target.value)} />
            </label>
          </div>
        </section>

        {create.isError && (
          <ErrorState
            error={create.error}
            title="Chưa thể tạo phiếu dịch vụ"
            description={create.error instanceof Error ? create.error.message : 'Tải lại trang để thử lại.'}
            retry={() => create.reset()}
          />
        )}

        <div className="panel-actions">
          <button type="submit" className="button button--primary" disabled={!valid || create.isPending}>
            {create.isPending ? 'Đang tạo phiếu…' : `Tạo phiếu dịch vụ (${selectedServiceIds.length} dịch vụ)`}
          </button>
        </div>
      </form>
    </div>
  )
}