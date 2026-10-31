import { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireRole, RoleHome } from '../auth/RouteGuards'
import { InternalLayout } from '../layouts/InternalLayout'
import { PublicLayout } from '../layouts/PublicLayout'
import { LoadingState } from '../components/AsyncState'
import { safeLazy } from '../utils/safeLazy'

const HomePage = safeLazy(() => import('../pages/public/HomePage'), 'HomePage')
const DevicesPage = safeLazy(() => import('../pages/public/DevicesPage'), 'DevicesPage')
const BookingPage = safeLazy(() => import('../pages/public/BookingPage'), 'BookingPage')
const LookupPage = safeLazy(() => import('../pages/public/LookupPage'), 'LookupPage')
const BlockedTicketPage = safeLazy(() => import('../pages/public/BlockedTicketPage'), 'BlockedTicketPage')
const LoginPage = safeLazy(() => import('../pages/internal/LoginPage'), 'LoginPage')
const AdminHomePage = safeLazy(() => import('../pages/internal/WorkspaceHomePages'), 'AdminHomePage')
const ReceptionistHomePage = safeLazy(() => import('../pages/internal/WorkspaceHomePages'), 'ReceptionistHomePage')
const TechnicianHomePage = safeLazy(() => import('../pages/internal/WorkspaceHomePages'), 'TechnicianHomePage')
const NotFoundPage = safeLazy(() => import('../pages/NotFoundPage'), 'NotFoundPage')
const AppointmentsPage = safeLazy(() => import('../pages/internal/receptionist/AppointmentsPage'), 'AppointmentsPage')
const IntakePage = safeLazy(() => import('../pages/internal/receptionist/IntakePage'), 'IntakePage')
const TicketWorkspacePage = safeLazy(() => import('../pages/internal/receptionist/TicketWorkspacePage'), 'TicketWorkspacePage')
const WarrantyHistoryPage = safeLazy(() => import('../pages/internal/receptionist/WarrantyHistoryPage'), 'WarrantyHistoryPage')
const TicketsPage = safeLazy(() => import('../pages/internal/receptionist/TicketsPage'), 'TicketsPage')
const TechnicianTicketPage = safeLazy(() => import('../pages/internal/technician/TechnicianTicketPage'), 'TechnicianTicketPage')
const StatisticsPage = safeLazy(() => import('../pages/internal/admin/StatisticsPage'), 'StatisticsPage')
const SettingsPage = safeLazy(() => import('../pages/internal/admin/SettingsPage'), 'SettingsPage')
const FooterSettingsPage = safeLazy(() => import('../pages/internal/admin/FooterSettingsPage'), 'FooterSettingsPage')
const MasterDataPage = safeLazy<{ initial?: string; grouped?: boolean }>(() => import('../pages/internal/admin/MasterDataPage'), 'MasterDataPage')
const UsersPage = safeLazy(() => import('../pages/internal/admin/UsersPage'), 'UsersPage')
const InventoryPage = safeLazy(() => import('../pages/internal/admin/OperationsPages'), 'InventoryPage')
const SlotsPage = safeLazy(() => import('../pages/internal/admin/OperationsPages'), 'SlotsPage')
const SchedulesPage = safeLazy(() => import('../pages/internal/admin/OperationsPages'), 'SchedulesPage')

export function App() {
  return (
    <Suspense fallback={<div className="route-loading"><LoadingState label="Đang mở màn hình…" /></div>}>
      <Routes>
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
          <Route path="footer-settings" element={<FooterSettingsPage />} />
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
      </Routes>
    </Suspense>
  )
}