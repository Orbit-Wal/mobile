import { create } from "zustand";
import type { Guardian, PendingRecovery, RecoveryConfig } from "@/types";
import { loadGuardians, loadRecoveryConfig, saveGuardians, saveRecoveryConfig } from "@/services/guardianStorage";

interface GuardianState {
  guardians: Guardian[];
  recoveryConfig: RecoveryConfig | null;
  pendingRecovery: PendingRecovery | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addGuardian: (guardian: Guardian) => Promise<void>;
  removeGuardian: (publicKey: string) => Promise<void>;
  setRecoveryConfig: (config: RecoveryConfig) => Promise<void>;
  setPendingRecovery: (recovery: PendingRecovery | null) => void;
}

export const useGuardianStore = create<GuardianState>((set, get) => ({
  guardians: [],
  recoveryConfig: null,
  pendingRecovery: null,
  hydrated: false,

  hydrate: async () => {
    const [guardians, recoveryConfig] = await Promise.all([loadGuardians(), loadRecoveryConfig()]);
    set({ guardians, recoveryConfig, hydrated: true });
  },

  addGuardian: async (guardian: Guardian) => {
    if (get().guardians.some((g) => g.publicKey === guardian.publicKey)) {
      throw new Error("This guardian has already been added.");
    }
    const guardians = [...get().guardians, guardian];
    set({ guardians });
    await saveGuardians(guardians);
  },

  removeGuardian: async (publicKey: string) => {
    const config = get().recoveryConfig;
    const remaining = get().guardians.filter((g) => g.publicKey !== publicKey);
    if (config && config.enabledAt && remaining.length < config.threshold) {
      throw new Error(
        `Removing this guardian would drop below your configured threshold of ${config.threshold}. Lower the threshold first.`
      );
    }
    set({ guardians: remaining });
    await saveGuardians(remaining);
  },

  setRecoveryConfig: async (config: RecoveryConfig) => {
    set({ recoveryConfig: config });
    await saveRecoveryConfig(config);
    // TODO(layer-b): once per-user globe-wallet contract deployment ships
    // (docs/design/recovery/RECOVERY.md §6), mirror this guardian set and
    // threshold into the contract via add_guardian/set_recovery_config
    // (Orbit-Wal/contract#20) here, so both layers stay in sync from one
    // "Enable Recovery" action. Not implemented yet: there's no deployed
    // per-user contract instance to call today, which would make this
    // dead, untestable code.
  },

  setPendingRecovery: (recovery: PendingRecovery | null) => {
    set({ pendingRecovery: recovery });
  },
}));
