/**
 * Sync store (Zustand). Triggers and reflects the local sync queue status
 * (`sync:run` / `sync:status`). While backend endpoints are TODO(backend), the
 * queue mechanics (mark/retry/backoff) are exercised and the UI shows progress.
 */

import { create } from "zustand";
import { sync, type SyncResult, type SyncStatus } from "@/lib/tauri/bridge";

interface SyncState {
  status: SyncStatus | null;
  lastResult: SyncResult | null;
  running: boolean;
  refresh: () => Promise<void>;
  run: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: null,
  lastResult: null,
  running: false,

  async refresh() {
    try {
      set({ status: await sync.status() });
    } catch {
      set({ status: { pending: 0, lastError: "unavailable" } });
    }
  },

  async run() {
    set({ running: true });
    try {
      const result = await sync.run();
      set({ lastResult: result, status: await sync.status() });
    } catch (e) {
      set({ status: { pending: 0, lastError: (e as Error).message } });
    } finally {
      set({ running: false });
    }
  },
}));
