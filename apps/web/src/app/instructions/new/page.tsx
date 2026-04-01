'use client';

import { AppLayout } from '@/components/layout/AppLayout';
import { InstructionForm } from '@/components/instructions/InstructionForm';

export default function NewInstructionPage() {
  return (
    <AppLayout>
      <div className="page-container-wide">
        <InstructionForm mode="create" />
      </div>
    </AppLayout>
  );
}
