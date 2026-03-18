using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace FabuLingua.MiniGames.Match3
{
    [Serializable]
    public class Match3StateMachine
    {
        public event Action<Match3GameState, Match3GameState> OnStateChanged;
        
        private IMatch3State _currentState;
        private Match3StateContext _context;
        private Dictionary<Match3GameState, IMatch3State> _states;
        private bool _isInitialized;
        
        [field: SerializeField] public Match3GameState CurrentStateId { get; private set; }
        [field: SerializeField] public Match3GameState PreviousStateId { get; private set; }
        [field: SerializeField] public float TimeInCurrentState { get; private set; }
        [field: SerializeField] public int TransitionCount { get; private set; }

        public bool EnableLogging { get; set; } = true;
        public bool WarnOnInvalidTransitions { get; set; } = true;
        
        private static readonly Dictionary<Match3GameState, Match3GameState[]> _allowedTransitions = new()
        {
            {
                Match3GameState.Initializing, new[]
                {
                    Match3GameState.SelectingTarget
                }
            },
            {
                Match3GameState.WaitingForInput, new[]
                {
                    Match3GameState.Swapping,
                    Match3GameState.Shuffling,
                    Match3GameState.GameWon
                }
            },
            {
                Match3GameState.Swapping, new[]
                {
                    Match3GameState.SwappingBack,
                    Match3GameState.CheckingMatches
                }
            },
            {
                Match3GameState.SwappingBack, new[]
                {
                    Match3GameState.WaitingForInput
                }
            },
            {
                Match3GameState.CheckingMatches, new[]
                {
                    Match3GameState.AnimatingRemoval
                }
            },
            {
                Match3GameState.AnimatingRemoval, new[]
                {
                    Match3GameState.ApplyingGravity
                }
            },
            {
                Match3GameState.ApplyingGravity, new[]
                {
                    Match3GameState.CheckingCascades
                }
            },
            {
                Match3GameState.CheckingCascades, new[]
                {
                    Match3GameState.CheckingMatches,
                    Match3GameState.ShowingCallout,
                    Match3GameState.SelectingTarget,
                    Match3GameState.WaitingForInput,
                    Match3GameState.Shuffling
                }
            },
            {
                Match3GameState.ShowingCallout, new[]
                {
                    Match3GameState.GameWon,
                    Match3GameState.RotatingCharacter
                }
            },
            {
                Match3GameState.RotatingCharacter, new[]
                {
                    Match3GameState.Shuffling
                }
            },
            {
                Match3GameState.Shuffling, new[]
                {
                    Match3GameState.CleaningUpShuffle,
                    Match3GameState.SelectingTarget,
                    Match3GameState.WaitingForInput
                }
            },
            {
                Match3GameState.CleaningUpShuffle, new[]
                {
                    Match3GameState.CheckingMatches
                }
            },
            {
                Match3GameState.SelectingTarget, new[]
                {
                    Match3GameState.WaitingForInput
                }
            },
            {
                Match3GameState.GameWon, new[]
                {
                    Match3GameState.Initializing
                }
            }
        };
        
        public void Initialize(Match3StateContext context, Dictionary<Match3GameState, IMatch3State> states, Match3GameState initialState)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _states = states ?? throw new ArgumentNullException(nameof(states));
            
            if (!_states.ContainsKey(initialState))
                throw new ArgumentException($"Initial state {initialState} not found in provided states.");
            
            TransitionCount = 0;
            TimeInCurrentState = 0f;
            PreviousStateId = initialState;
            CurrentStateId = initialState;
            
            _currentState = _states[initialState];
            _isInitialized = true;
            
            if (EnableLogging)
                Logger.DebugInfo($"[StateMachine] Initialized → {initialState}");
            
            _currentState.Enter(_context);
        }
        
        public void Update()
        {
            if (!_isInitialized) return;
            
            TimeInCurrentState += Time.deltaTime;
            _currentState?.Execute(_context);
        }
        
        public bool TransitionTo(Match3GameState newState)
        {
            if (!_isInitialized)
            {
                Logger.Warning("[StateMachine] TransitionTo called before Initialize.");
                return false;
            }
            
            if (!IsTransitionAllowed(CurrentStateId, newState))
            {
                if (WarnOnInvalidTransitions)
                    Logger.Warning($"[StateMachine] INVALID transition: {CurrentStateId} → {newState}");
                
                return false;
            }
            
            if (!_states.ContainsKey(newState))
            {
                Logger.Error($"[StateMachine] No state instance registered for {newState}");
                return false;
            }
            
            _currentState?.Exit(_context);
            
            PreviousStateId = CurrentStateId;
            CurrentStateId = newState;
            TimeInCurrentState = 0f;
            TransitionCount++;
            
            _currentState = _states[newState];
            
            if (EnableLogging)
                Logger.DebugInfo($"[StateMachine] {PreviousStateId} → {newState} (transition #{TransitionCount})");
            
            _currentState.Enter(_context);
            
            OnStateChanged?.Invoke(PreviousStateId, newState);
            
            return true;
        }
        
        public void ForceTransitionTo(Match3GameState newState)
        {
            _currentState?.Exit(_context);
            
            PreviousStateId = CurrentStateId;
            CurrentStateId = newState;
            TimeInCurrentState = 0f;
            TransitionCount++;
            
            _currentState = _states[newState];
            _currentState.Enter(_context);
            
            OnStateChanged?.Invoke(PreviousStateId, newState);
        }
        
        public bool IsInState(Match3GameState state) => CurrentStateId == state;
        public bool CanTransitionTo(Match3GameState target) => IsTransitionAllowed(CurrentStateId, target);
        public bool AcceptsInput => CurrentStateId == Match3GameState.WaitingForInput;
        
        public void Shutdown()
        {
            if (_isInitialized && _currentState != null)
            {
                _currentState.Exit(_context);
            }
            
            _currentState = null;
            _isInitialized = false;
            OnStateChanged = null;
            
            if (EnableLogging)
                Logger.DebugInfo("[StateMachine] Shutdown complete.");
        }
        
        private static bool IsTransitionAllowed(Match3GameState fromState, Match3GameState toState)
        {
            if (!_allowedTransitions.TryGetValue(fromState, out Match3GameState[] allowed))
                return false;

            return allowed.Any(t => t == toState);
        }
    }
}