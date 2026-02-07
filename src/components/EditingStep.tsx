'use client';

import { PhotoGroup } from '@/types';
import { GroupEditor } from '@/components/GroupEditor';

interface EditingStepProps {
  editingGroups: PhotoGroup[];
  onGroupsChange: (groups: PhotoGroup[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function EditingStep({
  editingGroups,
  onGroupsChange,
  onConfirm,
  onCancel,
}: EditingStepProps) {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Cancel editing
        </button>
      </div>

      <GroupEditor
        groups={editingGroups}
        onGroupsChange={onGroupsChange}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </div>
  );
}
