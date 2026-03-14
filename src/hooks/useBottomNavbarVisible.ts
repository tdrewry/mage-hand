import { useSessionStore } from '@/stores/sessionStore';
import { useGroupStore } from '@/stores/groupStore';

export function useBottomNavbarVisible(): boolean {
  const { 
    selectedTokenIds, 
    selectedRegionIds, 
    selectedMapObjectIds, 
    selectedLightIds 
  } = useSessionStore();
  const { selectedGroupIds } = useGroupStore();

  return (
    selectedTokenIds.length > 0 ||
    selectedRegionIds.length > 0 ||
    selectedMapObjectIds.length > 0 ||
    selectedLightIds.length > 0 ||
    selectedGroupIds.length > 0
  );
}
