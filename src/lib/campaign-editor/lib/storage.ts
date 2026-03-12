/**
 * Default localStorage-based storage adapter.
 */

import { BaseCampaign } from '../types/base';
import { StorageAdapter } from '../types/adapter';

export function createLocalStorageAdapter<C extends BaseCampaign = BaseCampaign>(
  storageKey: string
): StorageAdapter<C> {
  return {
    async save(campaign) {
      const existing = await this.loadAll();
      const index = existing.findIndex(c => c.id === campaign.id);
      const updated = { ...campaign, updatedAt: new Date().toISOString() };
      if (index >= 0) {
        existing[index] = updated;
      } else {
        existing.push({ ...updated, createdAt: new Date().toISOString() } as C);
      }
      localStorage.setItem(storageKey, JSON.stringify(existing));
    },
    async load(campaignId) {
      const all = await this.loadAll();
      return all.find(c => c.id === campaignId) ?? null;
    },
    async loadAll() {
      try {
        const stored = localStorage.getItem(storageKey);
        if (!stored) return [];
        return JSON.parse(stored) as C[];
      } catch (e) {
        console.error('Failed to load campaigns from localStorage:', e);
        return [];
      }
    },
    async delete(campaignId) {
      const existing = await this.loadAll();
      const campaign = existing.find(c => c.id === campaignId);
      if (!campaign || campaign.isBuiltIn) return false;
      const filtered = existing.filter(c => c.id !== campaignId);
      localStorage.setItem(storageKey, JSON.stringify(filtered));
      return true;
    },
    async export(campaign) {
      return JSON.stringify({ campaign, exportedAt: new Date().toISOString(), exportVersion: '1.0.0' }, null, 2);
    },
    async import(data) {
      try {
        const parsed = JSON.parse(data);
        const campaign = parsed.campaign ?? parsed;
        if (!campaign.id || !campaign.name || !campaign.nodes) throw new Error('Invalid campaign format');
        return campaign as C;
      } catch (e) {
        throw new Error(`Failed to parse campaign data: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    },
  };
}
