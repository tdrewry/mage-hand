I'll implement RPC functionality for initiative order sync and UI mode switching, allowing the DM to control player UI states remotely.

 void;\\n  setModeFromRemote: (mode: UiMode, locked: boolean) => void;\\n  reset: () => void;\\n}\\n\\nexport const useUiModeStore = create()(\\n  persist(\\n    (set) => ({\\n      currentMode: 'dm',\\n      lockedByDm: false,\\n      \\n      setMode: (mode) => {\\n        console.log('🎮 Setting UI mode locally:', mode);\\n        set({ currentMode: mode, lockedByDm: false });\\n      },\\n      \\n      setModeFromRemote: (mode, locked) => {\\n        console.log('🎮 UI Mode changed remotely:', mode, 'locked:', locked);\\n        set({ currentMode: mode, lockedByDm: locked });\\n      },\\n      \\n      reset: () => {\\n        set({ currentMode: 'dm', lockedByDm: false });\\n      },\\n    }),\\n    {\\n      name: 'vtt-ui-mode-storage',\\n    }\\n  )\\n);\\n\"}">

('ui_mode_changed', this.handleUiModeChanged.bind(this));\\n    this.socketClient.on('card_opened', this.handleCardOpened.bind(this));\\n    this.socketClient.on('initiative_order_synced', this.handleInitiativeOrderSynced.bind(this));\\n  }\", \"first_replaced_line\": 163, \"last_replaced_line\": 165}">

 p.id === multiplayerStore.currentUserId);\\n    \\n    const senderId = multiplayerStore.currentUserId || '';\\n    const messageId = messageIdManager.generateMessageId(senderId);\\n\\n    const payload: SetUiModePayload = {\\n      messageId,\\n      mode,\\n      targetUserId,\\n      timestamp: Date.now(),\\n      senderId,\\n      senderRoleIds: currentPlayer?.roleIds || [],\\n    };\\n    \\n    console.log('📤 RPC: Set UI mode', payload);\\n    this.socketClient?.emit('rpc_set_ui_mode', payload);\\n  }\\n\\n  /**\\n   * Send card open command\\n   */\\n  rpcOpenCard(cardType: string, targetUserId?: string): void {\\n    if (!this.canSync()) return;\\n\\n    const multiplayerStore = useMultiplayerStore.getState();\\n    const sessionStore = useSessionStore.getState();\\n    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);\\n    \\n    const senderId = multiplayerStore.currentUserId || '';\\n    const messageId = messageIdManager.generateMessageId(senderId);\\n\\n    const payload: OpenCardPayload = {\\n      messageId,\\n      cardType,\\n      targetUserId,\\n      timestamp: Date.now(),\\n      senderId,\\n      senderRoleIds: currentPlayer?.roleIds || [],\\n    };\\n    \\n    console.log('📤 RPC: Open card', payload);\\n    this.socketClient?.emit('rpc_open_card', payload);\\n  }\\n\\n  /**\\n   * Sync full initiative order (used when manually reordering)\\n   */\\n  rpcSyncInitiativeOrder(initiativeOrder: any[]): void {\\n    if (!this.canSync()) return;\\n\\n    const multiplayerStore = useMultiplayerStore.getState();\\n    const sessionStore = useSessionStore.getState();\\n    const currentPlayer = sessionStore.players.find(p => p.id === multiplayerStore.currentUserId);\\n    \\n    const userId = multiplayerStore.currentUserId || '';\\n    const messageId = messageIdManager.generateMessageId(userId);\\n\\n    const payload: SyncInitiativeOrderPayload = {\\n      messageId,\\n      userId,\\n      userRoleIds: currentPlayer?.roleIds || [],\\n      timestamp: Date.now(),\\n      action: 'set_order',\\n      initiativeOrder,\\n    };\\n    \\n    console.log('📤 RPC: Sync initiative order', { messageId, userId, orderLength: initiativeOrder.length });\\n    this.socketClient?.emit('rpc_sync_initiative_order', payload);\\n  }\\n\\n  // ============= Role Sync Methods =============\\n\\n  syncRoleAssign(userId: string, roleIds: string[]): void {\", \"first_replaced_line\": 1023, \"last_replaced_line\": 1025}">

 = ({ sessionId }) => {\\n  const { tokens } = useSessionStore();\\n  const { regions } = useRegionStore();\\n  const { renderingMode, setRenderingMode } = useDungeonStore();\\n  const { isConnected, currentSession, connectedUsers } = useMultiplayerStore();\\n  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);\\n  const [sessionManagerOpen, setSessionManagerOpen] = useState(false);\", \"replace\": \"export const MenuCardContent: React.FC = ({ sessionId }) => {\\n  const { tokens, players, currentPlayerId } = useSessionStore();\\n  const { regions } = useRegionStore();\\n  const { renderingMode, setRenderingMode } = useDungeonStore();\\n  const { isConnected, currentSession, connectedUsers, currentUserId } = useMultiplayerStore();\\n  const { currentMode, lockedByDm, setMode } = useUiModeStore();\\n  const { roles } = useRoleStore();\\n  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);\\n  const [sessionManagerOpen, setSessionManagerOpen] = useState(false);\\n\\n  // Get current player's roles\\n  const currentPlayer = players.find(p => p.id === currentUserId || p.id === currentPlayerId);\\n  const currentPlayerRoles = currentPlayer?.roleIds || [];\\n\\n  // Check if user has permission to control UI mode\\n  const canControlUiMode = hasPermission(\\n    currentPlayer || { id: '', name: '', roleIds: [], isConnected: false },\\n    roles,\\n    'canManageFog' // DM-level permission\\n  );\", \"first_replaced_line\": 30, \"last_replaced_line\": 36}">

 {\\n    const newMode = renderingMode === 'edit' ? 'play' : 'edit';\\n    setRenderingMode(newMode);\\n    toast.success(`Switched to ${newMode === 'play' ? 'Play' : 'Edit'} mode`);\\n  };\", \"replace\": \"  const toggleRenderingMode = () => {\\n    const newMode = renderingMode === 'edit' ? 'play' : 'edit';\\n    setRenderingMode(newMode);\\n    toast.success(`Switched to ${newMode === 'play' ? 'Play' : 'Edit'} mode`);\\n  };\\n\\n  const handleModeChange = (newMode: 'dm' | 'play') => {\\n    // Update local mode\\n    setMode(newMode);\\n    \\n    // Broadcast to all players if we're DM and connected\\n    if (canControlUiMode && isConnected) {\\n      syncManager.rpcSetUiMode(newMode); // Broadcast to all\\n      toast.success(`Set all players to ${newMode === 'play' ? 'Play' : 'DM'} mode`);\\n    } else {\\n      toast.success(`Switched to ${newMode === 'play' ? 'Play' : 'DM'} mode`);\\n    }\\n  };\", \"first_replaced_line\": 168, \"last_replaced_line\": 172}">

\\n\\n      {/* Mode Toggle */}\\n      \\n        Mode\\n        \\n          \\n          {renderingMode === 'play' ? 'Play Mode' : 'Edit Mode'}\\n        \\n      \\n\\n      \", \"replace\": \"      \\n\\n      {/* UI Mode Toggle - DM can control all players */}\\n      \\n        \\n          UI Mode\\n          {lockedByDm && (\\n            \\n              Locked by DM\\n            \\n          )}\\n        \\n        \\n           handleModeChange('dm')}\\n            disabled={lockedByDm}\\n            className=\\\"w-full\\\"\\n          >\\n            \\n            DM\\n          \\n           handleModeChange('play')}\\n            disabled={lockedByDm}\\n            className=\\\"w-full\\\"\\n          >\\n            \\n            Play\\n          \\n        \\n        {canControlUiMode && isConnected && (\\n          \\n            Changes broadcast to all players\\n          \\n        )}\\n      \\n\\n      \\n\\n      {/* Rendering Mode Toggle */}\\n      \\n        Rendering Mode\\n        \\n          \\n          {renderingMode === 'play' ? 'Play Mode' : 'Edit Mode'}\\n        \\n      \\n\\n      \", \"first_replaced_line\": 241, \"last_replaced_line\": 255}">

Implemented comprehensive RPC functionality with UI mode control and initiative syncing across all clients.

**What was added:**

1\. **UI Mode Store** (`src/stores/uiModeStore.ts`): Manages DM/Play mode with local and remote control

2\. **RPC Event Types**: Added `SetUiModePayload`, `OpenCardPayload`, and `SyncInitiativeOrderPayload` to handle commands

3\. **RPC Methods in SyncManager**:

   - `rpcSetUiMode()`: Broadcast UI mode to all players

   - `rpcOpenCard()`: Remotely open cards for players

   - `rpcSyncInitiativeOrder()`: Sync full initiative order

4\. **RPC Event Handlers**: Process incoming UI mode changes, card opens, and initiative syncs with message ID tracking

5\. **Menu Card UI**: Added UI mode toggle that broadcasts to all players when DM changes it

**How it works:**

- DMs with proper permissions can change UI mode and it broadcasts to all connected players

- Players see a "Locked by DM" badge when mode is set remotely

- All RPC commands use the same message ID deduplication system

- Initiative order changes sync to all clients without triggering re-sync loops

Implement UI Mode Card Visibility

Add Remote Card Control

Add Manual Initiative Reordering

Enhance UI Mode Feedback