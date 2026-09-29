"use client";

import { useState } from "react";
import { CalendarDays, Check, ChevronRight, Clock3, Dumbbell, Eye, EyeOff, Home, LogOut, QrCode, ShieldCheck, UserRound, X } from "lucide-react";

type Slot = { id:number; time:string; count:number; capacity:number; mine:boolean };
const initialSlots: Slot[] = [
  { id:1,time:"08.00 – 10.00",count:7,capacity:25,mine:false },
  { id:2,time:"10.00 – 12.00",count:20,capacity:25,mine:false },
  { id:3,time:"12.00 – 14.00",count:13,capacity:25,mine:false },
  { id:4,time:"14.00 – 16.00",count:9,capacity:25,mine:false },
  { id:5,time:"16.00 – 18.00",count:18,capacity:25,mine:true },
  { id:6,time:"18.00 – 20.00",count:25,capacity:25,mine:false },
  { id:7,time:"20.00 – 22.00",count:16,capacity:25,mine:false },
];

export default function MobileAppPreview(){
  const [loggedIn,setLoggedIn]=useState(false);
  const [tc,setTc]=useState(""); const [password,setPassword]=useState(""); const [show,setShow]=useState(false);
  const [error,setError]=useState(""); const [tab,setTab]=useState<"home"|"appointments"|"profile">("home");
  const [slots,setSlots]=useState(initialSlots); const [qr,setQr]=useState(false); const [entered,setEntered]=useState(false);
  function login(e:React.FormEvent){e.preventDefault();if(tc.length!==11||password.length<6){setError("TC kimlik numarası 11 hane, şifre en az 6 karakter olmalıdır.");return;}setLoggedIn(true);setError("");}
  function reserve(id:number){setSlots(s=>s.map(x=>x.id===id?{...x,mine:!x.mine,count:x.count+(x.mine?-1:1)}:{...x,mine:false,count:x.mine?x.count-1:x.count}));}
  if(!loggedIn)return <div className="mobile-preview login-scene"><div className="athlete-shape a1"/><div className="athlete-shape a2"/><div className="login-card"><div className="mobile-brand"><b>FİT</b><i>N</i><strong>STOP</strong></div><div className="login-copy"><span>ÜYE GİRİŞİ</span><h1>Bugünkü antrenmanın<br/>burada başlıyor.</h1><p>Randevunu oluştur, salon girişini QR kod ile tamamla.</p></div><form onSubmit={login}><label>TC Kimlik Numarası<input inputMode="numeric" maxLength={11} value={tc} onChange={e=>setTc(e.target.value.replace(/\D/g,""))} placeholder="11 haneli TC kimlik numarası"/></label><label>Şifre<div className="password-field"><input type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Geçici veya kişisel şifreniz"/><button type="button" onClick={()=>setShow(!show)}>{show?<EyeOff/>:<Eye/>}</button></div></label>{error&&<div className="mobile-error">{error}</div>}<button className="login-button">Giriş Yap <ChevronRight/></button><small>İlk giriş şifrenizi salon yönetiminden alabilirsiniz.</small></form></div></div>;

  return <div className="mobile-preview app-scene"><div className="phone-app">
    <header className="mobile-header"><div className="mini-brand"><b>FİT</b><i>N</i><strong>STOP</strong></div><button onClick={()=>setLoggedIn(false)}><LogOut/></button></header>
    <main className="mobile-content">
      {tab==="home"&&<><section className="member-hero"><div className="hero-silhouette"/><span>İYİ AKŞAMLAR</span><h1>Mehmet Yılmaz</h1><p><ShieldCheck/> Aktif Üye</p><div className="membership-dates"><div><small>Başlangıç</small><strong>01 Eyl 2026</strong></div><i/><div><small>Bitiş</small><strong>01 Mar 2027</strong></div></div></section>
      <section className="today-card"><div className="section-line"><div><span>BUGÜN</span><h2>Randevun</h2></div><CalendarDays/></div><div className="appointment-row"><div className="date-box"><b>29</b><small>EYL</small></div><div><strong>16.00 – 18.00</strong><span>18 / 25 kişi katılıyor</span></div><button onClick={()=>setTab("appointments")}><ChevronRight/></button></div></section>
      <button className="qr-main" onClick={()=>setQr(true)} disabled={entered}><span><QrCode/></span><div><small>{entered?"GİRİŞ TAMAMLANDI":"SALONA GİRİŞ"}</small><strong>{entered?"Bugünkü girişin kaydedildi":"QR Kodu Okut"}</strong></div><ChevronRight/></button>
      <div className="rule-note"><Clock3/><p>QR kod yalnızca randevu saatinde çalışır. Her üye günde bir kez giriş yapabilir.</p></div></>}
      {tab==="appointments"&&<section className="slots-screen"><div className="screen-title"><span>RANDEVU</span><h1>Saatini seç</h1><p>30 Eylül Çarşamba</p></div><div className="slot-list">{slots.map(s=><article key={s.id} className={`${s.mine?"selected":""} ${s.count>=s.capacity?"full":""}`}><div><Clock3/><span><strong>{s.time}</strong><small>{s.count} / {s.capacity} kişi</small></span></div><div className="capacity"><i style={{width:`${s.count/s.capacity*100}%`}}/></div><button disabled={!s.mine&&s.count>=s.capacity} onClick={()=>reserve(s.id)}>{s.mine?"İptal Et":s.count>=s.capacity?"Dolu":"Randevu Al"}</button></article>)}</div><p className="one-booking"><ShieldCheck/> Aynı gün yalnızca bir randevu oluşturabilirsiniz.</p></section>}
      {tab==="profile"&&<section className="profile-screen"><div className="profile-avatar">MY</div><h1>Mehmet Yılmaz</h1><span>Aktif Üye</span><div className="profile-list"><div><small>TC Kimlik Numarası</small><strong>*******1234</strong></div><div><small>Telefon</small><strong>05** *** ** 42</strong></div><div><small>Üyelik Başlangıcı</small><strong>01 Eylül 2026</strong></div><div><small>Üyelik Bitişi</small><strong>01 Mart 2027</strong></div></div><button>Şifremi Değiştir</button></section>}
    </main>
    <nav className="bottom-nav"><button className={tab==="home"?"active":""} onClick={()=>setTab("home")}><Home/><span>Ana Sayfa</span></button><button className={tab==="appointments"?"active":""} onClick={()=>setTab("appointments")}><CalendarDays/><span>Randevu</span></button><button className="scan-fab" onClick={()=>setQr(true)}><QrCode/></button><button className={tab==="profile"?"active":""} onClick={()=>setTab("profile")}><UserRound/><span>Profilim</span></button><button onClick={()=>setTab("home")}><Dumbbell/><span>Salon</span></button></nav>
    {qr&&<div className="qr-sheet"><button className="close-qr" onClick={()=>setQr(false)}><X/></button>{entered?<div className="qr-success"><div><Check/></div><span>GİRİŞ BAŞARILI</span><h2>İyi antrenmanlar!</h2><p>Bugünkü salon girişin saat 17.08’de kaydedildi.</p><button onClick={()=>setQr(false)}>Ana Sayfaya Dön</button></div>:<div className="scanner"><span>QR KODU OKUT</span><h2>Telefonunu girişteki<br/>QR koda doğrult</h2><div className="camera-box"><div className="scan-corners"/><QrCode/></div><p>Randevu: Bugün, 16.00 – 18.00</p><button onClick={()=>{setEntered(true);setTimeout(()=>{},300)}}>Demo QR Kodunu Okut</button></div>}</div>}
  </div></div>;
}
