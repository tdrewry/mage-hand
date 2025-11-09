# D20PRO Virtual Tabletop - Critical Dependencies

This document outlines the critical dependencies for the D20PRO Virtual Tabletop application and explains why they are essential to the project's functionality.

## ⚠️ IMPORTANT: DO NOT REMOVE THESE DEPENDENCIES

The dependencies listed below are **CRITICAL** to the application's core functionality. Removing any of these packages will cause the application to break.

## Core Framework Dependencies

### React Ecosystem
- **react** (^18.3.1) - Core React library for the entire UI
- **react-dom** (^18.3.1) - DOM rendering for React components
- **react-router-dom** (^6.30.1) - Client-side routing for navigation

**Why Critical:** The entire application is built on React. Removing these will completely break the application.

### TypeScript & Build Tools
- **typescript** - Type safety and development experience
- **vite** - Build tool and development server
- **@types/*** - TypeScript definitions for various libraries

**Why Critical:** The codebase is written in TypeScript. Vite handles the build process and development server.

## State Management

### Zustand
- **zustand** (^5.0.8) - State management library

**Why Critical:** All application state (tokens, maps, regions, sessions) is managed through Zustand stores. Removing this would require a complete rewrite of state management.

**Files that depend on Zustand:**
- `src/stores/sessionStore.ts`
- `src/stores/mapStore.ts` 
- `src/stores/regionStore.ts`
- `src/components/SimpleTabletop.tsx`
- All modal components

## UI Component Library

### Radix UI Components
- **@radix-ui/react-*** - Headless UI component primitives

**Why Critical:** The entire UI is built using Radix UI components. These provide accessibility, keyboard navigation, and proper focus management.

**Components that depend on Radix:**
- All components in `src/components/ui/`
- All modal dialogs
- Dropdown menus, tooltips, etc.

### Styling
- **tailwindcss** - Utility-first CSS framework
- **tailwindcss-animate** - Animation utilities
- **class-variance-authority** - Component variant management
- **clsx** / **tailwind-merge** - Conditional class handling

**Why Critical:** The entire design system is built on Tailwind CSS. The application styling would be completely broken without these.

## Canvas & Graphics

### Fabric.js (DO NOT REMOVE)
- **fabric** (^6.7.1) - HTML5 Canvas library for interactive graphics

**Why Critical:** While we are currently using a custom canvas implementation, Fabric.js may be integrated in future versions for advanced canvas functionality. This dependency is preserved for:
- Potential migration path to Paper.js-like functionality
- Advanced transformation matrices
- Complex shape handling
- Group operations

**DO NOT REMOVE:** This dependency is intentionally kept as part of our enhanced canvas system architecture.

## Form Handling
- **react-hook-form** - Form state management
- **@hookform/resolvers** - Form validation
- **zod** - Schema validation

**Why Critical:** Used extensively in modal forms for token properties, region settings, etc.

## UI Enhancement Libraries
- **lucide-react** - Icon library used throughout the app
- **sonner** - Toast notifications for user feedback
- **cmdk** - Command palette functionality

**Why Critical:** These provide essential UI elements and user feedback mechanisms.

## Utility Libraries
- **date-fns** - Date manipulation utilities
- **clsx** - Conditional className utility

**Why Critical:** Used for date formatting in project metadata and conditional styling throughout the app.

## Development Dependencies

### Linting & Code Quality
- **eslint** - Code linting
- **@typescript-eslint/** - TypeScript linting rules

**Why Critical:** Maintains code quality and catches potential errors during development.

## Protected Installation Commands

If you need to add or remove dependencies, use these Lovable-specific commands:

```bash
# To add a dependency
<lov-add-dependency>package-name@version</lov-add-dependency>

# To remove a dependency  
<lov-remove-dependency>package-name</lov-remove-dependency>
```

## Architecture Notes

### Enhanced Canvas System
The application uses a sophisticated canvas rendering system with:
- Custom drawing routines for optimal performance
- Grid systems supporting both square and hexagonal grids
- Token management with drag/drop functionality
- Region-based map organization
- Transform matrix operations for scaling/rotation

### State Management Architecture
- **sessionStore**: Manages tokens, players, and session state
- **mapStore**: Handles game maps and their regions
- **regionStore**: Manages canvas regions with grid settings
- All stores use Zustand with persistence middleware

### Component Architecture
- Modular component design with single responsibility
- UI components in `src/components/ui/` (shadcn/ui based)
- Business logic components in `src/components/`
- Utility functions in `src/lib/` and `src/utils/`

## Performance Considerations

The application is optimized for real-time canvas interactions:
- Efficient re-rendering strategies
- Viewport-based culling
- Optimized grid rendering
- Minimal DOM manipulation

**Removing any core dependencies could severely impact performance and functionality.**

---

**Last Updated:** 2025-01-XX
**Version:** 1.0.0

**⚠️ WARNING:** Any unauthorized removal of dependencies listed in this document may result in application failure. Always consult this document before making dependency changes.