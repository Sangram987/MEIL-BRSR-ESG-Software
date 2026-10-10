import React from 'react';
import { PageHeader } from '../../components/ui';
import BatchEvidenceUploader from '../../components/forensics/BatchEvidenceUploader';
import { useApp } from '../../store/AppStore';

export default function EvidenceCapture() {
  const { user } = useApp();

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Automated Evidence Collection & AI Auto-Detection"
        subtitle="Batch upload images, PDFs, and spreadsheets with OpenCV quality assurance, RapidOCR fact extraction, automated BRSR taxonomy detection, and 5-agent forensic verification."
        badge="Option A · Batch Evidence Engine"
      />

      <BatchEvidenceUploader
        initialProjectId={user?.projectId || 'prj-001'}
        initialPeriodId="2026-09"
      />
    </div>
  );
}
