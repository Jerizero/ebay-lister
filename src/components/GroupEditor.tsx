'use client';

import { useState, useCallback, DragEvent } from 'react';
import { Photo, PhotoGroup } from '@/types';
import Image from 'next/image';
import { generateId } from '@/lib/utils';

interface GroupEditorProps {
  groups: PhotoGroup[];
  onGroupsChange: (groups: PhotoGroup[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  title?: string;
  subtitle?: string;
}

export function GroupEditor({
  groups,
  onGroupsChange,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm Changes',
  cancelLabel = 'Cancel',
  title = 'Review & Edit Photo Groups',
  subtitle,
}: GroupEditorProps) {
  const [draggedPhoto, setDraggedPhoto] = useState<{
    photo: Photo;
    sourceGroupId: string;
  } | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>, photo: Photo, groupId: string) => {
      setDraggedPhoto({ photo, sourceGroupId: groupId });
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', photo.id);
    },
    []
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>, groupId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverGroupId(groupId);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDragOverGroupId(null);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>, targetGroupId: string) => {
      e.preventDefault();
      setDragOverGroupId(null);

      if (!draggedPhoto || draggedPhoto.sourceGroupId === targetGroupId) {
        setDraggedPhoto(null);
        return;
      }

      const newGroups = groups.map((group) => {
        if (group.id === draggedPhoto.sourceGroupId) {
          return {
            ...group,
            photos: group.photos.filter((p) => p.id !== draggedPhoto.photo.id),
            confidence: 1.0,
          };
        }
        if (group.id === targetGroupId) {
          return {
            ...group,
            photos: [...group.photos, draggedPhoto.photo],
            confidence: 1.0,
          };
        }
        return group;
      });

      const filteredGroups = newGroups.filter((g) => g.photos.length > 0);
      onGroupsChange(filteredGroups);
      setDraggedPhoto(null);
    },
    [draggedPhoto, groups, onGroupsChange]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedPhoto(null);
    setDragOverGroupId(null);
  }, []);

  const handlePhotoClick = useCallback(
    (photoId: string, e: React.MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        setSelectedPhotos((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(photoId)) {
            newSet.delete(photoId);
          } else {
            newSet.add(photoId);
          }
          return newSet;
        });
      } else if (e.shiftKey && selectedPhotos.size > 0) {
        setSelectedPhotos((prev) => new Set([...prev, photoId]));
      } else {
        setSelectedPhotos((prev) =>
          prev.size === 1 && prev.has(photoId) ? new Set() : new Set([photoId])
        );
      }
    },
    [selectedPhotos]
  );

  const handleCreateNewGroup = useCallback(() => {
    if (selectedPhotos.size === 0) return;

    const photosToMove: { photo: Photo; sourceGroupId: string }[] = [];
    for (const group of groups) {
      for (const photo of group.photos) {
        if (selectedPhotos.has(photo.id)) {
          photosToMove.push({ photo, sourceGroupId: group.id });
        }
      }
    }

    if (photosToMove.length === 0) return;

    let newGroups = groups.map((group) => ({
      ...group,
      photos: group.photos.filter((p) => !selectedPhotos.has(p.id)),
    }));

    const newGroup: PhotoGroup = {
      id: generateId(),
      photos: photosToMove.map((p) => p.photo),
      confidence: 1.0,
      aiDescription: 'Separated item',
    };

    newGroups = [...newGroups.filter((g) => g.photos.length > 0), newGroup];

    onGroupsChange(newGroups);
    setSelectedPhotos(new Set());
  }, [selectedPhotos, groups, onGroupsChange]);

  const toggleGroupSelection = useCallback((groupId: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const handleMergeSelectedGroups = useCallback(() => {
    const groupIds = Array.from(selectedGroupIds);
    if (groupIds.length < 2) return;

    const groupsToMerge = groups.filter((g) => selectedGroupIds.has(g.id));
    const otherGroups = groups.filter((g) => !selectedGroupIds.has(g.id));

    const mergedGroup: PhotoGroup = {
      id: groupsToMerge[0].id,
      photos: groupsToMerge.flatMap((g) => g.photos),
      confidence: 1.0,
      aiDescription: groupsToMerge[0].aiDescription || 'Merged item',
    };

    onGroupsChange([...otherGroups, mergedGroup]);
    setSelectedGroupIds(new Set());
  }, [selectedGroupIds, groups, onGroupsChange]);

  const handleSplitGroup = useCallback(
    (groupId: string) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group || group.photos.length < 2) return;

      const newGroups = group.photos.map((photo, i) => ({
        id: generateId(),
        photos: [photo],
        confidence: 1.0,
        aiDescription: `${group.aiDescription || 'Item'} (#${i + 1})`,
      }));

      const otherGroups = groups.filter((g) => g.id !== groupId);
      onGroupsChange([...otherGroups, ...newGroups]);
    },
    [groups, onGroupsChange]
  );

  const handleDescriptionChange = useCallback(
    (groupId: string, newDescription: string) => {
      onGroupsChange(
        groups.map((g) =>
          g.id === groupId ? { ...g, aiDescription: newDescription } : g
        )
      );
    },
    [groups, onGroupsChange]
  );

  const handleDropToNewGroup = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOverGroupId(null);

      if (!draggedPhoto) {
        setDraggedPhoto(null);
        return;
      }

      let newGroups = groups.map((group) => {
        if (group.id === draggedPhoto.sourceGroupId) {
          return {
            ...group,
            photos: group.photos.filter((p) => p.id !== draggedPhoto.photo.id),
          };
        }
        return group;
      });

      const newGroup: PhotoGroup = {
        id: generateId(),
        photos: [draggedPhoto.photo],
        confidence: 1.0,
        aiDescription: 'Separated item',
      };

      newGroups = [...newGroups.filter((g) => g.photos.length > 0), newGroup];

      onGroupsChange(newGroups);
      setDraggedPhoto(null);
    },
    [draggedPhoto, groups, onGroupsChange]
  );

  const totalPhotos = groups.reduce((sum, g) => sum + g.photos.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600 mt-1">
            {subtitle ||
              `Verify each item group before generating listings. ${totalPhotos} photos across ${groups.length} item${groups.length !== 1 ? 's' : ''}.`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-xl hover:bg-blue-800 transition-colors shadow-sm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      {/* Action toolbar when photos or groups are selected */}
      {(selectedPhotos.size > 0 || selectedGroupIds.size >= 2) && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-3">
            {selectedPhotos.size > 0 && (
              <>
                <span className="text-sm font-medium text-blue-900">
                  {selectedPhotos.size} photo{selectedPhotos.size !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={handleCreateNewGroup}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors"
                >
                  Move to New Item Group
                </button>
                <button
                  onClick={() => setSelectedPhotos(new Set())}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Clear photo selection
                </button>
              </>
            )}
          </div>

          {selectedGroupIds.size >= 2 && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-blue-900">
                {selectedGroupIds.size} groups checked
              </span>
              <button
                onClick={handleMergeSelectedGroups}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
              >
                Merge {selectedGroupIds.size} Groups Together
              </button>
              <button
                onClick={() => setSelectedGroupIds(new Set())}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Uncheck
              </button>
            </div>
          )}
        </div>
      )}

      {/* Compact operational guidance */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 bg-slate-100 rounded-xl text-xs text-slate-600">
        <span>
          <strong className="text-slate-800">Drag & Drop:</strong> Move any photo between items
        </span>
        <span>
          <strong className="text-slate-800">Split:</strong> Break a multi-photo group into single items
        </span>
        <span>
          <strong className="text-slate-800">Merge:</strong> Check 2+ groups to combine angles of the same item
        </span>
        <span>
          <strong className="text-slate-800">Item Hint:</strong> Edit the item name to sharpen eBay sold comp lookup
        </span>
      </div>

      {/* Groups grid */}
      <div className="grid gap-4">
        {groups.map((group, index) => {
          const isGroupChecked = selectedGroupIds.has(group.id);
          return (
            <div
              key={group.id}
              onDragOver={(e) => handleDragOver(e, group.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, group.id)}
              className={`
                bg-white rounded-xl border-2 p-4 transition-all
                ${
                  dragOverGroupId === group.id
                    ? 'border-blue-500 bg-blue-50/40'
                    : isGroupChecked
                    ? 'border-slate-900'
                    : 'border-slate-200'
                }
              `}
            >
              <div className="flex items-start gap-4">
                {/* Group checkbox + index */}
                <div className="flex flex-col items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    checked={isGroupChecked}
                    onChange={() => toggleGroupSelection(group.id)}
                    title="Select group to merge"
                    className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600 cursor-pointer"
                  />
                  <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
                    <span className="text-slate-700 font-bold text-xs">
                      #{index + 1}
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                      <input
                        type="text"
                        value={group.aiDescription || ''}
                        onChange={(e) => handleDescriptionChange(group.id, e.target.value)}
                        placeholder={`Item #${index + 1} description (e.g. Levi's 501 32x30 Dark Wash)`}
                        className="flex-1 max-w-xl px-3 py-1.5 text-sm font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-600 focus:outline-none"
                      />
                      <span
                        className={`
                          px-2 py-0.5 text-xs font-medium rounded-md
                          ${
                            group.confidence >= 0.9
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : group.confidence >= 0.7
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-orange-50 text-orange-700 border border-orange-200'
                          }
                        `}
                      >
                        {Math.round(group.confidence * 100)}% match
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {group.photos.length} photo{group.photos.length !== 1 ? 's' : ''}
                      </span>
                      {group.photos.length > 1 && (
                        <button
                          onClick={() => handleSplitGroup(group.id)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          Split into {group.photos.length} items
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Photos */}
                  <div className="flex flex-wrap gap-2.5">
                    {group.photos.map((photo) => (
                      <div
                        key={photo.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, photo, group.id)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => handlePhotoClick(photo.id, e)}
                        className={`
                          relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden
                          bg-slate-100 cursor-grab active:cursor-grabbing
                          transition-all
                          ${
                            selectedPhotos.has(photo.id)
                              ? 'ring-2 ring-blue-600 ring-offset-2'
                              : 'hover:ring-2 hover:ring-slate-300'
                          }
                          ${draggedPhoto?.photo.id === photo.id ? 'opacity-40' : ''}
                        `}
                      >
                        <Image
                          src={photo.url}
                          alt="Grouped photo"
                          fill
                          className="object-cover pointer-events-none"
                          sizes="96px"
                        />
                        {selectedPhotos.has(photo.id) && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shadow">
                            <svg
                              className="w-3 h-3 text-white"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Drop zone for new group */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverGroupId('new');
          }}
          onDragLeave={handleDragLeave}
          onDrop={handleDropToNewGroup}
          className={`
            border-2 border-dashed rounded-xl p-6 text-center transition-all
            ${
              dragOverGroupId === 'new'
                ? 'border-blue-600 bg-blue-50/50'
                : 'border-slate-300 hover:border-slate-400 bg-white/50'
            }
          `}
        >
          <p className="text-sm font-medium text-slate-600">
            {draggedPhoto
              ? 'Release to separate this photo into its own item group'
              : 'Drag any photo here to split it into a new item'}
          </p>
        </div>
      </div>
    </div>
  );
}
