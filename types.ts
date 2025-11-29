
export interface UploadedFile {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
}

export type ReferenceType = 'moodboard' | 'typeface' | 'assets';

export interface GenerationState {
  isLoading: boolean;
  resultImage?: string;
  error?: string;
}

export interface HistoryItem {
  id: string;
  image: string; // base64
  promptType: 'initial' | 'edit';
  timestamp: number;
  previewUrl?: string; // Optional for optimization if we wanted to store blob urls
}

export type AspectRatio = '1:1' | '3:4' | '4:5' | '4:3' | '16:9' | '9:16';
