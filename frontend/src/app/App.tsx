import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireRole, RoleHome } from '../auth/RouteGuards'
import { InternalLayout } from '../layouts/InternalLayout'
import { PublicLayout } from '../layouts/PublicLayout'
import { LoadingState } from '../components/AsyncState'

const HomePage = lazy(() => import('../pages/public/HomePage').then(module => ({ default: module.HomePage })))
const DevicesPage = lazy(() => import('../pages/public/DevicesPage').then(module => ({ default: module.DevicesPage })))
const BookingPage = lazy(() => import('../pages/public/BookingPage').then(module => ({ default: module.BookingPage })))
const LookupPage = lazy(() => import('../pages/public/LookupPage').then(module => ({ default: module.LookupPage })))
const BlockedTicketPage = lazy(() => import('../pages/public/BlockedTicketPage').then(module => ({ default: module.BlockedTicketPage })))
const LoginPage = lazy(() => import('../pages/internal/LoginPage').then(module => ({ default: module.LoginPage })))
const AdminHomePage = lazy(() => import('../pages/internal/WorkspaceHomePages').then(module => ({ default: module.AdminHomePage })))
const ReceptionistHomePage = lazy(() => import('../pages/internal/WorkspaceHomePages').then(module => ({ default: module.ReceptionistHomePage })))
const TechnicianHomePage = lazy(() => import('../pages/internal/WorkspaceHomePages').then(module => ({ default: module.TechnicianHomePage })))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage').then(module => ({ default: module.NotFoundPage })))
const AppointmentsPage = lazy(() => import('../pages/internal/receptionist/AppointmentsPage').then(module => ({ default: module.AppointmentsPage })))
const IntakePage = lazy(() => import('../pages/internal/receptionist/IntakePage').then(module => ({ default: module.IntakePage })))
const TicketWorkspacePage = lazy(() => import('../pages/internal/receptionist/TicketWorkspacePage').then(module => ({ default: module.TicketWorkspacePage })))
const WarrantyHistoryPage = lazy(() => import('../pages/internal/receptionist/WarrantyHistoryPage').then(module => ({ default: module.WarrantyHistoryPage })))
const TicketsPage = lazy(() => import('../pages/internal/receptionist/TicketsPage').then(module => ({ default: module.TicketsPage })))
const TechnicianTicketPage = lazy(() => import('../pages/internal/technician/TechnicianTicketPage').then(module => ({ default: module.TechnicianTicketPage })))
const StatisticsPage = lazy(() => import('../pages/internal/admin/StatisticsPage').then(module => ({ default: module.StatisticsPage })))
const SettingsPage = lazy(() => import('../pages/internal/admin/SettingsPage').then(module => ({ default: module.SettingsPage })))
const MasterDataPage = lazy(() => import('../pages/internal/admin/MasterDataPage').then(module => ({ default: module.MasterDataPage })))
const UsersPage = lazy(() => import('../pages/internal/admin/UsersPage').then(module => ({ default: module.UsersPage })))
const InventoryPage = lazy(() => import('../pages/internal/admin/OperationsPages').then(module => ({ default: module.InventoryPage })))
const SlotsPage = lazy(() => import('../pages/internal/admin/OperationsPages').then(module => ({ default: module.SlotsPage })))
const SchedulesPage = lazy(() => import('../pages/internal/admin/OperationsPages').then(module => ({ default: module.SchedulesPage })))

export function App() {
  return <Suspense fallback={<div className="route-loading"><LoadingState label="Đang mở màn hình…" /></div>}><Routes>
    <Route element={<PublicLayout />}>
      <Route index element={<HomePage />} />
      <Route path="devices" element={<DevicesPage />} />
      <Route path="booking" element={<BookingPage />} />
      <Route path="lookup" element={<LookupPage />} />
      <Route path="service-tickets/:ticketCode" element={<BlockedTicketPage />} />
      <Route path="warranty-booking/:repairItemId" element={<Navigate to="/lookup" replace />} />
    </Route>
    <Route path="internal/login" element={<LoginPage />} />
    <Route path="internal" element={<RoleHome />} />
    <Route path="internal/admin" element={<RequireRole roles={['ADMIN']}><InternalLayout role="ADMIN" /></RequireRole>}>
      <Route index element={<AdminHomePage />} />
      <Route path="statistics" element={<StatisticsPage />} />
      <Route path="users" element={<UsersPage />} />
      <Route path="branches" element={<MasterDataPage initial="branches" />} />
      <Route path="catalog" element={<MasterDataPage initial="device-types" grouped />} />
      <Route path="parts" element={<MasterDataPage initial="parts" />} />
      <Route path="inventory" element={<InventoryPage />} />
      <Route path="slots" element={<SlotsPage />} />
      <Route path="schedules" element={<SchedulesPage />} />
      <Route path="settings" element={<SettingsPage />} />
    </Route>
    <Route path="internal/receptionist" element={<RequireRole roles={['RECEPTIONIST']}><InternalLayout role="RECEPTIONIST" /></RequireRole>}>
      <Route index element={<ReceptionistHomePage />} />
      <Route path="appointments" element={<AppointmentsPage />} />
      <Route path="intake" element={<IntakePage />} />
      <Route path="tickets" element={<TicketsPage />} />
      <Route path="warranty-history" element={<WarrantyHistoryPage />} />
      <Route path="tickets/:ticketId" element={<TicketWorkspacePage />} />
      <Route path="assignments" element={<Navigate to="../tickets" replace />} />
      <Route path="handover" element={<Navigate to="../tickets" replace />} />
    </Route>
    <Route path="internal/technician" element={<RequireRole roles={['TECHNICIAN']}><InternalLayout role="TECHNICIAN" /></RequireRole>}>
      <Route index element={<TechnicianHomePage />} />
      <Route path="tickets/:ticketId" element={<TechnicianTicketPage />} />
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes></Suspense>
}
