import { Suspense } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { routeSlice } from './routes';
import { PageSkeleton } from '../../components/Skeletons';

export default function ProtectedRoute() {
  return (
    <DashboardLayout>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          {routeSlice.map((v, i) => (
            <Route
              key={i}
              path={v.path}
              element={<v.component />}
            />
          ))}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </DashboardLayout>
  );
}
