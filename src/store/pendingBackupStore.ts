import { create } from "zustand";

// Transient, in-memory-only handoff between a create screen (app/auth/create.tsx,
// app/auth/create-mnemonic.tsx) and app/auth/verify-backup.tsx (issue #10). Deliberately
// not persisted and not passed as an expo-router URL param -- a secret key or
// mnemonic has no business sitting in navigation history/deep-link state, even
// transiently.
export type PendingBackupMode = "secret" | "mnemonic";

interface PendingBackupState {
  mode: PendingBackupMode | null;
  value: string | null;
  publicKey: string | null;
  set: (data: { mode: PendingBackupMode; value: string; publicKey: string }) => void;
  clear: () => void;
}

export const usePendingBackupStore = create<PendingBackupState>((set) => ({
  mode: null,
  value: null,
  publicKey: null,
  set: (data) => set(data),
  clear: () => set({ mode: null, value: null, publicKey: null }),
}));
