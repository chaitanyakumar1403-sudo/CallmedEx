/**
 * CallMedex Native Offline Storage & Sync Queue Service
 * Enables field phlebotomists, nurses, and doctors to operate without continuous internet connectivity.
 */
import { storage } from './storage';
import { api } from './api';

export interface QueuedMutation {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payload: any;
  timestamp: string;
  retryCount: number;
  description: string;
}

const OFFLINE_QUEUE_KEY = 'callmedex_offline_mutation_queue';

export const offlineSyncService = {
  /**
   * Add a mutation to the offline queue
   */
  async enqueueMutation(
    endpoint: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    payload: any,
    description: string
  ): Promise<void> {
    const queue = await this.getPendingQueue();
    const newMutation: QueuedMutation = {
      id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      endpoint,
      method,
      payload,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      description,
    };
    queue.push(newMutation);
    await storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  },

  /**
   * Retrieve all pending queued mutations
   */
  async getPendingQueue(): Promise<QueuedMutation[]> {
    try {
      const raw = await storage.getItem(OFFLINE_QUEUE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  /**
   * Process all queued mutations in sequence upon reconnection
   */
  async processQueue(): Promise<{ processed: number; failed: number }> {
    const queue = await this.getPendingQueue();
    if (queue.length === 0) return { processed: 0, failed: 0 };

    let processed = 0;
    let failed = 0;
    const remainingQueue: QueuedMutation[] = [];

    for (const item of queue) {
      try {
        if (item.method === 'POST') {
          await api.post(item.endpoint, item.payload);
        } else if (item.method === 'PUT') {
          await api.put(item.endpoint, item.payload);
        } else if (item.method === 'PATCH') {
          await api.patch(item.endpoint, item.payload);
        } else if (item.method === 'DELETE') {
          await api.delete(item.endpoint, item.payload);
        }
        processed++;
      } catch (err) {
        item.retryCount += 1;
        if (item.retryCount < 5) {
          remainingQueue.push(item);
        }
        failed++;
      }
    }

    await storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue));
    return { processed, failed };
  },

  /**
   * Clear all offline queues
   */
  async clearQueue(): Promise<void> {
    await storage.removeItem(OFFLINE_QUEUE_KEY);
  },
};
