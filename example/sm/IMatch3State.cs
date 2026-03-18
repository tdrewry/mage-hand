namespace FabuLingua.MiniGames.Match3
{
    public interface IMatch3State
    {
        Match3GameState StateId { get; }
        
        void Enter(Match3StateContext context);
        
        void Execute(Match3StateContext context);
        
        void Exit(Match3StateContext context);
    }
}