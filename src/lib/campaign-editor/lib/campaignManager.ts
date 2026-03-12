/**
 * Campaign Manager providing CRUD operations with pluggable storage backends.
 */

import {
  BaseCampaign,
  BaseFlowNode,
  BaseNodeData,
} from '../types/base';
import { StorageAdapter } from '../types/adapter';
import { createLocalStorageAdapter } from './storage';

export interface CampaignManagerOptions<C extends BaseCampaign = BaseCampaign> {
  storage?: StorageAdapter<C>;
  storageKey?: string;
  builtInCampaigns?: C[];
}

export interface CampaignManager<C extends BaseCampaign = BaseCampaign> {
  getAll(): Promise<C[]>;
  get(campaignId: string): Promise<C | null>;
  save(campaign: C): Promise<void>;
  delete(campaignId: string): Promise<boolean>;
  export(campaign: C): Promise<string>;
  import(data: string): Promise<C>;
  isBuiltIn(campaignId: string): boolean;
}

export function createCampaignManager<C extends BaseCampaign = BaseCampaign>(
  options: CampaignManagerOptions<C> = {}
): CampaignManager<C> {
  const { storageKey = 'campaign-editor-campaigns', builtInCampaigns = [] } = options;
  const storage: StorageAdapter<C> = options.storage || createLocalStorageAdapter<C>(storageKey);
  const builtInIds = new Set(builtInCampaigns.map(c => c.id));

  return {
    async getAll() {
      const userCampaigns = await storage.loadAll();
      return [...builtInCampaigns, ...userCampaigns];
    },
    async get(campaignId) {
      const builtIn = builtInCampaigns.find(c => c.id === campaignId);
      if (builtIn) return builtIn;
      return storage.load(campaignId);
    },
    async save(campaign) {
      if (builtInIds.has(campaign.id)) {
        const newCampaign = { ...campaign, id: `${campaign.id}-copy-${Date.now()}`, isBuiltIn: false };
        await storage.save(newCampaign as C);
      } else {
        await storage.save(campaign);
      }
    },
    async delete(campaignId) {
      if (builtInIds.has(campaignId)) return false;
      return storage.delete(campaignId);
    },
    async export(campaign) {
      return storage.export(campaign);
    },
    async import(data) {
      const campaign = await storage.import(data);
      return { ...campaign, isBuiltIn: false, id: campaign.id || `imported-${Date.now()}` };
    },
    isBuiltIn(campaignId) {
      return builtInIds.has(campaignId);
    },
  };
}

// ============= PROGRESS =============

export interface CampaignProgress {
  campaignId: string;
  currentNodeId: string;
  completedNodeIds: string[];
  failedNodeIds: string[];
  flags: Record<string, boolean>;
  startedAt: string;
  lastPlayedAt: string;
}

export interface ProgressStorageAdapter {
  save(progress: CampaignProgress): Promise<void>;
  load(campaignId: string): Promise<CampaignProgress | null>;
  loadAll(): Promise<CampaignProgress[]>;
  delete(campaignId: string): Promise<void>;
}

export function createLocalProgressStorage(storageKey: string): ProgressStorageAdapter {
  return {
    async save(progress) {
      try {
        const stored = localStorage.getItem(storageKey);
        const all = stored ? JSON.parse(stored) as Record<string, CampaignProgress> : {};
        all[progress.campaignId] = { ...progress, lastPlayedAt: new Date().toISOString() };
        localStorage.setItem(storageKey, JSON.stringify(all));
      } catch (e) { console.error('Failed to save campaign progress:', e); }
    },
    async load(campaignId) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (!stored) return null;
        const all = JSON.parse(stored) as Record<string, CampaignProgress>;
        return all[campaignId] ?? null;
      } catch (e) { console.error('Failed to load campaign progress:', e); return null; }
    },
    async loadAll() {
      try {
        const stored = localStorage.getItem(storageKey);
        if (!stored) return [];
        return Object.values(JSON.parse(stored) as Record<string, CampaignProgress>);
      } catch (e) { console.error('Failed to load all campaign progress:', e); return []; }
    },
    async delete(campaignId) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (!stored) return;
        const all = JSON.parse(stored) as Record<string, CampaignProgress>;
        delete all[campaignId];
        localStorage.setItem(storageKey, JSON.stringify(all));
      } catch (e) { console.error('Failed to delete campaign progress:', e); }
    },
  };
}

export function createEmptyProgress(campaignId: string, startNodeId: string): CampaignProgress {
  const now = new Date().toISOString();
  return {
    campaignId,
    currentNodeId: startNodeId,
    completedNodeIds: [],
    failedNodeIds: [],
    flags: {},
    startedAt: now,
    lastPlayedAt: now,
  };
}
