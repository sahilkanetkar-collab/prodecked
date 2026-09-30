/* ProDecked — page runtime: theme toggle, home demo, tool workbench. */
(function(){
"use strict";
const $=(s,r)=>(r||document).querySelector(s);
const el=(tag,attrs,kids)=>{const e=document.createElement(tag);if(attrs)for(const[k,v]of Object.entries(attrs)){if(k==="text")e.textContent=v;else if(k==="html")e.innerHTML=v;else if(k.startsWith("on"))e.addEventListener(k.slice(2),v);else if(v!=null&&v!==false)e.setAttribute(k,v===true?"":v)}(kids||[]).forEach(c=>c&&e.appendChild(typeof c==="string"?document.createTextNode(c):c));return e};
const escH=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const fmtB=n=>n>=1048576?(n/1048576).toFixed(n>=10485760?0:1)+" MB":n>=1024?Math.round(n/1024)+" KB":n+" B";
const ICON={
  ok:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5"/></svg>',
  err:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 7v6M12 16.5v.5"/></svg>',
  up:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="13" rx="2"/><path d="M12 15V8M9 10.5 12 7.5l3 3"/><path d="M8 21h8"/></svg>',
  sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>',
  moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>'
};

/* ---------------- theme toggle ---------------- */
function currentDark(){const t=document.documentElement.getAttribute("data-theme");if(t)return t==="dark";return matchMedia("(prefers-color-scheme: dark)").matches}
function paintThemeBtn(){const b=$("#themeBtn");if(!b)return;b.innerHTML=currentDark()?ICON.sun:ICON.moon;b.setAttribute("aria-label",currentDark()?"Switch to light mode":"Switch to dark mode")}
try{const saved=localStorage.getItem("pd.theme");if(saved)document.documentElement.setAttribute("data-theme",saved)}catch(e){}
document.addEventListener("DOMContentLoaded",()=>{
  paintThemeBtn();
  const b=$("#themeBtn");if(b)b.addEventListener("click",()=>{const next=currentDark()?"light":"dark";document.documentElement.setAttribute("data-theme",next);try{localStorage.setItem("pd.theme",next)}catch(e){}paintThemeBtn()});
  if($("#demo"))initDemo();
  if($("#toolFilter"))initFilter();
  if($("#toolSearch"))initSearch();
  if($("#workbench"))initTool();
});

/* ---------------- home: click-through demo slide ---------------- */
function initDemo(){
  const opts=[...document.querySelectorAll("#demo .opt")],expl=$("#demo .expl"),timer=$("#demo .timer"),ctr=$("#demoClicks"),btn=$("#demoNext");
  const steps=[()=>opts[0].classList.add("in"),()=>opts[1].classList.add("in"),()=>opts[2].classList.add("in"),()=>opts[3].classList.add("in"),
    ()=>{opts[1].classList.add("right");opts.forEach((o,i)=>{if(i!==1)o.classList.add("dim")})},()=>expl.classList.add("in")];
  let i=0,auto=null;
  const reset=()=>{opts.forEach(o=>o.className="opt");expl.classList.remove("in");i=0};
  const paint=()=>{ctr.textContent=i>=steps.length?"All steps shown":`Click ${i+1} of ${steps.length}`;btn.textContent=i>=steps.length?"Replay":"Next click"};
  const next=()=>{if(i>=steps.length){reset();paint();return}steps[i++]();paint()};
  btn.addEventListener("click",()=>{clearInterval(auto);auto=null;next()});
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  // at rest: fully revealed so the first frame shows what the tool makes
  steps.forEach(s=>s());i=steps.length;paint();
  if(!reduce){setTimeout(()=>{reset();paint();auto=setInterval(()=>{if(i>=steps.length){clearInterval(auto);auto=null;return}next()},1100)},2200)}
}

/* ---------------- home: filter chips ---------------- */
function initFilter(){
  const btns=[...document.querySelectorAll("#toolFilter button")];
  btns.forEach(b=>b.addEventListener("click",()=>{
    btns.forEach(x=>x.setAttribute("aria-pressed",x===b?"true":"false"));
    const f=b.dataset.f;const qi=$("#q");if(qi&&qi.value){qi.value="";document.querySelectorAll("#tools .tool").forEach(t=>t.hidden=false);const nr=$("#noResult");if(nr)nr.classList.remove("on")}
    document.querySelectorAll(".group").forEach(g=>{g.hidden=!(f==="all"||g.dataset.aud.split(" ").includes(f))});
  }));
}

/* ---------------- home: tool search ---------------- */
const SYN={"compress-ppt":"reduce size smaller shrink email upload large heavy mb file size","repair-ppt":"fix broken corrupt error problem with content open","mcq-to-quiz-ppt":"quiz questions mcq test options reveal","shuffle-question-sets":"shuffle sets a b c paper jumble randomise randomize","question-paper-pdf":"print paper pdf answer key test","quiz-answer-reveal":"answer reveal click correct","countdown-timer-ppt":"timer clock time countdown","animate-ppt":"animation animate bullets click reveal","bigger-text-ppt":"font size bigger larger readable projector","add-slide-numbers":"page numbers numbering","watermark-ppt":"logo watermark brand stamp name","ppt-transitions":"transition fade morph","ppt-background-theme":"background colour color theme","remove-animations":"remove delete animations","clean-ppt":"notes comments metadata author privacy clean","extract-images-ppt":"images pictures photos extract download","ppt-to-text":"text notes words extract copy"};
function initSearch(){
  const form=$("#toolSearch"),inp=$("#q"),none=$("#noResult");
  const cards=[...document.querySelectorAll("#tools .tool")].map(el=>{const k=(el.getAttribute("href")||"").replace(".html","");return {el,txt:(el.textContent+" "+(SYN[k]||"")).toLowerCase(),live:!el.classList.contains("soon")}});
  const matches=q=>{const words=q.toLowerCase().split(/\s+/).filter(Boolean);return cards.filter(c=>words.every(w=>c.txt.includes(w)))};
  const apply=()=>{
    const q=inp.value.trim();
    if(q){document.querySelectorAll("#toolFilter button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.f==="all"?"true":"false"))}
    const m=new Set(q?matches(q).map(c=>c.el):cards.map(c=>c.el));
    cards.forEach(c=>{c.el.hidden=!m.has(c.el)});
    document.querySelectorAll("#tools .group").forEach(g=>{g.hidden=![...g.querySelectorAll(".tool")].some(t=>!t.hidden)});
    if(none)none.classList.toggle("on",!!q&&m.size===0);
  };
  inp.addEventListener("input",apply);
  form.addEventListener("submit",e=>{
    e.preventDefault();const q=inp.value.trim();
    const live=q?matches(q).filter(c=>c.live):[];
    if(live.length===1){location.href=live[0].el.getAttribute("href");return}
    apply();document.getElementById("tools").scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
  });
}

/* ---------------- tool workbench ---------------- */
const scriptCache={};
function loadScript(src,globalName){
  if(window[globalName])return Promise.resolve(window[globalName]);
  if(!scriptCache[src])scriptCache[src]=new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;s.onload=()=>res(window[globalName]);s.onerror=()=>rej(new Error("Could not load "+src));document.head.appendChild(s)});
  return scriptCache[src];
}
function readImage(file){
  return new Promise((res,rej)=>{
    const ext=/png$/i.test(file.type)||/\.png$/i.test(file.name)?"png":"jpg";
    const fr=new FileReader();fr.onerror=()=>rej(new Error("Could not read the image."));
    fr.onload=()=>{const data=new Uint8Array(fr.result);const url=URL.createObjectURL(new Blob([data],{type:file.type||"image/"+ext}));
      const img=new Image();img.onload=()=>{res({data,ext,w:img.naturalWidth,h:img.naturalHeight,name:file.name});URL.revokeObjectURL(url)};img.onerror=()=>rej(new Error("That file isn't an image we can read (use PNG or JPG)."));img.src=url};
    fr.readAsArrayBuffer(file);
  });
}
function download(blob,name){
  const a=el("a",{href:URL.createObjectURL(blob),download:name});document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),60000);
}

function initTool(){
  const root=$("#workbench");const id=root.dataset.tool;const T=window.PD_TOOLS[id];
  if(!T){root.textContent="This tool is not available.";return}
  const vals={};const fieldEls=[];let files=[];let qCache=[];
  const inputPanel=$("#inPanel"),optPanel=$("#optPanel"),status=$("#status"),go=$("#go");
  const saveKey="pd.v."+id;let saved={};try{saved=JSON.parse(localStorage.getItem(saveKey)||"{}")||{}}catch(e){}

  /* ---- input: files ---- */
  if(T.input==="pptx"){
    const inp=el("input",{type:"file",id:"fileIn",accept:".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation",multiple:T.multi?true:null,class:"sr"});
    const drop=el("label",{class:"drop",for:"fileIn",id:"drop"},[]);
    drop.innerHTML=ICON.up+`<div class="big">${T.multi?"Drop your PowerPoint files here":"Drop your PowerPoint file here"}</div><div class="hint">or click to choose ${T.multi?"one or more .pptx files":"a .pptx file"}</div>`;
    const list=el("ul",{class:"files",id:"fileList"});
    inputPanel.append(inp,drop,list);
    const setFiles=fl=>{
      const arr=[...fl];const bad=arr.filter(f=>!/\.pptx$/i.test(f.name));
      files=(T.multi?files.concat(arr):arr).filter(f=>/\.pptx$/i.test(f.name));if(!T.multi)files=files.slice(0,1);
      renderFiles();
      if(bad.length)showMsg("err",bad.some(f=>/\.ppt$/i.test(f.name))?"Old .ppt files aren't supported yet":"Only .pptx files work here",
        bad.some(f=>/\.ppt$/i.test(f.name))?"Open the file in PowerPoint or Google Slides and save it as .pptx, then try again.":`Skipped: ${bad.map(f=>escH(f.name)).join(", ")}`);
    };
    const renderFiles=()=>{
      list.innerHTML="";
      files.forEach((f,i)=>{const li=el("li",{},[el("span",{class:"nm",text:f.name}),el("span",{class:"sz",text:fmtB(f.size)}),el("button",{type:"button","aria-label":"Remove "+f.name,text:"×",onclick:()=>{files.splice(i,1);renderFiles()}})]);list.appendChild(li)});
      drop.classList.toggle("has",!!files.length);
      go.disabled=!files.length;go.textContent=files.length>1?`${T.runLabel||"Process"} ${files.length} files`:(T.runLabel||$("#go").dataset.label);
    };
    inp.addEventListener("change",()=>{setFiles(inp.files);inp.value=""});
    ["dragenter","dragover"].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add("over")}));
    ["dragleave","drop"].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove("over")}));
    drop.addEventListener("drop",ev=>setFiles(ev.dataTransfer.files));
    go.disabled=true;
  }

  /* ---- fields ---- */
  const renderField=f=>{
    const wrap=el("div",{class:"field","data-k":f.k});
    const lab=f.type==="toggle"||f.type==="questions"?null:el(f.type==="chips"||f.type==="swatches"||f.type==="image"||f.type==="questions"?"div":"label",{class:"fl",for:f.type==="chips"||f.type==="swatches"?null:"f_"+f.k,text:f.label});
    if(lab)wrap.appendChild(lab);
    if(f.hint&&f.type!=="toggle")wrap.appendChild(el("div",{class:"hint",text:f.hint}));
    const def=saved[f.k]!==undefined&&f.type!=="image"&&f.type!=="questions"?saved[f.k]:f.def;
    if(f.type==="chips"){
      vals[f.k]=f.options.some(o=>o[0]===def)?def:f.def;
      const row=el("div",{class:"chips",role:"group","aria-label":f.label});
      f.options.forEach(([v,l])=>{const b=el("button",{type:"button","aria-pressed":v===vals[f.k]?"true":"false",text:l,onclick:()=>{vals[f.k]=v;[...row.children].forEach(x=>x.setAttribute("aria-pressed",x===b?"true":"false"));changed()}});row.appendChild(b)});
      wrap.appendChild(row);
    }else if(f.type==="swatches"){
      vals[f.k]=f.options.some(o=>o.v===def)?def:f.def;
      const row=el("div",{class:"swatches",role:"group","aria-label":f.label});
      f.options.forEach(o=>{const b=el("button",{type:"button","aria-pressed":o.v===vals[f.k]?"true":"false","aria-label":o.name,onclick:()=>{vals[f.k]=o.v;[...row.children].forEach(x=>x.setAttribute("aria-pressed",x===b?"true":"false"));changed()}});
        b.innerHTML=`<span class="fillp" style="background:${o.css}"></span><span class="nm">${escH(o.name)}</span>`;row.appendChild(b)});
      wrap.appendChild(row);
    }else if(f.type==="toggle"){
      vals[f.k]=typeof def==="boolean"?def:f.def;
      const cb=el("input",{type:"checkbox",id:"f_"+f.k,checked:vals[f.k]?true:null,onchange:e=>{vals[f.k]=e.target.checked;changed()}});
      const l=el("label",{class:"toggle",for:"f_"+f.k},[cb,el("span",{},[f.label,f.hint?el("small",{text:f.hint}):null])]);
      wrap.appendChild(l);
    }else if(f.type==="range"){
      vals[f.k]=def;const out=el("output",{for:"f_"+f.k,text:f.fmt?f.fmt(+def):def});
      const r=el("input",{type:"range",id:"f_"+f.k,min:f.min,max:f.max,step:f.step,value:def,oninput:e=>{vals[f.k]=+e.target.value;out.textContent=f.fmt?f.fmt(+e.target.value):e.target.value;changed(true)}});
      wrap.appendChild(el("div",{class:"range"},[r,out]));
    }else if(f.type==="select"){
      vals[f.k]=f.options.some(o=>o[0]===def)?def:f.def;
      const s=el("select",{class:"txt",id:"f_"+f.k,onchange:e=>{vals[f.k]=e.target.value;changed()}});
      f.options.forEach(([v,l])=>s.appendChild(el("option",{value:v,selected:v===vals[f.k]?true:null,text:l})));wrap.appendChild(s);
    }else if(f.type==="color"){
      vals[f.k]=def;const code=el("code",{text:String(def).toUpperCase()});
      wrap.appendChild(el("div",{class:"colorrow"},[el("input",{type:"color",id:"f_"+f.k,value:def,oninput:e=>{vals[f.k]=e.target.value;code.textContent=e.target.value.toUpperCase();changed(true)}}),code]));
    }else if(f.type==="text"){
      vals[f.k]=def||"";wrap.appendChild(el("input",{class:"txt",type:"text",id:"f_"+f.k,placeholder:f.placeholder||"",value:vals[f.k],oninput:e=>{vals[f.k]=e.target.value;changed(true)}}));
    }else if(f.type==="textarea"){
      vals[f.k]=def||"";const ta=el("textarea",{class:"txt",id:"f_"+f.k,rows:f.rows||4,placeholder:f.placeholder||"",oninput:e=>{vals[f.k]=e.target.value;changed(true)}});ta.value=vals[f.k];wrap.appendChild(ta);
    }else if(f.type==="image"){
      vals[f.k]=null;const inp=el("input",{type:"file",accept:"image/png,image/jpeg",id:"f_"+f.k,class:"sr"});
      const pick=el("label",{class:"imgpick",for:"f_"+f.k,text:"Choose a PNG or JPG"});
      inp.addEventListener("change",async()=>{const fl=inp.files[0];if(!fl)return;try{vals[f.k]=await readImage(fl);pick.textContent="✓ "+fl.name+" ("+vals[f.k].w+"×"+vals[f.k].h+")";pick.classList.add("has")}catch(e){showMsg("err","Image not added",e.message)}changed()});
      wrap.append(inp,pick);
    }else if(f.type==="questions"){
      buildQuestionInput(wrap,f);
    }
    return wrap;
  };
  function buildQuestionInput(wrap,f){
    const ta=el("textarea",{class:"txt big",id:"f_q",spellcheck:"false",placeholder:"1. Which word is closest in meaning to SANGUINE?\nA) Pessimistic\nB) Optimistic\nC) Bloody\nD) Sombre\nAnswer: B\nExplanation: Sanguine means hopeful.\n\n2. …"});
    const fileIn=el("input",{type:"file",id:"qFile",accept:".txt,.csv,.tsv,text/plain,text/csv",class:"sr"});
    const btns=el("div",{class:"inlinebtns"},[
      el("button",{type:"button",class:"btn btn-ghost btn-sm",text:"Load an example",onclick:()=>{ta.value=SAMPLE_Q;ta.dispatchEvent(new Event("input"))}}),
      el("label",{class:"btn btn-ghost btn-sm",for:"qFile",text:"Open a .txt or .csv file"}),
      el("button",{type:"button",class:"btn btn-ghost btn-sm",text:"Clear",onclick:()=>{ta.value="";ta.dispatchEvent(new Event("input"))}})]);
    const sum=el("div",{class:"note",id:"qSummary"});
    const tw=el("div",{class:"tablewrap",id:"qTableWrap",hidden:true});
    fileIn.addEventListener("change",async()=>{const fl=fileIn.files[0];if(!fl)return;ta.value=await fl.text();fileIn.value="";ta.dispatchEvent(new Event("input"))});
    let tmr=null;
    ta.addEventListener("input",()=>{clearTimeout(tmr);tmr=setTimeout(parse,180);try{localStorage.setItem("pd.q",ta.value)}catch(e){}});
    wrap.append(ta,fileIn,btns,sum,tw);
    wrap.appendChild(el("details",{class:"note"},[el("summary",{text:"What formats work?"}),el("div",{html:`<p style="margin-top:8px">Number each question, put options on their own lines as <b>A)</b>, <b>(a)</b> or <b>a.</b>, then add <b>Answer: B</b>. An <b>Explanation:</b> line is optional. You can also:</p><ul style="margin:8px 0 0 18px;padding:0"><li>mark the right option with a <b>*</b> at the end</li><li>put all options on one line: (a) cat (b) dog (c) cow (d) hen</li><li>add an answer key at the bottom: <b>Answer key: 1-B, 2-D, 3-A</b></li><li>paste straight from Excel or Google Sheets, or open a CSV with columns: Question, A, B, C, D, Answer, Explanation</li></ul>`})]));
    function parse(){
      qCache=PDQuiz.parseQuestions(ta.value);const v=PDQuiz.validate(qCache);
      const bad=v.filter(x=>!x.ok);
      if(!ta.value.trim()){sum.innerHTML="Paste your questions above, or load the example to see how it works.";tw.hidden=true;return}
      sum.innerHTML=`<b>${qCache.length} question${qCache.length===1?"":"s"} found.</b> `+(bad.length?`<span style="color:var(--pen)">${bad.length} need${bad.length===1?"s":""} a look (highlighted below).</span>`:"All have options and an answer.");
      tw.hidden=!qCache.length;
      tw.innerHTML=`<table class="qtable"><thead><tr><th>#</th><th>Question</th><th>Options</th><th>Ans</th></tr></thead><tbody>${qCache.map((q,i)=>`<tr class="${v[i].ok?"":"bad"}"><td class="a">${i+1}</td><td>${escH(q.stem.slice(0,90))}${q.stem.length>90?"…":""}${v[i].ok?"":`<div class="w">${escH(v[i].warnings.join(" · "))}</div>`}</td><td>${q.options.length}</td><td class="a">${q.answer==null?"—":PDQuiz.LET[q.answer]}</td></tr>`).join("")}</tbody></table>`;
    }
    try{const s=localStorage.getItem("pd.q");if(s)ta.value=s}catch(e){}
    if(!ta.value)ta.value=SAMPLE_Q;
    parse();
  }
  const optFields=T.fields.filter(f=>f.type!=="questions"),qField=T.fields.find(f=>f.type==="questions");
  if(qField)inputPanel.appendChild(renderField(qField));
  if(optFields.length){const box=el("div",{class:"fields"});optFields.forEach(f=>{const w=renderField(f);fieldEls.push([f,w]);box.appendChild(w)});optPanel.appendChild(box)}
  else optPanel.appendChild(el("p",{class:"note",text:"No settings needed. Add your file and press the button."}));
  if(T.note)optPanel.appendChild(el("p",{class:"note",style:"margin-top:16px",text:T.note}));
  function changed(quiet){
    fieldEls.forEach(([f,w])=>{if(f.showIf)w.hidden=!f.showIf(vals)});
    try{const s={};T.fields.forEach(f=>{if(!["image","questions"].includes(f.type))s[f.k]=vals[f.k]});localStorage.setItem(saveKey,JSON.stringify(s))}catch(e){}
  }
  changed();
  if(T.input==="text")go.disabled=false;

  /* ---- status UI ---- */
  function showMsg(kind,title,body){
    status.innerHTML="";const box=el("div",{class:"result"+(kind==="err"?" err":""),role:kind==="err"?"alert":"status"});
    box.innerHTML=`<h3>${kind==="err"?ICON.err:ICON.ok}${escH(title)}</h3>${body?`<p>${body}</p>`:""}`;status.appendChild(box);return box;
  }
  let progEl=null,progLbl=null;
  function progress(frac,label){if(!progEl)return;progEl.style.width=Math.round(Math.max(0,Math.min(1,frac))*100)+"%";if(label&&progLbl)progLbl.textContent=label}

  const ui={questions:()=>qCache,loadScript,progress};

  go.addEventListener("click",async()=>{
    const err=T.validate&&T.validate(vals);if(err){showMsg("err","One more thing",escH(err));return}
    go.disabled=true;const label=go.textContent;go.textContent="Working…";
    status.innerHTML="";const pw=el("div",{class:"progress"},[progEl=el("i")]);progLbl=el("div",{class:"hint",text:"Starting…"});status.append(pw,progLbl);
    const logLines=[];const log=(k,v,cls)=>logLines.push({k,v,cls});
    const t0=performance.now();
    try{
      let out;
      if(T.input==="text"){out=await T.run(vals,ui)}
      else out=await runFiles(files,vals,log);
      progress(1,"Done");
      const box=showMsg("ok",out.summary+".",null);
      if(out.stats){const st=el("div",{class:"stats"});out.stats.forEach(([n,l])=>st.appendChild(el("div",{class:"stat"},[el("b",{text:String(n)}),el("span",{text:l})])));box.appendChild(st)}
      if(out.warn)box.appendChild(el("p",{class:"w",style:"color:var(--pen)",text:out.warn}));
      box.appendChild(el("p",{text:`Your download (${out.name}, ${fmtB(out.blob.size)}) should start by itself. Made in ${Math.max(0.1,(performance.now()-t0)/1000).toFixed(1)} s on your own device.`}));
      box.appendChild(el("div",{class:"acts"},[el("button",{type:"button",class:"btn btn-primary btn-sm",text:"Download again",onclick:()=>download(out.blob,out.name)}),
        T.input==="pptx"?el("button",{type:"button",class:"btn btn-ghost btn-sm",text:"Start over",onclick:()=>location.reload()}):null]));
      if(out.preview)box.appendChild(el("pre",{class:"log",style:"white-space:pre-wrap",text:out.preview+(out.preview.length>=1800?"\n…":"")}));
      if(logLines.length){const lg=el("div",{class:"log",role:"log"});logLines.forEach(l=>{lg.appendChild(el("div",{class:l.cls||""},[el("span",{text:l.k}),el("b",{text:l.v})]))});box.appendChild(el("details",{open:logLines.length<=12?true:null},[el("summary",{style:"cursor:pointer;margin-top:12px;font-weight:700;font-size:15px",text:"What changed"}),lg]))}
      download(out.blob,out.name);
    }catch(e){console.error(e);pw.remove();progLbl.remove();showMsg("err","That didn't work",escH(e.message||String(e)))}
    go.disabled=false;go.textContent=label;
  });

  async function runFiles(list,v,log){
    const results=[];const multi=list.length>1;
    for(let i=0;i<list.length;i++){
      const f=list[i];progress(i/list.length,multi?`File ${i+1} of ${list.length}: ${f.name}`:"Reading "+f.name);
      let zip;
      try{zip=await JSZip.loadAsync(await f.arrayBuffer())}catch(e){throw new Error(`${f.name} couldn't be opened. It may be damaged, password-protected, or not really a .pptx.`)}
      if(!zip.file("ppt/presentation.xml"))throw new Error(`${f.name} isn't a PowerPoint file inside (no presentation found).`);
      if(multi)log("▶ "+f.name,fmtB(f.size));
      const sub=(fr,lbl)=>progress((i+fr)/list.length,(multi?`File ${i+1} of ${list.length} · `:"")+lbl);
      let r;
      if(T.custom){r=await T.custom(zip,v,log,sub,f.name)}
      else{
        const cfg={...T.cfg(v),parse:s=>new DOMParser().parseFromString(s,"text/xml")};
        const n=(await orderedSlides(zip)).length;let k=0;
        const st=await processPackage(zip,cfg,h=>{k++;sub(Math.min(.95,k/Math.max(1,n)),`Slide ${Math.min(k,n)} of ${n}`);const t=h.replace(/<span>(.*?)<\/span><b>(.*?)<\/b>/,"$1\u0000$2").replace(/<[^>]+>/g,"");const[a,b]=t.split("\u0000");if(b!==undefined&&b!=="unchanged")log(a,b,/⚠/.test(b)?"warn":null)});
        const bad=st.questions.filter(q=>q.key!=null&&q.revealLetter!=null&&q.key!==q.revealLetter).length;
        r={summary:`${st.touched} slide${st.touched===1?"":"s"} updated`,st,warn:bad?`${bad} answer${bad>1?"s":""} in your key don't match what the slide already reveals. See the lines marked ⚠.`:(cfg.q&&!st.questions.length?"No question slides were found. Question slides need options labelled A/B/C/D or (a)/(b)/(c)/(d).":null)};
      }
      const blob=r.blob||await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6},mimeType:"application/vnd.openxmlformats-officedocument.presentationml.presentation"});
      const name=r.blob?(T.outName?T.outName(f.name):f.name.replace(/\.pptx$/i,"")+"_"+(T.suffix||"text")+"."+r.ext):f.name.replace(/\.pptx$/i,"")+"_"+(T.suffix||"prodecked")+".pptx";
      results.push({blob,name,r,before:f.size});
    }
    if(results.length===1){
      const x=results[0];const st=x.r.st;
      const stats=[];
      if(!x.r.blob||/pptx$/.test(x.name))stats.push([fmtB(x.before),"before"],[fmtB(x.blob.size),"after"]);
      if(st&&st.totalAnim)stats.push([st.totalAnim,"animation steps"]);
      if(st&&st.questions.length)stats.push([st.questions.length,"question slides"]);
      if(T.suffix==="compressed"){const pct=Math.round((1-x.blob.size/x.before)*100);stats.unshift([pct>0?pct+"%":"0%","smaller"])}
      return{blob:x.blob,name:x.name,summary:x.r.summary,warn:x.r.warn,stats,preview:x.r.preview};
    }
    const z=new JSZip();results.forEach(x=>z.file(x.name,x.blob));
    const tb=results.reduce((a,x)=>a+x.before,0),ta=results.reduce((a,x)=>a+x.blob.size,0);
    return{blob:await z.generateAsync({type:"blob"}),name:"prodecked_"+(T.suffix||"files")+".zip",summary:`${results.length} files done`,
      stats:[[results.length,"files"],[fmtB(tb),"before"],[fmtB(ta),"after"]],warn:results.map(x=>x.r.warn).filter(Boolean)[0]||null};
  }
}

const SAMPLE_Q=`1. Which word is closest in meaning to SANGUINE?
A) Pessimistic
B) Optimistic
C) Bloody
D) Sombre
Answer: B
Explanation: Sanguine means hopeful, especially when things look difficult.

2. Choose the correctly spelt word.
(a) Accomodate
(b) Accommodate
(c) Acommodate
(d) Acomodate
Answer: b

3. The coach did not ___ the players in public; he saved his criticism for the dressing room.
A) castigate
B) capitulate
C) captivate
D) calibrate
Answer: A
Explanation: "Saved his criticism" tells you the missing verb means to criticise.

4. Pick the odd one out: (a) Apple (b) Mango (c) Carrot (d) Banana
Answer: C`;
window.PD_SAMPLE_Q=SAMPLE_Q;
})();
