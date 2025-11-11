import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { useStorageWarning } from "./hooks/useStorageWarning";
import { useAutoReconnect } from "./hooks/useAutoReconnect";
import { ConnectionIndicator } from "./components/ConnectionIndicator";

const queryClient = new QueryClient();

const App = () => {
  // Set dark mode by default for gaming
  React.useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Monitor storage usage and show warnings
  useStorageWarning();

  // Auto-reconnect to multiplayer session on page load
  useAutoReconnect();

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ConnectionIndicator />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
