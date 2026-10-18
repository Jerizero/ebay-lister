'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Listing } from '@/types';
import { ProgressBanner } from '@/components/ProgressBanner';
import { AppHeader, WorkflowStep } from '@/components/AppHeader';
import { NotificationBanners } from '@/components/NotificationBanners';
import { UploadStep } from '@/components/UploadStep';
import { GroupedStep } from '@/components/GroupedStep';
import { EditingStep } from '@/components/EditingStep';
import {
  useProgress,
  usePhotos,
  useGrouping,
  useGroupEditing,
  useEbaySubmission,
} from '@/hooks';
import { partitionDirtyGroups } from '@/hooks/useGrouping';
import {
  saveSessionToDb,
  loadSessionFromDb,
  clearSessionFromDb,
} from '@/lib/storage/draftStore';

export default function Home() {
  const [step, setStep] = useState<WorkflowStep>('upload');
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const progress = useProgress();
  const { photos, addPhotos, restorePhotos, removePhoto, clearAll: clearPhotos } = usePhotos();

  const groupingCallbacks = useMemo(
    () => ({
      onProgressStart: progress.start,
      onProgressUpdate: progress.update,
      onProgressMessage: progress.setMessage,
      onProgressSetTotal: progress.setTotal,
      onProgressFinish: progress.finish,
    }),
    [progress.start, progress.update, progress.setMessage, progress.setTotal, progress.finish]
  );

  const {
    groups,
    setGroups,
    listings,
    isProcessing,
    refreshingCompId,
    startGrouping,
    generateListingsForGroups,
    refreshListingComps,
    updateListing,
    markSubmitted,
    restoreGroupingState,
    resetGroups,
  } = useGrouping(groupingCallbacks);

  const submissionCallbacks = useMemo(
    () => ({
      onProgressStart: progress.start,
      onProgressUpdate: progress.update,
      onProgressFinish: progress.finish,
      onMarkSubmitted: markSubmitted,
    }),
    [progress.start, progress.update, progress.finish, markSubmitted]
  );

  const ebay = useEbaySubmission(submissionCallbacks);

  // Hydrate saved session from IndexedDB on mount
  const didHydrateRef = useRef(false);
  useEffect(() => {
    if (didHydrateRef.current) return;
    didHydrateRef.current = true;

    loadSessionFromDb()
      .then((saved) => {
        if (saved && saved.photos.length > 0) {
          restorePhotos(saved.photos);
          restoreGroupingState(saved.groups, saved.listings);
          setStep(saved.step);
        }
      })
      .finally(() => {
        setIsHydrated(true);
      });
  }, [restorePhotos, restoreGroupingState]);

  // Persist session changes to IndexedDB
  useEffect(() => {
    if (!isHydrated) return;
    if (photos.length === 0 && groups.length === 0 && listings.length === 0) {
      return;
    }
    const timer = setTimeout(() => {
      saveSessionToDb({
        step,
        photos,
        groups,
        listings,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [isHydrated, step, photos, groups, listings]);

  // Group editing hook: when confirming edits (either from the Stage 2 gate or from later Edit Groups),
  // update groups AND generate listings for any new or modified groups!
  const handleConfirmGroupEdits = useCallback(
    async (editedGroups: typeof groups) => {
      setGroups(editedGroups);
      setStep('grouped');
      setError(null);
      try {
        await generateListingsForGroups(editedGroups);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate listings');
      }
    },
    [setGroups, generateListingsForGroups]
  );

  const { editingGroups, setEditingGroups, startEditing, confirmEdits, cancelEdits } =
    useGroupEditing(groups, handleConfirmGroupEdits);

  // Calculate how many groups in the editor need fresh listing generation
  const dirtyCountInEditor = useMemo(() => {
    const active = editingGroups.length > 0 ? editingGroups : groups;
    const valid = active.filter((g) => !g.flagged && g.photos.length > 0);
    const { dirtyGroups } = partitionDirtyGroups(valid, listings);
    return dirtyGroups.length;
  }, [editingGroups, groups, listings]);

  const handlePhotosUploaded = useCallback(
    (newPhotos: Parameters<typeof addPhotos>[0]) => {
      addPhotos(newPhotos);
      setError(null);
    },
    [addPhotos]
  );

  const handleClearAll = useCallback(async () => {
    clearPhotos();
    resetGroups();
    setStep('upload');
    setError(null);
    ebay.setSubmitSuccess(null);
    await clearSessionFromDb();
  }, [clearPhotos, resetGroups, ebay]);

  // Stage 1 -> Stage 2 Gate: Group photos first, then open the Group Confirmation screen
  const handleStartGrouping = useCallback(async () => {
    setError(null);
    try {
      const createdGroups = await startGrouping(photos);
      if (createdGroups && createdGroups.length > 0) {
        setEditingGroups(createdGroups.map((g) => ({ ...g, photos: [...g.photos] })));
        setStep('review-groups');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, [photos, startGrouping, setEditingGroups]);

  const handleBackToUpload = useCallback(() => {
    setStep('upload');
  }, []);

  const handleStartEditing = useCallback(() => {
    startEditing();
    setStep('editing');
  }, [startEditing]);

  const handleCancelEdits = useCallback(() => {
    cancelEdits();
    setStep(listings.length > 0 ? 'grouped' : 'upload');
  }, [cancelEdits, listings.length]);

  const handleHeaderStepClick = useCallback(
    (targetStep: WorkflowStep) => {
      if (targetStep === 'review-groups') {
        setEditingGroups(groups.map((g) => ({ ...g, photos: [...g.photos] })));
        setStep(listings.length > 0 ? 'editing' : 'review-groups');
      } else {
        setStep(targetStep);
      }
    },
    [groups, listings.length, setEditingGroups]
  );

  const handleSaveDrafts = useCallback(async () => {
    setError(null);
    ebay.setSubmitSuccess(null);
    try {
      const errorMsg = await ebay.submitAll(listings);
      if (errorMsg) setError(errorMsg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit drafts');
    }
  }, [ebay, listings]);

  const handleSubmitListing = useCallback(
    async (listing: Listing) => {
      setError(null);
      ebay.setSubmitSuccess(null);
      try {
        const errorMsg = await ebay.submitSingle(listing);
        if (errorMsg) setError(errorMsg);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to submit draft');
      }
    },
    [ebay]
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <ProgressBanner
        isVisible={isProcessing || ebay.isSubmitting}
        message={progress.message}
        subMessage={progress.subMessage}
        progress={progress.percent}
        current={progress.current}
        total={progress.total}
      />

      <AppHeader
        step={step}
        groupsCount={groups.length}
        listingsCount={listings.length}
        photosCount={photos.length}
        isRestoredFromStorage={isHydrated}
        onStepClick={handleHeaderStepClick}
        onEbayStatusChange={ebay.setIsConnected}
        onClearAll={handleClearAll}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NotificationBanners
          submitSuccess={ebay.submitSuccess}
          error={error}
          onDismissSuccess={() => ebay.setSubmitSuccess(null)}
          onDismissError={() => setError(null)}
        />

        {step === 'upload' && (
          <UploadStep
            photos={photos}
            isProcessing={isProcessing}
            onPhotosUploaded={handlePhotosUploaded}
            onRemovePhoto={removePhoto}
            onStartGrouping={handleStartGrouping}
          />
        )}

        {(step === 'review-groups' || step === 'editing') && (
          <EditingStep
            editingGroups={editingGroups.length > 0 ? editingGroups : groups}
            onGroupsChange={setEditingGroups}
            onConfirm={confirmEdits}
            onCancel={handleCancelEdits}
            isInitialGate={step === 'review-groups' && listings.length === 0}
            dirtyCount={dirtyCountInEditor}
          />
        )}

        {step === 'grouped' && (
          <GroupedStep
            groups={groups}
            listings={listings}
            submittingId={ebay.submittingId}
            refreshingCompId={refreshingCompId}
            onBack={handleBackToUpload}
            onEditGroups={handleStartEditing}
            onSaveDrafts={handleSaveDrafts}
            onListingChange={updateListing}
            onSubmitListing={handleSubmitListing}
            onRefreshComps={refreshListingComps}
          />
        )}
      </main>
    </div>
  );
}
