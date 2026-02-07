import { useState, useCallback } from 'react';

interface ProgressState {
  isActive: boolean;
  message: string;
  subMessage?: string;
  current: number;
  total: number;
  percent: number;
}

export function useProgress() {
  const [state, setState] = useState<ProgressState>({
    isActive: false,
    message: 'Processing...',
    subMessage: undefined,
    current: 0,
    total: 0,
    percent: 0,
  });

  const start = useCallback((message: string, total: number) => {
    setState({
      isActive: true,
      message,
      subMessage: undefined,
      current: 0,
      total,
      percent: 0,
    });
  }, []);

  const update = useCallback((current: number, subMessage?: string) => {
    setState(prev => ({
      ...prev,
      current,
      subMessage: subMessage ?? prev.subMessage,
      percent: prev.total > 0 ? (current / prev.total) * 100 : 0,
    }));
  }, []);

  const setMessage = useCallback((message: string, subMessage?: string) => {
    setState(prev => ({
      ...prev,
      message,
      subMessage,
    }));
  }, []);

  const setTotal = useCallback((total: number) => {
    setState(prev => ({
      ...prev,
      total,
      percent: total > 0 ? (prev.current / total) * 100 : 0,
    }));
  }, []);

  const finish = useCallback(() => {
    setState({
      isActive: false,
      message: 'Processing...',
      subMessage: undefined,
      current: 0,
      total: 0,
      percent: 0,
    });
  }, []);

  return { ...state, start, update, setMessage, setTotal, finish };
}
