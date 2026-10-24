/* ProDecked — anonymous usage counters.
   Two kinds of line are recorded, both without cookies and without anything personal:
   1. prodecked_visits — one line per page opened: which page, roughly where the visitor came from
      (just the site name, e.g. google.com), phone or computer, and a random visitor number kept in
      this browser so we can tell new visitors from returning ones. The number is not linked to a
      person and clearing site data removes it.
   2. prodecked_usage  — one line per tool action: which tool, what happened (run/done/fail/...),
      how many files. Never file names, file contents or settings. A "fail" line keeps the error
      message (in the error column) so broken tools can be fixed. */
(function(){
"use strict";
const API="https://kgxjdzeciiajlgierjpn.supabase.co",KEY="sb_publishable_butl8cOHsMdBPeTAauXM9Q_J9jh0J1E";
const env=/(^|\.)prodecked\.com$/.test(location.hostname)?"prod":"test";
const isPhone=()=>matchMedia("(pointer: coarse)").matches&&Math.min(screen.width,innerWidth)<900;
const device=()=>isPhone()?"mobile":"desktop";

function send(table,row){
  try{
    fetch(API+"/rest/v1/"+table,{method:"POST",keepalive:true,
      headers:{"apikey":KEY,"Content-Type":"application/json","Prefer":"return=minimal"},
      body:JSON.stringify({...row,env})}).catch(()=>{});
  }catch(e){}
}

/* visitor number: random, stored only in this browser */
function visitor(){
  let v=null,fresh=false;
  try{
    v=localStorage.getItem("pd.vid");
    if(!v){v=Array.from(crypto.getRandomValues(new Uint8Array(8)),b=>b.toString(16).padStart(2,"0")).join("");localStorage.setItem("pd.vid",v);fresh=true}
  }catch(e){}
  return{v,fresh};
}

/* one line per page opened (a refresh of the same page in the same tab is not counted again) */
function visit(){
  try{
    if(navigator.webdriver||document.prerendering)return;
    const page=(location.pathname.toLowerCase().replace(/\/+$/,"")||"/").replace(/[^a-z0-9\/_-]/g,"");
    const seenKey="pd.seen:"+page;
    try{if(sessionStorage.getItem(seenKey))return;sessionStorage.setItem(seenKey,"1")}catch(e){}
    let ref=null;
    try{if(document.referrer){const h=new URL(document.referrer).hostname.toLowerCase().replace(/^www\./,"");if(h&&h!==location.hostname.replace(/^www\./,"")&&/^[a-z0-9.-]+$/.test(h))ref=h.slice(0,80)}}catch(e){}
    const {v,fresh}=visitor();
    send("prodecked_visits",{visitor:v,page:page.slice(0,80),ref,device:device(),new_visitor:fresh});
  }catch(e){}
}

/* one line per tool action */
function track(tool,event,files,detail){
  try{
    const {v}=visitor();
    const row={tool:String(tool).toLowerCase().replace(/[^a-z0-9-]/g,"-").slice(0,40),event,files:files==null?null:Math.min(999,files|0),device:device(),visitor:v,detail:null,error:null};
    if(detail!=null){
      const d=String(detail);
      if(event==="fail")row.error=d.slice(0,200);           // free text: the error message
      else row.detail=d.toLowerCase().replace(/[^a-z0-9-]/g,"-").slice(0,40);  // short tag, e.g. "phone-whatsapp"
    }
    send("prodecked_usage",row);
  }catch(e){}
}

window.PD_track=track;
window.PD_visit=visit;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",visit);else visit();
})();
