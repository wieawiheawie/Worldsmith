# Worldsmith Studio Design Research

**Research date:** 16 November 2026  
**Purpose:** Establish practical interaction and layout rules for Worldsmith's creative workspaces, using established DCC, game-engine, material-authoring, animation, UI and visual-scripting workflows as references.

This document is a product and interaction specification, not a claim that Worldsmith already implements every feature described here. The immediate objective is to make each workspace a real editor for its own kind of data, while keeping one shared project and asset model underneath.

## Current implementation checkpoint — 16 November 2026

The first implementation pass now includes a dedicated Model Studio, separate from Scene Studio. It has editable polygon mesh data (vertices and faces), component selection modes, object transforms, primitive creation, selected-face extrusion/inset/subdivision, component deletion, a per-model mesh-operation undo/redo history, mesh statistics, snap controls, and browser-local persistence. GLB files can be imported into editable triangle topology and exported again. Model assets can be instanced into Scene Studio by asset ID so that the scene renders the current source mesh.

This is a foundation, not a finished DCC modeller. Imported GLB geometry is flattened into a single editable mesh and triangulated; source materials, UVs, rigs, animation and multi-object hierarchy are not preserved by this first importer/exporter. The editor does not yet have bevel, loop cut, knife, merge/weld, UV unwrap, sculpting, modifier stacks or non-destructive mesh operations. Undo/redo currently covers mesh edits, not every object/asset operation.

The broader workspace recommendations below remain the intended design direction. The next implementation should replace each remaining demonstration-level studio with a task-specific editor, then consolidate the browser-local records into a versioned shared project database.

## 1. Core product direction

Worldsmith should feel like one professional desktop creative suite running in a browser. It should not feel like a landing page containing a set of themed demo panels.

The shell may provide project navigation, workspace switching, menus, docking, commands, search and project status. Inside that shell, every studio should have its own task-appropriate workspace. A modelling canvas, a texture-painting canvas, an animation dope sheet and a node graph do not share the same interaction model and should not be forced into one generic canvas layout.

### Common editor rules

- The work surface receives the largest share of the available space.
- Tool shelves contain real operations, grouped by task, with tool settings shown only when relevant.
- Hierarchies list actual objects, model parts, layers, tracks, controls or nodes.
- Properties always describe the current selection. They must not display unrelated sample fields.
- Tool state and selection are visible. The user should be able to tell whether they are in Object Mode, Edit Mode, paint mode, a graph, or a timeline.
- Operations should support undo/redo, selection, keyboard shortcuts and clear status feedback.
- Use restrained dark neutral panels, clear separators, compact labels and one controlled accent colour. Do not fill unused regions with decorative screenshots, stock art, fake asset cards or sample thumbnails.
- Images are appropriate when they are real project assets: imported textures, model thumbnails generated from actual models, image assets, or material previews. They are not decoration for explaining what a workspace is.
- Panel sizes should be resizable and layouts should persist. The viewport must resize with its panel instead of scaling the entire editor interface.

## 2. Model Studio — a real mesh editor

### Reference workflows

Blender's Edit Mode separates component selection into vertices, edges and faces. These modes affect which mesh elements can be selected and manipulated. Blender's modelling toolset includes extrude, inset, bevel, loop cut, knife, subdivide, edge slide, vertex slide and related operations.

Unreal Engine's Modeling Mode separates tools into categories such as Create, Select, Transform, Deform, Model, Mesh, Voxel, Bake and UVs. Choosing a tool exposes its own settings in a Tool Properties panel. Its documentation also describes previewing operations and explicitly accepting or cancelling a result.

Three.js supplies a rendering layer rather than a full modeller: BufferGeometry stores vertex attributes and triangle indices, while OrbitControls and TransformControls provide viewport navigation and object transform gizmos. Worldsmith therefore needs its own editable mesh data model and mesh-edit operations above Three.js.

### Recommended layout

- **Top header:** model/asset name, Object/Edit mode, vertex/edge/face selection modes, snapping and viewport display options.
- **Left tool shelf:** Create, Select, Transform, Mesh Edit, Deform and later UV tools.
- **Centre:** a large perspective/orthographic viewport with grid, axes, lighting, selection overlays, vertex dots, edge lines and a transform gizmo.
- **Right properties:** mesh statistics, selected-component data, transforms, tool parameters and material assignment.
- **Outliner:** actual mesh objects and parts in the current model asset.
- **Bottom status line:** selection counts, operation hints, shortcuts and save state.

### Minimum useful modelling workflow

1. Create a cube, plane, cylinder or sphere.
2. Switch between Object Mode and Edit Mode.
3. Select vertices, edges and faces with click, shift-click and selection tools.
4. Move, rotate and scale objects or selected components.
5. Extrude and inset faces; subdivide geometry; delete selected components.
6. Inspect vertex, edge, face and triangle counts.
7. Rename, duplicate, delete and save model assets.
8. Reuse the resulting model asset in Scene Studio.

### Data model requirements

The editable source of truth must retain vertices, polygon faces, edge connectivity, UV coordinates, normals, material slots and object transforms. A GPU BufferGeometry is a render representation, not the only copy of the modelling data. Mesh changes should be expressed as edit operations against this source data, validated, and then rebuilt into render buffers.

A mesh operation should be atomic from the user's perspective. It should either complete with a valid resulting mesh or leave the previous mesh intact. Destructive tools should be undoable. Operations such as bevel and loop cut need topology-aware algorithms; they must not be simulated by changing an unrelated slider or by changing a preview primitive.

### First-pass scope

Start with primitive creation, object transforms, vertex/edge/face selection, face extrusion, face inset, face subdivision, component deletion, colour/material assignment, mesh statistics and local project persistence. Add bevel, loop cuts, knife, bridge, merge/weld, normals, symmetry, modifiers, UV unwrap and export after the topology core is reliable.

## 3. Scene Studio — arrange the game world

Unity's editor documentation describes the essential relationship between Scene View, Hierarchy, Inspector, Project and Game View. The Scene View is where objects are positioned and organized; the Hierarchy manages scene objects; the Inspector edits the selected object's properties; the Project window manages reusable assets.

### Recommended layout

- Large real-time scene viewport.
- Hierarchy of actual scene entities, with expand/collapse and multi-selection.
- Inspector with components and editable properties for the selected entity.
- Asset browser for models, materials, textures, audio, scenes and prefabs.
- Scene-specific tool settings for selection, move, rotate, scale, snapping, pivots and coordinate space.
- Play/stop preview that starts the actual project runtime, not just a banner.

Scene Studio should place and configure model assets, lights, cameras, terrain and gameplay entities. Model Studio should edit the underlying mesh asset. A scene instance references an asset; it should not silently become an unrelated copy of the model geometry.

## 4. Materials Studio — layer-based PBR authoring

Substance 3D Painter's documentation makes the Layer Stack central to authoring. Paint layers, fill layers and folders can be reordered, hidden, grouped and adjusted with opacity and blend modes. Masks and effects can be attached to layers. A texture set determines which mesh/material region is being painted, and paint tools work against the mesh.

### Recommended layout

- Central 3D preview with a secondary 2D texture/UV view.
- Left asset shelf containing actual brushes, materials, smart materials and procedural resources.
- Right panel containing texture sets, material channels and a layer/effect stack.
- Brush properties only when a brush tool is active.
- Live preview of base colour, metallic, roughness, normal, height and ambient-occlusion channels.
- Import/export configuration for texture maps and material presets.

### Minimum useful material workflow

Create and edit a material; set PBR channel values; create paint and fill layers; reorder, hide and rename layers; set opacity; add a mask; paint on a selected texture set; preview the result on the selected mesh; and save the material as a reusable project asset.

A single shared canvas texture is not a sufficient long-term texture-painting architecture. Use layers and channel-aware image data, with texture sets associated with model material slots. Keep procedural fills and masks non-destructive where possible.

## 5. Animation Studio — channels, keyframes and curves

Blender provides several specialised animation editors. The Dope Sheet organizes keyframes by object and property channels. The Graph Editor provides curve-level control over interpolation and handles. The NLA Editor layers and sequences animation actions. Unity's Animation view is connected to the selected GameObject and exposes animated properties, timeline keys, animation events and curve editing.

### Recommended layout

- Character/object preview viewport with playback controls.
- Timeline ruler and playhead, with draggable and multi-selectable keyframes.
- Channel tree showing animated objects and properties (location X/Y/Z, rotation, scale, bones, visibility, etc.).
- Dope Sheet for timing and key organisation.
- Graph Editor for interpolation and easing curves.
- Rig/bone hierarchy and clip/action selector.
- Frame rate, start/end frame and loop controls.

### Minimum useful animation workflow

Select a scene object or rig; choose a property; key its current value at a frame; change the value at another frame; scrub and play; drag, duplicate and delete keys; select interpolation; and see the animation applied back to the scene object. Skeletal animation, IK, constraints, retargeting, animation state machines and NLA layering can follow.

Animation is not a single sprite moving across a decorative stage. It is a system that records and edits real properties on real project objects.

## 6. UI Studio — a responsive interface designer

Godot's UI documentation distinguishes content controls (buttons, labels, line edits and text edits) from layout controls (box, margin, scroll and tab containers). It also supports anchors, containers, focus/navigation and theme resources. These are structural layout concepts, not merely rectangles positioned on a canvas.

### Recommended layout

- Central 2D artboard with selectable controls and multi-resolution preview.
- UI hierarchy containing nested controls and layout containers.
- Inspector for text, font, colour, borders, anchors, offsets, minimum sizes, alignment, input and accessibility properties.
- Widget palette containing actual controls, layout containers and custom components.
- Theme editor for reusable fonts, colours, styles and component variants.
- Preview modes for target resolutions and runtime input.

### Minimum useful workflow

Create a canvas/screen; add labels, images, buttons, panels and progress bars; nest and reorder them; configure anchors and layout containers; edit typography and styling; define button behaviour; preview at several resolutions; save as a reusable UI scene/prefab.

Freeform dragging remains useful for manual layout, but responsive interfaces need anchors and layout containers as first-class data.

## 7. Logic Studio — a typed visual programming graph

Unreal Blueprints uses nodes and typed data. Execution wires control when actions run; data pins pass values. Event nodes begin execution in response to gameplay events. The Graph Editor provides a graph canvas, node movement, navigation, graph tabs, breadcrumbs and zoom. Connections and node types are meaningful program data.

### Recommended layout

- Large infinite/pannable graph canvas.
- Context-sensitive searchable node menu.
- Typed input/output pins, with distinct execution-flow and data connections.
- Graph tabs for Event Graph, functions, construction/setup scripts and subgraphs.
- Right node inspector for input values, types, descriptions and settings.
- Compile/validate feedback, errors, warnings and execution tracing.
- Debug mode showing live pin values and the path taken through the graph.

### Minimum useful workflow

Add an event node; add actions and data nodes; connect compatible pins by dragging; edit typed values; validate the graph; execute it against the project runtime; and see meaningful output/errors. A graph that prints hard-coded log lines based only on node titles is a UI test, not a scripting system.

## 8. Audio Studio — sound asset and timeline editing

The audio workspace should be organised around imported audio assets, tracks, clips, a timeline and a mixer. The 3D/scene runtime should be able to reference audio assets through audio-source components and events.

### Recommended layout

- Asset browser with actual audio files and waveform previews.
- Multitrack timeline with draggable, trim-able clips and snapping.
- Transport controls, time ruler and playhead.
- Mixer with track volume, pan, mute, solo and routing.
- Clip properties for looping, gain, fades and playback options.
- Event/trigger properties that connect audio to gameplay logic.

Initial support can focus on import, preview, clip placement, trimming, gain and simple mixer playback. Project audio must be stored as project assets rather than only as temporary browser object URLs.

## 9. Assets Studio — a real project content browser

The asset browser is a content-management surface, not a gallery of hard-coded cards. It should show real imported project assets and support folders, search, type filters, tags, metadata, drag/drop into supported editors, rename, duplicate, delete and dependency/reference tracking. Thumbnails should be generated from real assets or their previews.

Model assets, materials, textures, animation clips, UI scenes, logic graphs, audio files and scenes should all share stable asset IDs and project-relative references.

## 10. Shared project architecture

Every studio must edit a shared project document rather than keeping an isolated local demo state.

- **Asset database:** stable IDs, type, path/blob, metadata, dependencies and import settings.
- **Scene document:** entities, hierarchy, components and references to model/material/audio/UI assets.
- **Model document:** editable topology, attributes, material slots and export settings.
- **Material document:** channel values, texture-set references, layer stack, masks and effects.
- **Animation document:** clips, property paths, keyframes, curves, events and rig references.
- **UI document:** control tree, layout data, themes and interactions.
- **Logic document:** typed node definitions, pin values, graph connections and execution metadata.
- **Audio document:** tracks, clips, routing, source assets and events.
- **Command/history layer:** undo/redo for every editing operation, including batch selection and topology edits.
- **Persistence:** versioned project file format, migration path and reliable local autosave. Browser storage is a working cache; project export/import must preserve the actual data and binary assets.

## 11. Implementation order

1. Build the editable mesh data model and real Model Studio operations. Validate topology and undo each operation.
2. Introduce a shared project/asset database and explicit import/reuse of model assets in scenes.
3. Make Scene Studio manipulate the same project entities and real components.
4. Replace the material paint canvas with texture sets, channel data and a layer stack.
5. Rebuild Animation around property channels, draggable keyframes and curve editing.
6. Rebuild UI around a nested control tree, responsive constraints and themes.
7. Replace the visual-logic demonstrator with a typed graph evaluator connected to the runtime.
8. Turn Audio into a project asset/timeline/mixer workflow.
9. Add format import/export, project migration, undo/redo tests, browser performance profiling and accessibility checks.

Do not add a button to a studio until it performs a real operation against that studio's data model. Where a feature is not implemented, keep it out of the active tool palette or label it clearly as unavailable.

## 12. Research references

The following official manuals and documentation informed this design:

- Epic Games, [Modeling Mode Overview](https://dev.epicgames.com/documentation/unreal-engine/modeling-mode-in-unreal-engine) — tool categories, tool palette, tool settings, mesh editing workflows, preview/accept/cancel.
- Epic Games, [Modeling Tools](https://dev.epicgames.com/documentation/unreal-engine/modeling-tools-in-unreal-engine) — creation, selection, transform, deformation, mesh processing, bake and UV categories.
- Blender, [Mesh Selection Modes](https://docs.blender.org/manual/en/latest/modeling/meshes/selecting/introduction.html) — vertex, edge and face selection.
- Blender, [Mesh Editing Tools](https://docs.blender.org/manual/en/latest/modeling/meshes/tools/toolbar.html) and [Mesh Editing Reference](https://docs.blender.org/manual/en/latest/modeling/meshes/editing/index.html) — extrusion, inset, bevel, loop cut, knife, subdivision and related operations.
- Unity, [Editor Windows and Views](https://docs.unity.com/en-us/engine/6000.3/manual/unity-editor/editor-windows-views-reference) — Scene, Hierarchy, Inspector, Project and Game views.
- Adobe, [Substance 3D Painter Layer Stack](https://experienceleague.adobe.com/en/docs/substance-3d-painter/using/interface/layer-stack/layer-stack), [Layer Management](https://experienceleague.adobe.com/en/docs/substance-3d-painter/using/interface/layer-stack/managing-layers), and [Painting Tools](https://experienceleague.adobe.com/en/docs/substance-3d-painter/using/painting/paint-tools/tool-list) — layer-based, multi-channel texture authoring, masks, effects and painting.
- Blender, [Editing Keyframes](https://docs.blender.org/manual/en/latest/animation/keyframes/editing.html) and [Graph Editor Curve Properties](https://docs.blender.org/manual/en/5.4/editors/graph_editor/fcurves/properties.html) — keyframe editing and curve interpolation/handles.
- Unity, [Animation Window](https://docs.unity.com/en-us/engine/7000.0/manual/animation-section/animation-mecanim/animation-clips/animation-editor-guide) — animation clips, property channels, events and curve editor.
- Godot, [User Interface](https://docs.godotengine.org/en/stable/tutorials/ui/index.html) and [Containers](https://docs.godotengine.org/en/stable/tutorials/ui/gui_containers.html) — control types, anchors, layout containers and themes.
- Epic Games, [Blueprint Visual Scripting](https://dev.epicgames.com/documentation/unreal-engine/overview-of-blueprints-visual-scripting-in-unreal-engine) and [Blueprint Graph Editor](https://dev.epicgames.com/documentation/unreal-engine/graph-editor-for-the-blueprints-visual-scripting-editor-in-unreal-engine) — typed data, execution flow, nodes, pins and graph navigation.
- Three.js, [BufferGeometry](https://threejs.org/docs/pages/BufferGeometry.html), [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html) and [TransformControls](https://threejs.org/docs/pages/TransformControls.html) — rendering data, viewport navigation and transform gizmos.

These references describe established editor patterns. Worldsmith should adopt the underlying workflows and adapt them to a coherent browser-based product, not copy their branding or pretend to have their full feature sets.
