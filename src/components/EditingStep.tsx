'use client';

import { PhotoGroup } from '@/types';
import { GroupEditor } from '@/components/GroupEditor';

interface EditingStepProps {
  editingGroups: PhotoGroup[];
  onGroupsChange: (groups: PhotoGroup[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isInitialGate?: boolean;
  dirtyCount?: number;
}

export function EditingStep({
  editingGroups,
  onGroupsChange,
  onConfirm,
  onCancel,
  isInitialGate = false,
  dirtyCount,
}: EditingStepProps) {
  const validCount = editingGroups.filter((g) => !g.flagged && g.photos.length > 0).length;

  const confirmLabel = isInitialGate
    ? `Confirm ${validCount} Group${validCount !== 1 ? 's' : ''} & Generate Listings`
    : dirtyCount && dirtyCount > 0
    ? `Save Groups & Regenerate ${dirtyCount} Changed Item${dirtyCount !== 1 ? 's' : ''}`
    : 'Save Group Changes';

  const cancelLabel = isInitialGate ? 'Back to Upload' : 'Cancel Editing';

  const title = isInitialGate
    ? 'Step 2: Confirm AI Item Groups'
    : 'Edit Item Groups';

  const subtitle = isInitialGate
    ? `AI grouped your photos into ${validCount} item${validCount !== 1 ? 's' : ''}. Drag photos to fix any mistakes, split or merge groups, then generate full listings and eBay comps.`
    : undefined;

  return (
    <div className="animate-fade-in">
      <GroupEditor
        groups={editingGroups}
        onGroupsChange={onGroupsChange}
        onConfirm={onConfirm}
        onCancel={onCancel}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        title={title}
        subtitle={subtitle}
      />
    </div>
  );
}
