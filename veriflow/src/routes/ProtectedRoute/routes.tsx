import { lazy } from 'react';
import { withAuth } from '../../HOCS/AuthHOCookie';
import { withPermission } from '../../HOCS/withPermissions';

const DashboardPage = lazy(() => import('../../pages/Dashboard/index'));
const KeysPage = lazy(() => import('../../pages/Keys/index'));
const RulesPage = lazy(() => import('../../pages/Rules/index'));
const ShiftsPage = lazy(() => import('../../pages/Shifts/index'));
const ScansPage = lazy(() => import('../../pages/Scans/index'));
const AdminPage = lazy(() => import('../../pages/Admin/index'));
const SecurityPage = lazy(() => import('../../pages/Security/index'));

export const routeSlice = [
  {
    path: 'dashboard',
    component: withAuth(withPermission(DashboardPage, 'dashboard')),
  },
  {
    path: 'keys',
    component: withAuth(withPermission(KeysPage, 'keys')),
  },
  {
    path: 'rules',
    component: withAuth(withPermission(RulesPage, 'rules')),
  },
  {
    path: 'shifts',
    component: withAuth(withPermission(ShiftsPage, 'shifts')),
  },
  {
    path: 'scans',
    component: withAuth(withPermission(ScansPage, 'scans')),
  },
  {
    path: 'security',
    component: withAuth(withPermission(SecurityPage, 'security')),
  },
  {
    path: 'admin',
    component: withAuth(withPermission(AdminPage, 'admin')),
  },
];
