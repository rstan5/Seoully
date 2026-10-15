/** Parse only this app's explicit callback, never exchange an arbitrary deep-link URL. */
export function callbackCode(value: string | null): string | null {
  if(!value) return null;
  try {
    const url=new URL(value);
    if(url.protocol!=="seoully:" || url.username || url.password || url.port || url.hash) return null;
    const route=(url.host+url.pathname).replace(/^\/+|\/+$/g,"");
    if(route!=="auth/callback" || url.searchParams.has("error")) return null;
    const flows=url.searchParams.getAll("sb_flow_id");
    if(flows.length>1 || (flows.length===1 && !/^[a-zA-Z0-9_-]{8,64}$/.test(flows[0]))) return null;
    const codes=url.searchParams.getAll("code");
    if(codes.length!==1 || !codes[0] || codes[0].length>4096 || /[\s\u0000-\u001f\u007f]/.test(codes[0])) return null;
    return codes[0];
  } catch {return null;}
}
export function createCallbackHandler(exchange:(code:string,options?:{flowId:string})=>Promise<{error:unknown}>) {
  const consumed=new Set<string>(); let active=true;
  return {
    async handle(value:string|null) {
      const code=callbackCode(value);
      if(!active || !code || consumed.has(code)) return false;
      consumed.add(code);
      const flowId=new URL(value!).searchParams.get("sb_flow_id");
      try {return !(await exchange(code,flowId?{flowId}:undefined)).error;} catch {return false;}
    },
    dispose() {active=false;consumed.clear();},
  };
}
