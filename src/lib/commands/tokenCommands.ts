/**
 * Token Commands for Undo/Redo
 */

import { Command } from '../undoRedoManager';
import { useSessionStore, Token, AppearanceVariant } from '@/stores/sessionStore';

/**
 * Command for adding a token
 */
export class AddTokenCommand implements Command {
  type = 'ADD_TOKEN';
  description: string;
  private token: Token;

  constructor(token: Token) {
    this.token = token;
    this.description = `Add token ${token.label || token.name}`;
  }

  execute(): void {
    useSessionStore.getState().addToken(this.token);
  }

  undo(): void {
    useSessionStore.getState().removeToken(this.token.id);
  }
}

/**
 * Command for removing a token
 */
export class RemoveTokenCommand implements Command {
  type = 'REMOVE_TOKEN';
  description: string;
  private token: Token;

  constructor(token: Token) {
    this.token = token;
    this.description = `Remove token ${token.label || token.name}`;
  }

  execute(): void {
    useSessionStore.getState().removeToken(this.token.id);
  }

  undo(): void {
    useSessionStore.getState().addToken(this.token);
  }
}

/**
 * Command for moving a token
 */
export class MoveTokenCommand implements Command {
  type = 'MOVE_TOKEN';
  description: string;
  private tokenId: string;
  private previousPosition: { x: number; y: number };
  private newPosition: { x: number; y: number };

  constructor(
    tokenId: string,
    previousPosition: { x: number; y: number },
    newPosition: { x: number; y: number },
    tokenLabel?: string
  ) {
    this.tokenId = tokenId;
    this.previousPosition = previousPosition;
    this.newPosition = newPosition;
    this.description = `Move ${tokenLabel || 'token'}`;
  }

  execute(): void {
    useSessionStore.getState().updateTokenPosition(
      this.tokenId,
      this.newPosition.x,
      this.newPosition.y
    );
  }

  undo(): void {
    useSessionStore.getState().updateTokenPosition(
      this.tokenId,
      this.previousPosition.x,
      this.previousPosition.y
    );
  }
}

/**
 * Command for updating token properties
 */
export class UpdateTokenCommand implements Command {
  type = 'UPDATE_TOKEN';
  description: string;
  private tokenId: string;
  private previousState: Partial<Token>;
  private newState: Partial<Token>;

  constructor(
    tokenId: string,
    previousState: Partial<Token>,
    newState: Partial<Token>,
    description?: string
  ) {
    this.tokenId = tokenId;
    this.previousState = previousState;
    this.newState = newState;
    this.description = description || `Update token ${tokenId}`;
  }

  execute(): void {
    const token = useSessionStore.getState().tokens.find(t => t.id === this.tokenId);
    if (token) {
      const updatedToken = { ...token, ...this.newState };
      useSessionStore.setState(state => ({
        tokens: state.tokens.map(t => t.id === this.tokenId ? updatedToken : t)
      }));
    }
  }

  undo(): void {
    const token = useSessionStore.getState().tokens.find(t => t.id === this.tokenId);
    if (token) {
      const revertedToken = { ...token, ...this.previousState };
      useSessionStore.setState(state => ({
        tokens: state.tokens.map(t => t.id === this.tokenId ? revertedToken : t)
      }));
    }
  }
}

/**
 * Command for updating token size
 */
export class UpdateTokenSizeCommand implements Command {
  type = 'UPDATE_TOKEN_SIZE';
  description: string;
  private tokenId: string;
  private previousSize: { gridWidth: number; gridHeight: number };
  private newSize: { gridWidth: number; gridHeight: number };

  constructor(
    tokenId: string,
    previousSize: { gridWidth: number; gridHeight: number },
    newSize: { gridWidth: number; gridHeight: number },
    tokenLabel?: string
  ) {
    this.tokenId = tokenId;
    this.previousSize = previousSize;
    this.newSize = newSize;
    this.description = `Resize ${tokenLabel || 'token'} to ${newSize.gridWidth}x${newSize.gridHeight}`;
  }

  execute(): void {
    useSessionStore.getState().updateTokenSize(
      this.tokenId,
      this.newSize.gridWidth,
      this.newSize.gridHeight
    );
  }

  undo(): void {
    useSessionStore.getState().updateTokenSize(
      this.tokenId,
      this.previousSize.gridWidth,
      this.previousSize.gridHeight
    );
  }
}

/**
 * Command for updating token details (notes, quickReferenceUrl)
 */
export class UpdateTokenDetailsCommand implements Command {
  type = 'UPDATE_TOKEN_DETAILS';
  description: string;
  private tokenId: string;
  private previousDetails: { notes?: string; quickReferenceUrl?: string };
  private newDetails: { notes?: string; quickReferenceUrl?: string };

  constructor(
    tokenId: string,
    previousDetails: { notes?: string; quickReferenceUrl?: string },
    newDetails: { notes?: string; quickReferenceUrl?: string },
    tokenLabel?: string
  ) {
    this.tokenId = tokenId;
    this.previousDetails = previousDetails;
    this.newDetails = newDetails;
    this.description = `Update ${tokenLabel || 'token'} details`;
  }

  execute(): void {
    useSessionStore.getState().updateTokenDetails(
      this.tokenId,
      this.newDetails.notes,
      this.newDetails.quickReferenceUrl
    );
  }

  undo(): void {
    useSessionStore.getState().updateTokenDetails(
      this.tokenId,
      this.previousDetails.notes,
      this.previousDetails.quickReferenceUrl
    );
  }
}

/**
 * Command for adding an appearance variant
 */
export class AddAppearanceVariantCommand implements Command {
  type = 'ADD_APPEARANCE_VARIANT';
  description: string;
  private tokenId: string;
  private variant: AppearanceVariant;

  constructor(tokenId: string, variant: AppearanceVariant, tokenLabel?: string) {
    this.tokenId = tokenId;
    this.variant = variant;
    this.description = `Add variant "${variant.name}" to ${tokenLabel || 'token'}`;
  }

  execute(): void {
    useSessionStore.getState().addAppearanceVariant(this.tokenId, this.variant);
  }

  undo(): void {
    useSessionStore.getState().removeAppearanceVariant(this.tokenId, this.variant.id);
  }
}

/**
 * Command for removing an appearance variant
 */
export class RemoveAppearanceVariantCommand implements Command {
  type = 'REMOVE_APPEARANCE_VARIANT';
  description: string;
  private tokenId: string;
  private variant: AppearanceVariant;

  constructor(tokenId: string, variant: AppearanceVariant, tokenLabel?: string) {
    this.tokenId = tokenId;
    this.variant = variant;
    this.description = `Remove variant "${variant.name}" from ${tokenLabel || 'token'}`;
  }

  execute(): void {
    useSessionStore.getState().removeAppearanceVariant(this.tokenId, this.variant.id);
  }

  undo(): void {
    useSessionStore.getState().addAppearanceVariant(this.tokenId, this.variant);
  }
}

/**
 * Command for setting active variant
 */
export class SetActiveVariantCommand implements Command {
  type = 'SET_ACTIVE_VARIANT';
  description: string;
  private tokenId: string;
  private previousVariantId: string | undefined;
  private previousState: { gridWidth: number; gridHeight: number; imageHash?: string };
  private newVariantId: string;

  constructor(
    tokenId: string,
    previousVariantId: string | undefined,
    previousState: { gridWidth: number; gridHeight: number; imageHash?: string },
    newVariantId: string,
    variantName: string,
    tokenLabel?: string
  ) {
    this.tokenId = tokenId;
    this.previousVariantId = previousVariantId;
    this.previousState = previousState;
    this.newVariantId = newVariantId;
    this.description = `Switch ${tokenLabel || 'token'} to "${variantName}"`;
  }

  execute(): void {
    useSessionStore.getState().setActiveVariant(this.tokenId, this.newVariantId);
  }

  undo(): void {
    // Restore previous state
    if (this.previousVariantId) {
      useSessionStore.getState().setActiveVariant(this.tokenId, this.previousVariantId);
    } else {
      // Restore manual state without a variant
      const token = useSessionStore.getState().tokens.find(t => t.id === this.tokenId);
      if (token) {
        useSessionStore.setState(state => ({
          tokens: state.tokens.map(t => 
            t.id === this.tokenId 
              ? { 
                  ...t, 
                  activeVariantId: undefined,
                  gridWidth: this.previousState.gridWidth,
                  gridHeight: this.previousState.gridHeight,
                  imageHash: this.previousState.imageHash,
                }
              : t
          )
        }));
      }
    }
  }
}
