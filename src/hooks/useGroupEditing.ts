import { useState, useCallback } from 'react';
import { PhotoGroup } from '@/types';

export function useGroupEditing(
  groups: PhotoGroup[],
  onConfirm: (editedGroups: PhotoGroup[]) => void,
) {
  const [editingGroups, setEditingGroups] = useState<PhotoGroup[]>([]);

  const startEditing = useCallback(() => {
    setEditingGroups(groups.map(g => ({ ...g, photos: [...g.photos] })));
  }, [groups]);

  const confirmEdits = useCallback(() => {
    onConfirm(editingGroups);
    setEditingGroups([]);
  }, [editingGroups, onConfirm]);

  const cancelEdits = useCallback(() => {
    setEditingGroups([]);
  }, []);

  return { editingGroups, setEditingGroups, startEditing, confirmEdits, cancelEdits };
}
