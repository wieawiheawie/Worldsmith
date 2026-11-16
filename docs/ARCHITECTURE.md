# Worldsmith architecture

## Current milestone

The current repository milestone is the reviewable editor shell. It provides a navigable interface with workspace-specific visual previews. It is not yet a complete engine, project database, modelling package or runtime.

## Architectural boundaries

Worldsmith is intended to become a browser-first, local-first creative application. The editor UI must remain separate from the runtime used to preview and export games.

Planned boundaries:

- **Editor shell:** workspace navigation, panels, commands, menus, shortcuts and layout state.
- **Project core:** project metadata, scene documents, assets, references, versioning and migration.
- **Command system:** user actions represented as commands, enabling undo/redo and consistent shortcuts.
- **Asset system:** import, processing, indexing, preview, dependency tracking and export.
- **Scene model:** entities, components, transforms, hierarchy and serialisation.
- **Runtime:** game loop, input, rendering, physics, audio and preview lifecycle.
- **Studios:** scene, model, materials, animation, UI, logic and audio authoring tools.
- **Platform:** browser persistence, optional cloud integrations and build/export pipelines.

## Initial technical direction

- React and TypeScript for the editor interface.
- Vite for local development and production builds.
- Keep graphics/runtime integrations behind internal interfaces until the first scene-editing milestone is proven.
- Use browser workers and WebAssembly only where profiling demonstrates a real need.
- Prefer open, documented formats for assets and project interchange.

## Design rules

1. One project and asset model is shared across every studio.
2. A workspace is a focused view over shared project data, not a separate application.
3. Editor-only state must not leak into exported games.
4. Do not expose non-functional controls as completed features.
5. Every important user action should eventually be undoable.
6. Local project editing must not require a Worldsmith account or official service.
