import { useState } from 'react';
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';
import { useGlobalConfigStore } from '@/stores/globalConfigStore';
import type { SchemaNode } from '@/lib/rules-engine/schemas';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

function CopyPathButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button 
          onClick={(e) => { e.stopPropagation(); handleCopy(); }}
          className="p-1 hover:bg-slate-700/50 rounded text-slate-500 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        Copy variable path
      </TooltipContent>
    </Tooltip>
  );
}

function SchemaNodeTree({ name, node, path }: { name: string, node: SchemaNode, path: string }) {
  const [expanded, setExpanded] = useState(false);
  const isExpandable = node.type === 'object' && node.properties;

  return (
    <div className="text-sm font-mono mt-1">
      <div 
        className={`flex items-start gap-2 group p-1.5 -ml-1 rounded ${isExpandable ? 'cursor-pointer hover:bg-slate-800/50' : 'hover:bg-slate-800/30'}`}
        onClick={() => isExpandable && setExpanded(!expanded)}
      >
        <div className="w-4 shrink-0 flex items-center justify-center mt-0.5 text-slate-500">
          {isExpandable && (expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)}
        </div>
        <div className="flex-1 min-w-0 flex items-start gap-2 whitespace-nowrap">
          <span className="text-rose-300 shrink-0 font-bold">{name}</span>
          <span className="text-slate-500 shrink-0 text-xs mt-0.5">
            {node.type}{node.items ? `[${node.items.type}]` : ''}
          </span>
          {node.description && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-slate-400 text-[11px] mt-0.5 truncate hidden sm:inline-block max-w-[300px] xl:max-w-none">
                  // {node.description}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">{node.description}</TooltipContent>
            </Tooltip>
          )}
          {node.enumValues && (
            <span className="text-amber-200/70 text-[10px] mt-0.5 flex gap-1 items-center flex-wrap">
              = {node.enumValues.map(v => `'${v}'`).join(' | ')}
            </span>
          )}
        </div>
        <CopyPathButton path={path} />
      </div>
      
      {isExpandable && expanded && node.properties && (
        <div className="ml-4 pl-3 border-l border-slate-800 pb-1">
          {Object.entries(node.properties).map(([key, childNode]) => (
            <SchemaNodeTree 
              key={key} 
              name={key} 
              node={childNode} 
              path={path.includes('[') || path.includes(']') ? path : `${path}.${key}`} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DataDictionaryTab() {
  const schemas = useGlobalConfigStore(s => s.schemas);

  return (
    <ScrollArea className="h-full bg-slate-950/50">
      <div className="p-6 pb-20 max-w-5xl mx-auto">
        <h3 className="text-xl font-bold text-slate-200 mb-2">Execution Context Dictionary</h3>
        <p className="text-sm text-slate-400 mb-8 max-w-3xl">
          These root properties are automatically injected into your pipeline during execution. 
          Use the JSON-logic <code className="bg-slate-900 px-1 py-0.5 rounded text-rose-300">{"{\"var\": \"path\"}"}</code> operator to extract values. Hover over any property and click the icon to copy its exact JSON path.
        </p>

        <div className="space-y-6">
          {Object.values(schemas).map(schema => (
            <div key={schema.id} className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 shadow-sm">
              <div className="mb-4">
                <h4 className="text-lg font-semibold text-slate-300">{schema.label}</h4>
                <p className="text-sm text-slate-500">{schema.rootSchema.description}</p>
              </div>
              
              <div className="bg-slate-950/80 border border-slate-800/50 rounded-md p-2 overflow-x-auto">
                <SchemaNodeTree 
                  name={schema.id} 
                  node={schema.rootSchema} 
                  path={schema.id} 
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
