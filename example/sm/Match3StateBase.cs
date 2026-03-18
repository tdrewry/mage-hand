namespace FabuLingua.MiniGames.Match3
{
    public abstract class Match3StateBase : IMatch3State
    {
        public abstract Match3GameState StateId { get; }
        
        public virtual void Enter(Match3StateContext context) { }
        
        public virtual void Execute(Match3StateContext context) { }
        
        public virtual void Exit(Match3StateContext context) { }
    }
}