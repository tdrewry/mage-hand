import React, { useState } from 'react';
import { useGlobalConfigStore } from '@/stores/globalConfigStore';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, Settings2, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function LexiconEditor() {
  const store = useGlobalConfigStore();
  
  const categoriesList = Object.values(store.categories);
  const defaultActive = categoriesList.length > 0 ? categoriesList[0].id : '';

  const [activeCategory, setActiveCategory] = useState<string>(defaultActive);
  const [newItemValue, setNewItemValue] = useState('');
  
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const [newCatLabel, setNewCatLabel] = useState('');
  
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatValue, setEditCatValue] = useState('');

  // Ensure we fall back to something if activeCategory was deleted
  const activeCatObj = store.categories[activeCategory] || categoriesList[0];
  const activeList = activeCatObj?.items || [];
  const currentCategoryId = activeCatObj?.id || '';

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCategoryId) return;
    const val = newItemValue.trim();
    if (!val) return;
    
    if (activeList.some(i => i.value === val)) {
      toast.error(`"${val}" already exists in ${activeCatObj.label}`);
      return;
    }
    
    store.addItem(currentCategoryId, val);
    setNewItemValue('');
  };

  const handleRemoveItem = (index: number) => {
    if (!currentCategoryId) return;
    store.removeItem(currentCategoryId, index);
  };

  const startEditing = (index: number, val: string) => {
    setEditingIndex(index);
    setEditValue(val);
  };

  const saveEdit = (index: number) => {
    if (!currentCategoryId) return;
    const val = editValue.trim();
    if (!val) {
      setEditingIndex(null);
      return;
    }
    
    if (val !== activeList[index].value && activeList.some(i => i.value === val)) {
      toast.error(`"${val}" already exists.`);
      setEditingIndex(null);
      return;
    }
    
    store.updateItem(currentCategoryId, index, val);
    setEditingIndex(null);
  };

  const startEditingCat = (id: string, label: string) => {
    setEditingCatId(id);
    setEditCatValue(label);
  };

  const saveCatEdit = (id: string) => {
    const val = editCatValue.trim();
    if (!val) {
      setEditingCatId(null);
      return;
    }
    
    if (val !== store.categories[id]?.label && categoriesList.some(c => c.label.toLowerCase() === val.toLowerCase())) {
      toast.error(`Lexicon "${val}" already exists.`);
      setEditingCatId(null);
      return;
    }
    
    store.updateCategoryLabel(id, val);
    setEditingCatId(null);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newCatLabel.trim();
    if (!label) return;
    
    const id = label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!id || store.categories[id]) {
      toast.error('Invalid or duplicate lexicon name.');
      return;
    }
    
    store.addCategory(id, label);
    setNewCatLabel('');
    setActiveCategory(id);
    toast.success(`Lexicon "${label}" added!`);
  };

  return (
    <div className="flex h-full w-full bg-background rounded-md border border-border overflow-hidden">
      {/* Left Column: Lexicons */}
      <div className="w-64 border-r border-border bg-card/50 flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Lexicons
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Manage system vocabulary</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {categoriesList.map(cat => (
            <div key={cat.id} className={`group flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors cursor-pointer ${
                activeCategory === cat.id 
                  ? 'bg-primary/10 text-primary font-medium' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              onClick={() => {
                setActiveCategory(cat.id);
                setEditingIndex(null);
                setNewItemValue('');
              }}
            >
              {editingCatId === cat.id ? (
                <input
                  autoFocus
                  value={editCatValue}
                  onChange={(e) => setEditCatValue(e.target.value)}
                  onBlur={() => saveCatEdit(cat.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveCatEdit(cat.id);
                    if (e.key === 'Escape') setEditingCatId(null);
                  }}
                  className="flex-1 min-w-0 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span 
                  className="truncate flex-1"
                  onDoubleClick={() => startEditingCat(cat.id, cat.label)}
                >
                  {cat.label}
                </span>
              )}
              
              {editingCatId !== cat.id && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditingCat(cat.id, cat.label);
                        }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit Lexicon Name</TooltipContent>
                  </Tooltip>
                  
                  <AlertDialog>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </AlertDialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Delete Lexicon</TooltipContent>
                    </Tooltip>
                    
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Lexicon</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete the lexicon "{cat.label}" and all its items?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={(e) => {
                            e.stopPropagation();
                            store.removeCategory(cat.id);
                            if (activeCategory === cat.id) {
                               setActiveCategory(categoriesList.find(c => c.id !== cat.id)?.id || '');
                            }
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          ))}

          {/* Add Lexicon Form */}
          <form onSubmit={handleAddCategory} className="pt-4 mt-4 border-t border-border flex flex-col gap-2 px-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">New Lexicon</span>
            <div className="flex items-center gap-1.5">
              <input
                value={newCatLabel}
                onChange={(e) => setNewCatLabel(e.target.value)}
                placeholder="e.g. Weapon Types"
                className="flex-1 min-w-0 h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={!newCatLabel.trim()}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Lexicon</TooltipContent>
              </Tooltip>
            </div>
          </form>
        </div>
      </div>

      {/* Right Column: List Editor */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {activeCatObj ? (
          <>
            <div className="p-4 border-b border-border bg-card/30 shrink-0">
              <h3 className="font-medium">{activeCatObj.label}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {activeList.length} items configured
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <div className="max-w-2xl flex flex-col gap-2">
                {activeList.map((item, idx) => (
                  <div 
                    key={`${idx}-${item.value}`}
                    className="group flex flex-col p-3 rounded-md border border-border bg-card hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center justify-between w-full">
                      {editingIndex === idx ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveEdit(idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(idx);
                            if (e.key === 'Escape') setEditingIndex(null);
                          }}
                          className="flex-1 bg-transparent text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
                        />
                      ) : (
                        <span 
                          className="flex-1 text-sm font-medium cursor-text py-0.5"
                          onClick={() => startEditing(idx, item.value)}
                        >
                          {item.value}
                        </span>
                      )}
                      
                      <AlertDialog>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0 ml-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent>Remove Item</TooltipContent>
                        </Tooltip>
                        
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Item</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove "{item.value}"?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleRemoveItem(idx)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    {/* Aliases Section */}
                    <div className="flex flex-wrap items-center mt-2.5 gap-2 pl-[2px]">
                      {item.aliases.map((alias, aliasIdx) => (
                        <div key={aliasIdx} className="flex items-center text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded gap-1 leading-none tracking-wider font-semibold border border-border/50 shadow-sm">
                          <span>{alias}</span>
                          <button onClick={() => store.removeAlias(currentCategoryId, idx, aliasIdx)} className="hover:text-destructive opacity-70 hover:opacity-100 transition-opacity">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                      
                      <input 
                        placeholder="+ add alias..."
                        className="text-[10px] bg-transparent border-b border-dashed border-border text-muted-foreground focus:outline-none focus:border-primary w-24 px-1 pb-0.5 placeholder:italic hover:border-muted-foreground transition-colors"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = e.currentTarget.value.trim();
                            if (val) {
                              store.addAlias(currentCategoryId, idx, val);
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                ))}

                {/* Add New Input */}
                <form onSubmit={handleAddItem} className="mt-4 flex items-center gap-2">
                  <input
                    value={newItemValue}
                    onChange={(e) => setNewItemValue(e.target.value)}
                    placeholder={`Add new ${activeCatObj.label.toLowerCase()}...`}
                    className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  />
                  <Button type="submit" size="sm" className="h-9 px-3 shrink-0" disabled={!newItemValue.trim()}>
                    <Plus className="w-4 h-4 mr-1.5" /> Add
                  </Button>
                </form>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            No lexicons available. Add one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
