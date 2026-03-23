export type ContractType = 'action';

export interface ValidationIssue {
  path: string;
  message: string;
}

export function validateContract(
  contractType: ContractType,
  outputState: any
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!outputState || typeof outputState !== 'object') {
    return [{ path: 'root', message: 'Output state must be a valid JSON object.' }];
  }

  if (contractType === 'action') {
    const tr = outputState.targetResult;
    if (!tr || typeof tr !== 'object') {
      issues.push({ path: 'targetResult', message: 'Missing required object "targetResult" to execute this Action.' });
      return issues;
    }

    if (tr.challengeResult !== undefined) {
      if (typeof tr.challengeResult !== 'object') {
        issues.push({ path: 'targetResult.challengeResult', message: 'Must be an object containing "total".' });
      } else if (typeof tr.challengeResult.total !== 'number') {
        issues.push({ path: 'targetResult.challengeResult.total', message: 'Expected resulting challenge total to be a number.' });
      }
    }

    if (tr.damage !== undefined) {
      if (typeof tr.damage !== 'object') {
        issues.push({ path: 'targetResult.damage', message: 'Must be an object keyed by damage type.' });
      } else {
        for (const [dmgType, dmgData] of Object.entries(tr.damage)) {
          const amount = (dmgData as any)?.amount;
          if (amount === undefined) {
            issues.push({ path: `targetResult.damage.${dmgType}.amount`, message: 'Missing required "amount" property.' });
          } else if (typeof amount !== 'number') {
             if (typeof amount !== 'object') {
               issues.push({ path: `targetResult.damage.${dmgType}.amount`, message: 'Must be a numeric value or Damage amount payload.' });
             } else if (typeof amount.total !== 'number') {
               issues.push({ path: `targetResult.damage.${dmgType}.amount.total`, message: 'Amount total must be a number.' });
             }
          }
        }
      }
    }

    if (tr.effectsApplied !== undefined) {
      if (typeof tr.effectsApplied !== 'object') {
        issues.push({ path: 'targetResult.effectsApplied', message: 'Must be an object keyed by effect ID.' });
      }
    }
  }

  return issues;
}

export const CONTRACT_OPTIONS = [
  { value: 'action', label: 'Action (TargetResult)' }
];
