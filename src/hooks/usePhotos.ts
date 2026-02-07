import { useState, useCallback, useEffect, useRef } from 'react';
import { Photo } from '@/types';

export function usePhotos() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const photosRef = useRef(photos);

  // Keep ref in sync for cleanup
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  // Revoke all blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      photosRef.current.forEach(photo => URL.revokeObjectURL(photo.url));
    };
  }, []);

  const addPhotos = useCallback((newPhotos: Photo[]) => {
    setPhotos(prev => [...prev, ...newPhotos]);
  }, []);

  const removePhoto = useCallback((id: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === id);
      if (photo) {
        URL.revokeObjectURL(photo.url);
      }
      return prev.filter(p => p.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setPhotos(prev => {
      prev.forEach(photo => URL.revokeObjectURL(photo.url));
      return [];
    });
  }, []);

  return { photos, addPhotos, removePhoto, clearAll };
}
