import React, { useState, useRef, useEffect } from 'react';

export interface PathSuggestInputProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

export const PathSuggestInput = ({
  value,
  onChange,
  options,
  placeholder,
  className = ''
}: PathSuggestInputProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPaths = options.filter(p => p.toLowerCase().includes((value || '').toLowerCase()));

  const handleSelect = (path: string) => {
    onChange(path);
    setIsOpen(false);
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const typeIndex = path.indexOf('<type>');
        const keyIndex = path.indexOf('<key>');
        if (typeIndex !== -1) {
          inputRef.current.setSelectionRange(typeIndex, typeIndex + 6);
        } else if (keyIndex !== -1) {
          inputRef.current.setSelectionRange(keyIndex, keyIndex + 5);
        }
      }
    }, 0);
  };

  return (
    <div className="relative flex flex-col gap-1.5 w-full" ref={containerRef}>
      <input 
        ref={inputRef}
        type="text" 
        value={value} 
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        className={`flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${className}`}
        placeholder={placeholder}
        autoComplete="off"
      />
      {isOpen && filteredPaths.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 max-h-48 overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md p-1 top-[calc(100%+4px)] left-0">
          {filteredPaths.map((path) => (
            <li 
              key={path}
              onMouseDown={(e) => {
                 e.preventDefault();
                 handleSelect(path);
              }}
              className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            >
              {path}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
