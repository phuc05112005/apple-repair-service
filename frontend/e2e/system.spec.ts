import { expect, test, type Page, type Route } from '@playwright/test'

type Role = 'ADMIN' | 'RECEPTIONIST' | 'TECHNICIAN'

const json = (route: Route, body: unknown, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

async function authenticated(page: Page, role: Role) {
  await page.addInitScript(() => {
    sessionStorage.setItem('taocare.internal.auth', JSON.stringify({ token: 'e2e-token', expiresAt: '2099-01-01T00:00:00Z' }))
  })
  await page.route('**/api/v1/auth/me', route => json(route, {
    id: role === 'RECEPTIONIST' ? 2 : role === 'TECHNICIAN' ? 3 : 1,
    username: role.toLowerCase(),
    fullName: role === 'RECEPTIONIST' ? 'Nguyễn Tiếp Nhận' : role === 'TECHNICIAN' ? 'Trần Kỹ Thuật' : 'Quản trị viên',
    role,
    status: 'ACTIVE',
  }))
}

function ticketDetail(status: string, options: { finalPrice?: number | null; warranty?: boolean } = {}) {
  const finalPrice = options.finalPrice === undefined ? 900_000 : options.finalPrice
  return {
    ticket: {
      id: 101,
      ticketCode: 'ST-20261006-000101',
      appointmentDeviceId: 51,
      customerDeviceId: 61,
      branchId: 1,
      createdById: 2,
      status,
      receivedCondition: 'Máy nguyên vẹn, pin yếu',
      inspectionResult: null,
      inspectedById: null,
      discountPercent: 10,
      paymentStatus: 'PENDING',
      paymentMethod: null,
      paidAt: null,
      handedOverById: null,
      handedOverAt: null,
      cancelReason: null,
      receivedAt: '2026-10-06T09:00:00',
      updatedAt: '2026-10-06T09:05:00',
      authorizedScope: null,
      timing: {
        assignmentDueAt: '2026-10-06T09:15:00',
        initialEstimatedStartAt: '2026-10-06T09:30:00',
        estimatedStartAt: '2026-10-06T10:15:00',
        initialEstimatedCompletionAt: '2026-10-06T10:30:00',
        estimatedCompletionAt: '2026-10-06T11:13:00',
        estimatedDurationMinutes: 58,
        actualRepairStartedAt: null,
        actualRepairCompletedAt: null,
        estimateSource: 'STANDARD',
      },
    },
    repairItems: [{
      id: 201,
      serviceTicketId: 101,
      serviceCatalogItemId: 301,
      itemNameSnapshot: 'Thay pin iPhone 16 Pro',
      approvalStatus: 'APPROVED',
      basePrice: finalPrice,
      finalPrice,
      approvalRecordedById: 2,
      approvalDecisionAt: '2026-10-06T09:00:00',
      approvalResolvedAt: '2026-10-06T09:00:00',
      approvalNote: 'Khách đồng ý trực tiếp',
      warrantyStartDate: options.warranty ? '2026-09-01' : null,
      warrantyEndDate: options.warranty ? '2027-03-01' : null,
      warrantySourceItemId: options.warranty ? 88 : null,
      warrantyDecision: options.warranty ? 'APPROVED' : null,
      warrantyDecisionNote: options.warranty ? 'Đủ điều kiện' : null,
      createdAt: '2026-10-06T09:00:00',
      updatedAt: '2026-10-06T09:00:00',
      confirmationMethod: 'DIRECT',
      warrantyRemedy: options.warranty ? 'REPAIR' : null,
      warrantyReplacementCatalogId: null,
      expectedPartId: null,
    }],
    history: [{
      id: 1,
      serviceTicketId: 101,
      fromStatus: null,
      toStatus: status,
      changedById: 2,
      note: 'Intake',
      changedAt: '2026-10-06T09:00:00',
      resolvedAt: null,
      resolutionRecordedAt: null,
      resolvedById: null,
      resolutionNote: null,
    }],
    context: {
      customerId: 11,
      customerFullName: 'Lê Minh Khách',
      customerPhone: '0900000000',
      customerDeviceId: 61,
      deviceModelId: 71,
      deviceModelName: 'iPhone 16 Pro',
      deviceTypeName: 'iPhone',
      serialNumber: 'TEST-SERIAL',
      storage: '256 GB',
      symptomDescription: 'Pin tụt nhanh',
      branchId: 1,
      branchName: 'TáoCare Trung tâm',
      serviceIssues: ['Pin'],
      requestedServices: ['Thay pin iPhone 16 Pro'],
    },
  }
}

const recommendations = [{
  technicianId: 3,
  technicianName: 'Trần Kỹ Thuật',
  branchId: 1,
  estimatedWorkloadMinutes: 45,
  predictedNewJobMinutes: 58,
  remainingShiftMinutes: 360,
  estimatedAvailableAt: '2026-10-06T10:15:00',
  eligible: true,
  reason: 'Đang trong ca và có đủ thời gian xử lý',
  queuedJobs: 2,
  predictedTechnicalMinutes: 58,
  predictionSource: 'ML',
  predictionWarnings: ['UNSEEN_CATALOG_CATEGORY'],
  estimatedStartAt: '2026-10-06T10:15:00',
  estimatedCompletionAt: '2026-10-06T11:13:00',
  modelStatus: 'READY',
  syntheticData: false,
  productionValidated: false,
}, {
  technicianId: 4,
  technicianName: 'Phạm Kỹ Thuật',
  branchId: 1,
  estimatedWorkloadMinutes: 20,
  predictedNewJobMinutes: 60,
  remainingShiftMinutes: 360,
  estimatedAvailableAt: '2026-10-06T09:50:00',
  eligible: true,
  reason: 'Đang trong ca và có đủ thời gian xử lý',
  queuedJobs: 1,
  predictedTechnicalMinutes: 60,
  predictionSource: 'STANDARD_DURATION_FALLBACK',
  predictionWarnings: ['ML_TIMEOUT'],
  estimatedStartAt: '2026-10-06T09:50:00',
  estimatedCompletionAt: '2026-10-06T10:50:00',
  modelStatus: null,
  syntheticData: false,
  productionValidated: false,
}]

async function mockReceptionistTicket(page: Page, status = 'WAITING_ASSIGNMENT') {
  await authenticated(page, 'RECEPTIONIST')
  await page.route('**/api/v1/internal/service-tickets/101', route => json(route, ticketDetail(status)))
  await page.route('**/api/v1/internal/service-tickets/101/technician-recommendations', route => json(route, recommendations))
}

test('public navigation does not expose staff login or internal links', async ({ page }) => {
  await page.route('**/api/v1/**', route => json(route, []))
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Đặt lịch ngay' })).toBeVisible()
  await expect(page.locator('a[href*="internal"]')).toHaveCount(0)
  await expect(page.getByText(/đăng nhập nhân viên/i)).toHaveCount(0)
})

test('role guard keeps a receptionist out of the admin workspace', async ({ page }) => {
  await authenticated(page, 'RECEPTIONIST')
  await page.goto('/internal/admin')
  await expect(page).toHaveURL(/\/internal\/receptionist$/)
  await expect(page.getByText('Nhân viên tiếp nhận', { exact: true }).first()).toBeVisible()
})

test('recommendations distinguish ML and fallback and assign only after confirmation', async ({ page }) => {
  await mockReceptionistTicket(page)
  let assignmentPosts = 0
  await page.route('**/api/v1/internal/service-tickets/101/assignments', route => {
    assignmentPosts += 1
    return json(route, { id: 1, serviceTicketId: 101, technicianId: 3, technicianName: 'Trần Kỹ Thuật', assignedById: 2, source: 'ACCEPTED_RECOMMENDATION', status: 'ACTIVE', assignedAt: '2026-10-06T09:10:00', endedAt: null, note: null }, 201)
  })

  await page.goto('/internal/receptionist/tickets/101')
  await expect(page.getByText('Dự đoán theo mô hình')).toBeVisible()
  await expect(page.getByText('Ước tính theo thời gian chuẩn')).toBeVisible()
  await expect(page.getByText('Thời lượng kỹ thuật').first()).toBeVisible()
  await expect(page.getByText('Dự kiến hoàn tất').first()).toBeVisible()
  await expect(page.getByText('Ước tính sử dụng danh mục dịch vụ mới.')).toBeVisible()
  await expect(page.getByText('UNSEEN_CATALOG_CATEGORY')).toHaveCount(0)
  expect(assignmentPosts).toBe(0)

  await page.getByRole('button', { name: 'Chọn kỹ thuật viên' }).first().click()
  expect(assignmentPosts).toBe(0)
  await expect(page.getByRole('dialog')).toContainText('Trần Kỹ Thuật')
  await page.getByRole('button', { name: 'Xác nhận phân công' }).click()
  await expect.poll(() => assignmentPosts).toBe(1)
})

test('stale assignment conflict is explained and refreshes ticket and candidates', async ({ page }) => {
  await authenticated(page, 'RECEPTIONIST')
  let ticketGets = 0
  let recommendationGets = 0
  await page.route('**/api/v1/internal/service-tickets/101', route => { ticketGets += 1; return json(route, ticketDetail('WAITING_ASSIGNMENT')) })
  await page.route('**/api/v1/internal/service-tickets/101/technician-recommendations', route => { recommendationGets += 1; return json(route, recommendations) })
  await page.route('**/api/v1/internal/service-tickets/101/assignments', route => json(route, {
    timestamp: '2026-10-06T09:10:00', status: 409, error: 'Conflict', code: 'ASSIGNMENT_CONFLICT',
    message: 'Kỹ thuật viên không còn khả dụng. Danh sách đã được cập nhật.', path: route.request().url(), fieldErrors: [],
  }, 409))

  await page.goto('/internal/receptionist/tickets/101')
  await page.getByRole('button', { name: 'Chọn kỹ thuật viên' }).first().click()
  await page.getByRole('button', { name: 'Xác nhận phân công' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Kỹ thuật viên không còn khả dụng')
  await expect.poll(() => ticketGets).toBeGreaterThan(1)
  await expect.poll(() => recommendationGets).toBeGreaterThan(1)
})

test('assignment actions are hidden outside WAITING_ASSIGNMENT', async ({ page }) => {
  await mockReceptionistTicket(page, 'ASSIGNED')
  await page.goto('/internal/receptionist/tickets/101')
  await expect(page.getByRole('button', { name: 'Chọn kỹ thuật viên' })).toHaveCount(0)
  await expect(page.getByText('Phân công kỹ thuật viên')).toHaveCount(0)
})

test('changing device type or model clears dependent selections', async ({ page }) => {
  await page.route('**/api/v1/device-types', route => json(route, [{ id: 1, name: 'iPhone' }, { id: 2, name: 'iPad' }]))
  await page.route('**/api/v1/device-models?deviceTypeId=1', route => json(route, [{ id: 11, deviceTypeId: 1, name: 'iPhone 16 Pro' }, { id: 12, deviceTypeId: 1, name: 'iPhone 15' }]))
  await page.route('**/api/v1/device-models?deviceTypeId=2', route => json(route, [{ id: 21, deviceTypeId: 2, name: 'iPad Pro' }]))
  await page.route('**/api/v1/service-issues?deviceTypeId=1', route => json(route, [{ id: 31, name: 'Pin' }]))
  await page.route('**/api/v1/service-issues?deviceTypeId=2', route => json(route, [{ id: 32, name: 'Màn hình' }]))
  await page.route('**/api/v1/service-catalog-items**', route => json(route, []))

  await page.goto('/devices')
  await page.getByRole('button', { name: /iPhone$/ }).click()
  await page.getByRole('button', { name: /iPhone 16 Pro/ }).click()
  await page.getByRole('button', { name: /Pin/ }).click()
  await expect(page.locator('.selection-summary')).toContainText('Pin')
  await page.getByRole('button', { name: /iPhone 15/ }).click()
  await expect(page.locator('.selection-summary')).toContainText('Vấn đề')
  await page.getByRole('button', { name: /iPad$/ }).click()
  await expect(page.locator('.selection-summary')).toContainText('Model')
  await expect(page.getByText('iPhone 16 Pro')).toHaveCount(0)
})

test('missing final price blocks payment with backend business message', async ({ page }) => {
  await authenticated(page, 'RECEPTIONIST')
  await page.route('**/api/v1/internal/service-tickets/101', route => json(route, ticketDetail('WAITING_HANDOVER', { finalPrice: null })))
  await page.route('**/api/v1/internal/service-tickets/101/payment-summary', route => json(route, {
    timestamp: '2026-10-06T12:00:00', status: 409, error: 'Conflict', code: 'PRICE_REQUIRED',
    message: 'Phiếu còn hạng mục chưa xác định giá. Vui lòng cập nhật giá trước khi thanh toán.', path: route.request().url(), fieldErrors: [],
  }, 409))
  await page.goto('/internal/receptionist/tickets/101')
  await expect(page.getByRole('alert')).toContainText('Phiếu còn hạng mục chưa xác định giá')
  await expect(page.getByRole('button', { name: 'Ghi nhận thanh toán' })).toHaveCount(0)
})

test('zero total is settled before handover', async ({ page }) => {
  await authenticated(page, 'RECEPTIONIST')
  let settled = false
  let settlePosts = 0
  let handoverPosts = 0
  await page.route('**/api/v1/internal/service-tickets/101', route => json(route, ticketDetail('WAITING_HANDOVER', { finalPrice: 0 })))
  await page.route('**/api/v1/internal/service-tickets/101/payment-summary', route => json(route, { serviceTicketId: 101, totalAmount: 0, paymentStatus: settled ? 'PAID' : 'PENDING', paymentMethod: null, paidAt: settled ? '2026-10-06T12:00:00' : null }))
  await page.route('**/api/v1/internal/service-tickets/101/payment/settle-zero', route => { settlePosts += 1; settled = true; return json(route, { serviceTicketId: 101, totalAmount: 0, paymentStatus: 'PAID', paymentMethod: null, paidAt: '2026-10-06T12:00:00' }) })
  await page.route('**/api/v1/internal/service-tickets/101/handover', route => { handoverPosts += 1; return json(route, ticketDetail('HANDED_OVER', { finalPrice: 0 })) })

  await page.goto('/internal/receptionist/tickets/101')
  await page.getByRole('button', { name: 'Quyết toán 0 đồng' }).click()
  await expect.poll(() => settlePosts).toBe(1)
  await page.getByRole('button', { name: 'Xác nhận bàn giao' }).click()
  await expect.poll(() => handoverPosts).toBe(1)
})

test('technician sees only legal ASSIGNED action and warranty remedy wording', async ({ page }) => {
  await authenticated(page, 'TECHNICIAN')
  await page.route('**/api/v1/internal/service-tickets/101', route => json(route, ticketDetail('ASSIGNED', { finalPrice: 0, warranty: true })))
  await page.route('**/api/v1/internal/service-tickets/101/repair-duration', route => json(route, { serviceTicketId: 101, completedRepairMinutes: 0, currentRepairMinutes: 0 }))
  await page.route('**/api/v1/internal/service-tickets/101/transfer-candidates', route => json(route, []))
  await page.route('**/api/v1/internal/service-tickets/101/defective-part-returns', route => json(route, []))
  await page.goto('/internal/technician/tickets/101')
  await expect(page.getByRole('button', { name: 'Bắt đầu kiểm tra' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hoàn tất sửa chữa' })).toHaveCount(0)
  await expect(page.getByText('Bảo hành miễn phí · Sửa chữa')).toBeVisible()
  await expect(page.getByText(/technical action/i)).toHaveCount(0)
})

test('feedback appears only for handed-over tickets and empty lookup is explicit', async ({ page }) => {
  await page.route('**/api/v1/appointments/lookup**', route => json(route, []))
  await page.route('**/api/v1/service-tickets/lookup**', route => json(route, [{
    ticketCode: 'ST-OPEN', deviceModelName: 'iPhone 15', branchName: 'TáoCare', status: 'REPAIRING', paymentStatus: 'PENDING', approvedTotal: 500000,
    receivedAt: '2026-10-06T09:00:00', handedOverAt: null, repairItems: [],
  }, {
    ticketCode: 'ST-DONE', deviceModelName: 'iPhone 16 Pro', branchName: 'TáoCare', status: 'HANDED_OVER', paymentStatus: 'PAID', approvedTotal: 0,
    receivedAt: '2026-10-05T09:00:00', handedOverAt: '2026-10-05T12:00:00', repairItems: [],
  }]))
  await page.goto('/lookup')
  await page.getByPlaceholder('Nhập số điện thoại').fill('0900000000')
  await page.getByRole('button', { name: 'Tra cứu' }).click()
  await expect(page.getByText('Không tìm thấy lịch hẹn')).toBeVisible()
  await page.getByText('Mã tra cứu: ST-OPEN').click()
  await expect(page.getByText('Trải nghiệm dịch vụ của bạn thế nào?')).toHaveCount(0)
  await page.getByText('Mã tra cứu: ST-DONE').click()
  await expect(page.getByText('Trải nghiệm dịch vụ của bạn thế nào?')).toBeVisible()
})
