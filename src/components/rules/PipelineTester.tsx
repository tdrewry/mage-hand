import React, { Suspense, lazy } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { compilePipeline, executePipeline, extractVariables } from '@/lib/rules-engine/compiler';
import { ActionCard } from '@/components/cards/ActionCard';
import type { ResolutionPayload } from '@/lib/rules-engine/types';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

function isResolutionPayload(obj: any): obj is ResolutionPayload {
  return obj && !obj.error && obj.attacker && obj.defender && obj.source && obj.damage && Array.isArray(obj.damage);
}

export function PipelineTester({ 
  nodes, 
  entryNodeId, 
  mockStateJson, 
  setMockStateJson, 
  outputState, 
  setOutputState, 
  setIsTestMode 
}: any) {
  return (
    <div className="absolute inset-0 z-50 bg-background flex flex-col pt-4">
      <div className="flex-1 min-h-0 grid grid-cols-3 gap-6 px-6 pb-6 overflow-hidden">
        {/* Column 1: Execution Order */}
        <div className="flex flex-col min-h-0 bg-card border border-border rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-sm mb-3 shrink-0">Execution Order</h3>
          <div className="flex-1 min-h-0 overflow-y-auto pr-2">
            <Accordion type="multiple" className="w-full text-xs border border-border rounded bg-background/50 overflow-hidden">
              {compilePipeline(nodes, entryNodeId || undefined).map((n: any, idx: number) => {
                const reads = extractVariables(n.nodeData.jsonLogic || {});
                const writes = n.nodeData.outputTarget;
                return (
                  <AccordionItem key={n.id} value={n.id} className="border-b last:border-b-0 border-border">
                    <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/50 transition-none border-none">
                      <div className="flex items-center gap-2 text-left w-full pr-2">
                        <span className="text-muted-foreground w-4">{idx + 1}.</span>
                        <span className="font-medium truncate flex-1">{n.nodeData.name || n.id}</span>
                        <span className="text-[10px] opacity-70 shrink-0 capitalize">{n.nodeType.replace('_', ' ')}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3 pt-0 flex flex-col gap-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase">Reads</span>
                        <div className="flex flex-wrap gap-1">
                          {reads.length > 0 ? reads.map((r: string) => (
                            <span key={r} className="px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary text-[10px] font-mono">{r}</span>
                          )) : <span className="text-[10px] text-muted-foreground italic">None</span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase">Writes To</span>
                        <div>
                          {writes ? (
                            <span className="px-1.5 py-0.5 rounded-sm bg-orange-500/10 text-orange-500 dark:text-orange-400 text-[10px] font-mono">{writes}</span>
                          ) : <span className="text-[10px] text-muted-foreground italic">None</span>}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
              {nodes.length === 0 && <div className="p-3 text-muted-foreground text-center text-xs">No nodes in pipeline.</div>}
            </Accordion>
          </div>
          <div className="pt-4 mt-auto shrink-0 border-t border-border mt-4">
            <Button 
              size="lg"
              className="w-full font-bold shadow-md h-12"
              onClick={() => {
                try {
                  const parsed = JSON.parse(mockStateJson);
                  const compiled = compilePipeline(nodes, entryNodeId || undefined);
                  const result = executePipeline(compiled, parsed);
                  setOutputState(result);
                  toast.success("Pipeline executed successfully!");
                } catch (e: any) {
                  setOutputState({ error: e.message });
                  toast.error("Execution failed: " + e.message);
                }
              }}
            >
              <Play className="w-4 h-4 mr-2 fill-current" /> RUN PIPELINE
            </Button>
          </div>
        </div>

        {/* Column 2: Mock State Input */}
        <div className="flex flex-col min-h-0 bg-card border border-border rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-sm mb-3 shrink-0">Mock State (Input)</h3>
          <div className="flex-1 min-h-0 border border-border rounded-md overflow-hidden">
            <Suspense fallback={<div className="p-4 text-xs text-muted-foreground text-center flex items-center justify-center h-full">Loading Editor...</div>}>
              <MonacoEditor
                height="100%"
                language="json"
                value={mockStateJson}
                onChange={(val) => setMockStateJson(val || '')}
                theme="vs-dark"
                options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on', formatOnPaste: false, formatOnType: false, padding: { top: 16 } }}
              />
            </Suspense>
          </div>
        </div>

        {/* Column 3: Output State */}
        <div className="flex flex-col min-h-0 bg-card border border-border rounded-lg p-4 shadow-sm">
          <h3 className="font-semibold text-sm mb-3 shrink-0">Output Result</h3>
          <div className={`flex-1 min-h-0 flex flex-col border border-border rounded-md overflow-y-auto ${isResolutionPayload(outputState) ? 'bg-background' : 'bg-black/40 p-4'}`}>
             {outputState ? (
              isResolutionPayload(outputState) ? (
                <ActionCard 
                  payload={outputState} 
                  onCommit={() => toast.success("Committed test resolution!")}
                />
              ) : (
                <pre className={`text-sm font-mono whitespace-pre-wrap ${outputState?.error ? 'text-destructive' : 'text-green-400'}`}>
                  {JSON.stringify(outputState, null, 2)}
                </pre>
              )
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm italic p-4">
                Run the pipeline to inspect outputs here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
