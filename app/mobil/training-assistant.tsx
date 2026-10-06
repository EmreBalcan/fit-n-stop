"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowDown, ArrowUp, BookOpen, Check, ChevronRight, Clock3, Dumbbell, GripVertical, History, Pause, Play, Plus, RotateCcw, Search, Timer, Trash2, TrendingUp } from "lucide-react";
import BodyRegionMap from "./body-region-map";

type Exercise = {
  id:string; turkishName:string; englishName:string; bodyRegion:string; primaryMuscles:string[]; secondaryMuscles:string[];
  equipment:string; equipmentType:string; difficulty:string; recommendedSets:number; recommendedReps:string; restSeconds:number;
  instructions:string[]; breathing:string; commonMistakes:string[]; safetyWarnings:string[]; alternativeExerciseIds:string[];
  animationAsset:string|null; previewAsset:string; equipmentImageAsset:string|null; muscleImageAsset:string|null;
};
type ProgramItem = {exerciseId:string;position:number;targetSets:number;targetReps:number;weightKg:number;restSeconds:number};
type Program = {id:string;name:string;items:ProgramItem[];updated_at?:string};
type CompletedSet = {exerciseId:string;setNumber:number;reps:number;weightKg:number};
type Session = {id?:string;client_session_id:string;program_id:string|null;program_name:string;started_at:string;finished_at:string;duration_seconds:number;sets:CompletedSet[];pending?:boolean};
type ActiveWorkout = {clientSessionId:string;program:Program;startedAt:string;exerciseIndex:number;setNumber:number;completedSets:CompletedSet[];restUntil:number;restRemaining:number;restPaused:boolean};
type PendingAction = {kind:"saveProgram";program:Program}|{kind:"deleteProgram";id:string}|{kind:"saveSession";payload:Record<string,unknown>}|{kind:"deleteSession";id:string};
type Screen = "home"|"regions"|"list"|"detail"|"programs"|"edit"|"workout"|"summary"|"history"|"historyDetail"|"progress";
type DetailTab = "movement"|"muscles"|"equipment"|"steps";
const REGIONS:[string,string][]=[["chest","Göğüs"],["back","Sırt"],["shoulders","Omuz"],["biceps","Ön Kol – Biceps"],["triceps","Arka Kol – Triceps"],["legs","Bacak"],["abs","Karın"],["glutes","Kalça"],["cardio","Kardiyo"],["full-body","Tüm Vücut"]];
const LEVELS=["Başlangıç","Orta","İleri"], EQUIPMENT=["Makine","Dambıl","Bar","Vücut Ağırlığı","Kablo"];
const SAFETY="Herhangi bir sakatlığınız veya sağlık probleminiz varsa hareketi uygulamadan önce eğitmeninize veya sağlık uzmanınıza danışın.";
const trDate=(iso:string)=>new Intl.DateTimeFormat("tr-TR",{day:"numeric",month:"long",year:"numeric"}).format(new Date(iso));
const minutes=(seconds:number)=>`${Math.floor(seconds/60)} dk ${seconds%60} sn`;
const round=(value:number)=>Math.round(value*10)/10;
const uuid=()=>crypto.randomUUID();

export default function TrainingAssistant({memberId,request,checkedOutAt}:{memberId:number;request:(url:string,init?:RequestInit)=>Promise<Response>;checkedOutAt?:string|null}){
  const key=`fitnstop-training-${memberId}`;
  const requestRef=useRef(request);requestRef.current=request;
  const [catalog,setCatalog]=useState<Exercise[]>([]),[catalogError,setCatalogError]=useState("");
  const [visuals,setVisuals]=useState<Record<string,string>>({});
  const [screen,setScreen]=useState<Screen>("home"),[region,setRegion]=useState(""),[query,setQuery]=useState("");
  const [level,setLevel]=useState(""),[equipment,setEquipment]=useState(""),[selected,setSelected]=useState<Exercise|null>(null);
  const [detailTab,setDetailTab]=useState<DetailTab>("movement");
  const [programs,setPrograms]=useState<Program[]>([]),[editing,setEditing]=useState<Program|null>(null);
  const [workout,setWorkout]=useState<ActiveWorkout|null>(null),[secondsLeft,setSecondsLeft]=useState(0);
  const [reps,setReps]=useState(10),[weight,setWeight]=useState(0);
  const [history,setHistory]=useState<Session[]>([]),[historyDetail,setHistoryDetail]=useState<Session|null>(null);
  const [message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const syncing=useRef(false),dragIndex=useRef<number|null>(null);

  const getLocal=<T,>(suffix:string,fallback:T):T=>{try{return JSON.parse(localStorage.getItem(`${key}:${suffix}`)||"null")??fallback}catch{return fallback}};
  const putLocal=(suffix:string,value:unknown)=>{try{localStorage.setItem(`${key}:${suffix}`,JSON.stringify(value))}catch{/* Storage can be unavailable in a private WebView. */}};

  useEffect(()=>{
    let live=true;
    Promise.all(["exercises.json","visuals.json"].map(async name=>{const response=await fetch(`/training-assets/${name}?v=3`,{cache:"no-store"});if(!response.ok)throw new Error(`${name} açılamadı`);return response.json()})).then(results=>{const rows=results[0] as Exercise[];const images=results[1] as Record<string,string>;if(!live)return;setVisuals(images);setCatalog(rows.map(row=>({...row,previewAsset:images[row.previewAsset]||"",equipmentImageAsset:row.equipmentImageAsset?images[row.equipmentImageAsset]||"":null,muscleImageAsset:row.muscleImageAsset?images[row.muscleImageAsset]||"":null})))}).catch(()=>{if(live)setCatalogError("Antrenman görselleri yüklenemedi. Uygulamayı güncelleyip tekrar açın.")});
    setPrograms(getLocal<Program[]>("programs",[]));setHistory(getLocal<Session[]>("history",[]));
    const saved=getLocal<ActiveWorkout|null>("active",null);if(saved){setWorkout(saved);setScreen("workout")}
    void refreshOnline().then(()=>flushPending());
    const online=()=>{void flushPending();void refreshOnline()};window.addEventListener("online",online);
    const focus=()=>{if(document.visibilityState==="visible")void flushPending()};
    window.addEventListener("focus",focus);
    return()=>{live=false;window.removeEventListener("online",online);window.removeEventListener("focus",focus)};
  },[memberId]);

  useEffect(()=>{if(workout)putLocal("active",workout);else localStorage.removeItem(`${key}:active`)},[workout,memberId]);
  useEffect(()=>{
    if(!checkedOutAt||!workout)return;
    if(workout.completedSets.length){void saveWorkout();setMessage("Salon çıkışı yapıldığı için antrenmanın otomatik kapatılıp kaydedildi.");}
    else{setWorkout(null);setScreen("home");setMessage("Salon çıkışı yapıldığı için başlanmış antrenman kapatıldı.");}
  },[checkedOutAt,workout?.clientSessionId]);
  useEffect(()=>{const scroller=document.querySelector<HTMLElement>(".mobile-content");if(scroller)scroller.scrollTop=0},[screen,selected?.id,region]);
  useEffect(()=>{if(!workout?.restUntil||workout.restPaused){setSecondsLeft(workout?.restRemaining||0);return}const tick=()=>{const left=Math.max(0,Math.ceil((workout.restUntil-Date.now())/1000));setSecondsLeft(left);if(left===0)setWorkout(current=>current?{...current,restUntil:0,restRemaining:0}:null)};tick();const timer=window.setInterval(tick,500);return()=>window.clearInterval(timer)},[workout?.restUntil,workout?.restPaused,workout?.restRemaining]);

  async function refreshOnline(){
    if(!navigator.onLine)return;
    try{
      const [programResponse,historyResponse]=await Promise.all([requestRef.current("/api/training/programs"),requestRef.current("/api/training/sessions")]);
      if(programResponse.ok){const data:any=await programResponse.json();const pending=getLocal<PendingAction[]>("pending",[]);const removed=new Set(pending.filter(x=>x.kind==="deleteProgram").map(x=>(x as {id:string}).id));const drafts=pending.filter(x=>x.kind==="saveProgram").map(x=>(x as {program:Program}).program);const combined=[...drafts,...(data.programs as Program[])].filter((p,i,arr)=>!removed.has(p.id)&&arr.findIndex(other=>other.id===p.id)===i);setPrograms(combined);putLocal("programs",combined)}
      if(historyResponse.ok){const data:any=await historyResponse.json();const pending=getLocal<PendingAction[]>("pending",[]).filter(x=>x.kind==="saveSession").map(x=>sessionFromPayload((x as {payload:Record<string,unknown>}).payload));const combined=[...pending,...(data.sessions as Session[])].filter((s,i,arr)=>arr.findIndex(other=>other.client_session_id===s.client_session_id)===i);setHistory(combined);putLocal("history",combined)}
    }catch{/* Keep the account-scoped offline cache. */}
  }

  function sessionFromPayload(payload:Record<string,unknown>):Session{return {client_session_id:payload.clientSessionId as string,program_id:payload.programId as string|null,program_name:payload.programName as string,started_at:payload.startedAt as string,finished_at:payload.finishedAt as string,duration_seconds:payload.durationSeconds as number,sets:payload.sets as CompletedSet[],pending:true}}
  async function flushPending(){
    if(syncing.current||!navigator.onLine||!getLocal<PendingAction[]>("pending",[]).length)return;
    syncing.current=true;
    try{
      let pending=getLocal<PendingAction[]>("pending",[]);
      const hadPending=pending.length>0;
      while(pending.length){
        const action=pending[0];let response:Response;
        if(action.kind==="saveProgram")response=await requestRef.current("/api/training/programs",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(action.program)});
        else if(action.kind==="deleteProgram")response=await requestRef.current(`/api/training/programs?id=${encodeURIComponent(action.id)}`,{method:"DELETE"});
        else if(action.kind==="saveSession")response=await requestRef.current("/api/training/sessions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(action.payload)});
        else response=await requestRef.current(`/api/training/sessions?id=${encodeURIComponent(action.id)}`,{method:"DELETE"});
        if(!response.ok){setMessage("Kayıt cihazda bekliyor. Bağlantı veya oturum düzeldiğinde tekrar denenecek.");break;}
        const latest=getLocal<PendingAction[]>("pending",[]);
        const index=latest.findIndex(item=>JSON.stringify(item)===JSON.stringify(action));
        if(index>=0)latest.splice(index,1);
        pending=latest;putLocal("pending",pending);
      }
      if(!pending.length){await refreshOnline();if(hadPending)setMessage("Antrenman verileri hesabınıza kaydedildi.")}
    }catch{/* Retry on the next online event. */}finally{syncing.current=false}
  }
  function queue(action:PendingAction){const old=getLocal<PendingAction[]>("pending",[]);const pending=action.kind==="saveProgram"?[...old.filter(x=>!(x.kind==="saveProgram"&&x.program.id===action.program.id)),action]:[...old,action];putLocal("pending",pending);void flushPending()}

  const matches=useMemo(()=>catalog.filter(exercise=>(!region||exercise.bodyRegion===region)&&(!query||`${exercise.turkishName} ${exercise.englishName}`.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")))&&(!level||exercise.difficulty===level)&&(!equipment||exercise.equipmentType===equipment)),[catalog,region,query,level,equipment]);
  const exerciseById=(id:string)=>catalog.find(exercise=>exercise.id===id);
  const previousWeight=(id:string)=>history.flatMap(session=>session.sets).filter(set=>set.exerciseId===id).at(0)?.weightKg||0;
  const currentItem=workout?.program.items[workout.exerciseIndex];
  const currentExercise=currentItem?exerciseById(currentItem.exerciseId):null;

  function openDetail(exercise:Exercise){setSelected(exercise);setDetailTab("movement");setScreen("detail")}
  function addExercise(exercise:Exercise){
    const base=editing||programs[0]||{id:uuid(),name:"Programım",items:[]};
    if(base.items.some(item=>item.exerciseId===exercise.id)){setMessage("Bu hareket programında zaten var.");setScreen("edit");setEditing(base);return}
    const next={...base,items:[...base.items,{exerciseId:exercise.id,position:base.items.length,targetSets:exercise.recommendedSets,targetReps:exercise.bodyRegion==="cardio"?1:10,weightKg:0,restSeconds:exercise.restSeconds}]};
    setEditing(next);setScreen("edit");setMessage("Hareket programına eklendi. Kaydetmeyi unutma.");
  }
  function newProgram(){setEditing({id:uuid(),name:"Yeni Program",items:[]});setScreen("edit")}
  function saveProgram(){if(!editing)return;const name=editing.name.trim();if(!name){setMessage("Program adı yazın.");return}const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:min));const normalized={...editing,name,items:editing.items.map((item,position)=>({...item,position,targetSets:Math.floor(clamp(item.targetSets,1,20)),targetReps:Math.floor(clamp(item.targetReps,1,200)),weightKg:clamp(item.weightKg,0,1000),restSeconds:Math.floor(clamp(item.restSeconds,0,900))}))};const next=[normalized,...programs.filter(program=>program.id!==normalized.id)];setPrograms(next);putLocal("programs",next);queue({kind:"saveProgram",program:normalized});setEditing(null);setScreen("programs");setMessage(navigator.onLine?"Program kaydediliyor.":"Program cihazda saklandı; bağlantı gelince eşitlenecek.")}
  function deleteProgram(program:Program){if(!window.confirm(`${program.name} silinsin mi?`))return;const next=programs.filter(item=>item.id!==program.id);setPrograms(next);putLocal("programs",next);queue({kind:"deleteProgram",id:program.id});setMessage("Program silindi.")}
  function deleteSession(session:Session){if(!window.confirm(`${session.program_name} antrenman kaydı silinsin mi?`))return;const next=history.filter(item=>item.client_session_id!==session.client_session_id);setHistory(next);putLocal("history",next);const pending=getLocal<PendingAction[]>("pending",[]).filter(action=>!(action.kind==="saveSession"&&action.payload.clientSessionId===session.client_session_id));putLocal("pending",pending);if(!session.pending)queue({kind:"deleteSession",id:session.client_session_id});if(historyDetail?.client_session_id===session.client_session_id){setHistoryDetail(null);setScreen("history")}setMessage("Antrenman kaydı silindi.")}
  function updateItem(index:number,changes:Partial<ProgramItem>){if(!editing)return;setEditing({...editing,items:editing.items.map((item,i)=>i===index?{...item,...changes}:item)})}
  function moveItem(from:number,to:number){if(!editing||to<0||to>=editing.items.length||from===to)return;const items=[...editing.items];const [item]=items.splice(from,1);items.splice(to,0,item);setEditing({...editing,items:items.map((value,position)=>({...value,position}))})}
  function touchMove(event:React.PointerEvent<HTMLButtonElement>,index:number){if(dragIndex.current===null)return;const element=document.elementFromPoint(event.clientX,event.clientY)?.closest("[data-program-index]");const to=Number(element?.getAttribute("data-program-index"));if(Number.isInteger(to)&&to!==dragIndex.current&&to>=0){moveItem(dragIndex.current,to);dragIndex.current=to}}

  function startProgram(program:Program){if(!program.items.length){setMessage("Önce programa hareket ekleyin.");return}const first=program.items[0];setReps(first.targetReps);setWeight(first.weightKg||previousWeight(first.exerciseId));const fresh={clientSessionId:uuid(),program,startedAt:new Date().toISOString(),exerciseIndex:0,setNumber:1,completedSets:[],restUntil:0,restRemaining:0,restPaused:false};setWorkout(fresh);setScreen("workout");setMessage("")}
  function completeSet(){if(!workout||!currentItem||workout.completedSets.filter(set=>set.exerciseId===currentItem.exerciseId).length>=currentItem.targetSets)return;const set={exerciseId:currentItem.exerciseId,setNumber:workout.setNumber,reps:Math.max(0,Math.min(500,Math.floor(reps))),weightKg:Math.max(0,Math.min(1000,Number(weight)||0))};const more=workout.setNumber<currentItem.targetSets;const rest=currentItem.restSeconds;setWorkout({...workout,completedSets:[...workout.completedSets,set],setNumber:more?workout.setNumber+1:workout.setNumber,restUntil:more&&rest?Date.now()+rest*1000:0,restRemaining:more?rest:0,restPaused:false});setMessage(more?"Set tamamlandı. Dinlenme başladı.":"Hareketin setleri tamamlandı. Sonraki harekete geçebilirsin.")}
  function nextExercise(){if(!workout)return;if(workout.exerciseIndex+1>=workout.program.items.length){finishWorkout();return}const index=workout.exerciseIndex+1,item=workout.program.items[index];setWorkout({...workout,exerciseIndex:index,setNumber:1,restUntil:0,restRemaining:0,restPaused:false});setReps(item.targetReps);setWeight(item.weightKg||previousWeight(item.exerciseId));setMessage("")}
  function finishWorkout(){if(!workout?.completedSets.length){setMessage("Kaydetmek için en az bir set tamamlayın.");return}setWorkout(current=>current?{...current,restUntil:0,restRemaining:0}:null);setScreen("summary")}
  function summary(){if(!workout)return null;const sets=workout.completedSets;const duration=Math.max(0,Math.floor((Date.now()-Date.parse(workout.startedAt))/1000));const regions=[...new Set(sets.map(set=>exerciseById(set.exerciseId)?.bodyRegion).filter(Boolean))].map(id=>REGIONS.find(r=>r[0]===id)?.[1]);const old=history.flatMap(session=>session.sets);const records=[...new Set(sets.map(set=>set.exerciseId))].filter(id=>{const previous=old.filter(set=>set.exerciseId===id),current=sets.filter(set=>set.exerciseId===id);return current.some(set=>set.weightKg>Math.max(0,...previous.map(prior=>prior.weightKg))||set.reps>Math.max(0,...previous.map(prior=>prior.reps)))});return {duration,sets:sets.length,reps:sets.reduce((total,set)=>total+set.reps,0),volume:round(sets.reduce((total,set)=>total+set.reps*set.weightKg,0)),exercises:new Set(sets.map(set=>set.exerciseId)).size,regions,records:records.length}}
  async function saveWorkout(){if(!workout)return;setBusy(true);const payload={clientSessionId:workout.clientSessionId,programId:null,programName:workout.program.name,startedAt:workout.startedAt,finishedAt:new Date().toISOString(),durationSeconds:Math.min(86400,summary()?.duration||0),sets:workout.completedSets};const session=sessionFromPayload(payload);const next=[session,...history.filter(old=>old.client_session_id!==session.client_session_id)];setHistory(next);putLocal("history",next);queue({kind:"saveSession",payload});setWorkout(null);setScreen("history");setMessage(navigator.onLine?"Antrenman kaydediliyor. Kayıt tamamlandığında listede görünecek.":"Antrenman cihazda bekliyor. İnternet gelince güvenli biçimde kaydedilecek.");setBusy(false)}

  function presetExercises(targetRegion:string,tier:number){const own=catalog.filter(exercise=>exercise.bodyRegion===targetRegion);const rank=(difficulty:string)=>difficulty==="Başlangıç"?1:difficulty==="Orta"?2:3;return [...own].sort((a,b)=>rank(a.difficulty)-rank(b.difficulty)).slice(0,tier===1?Math.min(3,own.length):tier===2?Math.min(4,own.length):own.length)}
  function startPreset(targetRegion:string,tier:number){const chosen=presetExercises(targetRegion,tier);if(!chosen.length)return;const regionLabel=REGIONS.find(item=>item[0]===targetRegion)?.[1]||"Antrenman";const tierLabel=["Başlangıç","Orta Seviye","İleri Seviye"][tier-1];const program:Program={id:uuid(),name:`${regionLabel} ${tierLabel}`,items:chosen.map((exercise,position)=>({exerciseId:exercise.id,position,targetSets:tier===1?2:tier===2?3:4,targetReps:tier===3?8:12,weightKg:0,restSeconds:tier===3?90:exercise.restSeconds}))};startProgram(program)}

  const head=(title:string,back:()=>void,eyebrow="ANTRENMAN ASİSTANI")=><div className="training-head"><button onClick={back} aria-label="Geri"><ArrowLeft/></button><div><span>{eyebrow}</span><h2>{title}</h2></div></div>;
  const preview=(exercise:Exercise,large=false)=><div className={`training-preview ${large?"large":""}`}><img src={exercise.previewAsset} alt={`${exercise.turkishName} için üç boyutlu sporcu görseli`} loading={large?"eager":"lazy"}/></div>;
  const muscleView=(bodyRegion:string,view:"front"|"back")=>{
    const front=["chest","shoulders","biceps","abs","legs"],back=["back","shoulders","triceps","glutes","legs"];
    const selected=view==="front"?front:back;
    const path=selected.includes(bodyRegion)?`/training-assets/body-model/highlights/${view}-${bodyRegion}.webp`:`/training-assets/body-model/${view}.webp`;
    return visuals[path]||"";
  };

  return <div className="training-assistant">
    {message&&<div className="training-message" role="status">{message}<button onClick={()=>setMessage("")} aria-label="Mesajı kapat">×</button></div>}
    {catalogError&&<div className="training-error">{catalogError}</div>}
    {screen==="home"&&<><div className="training-intro"><span>FİT N STOP · ANTRENMAN</span><h1>Bir sonraki adımını seç.</h1><p>Hareketleri keşfet, programını oluştur ve gelişimini takip et.</p></div><div className="training-home-grid">
      <button onClick={()=>setScreen("regions")}><BookOpen/><strong>Bölgeye Göre Hareketler</strong><small>43 yerel hareket ve anlatım</small><ChevronRight/></button>
      <button onClick={()=>setScreen("programs")}><Dumbbell/><strong>Antrenman Programım</strong><small>Hareketlerini düzenle</small><ChevronRight/></button>
      <button onClick={()=>setScreen("programs")}><Play/><strong>Antrenmana Başla</strong><small>Kaldığın yerden devam et</small><ChevronRight/></button>
      <button onClick={()=>setScreen("history")}><History/><strong>Antrenman Geçmişim</strong><small>Kaydedilen setler</small><ChevronRight/></button>
      <button onClick={()=>setScreen("progress")}><TrendingUp/><strong>İlerlemem</strong><small>Net sonuçlar ve rekorlar</small><ChevronRight/></button>
    </div>{workout&&<button className="training-primary" onClick={()=>setScreen("workout")}>Yarım Kalan Antrenmana Devam Et <ChevronRight/></button>}</>}

    {screen==="regions"&&<>{head("Bölgeye Göre Hareketler",()=>setScreen("home"))}<BodyRegionMap visuals={visuals} onSelect={id=>{setRegion(id);setScreen("list")}}/><input className="training-search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Türkçe veya İngilizce hareket ara" aria-label="Hareket ara"/><div className="training-filters">{LEVELS.map(value=><button key={value} className={level===value?"active":""} onClick={()=>setLevel(level===value?"":value)}>{value}</button>)}{EQUIPMENT.map(value=><button key={value} className={equipment===value?"active":""} onClick={()=>setEquipment(equipment===value?"":value)}>{value}</button>)}</div><div className="training-region-grid">{REGIONS.map(([id,name])=>{const cover=catalog.find(item=>item.bodyRegion===id)?.previewAsset;return <button key={id} className={region===id?"active":""} onClick={()=>{setRegion(id);setScreen("list")}}>{cover&&<img src={cover} alt={name+" sporcu görseli"}/>}<strong>{name}</strong><small>{catalog.filter(item=>item.bodyRegion===id).length} hareket</small></button>})}</div>{query&&<button className="training-primary" onClick={()=>{setRegion("");setScreen("list")}}><Search/> {matches.length} arama sonucunu göster</button>}</>}

    {screen==="list"&&<>{head(region?REGIONS.find(item=>item[0]===region)?.[1]||"Hareketler":"Hareketler",()=>setScreen("regions"))}<input className="training-search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Hareket ara"/><div className="training-filters">{LEVELS.map(value=><button key={value} className={level===value?"active":""} onClick={()=>setLevel(level===value?"":value)}>{value}</button>)}{EQUIPMENT.map(value=><button key={value} className={equipment===value?"active":""} onClick={()=>setEquipment(equipment===value?"":value)}>{value}</button>)}</div>{region&&<div className="training-level-list">{[1,2,3].map(tier=>{const chosen=presetExercises(region,tier),cover=chosen.at(-1)?.previewAsset,regionName=REGIONS.find(item=>item[0]===region)?.[1]||"Antrenman",label=["Başlangıç","Orta Seviye","İleri Seviye"][tier-1];return <article className="training-level-card" key={tier}>{cover&&<img src={cover} alt={regionName+" "+label+" program görseli"}/>}<div><strong>{regionName} {label}</strong><small>{chosen.length} hareket · yaklaşık {Math.max(8,chosen.length*(tier+1)*3)} dk</small><span>{[1,2,3].map(i=><i key={i} className={i<=tier?"on":""}/>)}</span><small>{[...new Set(chosen.map(item=>item.equipment))].join(" · ")}</small><button onClick={()=>startPreset(region,tier)}>Programa Başla <ChevronRight/></button></div></article>})}</div>}<div className="training-list">{matches.map(exercise=><article key={exercise.id} className="training-exercise-card">{preview(exercise)}<div className="training-exercise-info"><strong>{exercise.turkishName}</strong><small>{exercise.englishName}</small><span>{exercise.primaryMuscles.join(", ")} · {exercise.equipment}</span><span>{exercise.difficulty} · {exercise.recommendedSets} set · {exercise.recommendedReps}</span></div><div className="training-card-actions"><button onClick={()=>openDetail(exercise)}>Hareketi İncele</button><button onClick={()=>addExercise(exercise)}>Antrenmanıma Ekle</button></div></article>)}{!matches.length&&<p className="training-empty">Bu filtrelerle hareket bulunamadı.</p>}</div></>}

    {screen==="detail"&&selected&&<>{head(selected.turkishName,()=>setScreen("list"),"HAREKET DETAYI")}<p className="training-en-name">{selected.englishName}</p>{preview(selected,true)}<div className="training-detail-tabs" role="tablist" aria-label="Hareket bilgileri">{([["movement","Hareket"],["muscles","Kaslar"],["equipment","Ekipman"],["steps","Talimat"]] as [DetailTab,string][]).map(([id,label])=><button key={id} role="tab" aria-selected={detailTab===id} className={detailTab===id?"active":""} onClick={()=>setDetailTab(id)}>{label}</button>)}</div>{detailTab==="movement"&&<p className="training-visual-note">Görsel hareketin bir pozisyonunu gösterir. Uygulama adımlarını ve güvenlik uyarılarını da okuyun.</p>}{detailTab==="muscles"&&<><div className="training-muscle-views"><img src={muscleView(selected.bodyRegion,"front")} alt="Çalışan kasların üç boyutlu önden görünümü"/><img src={muscleView(selected.bodyRegion,"back")} alt="Kasların arkadan görünümü"/></div><div className="training-facts"><span>Ana kaslar: {selected.primaryMuscles.join(", ")}</span><span>Yardımcı kaslar: {selected.secondaryMuscles.join(", ")||"Yok"}</span></div></>}{detailTab==="equipment"&&<div className="training-equipment-panel"><img src={selected.equipmentImageAsset||selected.previewAsset} alt={selected.equipment+" ekipmanı"}/><strong>{selected.equipment}</strong><small>{selected.equipment==="Ekipman gerektirmez"?"Bu hareket için ekipman gerekmez.":"Ekipmanın doğru ayarını antrenörünüzle kontrol edin."}</small></div>}{detailTab==="steps"&&<><h3>Uygulama Adımları</h3><ol className="training-steps">{selected.instructions.map((step,index)=><li key={index}>{step}</li>)}</ol><h3>Nefes</h3><p>{selected.breathing}</p></>}<div className="training-facts"><span>Öneri: {selected.recommendedSets} set · {selected.recommendedReps}</span><span>Dinlenme: {selected.restSeconds} sn</span><span>Zorluk: {selected.difficulty}</span></div>{detailTab!=="steps"&&<><h3>Adım Adım Talimatlar</h3><ol className="training-steps">{selected.instructions.map((step,index)=><li key={index}>{step}</li>)}</ol></>}<h3>Sık Yapılan Hatalar</h3><ul className="training-steps">{selected.commonMistakes.map((item,index)=><li key={index}>{item}</li>)}</ul><h3>Güvenlik Uyarıları</h3><ul className="training-steps">{selected.safetyWarnings.map((item,index)=><li key={index}>{item}</li>)}</ul><p className="training-warning">{SAFETY}</p><h3>Alternatif Hareketler</h3><div className="training-alternatives">{selected.alternativeExerciseIds.map(id=>{const alternative=exerciseById(id);return alternative&&<button key={id} onClick={()=>openDetail(alternative)}>{alternative.turkishName}<ChevronRight/></button>})}</div><button className="training-primary" onClick={()=>addExercise(selected)}><Plus/> Antrenmanıma Ekle</button></>}

    {screen==="programs"&&<>{head("Antrenman Programım",()=>setScreen("home"))}<button className="training-primary" onClick={newProgram}><Plus/> Yeni Program Oluştur</button><div className="training-list">{programs.map(program=><article className="training-program-card" key={program.id}><strong>{program.name}</strong><small>{program.items.length} hareket · {program.items.reduce((n,item)=>n+item.targetSets,0)} hedef set</small><div><button onClick={()=>{setEditing(JSON.parse(JSON.stringify(program)));setScreen("edit")}}>Düzenle</button><button onClick={()=>startProgram(program)}>Antrenmana Başla</button><button onClick={()=>deleteProgram(program)} aria-label={`${program.name} sil`}><Trash2/></button></div></article>)}{!programs.length&&<p className="training-empty">Henüz program yok. Hareketlerden birini ekleyerek başlayabilirsin.</p>}</div></>}

    {screen==="edit"&&editing&&<>{head("Programı Düzenle",()=>setScreen("programs"))}<label className="training-field">Program adı<input value={editing.name} onChange={event=>setEditing({...editing,name:event.target.value})} maxLength={80}/></label><p className="training-hint">Sıralamak için tutup sürükleyebilir veya okları kullanabilirsin.</p><div className="training-list">{editing.items.map((item,index)=>{const exercise=exerciseById(item.exerciseId);return <article key={item.exerciseId} className="training-edit-row" data-program-index={index}><div className="training-edit-title"><button className="training-drag" draggable onDragStart={()=>{dragIndex.current=index}} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(dragIndex.current!==null){moveItem(dragIndex.current,index);dragIndex.current=null}}} onPointerDown={event=>{dragIndex.current=index;event.currentTarget.setPointerCapture(event.pointerId)}} onPointerMove={event=>touchMove(event,index)} onPointerUp={()=>{dragIndex.current=null}} aria-label="Sıralamak için sürükle"><GripVertical/></button><strong>{exercise?.turkishName||item.exerciseId}</strong><button onClick={()=>moveItem(index,index-1)} aria-label="Yukarı taşı"><ArrowUp/></button><button onClick={()=>moveItem(index,index+1)} aria-label="Aşağı taşı"><ArrowDown/></button><button onClick={()=>setEditing({...editing,items:editing.items.filter((_,i)=>i!==index)})} aria-label="Hareketi çıkar"><Trash2/></button></div><div className="training-edit-fields"><label>Set<input type="number" min={1} max={20} value={item.targetSets} onChange={event=>updateItem(index,{targetSets:Number(event.target.value)})}/></label><label>Tekrar<input type="number" min={1} max={200} value={item.targetReps} onChange={event=>updateItem(index,{targetReps:Number(event.target.value)})}/></label><label>Kg<input type="number" min={0} max={1000} step="0.5" value={item.weightKg} onChange={event=>updateItem(index,{weightKg:Number(event.target.value)})}/></label><label>Dinlenme sn<input type="number" min={0} max={900} value={item.restSeconds} onChange={event=>updateItem(index,{restSeconds:Number(event.target.value)})}/></label></div></article>})}{!editing.items.length&&<p className="training-empty">Programa henüz hareket eklenmedi.</p>}</div><button className="training-primary" onClick={saveProgram}><Check/> Programı Kaydet</button><button className="training-secondary" onClick={()=>setScreen("regions")}><Plus/> Hareket Ekle</button></>}

    {screen==="workout"&&workout&&currentItem&&<>{head("Antrenmana Başla",()=>setScreen("home"),workout.program.name)}<div className="training-workout-progress"><span>Hareket {workout.exerciseIndex+1} / {workout.program.items.length}</span><span>{minutes(Math.max(0,Math.floor((Date.now()-Date.parse(workout.startedAt))/1000)))}</span></div>{currentExercise&&<>{preview(currentExercise,true)}<h3>{currentExercise.turkishName}</h3></>}<div className="training-current-set"><strong>Set {workout.setNumber} / {currentItem.targetSets}</strong><span>Hedef {currentItem.targetReps} tekrar · {currentItem.weightKg} kg</span><small>Önceki antrenman: {previousWeight(currentItem.exerciseId)} kg</small></div><div className="training-set-inputs"><label>Yapılan tekrar<input type="number" min={0} max={500} value={reps} onChange={event=>setReps(Number(event.target.value))}/></label><label>Kullanılan ağırlık (kg)<input type="number" min={0} max={1000} step="0.5" value={weight} onChange={event=>setWeight(Number(event.target.value))}/></label></div><button className="training-primary" onClick={completeSet} disabled={workout.completedSets.filter(set=>set.exerciseId===currentItem.exerciseId).length>=currentItem.targetSets}><Check/> Seti Tamamla</button>{workout.restRemaining>0&&<div className="training-rest"><Timer/><strong>{secondsLeft} sn</strong><span>Dinlenme</span><div><button onClick={()=>setWorkout({...workout,restRemaining:secondsLeft,restUntil:0,restPaused:true})} disabled={workout.restPaused}>Duraklat</button><button onClick={()=>setWorkout({...workout,restUntil:Date.now()+workout.restRemaining*1000,restPaused:false})} disabled={!workout.restPaused}>Devam Et</button><button onClick={()=>setWorkout({...workout,restUntil:workout.restPaused?0:Date.now()+(secondsLeft+15)*1000,restRemaining:secondsLeft+15})}>+15 sn</button><button onClick={()=>setWorkout({...workout,restUntil:0,restRemaining:0,restPaused:false})}>Geç</button></div></div>}<button className="training-secondary" onClick={nextExercise}>Sonraki Hareket <ChevronRight/></button><button className="training-finish" onClick={finishWorkout}>Antrenmanı Bitir</button></>}

    {screen==="summary"&&workout&&summary()&&<>{head("Antrenman Tamamlandı",()=>setScreen("workout"))}<div className="training-summary-grid"><div><strong>{minutes(summary()!.duration)}</strong><small>Süre</small></div><div><strong>{summary()!.exercises}</strong><small>Hareket</small></div><div><strong>{summary()!.sets}</strong><small>Set</small></div><div><strong>{summary()!.reps}</strong><small>Tekrar</small></div><div><strong>{summary()!.volume} kg</strong><small>Toplam hacim</small></div><div><strong>{summary()!.records}</strong><small>Yeni kişisel rekor</small></div></div><p>Çalışan bölgeler: {summary()!.regions.join(", ")}</p><button className="training-primary" disabled={busy} onClick={()=>void saveWorkout()}><Check/> Kapat ve Kaydet</button></>}

    {screen==="history"&&<>{head("Antrenman Geçmişim",()=>setScreen("home"))}<div className="training-list">{history.map(session=><div className="training-history-item" key={session.client_session_id}><button className="training-history-row" onClick={()=>{setHistoryDetail(session);setScreen("historyDetail")}}><strong>{session.program_name}</strong><small>{trDate(session.finished_at)} · {minutes(session.duration_seconds)} · {new Set(session.sets.map(set=>set.exerciseId)).size} hareket · {session.sets.length} set{session.pending?" · Eşitlenmeyi bekliyor":""}</small><ChevronRight/></button><button className="training-history-delete" onClick={()=>deleteSession(session)} aria-label={`${session.program_name} antrenmanını sil`}><Trash2/></button></div>)}{!history.length&&<p className="training-empty">Henüz kaydedilmiş antrenman yok.</p>}</div></>}

    {screen==="historyDetail"&&historyDetail&&<>{head(historyDetail.program_name,()=>setScreen("history"),trDate(historyDetail.finished_at))}<div className="training-facts"><span>Süre: {minutes(historyDetail.duration_seconds)}</span><span>Toplam set: {historyDetail.sets.length}</span><span>Toplam tekrar: {historyDetail.sets.reduce((n,set)=>n+set.reps,0)}</span></div><div className="training-list">{historyDetail.sets.map((set,index)=><div className="training-history-set" key={index}><strong>{exerciseById(set.exerciseId)?.turkishName||set.exerciseId}</strong><span>Set {set.setNumber} · {set.reps} tekrar · {set.weightKg} kg</span></div>)}</div></>}

    {screen==="progress"&&<>{head("İlerlemem",()=>setScreen("home"))}<Progress sessions={history} catalog={catalog} openSession={session=>{setHistoryDetail(session);setScreen("historyDetail")}}/></>}
  </div>;
}

function Progress({sessions,catalog,openSession}:{sessions:Session[];catalog:Exercise[];openSession:(session:Session)=>void}){
  const completed=sessions.filter(session=>!session.pending);
  const sets=completed.flatMap(session=>session.sets);
  const now=new Date(),weekStart=new Date(now);weekStart.setHours(0,0,0,0);weekStart.setDate(now.getDate()-((now.getDay()+6)%7));
  const thisWeek=completed.filter(session=>new Date(session.finished_at)>=weekStart);
  const regionCount=new Map<string,number>();for(const set of sets){const region=catalog.find(item=>item.id===set.exerciseId)?.bodyRegion;if(region)regionCount.set(region,(regionCount.get(region)||0)+1)}
  const popular=[...regionCount].sort((a,b)=>b[1]-a[1])[0]?.[0];
  const exerciseIds=[...new Set(sets.map(set=>set.exerciseId))];
  const latestWeights=exerciseIds.map(id=>({id,weight:sets.find(set=>set.exerciseId===id)?.weightKg||0}));
  const prs=exerciseIds.map(id=>{const own=sets.filter(set=>set.exerciseId===id);return {id,maxKg:Math.max(...own.map(set=>set.weightKg)),maxReps:Math.max(...own.map(set=>set.reps))}});
  const days=[...new Set(thisWeek.map(session=>new Intl.DateTimeFormat("tr-TR",{weekday:"long"}).format(new Date(session.finished_at))))];
  return <><div className="training-summary-grid"><div><strong>{completed.length}</strong><small>Toplam antrenman</small></div><div><strong>{thisWeek.length}</strong><small>Bu hafta</small></div><div><strong>{completed[0]?trDate(completed[0].finished_at):"—"}</strong><small>Son antrenman</small></div><div><strong>{REGIONS.find(item=>item[0]===popular)?.[1]||"—"}</strong><small>En çok çalışan bölge</small></div></div><h3>Bu Haftaki Günler</h3><p>{days.join(" · ")||"Henüz antrenman yok."}</p><h3>Son Kullanılan Ağırlıklar</h3><div className="training-list">{latestWeights.slice(0,8).map(item=><div className="training-history-set" key={item.id}><strong>{catalog.find(exercise=>exercise.id===item.id)?.turkishName||item.id}</strong><span>{item.weight} kg</span></div>)}</div><h3>Hareket Bazında Ağırlık Değişimi</h3><div className="training-list">{exerciseIds.slice(0,8).map(id=>{const own=completed.flatMap(session=>session.sets.filter(set=>set.exerciseId===id));return <div className="training-history-set" key={id}><strong>{catalog.find(exercise=>exercise.id===id)?.turkishName||id}</strong><span>{own.length>1?`${own.at(-1)?.weightKg} → ${own[0]?.weightKg} kg`:"İlk kayıt"}</span></div>})}</div><h3>Kişisel Rekorlar</h3><div className="training-list">{prs.map(item=><div className="training-history-set" key={item.id}><strong>{catalog.find(exercise=>exercise.id===item.id)?.turkishName||item.id}</strong><span>En yüksek {item.maxKg} kg · Bir sette {item.maxReps} tekrar</span></div>)}</div><h3>Son Beş Antrenman</h3><div className="training-list">{completed.slice(0,5).map(session=><button className="training-history-row" key={session.client_session_id} onClick={()=>openSession(session)}><strong>{session.program_name}</strong><small>{trDate(session.finished_at)} · {session.sets.length} set</small><ChevronRight/></button>)}</div>{!completed.length&&<p className="training-empty">İlerleme bilgileri ilk antrenman kaydından sonra görünür.</p>}</>;
}







