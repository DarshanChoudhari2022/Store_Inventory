type RpcError={code?:string;message:string};
export async function retailRpc(name:string,args:Record<string,unknown>):Promise<{data:unknown;error:RpcError|null;status:number}>{
 const {p_token:cacheId,...details}=args;
 try{
  const response=await fetch('/api/rpc',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({name,args:details,cacheId})});
  const result=await response.json() as {data?:unknown;error?:RpcError};
  return {data:result.data??null,error:result.error??(response.ok?null:{message:'Service temporarily unavailable'}),status:response.status};
 }catch{return {data:null,error:{message:'Failed to fetch'},status:503};}
}
