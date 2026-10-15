import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from "expo-file-system";
import { digestStringAsync, CryptoDigestAlgorithm, randomUUID } from "expo-crypto";
import { supabase } from "../supabase";

type Purpose = "holding" | "catalog" | "avatar" | "post";
type Input = { purpose: Purpose; contextId?: string; caption?: string; taggedUserIds?: string[]; taggedTemplateIds?: string[] };
const flights=new Map<string,{intent:string;promise:Promise<Record<string, unknown>>}>();
/** Only the signed Storage request carries bytes; product API calls contain bounded JSON. */
export async function directUpload(base: string,uri: string|null,input: Input,stableId?: string): Promise<Record<string, unknown>> {
  const {data}=await supabase.auth.getSession();
  if(!data.session) throw new Error("unauthenticated");
  const session=data.session;
  const fingerprint=await digestStringAsync(CryptoDigestAlgorithm.SHA256,JSON.stringify(input.purpose==="post" && stableId ? [session.user.id,"post",stableId] : [session.user.id,uri,input,stableId]));
  const key=`seoully:upload:v1:${fingerprint}`;
  const intent=await digestStringAsync(CryptoDigestAlgorithm.SHA256,JSON.stringify([uri,input]));
  const existing=flights.get(key); if(existing) { if(existing.intent!==intent) throw new Error("upload_busy"); return existing.promise; }
  const flight=(async()=>{
    const stored=await AsyncStorage.getItem(key);
    let draft=stored?JSON.parse(stored) as {id:string;media:{mimeType:string;byteSize:number}|null;uri?:string|null}:null;
    if(!draft) {
      const file=uri?new File(uri):null;
      if(file && (!file.exists || file.size<=0)) throw new Error("media_local_file_unreadable");
      draft={id:stableId??randomUUID(),media:file?{mimeType:file.type,byteSize:file.size}:null,uri};
      await AsyncStorage.setItem(key,JSON.stringify(draft));
    }
    const headers={Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"};
    async function request(path: string,body?: unknown) {
      const response=await fetch(`${base}/api/mobile/uploads${path}`,{method:"POST",headers,body:body?JSON.stringify(body):undefined}).catch(()=>{throw new Error("network_failure");});
      const value=await response.json().catch(()=>null);
      if(!response.ok || !value) throw Object.assign(new Error(value?.error??"upload_unavailable"),{status:response.status});
      return value;
    }
    const file=uri?new File(uri):null;
    const desiredMedia=file?.exists?{mimeType:file.type,byteSize:file.size}:uri===draft.uri?draft.media:null;
    if(uri && !desiredMedia) throw new Error("media_local_file_unreadable");
    const sourceKey=await digestStringAsync(CryptoDigestAlgorithm.SHA256,uri??"text-only");
    const payload=()=>({...input,id:draft!.id,media:desiredMedia,sourceKey});
    let authorization;
    try {authorization=await request("",payload());}
    catch(error) {
      if(input.purpose!=="post" || !(error instanceof Error) || error.message!=="upload_retry_changed") throw error;
      const abandoned=await request(`/${draft.id}/abandon`);
      if(!abandoned.canceled) throw new Error("post_already_shared");
      draft={id:randomUUID(),media:desiredMedia,uri};
      await AsyncStorage.setItem(key,JSON.stringify(draft));
      authorization=await request("",payload());
    }
    draft={...draft,media:desiredMedia,uri};
    await AsyncStorage.setItem(key,JSON.stringify(draft));
    if(!authorization.uploaded) {
      if(!uri || authorization.bucket!=="media-upload-staging" || typeof authorization.path!=="string" || !new RegExp(`^[a-f0-9-]{36}/${draft.id}$`, "i").test(authorization.path) || typeof authorization.token!=="string") throw new Error("invalid_upload_authorization");
      const file=new File(uri);
      if(!file.exists || file.size!==desiredMedia?.byteSize || file.type!==desiredMedia.mimeType) throw new Error("media_local_file_unreadable");
      // SDK accepts ArrayBuffer; never send the native file or bearer token to an arbitrary URL.
      const bytes=await file.arrayBuffer();
      const uploaded=await supabase.storage.from("media-upload-staging").uploadToSignedUrl(authorization.path,authorization.token,bytes,{contentType:desiredMedia.mimeType});
      if(uploaded.error) throw new Error("media_upload_failed");
    }
    const result=await request(`/${draft.id}`);
    // Keep the receipt key until the owning workflow replaces its draft UUID.
    // A crash after HTTP success but before clearing the composer still recovers it.
    return result;
  })().finally(()=>flights.delete(key));
  flights.set(key,{intent,promise:flight});return flight;
}
