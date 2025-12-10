import { useEffect } from 'react';
import { toast } from 'sonner';
import { checkStorageWarning } from '@/lib/storageManager';

/**
 * Hook to monitor localStorage usage and display warnings
 * when storage exceeds threshold levels (80% warning, 95% critical)
 */
export const useStorageWarning = () => {
  useEffect(() => {
    const checkStorage = async () => {
      try {
        const warning = await checkStorageWarning();
        
        // Only show warning if level is 'warning' or 'critical'
        if (warning.level === 'warning') {
          toast.warning("Storage Warning", {
            description: warning.message,
            duration: 10000, // Show for 10 seconds
          });
        } else if (warning.level === 'critical') {
          toast.error("Critical Storage Warning", {
            description: warning.message,
            duration: 15000, // Show for 15 seconds
          });
        }
      } catch (error) {
        console.error('Error checking storage:', error);
      }
    };

    // Check immediately on mount
    checkStorage();

    // Check every 5 minutes
    const interval = setInterval(checkStorage, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);
};
