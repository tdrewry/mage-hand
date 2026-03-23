import React, { useState } from 'react';
import { useTelemetryStore, TelemetryRule } from '@/stores/telemetryStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { syncProfiler } from '@/lib/jazz/profiler';
import { Trash2, Edit2, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export function TelemetrySettingsPanel() {
  const { webhooks, rules, addWebhook, removeWebhook, saveRule, removeRule } = useTelemetryStore();
  const [newWebhook, setNewWebhook] = useState('');
  
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingRuleName, setEditingRuleName] = useState('');
  const [editingRuleLogic, setEditingRuleLogic] = useState('');
  const [logicError, setLogicError] = useState<string | null>(null);

  const handleAddWebhook = () => {
    if (newWebhook.trim() && newWebhook.trim().startsWith('http')) {
      addWebhook(newWebhook.trim());
      setNewWebhook('');
    }
  };

  const handleEditRule = (rule: TelemetryRule) => {
    setEditingRuleId(rule.id);
    setEditingRuleName(rule.name);
    setEditingRuleLogic(JSON.stringify(rule.logic, null, 2));
    setLogicError(null);
  };

  const handleSaveRule = () => {
    try {
      const parsedLogic = JSON.parse(editingRuleLogic);
      
      saveRule({
        id: editingRuleId || Date.now().toString(),
        name: editingRuleName || 'New Rule',
        logic: parsedLogic
      });
      
      setEditingRuleId(null);
      setEditingRuleName('');
      setEditingRuleLogic('');
      setLogicError(null);
    } catch (e) {
      setLogicError('Invalid JSON format for json-logic rule.');
    }
  };

  const handleTestAlert = () => {
    // Generate a mock metric spike and force an evaluation cycle roughly
    const mockMetrics = {
      timestamp: new Date().toISOString(),
      outKb: 1000,
      inKb: 0,
      outOps: 500,
      inOps: 0,
      activeDOs: 0,
      streamOutKb: 0,
      streamInKb: 0
    };

    // Use the syncProfiler's new evaluation engine explicitly for tests
    syncProfiler.evaluateAlertRules(mockMetrics, true);
  };

  return (
    <div className="space-y-6 flex-1 overflow-y-auto pr-2 pb-4">
      <div>
        <h3 className="text-sm font-medium text-foreground mb-1">Webhooks</h3>
        <p className="text-xs text-muted-foreground mb-3">Add Discord or Slack webhooks to receive metrics alerts.</p>
        
        <div className="flex gap-2 mb-3">
          <Input 
            value={newWebhook}
            onChange={(e) => setNewWebhook(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="flex-1 text-xs"
          />
          <Button size="sm" onClick={handleAddWebhook}>Add</Button>
        </div>

        {webhooks.length > 0 && (
          <ul className="space-y-2 border rounded-md divide-y overflow-hidden max-h-40 overflow-y-auto">
            {webhooks.map((url, i) => (
              <li key={i} className="flex items-center justify-between text-xs bg-muted/40 p-2 group">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="truncate flex-1 pr-2 text-muted-foreground group-hover:text-foreground transition-colors">
                      {url}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">{url}</TooltipContent>
                </Tooltip>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => removeWebhook(url)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-sm font-medium text-foreground">Alerting Rules</h3>
          {!editingRuleId && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
              setEditingRuleId('new_' + Date.now());
              setEditingRuleName('New Alert Rule');
              setEditingRuleLogic('{\n  "and": [\n    { ">": [{ "var": "outOps" }, 150] },\n    { ">": [{ "var": "outKb" }, 20] }\n  ]\n}');
            }}>Add Rule</Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">Define json-logic rules evaluated against 10s windows.</p>
        
        <div className="space-y-3">
          {rules.map(rule => (
            <details key={rule.id} className="group border rounded-md bg-muted/20 overflow-hidden">
              <summary className="flex justify-between items-center p-2 border-b bg-muted/30 cursor-pointer list-none [&::-webkit-details-marker]:hidden focus:outline-none focus:bg-muted/40 transition-colors">
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-3 w-3 group-open:rotate-90 transition-transform text-muted-foreground" />
                  <span className="font-medium text-xs">{rule.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={(e) => { e.preventDefault(); handleEditRule(rule); }}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.preventDefault(); removeRule(rule.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </summary>
              <pre className="text-[10px] p-2 overflow-x-auto text-muted-foreground bg-muted/10">
                {JSON.stringify(rule.logic, null, 2)}
              </pre>
            </details>
          ))}

          {editingRuleId !== null && (
            <div className="border border-primary/40 p-3 rounded-md bg-card shadow-sm space-y-3 mt-4">
              <h4 className="text-xs font-semibold mb-2">{editingRuleId.startsWith('new_') ? 'Create Rule' : 'Edit Rule'}</h4>
              <Input 
                value={editingRuleName} 
                onChange={(e) => setEditingRuleName(e.target.value)} 
                placeholder="Rule Name" 
                className="text-xs h-8"
              />
              <Textarea 
                value={editingRuleLogic} 
                onChange={(e) => setEditingRuleLogic(e.target.value)} 
                placeholder='{ ">": [{ "var": "outOps" }, 100] }'
                className="font-mono text-xs h-32"
              />
              {logicError && <p className="text-destructive text-xs">{logicError}</p>}
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingRuleId(null)}>Cancel</Button>
                <Button size="sm" className="h-7 text-xs" onClick={handleSaveRule}>Save Rule</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pt-4 mt-6 border-t border-border">
        <Button onClick={handleTestAlert} variant="secondary" className="w-full text-xs">
          Test Alerts ({webhooks.length} webhooks configured)
        </Button>
        <p className="text-[10px] text-muted-foreground text-center mt-2">Mocks 500 Ops / 1000 KB and triggers matched rules.</p>
      </div>
    </div>
  );
}
