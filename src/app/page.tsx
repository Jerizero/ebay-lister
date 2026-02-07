'use client';

import { useState, useCallback, useMemo } from 'react';
import { Listing } from '@/types';
import { ProgressBanner } from '@/components/ProgressBanner';
import { AppHeader } from '@/components/AppHeader';
import { NotificationBanners } from '@/components/NotificationBanners';
import { UploadStep } from '@/components/UploadStep';
import { GroupedStep } from '@/components/GroupedStep';
import { EditingStep } from '@/components/EditingStep';
import { useProgress, usePhotos, useGrouping, useGroupEditing, useEbaySubmission } from '@/hooks';

type AppStep = 'upload' | 'grouped' | 'editing';

export default function Home() {
  const [step, setStep] = useState<AppStep>('upload');
  const [error, setError] = useState<string | null>(null);

  // Hooks
  const progress = useProgress();
  const { photos, addPhotos, removePhoto, clearAll: clearPhotos } = usePhotos();

  const groupingCallbacks = useMemo(() => ({
    onProgressStart: progress.start,
    onProgressUpdate: progress.update,
    onProgressMessage: progress.setMessage,
    onProgressSetTotal: progress.setTotal,
    onProgressFinish: progress.finish,
  }), [progress.start, progress.update, progress.setMessage, progress.setTotal, progress.finish]);

  const { groups, setGroups, listings, isProcessing, startGrouping, updateListing, markSubmitted, resetGroups } = useGrouping(groupingCallbacks);

  const submissionCallbacks = useMemo(() => ({
    onProgressStart: progress.start,
    onProgressUpdate: progress.update,
    onProgressFinish: progress.finish,
    onMarkSubmitted: markSubmitted,
  }), [progress.start, progress.update, progress.finish, markSubmitted]);

  const ebay = useEbaySubmission(submissionCallbacks);

  const { editingGroups, setEditingGroups, startEditing, confirmEdits, cancelEdits } = useGroupEditing(
    groups,
    (editedGroups) => {
      setGroups(editedGroups);
      setStep('grouped');
    },
  );

  // Orchestration callbacks
  const handlePhotosUploaded = useCallback((newPhotos: Parameters<typeof addPhotos>[0]) => {
    addPhotos(newPhotos);
    setError(null);
  }, [addPhotos]);

  const handleClearAll = useCallback(() => {
    clearPhotos();
    resetGroups();
    setStep('upload');
    setError(null);
  }, [clearPhotos, resetGroups]);

  const handleStartGrouping = useCallback(async () => {
    try {
      await startGrouping(photos);
      setStep('grouped');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, [photos, startGrouping]);

  const handleBackToUpload = useCallback(() => {
    setStep('upload');
    setGroups([]);
  }, [setGroups]);

  const handleStartEditing = useCallback(() => {
    startEditing();
    setStep('editing');
  }, [startEditing]);

  const handleCancelEdits = useCallback(() => {
    cancelEdits();
    setStep('grouped');
  }, [cancelEdits]);

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

  const handleSubmitListing = useCallback(async (listing: Listing) => {
    setError(null);
    ebay.setSubmitSuccess(null);
    try {
      const errorMsg = await ebay.submitSingle(listing);
      if (errorMsg) setError(errorMsg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit draft');
    }
  }, [ebay]);

  return (
    <div className="min-h-screen bg-gray-50">
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
        listingsCount={listings.length}
        photosCount={photos.length}
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

        {step === 'grouped' && (
          <GroupedStep
            groups={groups}
            listings={listings}
            submittingId={ebay.submittingId}
            onBack={handleBackToUpload}
            onEditGroups={handleStartEditing}
            onSaveDrafts={handleSaveDrafts}
            onListingChange={updateListing}
            onSubmitListing={handleSubmitListing}
          />
        )}

        {step === 'editing' && (
          <EditingStep
            editingGroups={editingGroups}
            onGroupsChange={setEditingGroups}
            onConfirm={confirmEdits}
            onCancel={handleCancelEdits}
          />
        )}
      </main>
    </div>
  );
}
