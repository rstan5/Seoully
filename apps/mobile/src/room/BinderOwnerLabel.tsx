/* eslint-disable react/no-unknown-property -- React Three Fiber native meshes. */
import { useEffect, useState } from "react";
import { isLoaded, renderToImageAsync } from "expo-font";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { TextureLoader, type Texture } from "three";
import { useLocale } from "../locale";
import { binderLabel, binderLabelInk } from "./binderPresentation";
import { prepCollectibleTexture } from "./roomMaterials";

export function BinderOwnerLabel({ ownerName, cover }: { ownerName: string; cover: string }) {
  const { locale }=useLocale();
  const label=binderLabel(ownerName,locale), ink=binderLabelInk(cover);
  return label.name ? <LabelLine text={label.name} font={label.fontFamily} size={label.size} ink={ink} width={label.width} /> : null;
}
function LabelLine({text,font,size,ink,width}:{text:string;font:string;size:number;ink:string;width:number}) {
  const [image,setImage]=useState<{texture:Texture;aspect:number;key:string}|null>(null);
  const key=`${font}:${text}:${size}:${ink}`;
  useEffect(()=>{
    let cancelled=false, texture:Texture|undefined;
    async function generate() {
      if(!isLoaded(font)) return;
      const raster=await renderToImageAsync(text,{fontFamily:font,size,color:ink});
      let uri=raster.uri;
      if(raster.width*raster.scale>512){
        const context=ImageManipulator.manipulate(uri).resize({width:512});
        const resized=await context.renderAsync();
        uri=(await resized.saveAsync({format:SaveFormat.PNG})).uri;
        resized.release(); context.release();
      }
      if(cancelled) return;
      texture=prepCollectibleTexture(await new TextureLoader().loadAsync(uri));
      if(cancelled) { texture.dispose(); return; }
      setImage({texture,aspect:raster.width/Math.max(1,raster.height),key});
    }
    void generate().catch(()=>{});
    return ()=>{cancelled=true;texture?.dispose();};
  },[text,font,size,ink,key]);
  if(!image || image.key!==key) return null;
  const height=Math.min(0.36,width/image.aspect);
  return <mesh position={[0.04,0,-0.042]} rotation={[0,Math.PI,0]} raycast={()=>{}}>
    <planeGeometry args={[height*image.aspect,height]} />
    <meshBasicMaterial map={image.texture} transparent depthWrite={false} toneMapped={false} />
  </mesh>;
}
