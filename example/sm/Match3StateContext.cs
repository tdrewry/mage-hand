using System.Collections.Generic;
using FabuLingua.Stories;
using UnityEngine;

namespace FabuLingua.MiniGames.Match3
{
    public class Match3StateContext
    {
        public int GridWidth { get; set; }
        public int GridHeight { get; set; }
        public int CurrentScore { get; set; }
        public int TargetMatchCount { get; set; }
        public int AttemptCount { get; set; }
        public int LargestMatchSize { get; set; }
        public bool HadTargetMatchThisRound { get; set; }
        public bool IsShuffleCleanup { get; set; }
        public bool NeedsTargetSelection { get; set; }
        public Match3StateMachine StateMachine { get; set; }
        public Match3GridManager GridManager { get; set; }
        public BoardModel Board { get; set; }
        public BoardAnimator Animator { get; set; }
        public TilePoolManager TilePool { get; set; }
        public TargetManager TargetManager { get; set; }
        public LevelConfig LevelConfig { get; set; }
        public StoryDataAsset.MagicMatchConfig.MagicMatchObject CurrentTarget { get; set; }
        public List<List<TileData>> CurrentMatches { get; set; }
        public HashSet<int> LastAffectedColumns { get; set; }
        public Vector2Int SwipeFrom { get; set; }
        public Vector2Int SwipeTo { get; set; }

        public void ResetRoundData()
        {
            CurrentMatches = null;
            HadTargetMatchThisRound = false;
            LargestMatchSize = 0;
            LastAffectedColumns?.Clear();
            IsShuffleCleanup = false;
            NeedsTargetSelection = false;
        }
    }
}