/* ProDecked — question parsing, quiz-deck generation, shuffled sets.
   Depends on: JSZip, engine.js (processPackage, parseKey), template.js (PD_TEMPLATE_B64). */
(function(root){
"use strict";
const EMU=914400;const W=12192000,H=6858000;
const LET="ABCDEFGH";
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const clean=s=>String(s==null?"":s).replace(/ /g," ").replace(/[ \t]+/g," ").trim();

/* ------------------------------------------------------------------ parsing */
const RE_QSTART=/^\s*(?:q(?:uestion)?\s*\.?\s*)?(\d{1,3})\s*[\.\):\-–]\s*(\S.*)$/i;
const RE_OPT=/^\s*(\*)?\s*[\(\[]?([A-Ha-h])[\)\]\.:]\s*(\S.*)$/;
const RE_OPT_INLINE=/[\(\[]([A-Ha-h])[\)\]]\s*/g;
const RE_ANS=/^\s*(?:ans(?:wer)?|correct(?:\s*(?:answer|option))?|key|right\s*answer)\s*(?:is)?\s*[:\-–=.]?\s*[\(\[]?\s*([A-Ha-h1-8])\s*[\)\]]?(?:[\s.,;:]|$)/i;
const RE_EXPL=/^\s*(?:explanation|explaination|solution|sol|expl|reason|rationale|why)\s*[:\-–.]\s*(.*)$/i;
const RE_KEYHDR=/^\s*(?:answer\s*key|answers?|key)\s*[:\-–]?\s*(.*)$/i;
const RE_CORRECT_MARK=/\s*(?:\(correct\)|\[correct\]|✓|✔|\*)\s*$/i;

function splitInlineOptions(line){
  // "(a) cat (b) dog (c) cow (d) hen" -> [["a","cat"],...]
  const marks=[...line.matchAll(RE_OPT_INLINE)];
  if(marks.length<2)return null;
  const letters=marks.map(m=>m[1].toLowerCase());
  for(let i=0;i<letters.length;i++)if(letters[i]!==LET[i].toLowerCase())return null;
  const out=[];
  for(let i=0;i<marks.length;i++){
    const s=marks[i].index+marks[i][0].length,e=i+1<marks.length?marks[i+1].index:line.length;
    out.push({pre:i===0?line.slice(0,marks[0].index):"",text:line.slice(s,e).trim()});
  }
  return out;
}

function parseText(text){
  const lines=String(text||"").replace(/\r\n?/g,"\n").split("\n");
  const qs=[];let cur=null,mode="stem",gap=false,keyBlock=null;
  const start=(stem)=>{cur={stem:clean(stem),options:[],answer:null,expl:"",marked:null};qs.push(cur);mode="stem";gap=false};
  for(let raw of lines){
    const line=raw.replace(/\t/g," ");
    if(keyBlock!==null){keyBlock+="\n"+line;continue}
    if(!line.trim()){gap=true;continue}
    // standalone answer-key block ("Answer key: 1-B 2-C ..." or "Answers" on its own line followed by a list)
    const kh=line.match(RE_KEYHDR);
    if(kh&&!line.match(RE_ANS)&&(/\d\s*[\).:\-–=]?\s*[\(]?[A-Ha-h]\b/.test(kh[1])||(!kh[1].trim()&&qs.length>1))){keyBlock=kh[1];continue}
    const ans=line.match(RE_ANS);
    if(ans&&cur){const v=ans[1];cur.answer=/[1-8]/.test(v)?+v-1:LET.indexOf(v.toUpperCase());
      const rest=line.slice(ans[0].length).trim();const ex=rest.match(RE_EXPL);if(ex){cur.expl=clean(ex[1]);mode="expl"}else if(rest&&rest.length>3&&/^[\-–:(]/.test(rest)){cur.expl=clean(rest.replace(/^[\-–:(\s]+/,"").replace(/\)$/,""));mode="expl"}
      gap=false;continue}
    const ex=line.match(RE_EXPL);
    if(ex&&cur){cur.expl=clean(ex[1]);mode="expl";gap=false;continue}
    const qm=line.match(RE_QSTART);
    const om=line.match(RE_OPT);
    // numbered line that is really an option like "1) text" when we're mid-options? treat numbers as questions
    if(qm&&!(om&&cur&&cur.options.length&&mode==="opts")){
      const inl=splitInlineOptions(qm[2]);
      if(inl&&inl[0].pre.trim()){start(inl[0].pre);inl.forEach(o=>addOpt(o.text));mode="opts"}else start(qm[2]);
      continue;
    }
    if(om){
      const letter=LET.indexOf(om[2].toUpperCase());
      if(!cur||(cur.options.length&&letter===0&&mode!=="opts")||(gap&&mode==="expl")){start("")}
      if(letter===0&&cur.options.length&&mode==="opts"){start("")}
      if(om[1])cur.marked=cur.options.length;
      addOpt(om[3]);mode="opts";gap=false;continue;
    }
    const inl=splitInlineOptions(line);
    if(inl){
      if(!cur||cur.options.length){start(inl[0].pre)}else if(inl[0].pre.trim())cur.stem=clean(cur.stem+" "+inl[0].pre);
      inl.forEach(o=>addOpt(o.text));mode="opts";gap=false;continue;
    }
    // plain text
    if(!cur){start(line);continue}
    if(mode==="expl"&&!gap){cur.expl=clean(cur.expl+" "+line);continue}
    if(mode==="stem"&&!cur.options.length){cur.stem=clean(cur.stem+(gap?"\n":" ")+line);gap=false;continue}
    if(mode==="opts"&&!gap&&cur.options.length){cur.options[cur.options.length-1]=clean(cur.options[cur.options.length-1]+" "+line);continue}
    start(line);
  }
  function addOpt(t){
    let s=clean(t);
    if(RE_CORRECT_MARK.test(s)&&s.length>2){cur.marked=cur.options.length;s=s.replace(RE_CORRECT_MARK,"").trim()}
    cur.options.push(s);
  }
  if(keyBlock!==null&&typeof parseKey==="function"){
    const k=parseKey(keyBlock);
    k.forEach((v,i)=>{if(qs[i]&&v!=null&&qs[i].answer==null)qs[i].answer=v});
  }
  qs.forEach(q=>{if(q.answer==null&&q.marked!=null)q.answer=q.marked;delete q.marked});
  return qs.filter(q=>q.stem||q.options.length);
}

function parseCSVRows(text){
  const rows=[];let row=[],f="",q=false;
  const delim=(()=>{const first=text.split(/\r?\n/)[0]||"";const t=(first.match(/\t/g)||[]).length,c=(first.match(/,/g)||[]).length;return t>c?"\t":","})();
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){f+='"';i++}else q=false}else f+=ch;continue}
    if(ch==='"'&&!f.trim()){q=true;f="";continue}
    if(ch===delim){row.push(f);f="";continue}
    if(ch==="\n"||ch==="\r"){if(ch==="\r"&&text[i+1]==="\n")i++;row.push(f);rows.push(row);row=[];f="";continue}
    f+=ch;
  }
  if(f.length||row.length){row.push(f);rows.push(row)}
  return rows.filter(r=>r.some(c=>c.trim()));
}
function looksLikeCSV(text){
  const first=(String(text).split(/\r?\n/).find(l=>l.trim())||"");
  const cols=first.split(first.includes("\t")?"\t":",").length;
  return cols>=5&&/question|stem|option|answer/i.test(first)||(cols>=6&&!RE_QSTART.test(first)&&!RE_OPT.test(first));
}
function parseCSV(text){
  const rows=parseCSVRows(String(text));if(!rows.length)return[];
  const hdr=rows[0].map(h=>h.trim().toLowerCase());
  const hasHdr=hdr.some(h=>/question|stem|answer|option|^[a-h]$/.test(h));
  const idx=k=>hdr.findIndex(h=>k.test(h));
  let qi=0,ai=-1,ei=-1,opt=[];
  if(hasHdr){
    qi=Math.max(0,idx(/question|stem/));ai=idx(/answer|correct|key/);ei=idx(/expl|solution|reason|rationale/);
    hdr.forEach((h,i)=>{if(i!==qi&&i!==ai&&i!==ei&&(/^opt(ion)?\s*[a-h1-8]?$|^[a-h]$|^option/.test(h)||/^\(?[a-h]\)?$/.test(h)))opt.push(i)});
    if(!opt.length)hdr.forEach((h,i)=>{if(i!==qi&&i!==ai&&i!==ei&&!/^(no|#|sr|s\.?no|id|number|topic|level|difficulty)/.test(h))opt.push(i)});
  }
  const body=hasHdr?rows.slice(1):rows;
  return body.map(r=>{
    let options,answer=null,expl="",stem;
    if(hasHdr){stem=r[qi];options=opt.map(i=>r[i]).filter(v=>v!=null&&v.trim());if(ai>=0)answer=r[ai];if(ei>=0)expl=r[ei]||""}
    else{stem=r[0];const rest=r.slice(1);
      // last cols: answer (single letter/digit) then maybe explanation
      let a=rest.findIndex((v,i)=>i>=2&&/^\s*[\(]?[A-Ha-h1-8][\)]?\s*$/.test(v));
      if(a<0){options=rest}else{options=rest.slice(0,a);answer=rest[a];expl=rest.slice(a+1).join(", ")}
      options=options.filter(v=>v.trim());
    }
    if(answer!=null){const s=String(answer).trim().replace(/^[\(\[]|[\)\]]$/g,"");
      if(/^[A-Ha-h]$/.test(s))answer=LET.indexOf(s.toUpperCase());else if(/^[1-8]$/.test(s))answer=+s-1;
      else{const m=options.findIndex(o=>clean(o).toLowerCase()===clean(s).toLowerCase());answer=m>=0?m:null}}
    return{stem:clean(stem),options:options.map(clean),answer,expl:clean(expl)};
  }).filter(q=>q.stem||q.options.length);
}
function parseQuestions(text){return looksLikeCSV(text)?parseCSV(text):parseText(text)}

function validate(qs){
  return qs.map((q,i)=>{
    const w=[];
    if(!q.stem)w.push("no question text");
    if(q.options.length<2)w.push(q.options.length?"only 1 option":"no options found");
    if(q.options.length>8)w.push("more than 8 options");
    if(q.answer==null)w.push("no answer given");
    else if(q.answer>=q.options.length)w.push("answer "+(LET[q.answer]||q.answer)+" is not one of the options");
    const seen=new Set();q.options.forEach(o=>{const k=o.toLowerCase();if(seen.has(k))w.push("duplicate option “"+o.slice(0,30)+"”");seen.add(k)});
    return{n:i+1,warnings:w,ok:!w.length};
  });
}

/* ------------------------------------------------------------------ themes */
const THEMES={
  chalk:{name:"Chalkboard",bg:"1F3A2E",card:"2A4A3C",line:null,text:"F3F1E7",stem:"FFFFFF",lab:"F2C94C",labTx:"1F3A2E",muted:"B9C7BD",expl:"E9E4D0"},
  clean:{name:"Clean white",bg:"FFFFFF",card:"F1F4F9",line:"DDE3EC",text:"1B2433",stem:"101828",lab:"2D5BFF",labTx:"FFFFFF",muted:"667085",expl:"344054"},
  midnight:{name:"Midnight",bg:"0F172A",card:"1E293B",line:null,text:"E2E8F0",stem:"F8FAFC",lab:"F59E0B",labTx:"0F172A",muted:"94A3B8",expl:"CBD5E1"},
  paper:{name:"Warm paper",bg:"FBF6EC",card:"FFFFFF",line:"E8DCC6",text:"2B2118",stem:"1C140D",lab:"C2410C",labTx:"FFFFFF",muted:"8A7A66",expl:"4A3B2C"},
  royal:{name:"Royal navy",bg:"0D1526",card:"17223A",line:"2A3858",text:"EEF2FB",stem:"FFFFFF",lab:"D4AF37",labTx:"161206",muted:"9AA7C4",expl:"D6DDEE"}
};

/* ------------------------------------------------------------------ slide xml */
let _id=1;
function spXml({name,x,y,w,h,geom="rect",fill=null,line=null,paras=null,anchor="t",ins=[91440,45720,91440,45720],wrap=true}){
  const id=++_id;
  const sp=`<p:spPr><a:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(w)}" cy="${Math.round(h)}"/></a:xfrm><a:prstGeom prst="${geom}"><a:avLst/></a:prstGeom>${fill?`<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>`:"<a:noFill/>"}${line?`<a:ln w="12700"><a:solidFill><a:srgbClr val="${line}"/></a:solidFill></a:ln>`:"<a:ln><a:noFill/></a:ln>"}</p:spPr>`;
  let tx="";
  if(paras){
    tx=`<p:txBody><a:bodyPr wrap="${wrap?"square":"none"}" lIns="${ins[0]}" tIns="${ins[1]}" rIns="${ins[2]}" bIns="${ins[3]}" rtlCol="0" anchor="${anchor}"><a:noAutofit/></a:bodyPr><a:lstStyle/>`+
      paras.map(p=>`<a:p><a:pPr algn="${p.algn||"l"}"><a:lnSpc><a:spcPct val="${p.lnSpc||100000}"/></a:lnSpc><a:spcBef><a:spcPts val="0"/></a:spcBef></a:pPr>`+
        p.runs.map(r=>`<a:r><a:rPr lang="en-US" sz="${Math.round(r.sz*100)}" b="${r.b?1:0}" dirty="0"><a:solidFill><a:srgbClr val="${r.color}"/></a:solidFill><a:latin typeface="${r.font||"Calibri"}"/><a:cs typeface="${r.font||"Calibri"}"/></a:rPr><a:t>${esc(r.t)}</a:t></a:r>`).join("")+
        `<a:endParaRPr lang="en-US" sz="${Math.round((p.runs[0]||{sz:18}).sz*100)}" dirty="0"/></a:p>`).join("")+`</p:txBody>`;
  }else{
    tx=`<p:txBody><a:bodyPr rtlCol="0" anchor="ctr"/><a:lstStyle/><a:p><a:endParaRPr lang="en-US" dirty="0"/></a:p></p:txBody>`;
  }
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${esc(name)} ${id}"/><p:cNvSpPr${paras&&!fill?' txBox="1"':""}/><p:nvPr/></p:nvSpPr>${sp}${tx}</p:sp>`;
}
function slideXml(bg,shapes){
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes.join("")}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

/* text height estimate (Calibri-ish): avg glyph width ~0.5em, line height 1.2em */
function linesFor(text,boxWemu,pt){
  const perLine=Math.max(8,Math.floor((boxWemu/12700-14)/(pt*0.47)));
  return String(text).split("\n").reduce((n,para)=>{
    const words=para.split(/\s+/);let lines=1,len=0;
    for(const w of words){const l=w.length;if(len&&len+1+l>perLine){lines++;len=l}else len+=(len?1:0)+l;while(len>perLine){lines++;len-=perLine}}
    return n+lines},0);
}
const hFor=(text,w,pt,lead=1.18)=>linesFor(text,w,pt)*pt*lead*12700+12700*12;

function layoutQuestion(q,th,opt){
  const n=q.options.length;const M=Math.round(0.6*EMU);const CW=W-2*M;
  const topY=Math.round(0.95*EMU),bottomY=H-Math.round(0.4*EMU);
  const maxOpt=Math.max(...q.options.map(o=>o.length),0);
  const grid=opt.layout==="grid"||(opt.layout!=="list"&&n===4&&maxOpt<=30&&!q.options.some(o=>o.includes("\n")));
  const showExpl=opt.expl&&q.expl&&!opt._noExpl;
  const labD=Math.round(0.5*EMU),gap=Math.round(0.14*EMU);
  let sPt=32,oPt=grid?26:24,ePt=18;
  const sizes=[];for(let k=0;k<14;k++)sizes.push(k);
  let plan=null;
  for(const k of sizes){
    const s=Math.max(opt._floor?18:20,sPt-k*1.5),o=Math.max(opt._floor?14:16,oPt-k*1.2),e=Math.max(14,ePt-k*0.5);
    const stemH=Math.max(Math.round(0.7*EMU),hFor(q.stem,CW,s,1.12));
    const colW=grid?Math.round((CW-gap*2)/2):CW;
    const txtW=colW-labD-Math.round(0.45*EMU)-Math.round(0.6*EMU);
    const cardHs=q.options.map(t=>Math.max(Math.round(0.66*EMU),hFor(t,txtW,o)+Math.round(0.12*EMU)));
    let optsH;
    if(grid){const r1=Math.max(cardHs[0],cardHs[1]),r2=Math.max(cardHs[2],cardHs[3]);optsH=r1+r2+gap;cardHs.splice(0,4,r1,r1,r2,r2)}
    else optsH=cardHs.reduce((a,b)=>a+b,0)+gap*(n-1);
    const explH=showExpl?hFor("Explanation: "+q.expl,CW,e)+Math.round(0.1*EMU):0;
    const total=stemH+Math.round(0.28*EMU)+optsH+(showExpl?Math.round(0.22*EMU)+explH:0);
    plan={s,o,e,stemH,cardHs,colW,txtW,optsH,explH,total,grid};
    if(total<=bottomY-topY)break;
  }
  plan.fits=plan.total<=bottomY-topY;
  return plan;
}

function questionSlide(q,num,total,th,opt){
  let P=layoutQuestion(q,th,opt),extra=null;
  if(!P.fits&&opt.expl&&q.expl){opt={...opt,_noExpl:true};P=layoutQuestion(q,th,opt);extra=explSlide(q,num,th,opt)}
  if(!P.fits){opt={...opt,_floor:true};P=layoutQuestion(q,th,opt)}
  const r=questionSlideXml(q,num,total,th,opt,P);return{xml:r,fits:P.fits,extra};
}
function explSlide(q,num,th,opt){
  _id=1;const M=Math.round(0.6*EMU),CW=W-2*M;const shapes=[];
  shapes.push(spXml({name:"Counter",x:M,y:Math.round(0.3*EMU),w:Math.round(4*EMU),h:Math.round(0.4*EMU),paras:[{runs:[{t:(opt.counterLabel||"Question")+" "+num+" \u00b7 explanation",sz:12,b:true,color:th.muted}]}],ins:[0,0,0,0]}));
  let pt=24;while(pt>16&&hFor(q.expl,CW,pt)>H-Math.round(2.4*EMU))pt-=1;
  const ans=q.answer!=null&&q.answer<q.options.length?LET[q.answer]+". "+q.options[q.answer]:"";
  const aPt=ans.length>120?22:26;const aH=hFor("Answer: "+ans,CW,aPt);
  shapes.push(spXml({name:"Answer",x:M,y:Math.round(0.95*EMU),w:CW,h:aH,paras:[{runs:[{t:"Answer: ",sz:aPt,b:true,color:th.lab},{t:ans,sz:aPt,b:true,color:th.stem}]}],ins:[0,0,0,0]}));
  const ey=Math.round(0.95*EMU)+aH+Math.round(0.3*EMU);
  while(pt>16&&hFor(q.expl,CW,pt)>H-ey-Math.round(0.4*EMU))pt-=1;
  shapes.push(spXml({name:"Explanation text",x:M,y:ey,w:CW,h:H-ey-Math.round(0.4*EMU),paras:[{runs:[{t:q.expl,sz:pt,color:th.expl}],lnSpc:105000}],ins:[0,0,0,0]}));
  return slideXml(th.bg,shapes);
}
function questionSlideXml(q,num,total,th,opt,P){
  _id=1;const shapes=[];
  const M=Math.round(0.6*EMU),CW=W-2*M,gap=Math.round(0.14*EMU),labD=Math.round(0.5*EMU);
  // chrome: counter (top-left, small) — the engine ignores it
  shapes.push(spXml({name:"Counter",x:M,y:Math.round(0.3*EMU),w:Math.round(4*EMU),h:Math.round(0.4*EMU),paras:[{runs:[{t:(opt.counterLabel||"Question")+" "+num+(total?" of "+total:""),sz:12,b:true,color:th.muted}]}],ins:[0,0,0,0]}));
  const avail=H-Math.round(0.4*EMU)-Math.round(0.95*EMU);
  let y=Math.round(0.95*EMU)+Math.max(0,Math.round((avail-P.total)*0.38));
  const stemParas=q.stem.split("\n").map(t=>({runs:[{t,sz:P.s,b:true,color:th.stem}],lnSpc:96000}));
  shapes.push(spXml({name:"Question",x:M,y,w:CW,h:P.stemH,paras:stemParas,ins:[0,0,0,0]}));
  y+=P.stemH+Math.round(0.28*EMU);
  const top=y;
  q.options.forEach((t,i)=>{
    let x,cy,cw=P.colW,ch=P.cardHs[i];
    if(P.grid){x=M+(i%2)*(P.colW+gap*2);cy=top+(i<2?0:P.cardHs[0]+gap)}
    else{x=M;cy=y;y+=ch+gap}
    shapes.push(spXml({name:"Option card",x,y:cy,w:cw,h:ch,geom:"roundRect",fill:th.card,line:th.line}));
    const lx=x+Math.round(0.16*EMU),ly=cy+Math.round((ch-labD)/2);
    shapes.push(spXml({name:"Option label",x:lx,y:ly,w:labD,h:labD,geom:"ellipse",fill:th.lab,paras:[{algn:"ctr",runs:[{t:LET[i],sz:Math.min(20,P.o),b:true,color:th.labTx}]}],anchor:"ctr",ins:[0,0,0,0]}));
    shapes.push(spXml({name:"Option text",x:lx+labD+Math.round(0.18*EMU),y:cy+Math.round(0.04*EMU),w:P.txtW,h:ch-Math.round(0.08*EMU),paras:t.split("\n").map(line=>({runs:[{t:line,sz:P.o,color:th.text}]})),anchor:"ctr",ins:[0,0,0,0]}));
  });
  if(P.grid)y=top+P.optsH+gap;
  if(opt.expl&&q.expl&&!opt._noExpl){
    y=Math.max(y,top+P.optsH)+Math.round(0.22*EMU);
    shapes.push(spXml({name:"Explanation",x:M,y,w:CW,h:P.explH,paras:[{runs:[{t:"Explanation: ",sz:P.e,b:true,color:th.lab},{t:q.expl,sz:P.e,color:th.expl}]}],ins:[0,0,0,0]}));
  }
  return slideXml(th.bg,shapes);
}

function keySlide(qs,th,title){
  _id=1;const M=Math.round(0.6*EMU);const shapes=[];
  shapes.push(spXml({name:"Key title",x:M,y:Math.round(0.5*EMU),w:W-2*M,h:Math.round(0.8*EMU),paras:[{runs:[{t:title||"Answer key",sz:32,b:true,color:th.stem}]}],ins:[0,0,0,0]}));
  const cols=Math.min(5,Math.max(1,Math.ceil(qs.length/12)));
  const perCol=Math.ceil(qs.length/cols);const colW=Math.round((W-2*M)/cols);
  const pt=perCol>14?14:perCol>10?16:20;
  for(let c=0;c<cols;c++){
    const items=qs.slice(c*perCol,(c+1)*perCol);if(!items.length)continue;
    shapes.push(spXml({name:"Key column",x:M+c*colW,y:Math.round(1.55*EMU),w:colW-Math.round(0.1*EMU),h:H-Math.round(2*EMU),
      paras:items.map((q,j)=>({runs:[{t:"Q"+(c*perCol+j+1)+"   ",sz:pt,color:th.muted},{t:q.answer!=null&&q.answer<q.options.length?LET[q.answer]:"—",sz:pt,b:true,color:th.lab}],lnSpc:115000})),ins:[0,0,0,0]}));
  }
  return slideXml(th.bg,shapes);
}

function titleSlide(o,th){
  _id=1;const M=Math.round(0.9*EMU);const shapes=[];
  shapes.push(spXml({name:"Accent",x:M,y:Math.round(2.35*EMU),w:Math.round(1.1*EMU),h:Math.round(0.09*EMU),fill:th.lab}));
  if(o.kicker)shapes.push(spXml({name:"Kicker",x:M,y:Math.round(1.7*EMU),w:W-2*M,h:Math.round(0.5*EMU),paras:[{runs:[{t:o.kicker.toUpperCase(),sz:14,b:true,color:th.lab}]}],ins:[0,0,0,0]}));
  shapes.push(spXml({name:"Title",x:M,y:Math.round(2.6*EMU),w:W-2*M,h:Math.round(1.9*EMU),paras:[{runs:[{t:o.title,sz:o.title.length>40?40:48,b:true,color:th.stem}],lnSpc:92000}],ins:[0,0,0,0]}));
  if(o.subtitle)shapes.push(spXml({name:"Subtitle",x:M,y:Math.round(4.6*EMU),w:W-2*M,h:Math.round(0.9*EMU),paras:[{runs:[{t:o.subtitle,sz:20,color:th.muted}]}],ins:[0,0,0,0]}));
  return slideXml(th.bg,shapes);
}

/* ------------------------------------------------------------------ package */
async function b64ToU8(b64){
  if(typeof Buffer!=="undefined")return new Uint8Array(Buffer.from(b64,"base64"));
  const bin=atob(b64);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u;
}
async function newDeck(slides){
  const JS=root.JSZip||require("jszip");
  const TPL=typeof PD_TEMPLATE_B64!=="undefined"?PD_TEMPLATE_B64:(root.PD_TEMPLATE_B64||require("./template.js").PD_TEMPLATE_B64);
  const zip=await JS.loadAsync(await b64ToU8(TPL));
  let ct=await zip.file("[Content_Types].xml").async("string");
  let rels=await zip.file("ppt/_rels/presentation.xml.rels").async("string");
  let pres=await zip.file("ppt/presentation.xml").async("string");
  const ids=[];
  slides.forEach((xml,i)=>{
    const n=i+1;zip.file(`ppt/slides/slide${n}.xml`,xml);
    zip.file(`ppt/slides/_rels/slide${n}.xml.rels`,`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout7.xml"/></Relationships>`);
    ct=ct.replace("</Types>",`<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`);
    const rId="rId"+(100+n);
    rels=rels.replace("</Relationships>",`<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${n}.xml"/></Relationships>`);
    ids.push(`<p:sldId id="${255+n}" r:id="${rId}"/>`);
  });
  pres=pres.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,"").replace("</p:sldMasterIdLst>",`</p:sldMasterIdLst><p:sldIdLst>${ids.join("")}</p:sldIdLst>`);
  zip.file("[Content_Types].xml",ct);zip.file("ppt/_rels/presentation.xml.rels",rels);zip.file("ppt/presentation.xml",pres);
  let app=await zip.file("docProps/app.xml").async("string");
  app=app.replace(/<Slides>\d+<\/Slides>/,`<Slides>${slides.length}</Slides>`);zip.file("docProps/app.xml",app);
  return zip;
}

/* opt: {theme, layout:"auto"|"grid"|"list", expl:bool, title:{title,subtitle,kicker}|null, keySlide:bool,
         reveal:"tick"|"bold", options:"each"|"together"|"static", timer:secs|0, parse} */
async function buildQuizDeck(qs,opt){
  opt=Object.assign({theme:"clean",layout:"auto",expl:true,title:null,keySlide:true,reveal:"tick",options:"each",timer:0,greyWrong:true},opt||{});
  const th=THEMES[opt.theme]||THEMES.clean;
  const slides=[];const warn=[];
  if(opt.title&&opt.title.title)slides.push(titleSlide(opt.title,th));
  const first=slides.length;
  const qSlides=[];
  qs.forEach((q,i)=>{const s=questionSlide(q,i+1,qs.length,th,opt);qSlides.push(slides.length+1);slides.push(s.xml);if(s.extra)slides.push(s.extra);if(!s.fits)warn.push(i+1)});
  if(opt.keySlide)slides.push(keySlide(qs,th,opt.keyTitle));
  const zip=await newDeck(slides);
  const cfg={parse:opt.parse,range:qSlides.join(","),anim:null,strip:false,existing:"keep",
    q:{stem:"static",options:opt.options,effect:"fade",dir:"b",dur:450,reveal:opt.reveal,greyWrong:opt.greyWrong,explAfter:!!opt.expl,
      timer:opt.timer?{secs:opt.timer,start:"click",color:th.lab}:null},
    key:qs.map(q=>q.answer!=null&&q.answer<q.options.length?q.answer:null),
    kw:null,boost:null,stamp:opt.stamp||null,nums:null,title:null,bg:null,tone:null,doContrast:false,bgImage:null,palette:null,
    transition:opt.transition||"fade",spd:"fast",perSlide:null};
  const log=[];
  const st=await processPackage(zip,cfg,h=>log.push(h));
  const detected=st.questions.length;
  return{zip,stats:st,tooLong:warn,detected,log};
}

/* ------------------------------------------------------------------ shuffling */
function rng(seed){let h=2166136261;for(const c of String(seed)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}
  return()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function shuffleArr(a,r){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const LOCK_RE=/\b(all|none|both|neither)\b.*\b(above|of these|of the|and|nor)\b|\b(only\s+)?[a-h]\s*(,|and|&)\s*[a-h]\b|\ball of them\b|\bnone of them\b/i;
function optionsLocked(q){return q.options.some(o=>LOCK_RE.test(o))}
function makeSets(qs,{sets=3,shuffleQ=true,shuffleO=true,seed="prodecked",keepFirst=true}={}){
  const out=[];
  for(let s=0;s<sets;s++){
    const r=rng(seed+"|"+s);
    let order=qs.map((_,i)=>i);const mix=!keepFirst||s>0;if(shuffleQ&&mix)order=shuffleArr(order,r);
    const items=order.map(oi=>{
      const q=qs[oi];let perm=q.options.map((_,i)=>i);const locked=optionsLocked(q);
      if(shuffleO&&!locked&&mix)perm=shuffleArr(perm,r);
      return{stem:q.stem,options:perm.map(i=>q.options[i]),answer:q.answer==null?null:perm.indexOf(q.answer),expl:q.expl,master:oi+1,locked};
    });
    out.push({label:LET[s],items});
  }
  return out;
}

/* ------------------------------------------------------------------ PDF (jsPDF) */
function pdfPaper(jsPDF,qs,{title="Question paper",subtitle="",showKey=false,withExpl=false,setLabel="",keyOnly=false,keys=null}={}){
  const doc=new jsPDF({unit:"pt",format:"a4"});const PW=doc.internal.pageSize.getWidth(),PH=doc.internal.pageSize.getHeight();
  const M=54;let y=M;const lh=k=>k*1.32;
  const header=()=>{doc.setFont("helvetica","bold");doc.setFontSize(18);doc.text(title+(setLabel?"  —  Set "+setLabel:""),M,y);y+=24;
    if(subtitle){doc.setFont("helvetica","normal");doc.setFontSize(11);doc.setTextColor(90);doc.text(subtitle,M,y);doc.setTextColor(0);y+=18}
    doc.setDrawColor(200);doc.line(M,y,PW-M,y);y+=20};
  const ensure=h=>{if(y+h>PH-M){doc.addPage();y=M}};
  const footer=()=>{const n=doc.getNumberOfPages();for(let i=1;i<=n;i++){doc.setPage(i);doc.setFontSize(9);doc.setTextColor(140);doc.text("Page "+i+" of "+n+"   ·   made with ProDecked",PW/2,PH-24,{align:"center"});doc.setTextColor(0)}};
  if(!keyOnly){
    header();
    qs.forEach((q,i)=>{
      doc.setFontSize(12);doc.setFont("helvetica","bold");
      const stem=doc.splitTextToSize(q.stem,PW-2*M-26);
      const optLines=q.options.map(o=>doc.splitTextToSize(o,PW-2*M-58));
      const need=lh(12)*stem.length+optLines.reduce((a,l)=>a+l.length*lh(11)+4,0)+18;
      ensure(Math.min(need,PH-2*M));
      doc.text((i+1)+".",M,y);doc.text(stem,M+26,y);y+=lh(12)*stem.length+4;
      doc.setFont("helvetica","normal");doc.setFontSize(11);
      optLines.forEach((l,j)=>{ensure(l.length*lh(11)+4);
        const mark=showKey&&q.answer===j;if(mark){doc.setFont("helvetica","bold")}
        doc.text("("+LET[j].toLowerCase()+")",M+28,y);doc.text(l,M+56,y);if(mark){doc.text("[answer]",M+56+doc.getTextWidth(l[0])+8,y);doc.setFont("helvetica","normal")}
        y+=l.length*lh(11)+4});
      if(withExpl&&q.expl){doc.setFontSize(10);doc.setTextColor(70);const e=doc.splitTextToSize("Explanation: "+q.expl,PW-2*M-28);ensure(e.length*lh(10));doc.text(e,M+28,y);y+=e.length*lh(10);doc.setTextColor(0)}
      y+=12;
    });
  }
  if(keys){
    if(!keyOnly){doc.addPage();y=M}
    doc.setFont("helvetica","bold");doc.setFontSize(18);doc.text(keyOnly?title:"Answer key",M,y);y+=26;
    if(keyOnly&&subtitle){doc.setFont("helvetica","normal");doc.setFontSize(11);doc.setTextColor(90);doc.text(subtitle,M,y);doc.setTextColor(0);y+=20}
    keys.forEach(k=>{
      ensure(40);doc.setFont("helvetica","bold");doc.setFontSize(13);doc.text(k.label,M,y);y+=18;
      doc.setFont("helvetica","normal");doc.setFontSize(11);
      const cols=5,cw=(PW-2*M)/cols;
      k.items.forEach((it,i)=>{const c=i%cols;if(c===0&&i)y+=16;ensure(16);
        doc.text(`${i+1}. ${it.a}${it.m?`  (Q${it.m})`:""}`,M+c*cw,y)});
      y+=28;
    });
  }
  footer();return doc;
}

const API={parseQuestions,parseText,parseCSV,validate,THEMES,buildQuizDeck,makeSets,optionsLocked,pdfPaper,LET};
if(typeof module!=="undefined"&&module.exports)module.exports=API;else root.PDQuiz=API;
})(typeof window!=="undefined"?window:globalThis);
