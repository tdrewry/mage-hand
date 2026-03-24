import React from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { useStorageWarning } from "./hooks/useStorageWarning";
import { useAutoReconnect } from "./hooks/useAutoReconnect";
import { useCardStore } from "./stores/cardStore";
import { startDiceRollNotifier, stopDiceRollNotifier } from "./lib/diceRollNotifier";
import { JazzSessionProvider } from "./lib/jazz/provider";
import { SyncProfilerPanel } from "./components/SyncProfilerPanel";


const queryClient = new QueryClient();

/**
 * Inner app component — contains all hooks and routing.
 * Separated so it can be wrapped by optional providers.
 */
const AppInner = () => {
  // Set dark mode by default for gaming
  React.useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Clamp all open cards to the viewport when the window is resized
  const clampCardsToViewport = useCardStore((state) => state.clampCardsToViewport);
  React.useEffect(() => {
    let rafId: number;
    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(clampCardsToViewport);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafId);
    };
  }, [clampCardsToViewport]);

  // Monitor storage usage and show warnings
  useStorageWarning();

  // Auto-reconnect to multiplayer session on page load
  useAutoReconnect();

  // Start dice roll toast notifications for multiplayer
  React.useEffect(() => {
    startDiceRollNotifier();
    return () => stopDiceRollNotifier();
  }, []);

  // Register ephemeral networking handlers once on boot
  React.useEffect(() => {
    const registerHandlers = async () => {
      try {
        const { registerTokenHandlers } = await import("@/lib/net/ephemeral/tokenHandlers");
        const { registerCursorHandlers } = await import("@/lib/net/ephemeral/cursorHandlers");
        const { registerPresenceHandlers } = await import("@/lib/net/ephemeral/presenceHandlers");
        const { registerMiscHandlers } = await import("@/lib/net/ephemeral/miscHandlers");
        const { registerMapHandlers } = await import("@/lib/net/ephemeral/mapHandlers");
        const { registerEffectHandlers } = await import("@/lib/net/ephemeral/mapTemplateHandlers");
        const { registerAmbientHandlers } = await import("@/lib/net/ephemeral/ambientHandlers");
        
        registerTokenHandlers();
        registerCursorHandlers();
        registerPresenceHandlers();
        registerMiscHandlers();
        registerMapHandlers();
        registerEffectHandlers();
        registerAmbientHandlers();
      } catch (err) {
        console.error("Failed to register ephemeral handlers:", err);
      }
    };
    registerHandlers();
  }, []);

  return (
    <>
      <Toaster />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <SyncProfilerPanel />
    </>
  );
};

/**
 * Main application component that sets up providers, routing, and global hooks.
 * 
 * The JazzSessionProvider wraps the entire app to make Jazz CoValues available.
 * It operates in anonymous auth mode — no login required.
 * Jazz is an OPTIONAL transport; the app works without a sync server running.
 */
const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <JazzSessionProvider>
          <AppInner />
        </JazzSessionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
