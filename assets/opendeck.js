/* ProDecked — open a .pptx the user picked, with plain-language reasons when it can't be opened.
   PDOpen.open(file, {salvage}) → {zip, salvaged:null | {recovered, lost:[names]}}
   - Can't read the file from the device (cloud placeholder, file still open/locked) → says so
   - Password-protected .pptx (an encrypted Office container) → how to remove the password
   - Old .ppt renamed to .pptx, a PDF, Keynote, or a Word/Excel file → says what it really is
   - A damaged zip (cut-off download, broken copy) → with {salvage:true}, rebuilds the package
     from the file's own entries so Repair PPT can fix the rest; otherwise points to Repair PPT.
   Needs JSZip on the page. Salvage needs DecompressionStream (all current browsers). */
(function(root){
"use strict";

const oops=msg=>{const e=new Error(msg);e.name="PDOpenError";return e};
const isSig=(u,i,a,b)=>u[i]===0x50&&u[i+1]===0x4b&&u[i+2]===a&&u[i+3]===b;
function hasUtf16(u,word){
  const pat=[];for(const ch of word){pat.push(ch.charCodeAt(0),0)}
  const max=Math.min(u.length,4*1024*1024)-pat.length; /* the directory sits near the start */
  outer:for(let i=0;i<max;i++){for(let j=0;j<pat.length;j++)if(u[i+j]!==pat[j])continue outer;return true}
  return false;
}
async function inflateRaw(bytes){
  const ds=new DecompressionStream("deflate-raw");
  const res=new Response(new Blob([bytes]).stream().pipeThrough(ds));
  return new Uint8Array(await res.arrayBuffer());
}

/* Walk the local file headers one by one and keep every entry that still decompresses.
   This is what rescues a .pptx whose end (the zip's table of contents) is cut off or broken. */
async function salvageZip(buf){
  const u=new Uint8Array(buf),dv=new DataView(buf);const zip=new JSZip();const lost=[];let recovered=0;
  const nextSig=from=>{for(let i=from;i<u.length-3;i++){if(u[i]!==0x50||u[i+1]!==0x4b)continue;
    if(isSig(u,i,3,4)||isSig(u,i,1,2)||isSig(u,i,5,6))return i}return u.length};
  const dec=new TextDecoder();
  let p=isSig(u,0,3,4)?0:nextSig(0);
  while(p<u.length-30&&isSig(u,p,3,4)){
    const flags=dv.getUint16(p+6,true),method=dv.getUint16(p+8,true),csize=dv.getUint32(p+18,true);
    const nlen=dv.getUint16(p+26,true),xlen=dv.getUint16(p+28,true);
    const name=dec.decode(u.subarray(p+30,p+30+nlen)).replace(/\\/g,"/").replace(/^\/+/,"");
    const start=p+30+nlen+xlen;let end;const cands=[];
    if(!(flags&8)&&csize!==0xffffffff&&(csize>0||method===0)){end=start+csize;if(end<=u.length)cands.push(u.subarray(start,end))}
    else{
      end=nextSig(start);const seg=u.subarray(start,end);const L=seg.length;
      for(const cut of [16,24]){if(L>=cut&&isSig(seg,L-cut,7,8))cands.push(seg.subarray(0,L-cut))}
      if(L>=12)cands.push(seg.subarray(0,L-12));
      cands.push(seg);
    }
    if(name&&!name.endsWith("/")){
      let data=null;
      for(const c of cands){try{data=method===0?c.slice():method===8?await inflateRaw(c):null;if(data)break}catch(e){data=null}}
      if(data){zip.file(name,data);recovered++}else lost.push(name);
    }
    const np=Math.max(end,start+1);
    if(np>=u.length)break;
    p=isSig(u,np,3,4)?np:nextSig(np);
  }
  return{zip,recovered,lost};
}

async function open(file,{salvage=false}={}){
  const name=file.name||"This file";
  let buf;
  try{buf=await file.arrayBuffer()}
  catch(e){throw oops(`${name} couldn't be read from your device. If it's in OneDrive, Google Drive or iCloud, make sure it's fully downloaded (not just a shortcut). If it's open in PowerPoint, close it and pick it again.`)}
  const u=new Uint8Array(buf);
  if(!u.length)throw oops(`${name} is empty (0 bytes). The copy on your device may not have finished saving or downloading.`);
  /* an Office "compound file": either a password-protected .pptx or an old .ppt */
  if(u[0]===0xD0&&u[1]===0xCF&&u[2]===0x11&&u[3]===0xE0){
    if(hasUtf16(u,"EncryptionInfo"))
      throw oops(`${name} is password-protected, so it can't be opened here. In PowerPoint, go to File → Info → Protect Presentation → Encrypt with Password, delete the password, save, and try again.`);
    if(hasUtf16(u,"PowerPoint Document"))
      throw oops(`${name} is an old-style PowerPoint file (.ppt, PowerPoint 2003 or earlier). Open it in PowerPoint and use File → Save As → PowerPoint Presentation (.pptx), or upload it to Google Slides and download it as .pptx. Then try again.`);
    throw oops(`${name} is an old-style Office file, not a .pptx. Open it in PowerPoint, save it as a .pptx, and try again.`);
  }
  if(u[0]===0x25&&u[1]===0x50&&u[2]===0x44&&u[3]===0x46)
    throw oops(`${name} is actually a PDF with a .pptx name. These tools need a real PowerPoint file.`);
  if(!(u[0]===0x50&&u[1]===0x4b))
    throw oops(`${name} isn't a PowerPoint (.pptx) file inside, even though its name says so. Open it in PowerPoint and save it as a .pptx.`);
  let zip=null;
  try{zip=await JSZip.loadAsync(buf)}catch(e){zip=null}
  if(zip){
    if(zip.file("ppt/presentation.xml"))return{zip,salvaged:null};
    if(zip.file("word/document.xml"))throw oops(`${name} is a Word document renamed to .pptx.`);
    if(zip.file("xl/workbook.xml"))throw oops(`${name} is an Excel file renamed to .pptx.`);
    if(zip.file("index.apxl")||zip.file("Index/Document.iwa"))throw oops(`${name} is a Keynote file. In Keynote, use File → Export To → PowerPoint, then try again.`);
    if(!salvage)throw oops(`${name} isn't a PowerPoint file inside (no presentation found).`);
  }
  const tooDamaged=`${name} is too damaged to open in the browser. Try PowerPoint's own repair: File → Open → select the file → click the arrow next to Open → Open and Repair.`;
  if(!salvage)throw oops(`${name} is damaged, so this tool can't open it. Run it through Repair PPT first (prodecked.com/repair-ppt), then come back with the repaired copy.`);
  if(typeof DecompressionStream==="undefined")throw oops(tooDamaged+" (Or update your browser and try Repair PPT again.)");
  const s=await salvageZip(buf);
  if(!s.recovered||!s.zip.file("ppt/presentation.xml"))throw oops(tooDamaged);
  return{zip:s.zip,salvaged:{recovered:s.recovered,lost:s.lost}};
}

const API={open,salvageZip};
if(typeof module!=="undefined"&&module.exports)module.exports=API;else root.PDOpen=API;
})(typeof window!=="undefined"?window:globalThis);
