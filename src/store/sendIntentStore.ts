import { create } from "zustand";
import type { ScannedInputResult } from "@/utils/scannedInput";

// Bridges an already-validated QR scan (#15) or SEP-7 deep link (#12) back
// into the send screen. Only ever holds an "address" or "sep7" result --
// never "invalid" -- callers (app/send/scan.tsx, app/_layout.tsx's deep
// link handler) must validate via validateScannedInput() before setting
// this, so anything reaching the send screen through here has already
// passed the full untrusted-input contract.
type PendingSendIntent = Extract<ScannedInputResult, { kind: "address" | "sep7" }>;

interface SendIntentState {
  pending: PendingSendIntent | null;
  setPending: (value: PendingSendIntent) => void;
  clearPending: () => void;
}

export const useSendIntentStore = create<SendIntentState>((set) => ({
  pending: null,
  setPending: (value) => set({ pending: value }),
  clearPending: () => set({ pending: null }),
}));
