/* ============ ENGINE ============ */
/* Deck Studio engine v5 — shared by Node tests and the browser tool */
function localName(el){return el.localName||el.nodeName.split(":").pop()}
function firstDesc(el,ln){const a=el.getElementsByTagName("*");for(let i=0;i<a.length;i++)if(localName(a[i])===ln)return a[i];return null}
function xmlEsc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function xmlUnesc(s){return String(s).replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(m,d)=>String.fromCharCode(+d)).replace(/&#x([0-9a-f]+);/gi,(m,h)=>String.fromCharCode(parseInt(h,16))).replace(/&amp;/g,"&")}

/* ---------- slide range: "all" | "1,3,5-9" ---------- */
function parseRange(str,n){
  const s=(str||"all").trim().toLowerCase();
  const set=new Set();
  if(!s||s==="all"){for(let i=1;i<=n;i++)set.add(i);return set}
  for(const part of s.split(",")){
    const m=part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if(!m)continue;
    const a=parseInt(m[1],10),b=m[2]?parseInt(m[2],10):a;
    for(let i=Math.min(a,b);i<=Math.max(a,b)&&i<=n;i++)if(i>=1)set.add(i);
  }
  return set;
}

/* ---------- balanced tag helpers (string level) ---------- */
function matchClose(xml,openIdx,tag){
  const re=new RegExp("<(/?)"+tag+"(?=[\\s>/])[^>]*?(/?)>","g");re.lastIndex=openIdx;
  let depth=0,m;
  while((m=re.exec(xml))){
    if(m[1]!=="/"){if(m[2]==="/"){if(depth===0)return re.lastIndex}else depth++}
    else{depth--;if(depth===0)return re.lastIndex}
  }
  return -1;
}
function topLevel(xml,tag,from,to){
  const re=new RegExp("<(/?)"+tag+"(?=[\\s>/])[^>]*?(/?)>","g");re.lastIndex=from;
  let depth=0,start=-1,m;const out=[];
  while((m=re.exec(xml))&&m.index<to){
    if(m[1]!=="/"){
      if(depth===0)start=m.index;
      if(m[2]==="/"){if(depth===0)out.push([start,re.lastIndex])}else depth++;
    }else{depth--;if(depth===0)out.push([start,re.lastIndex])}
  }
  return out;
}

/* ---------- shape discovery ---------- */
function paraInfo(shapeEl){
  let tx=null;
  for(let n=shapeEl.firstChild;n;n=n.nextSibling){if(n.nodeType===1&&localName(n)==="txBody"){tx=n;break}}
  if(!tx)return[];
  const paras=[];let idx=0;
  for(let n=tx.firstChild;n;n=n.nextSibling){
    if(n.nodeType!==1||localName(n)!=="p")continue;
    let has=false,text="";
    const d=n.getElementsByTagName("*");
    for(let i=0;i<d.length;i++){
      const ln=localName(d[i]);
      if(ln==="t"){text+=d[i].textContent;if(d[i].textContent.trim())has=true}
      if(ln==="fld")has=true;
    }
    paras.push({idx:idx++,has,text});
  }
  return paras;
}
function getSpTree(doc){
  const all=doc.getElementsByTagName("*");
  for(let i=0;i<all.length;i++)if(localName(all[i])==="spTree")return all[i];
  return null;
}
function getShapes(doc){
  const spTree=getSpTree(doc);if(!spTree)return[];
  const wanted={sp:1,pic:1,graphicFrame:1,grpSp:1,cxnSp:1};const out=[];let order=0;
  for(let n=spTree.firstChild;n;n=n.nextSibling){
    if(n.nodeType!==1)continue;
    const ln=localName(n);
    if(!wanted[ln])continue;
    const cNvPr=firstDesc(n,"cNvPr");if(!cNvPr)continue;
    const id=cNvPr.getAttribute("id"),name=cNvPr.getAttribute("name")||"";
    let isTitle=false,phType=null,isPh=false,x=null,y=null,w=null,h=null,maxSz=0;
    const desc=n.getElementsByTagName("*");
    for(let i=0;i<desc.length;i++){
      const dn=localName(desc[i]);
      if(dn==="ph"&&!isPh){isPh=true;phType=desc[i].getAttribute("type")||"body";if(phType==="title"||phType==="ctrTitle")isTitle=true}
      if(dn==="off"&&x===null){x=parseInt(desc[i].getAttribute("x"),10);y=parseInt(desc[i].getAttribute("y"),10)}
      if(dn==="ext"&&w===null&&desc[i].getAttribute("cx")!=null){w=parseInt(desc[i].getAttribute("cx"),10);h=parseInt(desc[i].getAttribute("cy"),10)}
      if((dn==="rPr"||dn==="endParaRPr"||dn==="defRPr")&&desc[i].getAttribute("sz"))maxSz=Math.max(maxSz,+desc[i].getAttribute("sz"));
    }
    const paras=ln==="sp"?paraInfo(n):[];
    const text=paras.map(p=>p.text).join("\n");
    const kind=ln==="pic"?"pic":(ln==="sp"?(paras.some(p=>p.has)?"text":"other"):"other");
    out.push({id,name,ln,isTitle,isPh,phType,x,y,w,h,maxSz,order:order++,paras,text,kind,ds:/^DS_/.test(name)});
  }
  out.sort((a,b)=>{
    if(a.y==null&&b.y==null)return a.order-b.order;
    if(a.y==null)return 1;if(b.y==null)return -1;
    const R=900000;const ra=Math.round(a.y/R),rb=Math.round(b.y/R);
    if(ra!==rb)return a.y-b.y;
    if(a.x!==b.x)return a.x-b.x;
    return a.order-b.order;
  });
  return out;
}
const hasBox=s=>s.x!=null&&s.w!=null;
const cx=s=>s.x+s.w/2, cy=s=>s.y+s.h/2;
const contains=(o,px,py)=>hasBox(o)&&px>=o.x&&px<=o.x+o.w&&py>=o.y&&py<=o.y+o.h;

/* ---------- duplicate shape-id repair ---------- */
function fixDuplicateIds(xml){
  const re=/<p:cNvPr\b[^>]*?\sid="(\d+)"/g;let m,max=0;const seen=new Set();const dups=[];
  while((m=re.exec(xml))){max=Math.max(max,+m[1]);if(seen.has(m[1]))dups.push(m.index);else seen.add(m[1])}
  if(!dups.length)return{xml,fixed:0};
  let out="",last=0;
  for(const at of dups){
    const tagEnd=xml.indexOf(">",at);
    const tag=xml.slice(at,tagEnd).replace(/\sid="\d+"/,` id="${++max}"`);
    out+=xml.slice(last,at)+tag;last=tagEnd;
  }
  return{xml:out+xml.slice(last),fixed:dups.length};
}
function maxShapeId(xml){let m,max=1;const re=/<p:cNvPr\b[^>]*?\sid="(\d+)"/g;while((m=re.exec(xml)))max=Math.max(max,+m[1]);return max}

/* ---------- effect library ---------- */
/* direction keys: b,t,l,r (where the element comes FROM) */
const SUBTYPE_DIR={b:4,t:1,l:8,r:2};
const EFFECTS={
  appear:      {id:1,  kind:"appear"},
  fade:        {id:10, kind:"filter", filter:()=>"fade"},
  wipe:        {id:22, kind:"filter", filter:d=>({b:"wipe(up)",t:"wipe(down)",l:"wipe(right)",r:"wipe(left)"})[d||"b"], dir:true},
  flyin:       {id:2,  kind:"fly", dir:true},
  zoom:        {id:53, kind:"zoom", sub:16},
  blinds:      {id:3,  kind:"filter", filter:()=>"blinds(horizontal)"},
  checkerboard:{id:5,  kind:"filter", filter:()=>"checkerboard(across)"},
  circle:      {id:6,  kind:"filter", filter:()=>"circle(in)"},
  dissolve:    {id:9,  kind:"filter", filter:()=>"dissolve"},
  randombars:  {id:14, kind:"filter", filter:()=>"randombar(horizontal)"},
  split:       {id:16, kind:"filter", filter:()=>"barn(inVertical)"},
  strips:      {id:18, kind:"filter", filter:()=>"strips(downLeft)"},
  wedge:       {id:20, kind:"filter", filter:()=>"wedge"},
  wheel:       {id:21, kind:"filter", filter:()=>"wheel(1)"},
  grow:        {id:6,  kind:"scale",  cls:"emph"},
  highlight:   {id:3,  kind:"clr",    cls:"emph", color:"D4AF37"},
  answer:      {id:3,  kind:"clr",    cls:"emph", color:"00B050", bold:true},
  greyout:     {id:3,  kind:"clr",    cls:"emph", color:"A6A6A6"},
  keyword:     {id:3,  kind:"clr",    cls:"emph", bold:true},
  fillred:     {id:1,  kind:"fillclr",cls:"emph", color:"E04848"},
  fadeout:     {id:10, kind:"filter", filter:()=>"fade", cls:"exit"},
  wipeout:     {id:22, kind:"filter", filter:d=>({b:"wipe(down)",t:"wipe(up)",l:"wipe(left)",r:"wipe(right)"})[d||"b"], dir:true, cls:"exit"},
  flyout:      {id:2,  kind:"fly",    dir:true, cls:"exit"}
};

function tgtXml(t){
  if(t.charRg)return `<p:spTgt spid="${t.spid}"><p:txEl><p:charRg st="${t.charRg[0]}" end="${t.charRg[1]}"/></p:txEl></p:spTgt>`;
  if(t.pRg)return `<p:spTgt spid="${t.spid}"><p:txEl><p:pRg st="${t.pRg[0]}" end="${t.pRg[1]}"/></p:txEl></p:spTgt>`;
  return `<p:spTgt spid="${t.spid}"/>`;
}
function behaviorsFor(e,idRef){
  const fx=EFFECTS[e.fx]||EFFECTS.fade;
  const cls=fx.cls||"entr";const dur=e.dur;const dir=e.dir;
  const tgt=`<p:tgtEl>`+tgtXml(e.t)+`</p:tgtEl>`;
  const setAttr=(attr,val,delay,d)=>`<p:set><p:cBhvr><p:cTn id="${idRef.next++}" dur="${d||1}" fill="hold"><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst></p:cTn>`+tgt+`<p:attrNameLst><p:attrName>${attr}</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="${val}"/></p:to></p:set>`;
  const setVis=(val,delay)=>setAttr("style.visibility",val,delay);
  const mkPos=(attr,v0,v1)=>`<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="${idRef.next++}" dur="${dur}" fill="hold"/>`+tgt+`<p:attrNameLst><p:attrName>${attr}</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst><p:tav tm="0"><p:val><p:strVal val="${v0}"/></p:val></p:tav><p:tav tm="100000"><p:val><p:strVal val="${v1}"/></p:val></p:tav></p:tavLst></p:anim>`;
  if(cls==="emph"){
    if(fx.kind==="scale")
      return `<p:animScale><p:cBhvr><p:cTn id="${idRef.next++}" dur="${dur}" autoRev="1" fill="hold"/>`+tgt+`</p:cBhvr><p:by x="125000" y="125000"/></p:animScale>`;
    if(fx.kind==="fillclr")
      return `<p:animClr clrSpc="rgb" dir="cw"><p:cBhvr><p:cTn id="${idRef.next++}" dur="${dur}" fill="hold"/>`+tgt+`<p:attrNameLst><p:attrName>fillcolor</p:attrName></p:attrNameLst></p:cBhvr><p:to><a:srgbClr val="${e.color||fx.color}"/></p:to></p:animClr>`
        +setAttr("fill.type","solid",0,dur);
    let x=`<p:animClr clrSpc="rgb" dir="cw"><p:cBhvr override="childStyle"><p:cTn id="${idRef.next++}" dur="${dur}" fill="hold"/>`+tgt+`<p:attrNameLst><p:attrName>style.color</p:attrName></p:attrNameLst></p:cBhvr><p:to><a:srgbClr val="${e.color||fx.color||"D4AF37"}"/></p:to></p:animClr>`;
    if(fx.bold||e.bold)x+=`<p:set><p:cBhvr override="childStyle"><p:cTn id="${idRef.next++}" dur="${dur}" fill="hold"/>`+tgt+`<p:attrNameLst><p:attrName>style.fontWeight</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="bold"/></p:to></p:set>`;
    return x;
  }
  if(cls==="exit"){
    const hide=setVis("hidden",dur);
    if(fx.kind==="filter")
      return `<p:animEffect transition="out" filter="${fx.filter(dir)}"><p:cBhvr><p:cTn id="${idRef.next++}" dur="${dur}"/>`+tgt+`</p:cBhvr></p:animEffect>`+hide;
    const d=dir||"b";
    const xTo=d==="l"?"0-#ppt_w/2":d==="r"?"1+#ppt_w/2":"#ppt_x";
    const yTo=d==="t"?"0-#ppt_h/2":d==="b"?"1+#ppt_h/2":"#ppt_y";
    return mkPos("ppt_x","#ppt_x",xTo)+mkPos("ppt_y","#ppt_y",yTo)+hide;
  }
  const set=setVis("visible",0);
  if(fx.kind==="appear")return set;
  if(fx.kind==="filter")
    return set+`<p:animEffect transition="in" filter="${fx.filter(dir)}"><p:cBhvr><p:cTn id="${idRef.next++}" dur="${dur}"/>`+tgt+`</p:cBhvr></p:animEffect>`;
  if(fx.kind==="zoom")
    return set+mkPos("ppt_w","0","#ppt_w")+mkPos("ppt_h","0","#ppt_h")
      +`<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${idRef.next++}" dur="${dur}"/>`+tgt+`</p:cBhvr></p:animEffect>`;
  const d=dir||"b";
  const xFrom=d==="l"?"0-#ppt_w/2":d==="r"?"1+#ppt_w/2":"#ppt_x";
  const yFrom=d==="t"?"0-#ppt_h/2":d==="b"?"1+#ppt_h/2":"#ppt_y";
  return set+mkPos("ppt_x",xFrom,"#ppt_x")+mkPos("ppt_y",yFrom,"#ppt_y");
}
function effectCls(e){const fx=EFFECTS[e.fx]||EFFECTS.fade;return fx.cls||"entr"}
function effectParXml(e,nodeType,idRef){
  const fx=EFFECTS[e.fx]||EFFECTS.fade;
  const subtype=fx.dir?(SUBTYPE_DIR[e.dir||"b"]||0):(fx.sub||0);
  const grp=e.grp||0;
  return `<p:par><p:cTn id="${idRef.next++}" presetID="${fx.id}" presetClass="${fx.cls||'entr'}" presetSubtype="${subtype}" fill="hold" grpId="${grp}" nodeType="${nodeType}"><p:stCondLst><p:cond delay="${e.delay||0}"/></p:stCondLst><p:childTnLst>`+behaviorsFor(e,idRef)+`</p:childTnLst></p:cTn></p:par>`;
}
function dimParXml(t,idRef){
  return `<p:par><p:cTn id="${idRef.next++}" afterEffect="1" masterRel="nextClick"><p:childTnLst><p:animClr clrSpc="rgb" dir="cw"><p:cBhvr override="childStyle"><p:cTn id="${idRef.next++}" dur="1" fill="hold"/><p:tgtEl>`+tgtXml(t)+`</p:tgtEl><p:attrNameLst><p:attrName>style.color</p:attrName></p:attrNameLst></p:cBhvr><p:to><a:srgbClr val="8A8A8A"/></p:to></p:animClr></p:childTnLst></p:cTn></p:par>`;
}

/* effects: [{t:{spid,pRg,charRg}, fx, dir, dur, delay, node:'click'|'with'|'after', dim}]
   compiles into PowerPoint's click-group structure */
function compileEffects(effects,idRef){
  const outers=[];
  for(const e of effects){
    if(!outers.length||e.node==="click")outers.push({click:e.node==="click",inners:[]});
    const o=outers[outers.length-1];
    if(!o.inners.length||e.node==="after"){
      const prev=o.inners[o.inners.length-1];const st=prev?prev.end:0;
      o.inners.push({start:st,end:st,items:[]});
    }
    const inn=o.inners[o.inners.length-1];
    inn.items.push(e);
    inn.end=Math.max(inn.end,inn.start+(e.delay||0)+(e.dur||0));
  }
  let xml="";
  outers.forEach((o,oi)=>{
    const g=idRef.next++;
    const st=o.click?`<p:cond delay="indefinite"/>`:`<p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond>`;
    let inner="";
    o.inners.forEach((inn,ii)=>{
      const m=idRef.next++;let body="";
      inn.items.forEach((e,k)=>{
        let nt="withEffect";
        if(k===0){nt=(ii===0&&o.click)?"clickEffect":(ii===0&&e.node==="with"?"withEffect":"afterEffect")}
        body+=effectParXml(e,nt,idRef);
        if(e.dim)body+=dimParXml(e.t,idRef);
      });
      inner+=`<p:par><p:cTn id="${m}" fill="hold"><p:stCondLst><p:cond delay="${inn.start}"/></p:stCondLst><p:childTnLst>`+body+`</p:childTnLst></p:cTn></p:par>`;
    });
    xml+=`<p:par><p:cTn id="${g}" fill="hold"><p:stCondLst>${st}</p:stCondLst><p:childTnLst>`+inner+`</p:childTnLst></p:cTn></p:par>`;
  });
  return xml;
}
function bldEntries(effects,spKinds){
  const seen=new Map();
  for(const e of effects){
    const cls=effectCls(e);
    if(spKinds[e.t.spid]!=="sp")continue;
    const key=e.t.spid+"|"+(e.grp||0);
    const prev=seen.get(key);
    seen.set(key,cls==="emph"?"whole":(prev==="p"||e.t.pRg)?"p":"whole");
  }
  let bld="";
  seen.forEach((mode,key)=>{const[spid,grp]=key.split("|");
    bld+=mode==="p"?`<p:bldP spid="${spid}" grpId="${grp}" build="p"/>`:`<p:bldP spid="${spid}" grpId="${grp}" animBg="1"/>`});
  return bld;
}
function timingXml(groupsXml,bld){
  return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>`+groupsXml+`</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst>`+(bld?`<p:bldLst>${bld}</p:bldLst>`:"")+`</p:timing>`;
}

/* ---------- existing timing: parse into click groups ---------- */
const DS_EXT_URI="{D5C0DE11-7A1B-4E55-9D5E-DEC0571D1057}";
function readDsMarker(xml){
  const m=xml.match(/<ds:info\b[^>]*\bpre="(\d+)"[^>]*\bpost="(\d+)"/);
  return m?{pre:+m[1],post:+m[2]}:null;
}
function parseTiming(xml){
  const s=xml.search(/<p:timing[\s>]/);if(s<0)return null;
  const e=matchClose(xml,s,"p:timing");if(e<0)return{complex:true};
  const t=xml.slice(s,e);
  const info={start:s,end:e,xml:t,groups:[],bld:[],complex:false};
  if(/interactiveSeq|<p:cond\b[^>]*evt="on(Click|MouseOver)"/.test(t))info.complex=true;
  const tns=t.match(/<p:tn\b[^>]*val="(\d+)"/g)||[];
  if(tns.some(x=>!/val="2"/.test(x)))info.complex=true;
  const ms=t.indexOf('nodeType="mainSeq"');
  if(ms<0){info.complex=true;return info}
  const cl=t.indexOf("<p:childTnLst>",ms);
  const clEnd=matchClose(t,cl,"p:childTnLst");
  if(cl<0||clEnd<0){info.complex=true;return info}
  for(const[a,b]of topLevel(t,"p:par",cl+14,clEnd)){
    const g=t.slice(a,b);
    const spids=[...new Set([...g.matchAll(/spid="(\d+)"/g)].map(m=>m[1]))];
    const auto=!/^<p:par><p:cTn[^>]*>\s*<p:stCondLst>\s*<p:cond delay="indefinite"\/>\s*<\/p:stCondLst>/.test(g);
    info.groups.push({xml:g,spids,auto});
  }
  const bl=t.indexOf("<p:bldLst>");
  if(bl>=0){
    const blEnd=matchClose(t,bl,"p:bldLst");
    for(const tag of["p:bldP","p:bldDgm","p:bldOleChart","p:bldGraphic"])
      for(const[a,b]of topLevel(t,tag,bl+10,blEnd)){const x=t.slice(a,b);const m=x.match(/spid="(\d+)"/);info.bld.push({xml:x,spid:m?m[1]:null})}
  }
  return info;
}
function renumberCTn(x,idRef){return x.replace(/<p:cTn\b[^>]*>/g,tag=>tag.replace(/\sid="\d+"/,()=>` id="${idRef.next++}"`))}
/* summarise a raw group for preview: [{spid,pRg,cls,delay}] */
function summariseGroup(g){
  const out=[];
  const re=/<p:cTn\b[^>]*presetClass="(\w+)"[^>]*>/g;let m;
  const starts=[];while((m=re.exec(g)))starts.push({i:m.index,cls:m[1]});
  starts.forEach((s,k)=>{
    const seg=g.slice(s.i,k+1<starts.length?starts[k+1].i:g.length);
    const sm=seg.match(/<p:spTgt spid="(\d+)"(?:\/>|>\s*<p:txEl>\s*<p:pRg st="(\d+)" end="(\d+)")/);
    if(sm)out.push({t:{spid:sm[1],pRg:sm[2]!=null?[+sm[2],+sm[3]]:null},cls:s.cls==="emph"?"emph":s.cls==="exit"?"exit":"entr",fx:s.cls==="emph"?"highlight":s.cls==="exit"?"fadeout":"fade",dur:500});
  });
  return out;
}

/* ---------- slide tail positions (clrMapOvr → transition → timing → extLst) ---------- */
function afterClrMap(xml){
  let pos=xml.indexOf("</p:cSld>");if(pos<0)return-1;pos+=9;
  const m=xml.slice(pos).match(/^\s*(?:<p:clrMapOvr\/>|<p:clrMapOvr>[\s\S]*?<\/p:clrMapOvr>)?/);
  return pos+m[0].length;
}
const TRANS_RE=/^\s*(?:<mc:AlternateContent\b(?:(?!<mc:AlternateContent)[\s\S])*?<p:transition\b[\s\S]*?<\/mc:AlternateContent>|<p:transition\b[^>]*\/>|<p:transition\b[\s\S]*?<\/p:transition>)/;
function afterTransition(xml){
  let pos=afterClrMap(xml);if(pos<0)return-1;
  for(;;){const m=xml.slice(pos).match(TRANS_RE);if(!m)break;pos+=m[0].length}
  return pos;
}
function insertTiming(xml,timing){
  let out=xml;const ex=out.search(/<p:timing[\s>]/);
  if(ex>=0){const e=matchClose(out,ex,"p:timing");out=out.slice(0,ex)+out.slice(e)}
  const pos=afterTransition(out);if(pos<0)return null;
  return out.slice(0,pos)+timing+out.slice(pos);
}
function removeTiming(xml){
  const ex=xml.search(/<p:timing[\s>]/);if(ex<0)return xml;
  const e=matchClose(xml,ex,"p:timing");return e<0?xml:xml.slice(0,ex)+xml.slice(e);
}
function setDsMarker(xml,pre,post){
  let out=xml.replace(/<p:ext uri="\{D5C0DE11[^"]*\}">[\s\S]*?<\/p:ext>/,"").replace(/<p:extLst>\s*<\/p:extLst>/,"");
  if(pre==null)return out;
  const ext=`<p:ext uri="${DS_EXT_URI}"><ds:info xmlns:ds="urn:deckstudio:v5" pre="${pre}" post="${post}"/></p:ext>`;
  if(/<p:extLst>/.test(out.slice(out.indexOf("</p:cSld>"))))
    return out.replace(/(<\/p:cSld>[\s\S]*?<p:extLst>)/,"$1"+ext);
  return out.replace(/<\/p:sld>\s*$/,`<p:extLst>${ext}</p:extLst></p:sld>`);
}

/* ---------- transitions ---------- */
const TRANSITIONS={
  fade:`<p:fade/>`, fadeblack:`<p:fade thruBlk="1"/>`,
  push:`<p:push dir="u"/>`, wipe:`<p:wipe dir="r"/>`,
  cover:`<p:cover dir="l"/>`, dissolve:`<p:dissolve/>`
};
function applyTransition(xml,choice,spd){
  const p0=afterClrMap(xml);if(p0<0)return{xml,note:null};
  const p1=afterTransition(xml);
  let out=xml.slice(0,p0)+xml.slice(p1);
  if(choice==="none")return{xml:out,note:"transition removed"};
  let frag;
  if(choice==="morph"){
    frag=`<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159"><p:transition spd="slow"><p159:morph option="byObject"/></p:transition></mc:Choice><mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>`;
  }else{
    const inner=TRANSITIONS[choice];if(!inner)return{xml,note:null};
    frag=`<p:transition spd="${spd||"fast"}">${inner}</p:transition>`;
  }
  return{xml:out.slice(0,p0)+frag+out.slice(p0),note:choice==="morph"?"morph":"transition"};
}

/* ---------- backgrounds ---------- */
function bgFragment(bg,rId){
  let fill;
  if(bg.type==="image"){
    fill=`<a:blipFill dpi="0" rotWithShape="1"><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></a:blipFill>`;
  }else if(bg.type==="grad"){
    fill=`<a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="${bg.c1}"/></a:gs><a:gs pos="100000"><a:srgbClr val="${bg.c2}"/></a:gs></a:gsLst><a:lin ang="5400000" scaled="1"/></a:gradFill>`;
  }else{
    fill=`<a:solidFill><a:srgbClr val="${bg.c1}"/></a:solidFill>`;
  }
  return `<p:bg><p:bgPr>${fill}<a:effectLst/></p:bgPr></p:bg>`;
}
function applyBg(xml,frag){
  let out=xml.replace(/<p:bg>[\s\S]*?<\/p:bg>/,"");
  const m=out.match(/<p:cSld[^>]*>/);
  if(!m)return{xml,note:null};
  const cut=m.index+m[0].length;
  return{xml:out.slice(0,cut)+frag+out.slice(cut),note:"background"};
}

/* ---------- rPr editing (schema-ordered) ---------- */
const RPR_ORDER=["ln","noFill","solidFill","gradFill","blipFill","pattFill","grpFill","effectLst","effectDag","highlight","uLnTx","uLn","uFillTx","uFill","latin","ea","cs","sym","hlinkClick","hlinkMouseOver","rtl","extLst"];
const FILL_TAGS=["noFill","solidFill","gradFill","blipFill","pattFill","grpFill"];
function splitRPr(rpr){ // rpr: "<a:rPr ...>...</a:rPr>" or "<a:rPr .../>"
  const open=rpr.match(/^<a:rPr\b[^>]*?\/?>/)[0];
  const selfClose=/\/>$/.test(open);
  const attrs=open.replace(/^<a:rPr/,"").replace(/\/?>$/,"");
  const kids=[];
  if(!selfClose){
    const inner=rpr.slice(open.length,rpr.length-"</a:rPr>".length);
    let i=0;
    while(i<inner.length){
      const lt=inner.indexOf("<",i);if(lt<0)break;
      const nm=inner.slice(lt).match(/^<a:(\w+)/);if(!nm){i=lt+1;continue}
      const end=matchClose(inner,lt,"a:"+nm[1]);if(end<0)break;
      kids.push({name:nm[1],xml:inner.slice(lt,end)});i=end;
    }
  }
  return{attrs,kids};
}
function joinRPr(p){
  p.kids.sort((a,b)=>RPR_ORDER.indexOf(a.name)-RPR_ORDER.indexOf(b.name));
  return p.kids.length?`<a:rPr${p.attrs}>${p.kids.map(k=>k.xml).join("")}</a:rPr>`:`<a:rPr${p.attrs}/>`;
}
function setAttr(attrs,name,val){
  const re=new RegExp(`\\s${name}="[^"]*"`);
  return re.test(attrs)?attrs.replace(re,` ${name}="${val}"`):attrs+` ${name}="${val}"`;
}
function styleRPr(rpr,{color,bold,highlight}){
  const p=splitRPr(rpr||`<a:rPr lang="en-US"/>`);
  if(bold)p.attrs=setAttr(p.attrs,"b","1");
  if(color){p.kids=p.kids.filter(k=>FILL_TAGS.indexOf(k.name)<0);p.kids.push({name:"solidFill",xml:`<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>`})}
  if(highlight){p.kids=p.kids.filter(k=>k.name!=="highlight");p.kids.push({name:"highlight",xml:`<a:highlight><a:srgbClr val="${highlight}"/></a:highlight>`})}
  return joinRPr(p);
}

/* ---------- text contrast recolouring ---------- */
function lum(hex){
  const h=hex.replace("#","");if(h.length!==6)return 0.5;
  const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);
  return (0.299*r+0.587*g+0.114*b)/255;
}
function recolorRunBlock(block,hex,tone){
  const openM=block.match(/<a:(?:r|fld)\b[^>]*>/);if(!openM)return block;
  const rm=block.match(/<a:rPr\b[^>]*\/>|<a:rPr\b[^>]*>[\s\S]*?<\/a:rPr>/);
  if(rm){
    const c=rm[0].match(/<a:solidFill><a:srgbClr val="([0-9A-Fa-f]{6})"/);
    const lnFree=rm[0].replace(/<a:ln\b[\s\S]*?<\/a:ln>|<a:ln\b[^>]*\/>/,"");
    const c2=lnFree.match(/<a:solidFill>\s*<a:srgbClr val="([0-9A-Fa-f]{6})"/);
    if(c2){const L=lum(c2[1]);if((tone==="dark"&&L>0.6)||(tone==="light"&&L<0.35))return block}
    return block.replace(rm[0],styleRPr(rm[0],{color:hex}));
  }
  const cut=openM.index+openM[0].length;
  return block.slice(0,cut)+`<a:rPr lang="en-US"><a:solidFill><a:srgbClr val="${hex}"/></a:solidFill></a:rPr>`+block.slice(cut);
}
function recolorRuns(xml,tone){
  const hex=tone==="dark"?"F2F2F2":"1A1A1A";
  return xml.replace(/<a:r>[\s\S]*?<\/a:r>|<a:fld\b[^>]*>[\s\S]*?<\/a:fld>/g,b=>recolorRunBlock(b,hex,tone));
}

/* ---------- theme recolour (accents + dk2/lt2 only) ---------- */
const PALETTES={
  royal:  {accent1:"D4AF37",accent2:"1F3A6E",accent3:"8C6D1F",accent4:"3D5A99",accent5:"C09A2E",accent6:"25406B",dk2:"0D1526",lt2:"F3EFE4"},
  forest: {accent1:"2E7D5B",accent2:"74A57F",accent3:"C9A227",accent4:"1F4E3D",accent5:"9CC5A1",accent6:"5B8266",dk2:"15291F",lt2:"EFF5EF"},
  crimson:{accent1:"A62639",accent2:"DB5461",accent3:"F2A65A",accent4:"6E1423",accent5:"E08E9B",accent6:"8C2F39",dk2:"2B0D12",lt2:"FBEFF0"},
  ocean:  {accent1:"1B6CA8",accent2:"61A5C2",accent3:"2A9D8F",accent4:"134074",accent5:"89C2D9",accent6:"468FAF",dk2:"0B2545",lt2:"EDF6F9"},
  slate:  {accent1:"4A5568",accent2:"718096",accent3:"A0AEC0",accent4:"2D3748",accent5:"90A4AE",accent6:"607080",dk2:"1A202C",lt2:"F0F2F5"}
};
function recolorTheme(xml,paletteKey){
  const pal=PALETTES[paletteKey];if(!pal)return xml;
  let out=xml;
  for(const[slot,hex]of Object.entries(pal))
    out=out.replace(new RegExp(`<a:${slot}>[\\s\\S]*?</a:${slot}>`),`<a:${slot}><a:srgbClr val="${hex}"/></a:${slot}>`);
  return out;
}

/* ---------- font-size booster (fit-aware, inheritance-aware) ---------- */
/* collect placeholder geometry + level sizes from a layout or master */
function phCatalog(xml){
  const out=[];if(!xml)return out;
  for(const m of xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)){
    const sp=m[0];const ph=sp.match(/<p:ph\b([^>]*)\/?>/);if(!ph)continue;
    const type=(ph[1].match(/type="(\w+)"/)||[])[1]||"body",idx=(ph[1].match(/idx="(\d+)"/)||[])[1]||"0";
    const ext=sp.match(/<a:ext cx="(\d+)" cy="(\d+)"/);const off=sp.match(/<a:off x="(-?\d+)" y="(-?\d+)"/);
    const lvl={};const ls=sp.match(/<a:lstStyle>[\s\S]*?<\/a:lstStyle>/);
    if(ls)for(const l of ls[0].matchAll(/<a:lvl(\d)pPr\b[\s\S]*?<\/a:lvl\1pPr>/g)){const s=l[0].match(/<a:defRPr\b[^>]*\ssz="(\d+)"/);if(s)lvl[+l[1]]=+s[1]}
    out.push({type,idx,x:off?+off[1]:0,y:off?+off[2]:0,cx:ext?+ext[1]:null,cy:ext?+ext[2]:null,lvl});
  }
  return out;
}
function styleLevels(xml,tag){
  const m=xml&&xml.match(new RegExp(`<p:${tag}>[\\s\\S]*?</p:${tag}>`));const lvl={};
  if(m)for(const l of m[0].matchAll(/<a:lvl(\d)pPr\b[\s\S]*?<\/a:lvl\1pPr>/g)){const s=l[0].match(/<a:defRPr\b[^>]*\ssz="(\d+)"/);if(s)lvl[+l[1]]=+s[1]}
  return lvl;
}
/* inheritance context for one slide */
function makeInherit(layoutXml,masterXml,presXml){
  const lay=phCatalog(layoutXml),mas=phCatalog(masterXml);
  const title=styleLevels(masterXml,"titleStyle"),body=styleLevels(masterXml,"bodyStyle");
  const dflt={};const d=presXml&&presXml.match(/<p:defaultTextStyle>[\s\S]*?<\/p:defaultTextStyle>/);
  if(d)for(const l of d[0].matchAll(/<a:lvl(\d)pPr\b[\s\S]*?<\/a:lvl\1pPr>/g)){const s=l[0].match(/<a:defRPr\b[^>]*\ssz="(\d+)"/);if(s)dflt[+l[1]]=+s[1]}
  const norm=t=>t==="ctrTitle"?"title":(t==="subTitle"||t==="obj")?"body":t;
  const find=(cat,ph)=>cat.find(p=>ph.idx!=="0"&&p.idx===ph.idx)||cat.find(p=>norm(p.type)===norm(ph.type));
  return{
    geom(ph){const a=find(lay,ph),b=find(mas,ph);const g=(a&&a.cx)?a:(b&&b.cx)?b:null;return g?{cx:g.cx,cy:g.cy}:null},
    geomFull(ph){const a=find(lay,ph),b=find(mas,ph);const g=(a&&a.cx)?a:(b&&b.cx)?b:null;return g?{x:g.x,y:g.y,cx:g.cx,cy:g.cy}:null},
    size(ph,lvl){
      if(ph){
        const a=find(lay,ph),b=find(mas,ph);
        if(a&&a.lvl[lvl])return a.lvl[lvl];if(b&&b.lvl[lvl])return b.lvl[lvl];
        const t=norm(ph.type);
        if(t==="title"&&title[lvl])return title[lvl];
        if(t!=="title"&&/^(body|dt|ftr|sldNum|hdr)$/.test(t)&&body[lvl])return body[lvl];
        if(body[lvl])return body[lvl];
      }
      return dflt[lvl]||1800;
    }
  };
}
function boostFonts(xml,scale,floorPt,inh){
  if(scale<=1&&!floorPt)return{xml,changed:0,capped:0};
  let changed=0,capped=0;
  const floor=(floorPt||0)*100;
  const out=xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g,sp=>{
    if(/name="DS_/.test(sp))return sp;
    const tb=sp.match(/<p:txBody>[\s\S]*?<\/p:txBody>/);if(!tb)return sp;
    if(!/<a:t>[^<]*\S/.test(tb[0]))return sp;
    const phm=sp.match(/<p:ph\b([^>]*)\/?>/);
    const ph=phm?{type:(phm[1].match(/type="(\w+)"/)||[])[1]||"body",idx:(phm[1].match(/idx="(\d+)"/)||[])[1]||"0"}:null;
    if(ph&&/^(sldNum|dt|ftr|hdr)$/.test(ph.type))return sp;
    let ext=sp.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
    if(!ext&&ph&&inh){const g=inh.geom(ph);if(g)ext=[null,g.cx,g.cy]}
    const body=tb[0].match(/<a:bodyPr\b[^>]*\/?>/);const bp=body?body[0]:"";
    const ins=(n,d)=>{const m=bp.match(new RegExp(`\\s${n}="(-?\\d+)"`));return m?+m[1]:d};
    const fsM=tb[0].match(/<a:normAutofit\b[^>]*fontScale="(\d+)"/);const fScale=fsM?+fsM[1]/100000:1;
    const lsM=tb[0].match(/<a:lnSpc><a:spcPct val="(\d+)"/);const lnPct=lsM?+lsM[1]/100000:1;
    const wrapNone=/wrap="none"/.test(bp);const auto=/<a:spAutoFit\/>/.test(tb[0]);
    const W=ext?(+ext[1]-ins("lIns",91440)-ins("rIns",91440)):null;
    const H=ext?(+ext[2]-ins("tIns",45720)-ins("bIns",45720)):null;
    const lstLvl={};const ls=tb[0].match(/<a:lstStyle>[\s\S]*?<\/a:lstStyle>/);
    if(ls)for(const l of ls[0].matchAll(/<a:lvl(\d)pPr\b[\s\S]*?<\/a:lvl\1pPr>/g)){const s=l[0].match(/<a:defRPr\b[^>]*\ssz="(\d+)"/);if(s)lstLvl[+l[1]]=+s[1]}
    const base=lvl=>lstLvl[lvl]||(inh?inh.size(ph,lvl):1800);
    const paras=[...tb[0].matchAll(/<a:p>[\s\S]*?<\/a:p>|<a:p\/>/g)].map(pm=>{
      const p=pm[0];const lvl=+((p.match(/<a:pPr\b[^>]*\slvl="(\d)"/)||[])[1]||0)+1;const runs=[];
      for(const r of p.matchAll(/<a:(?:r|fld)\b[^>]*>([\s\S]*?)<\/a:(?:r|fld)>/g)){
        const sz=(r[1].match(/<a:rPr\b[^>]*\ssz="(\d+)"/)||[])[1];
        const t=(r[1].match(/<a:t>([\s\S]*?)<\/a:t>/)||[])[1]||"";
        runs.push({len:xmlUnesc(t).length,sz:sz?+sz:base(lvl)});
      }
      if(!runs.length){const e=(p.match(/<a:endParaRPr\b[^>]*\ssz="(\d+)"/)||[])[1];runs.push({len:0,sz:e?+e:base(lvl)})}
      return runs;
    });
    const target=s=>Math.max(Math.round(s*scale),floor>s?floor:0,s);
    const newSz=(s,k)=>Math.round((s+k*(target(s)-s))/50)*50;
    const fits=k=>{
      if(!ext)return k===0;
      let height=0;
      for(const runs of paras){
        let width=0,maxS=0;
        for(const r of runs){const s=newSz(r.sz,k)*fScale;width+=r.len*s*0.52*127;maxS=Math.max(maxS,s)}
        if(wrapNone&&width>W*1.02)return false;
        const lines=wrapNone?1:Math.max(1,Math.ceil(width*1.06/Math.max(W,1)));
        height+=lines*maxS*1.2*lnPct*127;
      }
      return height<=H*(auto?1.25:1.02);
    };
    let k=1;
    if(!fits(1)){
      let lo=0,hi=1;for(let i=0;i<12;i++){const mid=(lo+hi)/2;if(fits(mid))lo=mid;else hi=mid}
      k=lo;capped++;
    }
    if(k<0.05)return sp;
    // rewrite every paragraph: explicit sizes on runs + end marks
    const nb=tb[0].replace(/<a:p>[\s\S]*?<\/a:p>/g,p=>{
      const lvl=+((p.match(/<a:pPr\b[^>]*\slvl="(\d)"/)||[])[1]||0)+1;const b=base(lvl);
      const fixTag=tag=>{const m=tag.match(/\ssz="(\d+)"/);const s=m?+m[1]:b;const n=newSz(s,k);
        return m?tag.replace(/\ssz="\d+"/,` sz="${n}"`):tag.replace(/^<a:(rPr|endParaRPr)/,`<a:$1 sz="${n}"`)};
      let q=p.replace(/<a:(?:rPr|endParaRPr)\b[^>]*?\/?>/g,fixTag);
      q=q.replace(/<a:(r|fld)(\b[^>]*)>(?!\s*<a:rPr)/g,(m,t,at)=>`<a:${t}${at}><a:rPr lang="en-US" sz="${newSz(b,k)}" dirty="0"/>`);
      return q;
    });
    if(nb===tb[0])return sp;
    changed++;
    return sp.replace(tb[0],nb);
  });
  return{xml:out,changed,capped};
}

/* ---------- keyword emphasis ---------- */
function keywordRegex(list){
  const words=list.map(w=>w.trim()).filter(Boolean).map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));
  if(!words.length)return null;
  words.sort((a,b)=>b.length-a.length);
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${words.join("|")})(?![\\p{L}\\p{N}])`,"giu");
}
/* static: split runs so each match gets bold + colour (+ marker) */
function highlightKeywordsStatic(xml,re,style){
  let count=0;
  const out=xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g,sp=>{
    if(/name="DS_/.test(sp))return sp;
    return sp.replace(/<a:r>([\s\S]*?)<\/a:r>/g,(whole,inner)=>{
      const tm=inner.match(/<a:t>([\s\S]*?)<\/a:t>/);if(!tm)return whole;
      const text=xmlUnesc(tm[1]);re.lastIndex=0;
      const ms=[...text.matchAll(re)];if(!ms.length)return whole;
      const rprM=inner.match(/<a:rPr\b[^>]*\/>|<a:rPr\b[^>]*>[\s\S]*?<\/a:rPr>/);
      const rpr=rprM?rprM[0]:`<a:rPr lang="en-US"/>`;
      const hot=styleRPr(rpr,style);
      const mk=(r,t)=>`<a:r>${r}<a:t>${xmlEsc(t)}</a:t></a:r>`;
      let res="",last=0;
      for(const m of ms){
        if(m.index>last)res+=mk(rpr,text.slice(last,m.index));
        res+=mk(hot,m[0]);last=m.index+m[0].length;count++;
      }
      if(last<text.length)res+=mk(rpr,text.slice(last));
      return res;
    });
  });
  return{xml:out,count};
}
/* on-click: character ranges per shape, computed in PowerPoint's counting (paragraph end = 1 char, <a:br/> = 1 char) */
function keywordCharRanges(xml,re){
  const out=[];
  for(const spm of xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)){
    const sp=spm[0];if(/name="DS_/.test(sp))continue;
    const idm=sp.match(/<p:cNvPr\b[^>]*?\sid="(\d+)"/);if(!idm)continue;
    const tb=sp.match(/<p:txBody>[\s\S]*?<\/p:txBody>/);if(!tb)continue;
    let pos=0;
    for(const pm of tb[0].matchAll(/<a:p>[\s\S]*?<\/a:p>|<a:p\/>/g)){
      for(const el of pm[0].matchAll(/<a:(r|fld)\b[^>]*>([\s\S]*?)<\/a:\1>|<a:br\b[^>]*?(?:\/>|>[\s\S]*?<\/a:br>)/g)){
        if(!el[1]){pos+=1;continue}
        const t=xmlUnesc((el[2].match(/<a:t>([\s\S]*?)<\/a:t>/)||[])[1]||"");
        if(el[1]==="r"){re.lastIndex=0;for(const m of t.matchAll(re))out.push({spid:idm[1],charRg:[pos+m.index,pos+m.index+m[0].length]})}
        pos+=t.length;
      }
      pos+=1;
    }
  }
  return out;
}

/* ---------- new shapes ---------- */
function textBoxXml(id,name,{x,y,w,h,text,sz,color,alpha,bold,algn,anchor,fill,font,wrap,fld,geom,noAutofit}){
  const clr=`<a:srgbClr val="${color||"7F7F7F"}">${alpha!=null&&alpha<100?`<a:alpha val="${Math.round(alpha*1000)}"/>`:""}</a:srgbClr>`;
  const rpr=`<a:rPr lang="en-US" sz="${sz}"${bold?' b="1"':""} dirty="0"><a:solidFill>${clr}</a:solidFill>${font?`<a:latin typeface="${font}"/>`:""}</a:rPr>`;
  const run=fld?`<a:fld id="{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}" type="slidenum">${rpr}<a:t>${xmlEsc(text)}</a:t></a:fld>`:`<a:r>${rpr}<a:t>${xmlEsc(text)}</a:t></a:r>`;
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="${geom||"rect"}"><a:avLst/></a:prstGeom>${fill?`<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>`:"<a:noFill/>"}</p:spPr><p:txBody><a:bodyPr wrap="${wrap||"none"}" lIns="0" tIns="0" rIns="0" bIns="0" rtlCol="0" anchor="${anchor||"ctr"}">${noAutofit===false?"":"<a:noAutofit/>"}</a:bodyPr><a:lstStyle/><a:p><a:pPr algn="${algn||"l"}"/>${run}</a:p></p:txBody></p:sp>`;
}
function rectXml(id,name,{x,y,w,h,fill,geom}){
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="${geom||"rect"}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`;
}
function picXml(id,name,rId,{x,y,w,h,alpha}){
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${name}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rId}">${alpha!=null&&alpha<100?`<a:alphaModFix amt="${Math.round(alpha*1000)}"/>`:""}</a:blip><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}
function appendToSpTree(xml,frag){const i=xml.lastIndexOf("</p:spTree>");return i<0?xml:xml.slice(0,i)+frag+xml.slice(i)}
function removeDsShapes(xml,prefixes){
  const removed=[];
  const re=/<p:(sp|pic)>(?:(?!<p:(?:sp|pic)>)[\s\S])*?<p:cNvPr\b[^>]*?\sid="(\d+)"[^>]*?\sname="(DS_[A-Za-z]+)[^"]*"[\s\S]*?<\/p:\1>/g;
  const out=xml.replace(re,(m,tag,id,name)=>{if(prefixes.some(p=>name===p)){removed.push(id);return""}return m});
  return{xml:out,removed};
}
function ensureRNs(xml){
  if(/xmlns:r=/.test(xml.slice(0,600)))return xml;
  return xml.replace(/<p:sld\b/,`<p:sld xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`);
}
function stampBox(cfg,W,H){
  const m=Math.round(W*0.03),sz=Math.round((cfg.size||14)*100);
  const hEmu=Math.round(sz*127*1.5),wEmu=Math.round(W*0.4);
  const pos=cfg.pos||"bc";
  const x=pos[1]==="l"?m:pos[1]==="r"?W-m-wEmu:Math.round((W-wEmu)/2);
  const y=pos[0]==="t"?Math.round(H*0.02):pos[0]==="m"?Math.round((H-hEmu)/2):H-Math.round(H*0.02)-hEmu;
  return{x,y,w:wEmu,h:hEmu,algn:pos[1]==="l"?"l":pos[1]==="r"?"r":"ctr",sz};
}

/* ---------- MCQ detection ---------- */
const LABEL_RE=/^[\(\[]?\s*([a-hA-H])\s*[\)\].:]?$/;
const PARA_OPT_RE=/^\s*(?:[\(\[]([a-hA-H1-8])[\)\]]|([a-hA-H])[\)\].])\s+\S/;
function letterIdx(ch){if(/[1-8]/.test(ch))return +ch-1;return ch.toLowerCase().charCodeAt(0)-97}
function detectQuestion(shapes,excluded,W,H){
  const pool=shapes.filter(s=>!excluded.has(s.id)&&!s.ds);
  // style 1: separate label shapes ("a", "(b)", "C.")
  const labels=pool.filter(s=>s.kind==="text"&&s.ln==="sp"&&hasBox(s)&&s.w<W*0.15&&LABEL_RE.test(s.text.trim()));
  const byLetter=new Map();let dupL=false;
  for(const l of labels){const i=letterIdx(s_(l));if(byLetter.has(i))dupL=true;else byLetter.set(i,l)}
  if(dupL)return null;
  function s_(l){return l.text.trim().match(LABEL_RE)[1]}
  let n=0;while(byLetter.has(n))n++;
  if(n>=3&&n<=8){
    const used=new Set();const options=[];
    for(let i=0;i<n;i++){
      const L=byLetter.get(i);used.add(L.id);
      const Lx=cx(L),Ly=cy(L);
      const cont=pool.filter(s=>s.id!==L.id&&s.kind!=="text"&&s.ln==="sp"&&contains(s,Lx,Ly)&&s.w<W*0.95).sort((a,b)=>a.w*a.h-b.w*b.h)[0]||null;
      let texts;
      if(cont)texts=pool.filter(s=>s.kind==="text"&&s.id!==L.id&&!labels.includes(s)&&hasBox(s)&&contains(cont,cx(s),cy(s)));
      else{
        const right=pool.filter(s=>s.kind==="text"&&s.id!==L.id&&!labels.includes(s)&&hasBox(s)&&s.x>=L.x+L.w*0.5&&Ly>=s.y&&Ly<=s.y+s.h).sort((a,b)=>a.x-b.x);
        texts=right.slice(0,1);
      }
      const parts=[cont,L,...texts].filter(Boolean);
      parts.forEach(p=>used.add(p.id));
      const xs=parts.map(p=>p.x),ys=parts.map(p=>p.y),xe=parts.map(p=>p.x+p.w),ye=parts.map(p=>p.y+p.h);
      options.push({letter:i,parts:parts.map(p=>p.id),label:L.id,main:(texts[0]||L).id,container:cont?cont.id:null,
        box:{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xe)-Math.min(...xs),h:Math.max(...ye)-Math.min(...ys)}});
    }
    return finishQuestion(pool,options,used,W,H,"shapes");
  }
  // style 2: one shape per option starting with "(a) …"
  const optShapes=pool.filter(s=>s.kind==="text"&&s.paras.filter(p=>p.has).length>=1&&PARA_OPT_RE.test(s.paras.find(p=>p.has).text));
  const bl2=new Map();
  let dup2=false;
  for(const s of optShapes){if(s.paras.filter(p=>p.has&&PARA_OPT_RE.test(p.text)).length>1)continue;const m=s.paras.find(p=>p.has).text.match(PARA_OPT_RE);const i=letterIdx(m[1]||m[2]);if(bl2.has(i))dup2=true;else bl2.set(i,s)}
  if(dup2)return null;
  n=0;while(bl2.has(n))n++;
  if(n>=3){
    const used=new Set();const options=[];
    for(let i=0;i<n;i++){
      const s=bl2.get(i);used.add(s.id);
      const cont=hasBox(s)?pool.filter(c=>c.id!==s.id&&c.kind!=="text"&&c.ln==="sp"&&contains(c,cx(s),cy(s))&&c.w<W*0.95&&c.w*c.h<s.w*s.h*4).sort((a,b)=>a.w*a.h-b.w*b.h)[0]:null;
      if(cont)used.add(cont.id);
      const parts=cont?[cont.id,s.id]:[s.id];const bx=cont||s;
      options.push({letter:i,parts,label:null,main:s.id,container:cont?cont.id:null,box:hasBox(bx)?{x:bx.x,y:bx.y,w:bx.w,h:bx.h}:null});
    }
    return finishQuestion(pool,options,used,W,H,"shapes");
  }
  // style 3: one text box whose paragraphs are the options
  for(const s of pool){
    if(s.kind!=="text")continue;
    const ps=s.paras.filter(p=>p.has&&PARA_OPT_RE.test(p.text));
    const bl3=new Map();
    for(const p of ps){const m=p.text.match(PARA_OPT_RE);const i=letterIdx(m[1]||m[2]);if(!bl3.has(i))bl3.set(i,p)}
    let k=0;while(bl3.has(k))k++;
    if(k>=3){
      const options=[];for(let i=0;i<k;i++)options.push({letter:i,parts:[s.id],pRg:bl3.get(i).idx,label:null,main:s.id,container:null,box:null});
      const firstOpt=bl3.get(0).idx;
      // paragraphs before the first option in the same box are the stem
      const stemParas=s.paras.filter(p=>p.has&&p.idx<firstOpt).map(p=>p.idx);
      const lastOpt=bl3.get(k-1).idx;
      const explParas=s.paras.filter(p=>p.has&&p.idx>lastOpt).map(p=>p.idx);
      const used=new Set([s.id]);
      const q=finishQuestion(pool,options,used,W,H,"paras",s);
      q.inBox={spid:s.id,stemParas,explParas};
      return q;
    }
  }
  return null;
}
function finishQuestion(pool,options,used,W,H,style,box){
  const oBoxes=options.map(o=>o.box).filter(Boolean);
  const src=box&&hasBox(box)?[box]:null;
  const top=oBoxes.length?Math.min(...oBoxes.map(b=>b.y)):(src?src[0].y:H*0.4);
  const bottom=oBoxes.length?Math.max(...oBoxes.map(b=>b.y+b.h)):(src?src[0].y+src[0].h:H*0.8);
  const isChrome=s=>(s.isPh&&/^(sldNum|ftr|dt|hdr)$/.test(s.phType))||(hasBox(s)&&s.y>H*0.9&&s.maxSz&&s.maxSz<=1200)||(hasBox(s)&&s.y+s.h<H*0.14&&s.maxSz&&s.maxSz<=1400);
  const rest=pool.filter(s=>!used.has(s.id)&&hasBox(s)&&s.kind!=="pic"&&!isChrome(s));
  const stemText=rest.filter(s=>s.kind==="text"&&s.y+s.h<=top+H*0.02&&s.y>=top-H*0.5&&s.maxSz>=1800);
  const explText=rest.filter(s=>s.kind==="text"&&s.y>=bottom-H*0.02&&s.maxSz>=1400);
  const withCont=list=>{
    const ids=new Set(list.map(s=>s.id));
    for(const c of rest)if(c.kind!=="text"&&c.ln==="sp"&&list.some(t=>contains(c,cx(t),cy(t)))&&c.w<W*0.98)ids.add(c.id);
    return[...ids];
  };
  return{style,options,stem:withCont(stemText),expl:withCont(explText),top,bottom};
}

/* ---------- answer key ---------- */
function parseKey(s){
  s=(s||"").trim();if(!s)return[];
  const ans=[];
  const numbered=[...s.matchAll(/(?:q(?:uestion)?\s*\.?\s*)?(\d{1,3})\s*(?:[\).:\-–=]\s*|\s+)\(?\s*([a-hA-H])\s*\)?(?![a-zA-Z])/gi)];
  const numberedDigit=[...s.matchAll(/(?:q\s*\.?\s*)?(\d{1,3})\s*[\).:\-–=]\s*\(?([1-8])\)?(?!\d)/gi)];
  if(numbered.length>=1&&numbered.length>=numberedDigit.length){for(const m of numbered)ans[+m[1]-1]=letterIdx(m[2]);return ans}
  if(numberedDigit.length>=1){for(const m of numberedDigit)ans[+m[1]-1]=+m[2]-1;return ans}
  const toks=s.replace(/[(),;|\/\s.\-]+/g," ").trim();
  if(/^[a-hA-H]+$/.test(toks.replace(/ /g,""))&&!/ /.test(toks))return[...toks].map(letterIdx);
  return toks.split(" ").filter(Boolean).map(t=>/^[a-hA-H]$/.test(t)?letterIdx(t):/^[1-8]$/.test(t)?+t-1:null);
}
const LETTERS="abcdefgh";

/* ---------- the per-slide animation plan ---------- */
/*
 cfg.anim      : regular animation opts or null   {effect,dir,granularity,trigger,duration,stagger,skipTitle,dimAfter,scope}
 cfg.existing  : "keep" | "replace"
 cfg.strip     : bool
 cfg.q         : question opts or null {stem:"static"|"click", options:"each"|"together"|"static", effect, dir, dur,
                  timer:{secs,start:"click"|"after",color}, reveal:"tick"|"bold", greyWrong, explAfter}
 cfg.kw        : {re, mode:"click", color} or null
 ctx           : {W,H,parse,answer (index|null), nextId}
*/
function planSlide(xml,cfg,ctx){
  const notes=[];const res={xml,notes,animated:0,question:null,preview:null};
  const doc=ctx.parse(xml);
  const shapes=getShapes(doc);
  const spKinds={};shapes.forEach(s=>spKinds[s.id]=s.ln);
  const tm=parseTiming(xml);
  const marker=readDsMarker(xml);
  let keptGroups=[],keptBld=[];
  if(tm&&!tm.complex){
    let gs=tm.groups.map((g,i)=>({...g,i}));
    if(marker){const n=gs.length;gs=gs.filter(g=>g.i>=marker.pre&&g.i<n-marker.post)}
    gs=gs.filter(g=>!g.spids.some(id=>ctx.dsRemoved&&ctx.dsRemoved.includes(id)));
    keptGroups=gs;
    const keptIds=new Set(gs.flatMap(g=>g.spids));
    keptBld=tm.bld.filter(b=>b.spid&&keptIds.has(b.spid));
  }
  const hadTiming=!!tm;
  const origAnimated=new Set(keptGroups.flatMap(g=>g.spids));

  if(cfg.strip){
    if(hadTiming){res.xml=setDsMarker(removeTiming(xml),null);notes.push("animations stripped");res.stripped=true}
    return res;
  }
  const replace=cfg.existing==="replace";
  if(tm&&tm.complex&&!replace){notes.push("kept existing (has triggers)");return res}
  const excluded=replace?new Set():origAnimated;

  // ----- question detection
  let q=null;
  if(cfg.q)q=detectQuestion(shapes,excluded,ctx.W,ctx.H);
  const pre=[],post=[];const newShapes=[];
  const E=(t,fx,node,extra)=>Object.assign({t,fx,node,dur:500,delay:0},extra||{});

  let ans=null;
  if(q){
    const Q=cfg.q;const hasReveal=!replace&&keptGroups.length>0;
    res.question={options:q.options.length,hasReveal,style:q.style};
    // existing reveal answer letter (for key check)
    if(hasReveal){
      const revealIds=new Set(keptGroups.flatMap(g=>g.spids));
      const letterShape=shapes.find(s=>revealIds.has(s.id)&&s.kind==="text"&&LABEL_RE.test(s.text.trim()));
      if(letterShape)res.question.revealLetter=letterIdx(letterShape.text.trim().match(LABEL_RE)[1]);
      else{
        // fall back: reveal overlay sitting on top of an option
        const ov=shapes.find(s=>revealIds.has(s.id)&&hasBox(s)&&q.options.some(o=>o.box&&Math.abs(o.box.x-s.x)<50000&&Math.abs(o.box.y-s.y)<50000));
        if(ov){const o=q.options.find(o=>o.box&&Math.abs(o.box.x-ov.x)<50000&&Math.abs(o.box.y-ov.y)<50000);res.question.revealLetter=o.letter}
      }
    }
    const inBox=q.inBox;
    // stem
    if(Q.stem==="click"){
      const st=q.stem.map(id=>({spid:id}));
      if(inBox)inBox.stemParas.forEach(p=>st.push({spid:inBox.spid,pRg:[p,p]}));
      st.forEach((t,i)=>pre.push(E(t,Q.effect,i===0?"click":"with",{dir:Q.dir,dur:Q.dur})));
    }
    // options
    if(Q.options!=="static"){
      q.options.forEach((o,oi)=>{
        const ts=o.pRg!=null?[{spid:o.main,pRg:[o.pRg,o.pRg]}]:o.parts.map(id=>({spid:id}));
        ts.forEach((t,i)=>pre.push(E(t,Q.effect,(i===0&&(Q.options==="each"||oi===0))?"click":"with",{dir:Q.dir,dur:Q.dur})));
      });
    }else if(inBox){ /* nothing */ }
    // explanation paragraphs inside the options box must be hidden until after the answer
    // timer
    if(Q.timer&&Q.timer.secs>0){
      const barH=Math.round(ctx.H*0.013);const id=ctx.nextId++;
      newShapes.push(rectXml(id,"DS_Timer",{x:0,y:ctx.H-barH,w:ctx.W,h:barH,fill:Q.timer.color||"2E9E5B"}));
      spKinds[id]="sp";
      const ms=Q.timer.secs*1000;
      pre.push(E({spid:String(id)},"wipeout",Q.timer.start==="after"&&pre.length?"after":"click",{dir:"r",dur:ms}));
      if(Q.timer.secs>15)pre.push(E({spid:String(id)},"fillred","with",{dur:600,delay:ms-10000}));
      res.question.timer=true;
    }
    // keyword on-click (before the reveal)
    addKeywordClicks(xml,cfg,pre,E,excluded);
    // answer from key
    ans=ctx.answerFor?ctx.answerFor():ctx.answer;
    if(!hasReveal&&ans!=null&&q.options[ans]){
      const o=q.options[ans];
      const tgts=o.pRg!=null?[{spid:o.main,pRg:[o.pRg,o.pRg]}]:[{spid:o.main},...(o.label&&o.label!==o.main?[{spid:o.label}]:[])];
      tgts.forEach((t,i)=>post.push(E(t,"answer",i===0?"click":"with",{dur:500})));
      if(Q.reveal==="tick"&&o.box){
        const d=Math.round(Math.min(o.box.h*0.55,ctx.H*0.07));const id=ctx.nextId++;
        const x=o.box.x+o.box.w-d-Math.round(d*0.35),y=o.box.y+Math.round((o.box.h-d)/2);
        newShapes.push(textBoxXml(id,"DS_Tick",{x,y,w:d,h:d,text:"\u2714",sz:Math.round(d/127*0.55),color:"FFFFFF",bold:true,algn:"ctr",anchor:"ctr",fill:"00B050",geom:"ellipse"}));
        spKinds[id]="sp";
        post.push(E({spid:String(id)},"zoom","with",{dur:400}));
      }
      if(Q.greyWrong)q.options.forEach(w=>{if(w.letter===ans)return;
        const t=w.pRg!=null?{spid:w.main,pRg:[w.pRg,w.pRg]}:{spid:w.main};post.push(E(t,"greyout","with",{dur:300}))});
      res.question.keyApplied=true;
    }
    // explanation after the answer
    if(!hasReveal&&Q.explAfter){
      const ex=q.expl.map(id=>({spid:id}));
      if(inBox)inBox.explParas.forEach(p=>ex.push({spid:inBox.spid,pRg:[p,p]}));
      ex.forEach((t,i)=>post.push(E(t,"fade",i===0?"click":"with",{dur:500})));
    }
  }else{
    // regular slide
    const touchRegular=cfg.anim&&(replace||!hadTiming);
    if(touchRegular){
      let sh=shapes.filter(s=>!s.ds&&!excluded.has(s.id));
      if(cfg.anim.skipTitle)sh=sh.filter(s=>!s.isTitle);
      const A=cfg.anim;const clickMode=A.trigger==="click";
      const items=[];
      for(const s of sh){
        if(A.scope&&!A.scope[s.kind])continue;
        if(s.kind==="other"&&s.ln==="cxnSp"&&A.scope&&!A.scope.other)continue;
        if(A.granularity==="para"&&s.kind==="text"){
          const ne=s.paras.filter(p=>p.has);
          if(ne.length>=2){ne.forEach(p=>items.push({spid:s.id,pRg:[p.idx,p.idx]}));continue}
        }
        items.push({spid:s.id});
      }
      const cls=(EFFECTS[A.effect]||EFFECTS.fade).cls||"entr";
      items.forEach((t,i)=>pre.push(E(t,A.effect,clickMode?"click":(i===0?"after":"with"),{dir:A.dir,dur:A.duration,delay:clickMode?0:i*A.stagger,dim:A.dimAfter&&clickMode&&cls==="entr"})));
    }
    addKeywordClicks(xml,cfg,touchRegular?pre:post,E,excluded);
  }

  if(!pre.length&&!post.length&&!newShapes.length){
    if(replace&&hadTiming&&cfg.anim===null&&!q){} // nothing
    return res;
  }
  // assemble
  let out=xml;
  if(newShapes.length)out=appendToSpTree(out,newShapes.join(""));
  const idRef={next:3};
  const all=[...pre,...post];
  // PowerPoint numbers each distinct build on a shape: 0 for the first class of effect, 1 for the next…
  const grpMap={};
  for(const ef of all){const m=grpMap[ef.t.spid]||(grpMap[ef.t.spid]={n:0,by:{}});const c=effectCls(ef);if(!(c in m.by))m.by[c]=m.n++;ef.grp=m.by[c]}
  const kept=replace?[]:keptGroups;
  let groups=compileEffects(pre,idRef);
  for(const g of kept)groups+=renumberCTn(g.xml,idRef);
  groups+=compileEffects(post,idRef);
  // bld: kept entries + new ones (skip duplicates)
  const newBld=bldEntries(all,spKinds);
  const keptB=replace?[]:keptBld.map(b=>b.xml);
  const have=new Set(keptB.map(x=>{const a=x.match(/spid="(\d+)"/),b=x.match(/grpId="(\d+)"/);return(a?a[1]:"")+"|"+(b?b[1]:"0")}));
  const nb=(newBld.match(/<p:bldP[^>]*\/>/g)||[]).filter(x=>{const a=x.match(/spid="(\d+)"/)[1],b=x.match(/grpId="(\d+)"/)[1];return!have.has(a+"|"+b)});
  const ins=insertTiming(out,timingXml(groups,keptB.join("")+nb.join("")));
  if(ins===null){notes.push("could not place animations");return res}
  out=setDsMarker(ins,pre.length?countOuter(pre):0,post.length?countOuter(post):0);
  res.xml=out;res.animated=all.length;
  // preview sequence: list of clicks, each a list of effects
  res.preview=buildPreviewSeq(pre,kept,post);
  if(q){
    notes.push(`question · ${q.options.length} options`+(res.question.hasReveal?" · kept its answer reveal":"")+(res.question.keyApplied?" · key reveal "+LETTERS[ans]:"")+(res.question.timer?" · timer":""));
  }else if(pre.length||post.length){
    notes.push(all.length+" animation"+(all.length>1?"s":"")+(kept.length?" (existing kept)":""));
  }
  return res;
}
function countOuter(effects){let n=0;effects.forEach((e,i)=>{if(i===0||e.node==="click")n++});return n}
function addKeywordClicks(xml,cfg,list,E,excluded){
  if(!cfg.kw||cfg.kw.mode!=="click"||!cfg.kw.re)return;
  const rs=keywordCharRanges(xml,cfg.kw.re).filter(r=>!excluded.has(r.spid));
  rs.forEach((r,i)=>list.push(E({spid:r.spid,charRg:r.charRg},"keyword",i===0||cfg.kw.each?"click":"with",{dur:400,color:cfg.kw.color})));
}
function buildPreviewSeq(pre,kept,post){
  const clicks=[];let cur=null;
  const push=(e,isClick)=>{if(!cur||isClick){cur=[];clicks.push({auto:!isClick,items:cur})}cur.push(e)};
  const addEffects=list=>list.forEach(e=>push({t:e.t,cls:effectCls(e),fx:e.fx,dur:e.dur,delay:e.delay||0,node:e.node,color:e.color,dir:e.dir,dim:e.dim},e.node==="click"));
  addEffects(pre);
  for(const g of kept){const s=summariseGroup(g.xml);s.forEach((e,i)=>push(e,i===0&&!g.auto))}
  addEffects(post);
  return clicks;
}

/* ---------- packaging helpers ---------- */
function ensureContentType(ctXml,ext,mime){
  if(new RegExp(`Extension="${ext}"`,"i").test(ctXml))return ctXml;
  return ctXml.replace("</Types>",`<Default Extension="${ext}" ContentType="${mime}"/></Types>`);
}
function addRel(relsXml,target,type){
  const existing=relsXml.match(new RegExp(`<Relationship[^>]*Target="${target.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}"[^>]*>`));
  if(existing){const id=existing[0].match(/Id="([^"]+)"/);if(id)return{xml:relsXml,rId:id[1]}}
  let max=0;const re=/Id="rId(\d+)"/g;let m;
  while((m=re.exec(relsXml)))max=Math.max(max,parseInt(m[1],10));
  const rId="rId"+(max+1);
  const frag=`<Relationship Id="${rId}" Type="${type||"http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"}" Target="${target}"/>`;
  return{xml:relsXml.replace("</Relationships>",frag+"</Relationships>"),rId};
}
function addImageRel(relsXml,target){return addRel(relsXml,target)}

/* ---------- title slide ---------- */
function titleSlideXml(o,W,H){
  const dark=o.tone!=="light";
  const fg=dark?"FFFFFF":"14181F",accent=o.accent||"D4AF37",muted=dark?"B8C2D8":"5A6275";
  const mx=Math.round(W*0.08);
  let id=2;const parts=[];
  parts.push(rectXml(id++,"DS_TitleAccent",{x:mx,y:Math.round(H*0.30),w:Math.round(W*0.08),h:Math.round(H*0.011),fill:accent}));
  if(o.kicker)parts.push(textBoxXml(id++,"DS_TitleKicker",{x:mx,y:Math.round(H*0.20),w:W-2*mx,h:Math.round(H*0.07),text:o.kicker,sz:1600,color:accent,bold:true,anchor:"b"}));
  parts.push(textBoxXml(id++,"DS_TitleMain",{x:mx,y:Math.round(H*0.34),w:W-2*mx,h:Math.round(H*0.30),text:o.title||"Untitled",sz:o.titleSz||5000,color:fg,bold:true,anchor:"t",wrap:"square",font:"+mj-lt"}));
  if(o.subtitle)parts.push(textBoxXml(id++,"DS_TitleSub",{x:mx,y:Math.round(H*0.64),w:W-2*mx,h:Math.round(H*0.09),text:o.subtitle,sz:2400,color:muted,anchor:"t",wrap:"square"}));
  if(o.presenter)parts.push(textBoxXml(id++,"DS_TitleBy",{x:mx,y:Math.round(H*0.82),w:W-2*mx,h:Math.round(H*0.06),text:o.presenter,sz:1600,color:muted,anchor:"ctr"}));
  const bg=o.bg||{type:"solid",c1:"0D1526"};
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="Title">${bgFragment(bg,o.bgRid)}<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${parts.join("")}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

/* ---------- whole-deck pipeline (browser + Node) ---------- */
function slideNamesOf(zip){
  return Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a,b)=>parseInt(a.match(/\d+/))-parseInt(b.match(/\d+/)));
}
/* slide order as shown in PowerPoint (presentation.xml sldIdLst), not file names */
async function orderedSlides(zip){
  const pres=await zip.file("ppt/presentation.xml").async("string");
  const rels=await zip.file("ppt/_rels/presentation.xml.rels").async("string");
  const map={};for(const m of rels.matchAll(/<Relationship\b[^>]*>/g)){const id=(m[0].match(/Id="([^"]+)"/)||[])[1],t=(m[0].match(/Target="([^"]+)"/)||[])[1];if(id&&t)map[id]=t}
  const out=[];
  for(const m of pres.matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)){
    const t=map[m[1]];if(!t)continue;
    const name="ppt/"+t.replace(/^\/?ppt\//,"").replace(/^\.\//,"");
    if(zip.file(name))out.push(name);
  }
  return out.length?out:slideNamesOf(zip);
}
async function slideSize(zip){
  const pres=await zip.file("ppt/presentation.xml").async("string");
  const m=pres.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
  return m?{W:+m[1],H:+m[2]}:{W:12192000,H:6858000};
}
function relsNameFor(name){return name.replace(/^(.*)\/([^/]+)$/,"$1/_rels/$2.rels")}

async function analyseDeck(zip,parse){
  const names=await orderedSlides(zip);const{W,H}=await slideSize(zip);
  const out=[];
  for(let i=0;i<names.length;i++){
    const xml=fixDuplicateIds(await zip.file(names[i]).async("string")).xml;
    const doc=parse(xml);const shapes=getShapes(doc);
    const tm=parseTiming(xml);
    const excluded=new Set(tm&&!tm.complex?tm.groups.flatMap(g=>g.spids):[]);
    const q=detectQuestion(shapes,excluded,W,H);
    const tmx=xml.match(/<a:t>([^<]{1,60})/g)||[];
    const label=(shapes.filter(s=>s.kind==="text").sort((a,b)=>b.maxSz-a.maxSz)[0]||{text:""}).text.split("\n")[0].slice(0,48)||(tmx[0]||"").replace("<a:t>","");
    let revealLetter=null;
    if(q&&excluded.size){
      const L=shapes.find(s=>excluded.has(s.id)&&s.kind==="text"&&LABEL_RE.test(s.text.trim()));
      if(L)revealLetter=letterIdx(L.text.trim().match(LABEL_RE)[1]);
    }
    out.push({num:i+1,name:names[i],label,isQ:!!q,options:q?q.options.length:0,hasReveal:!!(q&&excluded.size),revealLetter,hasTiming:!!tm});
  }
  return out;
}

async function transformSlide(xml,num,cfg,ctx){
  const{W,H,bgTarget,logoTarget,logo,kwRe}=ctx;
  const notes=[];let fixed=0;
  const fx=fixDuplicateIds(xml);if(fx.fixed){xml=fx.xml;notes.push(`repaired ${fx.fixed} duplicate shape ID${fx.fixed>1?"s":""}`);fixed=fx.fixed}
  // remove our own shapes from an earlier run when the feature is re-applied
  const drop=[];
  if(cfg.stamp)drop.push("DS_Stamp","DS_Logo");
  if(cfg.nums&&cfg.nums.on)drop.push("DS_Num");
  if(cfg.q||cfg.existing==="replace"||cfg.strip)drop.push("DS_Tick","DS_Timer");
  const rm=removeDsShapes(xml,drop);xml=rm.xml;

  if(cfg.boost&&(cfg.boost.scale>1||cfg.boost.floor)){
    const b=boostFonts(xml,cfg.boost.scale,cfg.boost.floor,await ctx.inheritFor());
    if(b.changed){xml=b.xml;notes.push(`text enlarged in ${b.changed} box${b.changed>1?"es":""}`+(b.capped?` (${b.capped} limited to fit)`:""))}
  }
  if(cfg.bg){
    let rId=null;
    if(bgTarget){xml=ensureRNs(xml);rId=await ctx.addSlideRel(bgTarget)}
    if(!bgTarget||rId){
      xml=applyBg(xml,bgFragment(cfg.bg,rId)).xml;notes.push("background");
      if(cfg.doContrast){xml=recolorRuns(xml,cfg.tone);notes.push("text recoloured")}
    }
  }
  if(kwRe&&cfg.kw.mode==="static"){
    const k=highlightKeywordsStatic(xml,kwRe,{color:cfg.kw.color,bold:true,highlight:cfg.kw.marker?"FFF2A8":null});
    if(k.count){xml=k.xml;notes.push(`${k.count} keyword${k.count>1?"s":""} highlighted`)}
  }
  if(cfg.transition&&cfg.transition!=="keep"){
    const t=applyTransition(xml,cfg.transition,cfg.spd);
    if(t.note){xml=t.xml;notes.push(t.note)}
  }
  // stamp + slide number
  let nextId=maxShapeId(xml)+1;
  if(cfg.stamp&&(cfg.stamp.text||logoTarget)){
    const S=cfg.stamp;const box=stampBox(S,W,H);let frag="";
    if(S.text)frag+=textBoxXml(nextId++,"DS_Stamp",{x:box.x,y:box.y,w:box.w,h:box.h,text:S.text,sz:box.sz,color:S.color,alpha:S.alpha,algn:box.algn,anchor:"ctr"});
    if(logoTarget){
      xml=ensureRNs(xml);const rId=await ctx.addSlideRel(logoTarget);
      const lh=Math.round(H*(S.logoH||0.09)),lw=Math.round(lh*(logo.w/logo.h));
      const m=Math.round(W*0.03);const p=S.logoPos||"tr";
      const lx=p[1]==="l"?m:p[1]==="r"?W-m-lw:Math.round((W-lw)/2);
      const ly=p[0]==="t"?Math.round(H*0.03):p[0]==="m"?Math.round((H-lh)/2):H-Math.round(H*0.03)-lh;
      frag+=picXml(nextId++,"DS_Logo",rId,{x:lx,y:ly,w:lw,h:lh,alpha:S.alpha});
    }
    xml=appendToSpTree(xml,frag);notes.push("stamp");
  }
  if(cfg.nums&&cfg.nums.on&&!(cfg.nums.skipFirst&&num===1)){
    if(/<p:ph\b[^>]*type="sldNum"/.test(xml))notes.push("already numbered");
    else{
      const N=cfg.nums;const bw=Math.round(W*0.12),bh=Math.round(H*0.05),m=Math.round(W*0.025);
      const x=N.pos==="bl"?m:N.pos==="bc"?Math.round((W-bw)/2):W-m-bw;
      xml=appendToSpTree(xml,textBoxXml(nextId++,"DS_Num",{x,y:H-Math.round(H*0.02)-bh,w:bw,h:bh,text:String(num),sz:Math.round((N.size||12)*100),color:N.color||"7F7F7F",algn:N.pos==="bl"?"l":N.pos==="bc"?"ctr":"r",fld:true}));
      notes.push("slide number");
    }
  }
  // animations
  const ov=cfg.perSlide&&cfg.perSlide[num];
  let animOpts=cfg.anim;
  if(ov==="skip")animOpts=null;else if(ov&&ov!=="default"&&animOpts)animOpts={...animOpts,effect:ov};
  const slideCfg={anim:animOpts,existing:cfg.existing,strip:cfg.strip&&ov!=="skip",q:ov==="skip"?null:cfg.q,
    kw:kwRe&&cfg.kw.mode==="click"?{re:kwRe,mode:"click",color:cfg.kw.color,each:cfg.kw.each}:null};
  let asked=false;
  const r=planSlide(xml,slideCfg,{W,H,parse:ctx.parse,nextId,dsRemoved:rm.removed,answerFor:()=>{asked=true;return ctx.keyAt()}});
  const ans=asked?ctx.keyAt():null;
  xml=r.xml;notes.push(...r.notes);
  return{xml,notes,r,ans:ans==null?null:ans,fixed};
}

async function processPackage(zip,cfg,put){
  const parse=cfg.parse;
  const names=await orderedSlides(zip);
  if(!names.length)throw new Error("No slides found — is this a valid .pptx?");
  const range=parseRange(cfg.range,names.length);
  if(!range.size)throw new Error('Slide range "'+cfg.range+'" matches no slides.');
  const{W,H}=await slideSize(zip);
  const stats={touched:0,totalAnim:0,stripped:0,questions:[],fixedIds:0};

  if(cfg.palette){
    for(const tn of Object.keys(zip.files).filter(n=>/^ppt\/theme\/theme\d+\.xml$/.test(n)))
      zip.file(tn,recolorTheme(await zip.file(tn).async("string"),cfg.palette));
    put(`<span>Theme</span><b>palette recoloured (${cfg.palette})</b>`);
  }
  const presXml=await zip.file("ppt/presentation.xml").async("string");
  const cache={};const readPart=async n=>{if(!(n in cache)){const f=zip.file(n);cache[n]=f?await f.async("string"):null}return cache[n]};
  const resolve=(from,t)=>{const parts=from.split("/");parts.pop();for(const s of t.split("/")){if(s==="..")parts.pop();else if(s!==".")parts.push(s)}return parts.join("/")};
  const inheritFor=async name=>{
    const rels=await readPart(relsNameFor(name));const lt=rels&&(rels.match(/Target="([^"]*slideLayouts\/slideLayout\d+\.xml)"/)||[])[1];
    if(!lt)return makeInherit(null,null,presXml);
    const ln=resolve(name,lt);const lx=await readPart(ln);
    const lr=await readPart(ln.replace(/slideLayouts\/(slideLayout\d+\.xml)$/,"slideLayouts/_rels/$1.rels"));
    const mt=lr&&(lr.match(/Target="([^"]*slideMasters\/slideMaster\d+\.xml)"/)||[])[1];
    return makeInherit(lx,mt?await readPart(resolve(ln,mt)):null,presXml);
  };
  // media
  const ctName="[Content_Types].xml";let ct=await zip.file(ctName).async("string");
  const addMedia=async(fname,data,ext)=>{
    zip.file("ppt/media/"+fname,data);
    ct=ensureContentType(ct,ext==="png"?"png":"jpg",ext==="png"?"image/png":"image/jpeg");
    if(ext!=="png")ct=ensureContentType(ct,"jpeg","image/jpeg");
    return"../media/"+fname;
  };
  const bgTarget=cfg.bg&&cfg.bg.type==="image"&&cfg.bgImage?await addMedia("ds_bg."+(cfg.bgImage.ext==="png"?"png":"jpg"),cfg.bgImage.data,cfg.bgImage.ext):null;
  const logo=cfg.stamp&&cfg.stamp.logo;
  const logoTarget=logo?await addMedia("ds_logo."+(logo.ext==="png"?"png":"jpg"),logo.data,logo.ext):null;
  const addSlideRel=async(name,target)=>{
    const rn=relsNameFor(name);const f=zip.file(rn);
    const r=addRel(f?await f.async("string"):`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`,target);
    zip.file(rn,r.xml);return r.rId;
  };
  const kwRe=cfg.kw&&cfg.kw.list&&cfg.kw.list.length?keywordRegex(cfg.kw.list):null;

  let qIndex=0;
  const ctxBase={W,H,parse,bgTarget,logoTarget,logo,kwRe,keyAt:()=>cfg.key?(cfg.key[qIndex]==null?null:cfg.key[qIndex]):null};
  for(let i=0;i<names.length;i++){
    const name=names[i];const num=i+1;
    if(!range.has(num))continue;
    const before=await zip.file(name).async("string");
    const t=await transformSlide(before,num,cfg,{...ctxBase,inheritFor:()=>inheritFor(name),addSlideRel:target=>addSlideRel(name,target)});
    let xml=t.xml;const notes=t.notes;const r=t.r;const ans=t.ans;stats.fixedIds+=t.fixed;
    stats.totalAnim+=r.animated;if(r.stripped)stats.stripped++;
    if(r.question){
      const qi={num,qn:qIndex+1,options:r.question.options,revealLetter:r.question?r.question.revealLetter:null,key:ans==null?null:ans};
      if(qi.revealLetter!=null&&qi.key!=null&&qi.revealLetter!==qi.key)notes.push(`⚠ key says ${LETTERS[qi.key]}, slide reveals ${LETTERS[qi.revealLetter]}`);
      stats.questions.push(qi);qIndex++;
    }
    if(xml!==before){zip.file(name,xml);stats.touched++}
    put(`<span>Slide ${num}</span><b>${notes.length?notes.join(" · "):"unchanged"}</b>`);
  }

  if(cfg.title&&cfg.title.on){
    const pres=await zip.file("ppt/presentation.xml").async("string");
    let prels=await zip.file("ppt/_rels/presentation.xml.rels").async("string");
    const maxN=Math.max(0,...Object.keys(zip.files).map(n=>(n.match(/^ppt\/slides\/slide(\d+)\.xml$/)||[])[1]).filter(Boolean).map(Number));
    const sname=`slide${maxN+1}.xml`;
    // layout: prefer a blank layout
    let layout=null;
    for(const ln of Object.keys(zip.files).filter(n=>/^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(n))){
      const lx=await zip.file(ln).async("string");if(/<p:sldLayout\b[^>]*type="blank"/.test(lx)){layout=ln.replace("ppt/","../");break}
    }
    if(!layout){const r1=zip.file(relsNameFor(names[0]));if(r1){const m=(await r1.async("string")).match(/Target="(\.\.\/slideLayouts\/slideLayout\d+\.xml)"/);if(m)layout=m[1]}}
    if(!layout)layout="../slideLayouts/slideLayout1.xml";
    let srels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="${layout}"/></Relationships>`;
    let bgRid=null;
    if(cfg.title.bg&&cfg.title.bg.type==="image"&&bgTarget){const r=addRel(srels,bgTarget);srels=r.xml;bgRid=r.rId}
    let sx=titleSlideXml({...cfg.title,bgRid},W,H);
    if(cfg.stamp&&cfg.stamp.text){const b=stampBox(cfg.stamp,W,H);sx=appendToSpTree(sx,textBoxXml(maxShapeId(sx)+1,"DS_Stamp",{x:b.x,y:b.y,w:b.w,h:b.h,text:cfg.stamp.text,sz:b.sz,color:cfg.title.tone==="light"?cfg.stamp.color:"FFFFFF",alpha:cfg.stamp.alpha,algn:b.algn,anchor:"ctr"}))}
    if(logoTarget){const r=addRel(srels,logoTarget);srels=r.xml;const lh=Math.round(H*0.09),lw=Math.round(lh*(logo.w/logo.h));sx=appendToSpTree(sx,picXml(maxShapeId(sx)+1,"DS_Logo",r.rId,{x:W-Math.round(W*0.03)-lw,y:Math.round(H*0.04),w:lw,h:lh}))}
    zip.file("ppt/slides/"+sname,sx);
    zip.file("ppt/slides/_rels/"+sname+".rels",srels);
    ct=ct.replace("</Types>",`<Override PartName="/ppt/slides/${sname}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`);
    const r=addRel(prels,"slides/"+sname,"http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide");
    zip.file("ppt/_rels/presentation.xml.rels",r.xml);
    const ids=[...pres.matchAll(/<p:sldId\b[^>]*\bid="(\d+)"/g)].map(m=>+m[1]);
    const nid=Math.max(255,...ids)+1;
    const np=pres.replace(/<p:sldIdLst>/,`<p:sldIdLst><p:sldId id="${nid}" r:id="${r.rId}"/>`);
    zip.file("ppt/presentation.xml",np);
    put(`<span>New slide 1</span><b>title slide added</b>`);
    stats.touched++;
  }
  zip.file(ctName,ct);
  return stats;
}

if(typeof module!=="undefined"&&module.exports){module.exports={processPackage,parseKey,parseRange,EFFECTS,TRANSITIONS,PALETTES,LETTERS,fixDuplicateIds,orderedSlides,slideSize,analyseDeck,lum}}
