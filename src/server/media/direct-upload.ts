import "server-only";
import { type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createHash } from "node:crypto";
import { verifyImage } from "./verify-image";
import { createMediaStorageAdmin as serverStorage } from "./storage-admin";
import { getCurrentIdentityFromClient } from "@/server/dal/profile";
import { getProductionPost } from "@/server/dal/social";

const uuid = z.string().uuid();
const media = z.object({ mimeType: z.enum(["image/jpeg","image/png","image/webp","video/mp4","video/webm","video/quicktime"]), byteSize: z.number().int().positive().max(52428800) }).strict();
export const uploadSchema = z.object({
  id: uuid, purpose: z.enum(["holding","catalog","avatar","post"]), contextId: uuid.optional(),
  sourceKey: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  media: media.nullable(), caption: z.string().trim().max(2000).default(""), location: z.string().trim().max(160).default(""),
  taggedUserIds: z.array(uuid).max(10).default([]), taggedTemplateIds: z.array(uuid).max(10).default([]),
}).strict().superRefine((p, ctx) => {
  if ((p.purpose === "holding" || p.purpose === "catalog") !== Boolean(p.contextId)) ctx.addIssue({ code:"custom",message:"invalid_context" });
  if (p.purpose !== "post" && (!p.media || p.caption || p.location || p.taggedUserIds.length || p.taggedTemplateIds.length)) ctx.addIssue({code:"custom",message:"invalid_purpose"});
  if (p.media && p.purpose !== "post" && (p.media.byteSize > (p.purpose === "avatar" ? 5242880 : 10485760) || !p.media.mimeType.startsWith("image/") || (p.purpose === "avatar" && p.media.mimeType !== "image/jpeg"))) ctx.addIssue({code:"custom",message:"invalid_media"});
  if (p.purpose === "post" && !p.media && !p.caption && !p.taggedUserIds.length && !p.taggedTemplateIds.length) ctx.addIssue({code:"custom",message:"invalid_post_content"});
});
type Upload = z.infer<typeof uploadSchema>;
const staging = "media-upload-staging";
function destination(owner: string,p: Upload) {
  const bucket = {holding:"collectible-media",catalog:"catalog-reference-images",avatar:"profile-avatars",post:"post-media"}[p.purpose];
  const path = p.purpose === "catalog" ? `${owner}/${p.contextId}/${p.id}` : `${owner}/${p.id}${p.purpose === "holding" ? "/original" : p.purpose === "post" ? "/0" : ".jpg"}`;
  return {bucket,path};
}
async function actor(client: SupabaseClient) {
  const identity = await getCurrentIdentityFromClient(client);
  if (!identity) throw new Error("unauthenticated");
  return identity.user.id;
}
async function authorize(owner: string,p: Upload,client: SupabaseClient) {
  if (p.purpose === "holding") {
    const r=await client.from("holdings").select("id").eq("id",p.contextId!).eq("owner_user_id",owner).maybeSingle();
    if(r.error || !r.data) throw new Error("upload_not_authorized");
  }
  if(p.purpose === "catalog") {
    const template=await client.from("collectible_templates").select("id").eq("id",p.contextId!).neq("status","restricted").maybeSingle();
    if(template.error || !template.data) throw new Error("upload_not_authorized");
    const a=await client.from("holdings").select("id").eq("template_id",p.contextId!).eq("owner_user_id",owner).limit(1).maybeSingle();
    const b=await client.from("catalog_contributions").select("template_id").eq("template_id",p.contextId!).eq("contributor_user_id",owner).limit(1).maybeSingle();
    if(a.error || b.error || (!a.data && !b.data)) throw new Error("upload_not_authorized");
  }
  if(p.taggedUserIds.length) {
    const r=await client.from("profiles").select("user_id").in("user_id",p.taggedUserIds);
    if(r.error || r.data?.length !== p.taggedUserIds.length) throw new Error("invalid_user_tag");
  }
  if(p.taggedTemplateIds.length) {
    const r=await client.from("collectible_templates").select("id").in("id",p.taggedTemplateIds).neq("status","restricted").in("publication_state",["published","needs-media"]);
    if(r.error || r.data?.length !== p.taggedTemplateIds.length) throw new Error("invalid_collectible_tag");
  }
}
export async function authorizeUpload(input: unknown,client: SupabaseClient) {
  const p=uploadSchema.parse(input); p.taggedUserIds=[...new Set(p.taggedUserIds)].sort(); p.taggedTemplateIds=[...new Set(p.taggedTemplateIds)].sort();
  const owner=await actor(client); await authorize(owner,p,client);
  const admin=serverStorage();
  const inserted=await admin.from("media_upload_jobs").upsert({owner_id:owner,id:p.id,payload:p},{onConflict:"owner_id,id",ignoreDuplicates:true});
  if(inserted.error) throw new Error("upload_unavailable");
  const job=await admin.from("media_upload_jobs").select("payload,result,expires_at,created_at").eq("owner_id",owner).eq("id",p.id).single();
  if(job.error || !job.data) throw new Error("upload_unavailable");
  // Compare normalized JSON, not property insertion order across JSONB transport.
  const original=uploadSchema.parse(job.data.payload);
  if(Object.keys(p).some(key=>JSON.stringify(p[key as keyof Upload])!==JSON.stringify(original[key as keyof Upload]))) throw new Error("upload_retry_changed");
  if(job.data.result) return {id:p.id,uploaded:true,completed:true};
  if(Date.parse(job.data.expires_at)<=Date.now()) {
    const renewed=await admin.rpc("renew_media_upload",{p_owner:owner,p_id:p.id});
    if(renewed.error) throw new Error("upload_busy");
  }
  if(!p.media) return {id:p.id,uploaded:true,completed:false};
  const path=`${owner}/${p.id}`;
  const info=await admin.storage.from(staging).info(path);
  if(info.data) return {id:p.id,uploaded:true,completed:false};
  const signed=await admin.storage.from(staging).createSignedUploadUrl(path,{upsert:false});
  if(signed.error || !signed.data) throw new Error("upload_unavailable");
  return {id:p.id,uploaded:false,completed:false,bucket:staging,path,token:signed.data.token};
}
export function matchesSignature(type: string,b: Uint8Array) {
  if(type==="image/jpeg") return b[0]===255 && b[1]===216 && b[2]===255;
  if(type==="image/png") return b.length>=8 && [137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v);
  if(type==="image/webp") return b.length>=12 && String.fromCharCode(...b.slice(0,4))==="RIFF" && String.fromCharCode(...b.slice(8,12))==="WEBP";
  if(type==="video/webm") return b[0]===26 && b[1]===69 && b[2]===223 && b[3]===163;
  return (type==="video/mp4" || type==="video/quicktime") && b.length>=8 && String.fromCharCode(...b.slice(4,8))==="ftyp";
}
async function verifyStored(admin: SupabaseClient,path: string,expected: NonNullable<Upload["media"]>,bucket=staging) {
  const info=await admin.storage.from(bucket).info(path);
  if(info.error || !info.data || info.data.size!==expected.byteSize || info.data.contentType!==expected.mimeType) throw new Error("upload_metadata_mismatch");
  const signed=await admin.storage.from(bucket).createSignedUrl(path,60);
  if(signed.error || !signed.data) throw new Error("upload_unavailable");
  const full=await fetch(signed.data.signedUrl,{cache:"no-store",signal:AbortSignal.timeout(30000)});
  const reader=full.body?.getReader();
  if(!full.ok || !reader) throw new Error("upload_verification_failed");
  const chunks:Uint8Array[]=[];let size=0;const hash=createHash("sha256");
  const header=new Uint8Array(16);let headerSize=0;
  try {
    while(true){
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;if(size>expected.byteSize)throw new Error("upload_metadata_mismatch");
      hash.update(value);
      const head=value.subarray(0,Math.min(16-headerSize,value.byteLength));header.set(head,headerSize);headerSize+=head.byteLength;
      if(expected.mimeType.startsWith("image/"))chunks.push(value);
    }
  } finally {await reader.cancel();}
  if(size!==expected.byteSize) throw new Error("upload_metadata_mismatch");
  if(!matchesSignature(expected.mimeType,header.subarray(0,headerSize))) throw new Error("invalid_media");
  if(expected.mimeType.startsWith("image/")) {
    const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.byteLength;}
    await verifyImage(all,expected.mimeType);
  }
  return hash.digest("hex");
}
export async function completeUpload(id: unknown,client: SupabaseClient) {
  const parsed=uuid.parse(id),owner=await actor(client),admin=serverStorage();
  const job=await admin.from("media_upload_jobs").select("payload,result,expires_at,created_at").eq("owner_id",owner).eq("id",parsed).maybeSingle();
  if(job.error || !job.data) throw new Error("upload_not_found");
  const p=uploadSchema.parse(job.data.payload); const target=destination(owner,p);
  if(job.data.result && (p.purpose==="holding" || p.purpose==="catalog")) await authorize(owner,p,client);
  if(!job.data.result) {
    if(Date.parse(job.data.expires_at)<=Date.now()) throw new Error("upload_expired");
    await authorize(owner,p,client);
    if(p.media) {
      const digest=await verifyStored(admin,`${owner}/${parsed}`,p.media);
      const copied=await admin.storage.from(staging).copy(`${owner}/${parsed}`,target.path,{destinationBucket:target.bucket});
      if(copied.error) {
        if(!["409","Duplicate"].includes(String(copied.error.statusCode)) && !copied.error.message.toLowerCase().includes("already exists")) throw new Error("upload_copy_failed");
        if(await verifyStored(admin,target.path,p.media,target.bucket)!==digest) throw new Error("upload_copy_failed");
      } else {
        const tracked=await admin.from("media_upload_jobs").update({destination_created:true}).eq("owner_id",owner).eq("id",parsed);
        if(tracked.error) throw new Error("upload_completion_failed");
      }
    }
  }
  const completed=await admin.rpc("complete_media_upload",{p_owner:owner,p_id:parsed});
  if(completed.error || !completed.data) throw new Error("upload_completion_failed");
  if(completed.data.canceled) throw new Error("upload_canceled");
  // Do not delete staged bytes here: concurrent completion may still be verifying.
  // Expired staging cleanup is an operational job, separate from collector actions.
  if(p.purpose==="post") {
    const post=await getProductionPost(completed.data.postId,client);
    if(!post) throw new Error("post_read_failed");
    return {post};
  }
  if(p.purpose==="avatar") return {avatarSubmissionId:parsed};
  const signed=await client.storage.from(target.bucket).createSignedUrl(target.path,3600);
  if(signed.error || !signed.data) throw new Error("upload_delivery_failed");
  if(p.purpose==="catalog") return {image:{id:parsed,templateId:p.contextId,contributedByUserId:owner,sourceType:"community_contribution",status:"active",mimeType:p.media!.mimeType,byteSize:p.media!.byteSize,url:signed.data.signedUrl,createdAt:job.data.created_at}};
  return {asset:{id:parsed,holdingId:p.contextId,mimeType:p.media!.mimeType,byteSize:p.media!.byteSize,width:null,height:null,url:signed.data.signedUrl,createdAt:job.data.created_at}};
}

/** Operational hook only: no public endpoint, timer, or production schedule is installed. */
export async function cleanupExpiredUploads() {
  const admin=serverStorage();
  const claimed=await admin.rpc("claim_media_upload_cleanup",{p_limit:25});
  if(claimed.error || !Array.isArray(claimed.data)) throw new Error("upload_cleanup_failed");
  let cleaned=0;
  for(const job of claimed.data) {
    const p=uploadSchema.parse(job.payload);
    const stage=await admin.storage.from(staging).remove([`${job.owner_id}/${job.id}`]);
    if(stage.error) continue;
    if((!job.result || job.result.canceled) && p.media && job.destination_created) {
      const target=destination(job.owner_id,p);
      const removed=await admin.storage.from(target.bucket).remove([target.path]);
      if(removed.error) continue;
    }
    // Compare the lease so an expired worker cannot acknowledge another worker's claim.
    const done=await admin.from("media_upload_jobs").update({staging_cleaned_at:new Date().toISOString(),cleanup_claimed_at:null})
      .eq("owner_id",job.owner_id).eq("id",job.id).eq("cleanup_claimed_at",job.cleanup_claimed_at);
    if(!done.error) cleaned++;
  }
  return {cleaned};
}

export async function abandonPostUpload(id:unknown,client:SupabaseClient) {
  const owner=await actor(client),parsed=uuid.parse(id),admin=serverStorage();
  const result=await admin.rpc("abandon_media_post",{p_owner:owner,p_id:parsed});
  if(result.error || !result.data) throw new Error("upload_completion_failed");
  return {canceled:result.data.canceled===true,alreadyPublished:typeof result.data.postId==="string"};
}
