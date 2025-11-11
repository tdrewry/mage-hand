Role-based system is superior because:

1.  Semantic clarity: "Roles" naturally have permissions, whereas "control groups" is ambiguous
2.  Permission flexibility: Each role defines what actions are allowed (move, edit, view fog, manage other roles, etc.)
3.  Multi-scenario support: PvP, DM vs Player, PvE all emerge naturally from role permissions
4.  Scalability: Easy to add new roles with custom permission sets

Let me examine the current architecture to understand what we're building on:

Show all

2 tools used

Perfect! I can see the current architecture. Now let me propose a comprehensive role-based permission system that enables PvP, DM vs Player, and PvE scenarios:

Role-Based Permission System Implementation Plan
------------------------------------------------

### Architecture Overview

Replace the simple player.role: 'dm' | 'player' with a flexible Role system where:

-   Roles define permission sets (e.g., "DM", "Player", "Team Red", "Team Blue", "Monster")
-   Tokens belong to a role (via roleId)
-   Players are assigned one or more roles (via roleIds[])
-   Permissions determine what actions each role can perform

This enables:

-   PvP: Players in "Team Red" can't control "Team Blue" tokens
-   DM vs Player: DM role has elevated permissions
-   PvE: "Player" role controls player tokens, "Monster" role tokens controlled by DM only

* * * * *

### Phase 1: Data Model Design

1.1 Create Role Interface (new file: src/stores/roleStore.ts)

`export  interface  Role  {   id:  string;   name:  string;   color:  string;  // For visual identification (#hex)   isSystem:  boolean;  // true for "DM" and "Player", false for custom roles   permissions:  {    // Token control   canControlOwnTokens:  boolean;  // Can move/edit tokens of this role   canControlOtherTokens:  boolean;  // Can move/edit tokens of ANY role     // Vision & fog   canSeeAllFog:  boolean;  // Can see through all fog of war   canSeeFriendlyVision:  boolean;  // Can see fog cleared by tokens in same role   canSeeEnemyVision:  boolean;  // Can see fog cleared by tokens in other roles     // Token visibility   canSeeOwnTokens:  boolean;  // Can see own role tokens   canSeeOtherTokens:  boolean;  // Can see other role tokens   canSeeHiddenTokens:  boolean;  // Can see tokens marked as hidden     // Management   canCreateTokens:  boolean;  // Can spawn new tokens   canDeleteOwnTokens:  boolean;  // Can delete own role tokens   canDeleteOtherTokens:  boolean;  // Can delete any token     // Role management   canManageRoles:  boolean;  // Can create/edit/delete roles   canAssignRoles:  boolean;  // Can assign players to roles   canAssignTokenRoles:  boolean;  // Can change token role assignments     // Map & environment   canEditMap:  boolean;  // Can upload maps, edit regions   canManageFog:  boolean;  // Can manually add/remove fog   canManageInitiative:  boolean;  // Can modify initiative order    };  }`

1.2 Update Token Interface (src/stores/sessionStore.ts)

`export  interface  Token  {   id:  string;   name:  string;    // ... existing fields   roleId:  string;  // NEW: Which role this token belongs to   isHidden:  boolean;  // NEW: Whether token is hidden from non-privileged roles    // REMOVE: ownerId?: string; (replaced by roleId)  }`

1.3 Update Player Interface (src/stores/sessionStore.ts)

`export  interface  Player  {   id:  string;   name:  string;   roleIds:  string[];  // NEW: Player can be in multiple roles   isConnected:  boolean;    // REMOVE: role: 'dm' | 'player'; (replaced by roleIds)  }`

1.4 Default System Roles

`const  DEFAULT_ROLES:  Role[]  =  [    {   id:  'dm',   name:  'Dungeon Master',   color:  '#ef4444',  // red   isSystem:  true,   permissions:  {   canControlOwnTokens:  true,   canControlOtherTokens:  true,  // DM can move everything   canSeeAllFog:  true,   canSeeFriendlyVision:  true,   canSeeEnemyVision:  true,   canSeeOwnTokens:  true,   canSeeOtherTokens:  true,   canSeeHiddenTokens:  true,   canCreateTokens:  true,   canDeleteOwnTokens:  true,   canDeleteOtherTokens:  true,   canManageRoles:  true,   canAssignRoles:  true,   canAssignTokenRoles:  true,   canEditMap:  true,   canManageFog:  true,   canManageInitiative:  true,    }    },    {   id:  'player',   name:  'Player',   color:  '#22c55e',  // green   isSystem:  true,   permissions:  {   canControlOwnTokens:  true,   canControlOtherTokens:  false,  // Players can't move other players' tokens   canSeeAllFog:  false,   canSeeFriendlyVision:  true,  // Can see what party members see   canSeeEnemyVision:  false,   canSeeOwnTokens:  true,   canSeeOtherTokens:  true,  // Can see other visible tokens   canSeeHiddenTokens:  false,   canCreateTokens:  false,   canDeleteOwnTokens:  true,   canDeleteOtherTokens:  false,   canManageRoles:  false,   canAssignRoles:  false,   canAssignTokenRoles:  false,   canEditMap:  false,   canManageFog:  false,   canManageInitiative:  false,    }    }  ];`

* * * * *

### Phase 2: Role Selection Modal (Login Screen)

2.1 Create RoleSelectionModal (src/components/modals/RoleSelectionModal.tsx)

UI Flow:

1.  Username input (required)
2.  Role selection:
    -   Show all available roles in session
    -   Allow multi-select (player can be in multiple roles)
    -   DM role shows with special styling
3.  "Enter Session" button validates and proceeds

Modal Behavior:

-   Shows on app load if no valid currentPlayerId or player has no name
-   Shows after "Logout" action
-   Blocks access to main UI until completed
-   Cannot be dismissed (required to enter session)

Auto-role Assignment:

-   First user in session: Automatically gets "DM" role
-   Subsequent users: Get "Player" role by default
-   Users can change roles after entry (if they have permission)

* * * * *

### Phase 3: Permission Checking System

3.1 Create Permission Helpers (src/lib/rolePermissions.ts)

`import  type  {  Role,  Token,  Player  }  from  '../stores';    export  function  getPlayerRoles(player:  Player, allRoles:  Role[]):  Role[]  {    return allRoles.filter(role => player.roleIds.includes(role.id));  }    export  function  hasPermission(   player:  Player,   allRoles:  Role[],   permission:  keyof  Role['permissions']  ):  boolean  {    const roles =  getPlayerRoles(player, allRoles);    return roles.some(role => role.permissions[permission]);  }    export  function  canControlToken(token:  Token, player:  Player, allRoles:  Role[]):  boolean  {    const roles =  getPlayerRoles(player, allRoles);     // Check if player has role that can control this token    const hasTokenRole = roles.some(role => role.id  === token.roleId);    if  (hasTokenRole)  {    return roles.some(role => role.permissions.canControlOwnTokens);    }     // Otherwise check if player can control other tokens    return roles.some(role => role.permissions.canControlOtherTokens);  }    export  function  canSeeToken(token:  Token, player:  Player, allRoles:  Role[]):  boolean  {    if  (token.isHidden  &&  !hasPermission(player, allRoles,  'canSeeHiddenTokens'))  {    return  false;    }     const roles =  getPlayerRoles(player, allRoles);    const hasTokenRole = roles.some(role => role.id  === token.roleId);     if  (hasTokenRole)  {    return roles.some(role => role.permissions.canSeeOwnTokens);    }     return roles.some(role => role.permissions.canSeeOtherTokens);  }    export  function  canDeleteToken(token:  Token, player:  Player, allRoles:  Role[]):  boolean  {    const roles =  getPlayerRoles(player, allRoles);    const hasTokenRole = roles.some(role => role.id  === token.roleId);     if  (hasTokenRole)  {    return roles.some(role => role.permissions.canDeleteOwnTokens);    }     return roles.some(role => role.permissions.canDeleteOtherTokens);  }`

* * * * *

### Phase 4: Token Interaction Updates

4.1 Update useTokenInteraction Hook

-   Before startTokenDrag(): Check canControlToken()
-   Show toast if permission denied: "You don't have permission to move [RoleName] tokens"
-   Before selectToken(): Check permissions
-   Filter visible tokens with canSeeToken()

4.2 Update TokenContextMenu

-   Add "Change Token Role" submenu (permission: canAssignTokenRoles)
-   Disable options based on permissions:
    -   "Edit Label": Requires canControlToken()
    -   "Change Color": Requires canControlToken()
    -   "Delete": Requires canDeleteToken()
    -   "Hide Token": Requires canAssignTokenRoles (DM feature)

* * * * *

### Phase 5: Role Management UI

5.1 Create RoleManagerCard (src/components/cards/RoleManagerCard.tsx)

Features:

-   List all roles in session
-   For each role:
    -   Show name, color, and player count
    -   Edit permissions (permission: canManageRoles)
    -   View assigned players
    -   View assigned tokens
    -   Delete role (permission: canManageRoles, cannot delete system roles)
-   Create new role button
-   Role duplication (copy permissions from existing role)

Role Creation Form:

-   Name input
-   Color picker
-   Permission checkboxes (all disabled by default except basic viewing)
-   Pre-built templates: "Co-DM", "PvP Team", "NPC Controller"

5.2 Update MenuCard

-   Add "Manage Roles" button (only visible if canManageRoles)
-   Add "Logout" button (always visible)

* * * * *

### Phase 6: Visual Indicators

6.1 Token Visual Indicators

-   Border color matches token's role color
-   Opacity/glow for controllable vs non-controllable tokens:
    -   Controllable: Full opacity, glow effect on hover
    -   Non-controllable: 70% opacity, no glow, lock icon overlay
    -   Hidden: Ghosted appearance (only visible to privileged roles)

6.2 Token Label Enhancements

-   Show role badge next to token name (colored dot or icon)
-   On hover: Tooltip showing role name and permissions

6.3 Cursor Changes

-   Hover over controllable token: cursor: pointer
-   Hover over non-controllable token: cursor: not-allowed
-   Hover over hidden token: cursor: default (if even visible)

* * * * *

### Phase 7: Advanced Features

7.1 Bulk Role Operations

-   Select multiple tokens → "Assign all to [Role]" in context menu
-   Requires canAssignTokenRoles permission

7.2 Role Templates for Common Scenarios

`const  ROLE_TEMPLATES  =  [    {   name:  'Co-DM',   description:  'Full DM powers for collaborative DMing',   baseRole:  'dm'  // Copy all permissions from DM role    },    {   name:  'PvP Team',   description:  'Players competing against each other',   permissions:  {   canControlOwnTokens:  true,   canSeeOwnTokens:  true,   canSeeOtherTokens:  true,   canSeeFriendlyVision:  false,  // Can't see enemy vision    // ... rest disabled    }    },    {   name:  'Monster Controller',   description:  'Control NPC/monster tokens without full DM access',   permissions:  {   canControlOwnTokens:  true,   canSeeAllFog:  false,   canSeeFriendlyVision:  true,    // ... limited permissions    }    }  ];`

7.3 Role-Based Fog of War

-   Fog rendering considers canSeeFriendlyVision and canSeeEnemyVision
-   Tokens in same role share vision if canSeeFriendlyVision is true
-   DM with canSeeAllFog sees the map with no fog

7.4 Initiative Integration

-   Initiative Panel groups tokens by role
-   Collapsible role sections
-   Role color coding for quick identification

* * * * *

### Phase 8: Persistence & Migration

8.1 Update Session Serialization

-   Persist roles to localStorage
-   Persist player role assignments
-   On session load, restore roles

8.2 Migration Strategy For existing sessions with token.ownerId and player.role:

`function  migrateOldSession(session:  OldSessionState):  NewSessionState  {    const roles =  [...DEFAULT_ROLES];     // Migrate tokens    const tokens = session.tokens.map(token =>  ({    ...token,   roleId: token.ownerId  ?  'player'  :  'dm',   isHidden:  false,    }));     // Migrate players    const players = session.players.map(player =>  ({    ...player,   roleIds: player.role  ===  'dm'  ?  ['dm']  :  ['player'],    }));     return  {  ...session, tokens, players, roles };  }`

8.3 URL Session Sharing

-   When new player joins via session URL:
    -   Load existing roles from session
    -   Show RoleSelectionModal with available roles
    -   Allow player to choose which role(s) to join

* * * * *

### Implementation Order

1.  Create Role Store - Data model and default roles
2.  Create Permission Helpers - Core authorization logic
3.  Role Selection Modal - Entry point for all users
4.  Update Token/Player Interfaces - Migrate from ownerId to roleId
5.  Update useTokenInteraction - Enforce permissions on drag/select
6.  Update TokenContextMenu - Role assignment and permission-based options
7.  Create RoleManagerCard - Full role management UI
8.  Visual Indicators - Borders, tooltips, cursor changes
9.  Migration Logic - Handle existing sessions
10. Testing - PvP, co-DM, and PvE scenarios

* * * * *

### Files to Create

New Files:

-   src/stores/roleStore.ts - Role state management
-   src/lib/rolePermissions.ts - Permission checking helpers
-   src/components/modals/RoleSelectionModal.tsx - Login/role selection
-   src/components/cards/RoleManagerCard.tsx - Role management UI

Modified Files:

-   src/stores/sessionStore.ts - Update Token/Player interfaces, add roleId
-   src/hooks/useTokenInteraction.ts - Add permission checks
-   src/components/TokenContextMenu.tsx - Add role assignment, permission checks
-   src/components/SimpleTabletop.tsx - Visual indicators, permission-based rendering
-   src/components/cards/MenuCard.tsx - Add "Manage Roles" and "Logout" buttons
-   src/App.tsx - Show RoleSelectionModal when needed
-   src/lib/projectSerializer.ts - Serialize/deserialize roles

* * * * *

### Example Scenarios

Scenario 1: Co-DMing

-   Alice and Bob both choose "DM" role
-   Both can control all tokens, manage fog, edit map
-   Perfect for shared storytelling

Scenario 2: PvP Battle

-   DM creates "Team Red" and "Team Blue" roles
-   Sets canSeeFriendlyVision: false on both
-   Players on Team Red can't see Team Blue's vision (fog remains for them)
-   DM sees everything

Scenario 3: Traditional D&D

-   DM role controls monsters (roleId: 'dm')
-   All player characters have roleId: 'player'
-   Players share vision (canSeeFriendlyVision: true)
-   Players can't control monster tokens

Scenario 4: Player as Monster Controller

-   DM creates "Monster Controller" role
-   Assigns to trusted player
-   That player can move monsters but can't see DM-only information
-   Can't edit map or manage fog

* * * * *

### Testing Checklist

-   [ ]  First user gets DM role automatically
-   [ ]  Subsequent users get Player role
-   [ ]  DM can create custom roles
-   [ ]  DM can assign players to multiple roles
-   [ ]  Player cannot move tokens from other roles (without permission)
-   [ ]  Hidden tokens only visible to privileged roles
-   [ ]  Role colors display correctly on tokens
-   [ ]  Permission checks prevent unauthorized actions
-   [ ]  TokenContextMenu shows/hides options based on permissions
-   [ ]  Logout returns to RoleSelectionModal
-   [ ]  Session sharing preserves roles
-   [ ]  Migration from old ownerId system works
-   [ ]  Co-DM scenario: Two DMs can both control everything
-   [ ]  PvP scenario: Team Red can't control Team Blue tokens
-   [ ]  Visual indicators show controllability clearly

This role-based system gives you:

-   ✅ Co-DMing - Multiple users with full DM powers
-   ✅ PvP Events - Separate teams with isolated vision and control
-   ✅ PvE Events - Traditional DM vs players
-   ✅ Flexible Permissions - Custom roles for any scenario
-   ✅ Visual Clarity - Color coding and indicators show who controls what
-   ✅ No Central Server - All role data stored in session state
-   ✅ URL Sharing - New players can join and select roles

The key insight is that roles are permission containers, and tokens/players are assigned to roles. This is much more powerful than simple "ownership" and enables all the scenarios you mentioned!

Would you like me to implement this plan?