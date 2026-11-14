export type UploadQueueItem = {
  id: string;
  name: string;
  state: 'queued' | 'preparing' | 'uploading' | 'complete' | 'failed';
  error?: string | null;
};

export type UploadState = {
  phase: 'idle' | 'preparing' | 'uploading';
  totalFiles: number;
  completedFiles: number;
  currentFileIndex: number;
  currentFileName: string;
  originalBytes: number;
  optimizedBytes: number;
  currentFileLoadedBytes: number;
  currentFileTotalBytes: number;
  queue: UploadQueueItem[];
};

export function createIdleUploadState(): UploadState {
  return {
    phase: 'idle',
    totalFiles: 0,
    completedFiles: 0,
    currentFileIndex: 0,
    currentFileName: '',
    originalBytes: 0,
    optimizedBytes: 0,
    currentFileLoadedBytes: 0,
    currentFileTotalBytes: 0,
    queue: [],
  };
}

export function updateUploadQueueItem(
  queue: UploadQueueItem[],
  itemId: string,
  patch: Partial<UploadQueueItem>,
) {
  return queue.map((item) => (item.id === itemId ? { ...item, ...patch } : item));
}
