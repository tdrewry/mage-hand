import React from 'react';
import { useGlobalConfigStore } from '@/stores/globalConfigStore';
import { Database, Network } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export function SchemaRegistry() {
  const schemas = useGlobalConfigStore((s) => s.schemas);
  const schemaList = Object.values(schemas);

  return (
    <div className="flex flex-col h-full bg-background border border-border rounded-md overflow-hidden m-2">
      <div className="p-4 border-b border-border bg-card/30 flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" /> Schema Registry
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Available execution context blueprints loaded into the Dictionary</p>
        </div>
        <div className="text-xs font-semibold px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-md border border-indigo-500/20">
          {schemaList.length} Active Schemas
        </div>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schemaList.map(s => (
            <div key={s.id} className="p-4 rounded-lg border border-border bg-card shadow-sm flex flex-col gap-2 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50" />
              <div className="flex items-center gap-2 mb-1 pl-2">
                <Network className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-card-foreground">{s.id}</h3>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 pl-2" title={s.rootSchema.description}>
                <strong className="text-slate-300">{s.label}</strong> — {s.rootSchema.description || 'No description provided.'}
              </p>
              <div className="mt-2 text-[10px] font-mono text-muted-foreground bg-muted/80 p-1.5 rounded truncate border border-border ml-2 flex justify-between">
                <span>{Object.keys(s.rootSchema.properties || {}).length} Root Properties</span>
                <span className="text-indigo-400/70">{s.rootSchema.type}</span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
