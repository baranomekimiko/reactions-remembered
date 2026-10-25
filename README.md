## Installation
Unzip to YourFoundryInstall/Data/modules
Enable reactions-remembered in your world
or
Install via the module.json directly in Foundry.

## Dependencies
Requires the D&D 5e system (dnd5e 5.2.0+) on Foundry V14.
Custom D&D5e is optional, Occupied is added to its Conditions list automatically. https://foundryvtt.com/packages/custom-dnd5e

## Usage
- Added new condition, "Occupied", it has no effect, and serves as a reminder that a creature has spent its reaction. It expires automatically at the start of the creature's turn.
- Occupied can be toggled via the condition's UI on a token.
- Occupied can also be toggled via CTRL+R for selected tokens, or the token you are hovering if none are selected. This default keybind may conflict with GMs running from a browser, configure it in settings.

- During combat, a token that attacks, uses a spell/feature, or moves when it is not their turn gains Occupied automatically. Using a Reaction feature applies Occupied automatically. 
- Movement caused by macros, modules, the GM or the Teleportation movement type are ignored. Legendary and Lair Actions are also ignored.
- Players see a popup when their out of turn movement marks them as Occupied. Configurable.
- Warnings appear on item cards when it is not the player's turn, warning them that using the action would consume a Reaction. A player who is Occupied sees a warning that they have already spent their reaction.

- The module comes with a small compendium with the rule text.

- If your players have abilities that grant extra reactions, this module does not automate this, but it could be done by configuring the feature to remove Occupied, or hooking into this module to intercept the application, if desired. 

## Hooks
reactionsRemembered.preApply (actor, combatant, trigger) - return false to stop Occupied being applied.
reactionsRemembered.applied (actor, combatant, trigger) - fires after application

## Contact
email: baranome.kimiko@gmail.com
For bug reports & suggestions.
For free upgrades to minor versions.

## Credits
Dependency D&D5e - https://foundryvtt.com/packages/dnd5e
Compatible with Custom D&D 5e - https://foundryvtt.com/packages/custom-dnd5e

## AI Disclaimer
AI was used for bugchasing & research.
