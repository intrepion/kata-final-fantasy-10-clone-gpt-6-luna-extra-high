# Tidebound: The Salt March

An original browser RPG prototype with a small explorable 3D shoreline, distance-triggered encounters, turn-based party combat, action callouts, and a connected character-growth board.

## Play

Open `index.html` in a modern browser. The game uses relative file paths and has no build step or external dependencies. If the browser blocks local scripts, run it from any static file server.

1. Choose **Begin the journey** to enter the Salt March.
2. Walk with `WASD`, the arrow keys, or the on-screen pad. Random encounters begin as you explore.
3. Use **Strike**, **Technique**, **Satchel**, or **Guard** when a companion's turn arrives.
4. The party returns to the field after victory. Spend Sphere Points on connected Tidewheel nodes; stats and unlocked arts carry into the next fight.
5. Turn on **VOICE** to hear battle callouts with a speech voice installed by your browser or device. Turn on **SOUND** for interface tones.

The Tidewheel has 35 connected nodes, separate starting points, and character-specific arts. Nodes cost one Sphere Point, and each victory adds three points per companion. Attunement and victory progress save in local storage.

## Controls

- `WASD` or arrow keys: walk the field.
- `1`–`4`: choose Strike, Technique, Satchel, or Guard during a party turn.
- `Enter`: select the default combat action.
- `Escape`: return to the action menu or close the Tidewheel.
- Mouse, touch, and keyboard focus work in the menus; the map also includes a touch movement pad.

The story, characters, creature, writing, and low-poly 3D models are original. The renderer uses WebGL directly with a 2D fallback. Voice callouts use browser speech synthesis, not recorded character performances; natural voice acting would require audio recordings.
