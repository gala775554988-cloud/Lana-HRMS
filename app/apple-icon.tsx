import { ImageResponse } from "next/og";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export default function AppleIcon() {
  return new ImageResponse(
    <div style={{display:"flex",width:"100%",height:"100%",background:"#ffffff",alignItems:"center",justifyContent:"center"}}>
      <svg width="150" height="150" viewBox="0 0 64 64"><path d="M14 42V26c0-10 15-10 15 0v16m0-16c0-10 15-10 15 0v16" fill="none" stroke="#254944" strokeWidth="5" strokeLinecap="round"/><path d="M49 32h8" stroke="#79b5a8" strokeWidth="4" strokeLinecap="round"/></svg>
    </div>, size
  );
}
