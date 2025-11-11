import { useState, useEffect } from 'react';
import {
  SessionTemplate,
  getAllTemplates,
  getTemplate,
  deleteTemplate as deleteTemplateFromStorage,
  BUILT_IN_TEMPLATES,
} from '@/lib/sessionTemplates';

export function useSessionTemplates() {
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [builtInTemplates] = useState<SessionTemplate[]>(BUILT_IN_TEMPLATES);

  const loadTemplates = () => {
    const allTemplates = getAllTemplates();
    setTemplates(allTemplates);
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const getTemplateById = (id: string): SessionTemplate | null => {
    return getTemplate(id);
  };

  const deleteTemplate = (id: string): void => {
    deleteTemplateFromStorage(id);
    loadTemplates();
  };

  const customTemplates = templates.filter(t => !t.isBuiltIn);

  return {
    templates,
    builtInTemplates,
    customTemplates,
    getTemplateById,
    deleteTemplate,
    refreshTemplates: loadTemplates,
  };
}
