import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi, type CustomerFeedbackRecord, type RepairItemApiDetail } from '../../../api/adminApi'
import { publicApi } from '../../../api/publicApi'
import { AdminDataTable, type DataColumn, type TableFilter } from '../../../components/AdminDataTable'
import { DetailDrawer } from '../../../components/Dialog'
import { ErrorState, LoadingState } from '../../../components/AsyncState'
import { StatusBadge } from '../../../components/StatusBadge'
import { paymentMethodLabels, ticketStatusLabels } from '../../../types/labels'
import { addBusinessDays, businessDate, formatDateTime, formatMoney } from '../../../utils/format'
import { compareText } from '../../../utils/table'

export interface ServiceTicketRecord {
  id: number
  ticketCode: string
  customerFullName?: string
  customerPhone?: string
  deviceModelName?: string
  serialNumber?: string
  status: keyof typeof ticketStatusLabels | string
  receivedAt: string
  totalAmount?: number | null
  branchId?: number | null
  branchName?: string | null
  technicianName?: string | null
  serviceType?: string
  paymentMethod?: string | null
}

interface ParsedRepairItem {
  id: number | string
  serviceType: string
  displayName: string | null
  partDetail: string
  price: number
}

interface RawSummaryApiItem {
  id?: number
  ticketCode?: string
  ticket_code?: string
  customerFullName?: string
  customer_full_name?: string
  customerPhone?: string
  customer_phone?: string
  deviceModelName?: string
  device_model_name?: string
  imeiOrSerial?: string
  serialNumber?: string
  serial_number?: string
  branchId?: number
  branch_id?: number
  branchName?: string
  branch_name?: string
  technicianName?: string
  technician_name?: string
  totalAmount?: number
  total_amount?: number
  status?: string
  receivedAt?: string
  received_at?: string
  serviceType?: string
  service_type?: string
  service_type_codes_list?: string
  paymentMethod?: string
  payment_method?: string
}

interface RawDetailResponse {
  ticket?: {
    paymentMethod?: string
    payment_method?: string
    paymentStatus?: string
    payment_status?: string
    paidAt?: string
    paid_at?: string
  }
  paymentMethod?: string
  payment_method?: string
  paymentStatus?: string
  payment_status?: string
  paidAt?: string
  paid_at?: string
  repairItems?: RepairItemApiDetail[]
  histories?: Array<{
    status?: string
    changedAt?: string
    changedByFullName?: string
    note?: string
  }>
}

export function StatisticsPage() {
  const initial = useMemo(() => {
    const to = businessDate()
    return { from: addBusinessDays(to, -30), to }
  }, [])

  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [branchId, setBranchId] = useState<number>()
  const [deviceTypeId, setDeviceTypeId] = useState<number>()
  const [serviceFilterType, setServiceFilterType] = useState<string>('')
  
  // Trạng thái hiển thị Drawer
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [showFeedbackDrawer, setShowFeedbackDrawer] = useState(false)
  const [feedbackSatisfiedFilter, setFeedbackSatisfiedFilter] = useState<string>('')

  const branches = useQuery({
    queryKey: ['public', 'branches'],
    queryFn: ({ signal }) => publicApi.branches(signal),
  })
  const deviceTypes = useQuery({
    queryKey: ['public', 'device-types'],
    queryFn: ({ signal }) => publicApi.deviceTypes(signal),
  })

  const statistics = useQuery({
    queryKey: ['admin', 'statistics', from, to, branchId, deviceTypeId],
    queryFn: ({ signal }) => adminApi.statistics({ from, to, branchId, deviceTypeId }, signal),
    enabled: Boolean(from && to),
  })

  const feedback = useQuery({
    queryKey: ['admin', 'feedback-statistics', from, to],
    queryFn: ({ signal }) => adminApi.feedbackStatistics({ from, to }, signal),
    enabled: Boolean(from && to),
  })

  // Query danh sách phản hồi của khách hàng (hiển thị trong Drawer Phản hồi)
  const feedbacksQuery = useQuery({
    queryKey: ['admin', 'feedbacks-list', from, to, branchId],
    queryFn: ({ signal }) => adminApi.feedbacks({ from, to, branchId }, signal),
    enabled: showFeedbackDrawer,
  })

  const ticketsQuery = useQuery({
    queryKey: ['admin', 'statistics-tickets', branchId],
    queryFn: ({ signal }) => adminApi.serviceTickets({ branchId }, signal),
  })

  const ticketDetailQuery = useQuery({
    queryKey: ['admin', 'ticket-detail', selectedTicketId],
    queryFn: ({ signal }) => (selectedTicketId ? adminApi.ticketDetail(selectedTicketId, signal) : null),
    enabled: Boolean(selectedTicketId),
  })

  const repairItemsQuery = useQuery({
    queryKey: ['admin', 'ticket-repair-items', selectedTicketId],
    queryFn: ({ signal }) => (selectedTicketId ? adminApi.ticketItems(selectedTicketId, signal) : []),
    enabled: Boolean(selectedTicketId),
  })

  const branchName = branches.data?.find(branch => branch.id === branchId)?.name ?? 'Tất cả chi nhánh'
  const branchMap = useMemo(() => new Map(branches.data?.map(b => [b.id, b.name])), [branches.data])

  const ticketList = useMemo<ServiceTicketRecord[]>(() => {
    if (!ticketsQuery.data) return []
    const data = ticketsQuery.data as unknown
    const rawList: RawSummaryApiItem[] = Array.isArray(data)
      ? (data as RawSummaryApiItem[])
      : ((data as { content?: RawSummaryApiItem[] }).content ?? [])

    return rawList.map(item => ({
      id: item.id ?? 0,
      ticketCode: item.ticketCode ?? item.ticket_code ?? '',
      customerFullName: item.customerFullName ?? item.customer_full_name ?? 'Khách lẻ',
      customerPhone: item.customerPhone ?? item.customer_phone ?? '',
      deviceModelName: item.deviceModelName ?? item.device_model_name ?? 'Chưa xác định',
      serialNumber: item.imeiOrSerial ?? item.serialNumber ?? item.serial_number ?? '—',
      branchId: item.branchId ?? item.branch_id,
      branchName: item.branchName ?? item.branch_name ?? 'Hệ thống',
      technicianName: item.technicianName ?? item.technician_name ?? 'Chưa phân công',
      totalAmount: item.totalAmount ?? item.total_amount ?? 0,
      status: item.status ?? '',
      receivedAt: item.receivedAt ?? item.received_at ?? '',
      serviceType: item.serviceType ?? item.service_type ?? item.service_type_codes_list ?? 'REPAIR',
      paymentMethod: item.paymentMethod ?? item.payment_method ?? null,
    }))
  }, [ticketsQuery.data])

  const selectedRecord = useMemo<ServiceTicketRecord | null>(() => {
    if (!selectedTicketId) return null
    return ticketList.find(t => t.id === selectedTicketId) ?? null
  }, [selectedTicketId, ticketList])

  const selectedDetail = useMemo<RawDetailResponse | null>(() => {
    if (!ticketDetailQuery.data) return null
    return ticketDetailQuery.data as RawDetailResponse
  }, [ticketDetailQuery.data])

  const filteredTickets = useMemo(() => {
    let list = ticketList
    if (branchId) list = list.filter(t => t.branchId === branchId)
    if (from) {
      const fromTime = new Date(from).getTime()
      list = list.filter(t => new Date(t.receivedAt).getTime() >= fromTime)
    }
    if (to) {
      const toTime = new Date(`${to}T23:59:59`).getTime()
      list = list.filter(t => new Date(t.receivedAt).getTime() <= toTime)
    }
    return list
  }, [ticketList, branchId, from, to])

  // Cấu hình các cột cho Bảng danh sách Phản hồi khách hàng
  const feedbackColumns: DataColumn<CustomerFeedbackRecord>[] = [
    {
      key: 'ticketCode',
      label: 'MÃ PHIẾU',
      render: row => (
        <button
          type="button"
          className="text-action"
          style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1e40af' }}
          onClick={() => {
            setShowFeedbackDrawer(false)
            setSelectedTicketId(row.ticketId)
          }}
        >
          {row.ticketCode || `#${row.ticketId}`}
        </button>
      ),
    },
    {
      key: 'customer',
      label: 'KHÁCH HÀNG',
      render: row => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', whiteSpace: 'nowrap' }}>
          <strong>{row.customerName}</strong>
          <small style={{ color: '#64748b' }}>{row.customerPhone}</small>
        </div>
      ),
    },
    {
      key: 'device',
      label: 'THIẾT BỊ & CHI NHÁNH',
      render: row => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', whiteSpace: 'nowrap' }}>
          <span>{row.deviceModelName}</span>
          <small style={{ color: '#64748b' }}>{row.branchName}</small>
        </div>
      ),
    },
    {
      key: 'satisfied',
      label: 'ĐÁNH GIÁ',
      render: row => (
        <StatusBadge
          label={row.satisfied ? 'Hài lòng' : 'Chưa hài lòng'}
          tone={row.satisfied ? 'success' : 'warning'}
        />
      ),
    },
    {
      key: 'comment',
      label: 'NHẬN XÉT CỦA KHÁCH',
      render: row => (
        <div style={{ maxWidth: '280px', whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '0.8125rem' }}>
          {row.comment ? (
            <span style={{ fontStyle: 'italic', color: '#334155' }}>"{row.comment}"</span>
          ) : (
            <span className="muted-text">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: 'THỜI GIAN',
      render: row => <span style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>{formatDateTime(row.createdAt)}</span>,
    },
  ]

  const feedbackFilters: TableFilter<CustomerFeedbackRecord>[] = [
    {
      key: 'satisfied',
      label: 'Đánh giá',
      value: feedbackSatisfiedFilter,
      onChange: setFeedbackSatisfiedFilter,
      options: [
        { value: 'true', label: 'Hài lòng' },
        { value: 'false', label: 'Chưa hài lòng' },
      ],
      matches: (row, val) => String(row.satisfied) === val,
    },
  ]

  const columns: DataColumn<ServiceTicketRecord>[] = [
    {
      key: 'ticketCode',
      label: 'MÃ PHIẾU',
      render: row => (
        <strong style={{ fontFamily: 'monospace', color: '#1e40af', whiteSpace: 'nowrap' }}>
          {row.ticketCode || `#${row.id}`}
        </strong>
      ),
    },
    {
      key: 'customer',
      label: 'KHÁCH HÀNG',
      render: row => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', whiteSpace: 'nowrap' }}>
          <strong>{row.customerFullName || 'Khách lẻ'}</strong>
          <small style={{ color: '#64748b' }}>{row.customerPhone || ''}</small>
        </div>
      ),
    },
    {
      key: 'device',
      label: 'THIẾT BỊ & SERI/IMEI',
      render: row => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', whiteSpace: 'nowrap' }}>
          <strong>{row.deviceModelName || 'Chưa xác định'}</strong>
          <small style={{ color: '#64748b', fontFamily: 'monospace' }}>
            {row.serialNumber || '—'}
          </small>
        </div>
      ),
    },
    {
      key: 'serviceType',
      label: 'LOẠI DỊCH VỤ',
      render: row => {
        const type = row.serviceType || 'REPAIR'
        const isMixed = type.includes('REPAIR') && type.includes('REPLACEMENT')
        const isReplacement = type.includes('REPLACEMENT')

        const label = isMixed ? 'THAY THẾ & SỬA CHỮA' : isReplacement ? 'THAY THẾ LINH KIỆN' : 'SỬA CHỮA'
        const bg = isMixed ? '#fef3c7' : isReplacement ? '#e0f2fe' : '#f1f5f9'
        const color = isMixed ? '#92400e' : isReplacement ? '#0369a1' : '#475569'

        return (
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '4px 8px',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
              backgroundColor: bg,
              color: color,
            }}
          >
            {label}
          </span>
        )
      },
    },
    {
      key: 'branch',
      label: 'CHI NHÁNH',
      render: row => (
        <span style={{ whiteSpace: 'nowrap' }}>
          {row.branchName ?? (row.branchId ? branchMap.get(row.branchId) : null) ?? 'Hệ thống'}
        </span>
      ),
    },
    {
      key: 'technician',
      label: 'KỸ THUẬT VIÊN',
      render: row => (
        <span style={{ whiteSpace: 'nowrap', fontSize: '0.875rem', color: row.technicianName === 'Chưa phân công' ? '#94a3b8' : '#0f172a' }}>
          {row.technicianName}
        </span>
      ),
    },
    {
      key: 'totalAmount',
      label: 'TỔNG TIỀN',
      render: row => <strong style={{ whiteSpace: 'nowrap', color: '#0f172a' }}>{formatMoney(row.totalAmount ?? 0)}</strong>,
    },
    {
      key: 'paymentMethod',
      label: 'THANH TOÁN',
      render: row => (
        <span style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
          {row.status === 'CANCELLED'
            ? 'Đã hủy'
            : row.paymentMethod
            ? (paymentMethodLabels[row.paymentMethod] ?? row.paymentMethod)
            : 'Chưa thanh toán'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'TRẠNG THÁI',
      render: row => (
        <StatusBadge
          label={(ticketStatusLabels as Record<string, string>)[row.status] ?? row.status}
          tone={
            ['COMPLETED', 'CLOSED', 'HANDED_OVER'].includes(row.status)
              ? 'success'
              : ['CANCELLED'].includes(row.status)
              ? 'warning'
              : 'info'
          }
        />
      ),
    },
    {
      key: 'receivedAt',
      label: 'NGÀY TIẾP NHẬN',
      render: row => <span style={{ whiteSpace: 'nowrap' }}>{formatDateTime(row.receivedAt)}</span>,
    },
    {
      key: 'actions',
      label: 'THAO TÁC',
      className: 'table-actions-cell',
      render: row => (
        <button
          type="button"
          className="text-action"
          style={{ whiteSpace: 'nowrap', fontWeight: 600 }}
          onClick={() => setSelectedTicketId(row.id)}
        >
          Xem chi tiết
        </button>
      ),
    },
  ]

  const filters: TableFilter<ServiceTicketRecord>[] = [
    {
      key: 'branch',
      label: 'Chi nhánh',
      value: branchId ? String(branchId) : '',
      onChange: val => setBranchId(val ? Number(val) : undefined),
      options: (branches.data ?? []).map(b => ({ value: String(b.id), label: b.name })),
      matches: (row, val) => String(row.branchId) === val,
    },
    {
      key: 'serviceType',
      label: 'Loại dịch vụ',
      value: serviceFilterType,
      onChange: val => setServiceFilterType(val),
      options: [
        { value: 'REPLACEMENT', label: 'Thay thế linh kiện' },
        { value: 'REPAIR', label: 'Sửa chữa' },
        { value: 'MIXED', label: 'Thay thế & Sửa chữa' },
      ],
      matches: (row, val) => {
        if (!val) return true
        const type = row.serviceType || 'REPAIR'
        if (val === 'MIXED') return type.includes('REPAIR') && type.includes('REPLACEMENT')
        if (val === 'REPLACEMENT') return type.includes('REPLACEMENT') && !type.includes('REPAIR')
        if (val === 'REPAIR') return type.includes('REPAIR') && !type.includes('REPLACEMENT')
        return true
      },
    },
  ]

  const parsedRepairItems = useMemo<ParsedRepairItem[]>(() => {
    const rawItems: RepairItemApiDetail[] = repairItemsQuery.data && repairItemsQuery.data.length > 0
      ? repairItemsQuery.data
      : selectedDetail?.repairItems || []

    if (rawItems.length > 0) {
      return rawItems
        .filter((item: RepairItemApiDetail) => item.approvalStatus !== 'REJECTED')
        .map((item: RepairItemApiDetail, idx: number): ParsedRepairItem => {
          const isReplacement = item.serviceType === 'REPLACEMENT' || Boolean(item.partName)
          const nameBesideBadge = item.partName || item.serviceName || (isReplacement ? 'Linh kiện thay thế' : 'Sửa chữa')
          const partDetailInfo = [item.partBrand, item.partVariant].filter(Boolean).join(' · ')

          return {
            id: item.repairItemId ?? `item-${idx}`,
            serviceType: isReplacement ? 'REPLACEMENT' : 'REPAIR',
            displayName: nameBesideBadge,
            partDetail: partDetailInfo,
            price: item.finalPrice ?? 0,
          }
        })
    }

    return []
  }, [repairItemsQuery.data, selectedDetail])

  const displayTotalAmount = useMemo(() => {
    if (parsedRepairItems.length > 0) {
      return parsedRepairItems.reduce((sum: number, item: ParsedRepairItem) => sum + item.price, 0)
    }
    return selectedRecord?.totalAmount ?? 0
  }, [parsedRepairItems, selectedRecord])

  return (
    <div className="workspace-page admin-resource-page">
      <header className="admin-page-header">
        <div>
          <span className="eyebrow">Báo cáo & Giám sát</span>
          <h1>Thống kê &amp; Báo cáo dịch vụ</h1>
          <p>Theo dõi chỉ số vận hành, doanh thu thực thu, mức độ hài lòng và chi tiết từng ca sửa chữa.</p>
        </div>
      </header>

      {/* Thanh lọc trên */}
      <div
        className="toolbar toolbar--four"
        style={{
          background: '#fff',
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '20px',
        }}
      >
        <label className="field">
          <span className="field-label">Chi nhánh</span>
          <select value={branchId ?? ''} onChange={event => setBranchId(Number(event.target.value) || undefined)}>
            <option value="">Tất cả chi nhánh</option>
            {branches.data?.map(branch => (
              <option value={branch.id} key={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Từ ngày</span>
          <input type="date" value={from} onChange={event => setFrom(event.target.value)} />
        </label>

        <label className="field">
          <span className="field-label">Đến ngày</span>
          <input type="date" value={to} onChange={event => setTo(event.target.value)} />
        </label>

        <label className="field">
          <span className="field-label">Loại thiết bị</span>
          <select value={deviceTypeId ?? ''} onChange={event => setDeviceTypeId(Number(event.target.value) || undefined)}>
            <option value="">Tất cả loại thiết bị</option>
            {deviceTypes.data?.map(type => (
              <option value={type.id} key={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginBottom: '16px', fontSize: '0.875rem', color: '#475569' }}>
        Phạm vi hiển thị: <strong style={{ color: '#0f172a' }}>{branchName}</strong>
      </div>

      {statistics.isLoading ? (
        <LoadingState label="Đang nạp dữ liệu thống kê..." />
      ) : statistics.isError ? (
        <ErrorState error={statistics.error} retry={() => statistics.refetch()} />
      ) : (
        statistics.data && (
          <>
            <div
              className="metric-strip"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
              }}
            >
              <div className="metric-card" style={{ background: '#fff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 500 }}>Tổng phiếu tiếp nhận</span>
                <strong style={{ fontSize: '1.75rem', display: 'block', marginTop: '4px', color: '#0f172a' }}>
                  {statistics.data.totalTickets}
                </strong>
                <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Theo thời gian lọc</small>
              </div>

              <div className="metric-card" style={{ background: '#fff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.8125rem', color: '#15803d', fontWeight: 500 }}>Doanh thu thực thu</span>
                <strong style={{ fontSize: '1.5rem', display: 'block', marginTop: '4px', color: '#166534' }}>
                  {formatMoney(statistics.data.paidRevenue)}
                </strong>
                <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Khoản thanh toán đã xác nhận</small>
              </div>

              <div className="metric-card" style={{ background: '#fff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.8125rem', color: '#b45309', fontWeight: 500 }}>Yêu cầu bảo hành</span>
                <strong style={{ fontSize: '1.75rem', display: 'block', marginTop: '4px', color: '#d97706' }}>
                  {statistics.data.warrantyReturnTickets}
                </strong>
                <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Số ca bảo hành phát sinh</small>
              </div>

              {feedback.data && (
                <>
                  {/* METRIC CARD: PHẢN HỒI KHÁCH HÀNG (CLICK ĐỂ MỞ DRAWER CÓ PHÂN TRANG) */}
                  <div
                    className="metric-card"
                    onClick={() => setShowFeedbackDrawer(true)}
                    style={{
                      background: '#fff',
                      padding: '16px 20px',
                      borderRadius: '12px',
                      border: '1px solid #93c5fd',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    title="Bấm để xem danh sách phản hồi & ghi chú của khách"
                  >
                    <span style={{ fontSize: '0.8125rem', color: '#1e40af', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      Lượt phản hồi (Xem danh sách)
                      <span style={{ fontSize: '0.875rem' }}>↗</span>
                    </span>
                    <strong style={{ fontSize: '1.75rem', display: 'block', marginTop: '4px', color: '#1d4ed8' }}>
                      {feedback.data.total}
                    </strong>
                    <small style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: 500 }}>Bấm để mở danh sách chi tiết</small>
                  </div>

                  <div
                    className="metric-card"
                    onClick={() => setShowFeedbackDrawer(true)}
                    style={{
                      background: '#fff',
                      padding: '16px 20px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                    }}
                    title="Bấm để xem danh sách phản hồi & ghi chú của khách"
                  >
                    <span style={{ fontSize: '0.8125rem', color: '#0f766e', fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      Tỷ lệ hài lòng
                      <span style={{ fontSize: '0.875rem' }}>↗</span>
                    </span>
                    <strong style={{ fontSize: '1.75rem', display: 'block', marginTop: '4px', color: '#0d9488' }}>
                      {Math.round(feedback.data.satisfactionRate * 100)}%
                    </strong>
                    <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                      {feedback.data.satisfied} hài lòng · {feedback.data.dissatisfied} chưa hài lòng
                    </small>
                  </div>
                </>
              )}
            </div>

            <section className="ops-section" style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
              <div className="ops-section__title" style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>PHÂN BỔ TRẠNG THÁI</span>
              </div>
              <div className="status-bars" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {statistics.data.currentStatusCounts.map(item => {
                  const percent = statistics.data.totalTickets
                    ? Math.round((item.count / statistics.data.totalTickets) * 100)
                    : 0
                  return (
                    <div key={item.status} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 60px', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.875rem', color: '#334155' }}>
                        {ticketStatusLabels[item.status] ?? item.status}
                      </span>
                      <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${percent}%`,
                            height: '100%',
                            background: '#3b82f6',
                            borderRadius: '5px',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                      <strong style={{ textAlign: 'right', fontSize: '0.875rem', color: '#0f172a' }}>{item.count}</strong>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="ops-section" style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
              <div className="ops-section__title" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>ĐÁNH GIÁ DỊCH VỤ</span>
                <button
                  type="button"
                  className="button button--quiet"
                  onClick={() => setShowFeedbackDrawer(true)}
                  style={{ fontSize: '0.8125rem' }}
                >
                  Xem tất cả ý kiến khách ↗
                </button>
              </div>
              {feedback.isLoading ? (
                <LoadingState label="Đang nạp dữ liệu phản hồi…" />
              ) : feedback.isError ? (
                <ErrorState error={feedback.error} retry={() => feedback.refetch()} />
              ) : feedback.data?.branches.length === 0 ? (
                <p style={{ color: '#64748b', margin: 0 }}>Chưa có dữ liệu phản hồi trong khoảng thời gian đã chọn.</p>
              ) : (
                feedback.data && (
                  <div className="table-wrap">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                          <th style={{ padding: '10px 12px' }}>Chi nhánh</th>
                          <th style={{ padding: '10px 12px' }}>Tổng phản hồi</th>
                          <th style={{ padding: '10px 12px' }}>Hài lòng</th>
                          <th style={{ padding: '10px 12px' }}>Chưa hài lòng</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>Tỷ lệ hài lòng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {feedback.data.branches.map(branch => (
                          <tr key={branch.branchId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 500 }}>{branch.branchName}</td>
                            <td style={{ padding: '10px 12px' }}>{branch.total}</td>
                            <td style={{ padding: '10px 12px', color: '#16a34a', fontWeight: 600 }}>{branch.satisfied}</td>
                            <td style={{ padding: '10px 12px', color: '#dc2626', fontWeight: 600 }}>{branch.dissatisfied}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#0f766e' }}>
                              {Math.round(branch.satisfactionRate * 100)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </section>

            <section className="ops-section" style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div className="ops-section__title" style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>LỊCH SỬ CÁC CA DỊCH VỤ</span>
              </div>

              {ticketsQuery.isLoading ? (
                <LoadingState label="Đang tải danh sách ca dịch vụ…" />
              ) : ticketsQuery.isError ? (
                <ErrorState error={ticketsQuery.error} retry={() => ticketsQuery.refetch()} />
              ) : (
                <AdminDataTable
                  rows={filteredTickets}
                  rowKey={row => row.id}
                  columns={columns}
                  filters={filters}
                  searchPlaceholder="Tìm theo mã phiếu, tên khách, SĐT, IMEI, Model hoặc KTV..."
                  searchableText={row => {
                    const name = row.customerFullName || ''
                    const phone = row.customerPhone || ''
                    const branch = row.branchName || ''
                    const method = row.paymentMethod ? (paymentMethodLabels[row.paymentMethod] ?? row.paymentMethod) : ''
                    return `${row.ticketCode} ${name} ${phone} ${row.deviceModelName ?? ''} ${row.serialNumber ?? ''} ${row.technicianName ?? ''} ${branch} ${method}`
                  }}
                  sortOptions={[
                    { value: 'date-desc', label: 'Mới nhất', compare: (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime() },
                    { value: 'date-asc', label: 'Cũ nhất', compare: (a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime() },
                    { value: 'code-asc', label: 'Mã phiếu A-Z', compare: (a, b) => compareText(a.ticketCode, b.ticketCode) },
                    { value: 'amount-desc', label: 'Giá trị cao nhất', compare: (a, b) => (b.totalAmount ?? 0) - (a.totalAmount ?? 0) },
                  ]}
                />
              )}
            </section>
          </>
        )
      )}

      {/* DRAWER DANH SÁCH PHẢN HỒI KÈM PHÂN TRANG & BỘ LỌC */}
      {showFeedbackDrawer && (
        <DetailDrawer
          eyebrow="Ý kiến khách hàng"
          title="Danh sách Phản hồi &amp; Nhận xét của Khách"
          onClose={() => setShowFeedbackDrawer(false)}
          footer={
            <button type="button" className="button button--quiet" onClick={() => setShowFeedbackDrawer(false)}>
              Đóng
            </button>
          }
        >
          <div style={{ marginTop: '12px' }}>
            {feedbacksQuery.isLoading ? (
              <LoadingState label="Đang tải danh sách phản hồi…" />
            ) : feedbacksQuery.isError ? (
              <ErrorState error={feedbacksQuery.error as Error} />
            ) : (
              <AdminDataTable
                rows={feedbacksQuery.data ?? []}
                rowKey={row => row.id}
                columns={feedbackColumns}
                filters={feedbackFilters}
                searchPlaceholder="Tìm kiếm mã phiếu, khách hàng, SĐT hoặc nội dung nhận xét..."
                searchableText={row => `${row.ticketCode} ${row.customerName} ${row.customerPhone} ${row.comment ?? ''} ${row.deviceModelName} ${row.branchName}`}
                sortOptions={[
                  { value: 'date-desc', label: 'Thời gian mới nhất', compare: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() },
                  { value: 'date-asc', label: 'Thời gian cũ nhất', compare: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() },
                ]}
              />
            )}
          </div>
        </DetailDrawer>
      )}

      {/* DRAWER CHI TIẾT CA DỊCH VỤ (HIỂN THỊ PHƯƠNG THỨC THANH TOÁN) */}
      {selectedRecord && (
        <DetailDrawer
          eyebrow="Chi tiết ca dịch vụ"
          title={`Phiếu: ${selectedRecord.ticketCode || `#${selectedRecord.id}`}`}
          onClose={() => setSelectedTicketId(null)}
          footer={
            <button type="button" className="button button--quiet" onClick={() => setSelectedTicketId(null)}>
              Đóng
            </button>
          }
        >
          <div className="drawer-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '10px' }}>
            
            <div style={{ 
              background: '#f8fafc', 
              padding: '16px', 
              borderRadius: '12px', 
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                  Trạng thái xử lý
                </span>
                <span style={{ fontSize: '0.875rem', fontFamily: 'monospace', fontWeight: 700, color: '#1e40af' }}>
                  {selectedRecord.ticketCode}
                </span>
              </div>
              
              <div style={{ paddingTop: '4px' }}>
                <StatusBadge
                  label={(ticketStatusLabels as Record<string, string>)[selectedRecord.status] ?? selectedRecord.status}
                  tone={['COMPLETED', 'CLOSED', 'HANDED_OVER'].includes(selectedRecord.status) ? 'success' : 'info'}
                />
              </div>
            </div>

            <div className="detail-section">
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1e293b', marginBottom: '10px', textTransform: 'uppercase' }}>KHÁCH HÀNG &amp; CHI NHÁNH</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.875rem' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block' }}>Khách hàng</span>
                  <strong>{selectedRecord.customerFullName || 'Khách lẻ'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block' }}>Số điện thoại</span>
                  <strong>{selectedRecord.customerPhone || '—'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block' }}>Chi nhánh tiếp nhận</span>
                  <span>{selectedRecord.branchName || 'Hệ thống'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block' }}>Kỹ thuật viên phụ trách</span>
                  <strong style={{ color: selectedRecord.technicianName !== 'Chưa phân công' ? '#0f172a' : '#94a3b8' }}>
                    {selectedRecord.technicianName}
                  </strong>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1e293b', marginBottom: '10px', textTransform: 'uppercase' }}>THIẾT BỊ &amp; THANH TOÁN</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.875rem' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block' }}>Dòng máy / Model</span>
                  <strong>{selectedRecord.deviceModelName || 'Chưa xác định'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block' }}>Số IMEI / Serial</span>
                  <span style={{ fontFamily: 'monospace' }}>{selectedRecord.serialNumber || '—'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block' }}>Phương thức thanh toán</span>
                  <strong style={{ color: selectedRecord.status === 'CANCELLED' ? '#94a3b8' : '#1e40af' }}>
                    {(() => {
                      if (selectedRecord.status === 'CANCELLED') {
                        return 'Phiếu đã hủy (Không phát sinh thanh toán)'
                      }
                      const method =
                        selectedDetail?.ticket?.paymentMethod ??
                        selectedDetail?.ticket?.payment_method ??
                        selectedDetail?.paymentMethod ??
                        selectedDetail?.payment_method ??
                        selectedRecord.paymentMethod

                      return method ? (paymentMethodLabels[method] ?? method) : 'Chưa thanh toán'
                    })()}
                  </strong>
                </div>
                {(() => {
                  const paidAt =
                    selectedDetail?.ticket?.paidAt ??
                    selectedDetail?.ticket?.paid_at ??
                    selectedDetail?.paidAt ??
                    selectedDetail?.paid_at

                  return paidAt ? (
                    <div>
                      <span style={{ color: '#64748b', display: 'block' }}>Thời gian thanh toán</span>
                      <span>{formatDateTime(paidAt)}</span>
                    </div>
                  ) : null
                })()}
              </div>
            </div>

            {/* BẢNG DỊCH VỤ & CHI PHÍ */}
            <div className="detail-section">
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1e293b', marginBottom: '10px', textTransform: 'uppercase' }}>
                CHI TIẾT DỊCH VỤ &amp; CHI PHÍ
              </h3>
              {repairItemsQuery.isLoading ? (
                <LoadingState label="Đang tải chi tiết dịch vụ &amp; linh kiện..." />
              ) : parsedRepairItems.length > 0 ? (
                <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse', marginBottom: '10px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px' }}>Hạng mục thực hiện</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Đơn giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRepairItems.map((item: ParsedRepairItem) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              whiteSpace: 'nowrap',
                              backgroundColor: item.serviceType === 'REPLACEMENT' ? '#e0f2fe' : '#f1f5f9',
                              color: item.serviceType === 'REPLACEMENT' ? '#0369a1' : '#475569'
                            }}>
                              {item.serviceType === 'REPLACEMENT' ? 'THAY THẾ LINH KIỆN' : 'SỬA CHỮA'}
                            </span>

                            <strong style={{ color: '#0f172a', fontSize: '0.875rem' }}>
                              {item.displayName}
                            </strong>
                          </div>

                          {item.partDetail && (
                            <div style={{ 
                              marginTop: '4px', 
                              fontSize: '0.75rem', 
                              color: '#64748b'
                            }}>
                              Loại linh kiện: {item.partDetail}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#0f172a', verticalAlign: 'top' }}>
                          {formatMoney(item.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 10px' }}>Chưa ghi nhận linh kiện / chi phí dịch vụ.</p>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px dashed #cbd5e1' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Tổng tiền dịch vụ:</span>
                <strong style={{ fontSize: '1.25rem', color: '#1e40af' }}>
                  {formatMoney(displayTotalAmount)}
                </strong>
              </div>
            </div>
          </div>
        </DetailDrawer>
      )}
    </div>
  )
}