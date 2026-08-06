// Pure city-mode scoring. Mirrors the SQL in supabase/migrations/0004_city_mode.sql
// (reveal_city): winner is the closest bid; ties broken by earliest bid. The
// offline mock treats synthetic opponents as having bid *before* the player, so
// on a tie the player loses — exactly the "first bid wins" rule.

export type CityOutcome = {
  your_distance: number;
  winning_distance: number;
  your_rank: number;
  total_bids: number;
  won: boolean;
};

export function bidDistance(answer: number, bid: number): number {
  return Math.abs(bid - answer);
}

export function computeOutcome(
  answer: number,
  yourBid: number,
  opponentBids: number[]
): CityOutcome {
  const yourDist = bidDistance(answer, yourBid);
  const oppDists = opponentBids.map((b) => bidDistance(answer, b));
  // Opponents at an equal-or-smaller distance rank ahead (they bid earlier).
  const ahead = oppDists.filter((d) => d <= yourDist).length;
  const yourRank = ahead + 1;
  const winning = Math.min(yourDist, ...oppDists);
  return {
    your_distance: yourDist,
    winning_distance: winning,
    your_rank: yourRank,
    total_bids: opponentBids.length + 1,
    won: yourRank === 1,
  };
}
