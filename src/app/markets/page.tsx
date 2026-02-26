import { Suspense } from 'react';
import MarketsPage from '@/components/pages/MarketsPage';

export default function Markets() {
  return (
    <Suspense fallback={null}>
      <MarketsPage />
    </Suspense>
  );
}
