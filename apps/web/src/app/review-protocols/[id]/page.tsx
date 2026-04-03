'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ReviewProtocolEditor } from '@/components/review-protocols/ReviewProtocolEditor';
import { AppLayout } from '@/components/layout/AppLayout';
import { reviewProtocolsApi } from '@/lib/api/reviewProtocols';

export default function ReviewProtocolDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: protocol, isLoading } = useQuery({
    queryKey: ['review-protocol', id],
    queryFn: () => reviewProtocolsApi.getById(id),
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="page-container">
          <div className="skeleton h-96" />
        </div>
      </AppLayout>
    );
  }

  return <ReviewProtocolEditor protocol={protocol} />;
}
