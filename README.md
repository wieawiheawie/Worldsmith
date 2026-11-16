# Worldsmith

**An open-source creative studio for building games and digital worlds.**

Worldsmith is intended to bring scene editing, 2D/3D modelling, materials, animation, UI design, visual logic, audio and game publishing into one browser-based application.

## Current milestone: functional studio foundations

The editor now includes first-pass working authoring tools. These are intentionally foundational rather than production-complete; the next milestone is a deep audit of the project model, interaction consistency, runtime integration and performance.

The shell includes:
- Eight top-level workspaces: Scene, Model, Materials, Animation, UI, Logic, Audio and Assets.
- A unified editor layout with tool rail, workspace explorer, central work area, inspector and bottom dock.
- **Scene / Model:** Three.js WebGL viewport, orbit camera, object selection, move/rotate/scale gizmos, primitive creation/deletion and editable mesh subdivision / shading.
- **Materials:** live PBR base colour, roughness and metalness controls, plus a paint canvas whose brush strokes are applied to the 3D preview and saved locally.
- **Animation:** five-second preview timeline, play/pause, scrubbing, keyframe creation/deletion and interpolated position/rotation/scale preview.
- **UI:** editable 16:9 HUD canvas with draggable text, buttons, panels, images and bars; live text, layout, colour and size controls.
- **Logic:** draggable event/input/math/branch/set/print nodes, output-to-input connections and a simple graph execution log.
- **Audio:** local audio import and browser playback for supported file types.
- Studio objects, UI elements, logic graphs, keyframes and material settings are stored in browser local storage.
- Working workspace navigation, hierarchy range selection, duplicate/delete/reorder actions, inspector tabs, dock tabs, draggable panel resizing, panel visibility, command palette and play/stop preview state.
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

## Studio design specification

See [`docs/STUDIO_DESIGN_RESEARCH.md`](docs/STUDIO_DESIGN_RESEARCH.md) for the research-backed layout, interaction and implementation specification for Model, Scene, Materials, Animation, UI, Logic, Audio and Assets studios.

## Current limitations

- The 3D editor currently edits primitive meshes; full arbitrary topology, UV unwrapping, sculpting, rigging and mesh import/export are not implemented yet.
- Material painting is a single shared UV texture canvas, not a layered texture-painting system.
- Animation currently previews one simple transform track using linear interpolation; skeletal animation and animation state machines are not implemented.
- UI Studio edits a local HUD canvas; it is not yet connected to a game runtime or responsive layout export.
- Logic graph execution is a small demonstrator for connected nodes, not yet a general visual scripting VM.
- Audio files are previewed locally and are not yet embedded in the saved project or exported game.
- The old generic inspector remains available for the asset-library workspace; the functional studios expose their own controls.

## Planned architecture

- `src/editor`: editor shell, panels, commands and workspace navigation
- `src/core`: projects, assets, events, commands and undo/redo
- `src/runtime`: game runtime and preview lifecycle
- `src/studios`: scene, model, materials, animation, UI, logic and audio tools
- `src/platform`: persistence, import/export and browser integrations

These folders will be introduced as the corresponding systems are implemented. The initial shell is deliberately kept small while the visual direction is being reviewed.

## Open source

Worldsmith is being developed in the open. A repository licence will be selected and added before external contributions or redistribution are invited.
