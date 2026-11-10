import { lazy, Suspense } from 'react';
import { PageSkeleton } from '../../components/Skeletons';

const ProtectedRoute = lazy(() => import('./index'));

function PRS() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProtectedRoute />
    </Suspense>
  );
}

export default PRS;
