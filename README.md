## Open Empires

I'm trying something ambitious: vibe-coding an Age Of Empires style RTS that lives in the web browser, rendered on canvas.

Long-term the backend will be written in spacetime DB. The goal is to have live matchmaking for 100 simultaneous players in a FFA and have clean open APIs for designing scenarios, mods, etc, and maybe support 100 such lobbies at a time. There'll be a subscription fee.

## Why?

The main problem that age of empires 2 has is the core gameplay is not being fixed by the developers. See [this discussion](https://www.reddit.com/r/aoe2/comments/1pib4po/do_we_have_any_hope_of_fixing_the_multiplayer) talking about how the current architecture inevitably means frequent desyncs and disconnects. The multiplayer needs to go from lockstep determinism to authoritative server.

Personally I also want to see the game run in the browser. In 2026 there's no need for installs and if we put this in the browser then any OS should suddenly be able to play.

I'd like to see the game open source so it's easy for people to patch bugs. AoE2 notoriously has annoying pathfinding bugs

## Roadmap

1. Basic networking / multiplayer. World simulation
1. Sign in with Discord. I'll probably allow anon play too
1. Different colors for different player's units
1. Asset Pack: civs, skins, textures, unit definitions, nature, resources, icons etc. DB models for all of this. Making it easy to create alternative versions of the game. Each asset pack could have a price.
1. Donations page. Maybe a kickstarter
1. Feedback mechanism
1. Proper Lobbies. Spectating. Anyone can join co-op at any time. Co-op caps. Later ages in open world have greater co-op caps.
1. Open World concept (100 players, maybe we get to the point where at Singularity and Kardashev Age you can leave the start planet and fight amongst various stars in a galaxy). Vassalization. Twice per week server online.
1. Instant Action concept. When you connect you're immediately thrown into a live game. Your start that's generated makes you competitive with the other players alive. Cap this at maybe a 10 person FFA?
1. Asset packs which just mod existing ones (change definitions / add new definitions)
1. ELO. Matchmaking.
1. Stone Age (rather than Dark Age), Medieval Age (rather than Castle), Renaissance Age (rather than Imperial), Industrial Age, Information Age, Singularity Age, Kardashev Age. Oil, Energy, and Cycles as resources.