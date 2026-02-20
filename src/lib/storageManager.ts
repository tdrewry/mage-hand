/**
 * Storage Manager - Utilities for managing localStorage usage
 */

export interface StorageInfo {
  totalBytes: number;
  totalKB: number;
  totalMB: number;
  quotaBytes: number;
  quotaMB: number;
  usedPercentage: number;
  remainingBytes: number;
  remainingMB: number;
}

export interface StorageCategory {
  name: string;
  bytes: number;
  kb: number;
  percentage: number;
  itemCount: number;
}

export interface StorageItem {
  key: string;
  bytes: number;
  kb: number;
  category: string;
}

export interface StorageBreakdown {
  categories: StorageCategory[];
  items: StorageItem[];
  total: StorageInfo;
}

export type StorageWarningLevel = 'safe' | 'warning' | 'critical';

export interface StorageWarning {
  level: StorageWarningLevel;
  message: string;
  percentage: number;
  shouldWarn: boolean;
}

/**
 * Calculate the size of a string in bytes
 */
function getStringSize(str: string): number {
  return new Blob([str]).size;
}

/**
 * Get the estimated localStorage quota in bytes
 * Most browsers have a 5-10MB limit, we'll estimate 10MB as default
 */
export async function getStorageQuota(): Promise<number> {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      // Use the quota if available, otherwise fallback to 10MB
      return estimate.quota || 10 * 1024 * 1024;
    }
  } catch (error) {
    console.warn('Could not get storage estimate:', error);
  }
  
  // Fallback: assume 10MB quota for localStorage
  return 10 * 1024 * 1024;
}

/**
 * Calculate total localStorage usage
 */
export function getTotalStorageUsage(): number {
  let totalBytes = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key) || '';
      totalBytes += getStringSize(key) + getStringSize(value);
    }
  }
  
  return totalBytes;
}

/**
 * Get storage information including usage and quota
 */
export async function getStorageInfo(): Promise<StorageInfo> {
  const totalBytes = getTotalStorageUsage();
  const quotaBytes = await getStorageQuota();
  const usedPercentage = (totalBytes / quotaBytes) * 100;
  const remainingBytes = quotaBytes - totalBytes;
  
  return {
    totalBytes,
    totalKB: totalBytes / 1024,
    totalMB: totalBytes / (1024 * 1024),
    quotaBytes,
    quotaMB: quotaBytes / (1024 * 1024),
    usedPercentage,
    remainingBytes,
    remainingMB: remainingBytes / (1024 * 1024),
  };
}

/**
 * Categorize a storage key
 */
function categorizeKey(key: string): string {
  if (key.startsWith('magehand-projects') || key === 'currentProject') {
    return 'projects';
  }
  if (key.startsWith('magehand-autosave')) {
    return 'auto-saves';
  }
  if (key.startsWith('magehand-history-')) {
    return 'history';
  }
  if (key === 'magehand-templates') {
    return 'templates';
  }
  if (key.includes('session') || key.includes('state') || key.includes('store')) {
    return 'session';
  }
  return 'other';
}

/**
 * Get all storage items with their sizes
 */
export function getAllStorageItems(): StorageItem[] {
  const items: StorageItem[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key) || '';
      const bytes = getStringSize(key) + getStringSize(value);
      
      items.push({
        key,
        bytes,
        kb: bytes / 1024,
        category: categorizeKey(key),
      });
    }
  }
  
  // Sort by size descending
  return items.sort((a, b) => b.bytes - a.bytes);
}

/**
 * Get storage breakdown by category
 */
export async function getStorageBreakdown(): Promise<StorageBreakdown> {
  const items = getAllStorageItems();
  const total = await getStorageInfo();
  
  // Group items by category
  const categoryMap = new Map<string, { bytes: number; count: number }>();
  
  items.forEach(item => {
    const existing = categoryMap.get(item.category) || { bytes: 0, count: 0 };
    categoryMap.set(item.category, {
      bytes: existing.bytes + item.bytes,
      count: existing.count + 1,
    });
  });
  
  // Convert to array and calculate percentages
  const categories: StorageCategory[] = Array.from(categoryMap.entries())
    .map(([name, data]) => ({
      name,
      bytes: data.bytes,
      kb: data.bytes / 1024,
      percentage: (data.bytes / total.totalBytes) * 100,
      itemCount: data.count,
    }))
    .sort((a, b) => b.bytes - a.bytes);
  
  return {
    categories,
    items,
    total,
  };
}

/**
 * Check storage warning level
 */
export async function checkStorageWarning(): Promise<StorageWarning> {
  const info = await getStorageInfo();
  const percentage = info.usedPercentage;
  
  if (percentage >= 95) {
    return {
      level: 'critical',
      message: 'Storage is critically full! Please free up space immediately.',
      percentage,
      shouldWarn: true,
    };
  }
  
  if (percentage >= 80) {
    return {
      level: 'warning',
      message: 'Storage is getting full. Consider cleaning up old data.',
      percentage,
      shouldWarn: true,
    };
  }
  
  return {
    level: 'safe',
    message: 'Storage usage is healthy.',
    percentage,
    shouldWarn: false,
  };
}

/**
 * Get storage status with threshold checks
 */
export async function getStorageStatus(): Promise<{
  info: StorageInfo;
  warning: StorageWarning;
  isNearLimit: boolean;
  isCritical: boolean;
}> {
  const info = await getStorageInfo();
  const warning = await checkStorageWarning();
  
  return {
    info,
    warning,
    isNearLimit: info.usedPercentage >= 80,
    isCritical: info.usedPercentage >= 95,
  };
}

/**
 * Estimate if there's enough space for a new item
 */
export async function hasSpaceForItem(estimatedBytes: number): Promise<boolean> {
  const info = await getStorageInfo();
  return info.remainingBytes >= estimatedBytes;
}

/**
 * Get storage items by category
 */
export function getItemsByCategory(category: string): StorageItem[] {
  return getAllStorageItems().filter(item => item.category === category);
}

/**
 * Calculate size of a specific category
 */
export function getCategorySize(category: string): number {
  return getItemsByCategory(category).reduce((sum, item) => sum + item.bytes, 0);
}
