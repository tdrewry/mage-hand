// Token visibility utilities
import { Token, TokenVisibility, LabelVisibility } from '../stores/sessionStore';

/**
 * Determines if a token should be visible based on global visibility rules and user role.
 * @param token The token to check.
 * @param tokenVisibility The global token visibility setting.
 * @param currentPlayerId The ID of the current player.
 * @param isDM True if the current player is a Dungeon Master.
 * @returns True if the token should be shown, false otherwise.
 */
export const shouldShowToken = (
  token: Token,
  tokenVisibility: TokenVisibility,
  currentPlayerId: string,
  isDM: boolean
): boolean => {
  switch (tokenVisibility) {
    case 'all':
      return true;
    case 'owned':
      return token.ownerId === currentPlayerId;
    case 'dm-only':
      return isDM;
    default:
      return true;
  }
};

/**
 * Determines if a token label should be visible based on label visibility rules and selection state.
 * @param token The token whose label is being checked.
 * @param labelVisibility The global label visibility setting.
 * @param selectedTokenIds Array of currently selected token IDs.
 * @param currentPlayerId The ID of the current player.
 * @param isDM True if the current player is a Dungeon Master.
 * @returns True if the label should be shown, false otherwise.
 */
export const shouldShowLabel = (
  token: Token,
  labelVisibility: LabelVisibility,
  selectedTokenIds: string[],
  currentPlayerId: string,
  isDM: boolean
): boolean => {
  // First check if token is visible at all
  if (!shouldShowToken(token, 'all', currentPlayerId, isDM)) {
    return false;
  }

  switch (labelVisibility) {
    case 'show':
      return true;
    case 'hide':
      return false;
    case 'selected':
      return selectedTokenIds.includes(token.id);
    default:
      return true;
  }
};