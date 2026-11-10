import { Suspense } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { routeSlice } from './routes';
import { PageSkeleton } from '../../components/Skeletons';

export default function HomeRoute() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        {routeSlice.map((v, i) => (
          <Route
            key={i}
            path={v.path}
            element={<v.component />}
          />
        ))}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
