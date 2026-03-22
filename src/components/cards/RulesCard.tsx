import React from 'react';
import { RulesLibrary } from '@/components/rules/RulesLibrary';

interface RulesCardContentProps {
  cardId?: string;
}

export function RulesCardContent({ cardId }: RulesCardContentProps) {
  return (
    <div className="h-full w-full flex flex-col">
      <RulesLibrary />
    </div>
  );
}
