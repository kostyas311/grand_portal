'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { InstructionForm } from '@/components/instructions/InstructionForm';
import { getAccessToken } from '@/lib/api';
import { instructionsApi } from '@/lib/api/instructions';
import { useAuthStore } from '@/lib/store/auth.store';

export default function EditInstructionPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [tokenReady, setTokenReady] = useState(() => !!getAccessToken());

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (getAccessToken()) {
      setTokenReady(true);
      return;
    }

    const intervalId = window.setInterval(() => {
      if (getAccessToken()) {
        setTokenReady(true);
        window.clearInterval(intervalId);
      }
    }, 100);

    return () => window.clearInterval(intervalId);
  }, []);

  const canLoadInstruction = isHydrated && isAuthenticated && tokenReady;

  const { data: instruction, isLoading, isError } = useQuery({
    queryKey: ['instruction', id],
    queryFn: () => instructionsApi.getById(id),
    enabled: canLoadInstruction,
  });

  if (!isLoading && instruction) {
    const canEdit = user?.role === 'ADMIN' || instruction.createdBy.id === user?.id;
    if (!canEdit) {
      return (
        <AppLayout>
          <div className="page-container-wide">
            <div className="section-surface">
              <div className="card-body text-sm text-slate-500">
                Редактировать инструкцию может только автор или администратор.
              </div>
            </div>
          </div>
        </AppLayout>
      );
    }
  }

  return (
    <AppLayout>
        <div className="page-container-wide">
        {!canLoadInstruction || isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="skeleton h-36 rounded-2xl" />
            ))}
          </div>
        ) : isError || !instruction ? (
          <div className="section-surface">
            <div className="card-body text-sm text-slate-500">
              Инструкция не найдена или недоступна для редактирования.
            </div>
          </div>
        ) : (
          <InstructionForm mode="edit" instruction={instruction} />
        )}
      </div>
    </AppLayout>
  );
}
