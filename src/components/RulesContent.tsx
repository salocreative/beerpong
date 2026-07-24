const RULES = [
  'Teams of 2 or 3.',
  'One player per team shoots at a time, alternating turns (not simultaneous).',
  'Each team gets 10 cups and 2 cans of beer per game — distribute however you like.',
  'One reshuffle per team, per game.',
  'If the ball bounces before landing in a cup, the other team may swipe it away.',
  'Knock over your own cup — you drink it.',
  'Losing team returns empty cups to a volunteer. Winning team keeps leftover cups, gets fresh cups and beer.',
  'Win = 1 point. Simple.',
]

export function RulesContent() {
  return (
    <ol className="space-y-4">
      {RULES.map((rule, i) => (
        <li key={rule} className="flex gap-3">
          <span className="font-display text-2xl leading-none text-amber">{i + 1}</span>
          <p className="text-foam/90 leading-relaxed">{rule}</p>
        </li>
      ))}
    </ol>
  )
}
