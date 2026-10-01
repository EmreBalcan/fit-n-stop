"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, ChevronRight, Clock3, Dumbbell, Eye, EyeOff, Home, LogOut, Plus, QrCode, ShieldCheck, UserRound, X } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import jsQR from "jsqr";
import TrainingAssistant from "./training-assistant";
import { dailyNoteFor } from "./daily-notes";
import "./training.css";

type Member = { id:number; fullName:string; phone:string; email:string|null; startDate:string; endDate:string; tcLast4:string; mustChangePassword:boolean; status:"active"|"frozen"; freezeUsed:boolean; frozenUntil:string|null };
type Slot = { id:number; time:string; count:number; capacity:number; mine:boolean };
type Reservation = { id:number; memberId:number; date:string; timeSlot:string };
const TIMES = ["06.00 – 08.00","08.00 – 10.00","10.00 – 12.00","12.00 – 14.00","14.00 – 16.00","16.00 – 18.00","18.00 – 20.00","20.00 – 22.00"];
const trToday = () => new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const emptySlots = ():Slot[] => TIMES.map((time,index)=>({id:index+1,time,count:0,capacity:25,mine:false}));
const dateLabel = (date:string) => new Intl.DateTimeFormat("tr-TR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(`${date}T12:00:00`));
const shortDate = (date:string) => new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${date}T12:00:00`));

export default function MobileAppPreview(){
  const today=trToday();
  const [noteDate,setNoteDate]=useState(today);
  const picker=useRef<HTMLInputElement>(null);
  const [loggedIn,setLoggedIn]=useState(false);
  const [accessToken,setAccessToken]=useState("");
  const tokenRef=useRef("");
  const refreshRef=useRef("");
  const [member,setMember]=useState<Member|null>(null);
  const [changeRequired,setChangeRequired]=useState(false);
  const [newPassword,setNewPassword]=useState(""); const [newPassword2,setNewPassword2]=useState("");
  const [tc,setTc]=useState(""); const [password,setPassword]=useState(""); const [show,setShow]=useState(false);
  const [error,setError]=useState(""); const [notice,setNotice]=useState("");
  const [tab,setTab]=useState<"home"|"appointments"|"profile"|"training">("home");
  const [selectedDate,setSelectedDate]=useState(today);
  const [slots,setSlots]=useState<Slot[]>(emptySlots);
  const [todayReservation,setTodayReservation]=useState<Reservation|null>(null);
  const [closedDay,setClosedDay]=useState<{date:string;reason:string}|null>(null);
  const [qr,setQr]=useState(false); const [entered,setEntered]=useState(false);
  const videoRef=useRef<HTMLVideoElement>(null);
  const scanBusy=useRef(false);
  const [cameraError,setCameraError]=useState("");

  useEffect(()=>{const timer=window.setInterval(()=>setNoteDate(trToday()),60_000);return()=>window.clearInterval(timer)},[]);

  const memberFetch=async(url:string,init:RequestInit={})=>{
    const send=(token:string)=>fetch(url,{...init,headers:{...init.headers,Authorization:`Bearer ${token}`}});
    let response=await send(tokenRef.current);
    if(response.status===403&&refreshRef.current){
      const renewed=await fetch("/api/member-refresh",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({refreshToken:refreshRef.current})});
      if(renewed.ok){const data:any=await renewed.json();tokenRef.current=data.accessToken;refreshRef.current=data.refreshToken;setAccessToken(data.accessToken);response=await send(data.accessToken);}
    }
    return response;
  };
  async function loadDate(date:string,current=member){
    if(!current)return;
    const response=await memberFetch(`/api/reservations?memberId=${current.id}&date=${date}`,{cache:"no-store"});
    const data:any=await response.json();
    if(!response.ok){setError(data.error||"Randevular yüklenemedi.");return;}
    setSlots(data.slots.map((time:string,index:number)=>({id:index+1,time,count:Number(data.counts[time]||0),capacity:data.capacity,mine:data.reservation?.timeSlot===time})));
    setClosedDay(data.closedDay);
    if(date===today)setTodayReservation(data.reservation);
  }
  useEffect(()=>{if(!loggedIn||!member||!accessToken)return;let active=true,cleanup=()=>{};fetch("/api/public-config").then(r=>r.json()).then((config:any)=>{if(!active||!config.url||!config.key)return;const client=createClient(config.url,config.key,{auth:{persistSession:false}});client.realtime.setAuth(accessToken);const channel=client.channel("gym-updates").on("broadcast",{event:"changed"},()=>loadDate(selectedDate,member)).subscribe();cleanup=()=>{client.removeChannel(channel);};}).catch(()=>{});const timer=window.setInterval(()=>loadDate(selectedDate,member),15000);return()=>{active=false;cleanup();window.clearInterval(timer);};},[loggedIn,member,selectedDate,accessToken]);
  useEffect(()=>{
    if(!qr||entered||!todayReservation)return;
    let cancelled=false,frame=0,lastScan=0;scanBusy.current=false;setCameraError("");
    let stream:MediaStream|null=null;
    const canvas=document.createElement("canvas");
    const context=canvas.getContext("2d",{willReadFrequently:true});
    const scan=(timestamp:number)=>{
      if(cancelled||scanBusy.current)return;
      const video=videoRef.current;
      if(video&&context&&video.readyState>=HTMLMediaElement.HAVE_CURRENT_DATA&&timestamp-lastScan>140){
        lastScan=timestamp;
        canvas.width=Math.min(video.videoWidth,640);
        canvas.height=Math.round(canvas.width*video.videoHeight/video.videoWidth);
        if(canvas.width&&canvas.height){
          context.drawImage(video,0,0,canvas.width,canvas.height);
          const pixels=context.getImageData(0,0,canvas.width,canvas.height);
          const code=jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:"attemptBoth"});
          if(code?.data){
            if(code.data.startsWith("FITNSTOP-GIRIS:")){scanBusy.current=true;void checkIn(code.data);return;}
            setCameraError("Bu kod salon giriş kodu değil. Yönetici panelindeki Giriş QR kodunu okutun.");
          }
        }
      }
      frame=requestAnimationFrame(scan);
    };
    const start=async()=>{
      try{
        if(!navigator.mediaDevices?.getUserMedia)throw new Error("Kamera bu cihazda kullanılamıyor.");
        stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"}}});
        if(cancelled){stream.getTracks().forEach(track=>track.stop());return;}
        if(!videoRef.current)return;
        videoRef.current.srcObject=stream;
        await videoRef.current.play();
        frame=requestAnimationFrame(scan);
      }catch{if(!cancelled)setCameraError("Kamera açılamadı. Uygulamanın kamera iznini kontrol edip yeniden deneyin.");}
    };
    void start();
    return()=>{cancelled=true;cancelAnimationFrame(frame);stream?.getTracks().forEach(track=>track.stop());if(videoRef.current)videoRef.current.srcObject=null;};
  },[qr,entered,todayReservation?.id]);

  async function login(e:React.FormEvent){
    e.preventDefault(); setError("");
    if(tc.length!==11||password.length<6){setError("TC kimlik numarası 11 hane, şifre en az 6 karakter olmalıdır.");return;}
    const response=await fetch("/api/member-login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({tcNo:tc,password})});
    const data:any=await response.json(); if(!response.ok){setError(data.error||"Giriş yapılamadı.");return;}
    tokenRef.current=data.accessToken;refreshRef.current=data.refreshToken;setAccessToken(data.accessToken);setMember(data.member); if(data.member.mustChangePassword){setChangeRequired(true);return;} await finishLogin(data.member);
  }
  async function finishLogin(current:Member|null){if(!current)return;setLoggedIn(true);setChangeRequired(false);setSelectedDate(today);await loadDate(today,current);const response=await memberFetch(`/api/attendance?memberId=${current.id}`);const data:any=await response.json();setEntered(!!data.attendance);}
  async function changePassword(e:React.FormEvent){
    e.preventDefault();setError("");
    if(newPassword.length<6||newPassword!==newPassword2){setError("Şifreler aynı olmalı ve en az 6 karakter içermelidir.");return;}
    const response=await memberFetch("/api/member-password",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({newPassword})});
    const data:any=await response.json();if(!response.ok){setError(data.error||"Şifre değiştirilemedi.");return;}
    tokenRef.current=data.accessToken;refreshRef.current=data.refreshToken;setAccessToken(data.accessToken);
    setPassword(newPassword);const updated=member?{...member,mustChangePassword:false}:null;setMember(updated);await finishLogin(updated);
  }
  async function reserve(slot:Slot){
    if(!member||isPast(slot))return; setError("");setNotice("");
    const response=slot.mine
      ? await memberFetch(`/api/reservations?memberId=${member.id}&date=${selectedDate}`,{method:"DELETE"})
      : await memberFetch("/api/reservations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({memberId:member.id,date:selectedDate,timeSlot:slot.time})});
    const data:any=await response.json(); if(!response.ok){setError(data.error||"Randevu işlemi tamamlanamadı.");return;}
    setNotice(slot.mine?"Randevun iptal edildi.":"Randevun oluşturuldu."); await loadDate(selectedDate,member);
  }
  async function checkIn(qrValue:string){
    if(!member)return;setError("");
    const response=await memberFetch("/api/attendance",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({memberId:member.id,qrValue})});
    const data:any=await response.json();if(!response.ok){setError(data.error||"Giriş kaydedilemedi.");setQr(false);return;}
    setEntered(true);
  }
  async function freezeMembership(){
    if(!member||member.freezeUsed)return;
    if(!window.confirm("Üyeliğiniz 1 ay dondurulacak ve bu hak bir daha kullanılamayacak. Devam edilsin mi?"))return;
    const response=await memberFetch("/api/membership-freeze",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({memberId:member.id})});
    const data:any=await response.json();if(!response.ok){setError(data.error||"Üyelik dondurulamadı.");return;}
    setMember(current=>current?{...current,status:"frozen",freezeUsed:true,frozenUntil:data.member.frozenUntil,endDate:data.member.endDate}:current);
  }
  function isPast(slot:Slot){
    if(selectedDate!==today)return false;
    const end=slot.time.match(/–\s*(\d{2})\.(\d{2})/);if(!end)return false;
    const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Istanbul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date()).split(":");
    return Number(end[1])*60+Number(end[2]) <= Number(parts[0])*60+Number(parts[1]);
  }
  function reservationEnded(timeSlot:string){const end=timeSlot.match(/–\s*(\d{2})\.(\d{2})/);if(!end)return false;const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Istanbul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date()).split(":");return Number(end[1])*60+Number(end[2])<=Number(parts[0])*60+Number(parts[1]);}
  async function chooseDate(date:string){if(!date)return;setSelectedDate(date);setTab("appointments");setError("");setNotice("");await loadDate(date);}
  const selectedReservation=slots.find(slot=>slot.mine);
  const todaySlot=todayReservation?slots.find(slot=>selectedDate===today&&slot.time===todayReservation.timeSlot)??{id:0,time:todayReservation.timeSlot,count:0,capacity:25,mine:true}:null;
  const missed=!!todayReservation&&!entered&&reservationEnded(todayReservation.timeSlot);
  const fmt=(value:string)=>shortDate(value);

  if(changeRequired)return <div className="mobile-preview login-scene"><div className="login-card"><div className="mobile-brand"><b>FİT</b><i>N</i><strong>STOP</strong></div><div className="login-copy"><span>İLK GİRİŞ</span><h1>Yeni şifreni oluştur.</h1><p>Geçici şifren yalnızca bir kez kullanılabilir. Bundan sonraki girişlerinde yeni şifren geçerli olacak.</p></div><form onSubmit={changePassword}><label>Yeni Şifre<input type="password" minLength={6} value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="En az 6 karakter"/></label><label>Yeni Şifre Tekrar<input type="password" minLength={6} value={newPassword2} onChange={e=>setNewPassword2(e.target.value)} placeholder="Şifreni tekrar yaz"/></label>{error&&<div className="mobile-error">{error}</div>}<button className="login-button">Şifreyi Kaydet <ChevronRight/></button></form></div></div>;
  if(!loggedIn)return <div className="mobile-preview login-scene"><div className="athlete-shape a1"/><div className="athlete-shape a2"/><div className="login-card"><div className="mobile-brand"><b>FİT</b><i>N</i><strong>STOP</strong></div><div className="login-copy"><span>ÜYE GİRİŞİ</span><h1>Bugünkü antrenmanın<br/>burada başlıyor.</h1><p>Randevunu oluştur, salon girişini QR kod ile tamamla.</p></div><form onSubmit={login}><label>TC Kimlik Numarası<input inputMode="numeric" maxLength={11} value={tc} onChange={e=>setTc(e.target.value.replace(/\D/g,""))} placeholder="11 haneli TC kimlik numarası"/></label><label>Şifre<div className="password-field"><input type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Geçici veya kişisel şifreniz"/><button type="button" onClick={()=>setShow(!show)}>{show?<EyeOff/>:<Eye/>}</button></div></label>{error&&<div className="mobile-error">{error}</div>}<button className="login-button">Giriş Yap <ChevronRight/></button><small>İlk giriş şifrenizi salon yönetiminden alabilirsiniz.</small></form></div></div>;

  return <div className="mobile-preview app-scene"><div className="phone-app">
    <header className="mobile-header"><div className="mini-brand"><b>FİT</b><i>N</i><strong>STOP</strong></div><button onClick={()=>{setLoggedIn(false);setMember(null);setAccessToken("");tokenRef.current="";refreshRef.current=""}}><LogOut/></button></header>
    <main className="mobile-content">
      {tab==="home"&&<><section className="member-hero"><div className="hero-silhouette"/><span>HOŞ GELDİN</span><h1>{member?.fullName}</h1><p><ShieldCheck/> {member?.status==="frozen"?"Üyelik Donduruldu":"Aktif Üye"}</p><div className="membership-dates"><div><small>Başlangıç</small><strong>{member&&fmt(member.startDate)}</strong></div><i/><div><small>Bitiş</small><strong>{member&&fmt(member.endDate)}</strong></div></div></section>
      <section className={`today-card ${missed?"missed-card":""}`}><div className="section-line"><div><span>BUGÜN</span><h2>{missed?"Randevuya katılmadın":todayReservation?"Randevun":"Henüz randevun yok"}</h2></div><button className="calendar-pick" onClick={()=>picker.current?.showPicker()} aria-label="Başka gün seç"><CalendarDays/><input ref={picker} type="date" min={today} value={selectedDate} onChange={e=>chooseDate(e.target.value)}/></button></div>{todayReservation?<div className="appointment-row"><div className="date-box"><b>{today.slice(-2)}</b><small>{missed?"GEÇTİ":"BUGÜN"}</small></div><div><strong>{todayReservation.timeSlot}</strong><span>{missed?"Randevu saati geçti · Giriş yapılmadı":`${todaySlot?.count??0} / 25 kişi katılıyor`}</span></div><button onClick={()=>chooseDate(today)}><ChevronRight/></button></div>:<button className="empty-appointment" onClick={()=>chooseDate(today)}><Plus/> Bugün için randevu al</button>}</section>
      <button className="qr-main" onClick={()=>setQr(true)} disabled={entered||!todayReservation||missed}><span><QrCode/></span><div><small>{entered?"GİRİŞ TAMAMLANDI":missed?"RANDEVU GEÇTİ":todayReservation?"SALONA GİRİŞ":"RANDEVU GEREKLİ"}</small><strong>{entered?"Bugünkü girişin kaydedildi":missed?"Bu randevu için giriş yapılamaz":todayReservation?"QR Kodu Okut":"Önce bugün için randevu almalısın"}</strong></div><ChevronRight/></button>
      <div className="rule-note"><Clock3/><p>QR kod yalnızca bugünkü randevu saatinde çalışır. Her üye günde bir kez giriş yapabilir.</p></div></>}
      {tab==="home"&&<><section className="gym-info"><div className="section-line"><div><span>SALON BİLGİLERİ</span><h2>Bugün seni neler bekliyor?</h2></div><Dumbbell/></div><div className="gym-info-grid"><article><Clock3/><small>Çalışma Saatleri</small><strong>06.00 – 22.00</strong></article><article><CalendarDays/><small>Günlük Hak</small><strong>1 randevu</strong></article></div></section><section className="motivation-card"><span>BUGÜNÜN NOTU</span><strong>{dailyNoteFor(noteDate)}</strong></section></>}
      {tab==="appointments"&&<section className="slots-screen"><div className="screen-title date-title"><div><span>RANDEVU</span><h1>Saatini seç</h1><p>{dateLabel(selectedDate)}</p></div><label className="date-control"><CalendarDays/><input type="date" min={today} value={selectedDate} onChange={e=>chooseDate(e.target.value)}/></label></div>{notice&&<div className="booking-notice">{notice}</div>}{error&&<div className="booking-error">{error}</div>}<div className="slot-list">{slots.map(slot=>{const past=isPast(slot);return <article key={slot.id} className={`${slot.mine?"selected":""} ${slot.count>=slot.capacity?"full":""} ${past?"past":""}`}><div><Clock3/><span><strong>{slot.time}</strong><small>{slot.count} / {slot.capacity} kişi{past?" · Saati geçti":""}</small></span></div><div className="capacity"><i style={{width:`${slot.count/slot.capacity*100}%`}}/></div><button disabled={past||(!slot.mine&&slot.count>=slot.capacity)} onClick={()=>reserve(slot)}>{slot.mine?"İptal Et":past?"Geçti":slot.count>=slot.capacity?"Dolu":"Randevu Al"}</button></article>})}</div><p className="one-booking"><ShieldCheck/> Her gün için yalnızca bir randevu oluşturabilirsiniz.</p></section>}
      {tab==="profile"&&<section className="profile-screen"><div className="profile-avatar">{member?.fullName.split(" ").map(x=>x[0]).join("").slice(0,2)}</div><h1>{member?.fullName}</h1><span>{member?.status==="frozen"?"Üyelik Donduruldu":"Aktif Üye"}</span><div className="profile-list"><div><small>TC Kimlik Numarası</small><strong>*******{member?.tcLast4}</strong></div><div><small>Telefon</small><strong>{member?.phone}</strong></div><div><small>Üyelik Başlangıcı</small><strong>{member&&fmt(member.startDate)}</strong></div><div><small>Üyelik Bitişi</small><strong>{member&&fmt(member.endDate)}</strong></div></div><div className="profile-actions"><button onClick={()=>{setChangeRequired(true);setNewPassword("");setNewPassword2("")}}>Şifremi Değiştir</button><button className="freeze-button" disabled={member?.freezeUsed} onClick={freezeMembership}>{member?.freezeUsed?"Dondurma hakkı kullanıldı":"Üyeliğimi 1 ay dondur"}</button></div>{error&&<div className="booking-error">{error}</div>}</section>}
      {tab==="training"&&member&&<TrainingAssistant memberId={member.id} request={memberFetch}/>}
    </main>
    <nav className="bottom-nav training-nav"><button className={tab==="home"?"active":""} onClick={()=>setTab("home")}><Home/><span>Ana Sayfa</span></button><button className={tab==="appointments"?"active":""} onClick={()=>chooseDate(selectedDate)}><CalendarDays/><span>Randevu</span></button><button className="scan-fab" onClick={()=>{if(todayReservation)setQr(true)}}><QrCode/></button><button className={tab==="training"?"active":""} onClick={()=>setTab("training")}><Dumbbell/><span>Antrenman</span></button><button className={tab==="profile"?"active":""} onClick={()=>setTab("profile")}><UserRound/><span>Profilim</span></button><button onClick={()=>setTab("home")}><Dumbbell/><span>Salon</span></button></nav>
    {qr&&todayReservation&&<div className="qr-sheet"><button className="close-qr" onClick={()=>setQr(false)} aria-label="Kamerayı kapat"><X/></button>{entered?<div className="qr-success"><div><Check/></div><span>GİRİŞ BAŞARILI</span><h2>İyi antrenmanlar!</h2><p>Bugünkü salon girişin kaydedildi.</p><button onClick={()=>setQr(false)}>Ana Sayfaya Dön</button></div>:<div className="scanner"><span>QR KODU OKUT</span><h2>Telefonunu girişteki<br/>QR koda doğrult</h2><div className="camera-box"><video ref={videoRef} autoPlay muted playsInline/><div className="scan-corners"/></div><p>{cameraError||`Randevu: Bugün, ${todayReservation.timeSlot}`}</p>{cameraError&&<button onClick={()=>{setQr(false);window.setTimeout(()=>setQr(true),100)}}>Kamerayı Yeniden Aç</button>}</div>}</div>}
  </div></div>;
}

