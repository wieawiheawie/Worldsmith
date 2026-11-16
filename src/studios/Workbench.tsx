import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction, PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import {
  Activity, ArrowDown, ArrowUp, Box, Brush, Camera, Check, Circle, Code2,
  Copy, Cuboid, Eye, Film, Grid3X3, Image, Layers, Link2, Music2, Paintbrush,
  Pause, Play, Plus, RotateCcw, RotateCw, Save, Scissors, Settings2, Square,
  Trash2, Type, Upload, X, ZoomIn, ZoomOut
} from "lucide-react";
import "./workbench.css";

export type WorkbenchWorkspace = "Scene" | "Model" | "Materials" | "Animation" | "UI" | "Logic" | "Audio";
type Vec3 = [number, number, number];
type ObjectKind = "Cube" | "Sphere" | "Cylinder" | "Plane" | "Torus";
type SceneObject = { id: string; name: string; kind: ObjectKind; position: Vec3; rotation: Vec3; scale: Vec3; color: string; segments: number };
type Keyframe = { id: string; time: number; x: number; y: number; rotation: number; scale: number };
type UIElement = { id: string; name: string; kind: "Text" | "Button" | "Panel" | "Image" | "Bar"; text: string; x: number; y: number; w: number; h: number; color: string; textColor: string; fontSize: number; imageData?: string };
type LogicNode = { id: string; kind: "Event" | "Input" | "Math" | "Branch" | "Set" | "Print"; title: string; x: number; y: number };
type LogicLink = { id: string; from: string; to: string };
type MaterialPrefs = {
  materialColor: string;
  roughness: number;
  metalness: number;
  flatShading: boolean;
  brushColor: string;
  brushSize: number;
};
const DEFAULT_MATERIAL_PREFS: MaterialPrefs = {
  materialColor: "#a2b9a8", roughness: 0.62, metalness: 0.12,
  flatShading: true, brushColor: "#d7a46f", brushSize: 14
};
type SceneTreeItem = { label: string; kind: string };
type WorkbenchCommand = { id: string; type: "delete" | "duplicate" | "move"; names: string[]; direction?: -1 | 1 };
const STORAGE = "worldsmith-studio-workbench-v1";
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "ws-" + Date.now() + "-" + Math.random().toString(16).slice(2));
const initialObjects: SceneObject[] = [
  { id: "ground", name: "Ground", kind: "Plane", position: [0, -0.53, 0], rotation: [0, 0, 0], scale: [7, 1, 7], color: "#526c57", segments: 2 },
  { id: "cube", name: "Cube", kind: "Cube", position: [-0.8, 0.05, 0], rotation: [0, 0.18, 0], scale: [1, 1, 1], color: "#c18d67", segments: 3 },
  { id: "sphere", name: "Sphere", kind: "Sphere", position: [0.8, 0.05, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: "#6faaa1", segments: 4 },
  { id: "cylinder", name: "Cylinder", kind: "Cylinder", position: [0, 0.05, 1.35], rotation: [0, 0, 0], scale: [1, 1, 1], color: "#8b9fc0", segments: 4 }
];
const initialUI: UIElement[] = [
  { id: "hud-title", name: "Title", kind: "Text", text: "THE WILDS", x: 6, y: 7, w: 28, h: 9, color: "transparent", textColor: "#f1eee1", fontSize: 26 },
  { id: "health-panel", name: "Player status", kind: "Panel", text: "ADVENTURER  ·  LEVEL 08", x: 5, y: 72, w: 28, h: 19, color: "#25332f", textColor: "#f0ead8", fontSize: 14 },
  { id: "health-bar", name: "Health bar", kind: "Bar", text: "HEALTH", x: 7, y: 80, w: 23, h: 3, color: "#d77a68", textColor: "#fff", fontSize: 10 },
  { id: "quest", name: "Quest panel", kind: "Panel", text: "Find the old outpost", x: 70, y: 10, w: 25, h: 18, color: "#263b3b", textColor: "#e8e6d7", fontSize: 15 },
  { id: "inventory", name: "Inventory button", kind: "Button", text: "INVENTORY  [ I ]", x: 76, y: 84, w: 19, h: 9, color: "#aa8d5e", textColor: "#1d2725", fontSize: 12 }
];
const initialKeys: Keyframe[] = [
  { id: "key-a", time: 0, x: 14, y: 0, rotation: -4, scale: 1 },
  { id: "key-b", time: 2.5, x: 70, y: -12, rotation: 8, scale: 1.08 },
  { id: "key-c", time: 5, x: 14, y: 0, rotation: -4, scale: 1 }
];
const initialNodes: LogicNode[] = [
  { id: "event-1", kind: "Event", title: "On Start", x: 4, y: 12 },
  { id: "set-1", kind: "Set", title: "Set score = 10", x: 38, y: 28 },
  { id: "print-1", kind: "Print", title: "Print score", x: 72, y: 47 }
];
const initialLinks: LogicLink[] = [
  { id: "link-1", from: "event-1", to: "set-1" },
  { id: "link-2", from: "set-1", to: "print-1" }
];
function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(STORAGE);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return (parsed[key] as T) ?? fallback;
  } catch { return fallback; }
}
function makeObject(kind: ObjectKind, index: number): SceneObject {
  const id = uid();
  return {
    id, name: kind + " " + index, kind,
    position: [((index % 4) - 1.5) * 0.85, 0.1, Math.floor(index / 4) * 0.85],
    rotation: [0, 0, 0], scale: [1, 1, 1],
    color: ["#c18d67", "#6faaa1", "#8b9fc0", "#b5a26b"][index % 4], segments: 4
  };
}

export default function CreativeWorkbench({ workspace, onStatus, selectedObjectName, onSelectionChange, onSceneObjectsChange, workbenchCommand, onWorkbenchCommandApplied }: {
  workspace: WorkbenchWorkspace;
  onStatus?: (message: string) => void;
  selectedObjectName?: string;
  onSelectionChange?: (name: string) => void;
  onSceneObjectsChange?: (items: SceneTreeItem[]) => void;
  workbenchCommand?: WorkbenchCommand | null;
  onWorkbenchCommandApplied?: (id: string) => void;
}) {
  const [objects, setObjects] = useState<SceneObject[]>(() => readStored("objects", initialObjects));
  const [uiElements, setUIElements] = useState<UIElement[]>(() => readStored("uiElements", initialUI));
  const [keyframes, setKeyframes] = useState<Keyframe[]>(() => readStored("keyframes", initialKeys));
  const [logicNodes, setLogicNodes] = useState<LogicNode[]>(() => readStored("logicNodes", initialNodes));
  const [logicLinks, setLogicLinks] = useState<LogicLink[]>(() => readStored("logicLinks", initialLinks));
  const [materialPrefs, setMaterialPrefs] = useState<MaterialPrefs>(() => readStored("materialPrefs", DEFAULT_MATERIAL_PREFS));
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE, JSON.stringify({ objects, uiElements, keyframes, logicNodes, logicLinks, materialPrefs })); }
    catch { onStatus?.("The browser could not save the complete project data"); }
  }, [objects, uiElements, keyframes, logicNodes, logicLinks, materialPrefs, onStatus]);
  useEffect(() => {
    onSceneObjectsChange?.(objects.map(item => ({ label: item.name, kind: item.kind === "Plane" ? "terrain" : "model" })));
  }, [objects, onSceneObjectsChange]);
  useEffect(() => {
    if (!workbenchCommand || !(workspace === "Scene" || workspace === "Model")) return;
    const selected = new Set(workbenchCommand.names);
    if (workbenchCommand.type === "delete") {
      setObjects(current => current.filter(item => item.id === "ground" || !selected.has(item.name)));
    } else if (workbenchCommand.type === "duplicate") {
      const source = objects.filter(item => selected.has(item.name));
      const names = new Set(objects.map(item => item.name));
      const copies = source.map(item => {
        let name = item.name + " Copy";
        let suffix = 2;
        while (names.has(name)) name = item.name + " Copy " + suffix++;
        names.add(name);
        return { ...item, id: uid(), name, position: [item.position[0] + 1.1, item.position[1], item.position[2] + 0.45] as Vec3 };
      });
      if (copies.length) setObjects(current => [...current, ...copies]);
    } else if (workbenchCommand.type === "move") {
      setObjects(current => {
        const next = [...current];
        let moved = false;
        if ((workbenchCommand.direction ?? 1) < 0) {
          for (let i = 1; i < next.length; i++) {
            if (selected.has(next[i].name) && !selected.has(next[i - 1].name)) {
              [next[i - 1], next[i]] = [next[i], next[i - 1]];
              moved = true;
            }
          }
        } else {
          for (let i = next.length - 2; i >= 0; i--) {
            if (selected.has(next[i].name) && !selected.has(next[i + 1].name)) {
              [next[i], next[i + 1]] = [next[i + 1], next[i]];
              moved = true;
            }
          }
        }
        return moved ? next : current;
      });
    }
    onWorkbenchCommandApplied?.(workbenchCommand.id);
  }, [workbenchCommand, workspace, objects, setObjects, onWorkbenchCommandApplied]);

  if (workspace === "Scene" || workspace === "Model" || workspace === "Materials") {
    return <ThreeStudio workspace={workspace} objects={objects} setObjects={setObjects} materialPrefs={materialPrefs} setMaterialPrefs={setMaterialPrefs} selectedObjectName={selectedObjectName} onSelectionChange={onSelectionChange} onStatus={onStatus} />;
  }
  if (workspace === "Animation") return <AnimationStudio keyframes={keyframes} setKeyframes={setKeyframes} onStatus={onStatus} />;
  if (workspace === "UI") return <UIStudio elements={uiElements} setElements={setUIElements} onStatus={onStatus} />;
  if (workspace === "Logic") return <LogicStudio nodes={logicNodes} setNodes={setLogicNodes} links={logicLinks} setLinks={setLogicLinks} onStatus={onStatus} />;
  return <AudioStudio onStatus={onStatus} />;
}

function ThreeStudio({ workspace, objects, setObjects, materialPrefs, setMaterialPrefs, selectedObjectName, onSelectionChange, onStatus }: {
  workspace: "Scene" | "Model" | "Materials";
  objects: SceneObject[];
  setObjects: Dispatch<SetStateAction<SceneObject[]>>;
  materialPrefs: MaterialPrefs;
  setMaterialPrefs: Dispatch<SetStateAction<MaterialPrefs>>;
  selectedObjectName?: string;
  onSelectionChange?: (name: string) => void;
  onStatus?: (message: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const paintCanvasRef = useRef<HTMLCanvasElement>(null);
  const paintTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const meshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const transformRef = useRef<TransformControls | null>(null);
  const orbitRef = useRef<OrbitControls | null>(null);
  const [selectedId, setSelectedId] = useState("cube");
  const [tool, setTool] = useState<"translate" | "rotate" | "scale">("translate");
  const { brushColor, brushSize, materialColor, roughness, metalness, flatShading } = materialPrefs;
  const updateMaterialPrefs = (patch: Partial<MaterialPrefs>) => setMaterialPrefs(current => ({ ...current, ...patch }));
  const [gridVisible, setGridVisible] = useState(true);
  const [painted, setPainted] = useState(false);
  const [notice, setNotice] = useState("Drag to orbit · Scroll to zoom · Select a mesh to edit");
  const [cameraPreset, setCameraPreset] = useState("Perspective");
  const paintDown = useRef(false);
  const lastPaint = useRef<{x:number;y:number}|null>(null);
  const selectedObject = objects.find(item => item.id === selectedId) ?? objects[0];
  useEffect(() => {
    const match = objects.find(item => item.name === selectedObjectName);
    if (match && match.id !== selectedId) setSelectedId(match.id);
  }, [selectedObjectName, objects, selectedId]);
  useEffect(() => {
    if (selectedObject) onSelectionChange?.(selectedObject.name);
  }, [selectedObject?.id, selectedObject?.name, onSelectionChange]);

  useEffect(() => {
    const canvas = paintCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#b9b4a2";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(48,61,52,.14)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 32) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
    for (let y = 0; y <= canvas.height; y += 32) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const savedTexture = window.localStorage.getItem(STORAGE + "-paint");
    if (savedTexture) {
      const image = new window.Image();
      image.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        texture.needsUpdate = true;
        setPainted(true);
      };
      image.src = savedTexture;
    }
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    paintTextureRef.current = texture;
    return () => { texture.dispose(); paintTextureRef.current = null; };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let frame = 0;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#19242c");
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    camera.position.set(5.2, 4.4, 7.2);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.target.set(0, 0.2, 0);
    orbit.update();
    const hemi = new THREE.HemisphereLight(0xc9d9e1, 0x354338, 2.1);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffe2bd, 2.8);
    key.position.set(4, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024,1024);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x86b9cf, 1.1);
    fill.position.set(-5,3,-4);
    scene.add(fill);
    const grid = new THREE.GridHelper(16, 32, 0x657f82, 0x35454b);
    grid.position.y = -0.525;
    scene.add(grid);
    const group = new THREE.Group();
    scene.add(group);
    const transform = new TransformControls(camera, renderer.domElement);
    scene.add(transform.getHelper());
    transform.addEventListener("dragging-changed", () => { orbit.enabled = !transform.dragging; });
    transform.addEventListener("mouseUp", () => {
      const object = transform.object as THREE.Mesh | undefined;
      if (!object) return;
      const id = String(object.userData.objectId ?? "");
      setObjects(current => current.map(item => item.id === id ? {
        ...item,
        position: [object.position.x,object.position.y,object.position.z],
        rotation: [object.rotation.x,object.rotation.y,object.rotation.z],
        scale: [object.scale.x,object.scale.y,object.scale.z]
      } : item));
    });
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointerDown = (event: PointerEvent) => {
      if (transform.dragging || !renderer.domElement) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(Array.from(meshGroupRef.current?.children ?? []) as THREE.Object3D[], false);
      const hit = hits.find(item => item.object.userData.objectId);
      if (hit) setSelectedId(String(hit.object.userData.objectId));
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width,height,false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const render = () => {
      frame = requestAnimationFrame(render);
      orbit.update();
      renderer.render(scene,camera);
    };
    render();
    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    meshGroupRef.current = group;
    transformRef.current = transform;
    orbitRef.current = orbit;
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      transform.detach();
      transform.dispose();
      orbit.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
      meshMapRef.current.clear();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      meshGroupRef.current = null;
      transformRef.current = null;
      orbitRef.current = null;
    };
  }, [setObjects]);

  useEffect(() => {
    const group = meshGroupRef.current;
    const transform = transformRef.current;
    if (!group || !transform) return;
    transform.detach();
    for (const child of [...group.children]) {
      group.remove(child);
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach(item => item.dispose());
      else material?.dispose();
    }
    const nextMap = new Map<string, THREE.Mesh>();
    objects.forEach(item => {
      const segments = Math.max(1, Math.min(32, item.segments || 2));
      let geometry: THREE.BufferGeometry;
      if (item.kind === "Sphere") geometry = new THREE.SphereGeometry(0.55, Math.max(8,segments*8), Math.max(6,segments*5));
      else if (item.kind === "Cylinder") geometry = new THREE.CylinderGeometry(0.48,0.48,1,Math.max(6,segments*6),segments);
      else if (item.kind === "Plane") geometry = new THREE.PlaneGeometry(1,1,segments,segments);
      else if (item.kind === "Torus") geometry = new THREE.TorusGeometry(0.42,0.16,Math.max(4,segments*2),Math.max(12,segments*8));
      else geometry = new THREE.BoxGeometry(1,1,1,segments,segments,segments);
      if (item.kind === "Plane") geometry.rotateX(-Math.PI/2);
      const isGround = item.id === "ground";
      const material = new THREE.MeshStandardMaterial({
        color: workspace === "Materials" && item.id === selectedId ? materialColor : item.color,
        roughness, metalness, flatShading: workspace === "Model" && flatShading,
        map: paintTextureRef.current,
        side: isGround ? THREE.DoubleSide : THREE.FrontSide
      });
      const mesh = new THREE.Mesh(geometry,material);
      mesh.name = item.name;
      mesh.userData.objectId = item.id;
      mesh.position.set(...item.position);
      mesh.rotation.set(...item.rotation);
      mesh.scale.set(...item.scale);
      mesh.castShadow = !isGround;
      mesh.receiveShadow = true;
      group.add(mesh);
      nextMap.set(item.id,mesh);
    });
    meshMapRef.current = nextMap;
    const selected = nextMap.get(selectedId);
    if (selected && selected.userData.objectId !== "ground") transform.attach(selected);
    transform.setMode(tool);
    transform.enabled = workspace !== "Materials";
  }, [objects, selectedId, workspace, tool, roughness, metalness, materialColor, flatShading]);

  useEffect(() => {
    const grid = sceneRef.current?.children.find(child => child instanceof THREE.GridHelper) as THREE.GridHelper | undefined;
    if (grid) grid.visible = gridVisible;
  }, [gridVisible]);

  const addObject = (kind: ObjectKind) => {
    const next = makeObject(kind, objects.length + 1);
    setObjects(current => [...current,next]);
    setSelectedId(next.id);
    onStatus?.(next.name + " created");
  };
  const deleteObject = () => {
    if (!selectedObject || selectedObject.id === "ground") { setNotice("Select a mesh (not the ground) to delete"); return; }
    setObjects(current => current.filter(item => item.id !== selectedObject.id));
    setSelectedId(objects.find(item => item.id !== selectedObject.id && item.id !== "ground")?.id ?? "ground");
  };
  const updateSelected = (patch: Partial<SceneObject>) => {
    if (!selectedObject) return;
    setObjects(current => current.map(item => item.id === selectedObject.id ? { ...item, ...patch } : item));
  };
  const cameraPresetAction = () => {
    const camera = cameraRef.current;
    const orbit = orbitRef.current;
    if (!camera || !orbit) return;
    const presets: Record<string, [number,number,number]> = {
      Perspective: [5.2,4.4,7.2], Top: [0,10,0.01], Front: [0,2,10], Right: [10,2,0]
    };
    const next = cameraPreset === "Perspective" ? "Top" : cameraPreset === "Top" ? "Front" : cameraPreset === "Front" ? "Right" : "Perspective";
    setCameraPreset(next);
    camera.position.set(...presets[next]);
    orbit.target.set(0,0,0);
    orbit.update();
  };
  const paintAt = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = paintCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const point = { x: (event.clientX-rect.left) * canvas.width/rect.width, y: (event.clientY-rect.top) * canvas.height/rect.height };
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = brushColor; ctx.fillStyle = brushColor; ctx.lineWidth = brushSize;
    if (lastPaint.current) {
      ctx.beginPath(); ctx.moveTo(lastPaint.current.x,lastPaint.current.y); ctx.lineTo(point.x,point.y); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(point.x,point.y,brushSize/2,0,Math.PI*2); ctx.fill();
    }
    lastPaint.current = point;
    if (paintTextureRef.current) paintTextureRef.current.needsUpdate = true;
    setPainted(true);
  };
  const tools = [
    { id: "translate" as const, label: "Move", icon: ArrowDown },
    { id: "rotate" as const, label: "Rotate", icon: RotateCw },
    { id: "scale" as const, label: "Scale", icon: ZoomIn }
  ];

  return <div className={"wb-studio wb-three-studio wb-" + workspace.toLowerCase()}>
    <div className="wb-toolbar">
      <div className="wb-toolbar-group"><span className="wb-section-name">{workspace === "Scene" ? "3D Scene" : workspace === "Model" ? "Mesh Workshop" : "Material Lab"}</span>
        {workspace !== "Materials" && <>
          <button onClick={() => addObject("Cube")}><Box size={14}/> Cube</button>
          <button onClick={() => addObject("Sphere")}><Circle size={14}/> Sphere</button>
          <button onClick={() => addObject("Cylinder")}><Cuboid size={14}/> Cylinder</button>
          {workspace === "Model" && <button onClick={() => addObject("Torus")}><Plus size={14}/> Torus</button>}
          <button className="wb-danger-quiet" onClick={deleteObject} disabled={!selectedObject || selectedObject.id === "ground"}><Trash2 size={14}/> Delete</button>
        </>}
      </div>
      <div className="wb-toolbar-group">
        {workspace !== "Materials" ? tools.map(item => <button key={item.id} className={tool === item.id ? "active" : ""} title={item.label} onClick={() => setTool(item.id)}>{item.icon === ArrowDown ? <ArrowDown size={14}/> : item.icon === RotateCw ? <RotateCw size={14}/> : <ZoomIn size={14}/>}</button>) : <><span className="wb-muted">Select a mesh to preview its surface</span></>}
        <button className={gridVisible ? "active" : ""} title="Toggle grid" onClick={() => setGridVisible(value => !value)}><Grid3X3 size={14}/></button>
        <button title={"Camera: " + cameraPreset} onClick={cameraPresetAction}><Camera size={14}/>{cameraPreset}</button>
      </div>
    </div>
    <div className={"wb-three-body " + (workspace === "Materials" ? "has-side-editor" : "")}>
      <div className="wb-viewport-wrap">
        <div className="wb-viewport" ref={hostRef}/>
        <div className="wb-viewport-hint"><span className="wb-live-dot"/> REAL-TIME WEBGL VIEWPORT <span>·</span> {workspace === "Model" ? "MESH EDIT" : workspace === "Materials" ? "MATERIAL PREVIEW" : "SCENE EDIT"}</div>
        {workspace !== "Materials" && <div className="wb-object-strip">{objects.map(item => <button key={item.id} className={selectedId === item.id ? "active" : ""} onClick={() => setSelectedId(item.id)}>{item.name}</button>)}</div>}
        {workspace === "Model" && selectedObject && selectedObject.id !== "ground" && <div className="wb-mesh-panel"><span>SUBDIVISION</span><input type="range" min="1" max="12" value={selectedObject.segments} onChange={event => updateSelected({segments:Number(event.target.value)})}/><strong>{selectedObject.segments}</strong><button onClick={() => updateMaterialPrefs({flatShading:!flatShading})} className={flatShading ? "active" : ""}>Flat shading</button></div>}
        {notice && <div className="wb-view-notice">{notice}</div>}
      </div>
      {workspace === "Materials" && <aside className="wb-material-editor">
        <div className="wb-side-heading"><div><span>01 / SURFACE</span><strong>Material properties</strong></div><Paintbrush size={17}/></div>
        <label className="wb-field"><span>Base colour</span><div className="wb-color-field"><input type="color" value={materialColor} onChange={event => updateMaterialPrefs({materialColor:event.target.value})}/><code>{materialColor.toUpperCase()}</code></div></label>
        <label className="wb-field"><span>Roughness <b>{roughness.toFixed(2)}</b></span><input type="range" min="0" max="1" step="0.01" value={roughness} onChange={event => updateMaterialPrefs({roughness:Number(event.target.value)})}/></label>
        <label className="wb-field"><span>Metalness <b>{metalness.toFixed(2)}</b></span><input type="range" min="0" max="1" step="0.01" value={metalness} onChange={event => updateMaterialPrefs({metalness:Number(event.target.value)})}/></label>
        <div className="wb-divider"/>
        <div className="wb-side-heading"><div><span>02 / TEXTURE PAINT</span><strong>Paint canvas</strong></div><Brush size={17}/></div>
        <div className="wb-paint-tools"><label><span>Brush</span><input type="color" value={brushColor} onChange={event => updateMaterialPrefs({brushColor:event.target.value})}/></label><label><span>Size</span><input type="range" min="2" max="64" value={brushSize} onChange={event => updateMaterialPrefs({brushSize:Number(event.target.value)})}/></label><button onClick={() => { const c=paintCanvasRef.current; const ctx=c?.getContext("2d"); if(c&&ctx){ctx.fillStyle="#b9b4a2";ctx.fillRect(0,0,c.width,c.height);paintTextureRef.current!.needsUpdate=true;window.localStorage.removeItem(STORAGE + "-paint");setPainted(false);} }}><RotateCcw size={13}/> Clear</button></div>
        <canvas ref={paintCanvasRef} width={512} height={512} className="wb-paint-canvas" onPointerDown={event => { paintDown.current=true; lastPaint.current=null; event.currentTarget.setPointerCapture(event.pointerId); paintAt(event); }} onPointerMove={event => { if(paintDown.current)paintAt(event); }} onPointerUp={() => { paintDown.current=false;lastPaint.current=null;try { const data=paintCanvasRef.current?.toDataURL("image/png"); if(data) window.localStorage.setItem(STORAGE + "-paint",data); } catch { onStatus?.("Paint was applied but could not be saved in browser storage"); } }} onPointerCancel={() => { paintDown.current=false;lastPaint.current=null; }}/>
        <p className="wb-help-copy">{painted ? "Paint strokes are applied to the live material preview." : "Paint directly onto the texture. Strokes update the 3D material preview."}</p>
      </aside>}
    </div>
    <div className="wb-status-row"><span><span className="wb-live-dot"/> {objects.length} objects in project</span><span>{selectedObject ? "Selected: " + selectedObject.name : "No mesh selected"}</span><span>{workspace === "Model" ? "Editable primitive geometry" : workspace === "Materials" ? "PBR + canvas texture" : "Orbit · pan · zoom · transform gizmo"}</span></div>
  </div>;
}

function AnimationStudio({ keyframes, setKeyframes, onStatus }: { keyframes: Keyframe[]; setKeyframes: Dispatch<SetStateAction<Keyframe[]>>; onStatus?: (message:string)=>void }) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [track, setTrack] = useState<"Position"|"Rotation"|"Scale">("Position");
  const sorted = [...keyframes].sort((a,b)=>a.time-b.time);
  const sample = useMemo(() => {
    if(sorted.length===0)return {x:14,y:0,rotation:0,scale:1};
    const before=[...sorted].reverse().find(key=>key.time<=time) ?? sorted[0];
    const after=sorted.find(key=>key.time>=time) ?? sorted[sorted.length-1];
    const span=Math.max(0.0001,after.time-before.time);
    const t=THREE.MathUtils.clamp((time-before.time)/span,0,1);
    return {x:THREE.MathUtils.lerp(before.x,after.x,t),y:THREE.MathUtils.lerp(before.y,after.y,t),rotation:THREE.MathUtils.lerp(before.rotation,after.rotation,t),scale:THREE.MathUtils.lerp(before.scale,after.scale,t)};
  },[keyframes,time]);
  useEffect(() => {
    if(!playing)return;
    const timer=window.setInterval(()=>setTime(value=>{if(value>=5){setPlaying(false);return 0;}return Math.min(5,value+0.04);}),40);
    return ()=>window.clearInterval(timer);
  },[playing]);
  const addKey = () => {
    setKeyframes(current=>[...current.filter(key=>Math.abs(key.time-time)>0.025),{id:uid(),time:Number(time.toFixed(2)),...sample}]);
    onStatus?.("Keyframe recorded at "+time.toFixed(2)+" seconds");
  };
  const deleteKey = (id:string) => setKeyframes(current=>current.filter(key=>key.id!==id));
  return <div className="wb-studio wb-animation-studio">
    <div className="wb-toolbar"><div className="wb-toolbar-group"><span className="wb-section-name">Animation timeline</span><button onClick={()=>{setTime(0);setPlaying(false);}}><RotateCcw size={14}/> Rewind</button><button className="wb-primary" onClick={()=>setPlaying(v=>!v)}>{playing?<Pause size={14}/>:<Play size={14}/>} {playing?"Pause":"Play"}</button></div><div className="wb-toolbar-group"><label className="wb-time-readout">TIME <input type="number" min="0" max="5" step="0.05" value={time.toFixed(2)} onChange={event=>setTime(THREE.MathUtils.clamp(Number(event.target.value)||0,0,5))}/> s</label><button onClick={addKey}><Plus size={14}/> Add keyframe</button></div></div>
    <div className="wb-animation-stage"><div className="wb-stage-caption">PREVIEW STAGE <span>·</span> 5 SECOND CLIP</div><div className="wb-animation-floor"/><div className="wb-animation-actor" style={{left:sample.x+"%",top:(50+sample.y)+"%",transform:"translate(-50%,-50%) rotate("+sample.rotation+"deg) scale("+sample.scale+")"}}><div className="wb-actor-head"/><div className="wb-actor-body"/><div className="wb-actor-leg left"/><div className="wb-actor-leg right"/></div><div className="wb-stage-time">{time.toFixed(2)}s</div></div>
    <div className="wb-timeline-panel"><div className="wb-track-tabs">{(["Position","Rotation","Scale"] as const).map(item=><button key={item} className={track===item?"active":""} onClick={()=>setTrack(item)}>{item}</button>)}</div><div className="wb-ruler">{Array.from({length:6},(_,i)=><span key={i}>{i.toFixed(1)}s</span>)}</div><div className="wb-track-lane"><span>{track}</span><div className="wb-track-line"><div className="wb-playhead" style={{left:(time/5*100)+"%"}}/>{sorted.map(key=><button key={key.id} className="wb-key-diamond" style={{left:(key.time/5*100)+"%"}} title={"Keyframe at "+key.time.toFixed(2)+"s"} onClick={()=>setTime(key.time)}/>)}</div></div><div className="wb-key-list">{sorted.map(key=><div key={key.id}><button onClick={()=>setTime(key.time)}>{key.time.toFixed(2)}s</button><span>X {key.x.toFixed(0)}% · R {key.rotation.toFixed(0)}° · S {key.scale.toFixed(2)}</span><button title="Delete keyframe" onClick={()=>deleteKey(key.id)}><X size={12}/></button></div>)}</div></div>
    <div className="wb-status-row"><span>{keyframes.length} keyframes</span><span>Linear interpolation · Position / rotation / scale</span><span>Scrub the time control or press Play to preview</span></div>
  </div>;
}

function UIStudio({ elements, setElements, onStatus }: { elements:UIElement[];setElements:Dispatch<SetStateAction<UIElement[]>>;onStatus?:(message:string)=>void }) {
  const [selectedId,setSelectedId]=useState("hud-title");
  const boardRef=useRef<HTMLDivElement>(null);
  const drag=useRef<{id:string;dx:number;dy:number}|null>(null);
  const selected=elements.find(item=>item.id===selectedId)??elements[0];
  const add = (kind:UIElement["kind"]) => {
    const names:Record<UIElement["kind"],string>={Text:"Text",Button:"Button",Panel:"Panel",Image:"Image",Bar:"Progress bar"};
    const item:UIElement={id:uid(),name:names[kind],kind,text:kind==="Button"?"Click me":kind==="Bar"?"HEALTH":kind==="Image"?"Image placeholder":kind==="Panel"?"New panel":"New text",x:35+Math.random()*12,y:35+Math.random()*12,w:kind==="Text"?25:kind==="Bar"?24:20,h:kind==="Text"?10:kind==="Bar"?4:10,color:kind==="Button"?"#ad8f5d":"#293d3b",textColor:"#f5f0df",fontSize:14};
    setElements(current=>[...current,item]);setSelectedId(item.id);onStatus?.(item.name+" added to UI canvas");
  };
  const update=(patch:Partial<UIElement>)=>{if(selected)setElements(current=>current.map(item=>item.id===selected.id?{...item,...patch}:item));};
  const onBoardMove=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(!drag.current||!boardRef.current)return;
    const rect=boardRef.current.getBoundingClientRect();
    const x=(event.clientX-rect.left-drag.current.dx)/rect.width*100;
    const y=(event.clientY-rect.top-drag.current.dy)/rect.height*100;
    setElements(current=>current.map(item=>item.id===drag.current?.id?{...item,x:THREE.MathUtils.clamp(x,0,100-item.w),y:THREE.MathUtils.clamp(y,0,100-item.h)}:item));
  };
  return <div className="wb-studio wb-ui-studio">
    <div className="wb-toolbar"><div className="wb-toolbar-group"><span className="wb-section-name">Interface canvas</span><button onClick={()=>add("Text")}><Type size={14}/> Text</button><button onClick={()=>add("Button")}><Plus size={14}/> Button</button><button onClick={()=>add("Panel")}><Layers size={14}/> Panel</button><button onClick={()=>add("Image")}><Image size={14}/> Image</button><button onClick={()=>add("Bar")}><Activity size={14}/> Bar</button></div><div className="wb-toolbar-group"><button className="wb-danger-quiet" onClick={()=>{if(selected){setElements(current=>current.filter(item=>item.id!==selected.id));setSelectedId(elements.find(item=>item.id!==selected.id)?.id??"");}}} disabled={!selected}><Trash2 size={14}/> Delete</button></div></div>
    <div className="wb-ui-body"><div className="wb-ui-board-wrap"><div className="wb-ui-board" ref={boardRef} onPointerMove={onBoardMove} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null}>
      <div className="wb-ui-safe-area"/>
      {elements.map(item=><div key={item.id} className={"wb-ui-element wb-ui-"+item.kind.toLowerCase()+(selectedId===item.id?" selected":"")} style={{left:item.x+"%",top:item.y+"%",width:item.w+"%",height:item.h+"%",background:item.color,color:item.textColor,fontSize:item.fontSize+"px"}} onPointerDown={event=>{const rect=boardRef.current?.getBoundingClientRect();if(!rect)return;const ex=item.x/100*rect.width,ey=item.y/100*rect.height;drag.current={id:item.id,dx:event.clientX-rect.left-ex,dy:event.clientY-rect.top-ey};setSelectedId(item.id);event.currentTarget.setPointerCapture(event.pointerId);}} onClick={()=>setSelectedId(item.id)}>{item.kind==="Bar"?<><span>{item.text}</span><i/></>:item.kind==="Image"&&item.imageData?<img className="wb-ui-image-content" src={item.imageData} alt={item.name} draggable={false}/>:item.text}</div>)}
      {elements.length===0&&<div className="wb-empty-board">Add a text label, button or panel to begin designing your game interface.</div>}
    </div><div className="wb-board-caption">HUD_Main · 1920 × 1080 · {elements.length} elements</div></div>
    <aside className="wb-ui-inspector"><div className="wb-side-heading"><div><span>SELECTED ELEMENT</span><strong>{selected?.name??"Nothing selected"}</strong></div><Settings2 size={17}/></div>
      {selected?<><label className="wb-field">Name<input value={selected.name} onChange={event=>update({name:event.target.value})}/></label><label className="wb-field">Text / label<input value={selected.text} onChange={event=>update({text:event.target.value})}/></label>{selected.kind==="Image"&&<label className="wb-field">Image file<input type="file" accept="image/*" onChange={event=>{const file=event.target.files?.[0];if(file){const reader=new FileReader();reader.onload=()=>update({imageData:String(reader.result)});reader.readAsDataURL(file);}}}/></label>}<div className="wb-field-grid"><label className="wb-field">X %<input type="number" value={selected.x} onChange={event=>update({x:Number(event.target.value)})}/></label><label className="wb-field">Y %<input type="number" value={selected.y} onChange={event=>update({y:Number(event.target.value)})}/></label><label className="wb-field">Width %<input type="number" min="1" max="100" value={selected.w} onChange={event=>update({w:Number(event.target.value)})}/></label><label className="wb-field">Height %<input type="number" min="1" max="100" value={selected.h} onChange={event=>update({h:Number(event.target.value)})}/></label></div><label className="wb-field">Fill colour<input type="color" value={selected.color==="transparent"?"#202b32":selected.color} onChange={event=>update({color:event.target.value})}/></label><label className="wb-field">Text colour<input type="color" value={selected.textColor} onChange={event=>update({textColor:event.target.value})}/></label><label className="wb-field">Font size <b>{selected.fontSize}px</b><input type="range" min="8" max="42" value={selected.fontSize} onChange={event=>update({fontSize:Number(event.target.value)})}/></label><button className="wb-secondary-button" onClick={()=>{update({x:Math.max(0,(100-selected.w)/2),y:Math.max(0,(100-selected.h)/2)});}}>Centre element</button></>:<p className="wb-help-copy">Select an element on the artboard to edit it.</p>}
    </aside></div>
    <div className="wb-status-row"><span>{elements.length} UI elements</span><span>Drag elements to position · Edit size and style in inspector</span><span>Layout is saved locally</span></div>
  </div>;
}

function LogicStudio({nodes,setNodes,links,setLinks,onStatus}:{nodes:LogicNode[];setNodes:Dispatch<SetStateAction<LogicNode[]>>;links:LogicLink[];setLinks:Dispatch<SetStateAction<LogicLink[]>>;onStatus?:(message:string)=>void}) {
  const [connectFrom,setConnectFrom]=useState<string|null>(null);
  const [logs,setLogs]=useState<string[]>(["Graph ready. Connect nodes and press Run graph."]);
  const [running,setRunning]=useState(false);
  const boardRef=useRef<HTMLDivElement>(null);
  const drag=useRef<{id:string;dx:number;dy:number}|null>(null);
  const addNode=(kind:LogicNode["kind"])=>{
    const names:Record<LogicNode["kind"],string>={Event:"On Start",Input:"Read Input",Math:"Add Numbers",Branch:"Is True?",Set:"Set Variable",Print:"Print Message"};
    const node:LogicNode={id:uid(),kind,title:names[kind],x:10+(nodes.length*11)%55,y:12+(nodes.length*13)%60};
    setNodes(current=>[...current,node]);onStatus?.(kind+" node added");
  };
  const moveNode=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(!drag.current||!boardRef.current)return;
    const rect=boardRef.current.getBoundingClientRect();
    const x=(event.clientX-rect.left-drag.current.dx)/rect.width*100;
    const y=(event.clientY-rect.top-drag.current.dy)/rect.height*100;
    setNodes(current=>current.map(node=>node.id===drag.current?.id?{...node,x:THREE.MathUtils.clamp(x,0,80),y:THREE.MathUtils.clamp(y,0,85)}:node));
  };
  const runGraph=()=>{
    setRunning(true);
    const byId=new Map(nodes.map(node=>[node.id,node]));
    const visited=new Set<string>();
    const output:string[]=[];
    const start=nodes.filter(node=>node.kind==="Event");
    const queue=start.map(node=>node.id);
    while(queue.length&&visited.size<nodes.length){
      const id=queue.shift()!;
      if(visited.has(id))continue;
      visited.add(id);
      const node=byId.get(id);if(!node)continue;
      if(node.kind==="Event")output.push("Event: scene start");
      else if(node.kind==="Input")output.push("Input: action value read");
      else if(node.kind==="Math")output.push("Math: 2 + 8 = 10");
      else if(node.kind==="Branch")output.push("Branch: condition evaluated true");
      else if(node.kind==="Set")output.push("Variable updated: score = 10");
      else if(node.kind==="Print")output.push("Output: score = 10");
      links.filter(link=>link.from===id).forEach(link=>queue.push(link.to));
    }
    if(!start.length)output.push("No Event node found. Add an On Start node to run this graph.");
    else if(visited.size===1)output.push("No outgoing connection from the event node.");
    setLogs(output);setRunning(false);onStatus?.("Graph executed · "+visited.size+" nodes visited");
  };
  const clickOutput=(id:string)=>{setConnectFrom(id);onStatus?.("Choose an input port on another node");};
  const clickInput=(id:string)=>{
    if(!connectFrom){setLogs(current=>[...current,"Choose an output port first."]);return;}
    if(connectFrom===id){setConnectFrom(null);return;}
    if(links.some(link=>link.from===connectFrom&&link.to===id)){setLogs(current=>[...current,"Those nodes are already connected."]);setConnectFrom(null);return;}
    setLinks(current=>[...current,{id:uid(),from:connectFrom,to:id}]);setConnectFrom(null);onStatus?.("Node connection created");
  };
  const nodeById=new Map(nodes.map(node=>[node.id,node]));
  return <div className="wb-studio wb-logic-studio">
    <div className="wb-toolbar"><div className="wb-toolbar-group"><span className="wb-section-name">Visual logic graph</span>{(["Event","Input","Math","Branch","Set","Print"] as const).map(kind=><button key={kind} onClick={()=>addNode(kind)}><Plus size={13}/>{kind}</button>)}</div><div className="wb-toolbar-group"><button className="wb-primary" onClick={runGraph} disabled={running}><Play size={14}/> Run graph</button><button className="wb-danger-quiet" onClick={()=>{setNodes([]);setLinks([]);setConnectFrom(null);setLogs(["Graph cleared. Add nodes to build a new graph."]);}}><Trash2 size={14}/> Clear</button></div></div>
    <div className="wb-logic-board" ref={boardRef} onPointerMove={moveNode} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null}>
      <svg className="wb-logic-wires" viewBox="0 0 1000 600" preserveAspectRatio="none">{links.map(link=>{const a=nodeById.get(link.from),b=nodeById.get(link.to);if(!a||!b)return null;const x1=a.x*10+176,y1=a.y*6+42,x2=b.x*10,y2=b.y*6+42;return <path key={link.id} d={"M "+x1+" "+y1+" C "+(x1+80)+" "+y1+", "+(x2-80)+" "+y2+", "+x2+" "+y2}/>;})}</svg>
      {nodes.map(node=><div key={node.id} className={"wb-logic-node kind-"+node.kind.toLowerCase()} style={{left:node.x+"%",top:node.y+"%"}} onPointerDown={event=>{if((event.target as HTMLElement).closest("button"))return;const rect=boardRef.current?.getBoundingClientRect();if(!rect)return;drag.current={id:node.id,dx:event.clientX-rect.left-node.x/100*rect.width,dy:event.clientY-rect.top-node.y/100*rect.height};event.currentTarget.setPointerCapture(event.pointerId);}}>
        <div className="wb-node-header"><span>{node.kind}</span><button title="Delete node" onClick={()=>{setNodes(current=>current.filter(item=>item.id!==node.id));setLinks(current=>current.filter(link=>link.from!==node.id&&link.to!==node.id));}}><X size={12}/></button></div><strong>{node.title}</strong><div className="wb-node-ports"><button className={connectFrom===node.id?"armed":""} title="Connect output to another node's input" onClick={()=>clickOutput(node.id)}>OUT <Link2 size={11}/></button><button title="Connect from another node's output" onClick={()=>clickInput(node.id)}><Link2 size={11}/> IN</button></div>
      </div>)}
      {nodes.length===0&&<div className="wb-empty-board">Add an Event node, then connect it to actions using OUT → IN.</div>}
      {connectFrom&&<div className="wb-connect-hint">Choose an IN port to finish the connection <button onClick={()=>setConnectFrom(null)}>Cancel</button></div>}
    </div>
    <div className="wb-logic-console"><div><Code2 size={14}/> EXECUTION LOG</div>{logs.map((line,index)=><span key={index}>{String(index+1).padStart(2,"0")}　{line}</span>)}</div>
    <div className="wb-status-row"><span>{nodes.length} nodes</span><span>{links.length} connections</span><span>Drag nodes · OUT → IN to connect · Run graph to execute</span></div>
  </div>;
}

function AudioStudio({onStatus}:{onStatus?:(message:string)=>void}) {
  const [clips,setClips]=useState<{id:string;name:string;url:string}[]>([]);
  const [selected,setSelected]=useState("");
  const clipsRef=useRef(clips);
  clipsRef.current=clips;
  useEffect(()=>()=>clipsRef.current.forEach(clip=>URL.revokeObjectURL(clip.url)),[]);
  const addFiles=(files:FileList|null)=>{
    const additions=Array.from(files??[]).filter(file=>file.type.startsWith("audio/")).map(file=>({id:uid(),name:file.name,url:URL.createObjectURL(file)}));
    if(!additions.length){onStatus?.("Choose a supported audio file");return;}
    setClips(current=>[...current,...additions]);setSelected(additions[0].id);onStatus?.(additions.length+" audio clip(s) imported for preview");
  };
  return <div className="wb-studio wb-audio-studio"><div className="wb-audio-heading"><div><span>PROJECT AUDIO</span><h2>Sound library</h2><p>Import audio files and preview them in the browser.</p></div><label className="wb-upload-button"><Upload size={15}/> Import audio<input type="file" accept="audio/*" multiple onChange={event=>addFiles(event.target.files)}/></label></div>
    {clips.length===0?<div className="wb-audio-empty"><Music2 size={42}/><strong>No audio clips yet</strong><span>Import WAV, MP3, OGG or another browser-supported audio file.</span><label className="wb-upload-button"><Upload size={14}/> Choose audio files<input type="file" accept="audio/*" multiple onChange={event=>addFiles(event.target.files)}/></label></div>:<div className="wb-audio-list">{clips.map(clip=><div className={"wb-audio-clip "+(selected===clip.id?"selected":"")} key={clip.id}><button onClick={()=>setSelected(clip.id)}><Music2 size={19}/><span><strong>{clip.name}</strong><small>Imported audio · local browser preview</small></span></button><audio controls preload="metadata" src={clip.url}/><button className="wb-icon-danger" title="Remove audio clip" onClick={()=>{URL.revokeObjectURL(clip.url);setClips(current=>current.filter(item=>item.id!==clip.id));if(selected===clip.id)setSelected("");}}><Trash2 size={14}/></button></div>)}</div>}
    <div className="wb-status-row"><span>{clips.length} imported clips</span><span>Audio files are previewed locally; they are not uploaded to a server.</span></div>
  </div>;
}
