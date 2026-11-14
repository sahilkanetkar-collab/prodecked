/* ProDecked — live preview of the chosen animation / transition on a sample slide.
   PDDemo.mount(container, kind) → {update(vals)}; kind is "animate" or "transitions".
   Plays the settings the way PowerPoint will (one click every ~1 s), then loops.
   It is an approximation drawn with the browser's own animation engine. */
(function(root){
"use strict";
const SPD={fast:500,med:900,slow:1400};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const reduce=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;

/* entrance effects → Web Animations keyframes */
function entr(effect,el,dur){
  const k={
    fade:[{opacity:0},{opacity:1}],
    wipe:[{clipPath:"inset(100% 0 0 0)"},{clipPath:"inset(0 0 0 0)"}],
    flyin:[{transform:"translateY(220px)",opacity:1},{transform:"translateY(0)",opacity:1}],
    zoom:[{transform:"scale(.3)",opacity:0},{transform:"scale(1)",opacity:1}],
    split:[{clipPath:"inset(0 50% 0 50%)"},{clipPath:"inset(0 0 0 0)"}],
    wheel:[{clipPath:"circle(0% at 50% 50%)"},{clipPath:"circle(75% at 50% 50%)"}],
    dissolve:[{opacity:0},{opacity:1}]
  }[effect];
  el.style.visibility="visible";
  if(!k||effect==="appear")return Promise.resolve();
  const a=el.animate(k,{duration:dur,easing:effect==="dissolve"?"steps(7,end)":effect==="flyin"?"cubic-bezier(.2,.8,.2,1)":"ease-out",fill:"both"});
  return a.finished.catch(()=>{});
}
/* slide transitions: old → new */
function trans(t,oldS,newS,dur,stage){
  newS.style.visibility="visible";oldS.style.visibility="visible";
  const o={duration:dur,easing:"ease-in-out",fill:"both"};const ps=[];
  if(t==="none"||t==="keep"){oldS.style.visibility="hidden";return Promise.resolve()}
  if(t==="fade"||t==="morph")ps.push(newS.animate([{opacity:0},{opacity:1}],o).finished);
  else if(t==="dissolve")ps.push(newS.animate([{opacity:0},{opacity:1}],{...o,easing:"steps(8,end)"}).finished);
  else if(t==="push"){ps.push(newS.animate([{transform:"translateY(100%)"},{transform:"translateY(0)"}],o).finished,oldS.animate([{transform:"translateY(0)"},{transform:"translateY(-100%)"}],o).finished)}
  else if(t==="wipe")ps.push(newS.animate([{clipPath:"inset(0 100% 0 0)"},{clipPath:"inset(0 0 0 0)"}],o).finished);
  else if(t==="cover")ps.push(newS.animate([{transform:"translateX(100%)"},{transform:"translateX(0)"}],o).finished);
  else if(t==="fadeblack"){
    const blk=document.createElement("div");blk.className="dm-black";stage.appendChild(blk);
    newS.style.opacity=0;
    const half={...o,duration:dur/2};
    ps.push(blk.animate([{opacity:0},{opacity:1}],half).finished.then(()=>{oldS.style.visibility="hidden";newS.style.opacity=1;return blk.animate([{opacity:1},{opacity:0}],half).finished}).then(()=>blk.remove()));
  }
  return Promise.all(ps).catch(()=>{}).then(()=>{oldS.style.visibility="hidden";oldS.getAnimations().forEach(a=>a.cancel())});
}

function mount(container,kind){
  const box=document.createElement("div");box.className="demo";
  box.innerHTML=`<div class="dm-stage" aria-hidden="true">
      <div class="dm-slide dm-prev"><div class="dm-pt">Today's lesson</div><div class="dm-ps">Chapter 4</div></div>
      <div class="dm-slide dm-cur"><div class="dm-t">The water cycle</div><ul class="dm-ul"><li>Evaporation: the sun heats water</li><li>Condensation: vapour forms clouds</li><li>Precipitation: rain and snow fall</li></ul></div>
      <div class="dm-click">click</div>
    </div>
    <div class="dm-bar"><button type="button" class="btn btn-ghost btn-sm dm-play">▶ Play again</button><span class="dm-cap">Preview on a sample slide</span><a class="dm-own" href="studio.html">See it on your own slides →</a></div>`;
  container.appendChild(box);
  const stage=box.querySelector(".dm-stage"),prev=box.querySelector(".dm-prev"),cur=box.querySelector(".dm-cur");
  const title=box.querySelector(".dm-t"),ul=box.querySelector(".dm-ul"),lis=[...box.querySelectorAll(".dm-ul li")],clk=box.querySelector(".dm-click");
  const cap=box.querySelector(".dm-cap");
  let vals={},run=0,visible=true;
  const io="IntersectionObserver" in window?new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(visible&&!box.dataset.playing&&!reduce())play()}):null;
  if(io)io.observe(stage);

  function reset(){
    [prev,cur,title,ul,...lis,clk].forEach(e=>{e.getAnimations().forEach(a=>a.cancel());e.style.cssText=""});
    stage.querySelectorAll(".dm-black").forEach(e=>e.remove());
  }
  async function click(tok){
    clk.animate([{opacity:0,transform:"scale(.8)"},{opacity:1,transform:"scale(1)"},{opacity:0,transform:"scale(1)"}],{duration:650});
    await wait(950);return tok===run;
  }
  async function play(){
    const tok=++run;box.dataset.playing="1";reset();
    const A=kind==="animate";
    const tr=A?(vals.tr||"keep"):(vals.t||"fade");
    const tdur=A?SPD.fast:(tr==="morph"?SPD.med:SPD[vals.spd]||SPD.fast);
    const anim=A?{effect:vals.effect||"fade",gran:vals.gran||"para",trigger:vals.trigger||"click",dim:!!vals.dim,skipTitle:vals.skipTitle!==false,dur:+vals.dur||500}
      :(vals.anim&&vals.anim!=="no"?{effect:vals.effect||"fade",gran:vals.anim,trigger:"click",dim:false,skipTitle:true,dur:500}:null);
    const doTrans=tr!=="keep";
    // what the viewer sees first
    const items=[];
    if(anim){
      if(!anim.skipTitle)items.push([title]);
      if(anim.gran==="para")lis.forEach(li=>items.push([li]));else items.push([ul]);
      items.flat().forEach(e=>e.style.visibility="hidden");
    }
    cap.textContent=doTrans||anim?"Preview on a sample slide":"Nothing to show: no transition or animation chosen";
    if(doTrans){prev.style.visibility="visible";cur.style.visibility="hidden";await wait(800);if(tok!==run)return;
      if(!(await click(tok)))return;
      await trans(tr,prev,cur,tdur,stage);if(tok!==run)return;}
    else{prev.style.visibility="hidden"}
    if(anim){
      await wait(300);
      let last=null;
      for(const grp of items){
        if(tok!==run)return;
        if(anim.trigger==="click"){if(!(await click(tok)))return}
        if(anim.dim&&last)last.forEach(e=>{if(e.tagName==="LI")e.animate([{color:getComputedStyle(e).color},{color:"#9aa3a0"}],{duration:300,fill:"forwards"})});
        await Promise.all(grp.map(e=>entr(anim.effect,e,anim.dur)));
        last=grp;
        if(anim.trigger==="after")await wait(200);
      }
    }
    await wait(1800);
    if(tok!==run)return;
    delete box.dataset.playing;
    if(visible&&!reduce())play();
  }
  box.querySelector(".dm-play").addEventListener("click",()=>play());
  let tmr=null;
  return{update(v){vals={...v};clearTimeout(tmr);tmr=setTimeout(()=>{if(reduce()){reset();return}play()},250)}};
}
root.PDDemo={mount};
})(window);
