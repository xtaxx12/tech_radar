import { EventEmitter } from 'node:events';
import type { SyncResult } from '../types.js';

export type ServerEvents = {
  'sync:completed': (result: SyncResult) => void;
};

class TypedEmitter extends EventEmitter {
  emitSyncCompleted(result: SyncResult): void {
    this.emit('sync:completed', result);
  }

  onSyncCompleted(handler: (result: SyncResult) => void): () => void {
    this.on('sync:completed', handler);
    return () => this.off('sync:completed', handler);
  }
}

export const eventBus = new TypedEmitter();

// Node defaults to 10 listeners; each SSE client subscribes. Keep room for
// dozens of simultaneous browser tabs without triggering MaxListenersWarning.
eventBus.setMaxListeners(200);
