/* ProDecked — tool definitions. Each tool: fields (rendered by app.js) + run(). */
(function(){
"use strict";
const BASE={range:"all",anim:null,strip:false,existing:"keep",q:null,key:null,kw:null,boost:null,stamp:null,nums:null,title:null,
  bg:null,tone:null,doContrast:false,bgImage:null,palette:null,transition:"keep",spd:"fast",perSlide:null};
const hex=c=>String(c||"").replace("#","").toUpperCase();
const ENTR=[["fade","Fade"],["wipe","Wipe"],["flyin","Fly in"],["zoom","Zoom"],["appear","Appear"],["split","Split"],["wheel","Wheel"],["dissolve","Dissolve"]];
const BGS=[
  {v:"white",name:"Clean white",type:"solid",c1:"FFFFFF",tone:"light",css:"#ffffff"},
  {v:"mist",name:"Cool mist",type:"grad",c1:"F2F4F7",c2:"DEE5EE",tone:"light",css:"linear-gradient(180deg,#f2f4f7,#dee5ee)"},
  {v:"paper",name:"Warm paper",type:"solid",c1:"F6F1E7",tone:"light",css:"#f6f1e7"},
  {v:"chalk",name:"Chalkboard",type:"solid",c1:"1F3A2E",tone:"dark",css:"#1f3a2e"},
  {v:"navy",name:"Midnight",type:"solid",c1:"0F172A",tone:"dark",css:"#0f172a"},
  {v:"dusk",name:"Dusk",type:"grad",c1:"141A2E",c2:"2340D8",tone:"dark",css:"linear-gradient(180deg,#141a2e,#2340d8)"}
];
const PALS=[["keep","Keep current"],["royal","Royal"],["forest","Forest"],["crimson","Crimson"],["ocean","Ocean"],["slate","Slate"]];

const range={k:"range",type:"text",label:"Which slides",placeholder:"all   (or e.g. 2-10, 14)",def:"all",hint:"Leave as “all”, or list slides like 2-10, 14."};

const T={};

/* ============ engine-powered tools (work on an uploaded .pptx) ============ */
T["animate-ppt"]={input:"pptx",multi:true,suffix:"animated",
  fields:[
    {k:"effect",type:"select",label:"Effect",options:ENTR,def:"fade"},
    {k:"gran",type:"chips",label:"Bring text in",options:[["para","One bullet per click"],["shape","Whole box at once"]],def:"para"},
    {k:"trigger",type:"chips",label:"Start",options:[["click","On click"],["after","Automatically, one after another"]],def:"click"},
    {k:"dim",type:"toggle",label:"Grey out the previous bullet",hint:"Keeps the class on the current point.",def:false},
    {k:"skipTitle",type:"toggle",label:"Leave slide titles still",def:true},
    {k:"replace",type:"toggle",label:"Replace animations the deck already has",hint:"Off: slides that are already animated are left alone.",def:false},
    {k:"dur",type:"range",label:"Speed",min:200,max:1500,step:50,def:500,fmt:v=>(v/1000).toFixed(2)+" s"},
    range],
  cfg:v=>({...BASE,range:v.range,existing:v.replace?"replace":"keep",
    anim:{effect:v.effect,dir:"b",granularity:v.gran,trigger:v.trigger,duration:+v.dur,stagger:v.trigger==="after"?200:0,skipTitle:v.skipTitle,dimAfter:v.dim,scope:{text:true,pic:true,other:true}}})
};
T["quiz-answer-reveal"]={input:"pptx",multi:false,suffix:"reveal",
  fields:[
    {k:"opts",type:"chips",label:"Options appear",options:[["each","One per click"],["together","All on one click"],["static","Already visible"]],def:"each"},
    {k:"reveal",type:"chips",label:"Show the answer with",options:[["tick","Green tick"],["bold","Answer turns green"]],def:"tick"},
    {k:"grey",type:"toggle",label:"Grey out wrong options when the answer shows",def:true},
    {k:"expl",type:"toggle",label:"Reveal the explanation last",hint:"Text below the options (e.g. “Explanation: …”) appears after the answer.",def:true},
    {k:"key",type:"textarea",label:"Answer key",placeholder:"1-B, 2-D, 3-A …   or just:  B D A C",hint:"Numbered in the order question slides appear. Leave blank to keep answers the slides already reveal.",rows:3},
    range],
  cfg:v=>({...BASE,range:v.range,key:v.key&&v.key.trim()?parseKey(v.key):null,
    q:{stem:"static",options:v.opts,effect:"fade",dir:"b",dur:450,timer:null,reveal:v.reveal,greyWrong:v.grey,explAfter:v.expl}})
};
T["countdown-timer-ppt"]={input:"pptx",multi:true,suffix:"timer",
  fields:[
    {k:"secs",type:"range",label:"Time per question",min:10,max:300,step:5,def:60,fmt:v=>v>=60?Math.floor(v/60)+" min"+(v%60?" "+v%60+" s":""):v+" s"},
    {k:"start",type:"chips",label:"Timer starts",options:[["click","On your click"],["after","As soon as the slide opens"]],def:"click"},
    {k:"color",type:"color",label:"Bar colour",def:"#2340D8"},
    range],
  cfg:v=>({...BASE,range:v.range,q:{stem:"static",options:"static",effect:"fade",dir:"b",dur:400,reveal:"tick",greyWrong:false,explAfter:false,
    timer:{secs:+v.secs,start:v.start,color:hex(v.color)}}}),
  note:"The bar goes on slides that look like questions (A/B/C/D options). Other slides are left alone."
};
T["bigger-text-ppt"]={input:"pptx",multi:true,suffix:"bigger",
  fields:[
    {k:"scale",type:"range",label:"Enlarge text by",min:105,max:160,step:5,def:125,fmt:v=>"+"+(v-100)+"%"},
    {k:"floor",type:"range",label:"Smallest allowed size",min:0,max:28,step:2,def:20,fmt:v=>v?v+" pt":"no minimum"},
    range],
  cfg:v=>({...BASE,range:v.range,boost:{scale:+v.scale/100,floor:+v.floor}}),
  note:"Text grows only as far as its box allows, so nothing spills off the slide. Boxes that can't grow are listed in the report."
};
T["add-slide-numbers"]={input:"pptx",multi:true,suffix:"numbered",
  fields:[
    {k:"pos",type:"chips",label:"Position",options:[["br","Bottom right"],["bc","Bottom centre"],["bl","Bottom left"]],def:"br"},
    {k:"size",type:"range",label:"Size",min:9,max:24,step:1,def:12,fmt:v=>v+" pt"},
    {k:"color",type:"color",label:"Colour",def:"#7F7F7F"},
    {k:"skip",type:"toggle",label:"No number on the title slide",def:true},
    range],
  cfg:v=>({...BASE,range:v.range,nums:{on:true,pos:v.pos,size:+v.size,color:hex(v.color),skipFirst:v.skip}}),
  note:"Numbers are live PowerPoint slide-number fields, so they renumber themselves if you reorder slides."
};
T["watermark-ppt"]={input:"pptx",multi:true,suffix:"watermarked",
  fields:[
    {k:"text",type:"text",label:"Watermark text",placeholder:"e.g. © Your Name · Do not share",def:""},
    {k:"pos",type:"select",label:"Text position",options:[["br","Bottom right"],["bl","Bottom left"],["bc","Bottom centre"],["tr","Top right"],["tl","Top left"],["tc","Top centre"],["mc","Centre of the slide"]],def:"br"},
    {k:"size",type:"range",label:"Text size",min:10,max:60,step:1,def:14,fmt:v=>v+" pt"},
    {k:"color",type:"color",label:"Text colour",def:"#888888"},
    {k:"alpha",type:"range",label:"Opacity",min:10,max:100,step:5,def:45,fmt:v=>v+"%"},
    {k:"logo",type:"image",label:"Logo (optional)",hint:"PNG with a transparent background works best."},
    {k:"logoPos",type:"chips",label:"Logo position",options:[["tr","Top right"],["tl","Top left"],["br","Bottom right"],["bl","Bottom left"]],def:"tr",showIf:v=>!!v.logo},
    range],
  validate:v=>(!v.text.trim()&&!v.logo)?"Add watermark text or a logo first.":null,
  cfg:v=>({...BASE,range:v.range,stamp:{text:v.text.trim(),pos:v.pos,size:+v.size,color:hex(v.color),alpha:+v.alpha,logo:v.logo||null,logoPos:v.logoPos}})
};
T["ppt-transitions"]={input:"pptx",multi:true,suffix:"transitions",
  fields:[
    {k:"t",type:"chips",label:"Transition",options:[["fade","Fade"],["fadeblack","Fade through black"],["push","Push"],["wipe","Wipe"],["cover","Cover"],["dissolve","Dissolve"],["morph","Morph"],["none","Remove all"]],def:"fade"},
    {k:"spd",type:"chips",label:"Speed",options:[["fast","Fast"],["med","Medium"],["slow","Slow"]],def:"fast",showIf:v=>v.t!=="none"&&v.t!=="morph"},
    range],
  cfg:v=>({...BASE,range:v.range,transition:v.t,spd:v.spd}),
  note:"Morph needs PowerPoint 2019 or Microsoft 365. Older PowerPoint and Google Slides show a fade instead."
};
T["ppt-background-theme"]={input:"pptx",multi:true,suffix:"restyled",
  fields:[
    {k:"mode",type:"chips",label:"Background",options:[["preset","Ready-made"],["custom","My colour"],["image","My image"],["keep","Keep as is"]],def:"preset"},
    {k:"preset",type:"swatches",label:"Pick one",options:BGS,def:"white",showIf:v=>v.mode==="preset"},
    {k:"c1",type:"color",label:"Colour",def:"#FFFFFF",showIf:v=>v.mode==="custom"},
    {k:"img",type:"image",label:"Background image",hint:"Stretched to fill each slide.",showIf:v=>v.mode==="image"},
    {k:"imgTone",type:"chips",label:"Your image is mostly",options:[["dark","Dark"],["light","Light"]],def:"dark",showIf:v=>v.mode==="image"},
    {k:"contrast",type:"toggle",label:"Fix text colour so it stays readable",hint:"Dark text on light backgrounds, white text on dark ones.",def:true,showIf:v=>v.mode!=="keep"},
    {k:"pal",type:"select",label:"Accent colour theme",options:PALS,def:"keep"},
    range],
  validate:v=>v.mode==="image"&&!v.img?"Choose a background image first.":null,
  cfg:v=>{
    let bg=null,tone=null;
    if(v.mode==="preset"){const p=BGS.find(b=>b.v===v.preset)||BGS[0];bg={type:p.type,c1:p.c1,c2:p.c2};tone=p.tone}
    else if(v.mode==="custom"){bg={type:"solid",c1:hex(v.c1)};tone=lum(hex(v.c1))<0.5?"dark":"light"}
    else if(v.mode==="image"&&v.img){bg={type:"image"};tone=v.imgTone}
    return{...BASE,range:v.range,bg,tone,doContrast:!!bg&&v.contrast,bgImage:bg&&bg.type==="image"?{data:v.img.data,ext:v.img.ext}:null,palette:v.pal==="keep"?null:v.pal};
  }
};
T["remove-animations"]={input:"pptx",multi:true,suffix:"no-animations",
  fields:[
    {k:"trans",type:"toggle",label:"Also remove slide transitions",def:false},
    range],
  cfg:v=>({...BASE,range:v.range,strip:true,transition:v.trans?"none":"keep"})
};

/* ============ package tools ============ */
T["compress-ppt"]={input:"pptx",multi:true,suffix:"compressed",
  fields:[
    {k:"level",type:"chips",label:"Compression",options:[["light","Light"],["balanced","Balanced"],["strong","Strong"]],def:"balanced"},
    {k:"png",type:"toggle",label:"Turn photos saved as PNG into JPEG",hint:"The biggest saving in most decks. Images with transparency are left as PNG.",def:true},
    {k:"unused",type:"toggle",label:"Remove images no slide uses",def:true}],
  custom:async(zip,v,log,prog)=>{
    const before=await PDTools.mediaSizes(zip);const r=await PDTools.compressDeck(zip,{level:v.level,pngToJpg:v.png,removeUnused:v.unused,onProgress:(i,n,name)=>prog(i/n,`Image ${i} of ${n}`)});
    r.report.filter(x=>x.after<x.before).forEach(x=>log(x.name.replace("ppt/media/",""),`${PDTools.fmtBytes(x.before)} → ${PDTools.fmtBytes(x.after)} · ${x.note}`));
    if(r.removed)log("Unused images",`${r.removed} removed (${PDTools.fmtBytes(r.removedBytes)})`);
    if(!r.report.some(x=>x.after<x.before)&&!r.removed)log("Images",before.length?"already well compressed":"no images found");
    return{summary:`${r.report.filter(x=>x.after<x.before).length} image${r.report.filter(x=>x.after<x.before).length===1?"":"s"} made smaller`};
  },
  note:"Videos and audio are not re-encoded. If a deck is large because of a video, the report will say so."
};
T["repair-ppt"]={input:"pptx",multi:true,suffix:"repaired",fields:[],
  custom:async(zip,v,log)=>{
    const r=await PDTools.repairDeck(zip,{parse:s=>new DOMParser().parseFromString(s,"text/xml"),processPackage});
    r.fixes.forEach(f=>log("Fixed",f));r.warns.forEach(w=>log("Could not fix",w,"warn"));
    if(!r.fixes.length&&!r.warns.length)log("Result","no structural problems found");
    return{summary:r.fixes.length?`${r.fixes.length} problem${r.fixes.length>1?"s":""} fixed`:"No problems found",warn:r.warns.length?`${r.warns.length} issue${r.warns.length>1?"s":""} need PowerPoint's own repair`:null};
  },
  note:"This rebuilds the file's internal structure and fixes duplicate shape IDs, broken links and missing registrations: the usual causes of “PowerPoint found a problem with content”. If the file won't open at all here, it is too damaged for a browser fix."
};
T["clean-ppt"]={input:"pptx",multi:true,suffix:"clean",
  fields:[
    {k:"notes",type:"toggle",label:"Remove speaker notes",def:true},
    {k:"comments",type:"toggle",label:"Remove comments",def:true},
    {k:"meta",type:"toggle",label:"Remove author name and document properties",def:true},
    {k:"anim",type:"toggle",label:"Remove animations too",def:false}],
  custom:async(zip,v,log)=>{
    const done=await PDTools.stripParts(zip,{notes:v.notes,comments:v.comments});
    if(v.meta)done.push(...await PDTools.stripMetadata(zip));
    if(v.anim){const st=await processPackage(zip,{...BASE,parse:s=>new DOMParser().parseFromString(s,"text/xml"),strip:true},()=>{});done.push(`animations removed from ${st.stripped} slide${st.stripped===1?"":"s"}`)}
    done.forEach(d=>log("Cleaned",d));if(!done.length)log("Result","nothing to remove");
    return{summary:done.length?"Cleaned and ready to share":"Nothing needed removing"};
  }
};
T["extract-images-ppt"]={input:"pptx",multi:false,outName:f=>f.replace(/\.pptx$/i,"")+"_images.zip",fields:[],
  custom:async(zip,v,log)=>{
    const r=await PDTools.extractImages(zip,JSZip);
    if(!r.count)throw new Error("This deck has no images to extract.");
    log("Images",`${r.count} found`);
    return{summary:`${r.count} image${r.count>1?"s":""} extracted`,blob:await r.zip.generateAsync({type:"blob"}),ext:"zip"};
  }
};
T["ppt-to-text"]={input:"pptx",multi:false,
  fields:[
    {k:"notes",type:"toggle",label:"Include speaker notes",def:true},
    {k:"fmt",type:"chips",label:"Save as",options:[["txt","Plain text (.txt)"],["md","Markdown (.md)"]],def:"txt"}],
  custom:async(zip,v,log,prog,file)=>{
    const s=await PDTools.extractText(zip,{notes:v.notes});
    const md=v.fmt==="md";let out="";
    s.forEach(x=>{out+=md?`## Slide ${x.slide}\n\n`:`--- Slide ${x.slide} ---\n`;out+=x.text.map(t=>md?`- ${t}`:t).join("\n")+"\n";
      if(x.notes.length)out+=(md?"\n> **Notes:** ":"\nNotes: ")+x.notes.join(" ")+"\n";out+="\n"});
    const words=out.split(/\s+/).filter(Boolean).length;
    log("Slides",String(s.length));log("Words",words.toLocaleString());
    return{summary:`Text from ${s.length} slides`,blob:new Blob([out],{type:"text/plain;charset=utf-8"}),ext:v.fmt,preview:out.slice(0,1800)};
  }
};

/* ============ create from questions ============ */
const themeSw=Object.entries(PDQuiz.THEMES).map(([k,t])=>({v:k,name:t.name,css:`linear-gradient(135deg,#${t.bg} 0 62%,#${t.lab} 62% 100%)`}));
const qInput={k:"q",type:"questions",label:"Your questions"};
T["mcq-to-quiz-ppt"]={input:"text",
  fields:[qInput,
    {k:"theme",type:"swatches",label:"Look",options:themeSw,def:"clean"},
    {k:"title",type:"text",label:"Title slide (optional)",placeholder:"e.g. Vocabulary check · Class 4",def:""},
    {k:"opts",type:"chips",label:"Options appear",options:[["each","One per click"],["together","All on one click"],["static","Already visible"]],def:"each"},
    {k:"reveal",type:"chips",label:"Answer shows as",options:[["tick","Green tick"],["bold","Answer turns green"]],def:"tick"},
    {k:"expl",type:"toggle",label:"Show explanations after the answer",def:true},
    {k:"timer",type:"range",label:"Countdown timer",min:0,max:180,step:5,def:0,fmt:v=>+v?v+" s per question":"off"},
    {k:"key",type:"toggle",label:"Add an answer-key slide at the end",def:true}],
  run:async(v,ui)=>{
    const qs=ui.questions();if(!qs.length)throw new Error("Paste at least one question first.");
    const t=v.title.trim();
    const r=await PDQuiz.buildQuizDeck(qs,{parse:s=>new DOMParser().parseFromString(s,"text/xml"),theme:v.theme,title:t?{title:t.split("·")[0].trim(),subtitle:t.includes("·")?t.split("·").slice(1).join("·").trim():"",kicker:"Quiz"}:null,
      options:v.opts,reveal:v.reveal,expl:v.expl,timer:+v.timer,keySlide:v.key});
    const blob=await r.zip.generateAsync({type:"blob",compression:"DEFLATE",mimeType:"application/vnd.openxmlformats-officedocument.presentationml.presentation"});
    const noKey=qs.filter(q=>q.answer==null).length;
    return{blob,name:(t?t.split("·")[0].trim().replace(/[^\w\- ]+/g,"").replace(/\s+/g,"_"):"quiz")+".pptx",
      summary:`${qs.length} question slide${qs.length>1?"s":""} built`,
      stats:[[qs.length,"questions"],[Object.keys(r.zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).length,"slides in the deck"],[qs.length-noKey,"answers revealed"]],
      warn:[noKey?`${noKey} question${noKey>1?"s have":" has"} no answer, so no tick is shown for ${noKey>1?"them":"it"}.`:null,r.tooLong.length?`Question${r.tooLong.length>1?"s":""} ${r.tooLong.join(", ")} ${r.tooLong.length>1?"are":"is"} very long, so the text is smaller than usual.`:null].filter(Boolean).join(" ")||null};
  }
};
T["shuffle-question-sets"]={input:"text",
  fields:[qInput,
    {k:"sets",type:"chips",label:"How many sets",options:[["2","2 (A, B)"],["3","3 (A–C)"],["4","4 (A–D)"],["5","5 (A–E)"]],def:"3"},
    {k:"sq",type:"toggle",label:"Shuffle question order",def:true},
    {k:"so",type:"toggle",label:"Shuffle options",hint:"Questions with options like “All of the above” or “Both A and B” keep their order.",def:true},
    {k:"keepA",type:"toggle",label:"Keep Set A in the original order",def:true},
    {k:"title",type:"text",label:"Paper title",placeholder:"e.g. Weekly test 7 · English",def:""},
    {k:"out",type:"chips",label:"Make",options:[["both","Papers (PDF) + slides"],["pdf","Papers (PDF) only"],["ppt","Slides only"]],def:"both"},
    {k:"theme",type:"swatches",label:"Slide look",options:themeSw,def:"clean",showIf:v=>v.out!=="pdf"}],
  run:async(v,ui)=>{
    const qs=ui.questions();if(qs.length<2)throw new Error("Paste at least two questions to shuffle.");
    const sets=PDQuiz.makeSets(qs,{sets:+v.sets,shuffleQ:v.sq,shuffleO:v.so,keepFirst:v.keepA,seed:qs.map(q=>q.stem).join("|")});
    const title=v.title.trim()||"Question paper";const bundle=new JSZip();
    const safe=title.split("·")[0].trim().replace(/[^\w\- ]+/g,"").replace(/\s+/g,"_")||"paper";
    let jsPDF=null;if(v.out!=="ppt")jsPDF=(await ui.loadScript("assets/jspdf.umd.min.js","jspdf")).jsPDF;
    const sub=title.includes("·")?title.split("·").slice(1).join("·").trim():"";
    const mainTitle=title.split("·")[0].trim();
    for(const s of sets){
      ui.progress((sets.indexOf(s)+.5)/sets.length,`Set ${s.label}`);
      if(jsPDF){const d=PDQuiz.pdfPaper(jsPDF,s.items,{title:mainTitle,subtitle:sub,setLabel:s.label});bundle.file(`${safe}_Set_${s.label}.pdf`,d.output("arraybuffer"))}
      if(v.out!=="pdf"){const r=await PDQuiz.buildQuizDeck(s.items,{parse:x=>new DOMParser().parseFromString(x,"text/xml"),theme:v.theme,title:{title:mainTitle,subtitle:"Set "+s.label+(sub?" · "+sub:""),kicker:"Set "+s.label},keySlide:false,expl:false});
        bundle.file(`${safe}_Set_${s.label}.pptx`,await r.zip.generateAsync({type:"uint8array",compression:"DEFLATE"}))}
    }
    const keys=sets.map(s=>({label:"Set "+s.label,items:s.items.map(it=>({a:it.answer==null?"-":PDQuiz.LET[it.answer],m:it.master}))}));
    if(jsPDF){const d=PDQuiz.pdfPaper(jsPDF,[],{title:mainTitle+" — answer keys",subtitle:"Q numbers in brackets refer to the original (master) order.",keyOnly:true,keys});bundle.file(`${safe}_Answer_Keys.pdf`,d.output("arraybuffer"))}
    let csv="Set,Q,Answer,Master Q\n";sets.forEach(s=>s.items.forEach((it,i)=>{csv+=`${s.label},${i+1},${it.answer==null?"":PDQuiz.LET[it.answer]},${it.master}\n`}));
    bundle.file(`${safe}_Answer_Keys.csv`,csv);
    const locked=sets[0].items.filter(i=>i.locked).length;
    return{blob:await bundle.generateAsync({type:"blob",compression:"DEFLATE"}),name:safe+"_sets.zip",
      summary:`${sets.length} sets of ${qs.length} questions`,stats:[[sets.length,"sets"],[qs.length,"questions each"],[Object.keys(bundle.files).length,"files in the zip"]],
      warn:locked?`${locked} question${locked>1?"s":""} kept ${locked>1?"their":"its"} option order because of “all/none of the above”-style options.`:null};
  }
};
T["question-paper-pdf"]={input:"text",
  fields:[qInput,
    {k:"title",type:"text",label:"Title",placeholder:"e.g. Weekly test 7 · English · 30 minutes",def:""},
    {k:"key",type:"chips",label:"Answer key",options:[["end","On a last page"],["sep","As a separate PDF"],["none","Leave out"]],def:"end"},
    {k:"expl",type:"toggle",label:"Print explanations in the teacher copy",def:false,showIf:v=>v.key!=="none"}],
  run:async(v,ui)=>{
    const qs=ui.questions();if(!qs.length)throw new Error("Paste at least one question first.");
    const {jsPDF}=await ui.loadScript("assets/jspdf.umd.min.js","jspdf");
    const title=v.title.trim()||"Question paper";const main=title.split("·")[0].trim();const sub=title.includes("·")?title.split("·").slice(1).join("·").trim():"";
    const safe=main.replace(/[^\w\- ]+/g,"").replace(/\s+/g,"_")||"paper";
    const keys=[{label:"Answers",items:qs.map(q=>({a:q.answer==null?"-":PDQuiz.LET[q.answer]}))}];
    if(v.key==="sep"){
      const z=new JSZip();
      z.file(safe+".pdf",PDQuiz.pdfPaper(jsPDF,qs,{title:main,subtitle:sub}).output("arraybuffer"));
      z.file(safe+"_Teacher_Copy.pdf",PDQuiz.pdfPaper(jsPDF,qs,{title:main,subtitle:(sub?sub+" · ":"")+"Teacher copy",showKey:true,withExpl:v.expl,keys}).output("arraybuffer"));
      return{blob:await z.generateAsync({type:"blob"}),name:safe+".zip",summary:"Student paper and teacher copy ready",stats:[[qs.length,"questions"],[2,"PDFs"]]};
    }
    const d=PDQuiz.pdfPaper(jsPDF,qs,{title:main,subtitle:sub,keys:v.key==="end"?keys:null});
    return{blob:d.output("blob"),name:safe+".pdf",summary:`${qs.length}-question paper ready`,stats:[[qs.length,"questions"],[d.getNumberOfPages(),"pages"]]};
  },
  note:"PDFs use a standard print font, which covers English and most European languages. Hindi and Gujarati text needs the slide version for now."
};

window.PD_TOOLS=T;window.PD_BASE=BASE;
})();
