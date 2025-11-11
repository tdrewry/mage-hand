import { useEffect, useState } from 'react';
import { autoSaveManager, AutoSaveSettings } from '@/lib/autoSaveManager';

export function useAutoSave() {
  const [settings, setSettings] = useState<AutoSaveSettings>(
    autoSaveManager.getSettings()
  );
  const [lastSaveTime, setLastSaveTime] = useState<number>(
    autoSaveManager.getLastSaveTime()
  );
  const [hasAutoSave, setHasAutoSave] = useState<boolean>(
    autoSaveManager.hasAutoSave()
  );

  useEffect(() => {
    // Subscribe to changes
    const unsubscribe = autoSaveManager.subscribe(() => {
      setSettings(autoSaveManager.getSettings());
      setLastSaveTime(autoSaveManager.getLastSaveTime());
      setHasAutoSave(autoSaveManager.hasAutoSave());
    });

    // Start auto-save if enabled
    if (settings.enabled) {
      autoSaveManager.start();
    }

    return () => {
      unsubscribe();
    };
  }, [settings.enabled]);

  const toggleAutoSave = () => {
    if (settings.enabled) {
      autoSaveManager.stop();
    } else {
      autoSaveManager.start();
    }
  };

  const setInterval = (minutes: number) => {
    autoSaveManager.setInterval(minutes);
  };

  const loadAutoSave = () => {
    return autoSaveManager.loadAutoSave();
  };

  const clearAutoSave = () => {
    autoSaveManager.clearAutoSave();
  };

  const forceAutoSave = () => {
    autoSaveManager.forceAutoSave();
  };

  const getTimeSinceLastSave = (): string => {
    if (!lastSaveTime) return 'Never';

    const now = Date.now();
    const diffMs = now - lastSaveTime;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffSeconds = Math.floor((diffMs % 60000) / 1000);

    if (diffMinutes > 60) {
      const hours = Math.floor(diffMinutes / 60);
      return `${hours}h ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes}m ago`;
    } else if (diffSeconds > 0) {
      return `${diffSeconds}s ago`;
    } else {
      return 'Just now';
    }
  };

  return {
    settings,
    lastSaveTime,
    hasAutoSave,
    toggleAutoSave,
    setInterval,
    loadAutoSave,
    clearAutoSave,
    forceAutoSave,
    getTimeSinceLastSave,
  };
}
