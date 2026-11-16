# Worldsmith

**An open-source creative studio for building games and digital worlds.**

Worldsmith is intended to bring scene editing, 2D/3D modelling, materials, animation, UI design, visual logic, audio and game publishing into one browser-based application.

## Current milestone: editor shell

This repository currently contains the first interface foundation. It is a navigable, interactive shell preview—not yet a functioning game engine or a completed set of creative tools.

The shell includes:
- Eight top-level workspaces: Scene, Model, Materials, Animation, UI, Logic, Audio and Assets.
- A unified editor layout with tool rail, workspace explorer, central work area, inspector and bottom dock.
- Distinct visual workspace previews so the interface direction can be reviewed before implementing the underlying tools.
- Working workspace navigation, selection, inspector tabs, dock tabs, panel visibility, zoom controls, add menu, command palette and play/stop preview state.
- Keyboard shortcuts: Ctrl/Cmd+K for command search, Ctrl/Cmd+S for save feedback, Q/W/E/R/B/S for tools and Space for preview.

## Run in GitHub Codespaces

Requirements: Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open forwarded port **5173**.

To check a production build:

```bash
npm run build
npm run preview
```

## Development principles

1. The editor shell and runtime will remain separate.
2. All workspaces will use one shared project, scene and asset model.
3. Creative tools must produce real editable assets—not decorative placeholder controls.
4. Prefer open formats and document the project format.
5. Keep the application modular, testable and usable on modest development hardware.

## Planned architecture

- `src/editor`: editor shell, panels, commands and workspace navigation
- `src/core`: projects, assets, events, commands and undo/redo
- `src/runtime`: game runtime and preview lifecycle
- `src/studios`: scene, model, materials, animation, UI, logic and audio tools
- `src/platform`: persistence, import/export and browser integrations

These folders will be introduced as the corresponding systems are implemented. The initial shell is deliberately kept small while the visual direction is being reviewed.

## Open source

Worldsmith is being developed in the open. A repository licence will be selected and added before external contributions or redistribution are invited.
