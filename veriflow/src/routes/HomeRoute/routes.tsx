import { lazy } from 'react';

const Login = lazy(() => import('../../pages/Login/index'));
const Signup = lazy(() => import('../../pages/Signup/index'));
const ProtectedRoutesSlicer = lazy(() => import('../ProtectedRoute/Slice'));

export const routeSlice = [
  {
    path: '/login',
    component: Login,
  },
  {
    path: '/signup',
    component: Signup,
  },
  {
    path: '/*',
    component: ProtectedRoutesSlicer,
  },
];
