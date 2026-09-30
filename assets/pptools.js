/* ProDecked — package-level tools that sit beside the Deck Studio engine:
   compress images, repair package structure, remove speaker notes, extract images/text.
   Browser only for compress (needs canvas); the rest also run in Node. */
(function(root){
"use strict";
const REL_NS="http://schemas.openxmlformats.org/package/2006/relationships";
const T_SLIDE="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide";
const MIME={png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",bmp:"image/bmp",tif:"image/tiff",tiff:"image/tiff",
  emf:"image/x-emf",wmf:"image/x-wmf",svg:"image/svg+xml",mp4:"video/mp4",m4v:"video/mp4",mov:"video/quicktime",wmv:"video/x-ms-wmv",
  mp3:"audio/mpeg",m4a:"audio/mp4",wav:"audio/wav",xml:"application/xml",rels:"application/vnd.openxmlformats-package.relationships+xml",
  bin:"application/vnd.openxmlformats-officedocument.oleObject",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  fntdata:"application/x-fontdata",odttf:"application/vnd.openxmlformats-officedocument.obfuscatedFont",jfif:"image/jpeg",webp:"image/webp"};
const fmtBytes=n=>n>=1048576?(n/1048576).toFixed(n>=10485760?0:1)+" MB":n>=1024?Math.round(n/1024)+" KB":n+" B";
const extOf=n=>(n.match(/\.([^.\/]+)$/)||[])[1]?.toLowerCase()||"";
const relsFor=name=>name.replace(/^(.*)\/([^/]+)$/,"$1/_rels/$2.rels");
const partFromRels=rn=>rn.replace(/_rels\/([^/]+)\.rels$/,"$1");
function resolve(fromPart,target){
  if(target.startsWith("/"))return target.slice(1);
  const parts=fromPart.split("/");parts.pop();
  for(const s of target.split("/")){if(s==="..")parts.pop();else if(s&&s!==".")parts.push(s)}
  return parts.join("/");
}
function relsList(xml){
  const out=[];const re=/<Relationship\b([^>]*?)\/?>/g;let m;
  while((m=re.exec(xml))){const a=m[1];const g=k=>(a.match(new RegExp(`\\b${k}="([^"]*)"`))||[])[1];
    out.push({raw:m[0],id:g("Id"),type:g("Type")||"",target:(g("Target")||"").replace(/&amp;/g,"&"),external:g("TargetMode")==="External"})}
  return out;
}
async function mediaSizes(zip){
  const out=[];
  for(const n of Object.keys(zip.files).filter(n=>/^ppt\/media\//.test(n)&&!zip.files[n].dir)){
    const u=await zip.file(n).async("uint8array");out.push({name:n,size:u.length,ext:extOf(n)});
  }
  return out.sort((a,b)=>b.size-a.size);
}
async function allRels(zip){
  const list=[];
  for(const rn of Object.keys(zip.files).filter(n=>/\.rels$/.test(n)&&!zip.files[n].dir)){
    const xml=await zip.file(rn).async("string");const src=rn==="_rels/.rels"?"":partFromRels(rn);
    list.push({rn,src,xml,rels:relsList(xml)});
  }
  return list;
}
/* which media files are referenced by any relationship */
async function referencedParts(zip){
  const refs=new Set();
  for(const r of await allRels(zip))for(const x of r.rels)if(!x.external)refs.add(resolve(r.src||"x",x.target).replace(/^\//,""));
  return refs;
}

/* ------------------------------------------------------------ compress (browser) */
async function decodeImage(bytes,mime){
  const blob=new Blob([bytes],{type:mime});
  if(typeof createImageBitmap==="function"){try{return await createImageBitmap(blob)}catch(e){}}
  return await new Promise((res,rej)=>{const img=new Image();const u=URL.createObjectURL(blob);img.onload=()=>{URL.revokeObjectURL(u);res(img)};img.onerror=()=>{URL.revokeObjectURL(u);rej(new Error("decode"))};img.src=u});
}
function canvasFor(w,h){if(typeof OffscreenCanvas!=="undefined")return new OffscreenCanvas(w,h);const c=document.createElement("canvas");c.width=w;c.height=h;return c}
async function canvasBlob(cv,type,q){
  if(cv.convertToBlob)return await cv.convertToBlob({type,quality:q});
  return await new Promise(r=>cv.toBlob(r,type,q));
}
function hasAlpha(ctx,w,h){
  const d=ctx.getImageData(0,0,w,h).data;const step=Math.max(4,Math.floor(d.length/4/40000)*4);
  for(let i=3;i<d.length;i+=step)if(d[i]<250)return true;return false;
}
/* level: {maxPx, quality} */
const LEVELS={
  light:{maxPx:2560,quality:0.85,label:"Light — sharpest, smaller savings"},
  balanced:{maxPx:1920,quality:0.78,label:"Balanced — recommended for projection"},
  strong:{maxPx:1280,quality:0.68,label:"Strong — smallest file, fine for sharing"}
};
async function compressDeck(zip,{level="balanced",pngToJpg=true,removeUnused=true,onProgress}={}){
  const L=LEVELS[level]||LEVELS.balanced;const report=[];let saved=0;
  const refs=await referencedParts(zip);
  let removed=0,removedBytes=0;
  if(removeUnused){
    for(const n of Object.keys(zip.files).filter(n=>/^ppt\/media\//.test(n)&&!zip.files[n].dir)){
      if(!refs.has(n)){const b=(await zip.file(n).async("uint8array")).length;zip.remove(n);removed++;removedBytes+=b}
    }
  }
  const media=(await mediaSizes(zip)).filter(m=>/^(jpe?g|png|jfif|bmp|tiff?)$/.test(m.ext));
  const renames=[];
  let i=0;
  for(const m of media){
    i++;onProgress&&onProgress(i,media.length,m.name);
    if(m.size<60*1024){continue}
    let img;
    try{img=await decodeImage(await zip.file(m.name).async("uint8array"),MIME[m.ext]||"image/*")}catch(e){report.push({name:m.name,before:m.size,after:m.size,note:"could not read, left as is"});continue}
    const iw=img.width,ih=img.height;const sc=Math.min(1,L.maxPx/Math.max(iw,ih));
    const w=Math.max(1,Math.round(iw*sc)),h=Math.max(1,Math.round(ih*sc));
    const cv=canvasFor(w,h);const ctx=cv.getContext("2d");
    const isPng=m.ext==="png";
    let alpha=false;
    if(isPng){ctx.drawImage(img,0,0,w,h);alpha=hasAlpha(ctx,w,h);ctx.clearRect(0,0,w,h)}
    let outType,outExt;
    if(isPng&&(alpha||!pngToJpg)){outType="image/png";outExt="png"}else{outType="image/jpeg";outExt="jpeg"}
    if(outType==="image/jpeg"){ctx.fillStyle="#ffffff";ctx.fillRect(0,0,w,h)}
    ctx.drawImage(img,0,0,w,h);
    if(img.close)img.close();
    const blob=await canvasBlob(cv,outType,L.quality);
    const bytes=new Uint8Array(await blob.arrayBuffer());
    if(bytes.length>=m.size*0.93){report.push({name:m.name,before:m.size,after:m.size,note:"already efficient"});continue}
    let newName=m.name;
    const wasJpegExt=/^(jpe?g|jfif)$/.test(m.ext);
    if(outExt==="jpeg"&&!wasJpegExt){newName=m.name.replace(/\.[^.]+$/,"")+"_pd.jpeg";renames.push([m.name,newName])}
    zip.remove(m.name);zip.file(newName,bytes);
    saved+=m.size-bytes.length;
    report.push({name:m.name,before:m.size,after:bytes.length,note:(sc<1?`resized ${iw}\u00d7${ih} \u2192 ${w}\u00d7${h}`:"re-encoded")+(newName!==m.name?", PNG photo \u2192 JPEG":"")});
  }
  if(renames.length){
    const map=new Map(renames.map(([a,b])=>[a,b]));
    for(const r of await allRels(zip)){
      let xml=r.xml,changed=false;
      for(const x of r.rels){if(x.external)continue;const full=resolve(r.src||"x",x.target);
        if(map.has(full)){const nt=x.target.replace(/[^/]+$/,map.get(full).split("/").pop());xml=xml.split(x.raw).join(x.raw.replace(`Target="${x.target}"`,`Target="${nt}"`));changed=true}}
      if(changed)zip.file(r.rn,xml);
    }
    let ct=await zip.file("[Content_Types].xml").async("string");
    if(!/Extension="jpeg"/i.test(ct))ct=ct.replace("</Types>",`<Default Extension="jpeg" ContentType="image/jpeg"/></Types>`);
    // drop overrides that pointed at renamed parts
    for(const[a]of renames)ct=ct.replace(new RegExp(`<Override PartName="/${a.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}"[^>]*/>`),"");
    zip.file("[Content_Types].xml",ct);
  }
  // thumbnail is regenerated by PowerPoint on save; keep it but it's tiny
  return{report,saved,removed,removedBytes,renamed:renames.length};
}

/* ------------------------------------------------------------ repair */
async function repairDeck(zip,{parse,processPackage}={}){
  const fixes=[];const warns=[];
  const names=new Set(Object.keys(zip.files).filter(n=>!zip.files[n].dir));
  if(!names.has("[Content_Types].xml"))throw new Error("This file has no [Content_Types].xml, so it is not a PowerPoint package (or it is too damaged to rebuild in the browser).");
  if(!names.has("ppt/presentation.xml"))throw new Error("ppt/presentation.xml is missing. This may be a Word or Excel file renamed to .pptx.");
  // 1. relationships pointing at missing parts
  for(const r of await allRels(zip)){
    if(r.src&&!names.has(r.src)){zip.remove(r.rn);fixes.push(`removed orphan relationship file ${r.rn}`);continue}
    const srcXml=r.src?await zip.file(r.src).async("string"):"";
    let xml=r.xml,changed=false;
    for(const x of r.rels){
      if(x.external||!x.target)continue;
      const full=resolve(r.src||"x",x.target);
      if(names.has(full))continue;
      const used=r.src&&new RegExp(`r:(?:id|embed|link|pict|dm|lo|qs|cs)="${x.id}"`).test(srcXml);
      if(r.rn==="ppt/_rels/presentation.xml.rels"&&x.type===T_SLIDE){
        // slide listed but missing: drop from slide list and relationships
        let pres=await zip.file("ppt/presentation.xml").async("string");
        pres=pres.replace(new RegExp(`<p:sldId\\b[^>]*r:id="${x.id}"[^>]*/>`),"");zip.file("ppt/presentation.xml",pres);
        xml=xml.replace(x.raw,"");changed=true;fixes.push(`removed a reference to missing slide ${x.target}`);continue;
      }
      if(!used){xml=xml.replace(x.raw,"");changed=true;fixes.push(`removed unused link to missing ${x.target} (from ${r.src||"package"})`)}
      else warns.push(`${r.src} uses ${x.target}, which is missing from the file`);
    }
    if(changed)zip.file(r.rn,xml);
  }
  // 2. content types: every extension has a Default, every xml part an Override when needed
  let ct=await zip.file("[Content_Types].xml").async("string");const ct0=ct;
  const exts=new Set([...names].map(extOf).filter(Boolean));
  for(const e of exts){
    if(e==="xml")continue;
    if(new RegExp(`<Default\\b[^>]*Extension="${e}"`,"i").test(ct))continue;
    if([...names].filter(n=>extOf(n)===e).every(n=>new RegExp(`PartName="/${n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}"`).test(ct)))continue;
    if(MIME[e]){ct=ct.replace("</Types>",`<Default Extension="${e}" ContentType="${MIME[e]}"/></Types>`);fixes.push(`registered missing file type .${e}`)}
    else warns.push(`unknown file type .${e} inside the package`);
  }
  const OVR=[[/^ppt\/slides\/slide\d+\.xml$/,"application/vnd.openxmlformats-officedocument.presentationml.slide+xml"],
    [/^ppt\/slideLayouts\/slideLayout\d+\.xml$/,"application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"],
    [/^ppt\/slideMasters\/slideMaster\d+\.xml$/,"application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"],
    [/^ppt\/notesSlides\/notesSlide\d+\.xml$/,"application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"],
    [/^ppt\/theme\/theme\d+\.xml$/,"application/vnd.openxmlformats-officedocument.theme+xml"]];
  for(const n of names)for(const[re,t]of OVR)if(re.test(n)&&!new RegExp(`PartName="/${n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}"`).test(ct)){
    ct=ct.replace("</Types>",`<Override PartName="/${n}" ContentType="${t}"/></Types>`);fixes.push(`registered ${n}`)}
  // overrides for parts that no longer exist
  ct=ct.replace(/<Override PartName="\/([^"]+)"[^>]*\/>/g,(m,p)=>{if(zip.file(p))return m;fixes.push(`removed a registration for missing ${p}`);return""});
  if(ct!==ct0)zip.file("[Content_Types].xml",ct);
  // 3. duplicate slide ids in presentation.xml
  let pres=await zip.file("ppt/presentation.xml").async("string");const seen=new Set();let maxId=Math.max(256,...[...pres.matchAll(/<p:sldId\b[^>]*\bid="(\d+)"/g)].map(m=>+m[1]));
  const p2=pres.replace(/<p:sldId\b([^>]*)\bid="(\d+)"/g,(m,a,id)=>{if(seen.has(id)){maxId++;fixes.push(`fixed duplicate slide id ${id}`);return`<p:sldId${a}id="${maxId}"`}seen.add(id);return m});
  if(p2!==pres)zip.file("ppt/presentation.xml",p2);
  // 4. XML well-formedness check + duplicate shape ids (engine)
  if(parse){
    for(const n of [...names].filter(n=>/^ppt\/.*\.xml$/.test(n))){
      if(!zip.file(n))continue;
      const x=await zip.file(n).async("string");
      const d=parse(x);const err=d.getElementsByTagName("parsererror");
      if(err&&err.length)warns.push(`${n} has broken XML and could not be fixed automatically`);
    }
  }
  let st=null;
  if(processPackage){
    st=await processPackage(zip,{parse,range:"all",anim:null,strip:false,existing:"keep",q:null,key:null,kw:null,boost:null,stamp:null,nums:null,title:null,bg:null,tone:null,doContrast:false,bgImage:null,palette:null,transition:"keep",spd:"fast",perSlide:null},()=>{});
    if(st.fixedIds)fixes.push(`repaired ${st.fixedIds} duplicate shape ID${st.fixedIds>1?"s":""} (a common cause of \u201cPowerPoint found a problem with content\u201d)`);
  }
  return{fixes,warns};
}

/* ------------------------------------------------------------ remove speaker notes / comments */
async function stripParts(zip,{notes=true,comments=true,hidden=false}={}){
  const done=[];
  const rm=async(test,relType,label)=>{
    const parts=Object.keys(zip.files).filter(n=>test.test(n));if(!parts.length)return 0;
    parts.forEach(p=>{zip.remove(p);const r=relsFor(p);if(zip.file(r))zip.remove(r)});
    for(const r of await allRels(zip)){let xml=r.xml,ch=false;for(const x of r.rels)if(relType.test(x.type)){xml=xml.replace(x.raw,"");ch=true}if(ch)zip.file(r.rn,xml)}
    let ct=await zip.file("[Content_Types].xml").async("string");
    parts.forEach(p=>{ct=ct.replace(new RegExp(`<Override PartName="/${p.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}"[^>]*/>`),"")});
    zip.file("[Content_Types].xml",ct);done.push(`${label}: ${parts.filter(p=>/\.xml$/.test(p)).length}`);return parts.length;
  };
  if(notes){
    await rm(/^ppt\/notesSlides\/.+/,/\/notesSlide$/,"speaker notes pages removed");
  }
  if(comments){
    await rm(/^ppt\/(comments|modernComment)\/.+|^ppt\/commentAuthors\.xml$|^ppt\/authors\.xml$/,/\/(comments|commentAuthors|authors)$|modernComment/i,"comment parts removed");
  }
  return done;
}

/* ------------------------------------------------------------ strip metadata */
async function stripMetadata(zip){
  const done=[];
  const core=zip.file("docProps/core.xml");
  if(core){let x=await core.async("string");const x0=x;
    x=x.replace(/<(dc:creator|cp:lastModifiedBy|cp:keywords|dc:subject|dc:description|cp:category|cp:contentStatus)>[\s\S]*?<\/\1>/g,"<$1></$1>");
    if(x!==x0){zip.file("docProps/core.xml",x);done.push("author, last-editor and keyword fields cleared")}}
  const app=zip.file("docProps/app.xml");
  if(app){let x=await app.async("string");const x0=x;x=x.replace(/<(Company|Manager)>[\s\S]*?<\/\1>/g,"<$1></$1>");if(x!==x0){zip.file("docProps/app.xml",x);done.push("company and manager fields cleared")}}
  const cust=zip.file("docProps/custom.xml");if(cust){zip.remove("docProps/custom.xml");
    const r=await zip.file("_rels/.rels").async("string");zip.file("_rels/.rels",r.replace(/<Relationship\b[^>]*custom-properties[^>]*\/>/,""));
    let ct=await zip.file("[Content_Types].xml").async("string");zip.file("[Content_Types].xml",ct.replace(/<Override PartName="\/docProps\/custom\.xml"[^>]*\/>/,""));done.push("custom document properties removed")}
  return done;
}

/* ------------------------------------------------------------ extract */
async function extractImages(zip,JSZipCtor){
  const media=(await mediaSizes(zip)).filter(m=>/^(png|jpe?g|gif|bmp|svg|tiff?|webp|emf|wmf|jfif)$/.test(m.ext));
  const out=new JSZipCtor();let i=0;
  for(const m of media.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}))){i++;out.file(`image_${String(i).padStart(3,"0")}.${m.ext==="jfif"?"jpg":m.ext}`,await zip.file(m.name).async("uint8array"))}
  return{zip:out,count:i};
}
async function slideOrder(zip){
  const pres=await zip.file("ppt/presentation.xml").async("string");
  const rels=relsList(await zip.file("ppt/_rels/presentation.xml.rels").async("string"));
  const ids=[...pres.matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)].map(m=>m[1]);
  return ids.map(id=>{const r=rels.find(x=>x.id===id);return r?resolve("ppt/presentation.xml",r.target):null}).filter(n=>n&&zip.file(n));
}
function textOf(xml){
  const paras=[];const re=/<a:p\b[\s\S]*?<\/a:p>/g;let m;
  while((m=re.exec(xml))){const t=[...m[0].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(x=>x[1]).join("");
    const d=t.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&");if(d.trim())paras.push(d)}
  return paras;
}
async function extractText(zip,{notes=true}={}){
  const order=await slideOrder(zip);const out=[];
  for(let i=0;i<order.length;i++){
    const xml=await zip.file(order[i]).async("string");
    const item={slide:i+1,text:textOf(xml),notes:[]};
    if(notes){const rf=zip.file(relsFor(order[i]));if(rf){const r=relsList(await rf.async("string")).find(x=>/notesSlide$/.test(x.type));
      if(r){const np=resolve(order[i],r.target);const nf=zip.file(np);if(nf){item.notes=textOf((await nf.async("string")).replace(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<p:ph type="sldImg"[\s\S]*?<\/p:sp>/g,"")).filter(t=>!/^\d+$/.test(t.trim()))}}}}
    out.push(item);
  }
  return out;
}

const API={compressDeck,repairDeck,stripParts,stripMetadata,extractImages,extractText,mediaSizes,fmtBytes,LEVELS,slideOrder};
if(typeof module!=="undefined"&&module.exports)module.exports=API;else root.PDTools=API;
})(typeof window!=="undefined"?window:globalThis);
