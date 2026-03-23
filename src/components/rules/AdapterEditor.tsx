import React from 'react';
import { Plug } from 'lucide-react';

export function AdapterEditor() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center border border-dashed border-border rounded-lg bg-background/50 m-2">
      <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mb-4 border border-orange-500/20">
        <Plug className="w-6 h-6 text-orange-400" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Adapter Hub</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Adapters dynamically bundle logic pipelines, dynamic components, and schema modifiers into reusable system plugins.
      </p>
      <div className="mt-6 px-4 py-2 border border-orange-500/20 bg-orange-500/5 text-orange-400/80 rounded-md text-xs font-medium">
        0 Adapters Registered
      </div>
    </div>
  );
}
