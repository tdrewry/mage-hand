/**
 * React hooks and contexts for using adapters in components.
 */

import { createContext, useContext } from 'react';
import type { CampaignEditorAdapter } from '../types/adapter';
import type { BaseTerrainType, BaseNodeData, BaseFlowNode, BaseCampaign } from '../types/base';

export type GenericAdapter = CampaignEditorAdapter<
  string,
  BaseTerrainType,
  BaseNodeData<string>,
  BaseFlowNode<BaseNodeData<string>>,
  BaseCampaign<BaseFlowNode<BaseNodeData<string>>>
>;

export const AdapterContext = createContext<GenericAdapter | null>(null);

export function useAdapterContext(): GenericAdapter {
  const adapter = useContext(AdapterContext);
  if (!adapter) throw new Error('useAdapterContext must be used within an AdapterContext.Provider');
  return adapter;
}
