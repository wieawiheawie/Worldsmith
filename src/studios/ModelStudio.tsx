import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction, PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import {
  Box, Circle, Cone, Cylinder, Delete, Dot, Eye, Grid3X3, Layers3, Magnet,
  Move, Plus, RotateCw, Scale, Scissors, Settings2, Square, Trash2,
  Undo2, Redo2, X
} from "lucide-react";
import "./model-studio.css";

export type ModelPrimitive = "Cube" | "Plane" | "Cylinder" | "UV Sphere";
export type MeshData = { vertices: [number, number, number][]; faces: number[][] };
export type ModelAsset = {
  id: string;
  name: string;
  primitive: ModelPrimitive;
  mesh: MeshData;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
};
export type ModelCommand = { id: string; type: "delete" | "duplicate" | "move"; names: string[]; direction?: -1 | 1 };
type ComponentMode = "vertex" | "edge" | "face";
type TransformMode = "translate" | "rotate" | "scale";
type Edge = [number, number];

const MODEL_STORAGE = "worldsmith-model-assets-v1";
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "model-" + Date.now() + "-" + Math.random().toString(16).slice(2));
const cubeMesh = (): MeshData => ({
  vertices: [
    [-0.5,-0.5,-0.5],[0.5,-0.5,-0.5],[0.5,0.5,-0.5],[-0.5,0.5,-0.5],
    [-0.5,-0.5,0.5],[0.5,-0.5,0.5],[0.5,0.5,0.5],[-0.5,0.5,0.5]
  ],
  faces: [[0,1,5,4],[3,7,6,2],[4,5,6,7],[0,3,2,1],[0,4,7,3],[1,2,6,5]]
});
function primitiveMesh(kind: ModelPrimitive): MeshData {
  if (kind === "Cube") return cubeMesh();
  if (kind === "Plane") return {
    vertices: [[-1,0,-1],[1,0,-1],[1,0,1],[-1,0,1]],
    faces: [[0,3,2,1]]
  };
  if (kind === "Cylinder") {
    const segments = 16;
    const vertices: [number,number,number][] = [];
    for (let ring = 0; ring < 2; ring++) {
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        vertices.push([Math.cos(angle) * 0.5, ring ? 0.5 : -0.5, Math.sin(angle) * 0.5]);
      }
    }
    const faces: number[][] = [];
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      faces.push([i, segments + i, segments + next, next]);
    }
    faces.push(Array.from({length:segments},(_,i)=>segments-1-i));
    faces.push(Array.from({length:segments},(_,i)=>segments+i));
    return { vertices, faces };
  }
  const segments = 16;
  const rings = 8;
  const vertices: [number,number,number][] = [[0,0.5,0]];
  for (let row = 1; row < rings; row++) {
    const phi = Math.PI * row / rings;
    for (let column = 0; column < segments; column++) {
      const theta = Math.PI * 2 * column / segments;
      vertices.push([
        0.5 * Math.sin(phi) * Math.cos(theta),
        0.5 * Math.cos(phi),
        0.5 * Math.sin(phi) * Math.sin(theta)
      ]);
    }
  }
  const bottom = vertices.length;
  vertices.push([0,-0.5,0]);
  const faces: number[][] = [];
  for (let column = 0; column < segments; column++) {
    const next = (column + 1) % segments;
    faces.push([0,1+column,1+next]);
    for (let row = 0; row < rings-2; row++) {
      const a = 1 + row*segments + column;
      const b = 1 + row*segments + next;
      const c = a + segments;
      const d = b + segments;
      faces.push([a,c,d,b]);
    }
    const last = 1 + (rings-2)*segments;
    faces.push([last+column,bottom,last+next]);
  }
  return { vertices, faces };
}
export function createModelAsset(kind: ModelPrimitive, index: number): ModelAsset {
  const id = uid();
  return {
    id, name: index === 1 ? kind : kind + "." + String(index).padStart(3,"0"),
    primitive: kind, mesh: primitiveMesh(kind),
    position: [0,0,0], rotation: [0,0,0], scale: [1,1,1],
    color: "#a6b2b7"
  };
}
export function readModelAssets(): ModelAsset[] {
  try {
    const value = window.localStorage.getItem(MODEL_STORAGE);
    if (value) {
      const parsed = JSON.parse(value) as ModelAsset[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* Use the default startup mesh if local data is unavailable. */ }
  return [createModelAsset("Cube",1)];
}
export function modelEdges(mesh: MeshData): Edge[] {
  const seen = new Set<string>();
  const edges: Edge[] = [];
  for (const face of mesh.faces) {
    for (let i=0;i<face.length;i++) {
      const a=face[i], b=face[(i+1)%face.length];
      const key=a<b ? a+"-"+b : b+"-"+a;
      if (!seen.has(key)) { seen.add(key); edges.push([a,b]); }
    }
  }
  return edges;
}
export function createGeometryFromMesh(mesh: MeshData, selectedFaces: number[] = []): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const faceMap: number[] = [];
  mesh.faces.forEach((face,faceIndex) => {
    if (face.length<3) return;
    const base=positions.length/3;
    face.forEach(vertexIndex => positions.push(...mesh.vertices[vertexIndex]));
    for(let i=1;i<face.length-1;i++) {
      indices.push(base,base+i,base+i+1);
      faceMap.push(faceIndex);
    }
  });
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.triangleFaces=faceMap;
  return geometry;
}
function lineGeometry(mesh: MeshData, edges: Edge[]): THREE.BufferGeometry {
  const positions:number[]=[];
  for(const [a,b] of edges) positions.push(...mesh.vertices[a],...mesh.vertices[b]);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  return geometry;
}
function pointGeometry(mesh: MeshData, indices: number[]): THREE.BufferGeometry {
  const positions:number[]=[];
  indices.forEach(index=>{const v=mesh.vertices[index];if(v)positions.push(...v);});
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  return geometry;
}
function faceNormal(mesh:MeshData, face:number[]):THREE.Vector3 {
  if(face.length<3)return new THREE.Vector3(0,1,0);
  const a=new THREE.Vector3(...mesh.vertices[face[0]]);
  const b=new THREE.Vector3(...mesh.vertices[face[1]]);
  const c=new THREE.Vector3(...mesh.vertices[face[2]]);
  return b.sub(a).cross(c.sub(a)).normalize();
}
function selectedVertices(mesh:MeshData, mode:ComponentMode, vertices:number[], edges:number[], faces:number[]):number[] {
  if(mode==="vertex")return [...vertices];
  const result=new Set<number>();
  if(mode==="edge") {
    const all=modelEdges(mesh);
    edges.forEach(i=>{const edge=all[i];if(edge){result.add(edge[0]);result.add(edge[1]);}});
  } else {
    faces.forEach(i=>mesh.faces[i]?.forEach(vertex=>result.add(vertex)));
  }
  return [...result];
}
function remapMesh(mesh:MeshData, faces:number[][]):MeshData {
  const used=[...new Set(faces.flat())].sort((a,b)=>a-b);
  const remap=new Map(used.map((old,index)=>[old,index]));
  return {
    vertices:used.map(index=>mesh.vertices[index]),
    faces:faces.map(face=>face.map(index=>remap.get(index)!))
  };
}
function pointSegmentDistance(point:THREE.Vector3,a:THREE.Vector3,b:THREE.Vector3):number {
  const ab=b.clone().sub(a);
  const length=ab.lengthSq();
  if(length===0)return point.distanceTo(a);
  const t=THREE.MathUtils.clamp(point.clone().sub(a).dot(ab)/length,0,1);
  return point.distanceTo(a.add(ab.multiplyScalar(t)));
}
function insetFace(mesh:MeshData,faceIndex:number,amount:number):MeshData {
  const face=mesh.faces[faceIndex];if(!face||face.length<3)return mesh;
  const center=new THREE.Vector3();
  face.forEach(index=>center.add(new THREE.Vector3(...mesh.vertices[index])));
  center.divideScalar(face.length);
  const factor=THREE.MathUtils.clamp(1-amount,0.05,0.95);
  const nextVertices=[...mesh.vertices];
  const inner=face.map(index=>{
    const p=new THREE.Vector3(...mesh.vertices[index]).lerp(center,1-factor);
    nextVertices.push([p.x,p.y,p.z]);return nextVertices.length-1;
  });
  const nextFaces=mesh.faces.flatMap((current,index)=>{
    if(index!==faceIndex)return [current];
    const ring:number[][]=[];
    for(let i=0;i<face.length;i++)ring.push([face[i],face[(i+1)%face.length],inner[(i+1)%face.length],inner[i]]);
    return [...ring,inner];
  });
  return {vertices:nextVertices,faces:nextFaces};
}
function extrudeFace(mesh:MeshData,faceIndex:number,distance:number):MeshData {
  const face=mesh.faces[faceIndex];if(!face||face.length<3)return mesh;
  const normal=faceNormal(mesh,face);
  const nextVertices=[...mesh.vertices];
  const top=face.map(index=>{
    const p=new THREE.Vector3(...mesh.vertices[index]).addScaledVector(normal,distance);
    nextVertices.push([p.x,p.y,p.z]);return nextVertices.length-1;
  });
  const nextFaces=mesh.faces.map((current,index)=>index===faceIndex?top:current);
  for(let i=0;i<face.length;i++){
    const j=(i+1)%face.length;
    nextFaces.push([face[i],face[j],top[j],top[i]]);
  }
  return {vertices:nextVertices,faces:nextFaces};
}
function subdivideFace(mesh:MeshData,faceIndex:number):MeshData {
  const face=mesh.faces[faceIndex];if(!face||face.length<3)return mesh;
  const center=new THREE.Vector3();
  face.forEach(index=>center.add(new THREE.Vector3(...mesh.vertices[index])));
  center.divideScalar(face.length);
  const nextVertices=[...mesh.vertices,[center.x,center.y,center.z] as [number,number,number]];
  const centerIndex=nextVertices.length-1;
  const midpoints=face.map((index,i)=>{
    const a=new THREE.Vector3(...mesh.vertices[index]);
    const b=new THREE.Vector3(...mesh.vertices[face[(i+1)%face.length]]);
    const p=a.add(b).multiplyScalar(0.5);
    nextVertices.push([p.x,p.y,p.z]);return nextVertices.length-1;
  });
  const quads=face.map((vertex,i)=>[
    vertex,midpoints[i],centerIndex,midpoints[(i+face.length-1)%face.length]
  ]);
  const nextFaces=mesh.faces.flatMap((current,index)=>index===faceIndex?quads:[current]);
  return {vertices:nextVertices,faces:nextFaces};
}

export default function ModelStudio({ models, setModels, selectedObjectName, onSelectionChange, onStatus, command, onCommandApplied, onAddToScene }: {
  models: ModelAsset[];
  setModels: Dispatch<SetStateAction<ModelAsset[]>>;
  selectedObjectName?: string;
  onSelectionChange?: (name:string)=>void;
  onStatus?: (message:string)=>void;
  command?: ModelCommand|null;
  onCommandApplied?: (id:string)=>void;
  onAddToScene?: (model:ModelAsset)=>void;
}) {
  const hostRef=useRef<HTMLDivElement>(null);
  const rendererRef=useRef<THREE.WebGLRenderer|null>(null);
  const sceneRef=useRef<THREE.Scene|null>(null);
  const cameraRef=useRef<THREE.PerspectiveCamera|null>(null);
  const groupRef=useRef<THREE.Group|null>(null);
  const transformRef=useRef<TransformControls|null>(null);
  const orbitRef=useRef<OrbitControls|null>(null);
  const meshMapRef=useRef<Map<string,THREE.Mesh>>(new Map());
  const modelsRef=useRef(models);
  const editRef=useRef(false);
  const componentModeRef=useRef<ComponentMode>("face");
  const [selectedId,setSelectedId]=useState(models[0]?.id??"");
  const [editMode,setEditMode]=useState(false);
  const [componentMode,setComponentMode]=useState<ComponentMode>("face");
  const [transformMode,setTransformMode]=useState<TransformMode>("translate");
  const [gridVisible,setGridVisible]=useState(true);
  const [wireframe,setWireframe]=useState(false);
  const [extrudeAmount,setExtrudeAmount]=useState(0.5);
  const [insetAmount,setInsetAmount]=useState(0.12);
  const [moveAmount,setMoveAmount]=useState(0.25);
  const [selectedVertices,setSelectedVertices]=useState<number[]>([]);
  const [selectedEdges,setSelectedEdges]=useState<number[]>([]);
  const [selectedFaces,setSelectedFaces]=useState<number[]>([1]);
  const [activeTool,setActiveTool]=useState("Select");
  const [status,setStatus]=useState("Object mode · Select a mesh, then press Tab to edit its topology");
  const [snapEnabled,setSnapEnabled]=useState(false);
  const [snapStep,setSnapStep]=useState(0.25);
  const [meshHistory,setMeshHistory]=useState<Record<string,MeshData[]>>({});
  const [meshFuture,setMeshFuture]=useState<Record<string,MeshData[]>>({});
  const selected=models.find(model=>model.id===selectedId)??models[0];
  modelsRef.current=models;
  editRef.current=editMode;
  componentModeRef.current=componentMode;

  useEffect(()=>{
    const match=models.find(model=>model.name===selectedObjectName);
    if(match&&match.id!==selectedId)setSelectedId(match.id);
  },[selectedObjectName,models,selectedId]);
  useEffect(()=>{
    if(selected&&selected.name!==selectedObjectName)onSelectionChange?.(selected.name);
  },[selected?.id,selected?.name,onSelectionChange]);
  useEffect(()=>{
    try{window.localStorage.setItem(MODEL_STORAGE,JSON.stringify(models));}
    catch{onStatus?.("Model asset save failed: browser storage is full");}
  },[models,onStatus]);
  useEffect(()=>{
    if(!command)return;
    const selectedNames=new Set(command.names);
    if(command.type==="delete"){
      setModels(current=>current.filter(model=>!selectedNames.has(model.name)));
      setSelectedId(current=>models.find(model=>model.id!==current&&!selectedNames.has(model.name))?.id??"");
    }else if(command.type==="duplicate"){
      const existing=new Set(models.map(model=>model.name));
      const copies=models.filter(model=>selectedNames.has(model.name)).map(model=>{
        let name=model.name+" Copy";let suffix=2;
        while(existing.has(name))name=model.name+" Copy "+suffix++;
        existing.add(name);
        return {...model,id:uid(),name,position:[model.position[0]+1,model.position[1],model.position[2]] as [number,number,number],mesh:{vertices:model.mesh.vertices.map(v=>[...v] as [number,number,number]),faces:model.mesh.faces.map(f=>[...f])}};
      });
      if(copies.length)setModels(current=>[...current,...copies]);
    }else{
      setModels(current=>{
        const next=[...current];let moved=false;
        if((command.direction??1)<0){
          for(let i=1;i<next.length;i++)if(selectedNames.has(next[i].name)&&!selectedNames.has(next[i-1].name)){[next[i-1],next[i]]=[next[i],next[i-1]];moved=true;}
        }else{
          for(let i=next.length-2;i>=0;i--)if(selectedNames.has(next[i].name)&&!selectedNames.has(next[i+1].name)){[next[i],next[i+1]]=[next[i+1],next[i]];moved=true;}
        }
        return moved?next:current;
      });
    }
    onCommandApplied?.(command.id);
  },[command,models,setModels,onCommandApplied]);

  useEffect(()=>{
    const host=hostRef.current;if(!host)return;
    let frame=0;
    const scene=new THREE.Scene();scene.background=new THREE.Color("#20282e");
    const camera=new THREE.PerspectiveCamera(50,1,0.05,500);camera.position.set(4.6,3.8,5.6);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.15;
    renderer.shadowMap.enabled=true;
    host.appendChild(renderer.domElement);
    const orbit=new OrbitControls(camera,renderer.domElement);
    orbit.enableDamping=true;orbit.dampingFactor=0.08;
    orbit.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};
    orbit.target.set(0,0,0);orbit.update();
    const hemi=new THREE.HemisphereLight(0xe0e9ef,0x30393a,2.0);scene.add(hemi);
    const key=new THREE.DirectionalLight(0xffe5c8,3.0);key.position.set(4,8,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
    const fill=new THREE.DirectionalLight(0x8db6d3,1.15);fill.position.set(-5,2,-4);scene.add(fill);
    const grid=new THREE.GridHelper(20,40,0x65767c,0x3a464b);grid.position.y=-0.001;scene.add(grid);
    const axes=new THREE.AxesHelper(1.2);axes.position.set(-4.8,0.015,-4.8);scene.add(axes);
    const group=new THREE.Group();scene.add(group);
    const transform=new TransformControls(camera,renderer.domElement);
    transform.setSize(0.9);scene.add(transform.getHelper());
    transform.addEventListener("dragging-changed",(event)=>{orbit.enabled=!(event as unknown as {value:boolean}).value;});
    transform.addEventListener("mouseUp",()=>{
      const object=transform.object as THREE.Mesh|undefined;if(!object)return;
      const id=String(object.userData.modelId??"");
      setModels(current=>current.map(model=>model.id===id?{
        ...model,
        position:[object.position.x,object.position.y,object.position.z],
        rotation:[object.rotation.x,object.rotation.y,object.rotation.z],
        scale:[object.scale.x,object.scale.y,object.scale.z]
      }:model));
    });
    const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();
    const onPointerDown=(event:PointerEvent)=>{
      if(event.button!==0||transform.dragging)return;
      const rect=renderer.domElement.getBoundingClientRect();
      pointer.x=((event.clientX-rect.left)/rect.width)*2-1;
      pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
      raycaster.setFromCamera(pointer,camera);
      const hits=raycaster.intersectObjects([...meshMapRef.current.values()],false);
      const hit=hits[0];
      if(!hit)return;
      const mesh=hit.object as THREE.Mesh;
      const id=String(mesh.userData.modelId??"");
      setSelectedId(id);
      const model=modelsRef.current.find(item=>item.id===id);
      if(!model||!editRef.current)return;
      const triangleFace=(mesh.geometry.userData.triangleFaces as number[]|undefined)?.[hit.faceIndex??-1];
      if(triangleFace===undefined)return;
      const face=model.mesh.faces[triangleFace];
      if(!face)return;
      if(componentModeRef.current==="face"){
        setSelectedFaces(current=>event.shiftKey?(current.includes(triangleFace)?current.filter(x=>x!==triangleFace):[...current,triangleFace]):[triangleFace]);
      }else{
        const local=mesh.worldToLocal(hit.point.clone());
        if(componentModeRef.current==="vertex"){
          const nearest=face.reduce((best,index)=>{
            const d=new THREE.Vector3(...model.mesh.vertices[index]).distanceToSquared(local);
            const bd=new THREE.Vector3(...model.mesh.vertices[best]).distanceToSquared(local);
            return d<bd?index:best;
          },face[0]);
          setSelectedVertices(current=>event.shiftKey?(current.includes(nearest)?current.filter(x=>x!==nearest):[...current,nearest]):[nearest]);
        }else{
          const edges=modelEdges(model.mesh);
          const faceEdges=face.map((v,i)=>{
            const n=face[(i+1)%face.length];
            return edges.findIndex(edge=>(edge[0]===v&&edge[1]===n)||(edge[0]===n&&edge[1]===v));
          }).filter(i=>i>=0);
          const nearest=faceEdges.reduce((best,index)=>{
            const edge=edges[index];
            const d=pointSegmentDistance(local,new THREE.Vector3(...model.mesh.vertices[edge[0]]),new THREE.Vector3(...model.mesh.vertices[edge[1]]));
            if(best<0)return index;
            const old=edges[best];
            const bd=pointSegmentDistance(local,new THREE.Vector3(...model.mesh.vertices[old[0]]),new THREE.Vector3(...model.mesh.vertices[old[1]]));
            return d<bd?index:best;
          },-1);
          if(nearest>=0)setSelectedEdges(current=>event.shiftKey?(current.includes(nearest)?current.filter(x=>x!==nearest):[...current,nearest]):[nearest]);
        }
      }
    };
    renderer.domElement.addEventListener("pointerdown",onPointerDown);
    const resize=()=>{
      const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);
      renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    };
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    const render=()=>{frame=requestAnimationFrame(render);orbit.update();renderer.render(scene,camera);};
    render();
    rendererRef.current=renderer;sceneRef.current=scene;cameraRef.current=camera;
    groupRef.current=group;transformRef.current=transform;orbitRef.current=orbit;
    return ()=>{
      cancelAnimationFrame(frame);observer.disconnect();renderer.domElement.removeEventListener("pointerdown",onPointerDown);
      transform.detach();transform.dispose();orbit.dispose();renderer.dispose();
      group.traverse(object=>{const mesh=object as THREE.Mesh;mesh.geometry?.dispose();if(Array.isArray(mesh.material))mesh.material.forEach(material=>material.dispose());else mesh.material?.dispose();});
      if(renderer.domElement.parentElement===host)host.removeChild(renderer.domElement);
      meshMapRef.current.clear();rendererRef.current=null;sceneRef.current=null;cameraRef.current=null;groupRef.current=null;transformRef.current=null;orbitRef.current=null;
    };
  },[setModels]);

  useEffect(()=>{
    const group=groupRef.current,transform=transformRef.current;if(!group||!transform)return;
    transform.detach();
    for(const child of [...group.children]){
      group.remove(child);
      const object=child as THREE.Mesh|THREE.LineSegments|THREE.Points;
      object.geometry?.dispose();
      const material=object.material;
      if(Array.isArray(material))material.forEach(item=>item.dispose());else material?.dispose();
    }
    const map=new Map<string,THREE.Mesh>();
    for(const model of models){
      const geometry=createGeometryFromMesh(model.mesh);
      const material=new THREE.MeshStandardMaterial({color:model.color,roughness:0.62,metalness:0.08,flatShading:true,side:THREE.DoubleSide,wireframe:wireframe&&!editMode});
      const mesh=new THREE.Mesh(geometry,material);
      mesh.name=model.name;mesh.userData.modelId=model.id;
      mesh.position.set(...model.position);mesh.rotation.set(...model.rotation);mesh.scale.set(...model.scale);
      mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);map.set(model.id,mesh);
      if(editMode&&model.id===selectedId){
        const edges=modelEdges(model.mesh);
        group.add(new THREE.LineSegments(lineGeometry(model.mesh,edges),new THREE.LineBasicMaterial({color:0x172127,transparent:true,opacity:0.9})));
        group.children[group.children.length-1].position.copy(mesh.position);
        group.children[group.children.length-1].rotation.copy(mesh.rotation);
        group.children[group.children.length-1].scale.copy(mesh.scale);
        group.add(new THREE.Points(pointGeometry(model.mesh,model.mesh.vertices.map((_,i)=>i)),new THREE.PointsMaterial({color:0xd9e2e2,size:0.055,sizeAttenuation:true})));
        const points=group.children[group.children.length-1];points.position.copy(mesh.position);points.rotation.copy(mesh.rotation);points.scale.copy(mesh.scale);
        const activeIndices=selectedVerticesForDisplay(model.mesh,componentMode,selectedVertices,selectedEdges,selectedFaces);
        if(activeIndices.length){
          group.add(new THREE.Points(pointGeometry(model.mesh,activeIndices),new THREE.PointsMaterial({color:0xffb65e,size:0.105,sizeAttenuation:true})));
          const active=group.children[group.children.length-1];active.position.copy(mesh.position);active.rotation.copy(mesh.rotation);active.scale.copy(mesh.scale);
        }
        if(selectedFaces.length){
          const overlay=new THREE.Mesh(createGeometryFromMesh({vertices:model.mesh.vertices,faces:selectedFaces.map(i=>model.mesh.faces[i]).filter(Boolean)}),new THREE.MeshBasicMaterial({color:0xffa84e,transparent:true,opacity:0.33,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
          overlay.position.copy(mesh.position);overlay.rotation.copy(mesh.rotation);overlay.scale.copy(mesh.scale);overlay.renderOrder=3;group.add(overlay);
        }
        if(selectedEdges.length){
          const chosen=selectedEdges.map(i=>edges[i]).filter(Boolean);
          const overlay=new THREE.LineSegments(lineGeometry(model.mesh,chosen),new THREE.LineBasicMaterial({color:0xffb65e,linewidth:3}));
          overlay.position.copy(mesh.position);overlay.rotation.copy(mesh.rotation);overlay.scale.copy(mesh.scale);group.add(overlay);
        }
      }
    }
    meshMapRef.current=map;
    const active=map.get(selectedId);
    if(active&&!editMode){transform.attach(active);transform.setMode(transformMode);transform.enabled=true;transform.setTranslationSnap(snapEnabled?snapStep:null);transform.setRotationSnap(snapEnabled?Math.PI/12:null);transform.setScaleSnap(snapEnabled?0.1:null);}
    else{transform.detach();transform.enabled=false;}
  },[models,selectedId,editMode,componentMode,selectedVertices,selectedEdges,selectedFaces,transformMode,wireframe,snapEnabled,snapStep]);

  useEffect(()=>{
    const grid=sceneRef.current?.children.find(child=>child instanceof THREE.GridHelper);
    if(grid)grid.visible=gridVisible;
  },[gridVisible]);
  useEffect(()=>{
    const keydown=(event:KeyboardEvent)=>{
      if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;
      if(event.key==="Tab"){event.preventDefault();setEditMode(value=>!value);setStatus(editMode?"Object mode":"Edit mode");}
      if(editMode&&["1","2","3"].includes(event.key)){
        const mode=event.key==="1"?"vertex":event.key==="2"?"edge":"face";
        setComponentMode(mode);setSelectedVertices([]);setSelectedEdges([]);setSelectedFaces([]);
      }
      if(event.key.toLowerCase()==="g"&&!event.ctrlKey&&!event.metaKey){setTransformMode("translate");setActiveTool("Move");}
      if(event.key.toLowerCase()==="r"&&!event.ctrlKey&&!event.metaKey){setTransformMode("rotate");setActiveTool("Rotate");}
      if(event.key.toLowerCase()==="s"&&!event.ctrlKey&&!event.metaKey){setTransformMode("scale");setActiveTool("Scale");}
      if(editMode&&componentMode==="face"&&(event.key.toLowerCase()==="e"||event.key.toLowerCase()==="i")){
        event.preventDefault();
        const active=models.find(model=>model.id===selectedId);
        const faceIndex=selectedFaces[0];
        if(active&&faceIndex!==undefined){
          if(event.key.toLowerCase()==="e"){
            setModels(current=>current.map(model=>model.id===active.id?{...model,mesh:extrudeFace(model.mesh,faceIndex,extrudeAmount)}:model));
            setMeshHistory(current=>({...current,[active.id]:[...(current[active.id]??[]),{vertices:active.mesh.vertices.map(v=>[...v] as [number,number,number]),faces:active.mesh.faces.map(f=>[...f])}].slice(-50)}));
            setMeshFuture(current=>({...current,[active.id]:[]}));
            setSelectedFaces([faceIndex]);setStatus("Extruded selected face");
          }else{
            const faceSize=active.mesh.faces[faceIndex]?.length??0;
            setModels(current=>current.map(model=>model.id===active.id?{...model,mesh:insetFace(model.mesh,faceIndex,insetAmount)}:model));
            setMeshHistory(current=>({...current,[active.id]:[...(current[active.id]??[]),{vertices:active.mesh.vertices.map(v=>[...v] as [number,number,number]),faces:active.mesh.faces.map(f=>[...f])}].slice(-50)}));
            setMeshFuture(current=>({...current,[active.id]:[]}));
            setSelectedFaces([faceIndex+faceSize]);setStatus("Inset selected face");
          }
        }
      }
      if(event.key==="Delete"&&editMode)deleteComponents();
    };
    window.addEventListener("keydown",keydown);return()=>window.removeEventListener("keydown",keydown);
  },[editMode,componentMode,selectedVertices,selectedEdges,selectedFaces,selectedId,models,extrudeAmount,insetAmount]);

  const updateModel=(id:string,patch:Partial<ModelAsset>)=>setModels(current=>current.map(model=>model.id===id?{...model,...patch}:model));
  const createPrimitive=(kind:ModelPrimitive)=>{
    const next=createModelAsset(kind,models.filter(m=>m.primitive===kind).length+1);
    next.position=[models.length*1.35,0,0];
    setModels(current=>[...current,next]);setSelectedId(next.id);setEditMode(false);
    setSelectedVertices([]);setSelectedEdges([]);setSelectedFaces(kind==="Cube"?[1]:[0]);
    setStatus(kind+" mesh created");onStatus?.(kind+" mesh created");
  };
  const currentMesh=selected?.mesh;
  const currentEdges=useMemo(()=>currentMesh?modelEdges(currentMesh):[],[currentMesh]);
  const activeVertexIndices=useMemo(()=>currentMesh?selectedVerticesForDisplay(currentMesh,componentMode,selectedVertices,selectedEdges,selectedFaces):[],[currentMesh,componentMode,selectedVertices,selectedEdges,selectedFaces]);
  const cloneMesh=(mesh:MeshData):MeshData=>({vertices:mesh.vertices.map(v=>[...v] as [number,number,number]),faces:mesh.faces.map(f=>[...f])});
  const updateMesh=(mesh:MeshData,message:string)=>{
    if(!selected)return;
    setMeshHistory(current=>({...current,[selected.id]:[...(current[selected.id]??[]),cloneMesh(selected.mesh)].slice(-50)}));
    setMeshFuture(current=>({...current,[selected.id]:[]}));
    updateModel(selected.id,{mesh});setStatus(message);onStatus?.(message);
  };
  const undoMesh=()=>{
    if(!selected)return;
    const history=meshHistory[selected.id]??[];
    const previous=history[history.length-1];
    if(!previous)return;
    setMeshHistory(current=>({...current,[selected.id]:history.slice(0,-1)}));
    setMeshFuture(current=>({...current,[selected.id]:[...(current[selected.id]??[]),cloneMesh(selected.mesh)]}));
    updateModel(selected.id,{mesh:cloneMesh(previous)});
    setSelectedVertices([]);setSelectedEdges([]);setSelectedFaces([]);
    setStatus("Undid mesh edit");
  };
  const redoMesh=()=>{
    if(!selected)return;
    const future=meshFuture[selected.id]??[];
    const next=future[future.length-1];
    if(!next)return;
    setMeshFuture(current=>({...current,[selected.id]:future.slice(0,-1)}));
    setMeshHistory(current=>({...current,[selected.id]:[...(current[selected.id]??[]),cloneMesh(selected.mesh)].slice(-50)}));
    updateModel(selected.id,{mesh:cloneMesh(next)});
    setSelectedVertices([]);setSelectedEdges([]);setSelectedFaces([]);
    setStatus("Redid mesh edit");
  };
  const extrude=()=>{
    if(!selected||selectedFaces.length===0){setStatus("Select a face before extruding");return;}
    updateMesh(extrudeFace(selected.mesh,selectedFaces[0],extrudeAmount),"Extruded selected face");
    setSelectedFaces([selectedFaces[0]]);
  };
  const inset=()=>{
    if(!selected||selectedFaces.length===0){setStatus("Select a face before insetting");return;}
    const faceIndex=selectedFaces[0];
    const faceSize=selected.mesh.faces[faceIndex]?.length??0;
    updateMesh(insetFace(selected.mesh,faceIndex,insetAmount),"Inset selected face");
    setSelectedFaces([faceIndex+faceSize]);
  };
  const subdivide=()=>{
    if(!selected||selectedFaces.length===0){setStatus("Select a face before subdividing");return;}
    const faceIndex=selectedFaces[0];
    const faceSize=selected.mesh.faces[faceIndex]?.length??0;
    updateMesh(subdivideFace(selected.mesh,faceIndex),"Subdivided selected face");
    setSelectedFaces(Array.from({length:faceSize},(_,i)=>faceIndex+i));
  };
  const deleteComponents=()=>{
    if(!selected)return;
    if(componentMode==="face"&&selectedFaces.length){
      const keep=selected.mesh.faces.filter((_,index)=>!selectedFaces.includes(index));
      updateMesh(remapMesh(selected.mesh,keep),"Deleted selected face(s)");setSelectedFaces([]);
    }else if(componentMode==="vertex"&&selectedVertices.length){
      const faces=selected.mesh.faces.filter(face=>!face.some(index=>selectedVertices.includes(index)));
      updateMesh(remapMesh(selected.mesh,faces),"Deleted selected vertex region");setSelectedVertices([]);
    }else if(componentMode==="edge"&&selectedEdges.length){
      const edges=currentEdges.filter((_,i)=>selectedEdges.includes(i));
      const faces=selected.mesh.faces.filter(face=>!edges.some(([a,b])=>face.some((v,i)=>v===a&&face[(i+1)%face.length]===b||v===b&&face[(i+1)%face.length]===a)));
      updateMesh(remapMesh(selected.mesh,faces),"Deleted faces attached to selected edge(s)");setSelectedEdges([]);
    }else setStatus("Select vertices, edges or faces first");
  };
  const moveSelected=(axis:0|1|2,direction:-1|1)=>{
    if(!selected)return;
    const indices=selectedVerticesForDisplay(selected.mesh,componentMode,selectedVertices,selectedEdges,selectedFaces);
    if(!indices.length){setStatus("Select mesh components to move");return;}
    const next={vertices:selected.mesh.vertices.map(v=>[...v] as [number,number,number]),faces:selected.mesh.faces.map(f=>[...f])};
    indices.forEach(index=>{next.vertices[index][axis]+=moveAmount*direction;});
    updateMesh(next,"Moved "+indices.length+" selected vertices");
  };
  const duplicateModel=()=>{
    if(!selected)return;
    const next={...selected,id:uid(),name:selected.name+" Copy",position:[selected.position[0]+1,selected.position[1],selected.position[2]] as [number,number,number],mesh:{vertices:selected.mesh.vertices.map(v=>[...v] as [number,number,number]),faces:selected.mesh.faces.map(f=>[...f])}};
    setModels(current=>[...current,next]);setSelectedId(next.id);
  };
  const deleteModel=()=>{
    if(!selected)return;
    setModels(current=>current.filter(model=>model.id!==selected.id));
    setSelectedId(models.find(model=>model.id!==selected.id)?.id??"");
    setEditMode(false);
  };
  const setMode=(mode:TransformMode)=>{setTransformMode(mode);setActiveTool(mode==="translate"?"Move":mode==="rotate"?"Rotate":"Scale");};
  const toggleEdit=()=>{
    setEditMode(value=>!value);setSelectedVertices([]);setSelectedEdges([]);setSelectedFaces(selected?.mesh.faces.length?[Math.min(1,selected.mesh.faces.length-1)]:[]);
    setStatus(editMode?"Object mode":"Edit mode");
  };
  const focusSelected=()=>{
    const camera=cameraRef.current,orbit=orbitRef.current;if(!camera||!orbit||!selected)return;
    const target=new THREE.Vector3(...selected.position);orbit.target.copy(target);camera.position.copy(target.clone().add(new THREE.Vector3(4,3.5,5)));orbit.update();
  };

  return <div className="wb-model-studio">
    <header className="wm-topbar">
      <div className="wm-document"><span className="wm-file-icon"><Layers3 size={15}/></span><div><input aria-label="Model name" value={selected?.name??""} placeholder="Untitled mesh" onChange={event=>selected&&updateModel(selected.id,{name:event.target.value})}/><small>MODEL ASSET <span>·</span> {selected?.primitive??"EMPTY"}</small></div></div>
      <div className="wm-top-divider"/>
      <div className="wm-mode-switch"><button className={!editMode?"active":""} onClick={()=>setEditMode(false)}>OBJECT</button><button className={editMode?"active":""} onClick={()=>setEditMode(true)}>EDIT</button><kbd>TAB</kbd></div>
      {editMode&&<div className="wm-component-modes">
        <button className={componentMode==="vertex"?"active":""} title="Vertex selection (1)" onClick={()=>{setComponentMode("vertex");setSelectedVertices([]);setSelectedEdges([]);setSelectedFaces([]);}}><Dot size={16}/> Vertex <kbd>1</kbd></button>
        <button className={componentMode==="edge"?"active":""} title="Edge selection (2)" onClick={()=>{setComponentMode("edge");setSelectedVertices([]);setSelectedEdges([]);setSelectedFaces([]);}}><MinusIcon/> Edge <kbd>2</kbd></button>
        <button className={componentMode==="face"?"active":""} title="Face selection (3)" onClick={()=>{setComponentMode("face");setSelectedVertices([]);setSelectedEdges([]);setSelectedFaces([]);}}><Square size={14}/> Face <kbd>3</kbd></button>
      </div>}
      <div className="wm-top-spacer"/>
      <button className={snapEnabled?"active":""} title="Toggle transform snapping" onClick={()=>setSnapEnabled(value=>!value)}><Magnet size={14}/> Snap</button>
      <button title="Toggle grid" className={gridVisible?"active":""} onClick={()=>setGridVisible(value=>!value)}><Grid3X3 size={14}/></button>
      <button title="Frame selected model" onClick={focusSelected}><Eye size={14}/></button>
      <button title="Toggle wireframe" className={wireframe?"active":""} onClick={()=>setWireframe(value=>!value)}><Layers3 size={14}/></button>
    </header>
    <div className="wm-main">
      <aside className="wm-tool-shelf">
        <div className="wm-shelf-heading">CREATE MESH</div>
        <div className="wm-primitive-grid">
          <button onClick={()=>createPrimitive("Cube")}><Box size={17}/><span>Cube</span></button>
          <button onClick={()=>createPrimitive("Plane")}><Square size={17}/><span>Plane</span></button>
          <button onClick={()=>createPrimitive("Cylinder")}><Cylinder size={17}/><span>Cylinder</span></button>
          <button onClick={()=>createPrimitive("UV Sphere")}><Circle size={17}/><span>UV Sphere</span></button>
        </div>
        <div className="wm-shelf-divider"/>
        <div className="wm-shelf-heading">TRANSFORM</div>
        <button className={transformMode==="translate"?"selected":""} disabled={editMode} onClick={()=>setMode("translate")}><Move size={15}/> Move <kbd>G</kbd></button>
        <button className={transformMode==="rotate"?"selected":""} disabled={editMode} onClick={()=>setMode("rotate")}><RotateCw size={15}/> Rotate <kbd>R</kbd></button>
        <button className={transformMode==="scale"?"selected":""} disabled={editMode} onClick={()=>setMode("scale")}><Scale size={15}/> Scale <kbd>S</kbd></button>
        <div className="wm-shelf-divider"/>
        <div className="wm-shelf-heading">MESH EDIT</div>
        <button disabled={!editMode||componentMode!=="face"||selectedFaces.length!==1} onClick={extrude}><Plus size={15}/> Extrude face <kbd>E</kbd></button>
        <button disabled={!editMode||componentMode!=="face"||selectedFaces.length!==1} onClick={inset}><Square size={15}/> Inset face <kbd>I</kbd></button>
        <button disabled={!editMode||componentMode!=="face"||selectedFaces.length!==1} onClick={subdivide}><Scissors size={15}/> Subdivide</button>
        <button disabled={!editMode||activeVertexIndices.length===0} onClick={deleteComponents}><Trash2 size={15}/> Delete elements</button>
        <div className="wm-shelf-divider"/>
        <div className="wm-shelf-heading">OBJECT</div>
        <button disabled={!selected} onClick={duplicateModel}><Plus size={15}/> Duplicate</button>
        <button disabled={!selected} onClick={()=>selected&&onAddToScene?.(selected)}><Plus size={15}/> Add to Scene</button>
        <button disabled={!selected} className="danger" onClick={deleteModel}><Trash2 size={15}/> Delete model</button>
      </aside>
      <section className="wm-viewport-wrap">
        <div className="wm-viewport" ref={hostRef}/>
        <div className="wm-viewport-title"><span className="wm-live"/> 3D MODEL VIEWPORT <span>·</span> {editMode?"EDIT MODE":"OBJECT MODE"} <span>·</span> {componentMode.toUpperCase()} SELECT</div>
        <div className="wm-view-axis"><span>X</span><span>Y</span><span>Z</span></div>
        <div className="wm-viewport-footer"><span>MMB Orbit</span><span>Shift + MMB Pan</span><span>Wheel Zoom</span><span>Click Select</span></div>
        {editMode&&<div className="wm-edit-hint">EDITING MESH TOPOLOGY <span>·</span> Click {componentMode} elements; Shift-click to add to selection</div>}
        {!models.length&&<div className="wm-viewport-empty">Create a mesh from the tool shelf to begin modelling.</div>}
      </section>
      <aside className="wm-properties">
        <div className="wm-properties-heading"><div><span>PROPERTIES</span><strong>{selected?.name??"No mesh selected"}</strong></div><Settings2 size={16}/></div>
        {selected?<>
          <div className="wm-property-section"><div className="wm-property-title">Mesh statistics</div><div className="wm-stat-grid">
            <div><strong>{selected.mesh.vertices.length}</strong><span>VERTICES</span></div>
            <div><strong>{currentEdges.length}</strong><span>EDGES</span></div>
            <div><strong>{selected.mesh.faces.length}</strong><span>FACES</span></div>
            <div><strong>{selected.mesh.faces.reduce((sum,face)=>sum+Math.max(0,face.length-2),0)}</strong><span>TRIS</span></div>
          </div></div>
          <div className="wm-property-section"><div className="wm-property-title">Transform</div>
            {(["position","rotation","scale"] as const).map(group=><div className="wm-vector-row" key={group}><span>{group==="position"?"Location":group==="rotation"?"Rotation":"Scale"}</span><div>{([0,1,2] as const).map(axis=><label key={axis}><i className={"axis-"+axis}>{["X","Y","Z"][axis]}</i><input type="number" step={group==="rotation"?0.05:0.1} value={selected[group][axis]} onChange={event=>{const value=[...selected[group]] as [number,number,number];value[axis]=Number(event.target.value);updateModel(selected.id,{[group]:value});}} disabled={editMode}/></label>)}</div></div>)}
          </div>
          <div className="wm-property-section"><div className="wm-property-title">Mesh appearance</div><label className="wm-color-row"><span>Viewport colour</span><input type="color" value={selected.color} onChange={event=>updateModel(selected.id,{color:event.target.value})}/></label><label className="wm-color-row"><span>Wireframe overlay</span><input type="checkbox" checked={wireframe} onChange={event=>setWireframe(event.target.checked)}/></label></div>
          {editMode&&<div className="wm-property-section"><div className="wm-property-title">Selected components</div><div className="wm-selection-count">{componentMode==="vertex"?selectedVertices.length:componentMode==="edge"?selectedEdges.length:selectedFaces.length} {componentMode} element(s)</div>
            {componentMode==="face"&&<label className="wm-number-field"><span>Extrusion distance</span><input type="number" min="0.01" max="5" step="0.05" value={extrudeAmount} onChange={event=>setExtrudeAmount(Number(event.target.value))}/></label>}
            {componentMode==="face"&&<label className="wm-number-field"><span>Inset amount</span><input type="number" min="0.01" max="0.45" step="0.01" value={insetAmount} onChange={event=>setInsetAmount(Number(event.target.value))}/></label>}
            <label className="wm-number-field"><span>Move step</span><input type="number" min="0.01" max="10" step="0.05" value={moveAmount} onChange={event=>setMoveAmount(Number(event.target.value))}/></label>
            <div className="wm-nudge-grid"><button onClick={()=>moveSelected(0,-1)}>X−</button><button onClick={()=>moveSelected(0,1)}>X+</button><button onClick={()=>moveSelected(1,-1)}>Y−</button><button onClick={()=>moveSelected(1,1)}>Y+</button><button onClick={()=>moveSelected(2,-1)}>Z−</button><button onClick={()=>moveSelected(2,1)}>Z+</button></div>
          </div>}
        </>:<div className="wm-empty-properties">Create or select a mesh object to inspect its geometry and transforms.</div>}
        <div className="wm-property-footer"><span className="wm-live"/> Saved in this browser</div>
      </aside>
    </div>
    <footer className="wm-statusbar">
      <span>{models.length} mesh object(s)</span><span>{status}</span><span>{editMode?"Tab · Object Mode": "Tab · Edit Mode"}</span>
      <div><button title="Undo last mesh operation" onClick={undoMesh} disabled={!selected||(meshHistory[selected.id]?.length??0)===0}><Undo2 size={14}/></button><button title="Redo mesh operation" onClick={redoMesh} disabled={!selected||(meshFuture[selected.id]?.length??0)===0}><Redo2 size={14}/></button></div>
    </footer>
  </div>;
}

function selectedVerticesForDisplay(mesh:MeshData,mode:ComponentMode,vertices:number[],edges:number[],faces:number[]):number[] {
  if(mode==="vertex")return vertices;
  if(mode==="edge"){
    const all=modelEdges(mesh);const result=new Set<number>();
    edges.forEach(i=>{const edge=all[i];if(edge){result.add(edge[0]);result.add(edge[1]);}});
    return [...result];
  }
  const result=new Set<number>();faces.forEach(i=>mesh.faces[i]?.forEach(index=>result.add(index)));return [...result];
}
function MinusIcon(){return <span className="wm-minus-icon"/>;}
