# Tidebound: The Salt March

A small, original browser RPG with a real-time WebGL battlefield, story dialogue, turn-based party combat, and a connected character-growth board. Three companions face a creature from the deep on a hand-crafted shoreline.

## Play

Open `index.html` in a modern browser. No build step or dependencies are required. If your browser restricts local scripts, serve this directory with any static file server.

1. Open **The Tidewheel** to spend each companion's starting Sphere Points on connected nodes.
2. Choose **Begin the journey** and advance the opening dialogue.
3. Use **Strike**, **Technique**, **Satchel**, or **Guard** when a companion's turn arrives.
4. Earn three more Sphere Points per companion after victory. Attuned nodes change combat stats and can unlock character-specific arts.
5. Return to the Tidewheel before answering the next, stronger bell.

The turn strip previews the next actors. Speed changes how quickly each character returns to the queue; guarding halves the next incoming hit and gets the user back into the queue sooner. The Tidewheel is a shared 35-node hex map with separate starting points and character-specific ability nodes; its paths and Sphere Points save in local storage.

## Controls

- `1`–`4`: choose Strike, Technique, Satchel, or Guard.
- `Enter`: advance dialogue, begin the journey, or select the default action.
- `Escape`: return to the action menu.
- Mouse, touch, and keyboard focus are supported in the menus and Tidewheel.

The story, characters, creature, dialogue, and low-poly 3D models are original. The renderer uses WebGL directly, with no game engine, build step, or external game assets.
