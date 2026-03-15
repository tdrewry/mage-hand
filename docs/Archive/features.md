# Atlas Arcana - Features Document

Atlas Arcana is a real-time multiplayer tabletop session server and client, designed for seamless virtual tabletop experiences.

## Core Features

### 1. Multiplayer Session Management
- **Real-time Synchronization**: Powered by Socket.io for instant updates across all connected clients.
- **Session Control**: Create, join, and manage sessions with unique 6-character alphanumeric codes.
- **Password Protection**: Optional security for private gaming sessions.
- **User Roles**: Support for different roles (e.g., DM and Players) with specific permissions.
- **Automatic Cleanup**: In-memory session management with automatic cleanup when all users disconnect.

### 2. Map & Region Management
- **Multi-Map Support**: Manage multiple maps within a single session.
- **Layering & Reordering**: Flexible map stack management.
- **Grid Regions**: Define specific regions on maps with grid-based interactions.
- **Visibility Control**: Toggle map visibility for players.

### 3. Fog of War
- **Advanced Vision Systems**: Real-time vision calculation for tokens.
- **Exploration Tracking**: Persistent "explored" areas that remain visible but dimmed.
- **Configurable Aesthetics**: Adjustable fog opacity, explored area opacity, and edge blur.
- **Post-Processing**: Volumetric fog effects and light falloff for enhanced atmosphere.

### 4. Initiative & Combat Tracking
- **Combat State Management**: Easily start and end combat encounters.
- **Initiative Order**: Automatic and manual sorting of combatants.
- **Turn Management**: Track current turns and rounds.
- **Movement Restriction**: Option to restrict token movement during combat based on initiative.

### 5. Token Management
- **Interactive Tokens**: Add, move, and remove tokens on the map.
- **Customization**: Update token names, labels, colors, and images.
- **Vision & Illumination**: Individual token vision ranges and light source configurations.
- **Ownership**: Assign tokens to specific players.

### 6. Card-Based UI System
- **Modular Interface**: Register and manage various UI components as interactive "cards".
- **Customizable Layout**: Minimize, toggle visibility, and reposition UI cards.
- **Layout Persistence**: Save and load custom UI arrangements.

### 7. Dungeon Generation & Rendering
- **Procedural Generation**: Integration with dungeon generation tools (e.g., Watabou style).
- **Advanced Rendering**: Support for different wall styles, thicknesses, and texture scales.
- **Dynamic Lighting**: Real-time shadow casting and light source management within dungeons.

## Technical Architecture

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Shadcn UI, Pixi.js/Paper.js for rendering.
- **State Management**: Zustand for client-side state, with persistence and multiplayer synchronization.
- **Backend**: Node.js, Socket.io for the multiplayer server.
