import { ImageResponse } from "next/og";
export function GET(request: Request) {
 const n = new URL(request.url).searchParams.get("size");
 const size = n === "512" ? 512 : n === "192" ? 192 : 180;
 return new ImageResponse(<div style={{display:"flex",width:"100%",height:"100%",background:"#ffffff",alignItems:"center",justifyContent:"center"}}><svg width={size*0.78} height={size*0.78} viewBox="0 0 64 64"><path d="M14 42V26c0-10 15-10 15 0v16m0-16c0-10 15-10 15 0v16" fill="none" stroke="#254944" strokeWidth="5" strokeLinecap="round"/><path d="M49 32h8" stroke="#79b5a8" strokeWidth="4" strokeLinecap="round"/></svg></div>, {width:size,height:size});
}
