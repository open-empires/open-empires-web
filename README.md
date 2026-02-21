## Open Empires

I'm trying something ambitious: vibe-coding an Age Of Empires style RTS that lives in the web browser, rendered on canvas.

Long-term the backend will be written in spacetime DB. The goal is to have live matchmaking for 100 simultaneous players in a FFA and have clean open APIs for designing scenarios, mods, etc, and maybe support 100 such lobbies at a time. There'll be a subscription fee.

## Why?

The main problem that age of empires 2 has is the core gameplay is not being fixed by the developers. See [this discussion](https://www.reddit.com/r/aoe2/comments/1pib4po/do_we_have_any_hope_of_fixing_the_multiplayer) talking about how the current architecture inevitably means frequent desyncs and disconnects. The multiplayer needs to go from lockstep determinism to authoritative server.

Personally I also want to see the game run in the browser. In 2026 there's no need for installs and if we put this in the browser then any OS should suddenly be able to play.

I'd like to see the game open source so it's easy for people to patch bugs. AoE2 notoriously has annoying pathfinding bugs
