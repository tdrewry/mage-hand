Role-Based Permissions Plan
===========================

Here's the complete markdown document for CONTRIBUTING/Role-Based-Permissions-Plan.md:

`# Role-Based Permission System - Implementation Plan    ## Overview    This document outlines the complete implementation plan for a flexible role-based permission system that replaces the simple `player.role: 'dm' | 'player'` with a comprehensive role architecture. This system enables Co-DMing, PvP scenarios, team-based gameplay, and granular permission control over tokens, vision, and game features.   ## Goals    -  **Flexible Roles**: Replace binary DM/Player with customizable roles -  **Co-DMing Support**: Multiple users can have DM-level permissions simultaneously -  **PvP/Team Play**: Support hostile relationships between roles with vision isolation -  **Granular Permissions**: Fine-grained control over token, map, and feature access -  **Line-of-Sight Vision**: Hostile tokens only share vision if in direct LoS -  **Backward Compatible**: Existing sessions migrate seamlessly to role system   ---    ## Core Concepts    ### Roles  - Define permission sets (e.g., "DM", "Player", "Team Red", "Monster Controller") - Have unique colors for visual identification - Can be hostile to other roles (for PvP scenarios) - System roles ("DM", "Player") cannot be deleted   ### Tokens  - Belong to a role (via `roleId`) - Can be marked as hidden (only visible to privileged roles) - Visual indicators show which role controls them   ### Players  - Assigned to one or more roles (via `roleIds[]`) - Inherit permissions from all assigned roles - Can switch roles via logout/re-entry   ### Permissions  - Control what actions each role can perform - Categories: Token control, Vision/Fog, Token visibility, Management, Map/Environment   ### Hostility  - Roles can be marked hostile to other roles - Hostile tokens don't share vision unless in line-of-sight - Enables PvP, asymmetric scenarios, and tactical gameplay   ---    ## Phase 1: Core Role System Foundation    **Status**: Not Started **Goal**: Create data model and state management for roles   ### Tasks    #### 1.1 Create Role Store  - [ ] Create `src/stores/roleStore.ts`    - [ ] Define `Role` interface with all permission fields   - [ ] Add `hostileToRoleIds: string[]` for role relationships   - [ ] Define `RoleState` interface with CRUD operations   - [ ] Implement `addRole`, `updateRole`, `removeRole` actions   - [ ] Implement `setHostility`, `areRolesHostile` actions   - [ ] Add `DEFAULT_ROLES` (DM and Player)   - [ ] Implement persistence with localStorage   **Role Interface Structure:**  ```typescript export interface Role {
 id: string; name: string; color: string; // Hex color for visual identification isSystem: boolean; // true for "DM" and "Player" hostileToRoleIds: string[]; // Roles this role is hostile to  permissions: { // Token control canControlOwnTokens: boolean; canControlOtherTokens: boolean;  // Vision & fog  canSeeAllFog: boolean; canSeeFriendlyVision: boolean; canSeeHostileVision: boolean; // Requires LoS    // Token visibility  canSeeOwnTokens: boolean; canSeeOtherTokens: boolean; canSeeHiddenTokens: boolean;    // Token management  canCreateTokens: boolean; canDeleteOwnTokens: boolean; canDeleteOtherTokens: boolean;    // Role & hostility management  canManageRoles: boolean; canAssignRoles: boolean; canAssignTokenRoles: boolean; canManageHostility: boolean;    // Map & environment  canEditMap: boolean; canManageFog: boolean; canManageInitiative: boolean;   }; }`

#### 1.2 Update Token Interface

-   [ ]  Modify src/stores/sessionStore.ts
    -   [ ]  Replace ownerId?: string with roleId: string
    -   [ ]  Add isHidden: boolean field
    -   [ ]  Update all token creation logic to use roleId

#### 1.3 Update Player Interface

-   [ ]  Modify src/stores/sessionStore.ts
    -   [ ]  Replace role: 'dm' | 'player' with roleIds: string[]
    -   [ ]  Update all player-related logic
    -   [ ]  Support multiple role assignments per player

#### 1.4 Testing

-   [ ]  Test role CRUD operations
-   [ ]  Test hostility bidirectional relationships
-   [ ]  Test default role creation
-   [ ]  Verify localStorage persistence

* * * * *

Phase 2: Permission & Vision Logic with Hostility
-------------------------------------------------

Status: Not Started\
Goal: Implement permission checking and line-of-sight vision filtering

### Tasks

#### 2.1 Create Role Permission Helpers

-   [ ]  Create src/lib/rolePermissions.ts
    -   [ ]  Implement getPlayerRoles(player, allRoles): Role[]
    -   [ ]  Implement hasPermission(player, allRoles, permission): boolean
    -   [ ]  Implement canControlToken(token, player, allRoles): boolean
    -   [ ]  Implement canSeeToken(token, player, allRoles): boolean
    -   [ ]  Implement canDeleteToken(token, player, allRoles): boolean
    -   [ ]  Implement areRolesHostile(roleId1, roleId2, allRoles): boolean

#### 2.2 Create Vision Permission Helpers

-   [ ]  Create src/lib/visionPermissions.ts
    -   [ ]  Implement getVisibleTokensForPlayer() - Core hostility logic
    -   [ ]  Categorize tokens: friendly, neutral, visibleHostile, hiddenHostile
    -   [ ]  Implement hasLineOfSight(token1, token2, walls): boolean
    -   [ ]  Implement lineSegmentsIntersect() helper for wall collision detection
    -   [ ]  Add LoS caching for performance

Key Logic:

-   Friendly tokens (same role): Always share vision
-   Neutral tokens (different role, not hostile): Share vision
-   Hostile tokens: Only share vision if player has LoS to them
-   DM with canSeeAllFog: Sees everything regardless of hostility

#### 2.3 Testing

-   [ ]  Test permission checks for each permission type
-   [ ]  Test LoS calculation with various wall configurations
-   [ ]  Test vision filtering with 2-3 hostile roles
-   [ ]  Test DM override (sees everything)
-   [ ]  Performance test LoS calculations with many tokens

* * * * *

Phase 3: Integrate with Fog of War System
-----------------------------------------

Status: Not Started\
Goal: Apply role-based vision filtering to fog computation

### Tasks

#### 3.1 Update SimpleTabletop.tsx Fog Logic

-   [ ]  Modify src/components/SimpleTabletop.tsx (lines ~480-550)
    -   [ ]  Import getVisibleTokensForPlayer from visionPermissions
    -   [ ]  Call vision filtering before computeTokenVisibilityPaper()
    -   [ ]  Pass only friendly, neutral, and visible hostile tokens to vision computation
    -   [ ]  Exclude hidden hostile tokens from fog clearing
    -   [ ]  Update fog rendering to respect role permissions

Before:

`// Old: Simple ownership-based filtering  const visibleTokens = tokensWithVision.filter(t =>   t.ownerId  === currentPlayerId || playerRole ===  'dm'  );`

After:

`// New: Role-based hostility filtering with LoS  const  { friendlyTokens, neutralTokens, visibleHostileTokens }  =    getVisibleTokensForPlayer(   tokensWithVision,   currentPlayer,   allRoles,   wallGeometry.wallSegments    );    const tokensForVision =  [    ...friendlyTokens,    ...neutralTokens,    ...visibleHostileTokens ];`

#### 3.2 Update MapCard.tsx

-   [ ]  Apply same filtering logic to mini-map fog rendering
-   [ ]  Update src/components/cards/MapCard.tsx (lines ~92-105)

#### 3.3 Testing

-   [ ]  Test fog clears correctly for friendly tokens
-   [ ]  Test fog doesn't clear for out-of-LoS hostile tokens
-   [ ]  Test fog clears for hostile tokens in LoS
-   [ ]  Test DM sees all fog cleared
-   [ ]  Test performance with multiple teams

* * * * *

Phase 4: Role Selection Modal (Login Screen)
--------------------------------------------

Status: Not Started\
Goal: Allow users to select role(s) and username on session entry

### Tasks

#### 4.1 Create RoleSelectionModal Component

-   [ ]  Create src/components/modals/RoleSelectionModal.tsx
    -   [ ]  Username input field (required)
    -   [ ]  Role selection: Multi-select checkboxes for all available roles
    -   [ ]  Visual distinction for system roles (DM, Player)
    -   [ ]  First user automatically gets "DM" role pre-selected
    -   [ ]  Subsequent users get "Player" role pre-selected
    -   [ ]  "Enter Session" button (validates username)
    -   [ ]  Cannot be dismissed (blocking overlay)
    -   [ ]  Responsive design for mobile

UI Structure:

┌─────────────────────────────────────┐
│   Welcome to [Session Name]         │
│                                     │
│   Username: [______________]        │
│                                     │
│   Select your role(s):              │
│   ☑ Dungeon Master (red dot)        │
│   ☐ Player (green dot)              │
│   ☐ Team Red (custom color)         │
│   ☐ Team Blue (custom color)        │
│                                     │
│           [Enter Session]           │
└─────────────────────────────────────┘

#### 4.2 Update App.tsx

-   [ ]  Modify src/App.tsx
    -   [ ]  Check if currentPlayerId has valid player with name
    -   [ ]  Show RoleSelectionModal if no valid player
    -   [ ]  Block access to main UI until modal completed
    -   [ ]  Handle first-user DM auto-assignment
    -   [ ]  Handle subsequent user Player auto-assignment

#### 4.3 Auto-role Assignment Logic

-   [ ]  First user in session: Automatically assign "DM" role
-   [ ]  Subsequent users: Automatically assign "Player" role
-   [ ]  Users can change selections before entering
-   [ ]  Store role selection in sessionStore

#### 4.4 Testing

-   [ ]  Test first user gets DM role
-   [ ]  Test second user gets Player role
-   [ ]  Test username validation (required field)
-   [ ]  Test multi-role selection
-   [ ]  Test modal persistence (cannot dismiss)
-   [ ]  Test on mobile devices

* * * * *

Phase 5: Token Interaction & Permission Enforcement
---------------------------------------------------

Status: Not Started\
Goal: Enforce permissions on token drag, select, edit, and delete

### Tasks

#### 5.1 Update useTokenInteraction Hook

-   [ ]  Modify src/hooks/useTokenInteraction.ts
    -   [ ]  Import permission helpers
    -   [ ]  Add canControlToken() check before startTokenDrag()
    -   [ ]  Show toast if permission denied: "You don't have permission to move [RoleName] tokens"
    -   [ ]  Add canControlToken() check before selectToken()
    -   [ ]  Filter visible tokens with canSeeToken()
    -   [ ]  Handle multi-select with mixed permissions

#### 5.2 Update TokenContextMenu

-   [ ]  Modify src/components/TokenContextMenu.tsx
    -   [ ]  Add permission checks for each menu item
    -   [ ]  Disable "Edit Label" if !canControlToken()
    -   [ ]  Disable "Change Color" if !canControlToken()
    -   [ ]  Disable "Delete" if !canDeleteToken()
    -   [ ]  Show/hide "Hide Token" based on canAssignTokenRoles
    -   [ ]  Add tooltips explaining disabled options

#### 5.3 Add "Assign to Role" Submenu

-   [ ]  Add new submenu to TokenContextMenu
    -   [ ]  List all available roles
    -   [ ]  Show current role with checkmark
    -   [ ]  Only visible if canAssignTokenRoles permission
    -   [ ]  Update token roleId on selection
    -   [ ]  Show toast confirmation

Context Menu Structure:

├── Edit Label (disabled if no permission)
├── Change Color (disabled if no permission)
├── ───────────────
├── Has Vision ✓
├── Use Profile →
├── Set Vision Range
├── ───────────────
├── Assign to Role → (DM only)
│   ├── ✓ DM
│   ├── Player
│   ├── Team Red
│   └── Team Blue
├── Hide Token (DM only)
├── ───────────────
├── Add to Initiative
└── Delete Token (disabled if no permission)

#### 5.4 Update SimpleTabletop Canvas Interactions

-   [ ]  Modify src/components/SimpleTabletop.tsx
    -   [ ]  Add permission checks in mouse event handlers
    -   [ ]  Prevent drag initiation for non-controllable tokens
    -   [ ]  Update cursor based on controllability
    -   [ ]  Filter visible tokens in rendering

#### 5.5 Testing

-   [ ]  Test DM can move all tokens
-   [ ]  Test Player can only move own role tokens
-   [ ]  Test permission denied toast shows correctly
-   [ ]  Test context menu options enable/disable correctly
-   [ ]  Test role assignment updates token correctly
-   [ ]  Test multi-select with mixed permissions

* * * * *

Phase 6: Role Management UI
---------------------------

Status: Not Started\
Goal: Create comprehensive UI for managing roles and hostility

### Tasks

#### 6.1 Create RoleManagerCard Component

-   [ ]  Create src/components/cards/RoleManagerCard.tsx
    -   [ ]  Wrap in BaseCard (draggable, resizable)
    -   [ ]  Register card with type ROLE_MANAGER
    -   [ ]  Only accessible if canManageRoles permission
    -   [ ]  List all roles in session
    -   [ ]  Create new role functionality
    -   [ ]  Edit existing role functionality
    -   [ ]  Delete role functionality (cannot delete system roles)
    -   [ ]  Role duplication feature

UI Structure:

┌─────────────────────────────────────────┐
│ Role Manager                        [×] │
├─────────────────────────────────────────┤
│                                         │
│ Roles (4)                 [+ New Role]  │
│                                         │
│ ▼ Dungeon Master (System)       🔴      │
│   Players: Alice, Bob                   │
│   Tokens: 15                            │
│   Permissions: All enabled              │
│   Hostile To: None                      │
│   [View Details]                        │
│                                         │
│ ▼ Player (System)               🟢      │
│   Players: Charlie, Dana                │
│   Tokens: 8                             │
│   Permissions: Limited                  │
│   Hostile To: None                      │
│   [View Details]                        │
│                                         │
│ ▼ Team Red                      🔴      │
│   Players: Charlie                      │
│   Tokens: 4                             │
│   Permissions: Custom                   │
│   Hostile To: ✓ Team Blue               │
│   [Edit] [Duplicate] [Delete]           │
│                                         │
│ ▼ Team Blue                     🔵      │
│   Players: Dana                         │
│   Tokens: 4                             │
│   Permissions: Custom                   │
│   Hostile To: ✓ Team Red                │
│   [Edit] [Duplicate] [Delete]           │
│                                         │
│ Quick Setup:                            │
│ [2-Team PvP] [3-Team PvP] [Co-DM]       │
└─────────────────────────────────────────┘

#### 6.2 Role Editor Form

-   [ ]  Create form for editing role properties
    -   [ ]  Name input
    -   [ ]  Color picker
    -   [ ]  Permission checkboxes (grouped by category)
    -   [ ]  Hostility management section
    -   [ ]  Save/Cancel buttons

Hostility Management Section:

-   [ ]  Show checkboxes for all other roles in session
-   [ ]  "Make Mutual" toggle for bidirectional hostility
-   [ ]  Visual indicator showing vision-sharing status
-   [ ]  Only visible if user has canManageHostility permission

#### 6.3 Role Creation Templates

-   [ ]  Add templates for common scenarios:
    -   [ ]  Co-DM: Copy all DM permissions
    -   [ ]  PvP Team: Basic player permissions + hostile setup
    -   [ ]  Monster Controller: Limited control without full DM access
    -   [ ]  Observer: View-only permissions

#### 6.4 Quick Setup Templates

-   [ ]  2-Team PvP: Create "Team Red" and "Team Blue", mark them hostile
-   [ ]  3-Team PvP: Create three teams, all hostile to each other
-   [ ]  Players vs DM: Mark Player role hostile to DM role

#### 6.5 Update MenuCard

-   [ ]  Modify src/components/cards/MenuCard.tsx
    -   [ ]  Add "Manage Roles" button (only if canManageRoles)
    -   [ ]  Add "Logout" button (always visible)
    -   [ ]  Toggle RoleManagerCard visibility

#### 6.6 Testing

-   [ ]  Test creating new roles
-   [ ]  Test editing existing roles
-   [ ]  Test deleting custom roles
-   [ ]  Test cannot delete system roles
-   [ ]  Test role duplication
-   [ ]  Test quick setup templates
-   [ ]  Test hostility management
-   [ ]  Test permission restrictions (non-DM cannot access)

* * * * *

Phase 7: Visual Indicators
--------------------------

Status: Not Started\
Goal: Add clear visual feedback for role membership and controllability

### Tasks

#### 7.1 Token Border Indicators

-   [ ]  Update token rendering in src/components/SimpleTabletop.tsx
    -   [ ]  Border color matches token's role color
    -   [ ]  Controllable tokens: Full opacity, glow on hover
    -   [ ]  Non-controllable friendly: 90% opacity, no glow
    -   [ ]  Hostile in LoS: Red border, pulsing effect
    -   [ ]  Hostile out of LoS: Not rendered at all
    -   [ ]  Hidden tokens: Ghosted appearance (privileged roles only)

Visual States:

-   Your controllable token: Green border, full opacity, pointer cursor
-   Friendly non-controllable: Green border, 90% opacity, default cursor
-   Neutral token: Blue border, full opacity, default cursor
-   Hostile in LoS: Red border, pulsing, crosshair cursor
-   Hostile out of LoS: Invisible
-   Hidden token: Gray/ghosted, question mark icon

#### 7.2 Token Label Enhancements

-   [ ]  Add role badge next to token name
    -   [ ]  Small colored dot matching role color
    -   [ ]  Crown icon for DM role
    -   [ ]  Shield icon for custom roles
    -   [ ]  Tooltip on hover showing role name

#### 7.3 Cursor States

-   [ ]  Update cursor based on token controllability
    -   [ ]  cursor: pointer for controllable tokens
    -   [ ]  cursor: not-allowed for non-controllable tokens
    -   [ ]  cursor: crosshair for hostile tokens in LoS
    -   [ ]  cursor: default for neutral tokens

#### 7.4 Hover Tooltips

-   [ ]  Show detailed info on token hover
    -   [ ]  Token name
    -   [ ]  Role name and color
    -   [ ]  Controllability status ("You can move this" / "Locked")
    -   [ ]  Hostility status ("Hostile" / "Friendly" / "Neutral")

#### 7.5 Testing

-   [ ]  Test all visual states render correctly
-   [ ]  Test borders match role colors
-   [ ]  Test opacity changes for controllability
-   [ ]  Test cursor changes
-   [ ]  Test tooltips display correct information
-   [ ]  Test performance with many tokens

* * * * *

Phase 8: Advanced Features
--------------------------

Status: Not Started\
Goal: Add quality-of-life features and integrations

### Tasks

#### 8.1 Vision Status Panel (Optional)

-   [ ]  Create src/components/VisionStatusPanel.tsx
    -   [ ]  Show which roles current player can see
    -   [ ]  Real-time LoS indicator for hostile tokens
    -   [ ]  "X hostile tokens nearby (Y in sight)"
    -   [ ]  Collapsible panel

#### 8.2 Initiative Panel Integration

-   [ ]  Update src/components/InitiativePanel.tsx
    -   [ ]  Group initiative entries by role
    -   [ ]  Collapsible role sections
    -   [ ]  Role color coding for quick identification
    -   [ ]  Show hostility indicators (red vs green)

#### 8.3 Bulk Role Operations

-   [ ]  Add multi-select role assignment
    -   [ ]  Select multiple tokens
    -   [ ]  Context menu: "Assign all to [Role]"
    -   [ ]  Requires canAssignTokenRoles permission

#### 8.4 Performance Optimization

-   [ ]  Implement LoS caching
    -   [ ]  Cache LoS results for token pairs
    -   [ ]  Invalidate cache when tokens or walls move
    -   [ ]  Throttle LoS checks to once per 100ms
    -   [ ]  Only check LoS for tokens within max vision range

#### 8.5 Testing

-   [ ]  Test vision status panel updates in real-time
-   [ ]  Test initiative grouping by role
-   [ ]  Test bulk role assignment
-   [ ]  Benchmark LoS performance with 50+ tokens
-   [ ]  Test cache invalidation

* * * * *

Phase 9: Persistence & Migration
--------------------------------

Status: Not Started\
Goal: Ensure roles persist across sessions and migrate old data

### Tasks

#### 9.1 Update Project Serialization

-   [ ]  Modify src/lib/projectSerializer.ts
    -   [ ]  Serialize roles array
    -   [ ]  Serialize player role assignments
    -   [ ]  Serialize token role assignments
    -   [ ]  Serialize hostility relationships
    -   [ ]  Version the serialization format

#### 9.2 Create Migration Logic

-   [ ]  Create migration function for existing sessions
    -   [ ]  Detect old format (token.ownerId, player.role)
    -   [ ]  Convert ownerId → roleId
    -   [ ]  Convert player.role → player.roleIds[]
    -   [ ]  Create default roles if missing
    -   [ ]  Show one-time migration notice

Migration Strategy:

`function  migrateToRoleSystem(oldSession:  OldSessionState):  NewSessionState  {    const roles =  [...DEFAULT_ROLES];     // Migrate tokens: ownerId → roleId    const tokens = oldSession.tokens.map(token =>  ({    ...token,   roleId: token.ownerId  ?  'player'  :  'dm',   isHidden:  false,    }));     // Migrate players: role string → roleIds array    const players = oldSession.players.map(player =>  ({    ...player,   roleIds: player.role  ===  'dm'  ?  ['dm']  :  ['player'],    }));     return  {  ...oldSession, tokens, players, roles };  }`

#### 9.3 URL Session Sharing

-   [ ]  Handle new players joining via session URL
    -   [ ]  Load existing roles from session
    -   [ ]  Show RoleSelectionModal with available roles
    -   [ ]  Allow player to choose which role(s) to join
    -   [ ]  Persist choice across page reloads

#### 9.4 Testing

-   [ ]  Test role persistence across page refresh
-   [ ]  Test migration from old ownerId format
-   [ ]  Test URL session sharing with roles
-   [ ]  Test role data in localStorage
-   [ ]  Test project save/load with roles

* * * * *

Technical Considerations
------------------------

### Permission Hierarchy

-   DM permissions override all other permissions
-   Multiple role assignments: Player gets union of all permissions
-   "Most permissive wins" approach (if any role allows, action is allowed)

### Performance Optimizations

-   LoS Caching: Cache line-of-sight calculations, invalidate on movement
-   Throttling: Limit LoS checks to 10Hz (every 100ms)
-   Spatial Hashing: Only check LoS for tokens within vision range
-   Memoization: Memoize permission checks for frequently accessed tokens

### Mobile Responsiveness

-   RoleSelectionModal: Full-screen overlay on mobile
-   RoleManagerCard: Stack sections vertically
-   Token tooltips: Tap-to-show on mobile
-   Simplified role selection UI on small screens

### Accessibility

-   Keyboard navigation for RoleSelectionModal
-   ARIA labels for all role controls
-   Screen reader support for role assignments
-   High-contrast mode for role colors

### Security Considerations

-   All permission checks happen client-side (peer-to-peer)
-   No server-side enforcement needed
-   Role data stored in session state
-   Cannot tamper with other players' roles in peer-to-peer model

* * * * *

Testing Strategy
----------------

### Unit Tests

-   [ ]  Test role CRUD operations
-   [ ]  Test permission helper functions
-   [ ]  Test LoS calculation accuracy
-   [ ]  Test hostility bidirectional relationships
-   [ ]  Test migration logic

### Integration Tests

-   [ ]  Test role system with token interactions
-   [ ]  Test fog system integration
-   [ ]  Test initiative panel integration
-   [ ]  Test permission enforcement across features

### E2E Scenarios

-   [ ]  Co-DMing: Two DMs can both control everything
-   [ ]  2-Team PvP: Teams can't see each other's vision unless LoS
-   [ ]  3-Team PvP: All teams hostile to each other
-   [ ]  Traditional Party: All players share vision, DM controls monsters
-   [ ]  Asymmetric Hostility: Players hostile to DM, but not vice versa
-   [ ]  Role Switching: User logs out and re-enters with different role

### Performance Benchmarks

-   [ ]  50 tokens with 5 roles: LoS checks < 16ms (60 FPS)
-   [ ]  100 tokens with 10 roles: LoS checks < 33ms (30 FPS)
-   [ ]  Role permission checks: < 1ms per check
-   [ ]  Vision filtering: < 5ms for full token list

* * * * *

Migration Path
--------------

### Rollout Strategy

1.  Week 1-2: Phase 1 (Core Role System)

    -   Build data model and state management
    -   Create default roles
    -   Test CRUD operations
2.  Week 3: Phase 2 (Permission Logic)

    -   Implement permission helpers
    -   Implement LoS logic
    -   Test vision filtering
3.  Week 4: Phase 3 (Fog Integration)

    -   Integrate with existing fog system
    -   Test vision isolation
4.  Week 5: Phase 4 (Role Selection)

    -   Create modal UI
    -   Test user onboarding
5.  Week 6: Phase 5 (Token Interactions)

    -   Enforce permissions
    -   Update context menus
6.  Week 7-8: Phase 6 (Role Management)

    -   Create management UI
    -   Test all role operations
7.  Week 9: Phase 7 (Visual Indicators)

    -   Add borders, tooltips, cursors
    -   Polish UX
8.  Week 10: Phase 8 (Advanced Features)

    -   Optional enhancements
    -   Performance optimization
9.  Week 11: Phase 9 (Migration & Polish)

    -   Migration logic
    -   Bug fixes
    -   Documentation

* * * * *

Success Metrics
---------------

-   [ ]  All existing functionality preserved
-   [ ]  Two DMs can co-DM simultaneously
-   [ ]  2-3 team PvP works with vision isolation
-   [ ]  LoS calculations maintain 60 FPS with 50+ tokens
-   [ ]  No performance degradation from old system
-   [ ]  Clear visual feedback for all role states
-   [ ]  Migration from old system works seamlessly

* * * * *

Example Scenarios
-----------------

### Scenario 1: Traditional D&D Party

Setup:

-   DM controls monsters (roleId: 'dm')
-   All player characters have roleId: 'player'
-   No hostility

Expected Behavior:

-   Players share vision (canSeeFriendlyVision: true)
-   Players can't control monster tokens
-   DM can control all tokens
-   Everyone sees all revealed fog

### Scenario 2: 2-Team PvP

Setup:

-   Create "Team Red" and "Team Blue" roles
-   Mark them hostile to each other
-   Assign players to respective teams

Expected Behavior:

-   Team Red doesn't see Team Blue's vision (unless LoS)
-   Team Red token has direct LoS to Team Blue token → Can see vision
-   Wall blocks LoS → Cannot see vision
-   Teams can only control their own tokens

### Scenario 3: Co-DMing

Setup:

-   Alice has role: ['dm']
-   Bob has role: ['dm']

Expected Behavior:

-   Both can control all tokens
-   Both see all fog cleared
-   Both can edit map, manage roles
-   Full parity, no restrictions

### Scenario 4: Player as Monster Controller

Setup:

-   DM creates "Monster Controller" role
-   Permissions: Can control own tokens, limited vision, cannot edit map
-   Assigns to Charlie

Expected Behavior:

-   Charlie can move monster tokens
-   Charlie can't see DM-only information
-   Charlie can't edit map or manage fog
-   Charlie can't see hidden tokens

### Scenario 5: Asymmetric Hostility

Setup:

-   Player role hostile to DM role
-   DM role NOT hostile to Player role

Expected Behavior:

-   DM sees player vision (not hostile to them)
-   Players don't see DM vision (hostile to DM)
-   Useful for "DM vs Players" scenarios

* * * * *

Future Enhancements (Post-Implementation)
-----------------------------------------

-   [ ]  Role-based chat channels
-   [ ]  Role-specific map layers (only visible to certain roles)
-   [ ]  Temporary role assignments (time-limited)
-   [ ]  Role-based sound/music triggers
-   [ ]  Role templates marketplace (share custom roles)
-   [ ]  Dice roll privacy per role
-   [ ]  Role-based initiative advantages
-   [ ]  Auto-assign roles based on token creation location

* * * * *

Files Summary
-------------

### New Files

-   src/stores/roleStore.ts - Role state management
-   src/lib/rolePermissions.ts - Permission checking helpers
-   src/lib/visionPermissions.ts - LoS and vision filtering logic
-   src/components/modals/RoleSelectionModal.tsx - Login/role selection UI
-   src/components/cards/RoleManagerCard.tsx - Role management UI

### Modified Files

-   src/stores/sessionStore.ts - Update Token/Player interfaces
-   src/components/SimpleTabletop.tsx - Fog filtering, visual indicators
-   src/components/cards/MapCard.tsx - Mini-map fog filtering
-   src/components/TokenContextMenu.tsx - Role assignment, permissions
-   src/components/cards/MenuCard.tsx - Add "Manage Roles" and "Logout"
-   src/App.tsx - Show RoleSelectionModal when needed
-   src/lib/projectSerializer.ts - Serialize/deserialize roles
-   src/hooks/useTokenInteraction.ts - Permission enforcement

* * * * *

Notes
-----

-   Backward Compatibility: All existing sessions will auto-migrate to role system
-   No Breaking Changes: Old functionality preserved, new features additive
-   Peer-to-Peer: All logic client-side, no backend changes needed
-   Hostility Opt-In: Default behavior (no hostility) matches old system
-   Performance: LoS checks optimized with caching and throttling

* * * * *

Questions & Decisions
---------------------

-   Q: Should hostility be mutual by default or one-directional?

    -   A: One-directional with "Make Mutual" toggle for flexibility
-   Q: How to handle role deletion when tokens assigned to it?

    -   A: Reassign tokens to "DM" role automatically with warning
-   Q: Should players see which roles are hostile to them?

    -   A: Yes, show in RoleManagerCard and token tooltips
-   Q: Maximum number of roles per session?

    -   A: Soft limit of 20 roles, warn if performance degrades

* * * * *

Progress Tracking
-----------------

### Phase 1: Core Role System Foundation

Status: Not Started\
Progress: 0/4 sections complete

### Phase 2: Permission & Vision Logic with Hostility

Status: Not Started\
Progress: 0/3 sections complete

### Phase 3: Integrate with Fog of War System

Status: Not Started\
Progress: 0/3 sections complete

### Phase 4: Role Selection Modal (Login Screen)

Status: Not Started\
Progress: 0/4 sections complete

### Phase 5: Token Interaction & Permission Enforcement

Status: Not Started\
Progress: 0/5 sections complete

### Phase 6: Role Management UI

Status: Not Started\
Progress: 0/6 sections complete

### Phase 7: Visual Indicators

Status: Not Started\
Progress: 0/5 sections complete

### Phase 8: Advanced Features

Status: Not Started\
Progress: 0/5 sections complete

### Phase 9: Persistence & Migration

Status: Not Started\
Progress: 0/4 sections complete

* * * * *

Last Updated: 2025-11-11\
Document Version: 1.0

 ---

This document serves as a comprehensive blueprint for implementing the role-based permission system with hostility features, ready for you or future contributors to follow step-by-step.