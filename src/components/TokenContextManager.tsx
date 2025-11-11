import React, { useState, useEffect } from 'react';
import { TokenContextMenu } from './TokenContextMenu';
import { Canvas as FabricCanvas } from 'fabric';

interface TokenContextManagerProps {
  fabricCanvas: FabricCanvas | null;
  onColorChange?: (tokenId: string, color: string) => void;
  onUpdateCanvas?: () => void;
}

export const TokenContextManager = ({ 
  fabricCanvas,
  onColorChange,
  onUpdateCanvas 
}: TokenContextManagerProps) => {
  const [contextTokenId, setContextTokenId] = useState<string>('');
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  // Listen for custom event from SimpleTabletop (Paper.js canvas)
  useEffect(() => {
    const handleTokenContextEvent = (event: any) => {
      const { tokenId, x, y } = event.detail;
      console.log('TokenContextManager received custom event:', { tokenId, x, y });
      setContextTokenId(tokenId);
      setMenuPosition({ x, y });
      setShowMenu(true);
      
      // Trigger a synthetic right-click on our invisible trigger element
      setTimeout(() => {
        const trigger = document.getElementById('map-token-context-trigger');
        if (trigger) {
          const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            button: 2,
          });
          trigger.dispatchEvent(event);
        }
      }, 0);
    };

    window.addEventListener('showTokenContextMenu', handleTokenContextEvent);
    
    return () => {
      window.removeEventListener('showTokenContextMenu', handleTokenContextEvent);
    };
  }, []);

  // Legacy Fabric.js event listener (keeping as fallback)
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleCanvasRightClick = (opt: any) => {
      const evt = opt.e as MouseEvent;
      const target = opt.target;
      
      if (evt.button === 2 && target && (target as any).tokenId) {
        evt.preventDefault();
        evt.stopPropagation();
        
        const tokenId = (target as any).tokenId;
        setContextTokenId(tokenId);
        setMenuPosition({ x: evt.clientX, y: evt.clientY });
        setShowMenu(true);
        
        // Trigger context menu
        setTimeout(() => {
          const trigger = document.getElementById('map-token-context-trigger');
          if (trigger) {
            const event = new MouseEvent('contextmenu', {
              bubbles: true,
              cancelable: true,
              clientX: evt.clientX,
              clientY: evt.clientY,
              button: 2,
            });
            trigger.dispatchEvent(event);
          }
        }, 0);
      }
    };

    fabricCanvas.on('mouse:up', handleCanvasRightClick);

    return () => {
      fabricCanvas.off('mouse:up', handleCanvasRightClick);
    };
  }, [fabricCanvas]);

  if (!contextTokenId || !menuPosition) {
    return null;
  }

  return (
    <TokenContextMenu 
      tokenId={contextTokenId}
      onColorChange={onColorChange}
      onUpdateCanvas={onUpdateCanvas}
    >
      <div
        id="map-token-context-trigger"
        style={{
          position: 'fixed',
          left: `${menuPosition.x}px`,
          top: `${menuPosition.y}px`,
          width: '1px',
          height: '1px',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />
    </TokenContextMenu>
  );
};