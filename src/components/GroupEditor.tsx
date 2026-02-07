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
}

export function GroupEditor({
  groups,
  onGroupsChange,
  onConfirm,
  onCancel,
}: GroupEditorProps) {
  const [draggedPhoto, setDraggedPhoto] = useState<{
    photo: Photo;
    sourceGroupId: string;
  } | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>, photo: Photo, groupId: string) => {
      setDraggedPhoto({ photo, sourceGroupId: groupId });
      e.dataTransfer.effectAllowed = 'move';
      // Add photo id to dataTransfer for accessibility
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
          // Remove photo from source group
          return {
            ...group,
            photos: group.photos.filter((p) => p.id !== draggedPhoto.photo.id),
            confidence: 0.5, // Lower confidence since user edited
          };
        }
        if (group.id === targetGroupId) {
          // Add photo to target group
          return {
            ...group,
            photos: [...group.photos, draggedPhoto.photo],
            confidence: 0.5,
          };
        }
        return group;
      });

      // Remove empty groups
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
        // Toggle selection with Ctrl/Cmd click
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
        // Range selection with Shift click (simplified)
        setSelectedPhotos((prev) => new Set([...prev, photoId]));
      } else {
        // Single click clears selection and selects this photo
        setSelectedPhotos(new Set([photoId]));
      }
    },
    [selectedPhotos]
  );

  const handleCreateNewGroup = useCallback(() => {
    if (selectedPhotos.size === 0) return;

    // Find photos and their source groups
    const photosToMove: { photo: Photo; sourceGroupId: string }[] = [];
    for (const group of groups) {
      for (const photo of group.photos) {
        if (selectedPhotos.has(photo.id)) {
          photosToMove.push({ photo, sourceGroupId: group.id });
        }
      }
    }

    if (photosToMove.length === 0) return;

    // Remove photos from their source groups
    let newGroups = groups.map((group) => ({
      ...group,
      photos: group.photos.filter((p) => !selectedPhotos.has(p.id)),
      confidence: group.photos.some((p) => selectedPhotos.has(p.id))
        ? 0.5
        : group.confidence,
    }));

    // Create new group with selected photos
    const newGroup: PhotoGroup = {
      id: generateId(),
      photos: photosToMove.map((p) => p.photo),
      confidence: 0.5,
      aiDescription: 'New group (user created)',
    };

    // Add new group and filter out empty groups
    newGroups = [...newGroups.filter((g) => g.photos.length > 0), newGroup];

    onGroupsChange(newGroups);
    setSelectedPhotos(new Set());
  }, [selectedPhotos, groups, onGroupsChange]);

  const handleMergeGroups = useCallback(
    (groupIds: string[]) => {
      if (groupIds.length < 2) return;

      const groupsToMerge = groups.filter((g) => groupIds.includes(g.id));
      const otherGroups = groups.filter((g) => !groupIds.includes(g.id));

      // Merge all photos into one group
      const mergedGroup: PhotoGroup = {
        id: groupsToMerge[0].id,
        photos: groupsToMerge.flatMap((g) => g.photos),
        confidence: 0.5,
        aiDescription:
          groupsToMerge[0].aiDescription + ' (merged)',
      };

      onGroupsChange([...otherGroups, mergedGroup]);
    },
    [groups, onGroupsChange]
  );

  const handleSplitGroup = useCallback(
    (groupId: string) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group || group.photos.length < 2) return;

      // Split into individual groups (user can then merge as needed)
      const newGroups = group.photos.map((photo) => ({
        id: generateId(),
        photos: [photo],
        confidence: 1.0,
        aiDescription: 'Split from: ' + (group.aiDescription || 'group'),
      }));

      const otherGroups = groups.filter((g) => g.id !== groupId);
      onGroupsChange([...otherGroups, ...newGroups]);
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

      // Remove photo from source group
      let newGroups = groups.map((group) => {
        if (group.id === draggedPhoto.sourceGroupId) {
          return {
            ...group,
            photos: group.photos.filter((p) => p.id !== draggedPhoto.photo.id),
            confidence: 0.5,
          };
        }
        return group;
      });

      // Create new group with this photo
      const newGroup: PhotoGroup = {
        id: generateId(),
        photos: [draggedPhoto.photo],
        confidence: 1.0,
        aiDescription: 'New group',
      };

      // Add new group and filter empty groups
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Edit Photo Groups
          </h2>
          <p className="text-sm text-gray-500">
            Drag photos between groups to reorganize. {totalPhotos} photos in{' '}
            {groups.length} groups
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Confirm Changes
          </button>
        </div>
      </div>

      {/* Selection actions */}
      {selectedPhotos.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg">
          <span className="text-sm text-indigo-700">
            {selectedPhotos.size} photo{selectedPhotos.size !== 1 ? 's' : ''}{' '}
            selected
          </span>
          <button
            onClick={handleCreateNewGroup}
            className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-white border border-indigo-300 rounded hover:bg-indigo-50 transition-colors"
          >
            Move to New Group
          </button>
          <button
            onClick={() => setSelectedPhotos(new Set())}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
        <strong>Tips:</strong> Drag photos to move them between groups.
        Ctrl/Cmd+click to select multiple photos. Click &quot;Move to New
        Group&quot; to create a new group with selected photos.
      </div>

      {/* Groups grid */}
      <div className="grid gap-4">
        {groups.map((group, index) => (
          <div
            key={group.id}
            onDragOver={(e) => handleDragOver(e, group.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, group.id)}
            className={`
              bg-white rounded-xl border-2 p-4 transition-all
              ${
                dragOverGroupId === group.id
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-gray-200'
              }
            `}
          >
            <div className="flex items-start gap-4">
              {/* Group info */}
              <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                <span className="text-indigo-600 font-bold text-sm">
                  {index + 1}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                {/* Description and actions */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">
                      {group.aiDescription || 'Item ' + (index + 1)}
                    </p>
                    <span
                      className={`
                        px-2 py-0.5 text-xs font-medium rounded-full
                        ${
                          group.confidence >= 0.9
                            ? 'bg-green-100 text-green-700'
                            : group.confidence >= 0.7
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-orange-100 text-orange-700'
                        }
                      `}
                    >
                      {Math.round(group.confidence * 100)}%
                    </span>
                  </div>

                  {/* Group actions */}
                  <div className="flex gap-2">
                    {group.photos.length > 1 && (
                      <button
                        onClick={() => handleSplitGroup(group.id)}
                        className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                      >
                        Split
                      </button>
                    )}
                  </div>
                </div>

                {/* Photo count */}
                <p className="text-sm text-gray-500 mb-3">
                  {group.photos.length} photo
                  {group.photos.length !== 1 ? 's' : ''}
                </p>

                {/* Photos */}
                <div className="flex flex-wrap gap-2">
                  {group.photos.map((photo) => (
                    <div
                      key={photo.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, photo, group.id)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => handlePhotoClick(photo.id, e)}
                      className={`
                        relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden
                        bg-gray-100 cursor-grab active:cursor-grabbing
                        transition-all
                        ${
                          selectedPhotos.has(photo.id)
                            ? 'ring-2 ring-indigo-500 ring-offset-2'
                            : 'hover:ring-2 hover:ring-gray-300'
                        }
                        ${
                          draggedPhoto?.photo.id === photo.id
                            ? 'opacity-50'
                            : ''
                        }
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
                        <div className="absolute top-1 right-1 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
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
        ))}

        {/* Drop zone for new group */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverGroupId('new');
          }}
          onDragLeave={handleDragLeave}
          onDrop={handleDropToNewGroup}
          className={`
            border-2 border-dashed rounded-xl p-8 text-center transition-all
            ${
              dragOverGroupId === 'new'
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-gray-300 hover:border-gray-400'
            }
          `}
        >
          <p className="text-gray-500">
            {draggedPhoto
              ? 'Drop here to create a new group'
              : 'Drag a photo here to create a new group'}
          </p>
        </div>
      </div>
    </div>
  );
}
