import "server-only";
/** Enforce the metadata boundary while streaming, including chunked requests. */
export async function readUploadJson(request: Request) {
  if(!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new Error("invalid_upload_payload");
  const reader=request.body?.getReader();
  if(!reader) throw new Error("invalid_upload_payload");
  const chunks:Uint8Array[]=[];let size=0;
  try {
    while(true) {
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;if(size>16384) throw new Error("upload_payload_too_large");
      chunks.push(value);
    }
  } finally {await reader.cancel();}
  const buffer=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(buffer));
}
