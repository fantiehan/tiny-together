import * as THREE from 'three';

// One atlas load and one set of reusable crops for the entire game. Restarting
// a run only replaces Object3Ds; it never creates another image or texture set.
const library=new Map(),tiles=new Map();
let loading=false;
const presets={
  biscuit:{roughness:.94,metalness:0,bumpScale:.012},
  plush:{roughness:.87,metalness:0,clearcoat:.025,clearcoatRoughness:.85,sheen:.58,sheenRoughness:.92,bumpScale:.0022},
  candy:{roughness:.23,metalness:.025,clearcoat:.85,clearcoatRoughness:.14,bumpScale:.0008},
  jelly:{roughness:.22,metalness:0,clearcoat:.42,clearcoatRoughness:.18,transparent:true,opacity:.94,depthWrite:true,ior:1.38,thickness:.3,bumpScale:.001},
};

function fallbackTexture(){
  if(tiles.has('fallback'))return tiles.get('fallback');
  const pixels=new Uint8Array(64*64*4);let seed=193;
  for(let i=0;i<64*64;i++){seed=(seed*1664525+1013904223)>>>0;const n=210+(seed>>>27);pixels.set([n,n,n,255],i*4);}
  const t=new THREE.DataTexture(pixels,64,64,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,3);t.magFilter=THREE.LinearFilter;t.needsUpdate=true;tiles.set('fallback',t);return t;
}
function configureTexture(canvas,color=false){
  const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);t.anisotropy=2;
  t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;return t;
}
function attachMaps(mat,kind){
  const tile=tiles.get(kind);
  if(!tile)return;
  mat.map=tile.color;mat.roughnessMap=tile.height;mat.bumpMap=tile.height;mat.needsUpdate=true;
}
function loadAtlas(){
  if(loading||typeof window==='undefined'||typeof document==='undefined')return;
  loading=true;
  const base=import.meta.env?.BASE_URL||'/';
  new THREE.TextureLoader().load(`${base}art/creature-materials-v2.jpg`,source=>{
    const image=source.image,w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
    ['biscuit','plush','candy','jelly'].forEach((kind,index)=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
      const ctx=canvas.getContext('2d');if(!ctx)return;
      const inset=Math.max(3,Math.floor(Math.min(w,h)*.005));
      ctx.drawImage(image,index%2*w/2+inset,Math.floor(index/2)*h/2+inset,w/2-inset*2,h/2-inset*2,0,0,512,512);
      const pixels=ctx.getImageData(0,0,512,512),data=pixels.data;
      let mean=0;for(let i=0;i<data.length;i+=4)mean+=data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;mean/=data.length/4;
      const heightCanvas=document.createElement('canvas');heightCanvas.width=heightCanvas.height=512;
      const hc=heightCanvas.getContext('2d'),height=hc.createImageData(512,512);
      const strength=kind==='biscuit'?.63:kind==='plush'?.38:.16;
      for(let i=0;i<data.length;i+=4){
        const lum=data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;
        const tint=Math.max(192,Math.min(255,243+(lum-mean)*strength));
        const relief=Math.max(40,Math.min(255,205+(lum-mean)*1.1));
        data[i]=data[i+1]=data[i+2]=tint;
        height.data[i]=height.data[i+1]=height.data[i+2]=relief;height.data[i+3]=255;
      }
      ctx.putImageData(pixels,0,0);hc.putImageData(height,0,0);
      tiles.set(kind,{color:configureTexture(canvas,true),height:configureTexture(heightCanvas)});
    });
    for(const entry of library.values())attachMaps(entry.material,entry.kind);
    source.dispose();source.image=null;
  },undefined,()=>{/* The small procedural grain remains usable offline. */});
}

export function creatureMaterial(kind,color,extra={}){
  const key=`${kind}:${color}:${JSON.stringify(extra)}`;
  if(!library.has(key)){
    const options={color,...presets[kind],...extra,roughnessMap:fallbackTexture(),bumpMap:fallbackTexture()};
    if(kind==='plush')options.sheenColor=new THREE.Color(color).lerp(new THREE.Color('#fff4df'),.28);
    const mat=kind==='biscuit'?new THREE.MeshStandardMaterial(options):new THREE.MeshPhysicalMaterial(options);
    mat.name=`${kind}-${color}`;library.set(key,{material:mat,kind});attachMaps(mat,kind);
  }
  loadAtlas();return library.get(key).material;
}

// White hit feedback uses a separate, shared immutable material. Switching one
// mesh to it cannot change the base appearance of another enemy instance.
const hitMaterial=new THREE.MeshStandardMaterial({color:'#fff9e9',emissive:'#fff1d2',emissiveIntensity:.48,roughness:.55});
export function flashWhite(root,weight){
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    if(weight>.08){if(!mesh.userData.hitBaseMaterial)mesh.userData.hitBaseMaterial=mesh.material;mesh.material=hitMaterial;}
    else if(mesh.userData.hitBaseMaterial){mesh.material=mesh.userData.hitBaseMaterial;delete mesh.userData.hitBaseMaterial;}
  });
}
