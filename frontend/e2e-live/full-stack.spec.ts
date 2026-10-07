import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

test.skip(process.env.LIVE_E2E !== 'true', 'Set LIVE_E2E=true to run against the isolated Docker stack.')

// Live API responses intentionally stay open because this test crosses many endpoint DTOs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>

async function api(request: APIRequestContext, method: string, path: string, body?: Json, token?: string) {
  const response = await request.fetch(path, {
    method,
    data: body,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  const text = await response.text()
  expect(response.ok(), `${method} ${path} returned ${response.status()}: ${text}`).toBeTruthy()
  return text ? JSON.parse(text) : undefined
}

async function login(request: APIRequestContext, username: string, password: string) {
  return api(request, 'POST', '/api/v1/auth/login', { username, password })
}

async function uiLogin(page: Page, username: string, password: string) {
  await page.goto('/internal/login')
  await page.getByPlaceholder('Nhập tên đăng nhập').fill(username)
  await page.getByPlaceholder('Nhập mật khẩu').fill(password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await page.waitForURL(/\/internal\/(admin|receptionist|technician)(?:\/)?$/)
}

function vietnamParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type: string) => parts.find(part => part.type === type)!.value
  return { date: `${value('year')}-${value('month')}-${value('day')}`, time: `${value('hour')}:${value('minute')}:${value('second')}` }
}

test('live browser flow uses Spring, MySQL, FastAPI and CatBoost without mocks', async ({ page, request }) => {
  const run = Date.now().toString().slice(-8)
  const phone = `09${run}`
  const adminLogin = await login(request, 'admin', 'Admin-demo-2026!')
  const adminToken = adminLogin.accessToken
  const branches = await api(request, 'GET', '/api/v1/admin/branches', undefined, adminToken)
  const branch = branches.find((item: Json) => item.status === 'ACTIVE')
  const users = await api(request, 'GET', '/api/v1/admin/users', undefined, adminToken)
  const receptionist = users.find((item: Json) => item.username === 'reception01')
  if (!receptionist) {
    await api(request, 'POST', '/api/v1/admin/users', {
      username: 'reception01', password: '123456', fullName: 'Nhân viên tiếp nhận Live E2E',
      phone: null, role: 'RECEPTIONIST', status: 'ACTIVE',
    }, adminToken)
  }

  const modelExpectations: Array<[string, string, string | undefined]> = [
    ['iPhone', '11', undefined], ['iPad', 'iPad thế hệ 9', undefined],
    ['MacBook', 'MacBook Air M1', undefined], ['Apple Watch', 'Apple Watch Series 6', undefined],
    ['AirPods', 'AirPods thế hệ 1', 'Camera'],
  ]
  const types = await api(request, 'GET', '/api/v1/device-types')
  for (const [typeName, modelName, forbiddenIssue] of modelExpectations) {
    const type = types.find((item: Json) => item.name === typeName)
    const models = await api(request, 'GET', `/api/v1/device-models?deviceTypeId=${type.id}`)
    expect(models.some((item: Json) => item.name === modelName)).toBeTruthy()
    const issues = await api(request, 'GET', `/api/v1/service-issues?deviceTypeId=${type.id}`)
    if (forbiddenIssue) expect(issues.some((item: Json) => item.name === forbiddenIssue)).toBeFalsy()
  }

  const catalog = await api(request, 'GET', '/api/v1/service-catalog-items?deviceModelId=405&serviceIssueId=298')
  const replacement = catalog.find((item: Json) => item.id === 1130)
  expect(replacement.serviceTypeCode).toBe('REPLACEMENT')
  await api(request, 'POST', '/api/v1/admin/inventory/stock-in', {
    lotCode: `LIVE-${run}`, branchId: branch.id, partId: replacement.partId, quantity: 10,
    receivedAt: `${vietnamParts(new Date()).date}T${vietnamParts(new Date()).time}`,
    receivedByUserId: adminLogin.userId, sourceNote: 'Fixture cách ly cho live E2E',
  }, adminToken)

  const startsAt = new Date(Date.now() + 45_000)
  const endsAt = new Date(startsAt.getTime() + 30 * 60_000)
  const start = vietnamParts(startsAt)
  const end = vietnamParts(endsAt)
  expect(end.date).toBe(start.date)
  const slot = await api(request, 'POST', '/api/v1/admin/appointment-slots', {
    branchId: branch.id, slotDate: start.date, startTime: start.time, endTime: end.time,
  }, adminToken)

  await page.goto('/booking')
  await expect(page.getByRole('heading', { name: /Rõ ràng từng bước/ })).toBeVisible()
  const appointment = await api(request, 'POST', '/api/v1/appointments', {
    customerFullName: 'Khách hàng Live E2E', phone, appointmentSlotId: slot.slotId, note: 'Live full-stack',
    devices: [{ deviceModelId: 405, symptomDescription: 'Pin tụt nhanh', serviceItems: [{ serviceCatalogItemId: replacement.id }] }],
  })

  const receptionistLogin = await login(request, 'reception01', '123456')
  const receptionistToken = receptionistLogin.accessToken
  await api(request, 'POST', `/api/v1/internal/appointments/${appointment.appointmentId}/confirm`, {}, receptionistToken)
  const delay = startsAt.getTime() - Date.now() + 1_500
  if (delay > 0) await page.waitForTimeout(delay)
  const arrived = await api(request, 'POST', `/api/v1/internal/appointments/${appointment.appointmentId}/arrive`, {}, receptionistToken)
  expect(arrived.appointment.status).toBe('ARRIVED')
  const appointmentDeviceId = arrived.devices[0].device.id
  const intake = await api(request, 'POST', `/api/v1/internal/appointment-devices/${appointmentDeviceId}/intake`, {
    serialNumber: `LIVE-${run}`, storage: '128 GB', receivedCondition: 'Máy nguyên vẹn, pin tụt nhanh',
    serviceCatalogItemIds: [replacement.id],
  }, receptionistToken)
  const ticketId = intake.ticket.id
  const ticketCode = intake.ticket.ticketCode

  await uiLogin(page, 'reception01', '123456')
  await page.goto(`/internal/receptionist/tickets/${ticketId}`)
  await expect(page.getByRole('heading', { name: 'Phiếu dịch vụ' })).toBeVisible()
  await expect(page.getByText('Dự đoán theo mô hình').first()).toBeVisible({ timeout: 30_000 })
  const recommendations = await api(request, 'GET', `/api/v1/internal/service-tickets/${ticketId}/technician-recommendations`, undefined, receptionistToken)
  expect(recommendations.length).toBeGreaterThanOrEqual(5)
  const selected = recommendations.find((item: Json) => item.eligible && item.predictionSource === 'ML' && item.estimatedCompletionAt)
  expect(selected).toBeTruthy()
  expect(selected.predictedTechnicalMinutes).toBeGreaterThan(0)
  expect(selected.estimatedStartAt).toBeTruthy()
  const card = page.locator('article.recommendation', { hasText: selected.technicianName })
  await card.getByRole('button', { name: 'Chọn kỹ thuật viên' }).click()
  await page.getByRole('button', { name: 'Xác nhận phân công' }).click()
  await expect(page.getByText('Đã phân công').first()).toBeVisible({ timeout: 20_000 })

  const refreshedUsers = await api(request, 'GET', '/api/v1/admin/users', undefined, adminToken)
  const technician = refreshedUsers.find((item: Json) => item.id === selected.technicianId)
  const technicianLogin = await login(request, technician.username, '123456')
  const technicianToken = technicianLogin.accessToken
  await api(request, 'POST', `/api/v1/internal/service-tickets/${ticketId}/inspection/start`, {}, technicianToken)
  let detail = await api(request, 'POST', `/api/v1/internal/service-tickets/${ticketId}/inspection`, {
    inspectionResult: 'Pin suy giảm, cần thay đúng linh kiện đã đặt', requiresCustomerApproval: false,
    confirmationMethod: 'DIRECT', confirmationNote: 'Khách xác nhận trực tiếp phương án đã đặt',
    items: [{ serviceCatalogItemId: replacement.id, basePrice: replacement.displayPrice, finalPrice: replacement.onlinePrice }],
  }, technicianToken)
  expect(detail.ticket.status).toBe('REPAIRING')
  await api(request, 'POST', `/api/v1/internal/service-tickets/${ticketId}/wait-for-part`, { note: 'Đang lấy linh kiện từ kho' }, technicianToken)
  await api(request, 'POST', `/api/v1/internal/service-tickets/${ticketId}/wait/resolve`, {
    note: 'Linh kiện đã sẵn sàng',
  }, technicianToken)
  await api(request, 'POST', `/api/v1/internal/service-tickets/${ticketId}/resume-repair`, {}, technicianToken)
  detail = await api(request, 'GET', `/api/v1/internal/service-tickets/${ticketId}`, undefined, technicianToken)
  const repairItem = detail.repairItems.find((item: Json) => item.serviceCatalogItemId === replacement.id && item.approvalStatus === 'APPROVED')
  await api(request, 'POST', `/api/v1/internal/repair-items/${repairItem.id}/part-usages`, {
    partId: replacement.partId, quantity: 1,
  }, technicianToken)
  detail = await api(request, 'POST', `/api/v1/internal/service-tickets/${ticketId}/finish-repair`, {}, technicianToken)
  expect(detail.ticket.status).toBe('WAITING_HANDOVER')

  const summary = await api(request, 'GET', `/api/v1/internal/service-tickets/${ticketId}/payment-summary`, undefined, receptionistToken)
  expect(summary.totalAmount).toBeGreaterThan(0)
  await api(request, 'POST', `/api/v1/internal/service-tickets/${ticketId}/payment`, { paymentMethod: 'CASH' }, receptionistToken)
  const handedOver = await api(request, 'POST', `/api/v1/internal/service-tickets/${ticketId}/handover`, {}, receptionistToken)
  expect(handedOver.ticket.status).toBe('HANDED_OVER')

  await page.evaluate(() => sessionStorage.clear())
  await page.goto('/lookup')
  await page.getByPlaceholder('Nhập số điện thoại').fill(phone)
  await page.getByRole('button', { name: 'Tra cứu' }).click()
  await expect(page.getByText(`Mã tra cứu: ${ticketCode}`)).toBeVisible()
  await page.getByText(`Mã tra cứu: ${ticketCode}`).click()
  await page.getByRole('button', { name: 'Hài lòng', exact: true }).click()
  await page.getByPlaceholder('Nhập chia sẻ về trải nghiệm của bạn').fill('Luồng live E2E hoàn tất tốt.')
  await page.getByRole('button', { name: 'Gửi phản hồi' }).click()
  await expect(page.getByText('Cảm ơn bạn đã gửi phản hồi.')).toBeVisible()
})
