// src/stores/artSubmissionStore.ts
// Manages the DM's queue of pending player art submissions.

import { create } from 'zustand';

export type ArtTargetType = 'token' | 'region' | 'mapObject' | 'effectTemplate';

export interface ArtSubmission {
  id: string;
  playerId: string;
  playerName: string;
  targetType: ArtTargetType;
  targetId: string;
  targetName: string;
  textureHash: string;
  /** Compressed base64 preview data URL */
  textureDataUrl: string;
  status: 'pending' | 'accepted' | 'rejected';
  submittedAt: number;
  /** Set when DM acts on the submission */
  resolvedAt?: number;
  /** Rejection reason (optional) */
  rejectReason?: string;
}

interface ArtSubmissionState {
  submissions: ArtSubmission[];
  
  addSubmission: (submission: ArtSubmission) => void;
  acceptSubmission: (id: string) => void;
  rejectSubmission: (id: string, reason?: string) => void;
  removeSubmission: (id: string) => void;
  clearResolved: () => void;
  
  /** Count of pending submissions (for badge display) */
  pendingCount: () => number;
}

export const useArtSubmissionStore = create<ArtSubmissionState>((set, get) => ({
  submissions: [],

  addSubmission: (submission) =>
    set((s) => {
      // Deduplicate by ID
      if (s.submissions.some((sub) => sub.id === submission.id)) return s;
      return { submissions: [...s.submissions, submission].slice(-50) };
    }),

  acceptSubmission: (id) =>
    set((s) => ({
      submissions: s.submissions.map((sub) =>
        sub.id === id ? { ...sub, status: 'accepted' as const, resolvedAt: Date.now() } : sub
      ),
    })),

  rejectSubmission: (id, reason) =>
    set((s) => ({
      submissions: s.submissions.map((sub) =>
        sub.id === id
          ? { ...sub, status: 'rejected' as const, resolvedAt: Date.now(), rejectReason: reason }
          : sub
      ),
    })),

  removeSubmission: (id) =>
    set((s) => ({
      submissions: s.submissions.filter((sub) => sub.id !== id),
    })),

  clearResolved: () =>
    set((s) => ({
      submissions: s.submissions.filter((sub) => sub.status === 'pending'),
    })),

  pendingCount: () => get().submissions.filter((s) => s.status === 'pending').length,
}));
