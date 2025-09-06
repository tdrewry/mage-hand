// Token visibility utilities
import { Token, TokenVisibility, LabelVisibility } from '../stores/sessionStore';

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