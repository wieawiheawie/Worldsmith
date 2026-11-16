import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity, Box, Brush, Camera, Check, ChevronDown, ChevronRight, CircleHelp,
  Clock3, Cuboid, Eye, Folder, FolderOpen, Grid3X3, Image, Layers, Lightbulb,
  Maximize2, MoreHorizontal, Move, MousePointer2, Music2, Orbit, Palette,
  PanelBottom, PanelsTopLeft, Play, Plus, Redo2, RotateCw, Save, Search,
  Settings2, SlidersHorizontal, Square, Terminal, Undo2, Upload, Workflow,
  X, ZoomIn, ZoomOut
} from "lucide-react";

type WorkspaceId = "Scene" | "Model" | "Materials" | "Animation" | "UI" | "Logic" | "Audio" | "Assets";
type DockTab = "Assets" | "Timeline" | "Console";
type ToolId = "select" | "move" | "rotate" | "scale" | "paint" | "sculpt";

const WORKSPACES: { id: WorkspaceId; icon: LucideIcon; hint: string }[] = [
  { id: "Scene", icon: PanelsTopLeft, hint: "Build worlds and arrange objects" },
  { id: "Model", icon: Cuboid, hint: "Create and edit 3D meshes" },
  { id: "Materials", icon: Palette, hint: "Paint textures and build materials" },
  { id: "Animation", icon: Activity, hint: "Rig, animate and edit motion" },
  { id: "UI", icon: PanelsTopLeft, hint: "Design game interfaces and HUDs" },
  { id: "Logic", icon: Workflow, hint: "Build behaviour and game systems" },
  { id: "Audio", icon: Music2, hint: "Edit sound and interactive audio" },
  { id: "Assets", icon: FolderOpen, hint: "Browse project resources" }
];

const TOOLS: { id: ToolId; label: string; key: string; icon: LucideIcon }[] = [
  { id: "select", label: "Select", key: "Q", icon: MousePointer2 },
  { id: "move", label: "Move", key: "W", icon: Move },
  { id: "rotate", label: "Rotate", key: "E", icon: RotateCw },
  { id: "scale", label: "Scale", key: "R", icon: Maximize2 },
  { id: "paint", label: "Paint", key: "B", icon: Brush },
  { id: "sculpt", label: "Sculpt", key: "S", icon: Orbit }
];

const PANEL_ITEMS: Record<WorkspaceId, { label: string; kind: string; indent?: number }[]> = {
  Scene: [
    { label: "World", kind: "folder" }, { label: "Main Camera", kind: "camera", indent: 1 },
    { label: "Sun Light", kind: "light", indent: 1 }, { label: "Environment", kind: "folder", indent: 1 },
    { label: "Terrain", kind: "terrain", indent: 2 }, { label: "Trees", kind: "folder", indent: 2 },
    { label: "Oak Tree", kind: "model", indent: 3 }, { label: "Pine Tree", kind: "model", indent: 3 },
    { label: "Player", kind: "model", indent: 1 }, { label: "Props", kind: "folder", indent: 1 },
    { label: "Stone 01", kind: "model", indent: 2 }
  ],
  Model: [
    { label: "Character_Mesh", kind: "model" }, { label: "Body", kind: "mesh", indent: 1 },
    { label: "Head", kind: "mesh", indent: 1 }, { label: "Left Arm", kind: "mesh", indent: 1 },
    { label: "Right Arm", kind: "mesh", indent: 1 }, { label: "Left Leg", kind: "mesh", indent: 1 },
    { label: "Right Leg", kind: "mesh", indent: 1 }, { label: "Mesh Groups", kind: "folder" },
    { label: "Retopology", kind: "folder" }
  ],
  Materials: [
    { label: "Material Graph", kind: "folder" }, { label: "Body_Painted", kind: "material", indent: 1 },
    { label: "Fabric_Rough", kind: "material", indent: 1 }, { label: "Metal_Trim", kind: "material", indent: 1 },
    { label: "Texture Layers", kind: "folder" }, { label: "Base Color", kind: "image", indent: 1 },
    { label: "Roughness", kind: "image", indent: 1 }, { label: "Normal", kind: "image", indent: 1 }
  ],
  Animation: [
    { label: "Character_Rig", kind: "model" }, { label: "Root", kind: "bone", indent: 1 },
    { label: "Spine", kind: "bone", indent: 2 }, { label: "Head", kind: "bone", indent: 3 },
    { label: "Left Arm", kind: "bone", indent: 2 }, { label: "Right Arm", kind: "bone", indent: 2 },
    { label: "Left Leg", kind: "bone", indent: 2 }, { label: "Right Leg", kind: "bone", indent: 2 }
  ],
  UI: [
    { label: "Game HUD", kind: "folder" }, { label: "Top Bar", kind: "ui", indent: 1 },
    { label: "Player Status", kind: "ui", indent: 1 }, { label: "Health Bar", kind: "ui", indent: 2 },
    { label: "Stamina Bar", kind: "ui", indent: 2 }, { label: "Inventory Panel", kind: "ui", indent: 1 },
    { label: "Hotbar", kind: "ui", indent: 1 }, { label: "Interaction Prompt", kind: "ui", indent: 1 }
  ],
  Logic: [
    { label: "Player Controller", kind: "folder" }, { label: "On Start", kind: "node", indent: 1 },
    { label: "Input: Move", kind: "node", indent: 1 }, { label: "Branch: Grounded", kind: "node", indent: 1 },
    { label: "Apply Velocity", kind: "node", indent: 1 }, { label: "Events", kind: "folder" },
    { label: "On Interact", kind: "node", indent: 1 }
  ],
  Audio: [
    { label: "Master Bus", kind: "folder" }, { label: "Ambience", kind: "audio", indent: 1 },
    { label: "Footsteps", kind: "audio", indent: 1 }, { label: "UI Sounds", kind: "folder" },
    { label: "Click", kind: "audio", indent: 1 }, { label: "Confirm", kind: "audio", indent: 1 }
  ],
  Assets: [
    { label: "All Assets", kind: "folder" }, { label: "Models", kind: "folder", indent: 1 },
    { label: "Materials", kind: "folder", indent: 1 }, { label: "Textures", kind: "folder", indent: 1 },
    { label: "Animations", kind: "folder", indent: 1 }, { label: "UI", kind: "folder", indent: 1 },
    { label: "Audio", kind: "folder", indent: 1 }, { label: "Scripts", kind: "folder", indent: 1 }
  ]
};

const KIND_ICONS: Record<string, LucideIcon> = {
  folder: Folder, camera: Camera, light: Lightbulb, terrain: Grid3X3, model: Cuboid,
  mesh: Box, material: Palette, image: Image, bone: Activity, ui: PanelsTopLeft,
  node: Workflow, audio: Music2
};

function SceneArtwork() {
  return (
    <svg className="scene-artwork" viewBox="0 0 920 560" role="img" aria-label="Illustrated 3D scene preview">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#263746" /><stop offset="1" stopColor="#17232e" /></linearGradient>
        <linearGradient id="islandTop" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stopColor="#6b9a72" /><stop offset="1" stopColor="#426f5d" /></linearGradient>
        <linearGradient id="islandSide" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#786b54" /><stop offset="1" stopColor="#393b36" /></linearGradient>
        <linearGradient id="water" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stopColor="#397a88" /><stop offset="1" stopColor="#244956" /></linearGradient>
        <radialGradient id="sunGlow"><stop offset="0" stopColor="#d4b77e" stopOpacity=".18" /><stop offset="1" stopColor="#d4b77e" stopOpacity="0" /></radialGradient>
        <pattern id="floorGrid" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M 34 0 L 0 0 0 34" fill="none" stroke="#8fa2ad" strokeOpacity=".12" strokeWidth="1" /></pattern>
        <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10" /></filter>
      </defs>
      <rect width="920" height="560" fill="url(#sky)" /><circle cx="710" cy="100" r="250" fill="url(#sunGlow)" />
      <path d="M0 420 L460 155 L920 420 L460 560 Z" fill="#26343d" opacity=".5" /><path d="M0 420 L460 155 L920 420 L460 560 Z" fill="url(#floorGrid)" />
      <path d="M98 355 L458 150 L824 358 L460 565 Z" fill="none" stroke="#71818b" strokeOpacity=".25" />
      <path d="M170 397 L460 232 L752 397 M243 438 L460 314 L675 438 M316 480 L460 398 L603 480" fill="none" stroke="#71818b" strokeOpacity=".18" />
      <ellipse cx="472" cy="405" rx="300" ry="65" fill="#0d171d" opacity=".55" filter="url(#softShadow)" />
      <path d="M170 282 L448 125 L756 302 L471 467 Z" fill="url(#islandSide)" stroke="#a49a7b" strokeOpacity=".48" strokeWidth="2" />
      <path d="M170 282 L170 316 L471 493 L471 467 Z" fill="#504b3f" /><path d="M471 467 L756 302 L756 333 L471 493 Z" fill="#393d36" />
      <path d="M170 282 L448 125 L756 302 L471 467 Z" fill="url(#islandTop)" stroke="#a6b58b" strokeOpacity=".7" strokeWidth="2" />
      <path d="M193 279 L448 143 L729 303 L470 449 Z" fill="#5d8a68" opacity=".55" />
      <path d="M240 278 C280 231 343 224 389 240 C445 259 475 234 520 247 C574 263 600 306 677 305 L470 427 Z" fill="#49795e" opacity=".72" />
      <path d="M225 282 C290 297 312 319 356 339 C390 354 420 363 451 370" fill="none" stroke="#6d9d9a" strokeWidth="22" strokeLinecap="round" opacity=".8" />
      <path d="M225 282 C290 297 312 319 356 339 C390 354 420 363 451 370" fill="none" stroke="url(#water)" strokeWidth="15" strokeLinecap="round" />
      <path d="M225 282 C290 297 312 319 356 339 C390 354 420 363 451 370" fill="none" stroke="#8bbec0" strokeWidth="2" strokeLinecap="round" opacity=".65" />
      <g opacity=".9"><path d="M335 268 L339 222 L357 213 L354 277 Z" fill="#6b5641" /><circle cx="346" cy="202" r="34" fill="#365f4e" /><circle cx="320" cy="213" r="22" fill="#47775a" /><circle cx="365" cy="220" r="24" fill="#4c805f" /><circle cx="351" cy="178" r="21" fill="#5a8964" /></g>
      <g><path d="M583 283 L587 244 L603 237 L600 296 Z" fill="#70583f" /><circle cx="596" cy="220" r="34" fill="#315a4b" /><circle cx="571" cy="231" r="21" fill="#4a7958" /><circle cx="621" cy="233" r="23" fill="#48765a" /><circle cx="600" cy="194" r="22" fill="#5d8b65" /></g>
      <g><path d="M477 239 L480 205 L492 199 L490 248 Z" fill="#7b6043" /><circle cx="486" cy="185" r="26" fill="#365d4b" /><circle cx="467" cy="194" r="17" fill="#4f7e5a" /><circle cx="505" cy="197" r="17" fill="#4a7958" /></g>
      <g transform="translate(438 300)"><ellipse cx="10" cy="43" rx="38" ry="13" fill="#17251e" opacity=".35" /><path d="M-14 5 L10 -8 L34 5 L10 19 Z" fill="#e1c28c" /><path d="M-14 5 L10 19 L10 46 L-14 31 Z" fill="#9b795a" /><path d="M10 19 L34 5 L34 32 L10 46 Z" fill="#6f5947" /><path d="M-11 4 L10 -7 L31 5" fill="none" stroke="#f0dfb7" strokeWidth="3" /><path d="M-4 15 L7 21 L7 36 L-4 30 Z" fill="#31414a" /></g>
      <g transform="translate(535 338)"><ellipse cx="0" cy="19" rx="16" ry="6" fill="#1b3028" opacity=".45" /><circle cx="0" cy="-12" r="8" fill="#d6b28b" /><path d="M-9 -3 Q0 -10 9 -3 L11 14 L-10 14 Z" fill="#d98c64" /><path d="M-8 13 L-12 25 M7 13 L12 24" stroke="#26343b" strokeWidth="5" strokeLinecap="round" /></g>
      <g fill="#bdc59a" opacity=".8"><circle cx="275" cy="306" r="3" /><circle cx="292" cy="319" r="2" /><circle cx="655" cy="311" r="3" /><circle cx="625" cy="330" r="2" /><circle cx="398" cy="215" r="2" /><circle cx="515" cy="274" r="2" /></g>
      <g stroke="#d4c39a" strokeOpacity=".65" fill="none"><path d="M184 276 L448 128 L748 300" strokeWidth="1.2" /><path d="M181 286 L470 457 L750 294" strokeWidth="1.2" /></g>
    </svg>
  );
}

function ModelArtwork() {
  return (
    <svg className="model-artwork" viewBox="0 0 700 500" role="img" aria-label="Low-poly character mesh preview">
      <defs><linearGradient id="meshBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e5b48d" /><stop offset="1" stopColor="#a9785d" /></linearGradient><linearGradient id="meshCloth" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7ca6a2" /><stop offset="1" stopColor="#355c65" /></linearGradient></defs>
      <ellipse cx="350" cy="416" rx="150" ry="27" fill="#0b1217" opacity=".42" />
      <g stroke="#b8c5c9" strokeWidth="1.3" strokeLinejoin="round">
        <path d="M307 110 L350 78 L397 109 L388 168 L350 188 L310 166 Z" fill="url(#meshBody)" /><path d="M307 110 L350 78 L350 188 L310 166 Z" fill="#c78f6f" /><path d="M350 78 L397 109 L388 168 L350 188 Z" fill="#a9765b" />
        <path d="M314 192 L350 175 L389 192 L426 298 L350 331 L275 298 Z" fill="url(#meshCloth)" /><path d="M314 192 L350 175 L350 331 L275 298 Z" fill="#416e76" /><path d="M350 175 L389 192 L426 298 L350 331 Z" fill="#315761" />
        <path d="M282 213 L314 194 L295 305 L270 298 Z" fill="#7c9f9b" /><path d="M389 194 L416 212 L433 298 L409 306 Z" fill="#547f82" />
        <path d="M301 320 L350 332 L343 411 L310 415 L286 409 Z" fill="#b88d6d" /><path d="M350 332 L401 318 L415 408 L388 416 L355 411 Z" fill="#9c765d" />
        <path d="M286 409 L343 411 L350 429 L282 429 Z" fill="#293e47" /><path d="M355 411 L415 408 L426 429 L350 429 Z" fill="#263942" />
        <path d="M309 199 L350 215 L391 199 M350 215 L350 325" fill="none" stroke="#9cc4bd" strokeOpacity=".5" /><path d="M310 114 L350 137 L395 111 M350 137 L350 184" fill="none" stroke="#f0c6a4" strokeOpacity=".7" />
      </g>
      <g fill="none" stroke="#62c9bf" strokeWidth="1.1" opacity=".75"><path d="M307 110 L350 78 L397 109 L388 168 L350 188 L310 166 Z" /><path d="M314 192 L350 175 L389 192 L426 298 L350 331 L275 298 Z" /><path d="M301 320 L350 332 L343 411 L310 415 L286 409 Z" /><path d="M350 332 L401 318 L415 408 L388 416 L355 411 Z" /></g>
      <g fill="#62c9bf"><circle cx="350" cy="78" r="4" /><circle cx="307" cy="110" r="4" /><circle cx="397" cy="109" r="4" /><circle cx="350" cy="188" r="4" /><circle cx="275" cy="298" r="4" /><circle cx="426" cy="298" r="4" /></g>
    </svg>
  );
}

function AnimationArtwork() {
  return (
    <svg className="animation-artwork" viewBox="0 0 700 390" role="img" aria-label="Character rig animation preview">
      <ellipse cx="350" cy="336" rx="130" ry="19" fill="#0b1217" opacity=".3" /><path d="M130 337 H570" stroke="#78909c" strokeOpacity=".32" strokeDasharray="5 7" />
      <g stroke="#79c8bf" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none"><path d="M350 132 L350 216 L350 286" /><path d="M350 154 L304 190 L278 239" /><path d="M350 154 L396 190 L427 231" /><path d="M350 286 L313 327" /><path d="M350 286 L395 322" /></g>
      <g fill="#d5ad88" stroke="#f1d1b0" strokeWidth="2"><circle cx="350" cy="106" r="28" /><path d="M327 145 Q350 128 373 145 L389 218 L350 238 L311 218 Z" fill="#5f8d8a" /></g>
      <g fill="#78c6bb"><circle cx="350" cy="154" r="7" /><circle cx="350" cy="216" r="7" /><circle cx="350" cy="286" r="7" /><circle cx="304" cy="190" r="6" /><circle cx="396" cy="190" r="6" /><circle cx="313" cy="327" r="6" /><circle cx="395" cy="322" r="6" /></g>
      <g stroke="#a3b2bc" strokeOpacity=".32" strokeWidth="1" fill="none"><path d="M350 106 L350 154 L350 216 L350 286" /><path d="M350 154 L304 190 L278 239 M350 154 L396 190 L427 231" /><path d="M350 286 L313 327 M350 286 L395 322" /></g>
    </svg>
  );
}

function LogicCanvas() {
  return (
    <div className="logic-canvas">
      <svg className="logic-wires" viewBox="0 0 900 520" preserveAspectRatio="none" aria-hidden="true"><path d="M210 110 C290 110 275 180 360 180" /><path d="M535 180 C615 180 580 285 660 285" /><path d="M210 350 C285 350 290 285 360 285" /><path d="M535 285 C590 285 600 410 660 410" /></svg>
      <div className="logic-node event-node"><span className="node-kicker">EVENT</span><strong>On Game Start</strong><small>When the scene begins</small><i /></div>
      <div className="logic-node input-node"><span className="node-kicker">INPUT</span><strong>Read Movement</strong><small>WASD / left stick</small><i /><i /></div>
      <div className="logic-node branch-node"><span className="node-kicker">FLOW CONTROL</span><strong>Is Grounded?</strong><small>Check character state</small><i /><i /></div>
      <div className="logic-node action-node"><span className="node-kicker">ACTION</span><strong>Apply Movement</strong><small>Set velocity</small><i /></div>
      <div className="logic-node action-node second-action"><span className="node-kicker">ACTION</span><strong>Play Animation</strong><small>Blend locomotion</small><i /></div>
      <div className="logic-zoom">−　100%　＋</div>
    </div>
  );
}

function UIStudioCanvas() {
  return (
    <div className="ui-stage">
      <div className="ui-artboard">
        <div className="game-preview-top"><div className="game-brand"><span className="game-brand-mark">W</span><span>THE WILDS</span></div><div className="game-top-actions"><span>MAP</span><span>JOURNAL</span><span>SETTINGS</span></div></div>
        <div className="game-preview-world">
          <div className="game-world-glow" /><div className="game-world-hill hill-back" /><div className="game-world-hill hill-front" />
          <div className="game-preview-character"><span /></div>
          <div className="game-location"><span className="location-dot" />WHISPERING GROVE <small>DAY 04 · 08:42</small></div>
          <div className="game-status-card"><div className="status-avatar">A</div><div className="status-copy"><strong>Adventurer</strong><small>Level 08 · Scout</small></div><div className="status-bars"><span /><span /><span /></div></div>
          <div className="game-quest-card"><small>ACTIVE OBJECTIVE</small><strong>Find the old outpost</strong><span>Explore the northern trail</span></div>
        </div>
        <div className="game-hotbar"><div className="hotbar-slot selected"><span>✦</span><small>1</small></div><div className="hotbar-slot"><span>⌁</span><small>2</small></div><div className="hotbar-slot"><span>◈</span><small>3</small></div><div className="hotbar-slot"><span>◇</span><small>4</small></div><div className="hotbar-slot"><span>＋</span><small>5</small></div><div className="hotbar-hint">I　INVENTORY</div></div>
      </div>
      <div className="artboard-label"><span className="tiny-dot" /> HUD_Main · 1920 × 1080 <span className="label-separator">|</span> 75% zoom</div>
    </div>
  );
}

function MaterialCanvas() {
  return (
    <div className="material-stage">
      <div className="material-preview-grid">
        <div className="material-object-card selected-material"><div className="material-orb orb-stone" /><div className="material-card-copy"><strong>Weathered stone</strong><small>MAT_Stone_01</small></div><span className="material-check"><Check size={13} /></span></div>
        <div className="material-object-card"><div className="material-orb orb-wood" /><div className="material-card-copy"><strong>Warm oak</strong><small>MAT_Wood_Oak</small></div></div>
        <div className="material-object-card"><div className="material-orb orb-metal" /><div className="material-card-copy"><strong>Brushed metal</strong><small>MAT_Metal_02</small></div></div>
      </div>
      <div className="material-stage-caption"><span className="tiny-dot" /> Material preview <span>·</span> HDRI Studio</div>
    </div>
  );
}

function AudioCanvas() {
  const bars = Array.from({ length: 92 }, (_, i) => 11 + ((i * 17 + i * i * 3) % 48));
  return (
    <div className="audio-stage">
      <div className="audio-track-card"><div className="audio-track-head"><div className="audio-icon"><Music2 size={17} /></div><div><strong>Forest_Ambience.wav</strong><small>48 kHz · Stereo · 02:14</small></div><span className="audio-track-tag">AMBIENCE</span></div>
        <div className="audio-waveform">{bars.map((bar, i) => <span key={i} style={{ height: bar + "px" }} />)}</div><div className="audio-ruler"><span>00:00</span><span>00:30</span><span>01:00</span><span>01:30</span><span>02:00</span></div>
      </div>
      <div className="audio-mixer"><div className="mixer-channel"><span>MASTER</span><div className="mixer-meter"><i /></div><strong>0.0 dB</strong></div><div className="mixer-channel"><span>AMBIENCE</span><div className="mixer-meter"><i /></div><strong>-4.0 dB</strong></div><div className="mixer-channel"><span>SFX</span><div className="mixer-meter"><i /></div><strong>-2.0 dB</strong></div></div>
    </div>
  );
}

function WorkspaceStage({ workspace }: { workspace: WorkspaceId }) {
  if (workspace === "Scene") return <><SceneArtwork /><div className="scene-label scene-label-one"><span className="label-pin" />Terrain <small>Selected</small></div><div className="scene-label scene-label-two"><span className="label-pin muted-pin" />Oak Tree</div><div className="scene-label scene-label-three"><span className="label-pin muted-pin" />Player</div><div className="axis-gizmo"><span className="axis-y">Y</span><span className="axis-x">X</span><span className="axis-z">Z</span><i /></div><div className="scene-scale-tag">PERSPECTIVE <span>·</span> LIT</div></>;
  if (workspace === "Model") return <><div className="model-grid" /><ModelArtwork /><div className="model-stage-label"><span className="tiny-dot" /> Character_Mesh <span>·</span> 1,248 vertices <span>·</span> 2,416 faces</div><div className="model-view-cube"><span>TOP</span><span>FRONT</span><span>RIGHT</span></div></>;
  if (workspace === "Materials") return <MaterialCanvas />;
  if (workspace === "Animation") return <><div className="animation-grid" /><AnimationArtwork /><div className="animation-stage-label"><span className="tiny-dot" /> Character_Rig <span>·</span> Walk_Cycle <span>·</span> 30 FPS</div></>;
  if (workspace === "UI") return <UIStudioCanvas />;
  if (workspace === "Logic") return <LogicCanvas />;
  if (workspace === "Audio") return <AudioCanvas />;
  return <div className="asset-library-stage">
    <div className="asset-library-heading"><div><span className="eyebrow">PROJECT LIBRARY</span><h2>Your creative assets</h2><p>Everything in this project, ready to use in any workspace.</p></div><button className="secondary-button"><Upload size={14} /> Import assets</button></div>
    <div className="asset-library-cards">{[
      { title: "Character Base", type: "3D MODEL", cls: "asset-char", icon: Cuboid }, { title: "Forest Ground", type: "MATERIAL", cls: "asset-ground", icon: Palette },
      { title: "Walk Cycle", type: "ANIMATION", cls: "asset-motion", icon: Activity }, { title: "Main HUD", type: "UI CANVAS", cls: "asset-ui", icon: PanelsTopLeft },
      { title: "Forest Ambience", type: "AUDIO", cls: "asset-audio", icon: Music2 }, { title: "Oak Tree", type: "3D MODEL", cls: "asset-tree", icon: Cuboid }
    ].map((asset) => { const Icon = asset.icon; return <div className="library-card" key={asset.title}><div className={"library-thumb " + asset.cls}><Icon size={25} /></div><div className="library-card-copy"><strong>{asset.title}</strong><small>{asset.type}</small></div><MoreHorizontal size={16} /></div>; })}</div>
  </div>;
}

function DockContent({ tab, workspace }: { tab: DockTab; workspace: WorkspaceId }) {
  if (tab === "Console") return <div className="console-lines"><div><span className="console-time">11:24:03</span><span className="console-info">INFO</span><span>Worldsmith editor shell initialised.</span></div><div><span className="console-time">11:24:03</span><span className="console-info">INFO</span><span>Workspace loaded: {workspace}.</span></div><div><span className="console-time">11:24:04</span><span className="console-warn">NOTE</span><span>Creative tools are being built in stages. This is the interface foundation.</span></div></div>;
  if (tab === "Timeline") return <div className="timeline-content"><div className="timeline-ruler"><span>00:00</span><span>00:10</span><span>00:20</span><span>00:30</span><span>00:40</span><span>00:50</span><span>01:00</span></div>{["Position", "Rotation", "Scale", "Visibility"].map((track, i) => <div className="timeline-track" key={track}><span>{track}</span><div className="timeline-track-line"><i style={{ left: (10 + i * 13) + "%" }} /><i style={{ left: (34 + i * 8) + "%" }} /><i style={{ left: (68 - i * 5) + "%" }} /></div></div>)}<div className="timeline-playhead" /></div>;
  return <div className="dock-assets">{[
    { name: "Character_Base", kind: "Model", color: "thumb-character", icon: Cuboid }, { name: "Forest_Ground", kind: "Material", color: "thumb-ground", icon: Palette },
    { name: "Walk_Cycle", kind: "Animation", color: "thumb-animation", icon: Activity }, { name: "HUD_Main", kind: "UI Canvas", color: "thumb-ui", icon: PanelsTopLeft },
    { name: "Forest_Ambience", kind: "Audio", color: "thumb-audio", icon: Music2 }, { name: "Oak_Tree", kind: "Model", color: "thumb-tree", icon: Cuboid }
  ].map((asset) => { const Icon = asset.icon; return <button className="dock-asset" key={asset.name}><span className={"dock-asset-thumb " + asset.color}><Icon size={17} /></span><span><strong>{asset.name}</strong><small>{asset.kind}</small></span></button>; })}</div>;
}

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceId>("Scene");
  const [selectedTool, setSelectedTool] = useState<ToolId>("select");
  const [selectedObject, setSelectedObject] = useState("Terrain");
  const [dockTab, setDockTab] = useState<DockTab>("Assets");
  const [inspectorTab, setInspectorTab] = useState<"Properties" | "Components">("Properties");
  const [playing, setPlaying] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [showBottom, setShowBottom] = useState(true);
  const [zoom, setZoom] = useState(75);
  const [leftWidth, setLeftWidth] = useState(236);
  const [rightWidth, setRightWidth] = useState(286);
  const [bottomHeight, setBottomHeight] = useState(186);

  const current = WORKSPACES.find((item) => item.id === workspace)!;
  const panelItems = PANEL_ITEMS[workspace].filter((item) => item.label.toLowerCase().includes(search.toLowerCase()));
  const announce = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2400); };
  const beginResize = (side: "left" | "right" | "bottom", event: import("react").PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX; const startY = event.clientY;
    const startSize = side === "left" ? leftWidth : side === "right" ? rightWidth : bottomHeight;
    const onMove = (move: PointerEvent) => {
      if (side === "left") setLeftWidth(Math.max(185, Math.min(380, startSize + move.clientX - startX)));
      if (side === "right") setRightWidth(Math.max(220, Math.min(390, startSize + startX - move.clientX)));
      if (side === "bottom") setBottomHeight(Math.max(105, Math.min(360, startSize + startY - move.clientY)));
    };
    const onUp = () => { document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp); document.body.classList.remove("is-resizing"); };
    document.body.classList.add("is-resizing"); document.addEventListener("pointermove", onMove); document.addEventListener("pointerup", onUp);
  };

  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setShowPalette(true); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); announce("Project saved locally"); }
      if (event.key === "Escape") { setShowPalette(false); setShowAddMenu(false); }
      if (!typing && event.code === "Space") { event.preventDefault(); setPlaying((value) => !value); }
      if (!typing && ["q", "w", "e", "r", "b", "s"].includes(event.key.toLowerCase())) {
        const map: Record<string, ToolId> = { q: "select", w: "move", e: "rotate", r: "scale", b: "paint", s: "sculpt" };
        setSelectedTool(map[event.key.toLowerCase()]);
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, []);

  const commands = useMemo(() => ["Create new scene", "Add cube", "Add sphere", "Add light", "Open Model Studio", "Open Materials Studio", "Open Animation Studio", "Open UI Studio", "Open Logic Studio", "Toggle asset panel", "Toggle inspector", "Save project", "Play preview"].filter((item) => item.toLowerCase().includes(paletteQuery.toLowerCase())), [paletteQuery]);
  const chooseWorkspace = (id: WorkspaceId) => { setWorkspace(id); setSearch(""); setSelectedTool("select"); setSelectedObject(PANEL_ITEMS[id][0]?.label ?? ""); setInspectorTab("Properties"); announce(id + " workspace"); };
  const runCommand = (command: string) => {
    if (command.includes("Model")) setWorkspace("Model");
    else if (command.includes("Materials")) setWorkspace("Materials");
    else if (command.includes("Animation")) setWorkspace("Animation");
    else if (command.includes("UI")) setWorkspace("UI");
    else if (command.includes("Logic")) setWorkspace("Logic");
    else if (command.includes("inspector")) setShowRight((value) => !value);
    else if (command.includes("asset")) setShowLeft((value) => !value);
    else if (command.includes("Play")) setPlaying((value) => !value);
    else if (command.includes("Save")) announce("Project saved locally");
    else if (command.includes("Add")) setShowAddMenu(true);
    else announce("New scene ready");
    setShowPalette(false);
    setPaletteQuery("");
  };
  const workspaceTitle: Record<WorkspaceId, string> = {
    Scene: "Scene hierarchy", Model: "Model outliner", Materials: "Material layers", Animation: "Rig hierarchy",
    UI: "UI hierarchy", Logic: "Logic graph", Audio: "Audio project", Assets: "Project assets"
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-mark"><span /><span /><span /></div><div className="brand-name">worldsmith<span>studio</span></div></div>
        <div className="topbar-divider" />
        <button className="project-switcher" onClick={() => announce("Project menu is ready for the project manager milestone")}><span className="project-icon"><Cuboid size={17} /></span><span className="project-label"><strong>Untitled World</strong><small>My Projects <span>/</span> Main Scene</small></span><ChevronDown size={14} /></button>
        <div className="menu-links"><button>File</button><button>Edit</button><button>View</button><button>Window</button><button>Help</button></div>
        <div className="topbar-spacer" />
        <button className="command-trigger" onClick={() => setShowPalette(true)}><Search size={14} /><span>Search anything...</span><kbd>⌘ K</kbd></button>
        <div className="save-status"><span className="save-dot" />All changes saved</div>
        <button className="icon-button top-icon" title="Settings" onClick={() => announce("Settings will be added to project preferences")}><Settings2 size={17} /></button>
        <button className="preview-button" onClick={() => announce("Preview settings opened")}><Eye size={15} /> Preview</button>
        <button className={"play-button " + (playing ? "is-playing" : "")} onClick={() => setPlaying((value) => !value)}>{playing ? <Square size={13} fill="currentColor" /> : <Play size={14} fill="currentColor" />}<span>{playing ? "Stop" : "Play"}</span></button>
      </header>

      <nav className="workspace-bar" aria-label="Creative workspaces"><div className="workspace-tabs">{WORKSPACES.map((item) => { const Icon = item.icon; return <button key={item.id} className={"workspace-tab " + (workspace === item.id ? "active" : "")} onClick={() => chooseWorkspace(item.id)} title={item.hint}><Icon size={16} strokeWidth={1.8} /><span>{item.id}</span></button>; })}</div><div className="workspace-bar-right"><span className="workspace-hint">{current.hint}</span><button className="icon-button" title="Workspace settings" onClick={() => announce("Workspace settings")}><SlidersHorizontal size={15} /></button></div></nav>

      <div className="editor-layout">
        <aside className="tool-rail"><div className="rail-tools">{TOOLS.map((tool) => { const Icon = tool.icon; return <button key={tool.id} className={"rail-tool " + (selectedTool === tool.id ? "active" : "")} title={tool.label + " (" + tool.key + ")"} onClick={() => setSelectedTool(tool.id)}><Icon size={18} /><span>{tool.key}</span></button>; })}</div><div className="rail-bottom"><button className="rail-tool" title="Help" onClick={() => announce("Worldsmith help centre")}><CircleHelp size={18} /></button><button className="rail-tool" title="Preferences" onClick={() => announce("Preferences")}><Settings2 size={18} /></button></div></aside>

        {showLeft && <aside className="left-panel" style={{ width: leftWidth, flexBasis: leftWidth }}>
          <div className="panel-heading"><div><span className="eyebrow">WORKSPACE</span><h2>{workspaceTitle[workspace]}</h2></div><button className="subtle-icon" onClick={() => setShowLeft(false)} title="Hide panel"><X size={14} /></button></div>
          <div className="panel-action-row"><button className="subtle-select"><Layers size={13} /> {workspace === "Assets" ? "All assets" : workspace === "UI" ? "HUD_Main" : workspace === "Logic" ? "Player Controller" : workspace === "Animation" ? "Character Rig" : workspace === "Materials" ? "Character Material" : workspace === "Model" ? "Character Mesh" : workspace === "Audio" ? "Main Audio" : "Main Scene"} <ChevronDown size={12} /></button><button className="subtle-icon" title="Add item" onClick={() => setShowAddMenu(true)}><Plus size={15} /></button></div>
          <div className="panel-search"><Search size={13} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={"Filter " + workspace.toLowerCase() + "..."} /><kbd>⌘ F</kbd></div>
          <div className="tree-list">{panelItems.map((item, index) => { const Icon = KIND_ICONS[item.kind] || Box; return <button key={item.label} className={"tree-item " + (selectedObject === item.label ? "selected" : "")} style={{ paddingLeft: 12 + (item.indent || 0) * 15 }} onClick={() => setSelectedObject(item.label)}>{item.indent ? <ChevronRight className="tree-chevron" size={12} /> : <span className="tree-spacer" />}<Icon size={14} className={"tree-kind kind-" + item.kind} /><span>{item.label}</span>{index === 0 && <MoreHorizontal size={14} className="tree-more" />}</button>; })}{panelItems.length === 0 && <div className="empty-filter">No matching items</div>}</div>
          <div className="panel-footer"><span>{panelItems.length} items</span><span>● Synced</span></div>
        </aside>}<div className="resize-handle vertical" onPointerDown={(event) => beginResize("left", event)} title="Resize hierarchy" /><main className="center-workspace">
          <div className="canvas-toolbar"><div className="canvas-breadcrumb"><span>{workspace}</span><ChevronRight size={12} /><strong>{workspace === "Scene" ? "Main Scene" : workspace === "UI" ? "HUD_Main" : workspace === "Assets" ? "All Assets" : workspace === "Logic" ? "Player Controller" : workspace === "Audio" ? "Main Audio" : workspace === "Model" ? "Character_Mesh" : workspace === "Materials" ? "Character Material" : "Walk_Cycle"}</strong><span className="unsaved-mark" /></div>
            <div className="canvas-tool-actions"><button className={"canvas-tool-button " + (selectedTool === "select" ? "active" : "")} onClick={() => setSelectedTool("select")} title="Select"><MousePointer2 size={15} /></button><button className={"canvas-tool-button " + (selectedTool === "move" ? "active" : "")} onClick={() => setSelectedTool("move")} title="Move"><Move size={15} /></button><button className={"canvas-tool-button " + (selectedTool === "rotate" ? "active" : "")} onClick={() => setSelectedTool("rotate")} title="Rotate"><RotateCw size={15} /></button><button className={"canvas-tool-button " + (selectedTool === "scale" ? "active" : "")} onClick={() => setSelectedTool("scale")} title="Scale"><Maximize2 size={15} /></button><span className="toolbar-separator" /><button className="canvas-tool-button" title="Toggle grid" onClick={() => announce("Grid visibility toggled")}><Grid3X3 size={15} /></button><button className="canvas-tool-button" title="Camera view" onClick={() => announce("Camera view options")}><Camera size={15} /></button><button className="canvas-tool-button" title="Viewport options" onClick={() => announce("Viewport options")}><MoreHorizontal size={16} /></button></div>
            <div className="canvas-right-actions"><span className="view-mode">{workspace === "UI" ? "Design" : workspace === "Logic" ? "Graph" : workspace === "Audio" ? "Waveform" : workspace === "Assets" ? "Gallery" : "Perspective"} <ChevronDown size={12} /></span><button className="canvas-tool-button" title="Fit view" onClick={() => setZoom(75)}><Maximize2 size={14} /></button></div>
          </div>

          <section className={"stage-area stage-" + workspace.toLowerCase()}><WorkspaceStage workspace={workspace} />{playing && <div className="playing-banner"><span className="playing-dot" /> LIVE PREVIEW <button onClick={() => setPlaying(false)}>Stop preview</button></div>}{workspace !== "Assets" && <div className="stage-zoom-controls"><button onClick={() => setZoom((value) => Math.max(25, value - 5))}><ZoomOut size={13} /></button><span>{zoom}%</span><button onClick={() => setZoom((value) => Math.min(150, value + 5))}><ZoomIn size={13} /></button></div>}</section>

          {showBottom && <div className="resize-handle horizontal" onPointerDown={(event) => beginResize("bottom", event)} title="Resize bottom panel" />}{showBottom && <section className="bottom-dock" style={{ height: bottomHeight, flexBasis: bottomHeight }}><div className="dock-header"><div className="dock-tabs"><button className={dockTab === "Assets" ? "active" : ""} onClick={() => setDockTab("Assets")}><FolderOpen size={14} /> Assets</button><button className={dockTab === "Timeline" ? "active" : ""} onClick={() => setDockTab("Timeline")}><Clock3 size={14} /> Timeline</button><button className={dockTab === "Console" ? "active" : ""} onClick={() => setDockTab("Console")}><Terminal size={14} /> Console <span className="console-count">2</span></button></div><div className="dock-actions"><button className="subtle-icon" title="Add asset" onClick={() => announce("Asset import will be connected in the asset pipeline milestone")}><Plus size={14} /></button><button className="subtle-icon" title="Collapse bottom panel" onClick={() => setShowBottom(false)}><PanelBottom size={14} /></button></div></div><div className="dock-body"><DockContent tab={dockTab} workspace={workspace} /></div></section>}
          {!showBottom && <button className="reopen-dock" onClick={() => setShowBottom(true)}><PanelBottom size={14} /> Show bottom panel</button>}
        </main>{showRight && <div className="resize-handle vertical" onPointerDown={(event) => beginResize("right", event)} title="Resize inspector" />}{showRight && <aside className="right-panel" style={{ width: rightWidth, flexBasis: rightWidth }}>
          <div className="inspector-top"><div><span className="eyebrow">INSPECTOR</span><h2>{selectedObject}</h2></div><button className="subtle-icon" onClick={() => setShowRight(false)} title="Hide inspector"><X size={14} /></button></div>
          <div className="inspector-object"><div className="object-avatar"><Cuboid size={18} /></div><div><strong>{selectedObject}</strong><small>{workspace === "UI" ? "Canvas element" : workspace === "Logic" ? "Logic node" : workspace === "Materials" ? "Material asset" : workspace === "Animation" ? "Rig element" : "Scene object"} · Active</small></div><button className="subtle-icon"><MoreHorizontal size={15} /></button></div>
          <div className="inspector-tabs"><button className={inspectorTab === "Properties" ? "active" : ""} onClick={() => setInspectorTab("Properties")}>Properties</button><button className={inspectorTab === "Components" ? "active" : ""} onClick={() => setInspectorTab("Components")}>Components <span>3</span></button></div>
          {inspectorTab === "Properties" ? <div className="inspector-scroll">
            <div className="inspector-section"><div className="section-title"><span>Transform</span><button className="subtle-icon"><MoreHorizontal size={14} /></button></div>
              <div className="property-row"><span>Position</span><div className="triple-input"><label><i className="axis-red">X</i><input defaultValue="0.00" /></label><label><i className="axis-green">Y</i><input defaultValue="0.00" /></label><label><i className="axis-blue">Z</i><input defaultValue="0.00" /></label></div></div>
              <div className="property-row"><span>Rotation</span><div className="triple-input"><label><i className="axis-red">X</i><input defaultValue="0°" /></label><label><i className="axis-green">Y</i><input defaultValue="0°" /></label><label><i className="axis-blue">Z</i><input defaultValue="0°" /></label></div></div>
              <div className="property-row"><span>Scale</span><div className="triple-input"><label><i className="axis-red">X</i><input defaultValue="1.00" /></label><label><i className="axis-green">Y</i><input defaultValue="1.00" /></label><label><i className="axis-blue">Z</i><input defaultValue="1.00" /></label></div></div>
            </div>
            <div className="inspector-section"><div className="section-title"><span>{workspace === "UI" ? "Layout" : workspace === "Materials" ? "Surface" : workspace === "Animation" ? "Playback" : workspace === "Logic" ? "Node settings" : "Object settings"}</span><button className="subtle-icon"><MoreHorizontal size={14} /></button></div>
              <div className="property-row"><span>{workspace === "UI" ? "Anchor preset" : workspace === "Materials" ? "Shading model" : workspace === "Animation" ? "Frame rate" : workspace === "Logic" ? "Execution" : "Visibility"}</span><button className="value-select">{workspace === "UI" ? "Center" : workspace === "Materials" ? "Lit / PBR" : workspace === "Animation" ? "30 FPS" : workspace === "Logic" ? "On event" : "Visible"} <ChevronDown size={12} /></button></div>
              <div className="property-row"><span>{workspace === "UI" ? "Width" : workspace === "Materials" ? "Roughness" : workspace === "Animation" ? "Duration" : workspace === "Logic" ? "Enabled" : "Layer"}</span><div className="value-control">{workspace === "UI" ? "420 px" : workspace === "Materials" ? "0.68" : workspace === "Animation" ? "1.20 s" : workspace === "Logic" ? "True" : "Default"}</div></div>
            </div>
            <div className="inspector-section"><div className="section-title"><span>Tags</span><button className="subtle-icon"><Plus size={13} /></button></div><div className="tag-row"><span>Environment</span><span>Editable</span></div></div>
            <button className="add-component-button" onClick={() => setInspectorTab("Components")}><Plus size={14} /> Add component</button>
          </div> : <div className="components-list"><div className="component-card"><div><Cuboid size={15} /><strong>Transform</strong></div><small>Position, rotation and scale</small></div><div className="component-card"><div><Activity size={15} /><strong>{workspace === "UI" ? "UI Renderer" : "Renderer"}</strong></div><small>Visual appearance and display</small></div><div className="component-card"><div><Settings2 size={15} /><strong>{workspace === "Logic" ? "Event Listener" : "Metadata"}</strong></div><small>Configuration and editor data</small></div><button className="add-component-button" onClick={() => announce("Component picker will be connected to the engine core")}><Plus size={14} /> Add component</button></div>}
          <div className="inspector-footer"><span><span className="tiny-dot" /> Changes are local</span><button onClick={() => announce("Inspector options")}><MoreHorizontal size={14} /></button></div>
        </aside>}
      </div>

      {(!showLeft || !showRight) && <div className="panel-restore">{!showLeft && <button onClick={() => setShowLeft(true)}><Layers size={14} /> Show hierarchy</button>}{!showRight && <button onClick={() => setShowRight(true)}><SlidersHorizontal size={14} /> Show inspector</button>}</div>}
      <footer className="statusbar"><div className="status-left"><span className="status-branch"><span className="tiny-dot" /> Main</span><span className="status-separator" /><span>Worldsmith Shell Preview</span></div><div className="status-right"><span>Local project</span><span className="status-separator" /><span>Web editor</span><span className="status-separator" /><span>100% UI scale</span></div></footer>

      {showAddMenu && <div className="popover-backdrop" onClick={() => setShowAddMenu(false)}><div className="add-menu popover-card" onClick={(event) => event.stopPropagation()}><div className="popover-title">Add to {workspace}<button onClick={() => setShowAddMenu(false)}><X size={14} /></button></div><button onClick={() => { setSelectedObject("Cube"); setShowAddMenu(false); announce("Cube added to the scene outline"); }}><Box size={15} /><span><strong>Cube</strong><small>Basic 3D primitive</small></span></button><button onClick={() => { setSelectedObject("Sphere"); setShowAddMenu(false); announce("Sphere added to the scene outline"); }}><Orbit size={15} /><span><strong>Sphere</strong><small>Basic 3D primitive</small></span></button><button onClick={() => { setSelectedObject("Camera"); setShowAddMenu(false); announce("Camera added to the scene outline"); }}><Camera size={15} /><span><strong>Camera</strong><small>Scene camera</small></span></button><button onClick={() => { setSelectedObject("Light"); setShowAddMenu(false); announce("Light added to the scene outline"); }}><Lightbulb size={15} /><span><strong>Light</strong><small>Illuminate your scene</small></span></button><div className="popover-foot">More creation tools will appear here as they are implemented.</div></div></div>}

      {showPalette && <div className="palette-backdrop" onClick={() => setShowPalette(false)}><div className="command-palette" onClick={(event) => event.stopPropagation()}><div className="palette-search"><Search size={17} /><input autoFocus value={paletteQuery} onChange={(event) => setPaletteQuery(event.target.value)} placeholder="Search actions, workspaces and tools..." /><kbd>ESC</kbd></div><div className="palette-caption">SUGGESTED ACTIONS</div><div className="palette-results">{commands.map((command) => <button key={command} onClick={() => runCommand(command)}><Command size={14} /><span>{command}</span><ChevronRight size={13} /></button>)}{commands.length === 0 && <div className="empty-filter">No matching commands</div>}</div><div className="palette-foot"><span>↑↓ Navigate</span><span>↵ Select</span><span>Esc Close</span></div></div></div>}
      {notice && <div className="toast"><Check size={15} />{notice}</div>}
    </div>
  );
}

export default App;
