"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, ChevronRight, Clock3, Dumbbell, Eye, EyeOff, Home, LogOut, MapPin, Moon, Phone, Plus, QrCode, RotateCcw, ShieldCheck, Sun, UserRound, X } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { CapacitorBarcodeScanner, CapacitorBarcodeScannerAndroidScanningLibrary, CapacitorBarcodeScannerCameraDirection, CapacitorBarcodeScannerTypeHint } from "@capacitor/barcode-scanner";
import jsQR from "jsqr";
import TrainingAssistant from "./training-assistant";
import { dailyNoteFor } from "./daily-notes";
import "./training.css";

type Member = { id:number; fullName:string; phone:string; email:string|null; startDate:string; endDate:string; tcLast4:string; mustChangePassword:boolean; status:"active"|"frozen"; freezeUsed:boolean; freezeStartDate:string|null; frozenUntil:string|null };
type Slot = { id:number; time:string; count:number; capacity:number; mine:boolean };
type Reservation = { id:number; memberId:number; date:string; timeSlot:string; missedTimeSlot:string|null; secondChanceUsed:boolean };
type Attendance = { id:number; memberId:number; date:string; checkedInAt:string; checkedOutAt:string|null; exitMethod:"qr"|"automatic"|null; durationMinutes:number|null; reservationTimeSlot:string };
type GymInfo = { about:string; address:string; trainerName:string; phone:string };
type TodaySession = { id:string; name:string; finishedAt:string; durationSeconds:number; setsCount:number; pending:boolean };
const TIMES = ["06.00 – 08.00","08.00 – 10.00","10.00 – 12.00","12.00 – 14.00","14.00 – 16.00","16.00 – 18.00","18.00 – 20.00","20.00 – 22.00"];
const APK_URL = "https://fit-n-stop-admin.emrebalcan494.chatgpt.site/fit-n-stop-v1.7.apk";
const trToday = () => new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const trDateFor = (value:string) => new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));
const trTimeFor = (value:string) => new Intl.DateTimeFormat("tr-TR",{timeZone:"Europe/Istanbul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(value));
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
  const [tab,setTab]=useState<"home"|"appointments"|"profile"|"training"|"todayVisit"|"salon">("home");
  const [theme,setTheme]=useState<"light"|"dark">("light");
  const [selectedDate,setSelectedDate]=useState(today);
  const [slots,setSlots]=useState<Slot[]>(emptySlots);
  const [todayReservation,setTodayReservation]=useState<Reservation|null>(null);
  const [selectedReservationRecord,setSelectedReservationRecord]=useState<Reservation|null>(null);
  const [selectedDateAttended,setSelectedDateAttended]=useState(false);
  const [attendance,setAttendance]=useState<Attendance|null>(null);
  const [visits,setVisits]=useState<Attendance[]>([]);
  const [averageDuration,setAverageDuration]=useState<number|null>(null);
  const [attendanceLoaded,setAttendanceLoaded]=useState(false);
  const [todaySessions,setTodaySessions]=useState<TodaySession[]>([]);
  const [todaySessionsLoading,setTodaySessionsLoading]=useState(false);
  const [gymInfo,setGymInfo]=useState<GymInfo|null>(null);
  const [gymInfoError,setGymInfoError]=useState("");
  const [closedDay,setClosedDay]=useState<{date:string;reason:string}|null>(null);
  const [qr,setQr]=useState(false); const [entered,setEntered]=useState(false);
  const videoRef=useRef<HTMLVideoElement>(null);
  const scanBusy=useRef(false);
  const [cameraError,setCameraError]=useState("");
  const [scannerUpdateRequired,setScannerUpdateRequired]=useState(false);
  const [nativeScanning,setNativeScanning]=useState(false);
  const [bookingSlot,setBookingSlot]=useState("");
  const [freezePicker,setFreezePicker]=useState(false);
  const [freezeStartDate,setFreezeStartDate]=useState(today);

  useEffect(()=>{const timer=window.setInterval(()=>setNoteDate(trToday()),60_000);return()=>window.clearInterval(timer)},[]);
  useEffect(()=>{try{setTheme(localStorage.getItem("fitnstop-theme")==="dark"?"dark":"light")}catch{/* Use the light default. */}},[]);
  useEffect(()=>{setScannerUpdateRequired(Capacitor.getPlatform()==="android"&&!Capacitor.isPluginAvailable("CapacitorBarcodeScanner"))},[]);
  function chooseTheme(value:"light"|"dark"){setTheme(value);try{localStorage.setItem("fitnstop-theme",value)}catch{/* Keep the current choice for this session. */}}

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
    setSelectedReservationRecord(data.reservation);setSelectedDateAttended(!!data.attended);
    setClosedDay(data.closedDay);
    if(date===today)setTodayReservation(data.reservation);
  }
  async function loadAttendance(current=member){
    if(!current)return;
    const response=await memberFetch(`/api/attendance?memberId=${current.id}`);
    const data:any=await response.json();
    if(!response.ok)throw new Error(data.error||"Giriş bilgisi yüklenemedi.");
    setAttendance(data.attendance);setEntered(!!data.attendance);setVisits(data.visits||[]);setAverageDuration(data.averageDurationMinutes??null);setAttendanceLoaded(true);
  }
  async function loadGymInfo(){try{setGymInfoError("");const response=await fetch("/api/gym-info",{cache:"no-store"});const data=await response.json() as {error?:string;gym:GymInfo};if(!response.ok)throw new Error(data.error);setGymInfo(data.gym)}catch(err){setGymInfoError(err instanceof Error?err.message:"Salon bilgileri yüklenemedi.")}}
  async function loadTodaySessions(){
    if(!member)return;
    setTodaySessionsLoading(true);
    try{
      const response=await memberFetch(`/api/training/sessions?date=${trToday()}`);
      const data:any=await response.json();if(!response.ok)throw new Error(data.error||"Antrenman geçmişi yüklenemedi.");
      const remote:TodaySession[]=(data.sessions||[]).map((row:any)=>({id:row.client_session_id,name:row.program_name,finishedAt:row.finished_at,durationSeconds:row.duration_seconds,setsCount:Array.isArray(row.sets)?row.sets.length:0,pending:false}));
      let local:TodaySession[]=[];
      try{const cached=JSON.parse(localStorage.getItem(`fitnstop-training-${member.id}:history`)||"[]");local=(Array.isArray(cached)?cached:[]).filter((row:any)=>row.pending&&row.finished_at&&trDateFor(row.finished_at)===trToday()).map((row:any)=>({id:row.client_session_id,name:row.program_name,finishedAt:row.finished_at,durationSeconds:row.duration_seconds,setsCount:Array.isArray(row.sets)?row.sets.length:0,pending:true}))}catch{/* Local history is optional. */}
      setTodaySessions([...remote,...local.filter(row=>!remote.some(saved=>saved.id===row.id))].sort((a,b)=>b.finishedAt.localeCompare(a.finishedAt)));
    }catch(err){setError(err instanceof Error?err.message:"Antrenman geçmişi yüklenemedi.")}finally{setTodaySessionsLoading(false)}
  }
  useEffect(()=>{if(!loggedIn||!member||!accessToken)return;let active=true,cleanup=()=>{};fetch("/api/public-config").then(r=>r.json()).then((config:any)=>{if(!active||!config.url||!config.key)return;const client=createClient(config.url,config.key,{auth:{persistSession:false}});client.realtime.setAuth(accessToken);const channel=client.channel("gym-updates").on("broadcast",{event:"changed"},(event:any)=>{const {table,date}=event.payload||{};if((table==="reservations"||table==="attendances")&&date===selectedDate)void loadDate(selectedDate,member);if(table==="attendances"&&date===trToday())void loadAttendance(member).catch(()=>{});}).subscribe();cleanup=()=>{client.removeChannel(channel)};}).catch(()=>{});const onFocus=()=>{if(document.visibilityState==="visible"){void loadDate(selectedDate,member);void loadAttendance(member).catch(()=>{});if(tab==="salon")void loadGymInfo()}};window.addEventListener("focus",onFocus);document.addEventListener("visibilitychange",onFocus);return()=>{active=false;cleanup();window.removeEventListener("focus",onFocus);document.removeEventListener("visibilitychange",onFocus)};},[loggedIn,member,selectedDate,accessToken,tab]);
  useEffect(()=>{if(tab==="salon")void loadGymInfo()},[tab]);
  useEffect(()=>{
    if(!qr||(!entered&&!todayReservation)||attendance?.checkedOutAt)return;
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
            const expected=entered?"FITNSTOP-CIKIS:":"FITNSTOP-GIRIS:";
            if(code.data.startsWith(expected)){scanBusy.current=true;void checkIn(code.data);return;}
            setCameraError(entered?"Bu kod salon çıkış kodu değil. Yönetici panelindeki Çıkış QR kodunu okutun.":"Bu kod salon giriş kodu değil. Yönetici panelindeki Giriş QR kodunu okutun.");
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
  },[qr,entered,todayReservation?.id,attendance?.checkedOutAt]);

  async function login(e:React.FormEvent){
    e.preventDefault(); setError("");
    if(tc.length!==11||password.length<6){setError("TC kimlik numarası 11 hane, şifre en az 6 karakter olmalıdır.");return;}
    const response=await fetch("/api/member-login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({tcNo:tc,password})});
    const data:any=await response.json(); if(!response.ok){setError(data.error||"Giriş yapılamadı.");return;}
    tokenRef.current=data.accessToken;refreshRef.current=data.refreshToken;setAccessToken(data.accessToken);setMember(data.member); if(data.member.mustChangePassword){setChangeRequired(true);return;} await finishLogin(data.member);
  }
  async function finishLogin(current:Member|null){if(!current)return;setAttendanceLoaded(false);setAttendance(null);setEntered(false);setTodayReservation(null);setLoggedIn(true);setChangeRequired(false);setSelectedDate(today);try{await Promise.all([loadDate(today,current),loadAttendance(current)])}catch(err){setError(err instanceof Error?err.message:"Bugünkü bilgiler yüklenemedi.")}}
  async function changePassword(e:React.FormEvent){
    e.preventDefault();setError("");
    if(newPassword.length<6||newPassword!==newPassword2){setError("Şifreler aynı olmalı ve en az 6 karakter içermelidir.");return;}
    const response=await memberFetch("/api/member-password",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({newPassword})});
    const data:any=await response.json();if(!response.ok){setError(data.error||"Şifre değiştirilemedi.");return;}
    tokenRef.current=data.accessToken;refreshRef.current=data.refreshToken;setAccessToken(data.accessToken);
    setPassword(newPassword);const updated=member?{...member,mustChangePassword:false}:null;setMember(updated);await finishLogin(updated);
  }
  async function reserve(slot:Slot){
    if(!member||isPast(slot)||bookingSlot)return; setError("");setNotice("");setBookingSlot(slot.time);
    const before=slots;
    setSlots(current=>current.map(item=>item.id===slot.id?{...item,mine:!slot.mine,count:Math.max(0,item.count+(slot.mine?-1:1))}:{...item,mine:false}));
    const response=slot.mine
      ? await memberFetch(`/api/reservations?memberId=${member.id}&date=${selectedDate}`,{method:"DELETE"})
      : await memberFetch("/api/reservations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({memberId:member.id,date:selectedDate,timeSlot:slot.time})});
    const data:any=await response.json(); if(!response.ok){setSlots(before);setError(data.error||"Randevu işlemi tamamlanamadı.");setBookingSlot("");return;}
    setNotice(slot.mine?"Randevun iptal edildi.":"Randevun oluşturuldu.");setBookingSlot("");void loadDate(selectedDate,member);
  }
  async function checkIn(qrValue:string){
    if(!member)return;setError("");
    const response=await memberFetch("/api/attendance",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({memberId:member.id,qrValue})});
    const data:any=await response.json();if(!response.ok){const message=data.error||"Giriş kaydedilemedi.";setError(message);setCameraError(message);setQr(false);return;}
    setAttendance(data.attendance);setAttendanceLoaded(true);setEntered(true);if(selectedDate===today)setSelectedDateAttended(true);setQr(false);void loadAttendance(member);
  }
  async function openScanner(){
    const exiting=entered&&!attendance?.checkedOutAt;
    if(!attendanceLoaded||nativeScanning||(!exiting&&(!todayReservation||missed)))return;
    setCameraError("");
    if(!Capacitor.isNativePlatform()){setQr(true);return;}
    if(!Capacitor.isPluginAvailable("CapacitorBarcodeScanner")){setScannerUpdateRequired(true);return;}
    setNativeScanning(true);
    try{
      const result=await CapacitorBarcodeScanner.scanBarcode({hint:CapacitorBarcodeScannerTypeHint.QR_CODE,cameraDirection:CapacitorBarcodeScannerCameraDirection.BACK,scanInstructions:exiting?"Salon çıkış QR kodunu okutun":"Salon giriş QR kodunu okutun",cancelButtonAccessibilityLabel:"Taramayı kapat",android:{scanningLibrary:CapacitorBarcodeScannerAndroidScanningLibrary.ZXING}});
      if(!result.ScanResult)return;
      const expected=exiting?"FITNSTOP-CIKIS:":"FITNSTOP-GIRIS:";
      if(!result.ScanResult.startsWith(expected)){setCameraError(exiting?"Bu kod salon çıkış kodu değil. Yönetici panelindeki Çıkış QR kodunu okutun.":"Bu kod salon giriş kodu değil. Yönetici panelindeki Giriş QR kodunu okutun.");return;}
      await checkIn(result.ScanResult);
    }catch(error){const message=error instanceof Error?error.message:"";if(/not implemented on android/i.test(message)){setScannerUpdateRequired(true)}else{setCameraError(message?`Kamera açılamadı: ${message}`:"Kamera açılamadı. Uygulama izinlerini kontrol edin.")}}
    finally{setNativeScanning(false)}
  }
  async function freezeMembership(){
    if(!member||member.freezeUsed)return;
    if(!freezeStartDate)return;
    if(!window.confirm(`${shortDate(freezeStartDate)} tarihinden başlayarak üyeliğiniz 1 ay dondurulacak. Devam edilsin mi?`))return;
    const response=await memberFetch("/api/membership-freeze",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({memberId:member.id,freezeStartDate})});
    const data:any=await response.json();if(!response.ok){setError(data.error||"Üyelik dondurulamadı.");return;}
    setMember(data.member);setFreezePicker(false);
  }
  function isPast(slot:Slot){
    if(selectedDate<today)return true;
    if(selectedDate>today)return false;
    const end=slot.time.match(/–\s*(\d{2})\.(\d{2})/);if(!end)return false;
    const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Istanbul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date()).split(":");
    return Number(end[1])*60+Number(end[2]) <= Number(parts[0])*60+Number(parts[1]);
  }
  function reservationEnded(timeSlot:string){const end=timeSlot.match(/–\s*(\d{2})\.(\d{2})/);if(!end)return false;const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Istanbul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date()).split(":");return Number(end[1])*60+Number(end[2])<=Number(parts[0])*60+Number(parts[1]);}
  async function chooseDate(date:string){if(!date)return;setSelectedDate(date);setTab("appointments");setError("");setNotice("");await loadDate(date);}
  const selectedReservation=slots.find(slot=>slot.mine);
  const selectedExpired=!!selectedReservation&&isPast(selectedReservation);
  const secondChanceSpent=!!selectedReservationRecord?.secondChanceUsed&&selectedReservationRecord.timeSlot!==selectedReservationRecord.missedTimeSlot;
  const canBookSelected=!selectedDateAttended&&(!selectedReservationRecord||selectedExpired&&!secondChanceSpent);
  const todaySlot=todayReservation?slots.find(slot=>selectedDate===today&&slot.time===todayReservation.timeSlot)??{id:0,time:todayReservation.timeSlot,count:0,capacity:25,mine:true}:null;
  const missed=attendanceLoaded&&!!todayReservation&&!entered&&reservationEnded(todayReservation.timeSlot);
  const fmt=(value:string)=>shortDate(value);

  if(changeRequired)return <div className="mobile-preview login-scene theme-dark"><div className="login-card"><div className="mobile-brand"><b>FİT</b><i>N</i><strong>STOP</strong></div><div className="login-copy"><span>İLK GİRİŞ</span><h1>Yeni şifreni oluştur.</h1><p>Geçici şifren yalnızca bir kez kullanılabilir. Bundan sonraki girişlerinde yeni şifren geçerli olacak.</p></div><form onSubmit={changePassword}><label>Yeni Şifre<input type="password" minLength={6} value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="En az 6 karakter"/></label><label>Yeni Şifre Tekrar<input type="password" minLength={6} value={newPassword2} onChange={e=>setNewPassword2(e.target.value)} placeholder="Şifreni tekrar yaz"/></label>{error&&<div className="mobile-error">{error}</div>}<button className="login-button">Şifreyi Kaydet <ChevronRight/></button></form></div></div>;
  if(!loggedIn)return <div className="mobile-preview login-scene theme-dark"><div className="login-cover"/><div className="login-card"><div className="mobile-brand"><b>FİT</b><i>N</i><strong>STOP</strong></div><div className="login-copy"><span>ÜYE GİRİŞİ</span><h1>Bugünkü antrenmanın<br/>burada başlıyor.</h1><p>Randevunu oluştur, salon girişini QR kod ile tamamla.</p></div><form onSubmit={login}><label>TC Kimlik Numarası<input inputMode="numeric" maxLength={11} value={tc} onChange={e=>setTc(e.target.value.replace(/\D/g,""))} placeholder="11 haneli TC kimlik numarası"/></label><label>Şifre<div className="password-field"><input type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Geçici veya kişisel şifreniz"/><button type="button" onClick={()=>setShow(!show)}>{show?<EyeOff/>:<Eye/>}</button></div></label>{error&&<div className="mobile-error">{error}</div>}<button className="login-button">Giriş Yap <ChevronRight/></button><small>İlk giriş şifrenizi salon yönetiminden alabilirsiniz.</small></form></div></div>;

  return <div className="mobile-preview app-scene"><div className={`phone-app theme-${theme}`}>
    <header className="mobile-header"><div className="mini-brand"><b>FİT</b><i>N</i><strong>STOP</strong></div><button onClick={()=>{setLoggedIn(false);setMember(null);setAccessToken("");setAttendance(null);setAttendanceLoaded(false);setEntered(false);tokenRef.current="";refreshRef.current=""}}><LogOut/></button></header>
    <main className="mobile-content">
      {tab==="home"&&<><section className="member-hero"><div className="hero-silhouette"/><span>HOŞ GELDİN</span><h1>{member?.fullName}</h1><p><ShieldCheck/> {member?.status==="frozen"?"Üyelik Donduruldu":"Aktif Üye"}</p><div className="membership-dates"><div><small>Başlangıç</small><strong>{member&&fmt(member.startDate)}</strong></div><i/><div><small>Bitiş</small><strong>{member&&fmt(member.endDate)}</strong></div></div></section>
      <section className={`today-card ${missed?"missed-card":""}`}><div className="section-line"><div><span>BUGÜN</span><h2>{missed?"Randevuya katılmadın":todayReservation?"Randevun":"Henüz randevun yok"}</h2></div><button className="calendar-pick" onClick={()=>picker.current?.showPicker()} aria-label="Başka gün seç"><CalendarDays/><input ref={picker} type="date" min={today} value={selectedDate} onChange={e=>chooseDate(e.target.value)}/></button></div>{todayReservation?<div className="appointment-row"><div className="date-box"><b>{today.slice(-2)}</b><small>{missed?"GEÇTİ":"BUGÜN"}</small></div><div><strong>{todayReservation.timeSlot}</strong><span>{missed?"Randevu saati geçti · Giriş yapılmadı":`${todaySlot?.count??0} / 25 kişi katılıyor`}</span></div><button onClick={()=>chooseDate(today)}><ChevronRight/></button></div>:<button className="empty-appointment" onClick={()=>chooseDate(today)}><Plus/> Bugün için randevu al</button>}</section>
      <button className="qr-main" onClick={()=>{if(entered){setTab("todayVisit");void loadTodaySessions()}else void openScanner()}} disabled={!attendanceLoaded||nativeScanning||(!entered&&(!todayReservation||missed))}><span><QrCode/></span><div><small>{attendance?.checkedOutAt?"ZİYARET TAMAMLANDI":entered?"GİRİŞ TAMAMLANDI":missed?"RANDEVU GEÇTİ":todayReservation?"SALONA GİRİŞ":"RANDEVU GEREKLİ"}</small><strong>{attendance?.checkedOutAt?`${attendance.durationMinutes??0} dakika salonda kaldın`:entered?"Giriş ve çıkış bilgilerini görüntüle":missed?"Bu randevu için giriş yapılamaz":nativeScanning?"Kamera açılıyor...":todayReservation?"QR Kodu Okut":"Önce bugün için randevu almalısın"}</strong></div><ChevronRight/></button>{scannerUpdateRequired&&<div className="app-update-card"><strong>QR kamerası için uygulamayı güncelle</strong><p>Bu kurulumda QR tarayıcı bulunmuyor. Telefon tarayıcısında 1.7 APK’yı indirip mevcut uygulamanın üzerine kur.</p><a href={APK_URL} target="_blank" rel="noreferrer">1.7 APK’yı indir</a></div>}{cameraError&&!qr&&<div className="booking-error">{cameraError}</div>}
      <div className="rule-note"><Clock3/><p>Günde bir kez giriş yapabilirsin. İlk randevuna gidemezsen seans geçtikten sonra bir kez daha randevu alabilirsin.</p></div></>}
      {tab==="home"&&<><section className="gym-info"><div className="section-line"><div><span>SALON BİLGİLERİ</span><h2>Bugün seni neler bekliyor?</h2></div><Dumbbell/></div><div className="gym-info-grid"><article><Clock3/><small>Çalışma Saatleri</small><strong>06.00 – 22.00</strong></article><article><CalendarDays/><small>Günlük Hak</small><strong>1 giriş · en çok 2 randevu</strong></article></div></section><section className="motivation-card"><span>BUGÜNÜN NOTU</span><strong>{dailyNoteFor(noteDate)}</strong></section></>}
      {tab==="todayVisit"&&<section className="visit-screen"><button className="mobile-back" onClick={()=>setTab("home")}>← Ana sayfaya dön</button><div className="screen-title"><span>BUGÜNKÜ GİRİŞ</span><h1>Salon ziyaretin</h1><p>{dateLabel(today)}</p></div><div className="visit-entry-card"><Check/><div><small>{attendance?.checkedOutAt?"ZİYARET TAMAMLANDI":"GİRİŞ TAMAMLANDI"}</small><strong>{attendance?.checkedInAt?.slice(0,5)||"Saat bilgisi yükleniyor"}{attendance?.checkedOutAt?` – ${attendance.checkedOutAt.slice(0,5)}`:""}</strong><span>{attendance?.durationMinutes!==null&&attendance?.durationMinutes!==undefined?`${attendance.durationMinutes} dakika salonda kaldın`:attendance?.reservationTimeSlot?`Randevu: ${attendance.reservationTimeSlot}`:"Bugünkü salon girişin kaydedildi."}</span></div></div>{attendance&&!attendance.checkedOutAt&&<button className="checkout-button" onClick={()=>void openScanner()}><QrCode/> Çıkış QR Kodunu Okut</button>}<div className="visit-stats"><div><small>ORTALAMA ZİYARET</small><strong>{averageDuration===null?"Henüz hesaplanmadı":`${averageDuration} dk`}</strong></div><div><small>TOPLAM ZİYARET</small><strong>{visits.length}</strong></div></div><div className="visit-history-title"><h2>Bugünkü antrenmanların</h2><button onClick={()=>void loadTodaySessions()} aria-label="Antrenman geçmişini yenile"><RotateCcw size={17}/></button></div>{todaySessionsLoading?<p className="visit-empty">Antrenmanlar yükleniyor...</p>:todaySessions.length?todaySessions.map(session=><article className="visit-session" key={session.id}><Dumbbell/><div><strong>{session.name}</strong><span>{trTimeFor(session.finishedAt)} · {Math.floor(session.durationSeconds/60)} dk · {session.setsCount} set{session.pending?" · Eşitlenmeyi bekliyor":""}</span></div></article>):<p className="visit-empty">Bugün kaydedilmiş antrenmanın yok.</p>}</section>}
      {tab==="appointments"&&<section className="slots-screen"><div className="screen-title date-title"><div><span>RANDEVU</span><h1>Saatini seç</h1><p>{dateLabel(selectedDate)}</p></div><label className="date-control"><CalendarDays/><input type="date" min={today} value={selectedDate} onChange={e=>chooseDate(e.target.value)}/></label></div>{notice&&<div className="booking-notice">{notice}</div>}{error&&<div className="booking-error">{error}</div>}{selectedReservationRecord?.missedTimeSlot&&selectedReservationRecord.timeSlot!==selectedReservationRecord.missedTimeSlot&&<div className="missed-previous">Kaçırılan ilk seans: {selectedReservationRecord.missedTimeSlot}</div>}<div className="slot-list">{slots.map(slot=>{const past=isPast(slot);const blocked=!slot.mine&&(!canBookSelected||slot.count>=slot.capacity);return <article key={slot.id} className={`${slot.mine?"selected":""} ${slot.count>=slot.capacity?"full":""} ${past?"past":""}`}><div><Clock3/><span><strong>{slot.time}</strong><small>{slot.count} / {slot.capacity} kişi{past?" · Saati geçti":""}</small></span></div><div className="capacity"><i style={{width:`${slot.count/slot.capacity*100}%`}}/></div><button disabled={past||blocked||!!bookingSlot} onClick={()=>reserve(slot)}>{bookingSlot===slot.time?"İşleniyor…":past?"Geçti":slot.mine?"İptal Et":slot.count>=slot.capacity?"Dolu":selectedDateAttended?"Giriş Yapıldı":secondChanceSpent&&selectedExpired?"Hak Bitti":!canBookSelected?"Önce İptal Et":selectedExpired?"İkinci Hak":"Randevu Al"}</button></article>})}</div><p className="one-booking"><ShieldCheck/> Günde bir giriş hakkın var. İlk seansı kaçırırsan ikinci randevuyu alabilirsin; zamanında iptal ettiğin randevu hakkını kullanmaz.</p></section>}
      {tab==="profile"&&<section className="profile-screen"><div className="profile-avatar">{member?.fullName.split(" ").map(x=>x[0]).join("").slice(0,2)}</div><h1>{member?.fullName}</h1><span>{member?.status==="frozen"?"Üyelik Donduruldu":"Aktif Üye"}</span><div className="profile-list"><div><small>TC Kimlik Numarası</small><strong>*******{member?.tcLast4}</strong></div><div><small>Telefon</small><strong>{member?.phone}</strong></div><div><small>Üyelik Başlangıcı</small><strong>{member&&fmt(member.startDate)}</strong></div><div><small>Üyelik Bitişi</small><strong>{member&&fmt(member.endDate)}</strong></div><div><small>Ortalama Salonda Kalma</small><strong>{averageDuration===null?"Henüz hesaplanmadı":`${averageDuration} dakika`}</strong></div></div>{visits.length>0&&<div className="profile-visits"><h2>Ziyaret Geçmişim</h2>{visits.slice(0,20).map(visit=><div key={visit.id}><span><strong>{fmt(visit.date)}</strong><small>{visit.checkedInAt?.slice(0,5)}{visit.checkedOutAt?` – ${visit.checkedOutAt.slice(0,5)}`:" · İçeride"}</small></span><b>{visit.durationMinutes===null?"—":`${visit.durationMinutes} dk`}</b></div>)}</div>}<div className="profile-actions"><button onClick={()=>{setChangeRequired(true);setNewPassword("");setNewPassword2("")}}>Şifremi Değiştir</button><button className="freeze-button" disabled={member?.freezeUsed} onClick={()=>setFreezePicker(true)}>{member?.freezeUsed?"Dondurma hakkı kullanıldı":"Üyeliğimi 1 ay dondur"}</button></div>{freezePicker&&!member?.freezeUsed&&<div className="freeze-picker"><strong>Dondurma başlangıcı</strong><p>Üyeliğin seçtiğin tarihten bir ay sonra kaldığı yerden devam eder.</p><input type="date" min={today} max={member?.endDate} value={freezeStartDate} onChange={event=>setFreezeStartDate(event.target.value)}/><div><button onClick={()=>setFreezePicker(false)}>Vazgeç</button><button onClick={()=>void freezeMembership()}>1 Ay Dondur</button></div></div>}<div className="theme-choice"><strong>Görünüm</strong><div><button className={theme==="light"?"active":""} onClick={()=>chooseTheme("light")}><Sun size={17}/> Açık</button><button className={theme==="dark"?"active":""} onClick={()=>chooseTheme("dark")}><Moon size={17}/> Koyu</button></div></div>{error&&<div className="booking-error">{error}</div>}</section>}
      {tab==="salon"&&<section className="salon-screen"><div className="screen-title"><span>FİT N STOP</span><h1>Salonumuz</h1></div><article className="salon-about"><Dumbbell/><h2>Salon hakkında</h2><p>{gymInfo?.about||"Salon hakkında bilgi yakında eklenecek."}</p></article><article className="salon-detail"><MapPin/><div><small>KONUM</small><strong>{gymInfo?.address||"Adres bilgisi yakında eklenecek."}</strong>{gymInfo?.address&&<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(gymInfo.address)}`} target="_blank" rel="noreferrer">Haritada aç</a>}</div></article><article className="salon-detail"><UserRound/><div><small>EĞİTMEN</small><strong>{gymInfo?.trainerName||"Eğitmen bilgisi yakında eklenecek."}</strong></div></article><article className="salon-detail"><Phone/><div><small>TELEFON</small><strong>{gymInfo?.phone||"Telefon bilgisi yakında eklenecek."}</strong>{gymInfo?.phone&&<a href={`tel:${gymInfo.phone.replace(/[^+\d]/g,"")}`}>Ara</a>}</div></article>{gymInfoError&&<p className="booking-error">{gymInfoError}</p>}</section>}
      {member&&<div hidden={tab!=="training"}><TrainingAssistant memberId={member.id} request={memberFetch} checkedOutAt={attendance?.checkedOutAt} attendanceDate={attendance?.date} active={tab==="training"}/></div>}
    </main>
    <nav className="bottom-nav training-nav"><button className={tab==="home"||tab==="todayVisit"?"active":""} onClick={()=>setTab("home")}><Home/><span>Ana Sayfa</span></button><button className={tab==="appointments"?"active":""} onClick={()=>chooseDate(selectedDate)}><CalendarDays/><span>Randevu</span></button><button className="scan-fab" onClick={()=>void openScanner()}><QrCode/></button><button className={tab==="training"?"active":""} onClick={()=>setTab("training")}><Dumbbell/><span>Antrenman</span></button><button className={tab==="profile"?"active":""} onClick={()=>setTab("profile")}><UserRound/><span>Profilim</span></button><button className={tab==="salon"?"active":""} onClick={()=>setTab("salon")}><Dumbbell/><span>Salon</span></button></nav>
    {qr&&(todayReservation||entered)&&<div className="qr-sheet"><button className="close-qr" onClick={()=>setQr(false)} aria-label="Kamerayı kapat"><X/></button><div className="scanner"><span>{entered?"ÇIKIŞ QR KODU":"GİRİŞ QR KODU"}</span><h2>Telefonunu {entered?"çıkıştaki":"girişteki"}<br/>QR koda doğrult</h2><div className="camera-box"><video ref={videoRef} autoPlay muted playsInline/><div className="scan-corners"/></div><p>{cameraError||(entered?"Çıkış saatin ziyaret sürene eklenecek.":`Randevu: Bugün, ${todayReservation?.timeSlot}`)}</p>{cameraError&&<button onClick={()=>{setQr(false);window.setTimeout(()=>setQr(true),100)}}>Kamerayı Yeniden Aç</button>}</div></div>}
  </div></div>;
}





