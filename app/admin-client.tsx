"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";
import { Activity, AlertTriangle, CalendarDays, Check, ChevronDown, CircleUserRound, Clock3, Dumbbell, KeyRound, LayoutDashboard, LogIn, Menu, MoreHorizontal, Pencil, Plus, RotateCcw, Search, Settings, Snowflake, Trash2, UserRoundCheck, Users, X } from "lucide-react";

type Status = "active" | "frozen" | "cancelled";
type Reservation = { id:number; memberId:number; date:string; timeSlot:string; createdAt:string };
type Attendance = { id:number; memberId:number; date:string; checkedInAt:string; reservationTimeSlot:string };
type Member = { id: number; fullName: string; phone: string; email: string | null; startDate: string; endDate: string; status: Status; notes: string; createdAt: string; updatedAt: string; tcLast4?: string|null; hasPassword?: boolean; reservations:Reservation[]; attendances:Attendance[]; visitCount:number };
type GymInfo = { about:string; address:string; trainerName:string; phone:string };
const emptyGymInfo:GymInfo = { about:"", address:"", trainerName:"", phone:"" };
const emptyForm = { fullName: "", phone: "", email: "", startDate: new Date().toISOString().slice(0, 10), endDate: "", status: "active" as Status, notes: "", tcNo:"", password:"" };
const nav = [
  { label: "Genel Bakış", icon: LayoutDashboard, view:"dashboard" },
  { label: "Üyeler", icon: Users, view:"members" },
  { label: "Randevular", icon: CalendarDays, view:"reservations" },
  { label: "Ayarlar", icon: Settings, view:"settings" },
];

function dateTR(value: string) { return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)); }
function daysUntil(value: string) { const today = new Date(); today.setHours(0, 0, 0, 0); return Math.ceil((new Date(`${value}T00:00:00`).getTime() - today.getTime()) / 86400000); }
function effectiveStatus(member: Member) { if (member.status !== "active") return member.status; return daysUntil(member.endDate) < 0 ? "expired" : daysUntil(member.endDate) <= 7 ? "expiring" : "active"; }

export default function Home() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [toast, setToast] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [view,setView]=useState<"dashboard"|"members"|"reservations"|"settings">("dashboard");
  const [detail,setDetail]=useState<Member|null>(null);
  const [slotDetail,setSlotDetail]=useState<{time:string;date:string}|null>(null);
  const [oneTimePassword,setOneTimePassword]=useState<{name:string;password:string}|null>(null);
  const [gymModal,setGymModal]=useState(false);

  async function load(silent=false) {
    if(!silent)setLoading(true); if(!silent)setError("");
    try { const response = await fetch("/api/members"); const data:any = await response.json(); if (!response.ok) throw new Error(data.error); setMembers(data.members); }
    catch (e) { setError(e instanceof Error ? e.message : "Üyeler yüklenemedi."); }
    finally { if(!silent)setLoading(false); }
  }
  useEffect(() => { load(); let active=true,cleanup=()=>{};fetch("/api/public-config").then(r=>r.json()).then((config:any)=>{if(!active||!config.url||!config.key)return;const client=createClient(config.url,config.key);const channel=client.channel("gym-updates").on("broadcast",{event:"changed"},(event:any)=>{if(event.payload?.table==="reservations"||event.payload?.table==="attendances")void load(true)}).subscribe();cleanup=()=>{client.removeChannel(channel);};}).catch(()=>{});const onFocus=()=>{if(document.visibilityState==="visible")void load(true)};window.addEventListener("focus",onFocus);return()=>{active=false;cleanup();window.removeEventListener("focus",onFocus)}; }, []);

  const stats = useMemo(() => ({
    total: members.length,
    active: members.filter((m) => ["active", "expiring"].includes(effectiveStatus(m))).length,
    expiring: members.filter((m) => effectiveStatus(m) === "expiring").length,
    frozen: members.filter((m) => effectiveStatus(m) === "frozen").length,
  }), [members]);

  const shown = useMemo(() => members.filter((m) => {
    const matchesText = `${m.fullName} ${m.phone} ${m.email ?? ""}`.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr"));
    return matchesText && (filter === "all" || effectiveStatus(m) === filter);
  }), [members, query, filter]);

  function openNew() { setEditing(null); setForm(emptyForm); setModal(true); }
  function openEdit(member: Member) { setEditing(member); setForm({ fullName: member.fullName, phone: member.phone, email: member.email ?? "", startDate: member.startDate, endDate: member.endDate, status: member.status, notes: member.notes, tcNo:"", password:"" }); setModal(true); }
  function editFromDetail(member:Member){setDetail(null);setSlotDetail(null);openEdit(member)}
  function flash(text: string) { setToast(text); window.setTimeout(() => setToast(""), 2800); }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/members", { method: editing ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(editing ? { id: editing.id, ...form } : form) });
      const data:any = await response.json(); if (!response.ok) throw new Error(data.error);
      await load(true);
      setModal(false); flash(editing ? "Üye bilgileri güncellendi." : "Yeni üye başarıyla eklendi.");
    } catch (e) { setError(e instanceof Error ? e.message : "İşlem tamamlanamadı."); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!deleteTarget) return;
    try { const response = await fetch(`/api/members?id=${deleteTarget.id}`, { method: "DELETE" }); const data:any = await response.json(); if (!response.ok) throw new Error(data.error); setMembers((current) => current.filter((m) => m.id !== deleteTarget.id)); setDeleteTarget(null); flash("Üye kaydı silindi."); }
    catch (e) { setError(e instanceof Error ? e.message : "Üye silinemedi."); }
  }
  async function resetPassword(member:Member){
    try{const response=await fetch("/api/members/reset-password",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:member.id})});const data:any=await response.json();if(!response.ok)throw new Error(data.error);setOneTimePassword({name:member.fullName,password:data.password});}
    catch(e){setError(e instanceof Error?e.message:"Şifre sıfırlanamadı.");}
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
      <div className="brand"><span className="brand-fit">FİT</span><span className="brand-n">N</span><span>STOP</span></div>
      <div className="branch-pill"><span className="live-dot" /> Merkez Şube <ChevronDown size={15} /></div>
      <nav>{nav.map((item) => <button key={item.label} onClick={()=>{if(item.view)setView(item.view as typeof view);setMobileNav(false)}} className={item.view===view ? "active" : ""}><item.icon size={19} /><span>{item.label}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="admin-avatar">EB</div><div><strong>Emre Balcan</strong><span>Yönetici</span></div><button className="sidebar-more" onClick={()=>setGymModal(true)} aria-label="Salon bilgilerini düzenle"><MoreHorizontal size={20}/></button></div>
    </aside>

    <main>
      <header className="topbar"><button className="menu-button" onClick={() => setMobileNav(!mobileNav)} aria-label="Menü"><Menu /></button><div><span>30 Eylül 2026, Çarşamba</span><h1>{{dashboard:"Genel Bakış",members:"Üye Yönetimi",reservations:"Randevular",settings:"Ayarlar"}[view]}</h1></div><div className="top-actions"><button className="profile-button"><CircleUserRound size={20} /> Yönetici</button>{view==="members"&&<button className="add-button" onClick={openNew}><Plus size={19} /> Yeni Üye</button>}</div></header>
      <section className="content">
       {view==="dashboard"?<DashboardWithQr members={members} onSlot={setSlotDetail}/>:view==="reservations"?<ReservationsView members={members} onMember={setDetail}/>:view==="settings"?<SettingsView/>:<>
        <div className="welcome"><div><p>İyi akşamlar, Emre</p><h2>Salondaki üyelik hareketleri burada.</h2></div><div className="system-ok"><Check size={16} /><span><strong>Sistem aktif</strong> Veriler güncel</span></div></div>
        <div className="stats-grid">
          <article><div className="stat-icon green"><Users /></div><div><span>Toplam Üye</span><strong>{stats.total}</strong><small>Tüm kayıtlar</small></div></article>
          <article><div className="stat-icon black"><UserRoundCheck /></div><div><span>Aktif Üye</span><strong>{stats.active}</strong><small>Devam eden üyelik</small></div></article>
          <article><div className="stat-icon amber"><Clock3 /></div><div><span>Süresi Yaklaşan</span><strong>{stats.expiring}</strong><small>Son 7 gün</small></div></article>
          <article><div className="stat-icon blue"><Snowflake /></div><div><span>Dondurulan</span><strong>{stats.frozen}</strong><small>Geçici olarak pasif</small></div></article>
        </div>
        <section className="member-card">
          <div className="card-title"><div><h3>Üyeler</h3><p>Üyeleri, iletişim bilgilerini ve üyelik sürelerini yönetin.</p></div><span>{shown.length} kayıt</span></div>
          <div className="toolbar"><label className="search"><Search size={19}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ad, telefon veya e-posta ara" /></label><select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Tüm durumlar</option><option value="active">Aktif</option><option value="expiring">Süresi yaklaşan</option><option value="expired">Süresi dolmuş</option><option value="frozen">Dondurulmuş</option><option value="cancelled">İptal edilmiş</option></select></div>
          {error && <div className="error-banner">{error}<button onClick={() => setError("")}><X size={17}/></button></div>}
          <div className="table-wrap"><table><thead><tr><th>Üye</th><th>İletişim</th><th>Üyelik Başlangıcı</th><th>Bitiş Tarihi</th><th>Durum</th><th aria-label="İşlemler" /></tr></thead><tbody>
            {loading ? <tr><td colSpan={6}><div className="loading"><Activity className="spin"/> Üyeler yükleniyor...</div></td></tr> : shown.length === 0 ? <tr><td colSpan={6}><div className="empty"><div><Dumbbell/></div><h4>{members.length ? "Aramana uygun üye bulunamadı" : "Henüz üye eklenmedi"}</h4><p>{members.length ? "Arama veya filtre seçimini değiştirebilirsin." : "İlk üye kaydını oluşturarak başlayabilirsin."}</p>{!members.length && <button onClick={openNew}><Plus size={17}/> İlk üyeyi ekle</button>}</div></td></tr> : shown.map((member) => <MemberRow key={member.id} member={member} onEdit={() => openEdit(member)} onDelete={() => setDeleteTarget(member)} onReset={()=>resetPassword(member)} onDetail={()=>setDetail(member)} />)}
          </tbody></table></div>
        </section></>}
      </section>
    </main>
    {modal && <MemberModal editing={editing} form={form} setForm={setForm} saving={saving} onClose={() => setModal(false)} onSubmit={save} />}
    {deleteTarget && <div className="modal-backdrop"><div className="confirm-modal"><div className="danger-icon"><Trash2/></div><h3>Üyeyi silmek istiyor musun?</h3><p><strong>{deleteTarget.fullName}</strong> adlı üyenin kaydı kalıcı olarak silinecek.</p><div><button className="secondary" onClick={() => setDeleteTarget(null)}>Vazgeç</button><button className="danger" onClick={remove}>Üyeyi Sil</button></div></div></div>}
    {oneTimePassword&&<div className="modal-backdrop"><div className="password-result"><KeyRound/><span>TEK KULLANIMLIK ŞİFRE</span><h3>{oneTimePassword.name}</h3><code>{oneTimePassword.password}</code><p>Bu şifre yalnızca şimdi gösterilir. Üye ilk girişinde yeni şifre belirlemelidir.</p><button className="primary" onClick={()=>setOneTimePassword(null)}>Tamam</button></div></div>}
    {slotDetail&&<ExpandableSlotModal time={slotDetail.time} date={slotDetail.date} members={members} onClose={()=>setSlotDetail(null)} onMember={setDetail}/>} 
    {detail&&<MemberDetail data={detail} onClose={()=>setDetail(null)} onEdit={()=>editFromDetail(detail)}/>} 
    {gymModal&&<GymInfoModal onClose={()=>setGymModal(false)} onSaved={()=>flash("Salon bilgileri kaydedildi.")}/>}
    {toast && <div className="toast"><Check size={18}/>{toast}</div>}
  </div>;
}

function MemberRow({ member, onEdit, onDelete,onReset,onDetail }: { member: Member; onEdit: () => void; onDelete: () => void; onReset:()=>void; onDetail:()=>void }) {
  const state = effectiveStatus(member);
  const labels: Record<string, string> = { active: "Aktif", expiring: "Süresi yaklaşıyor", expired: "Süresi doldu", frozen: "Donduruldu", cancelled: "İptal edildi" };
  return <tr onClick={onDetail}><td><div className="member-name"><div>{member.fullName.split(" ").map((x) => x[0]).join("").slice(0,2).toLocaleUpperCase("tr")}</div><span><strong>{member.fullName}</strong><small>Üye #{String(member.id).padStart(4,"0")} · TC •••• {member.tcLast4||"—"}</small></span></div></td><td><div className="contact"><span>{member.phone}</span><small>{member.email || "E-posta eklenmedi"}</small></div></td><td>{dateTR(member.startDate)}</td><td><div className="end-date"><span>{dateTR(member.endDate)}</span>{state === "expiring" && <small>{daysUntil(member.endDate)} gün kaldı</small>}</div></td><td><span className={`status ${state}`}><i/>{labels[state]}</span></td><td><div className="row-actions"><button onClick={e=>{e.stopPropagation();onReset()}} title="Şifreyi sıfırla"><RotateCcw size={17}/></button><button onClick={e=>{e.stopPropagation();onEdit()}} title="Düzenle"><Pencil size={17}/></button><button onClick={e=>{e.stopPropagation();onDelete()}} title="Sil" className="delete"><Trash2 size={17}/></button></div></td></tr>;
}

function MemberModal({ editing, form, setForm, saving, onClose, onSubmit }: { editing: Member | null; form: typeof emptyForm; setForm: (value: typeof emptyForm) => void; saving: boolean; onClose: () => void; onSubmit: (e: FormEvent) => void }) {
  const update = (key: keyof typeof form, value: string) => setForm({ ...form, [key]: value });
  return <div className="modal-backdrop"><form className="member-modal" onSubmit={onSubmit}><div className="modal-head"><div><span>{editing ? "ÜYE DÜZENLE" : "YENİ ÜYE"}</span><h3>{editing ? editing.fullName : "Üye bilgilerini girin"}</h3></div><button type="button" onClick={onClose}><X/></button></div><div className="form-grid"><label className="span-2">Ad Soyad <input required value={form.fullName} onChange={(e)=>update("fullName",e.target.value)} placeholder="Örn. Ayşe Yılmaz"/></label>{!editing&&<><label>TC Kimlik Numarası <input required inputMode="numeric" maxLength={11} value={form.tcNo} onChange={(e)=>update("tcNo",e.target.value.replace(/\D/g,""))} placeholder="11 haneli TC"/></label><label>Geçici Şifre <input required minLength={6} value={form.password} onChange={(e)=>update("password",e.target.value)} placeholder="En az 6 karakter"/></label></>}<label>Telefon <input required value={form.phone} onChange={(e)=>update("phone",e.target.value)} placeholder="05__ ___ __ __"/></label><label>E-posta <input type="email" value={form.email} onChange={(e)=>update("email",e.target.value)} placeholder="uye@email.com"/></label><label>Başlangıç Tarihi <input required type="date" value={form.startDate} onChange={(e)=>update("startDate",e.target.value)}/></label><label>Bitiş Tarihi <input required type="date" min={form.startDate} value={form.endDate} onChange={(e)=>update("endDate",e.target.value)}/></label><label className="span-2">Üyelik Durumu <select value={form.status} onChange={(e)=>update("status",e.target.value)}><option value="active">Aktif</option><option value="frozen">Dondurulmuş</option><option value="cancelled">İptal edilmiş</option></select></label><label className="span-2">Notlar <textarea value={form.notes} onChange={(e)=>update("notes",e.target.value)} placeholder="Sağlık notu, özel bilgi veya hatırlatma..." rows={3}/></label></div><div className="modal-footer"><button type="button" className="secondary" onClick={onClose}>Vazgeç</button><button type="submit" className="primary" disabled={saving}>{saving ? "Kaydediliyor..." : editing ? "Değişiklikleri Kaydet" : "Üyeyi Kaydet"}</button></div></form></div>;
}

const appointmentTimes=["06.00 – 08.00","08.00 – 10.00","10.00 – 12.00","12.00 – 14.00","14.00 – 16.00","16.00 – 18.00","18.00 – 20.00","20.00 – 22.00"];
const currentDate=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Istanbul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
function Dashboard({members,onSlot}:{members:Member[];onSlot:(v:{time:string;date:string})=>void}){const today=currentDate();const [date,setDate]=useState(today);const hour=Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Istanbul",hour:"2-digit",hourCycle:"h23"}).format(new Date()));const entries=members.flatMap(member=>(member.attendances||[]).filter(a=>a.date===date).map(attendance=>({member,attendance}))).sort((a,b)=>b.attendance.checkedInAt.localeCompare(a.attendance.checkedInAt));return <><div className="welcome"><div><p>İyi akşamlar, Emre</p><h2>{date===today?"Bugünkü":"Seçilen günün"} salon hareketleri.</h2></div><div className="system-ok"><Check size={16}/><span><strong>Canlı takip açık</strong> Randevular sessizce yenileniyor</span></div></div><section className="activity-card"><div className="dash-head"><div><span>GİRİŞ AKIŞI</span><h3>{date===today?"Son Giriş Hareketleri":"Giriş Kayıtları"}</h3></div><small>{entries.length} giriş</small></div>{entries.length?<div className="movement-list">{entries.map(({member,attendance})=><button key={attendance.id} className="movement-ok"><div className="move-icon"><LogIn/></div><div className="move-main"><strong>{member.fullName}</strong><span>Salona giriş yaptı</span></div><div className="move-meta"><strong>{attendance.checkedInAt.slice(0,5)}</strong><span>Randevu: {attendance.reservationTimeSlot}</span></div><span className="info-link">Kayıtlı giriş</span></button>)}</div>:<div className="empty-live"><LogIn/><strong>Henüz giriş kaydı yok</strong><span>QR ile giriş yapan üyeler burada görünecek.</span></div>}</section><section className="hour-section"><div className="dash-head"><div><span>{date===today?"BUGÜN":"SEÇİLEN TARİH"} · {dateTR(date).toLocaleUpperCase("tr")}</span><h3>Randevu Dolulukları</h3></div><label className="dashboard-date"><CalendarDays/> Tarih seç<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></div><div className="hour-grid">{appointmentTimes.map(time=>{const count=members.filter(member=>member.reservations?.some(r=>r.date===date&&r.timeSlot===time)).length;const entered=members.filter(member=>member.attendances?.some(a=>a.date===date&&a.reservationTimeSlot===time)).length;const start=Number(time.slice(0,2));const current=date===today&&hour>=start&&hour<start+2;return <button key={time} className={current?"current":""} onClick={()=>onSlot({time,date})}><div><Clock3/><strong>{time}</strong></div><div className="hour-numbers"><span><b>{count}</b> Randevu</span><span><b>{entered}</b> Giriş</span></div><div className="occupancy"><i style={{width:`${count/25*100}%`}}/></div>{current&&<em>ŞİMDİ</em>}</button>})}</div></section></>}
function SlotModal({time,date,members,onClose,onMember}:{time:string;date:string;members:Member[];onClose:()=>void;onMember:(v:Member)=>void}){const people=members.filter(member=>member.reservations?.some(r=>r.date===date&&r.timeSlot===time));const entered=people.filter(person=>person.attendances?.some(a=>a.date===date&&a.reservationTimeSlot===time));return <div className="modal-backdrop"><div className="slot-modal"><div className="modal-head"><div><span>RANDEVU DETAYI · {dateTR(date)}</span><h3>{time}</h3></div><button onClick={onClose}><X/></button></div><div className="slot-summary"><div><b>{people.length}</b><span>Randevu aldı</span></div><div><b>{entered.length}</b><span>Giriş yaptı</span></div><div><b>{people.length-entered.length}</b><span>Henüz gelmedi</span></div></div><div className="slot-people">{people.length?people.map(person=>{const visit=person.attendances?.find(a=>a.date===date);return <button key={person.id} onClick={()=>onMember(person)}><div>{person.fullName.split(" ").map(x=>x[0]).join("").slice(0,2)}</div><span><strong>{person.fullName}</strong><small>{visit?`Giriş yaptı · ${visit.checkedInAt.slice(0,5)}`:"Henüz giriş yapmadı"}</small></span><em>Üye bilgileri</em></button>}):<div className="empty-slot">Bu seansa henüz randevu alınmadı.</div>}</div></div></div>}
function MemberDetail({data,onClose,onEdit}:{data:Member;onClose:()=>void;onEdit:()=>void}){return <div className="modal-backdrop"><div className="detail-modal"><div className="modal-head"><div><span>ÜYE BİLGİLERİ</span><h3>{data.fullName}</h3></div><button onClick={onClose}><X/></button></div><div className="detail-profile"><div>{data.fullName.split(" ").map(x=>x[0]).join("").slice(0,2)}</div><span><strong>{data.status==="active"?"Aktif Üye":"Üyelik Pasif"}</strong><small>Üye #{String(data.id).padStart(4,"0")} · TC •••• {data.tcLast4||"—"}</small></span><aside className="visit-total"><b>{data.visitCount||0}</b><small>TOPLAM GELİŞ</small></aside></div><div className="detail-facts"><div><small>Telefon</small><strong>{data.phone}</strong></div><div><small>E-posta</small><strong>{data.email||"Eklenmedi"}</strong></div><div><small>Üyelik Başlangıcı</small><strong>{dateTR(data.startDate)}</strong></div><div><small>Üyelik Bitişi</small><strong>{dateTR(data.endDate)}</strong></div></div><div className="visit-history"><h4>Randevuları</h4>{data.reservations?.length?data.reservations.map(r=><div key={r.id}><span><i/>{dateTR(r.date)}</span><em>{r.timeSlot}</em></div>):<div className="empty-slot">Henüz randevu kaydı yok.</div>}</div><div className="detail-actions"><button className="primary" onClick={onEdit}><Pencil size={16}/> Bilgileri Güncelle</button></div></div></div>}

function GymInfoModal({onClose,onSaved}:{onClose:()=>void;onSaved:()=>void}){
  const [info,setInfo]=useState<GymInfo>(emptyGymInfo),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{let live=true;fetch("/api/gym-info",{cache:"no-store"}).then(async response=>{const data=await response.json() as {error?:string;gym:GymInfo};if(!response.ok)throw new Error(data.error);return data.gym}).then(gym=>{if(live)setInfo(gym)}).catch(err=>{if(live)setError(err instanceof Error?err.message:"Salon bilgileri yüklenemedi.")});return()=>{live=false}},[]);
  async function saveInfo(event:FormEvent){event.preventDefault();setBusy(true);setError("");try{const response=await fetch("/api/gym-info",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(info)});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error);onClose();onSaved()}catch(err){setError(err instanceof Error?err.message:"Salon bilgileri kaydedilemedi.")}finally{setBusy(false)}}
  return <div className="modal-backdrop"><form className="member-modal gym-info-modal" onSubmit={saveInfo}><div className="modal-head"><div><span>SALON BİLGİLERİ</span><h3>Üyelerin göreceği bilgiler</h3></div><button type="button" onClick={onClose} aria-label="Kapat"><X/></button></div><div className="form-grid"><label className="span-2">Salon hakkında kısa bilgi<textarea maxLength={500} rows={4} value={info.about} onChange={event=>setInfo({...info,about:event.target.value})} placeholder="Salonu birkaç cümleyle tanıtın"/></label><label className="span-2">Salon adresi<textarea maxLength={300} rows={2} value={info.address} onChange={event=>setInfo({...info,address:event.target.value})} placeholder="Açık adres"/></label><label>Eğitmenin adı<input maxLength={100} value={info.trainerName} onChange={event=>setInfo({...info,trainerName:event.target.value})} placeholder="Ad soyad"/></label><label>Telefon numarası<input type="tel" maxLength={40} value={info.phone} onChange={event=>setInfo({...info,phone:event.target.value})} placeholder="05__ ___ __ __"/></label>{error&&<div className="span-2 gym-info-error">{error}</div>}</div><div className="modal-footer"><button type="button" className="secondary" onClick={onClose}>Vazgeç</button><button type="submit" className="primary" disabled={busy}>{busy?"Kaydediliyor...":"Bilgileri Kaydet"}</button></div></form></div>
}

function QrPanel(){
  const [mode,setMode]=useState<"app"|"entry"|"exit">("app");const [entryToken,setEntryToken]=useState("FITNSTOP-GIRIS-2026");const [exitToken,setExitToken]=useState("FITNSTOP-CIKIS-2026");const [image,setImage]=useState("");
  useEffect(()=>{fetch("/api/settings").then(r=>r.json()).then((d:any)=>{setEntryToken(d.entryQrToken);setExitToken(d.exitQrToken)}).catch(()=>{});},[]);
  const value=mode==="app"?"https://fit-n-stop-admin.emrebalcan494.chatgpt.site/fit-n-stop-v1.6.apk":mode==="exit"?`FITNSTOP-CIKIS:${exitToken}`:`FITNSTOP-GIRIS:${entryToken}`;
  useEffect(()=>{QRCode.toDataURL(value,{width:520,margin:2,color:{dark:"#111411",light:"#ffffff"}}).then(setImage);},[value]);
  async function refresh(){const r=await fetch(`/api/settings?mode=${mode}`,{method:"PUT"});const d:any=await r.json();if(mode==="exit")setExitToken(d.exitQrToken);else setEntryToken(d.entryQrToken);}
  function printPdf(){const popup=window.open("","_blank","width=700,height=800");if(!popup||!image)return;const label=mode==="app"?"Android uygulamasını indir":mode==="exit"?"Salondan çıkış QR kodu":"Salona giriş QR kodu";popup.document.write(`<html><head><title>FİT N STOP QR</title><style>body{font-family:Arial;text-align:center;padding:35px}img{width:480px;max-width:90%}h1{margin-bottom:5px}p{color:#555}</style></head><body><h1>FİT N STOP</h1><p>${label}</p><img src="${image}"><script>onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`);popup.document.close();}
  return <section className="qr-admin-card"><div className="qr-switch"><button className={mode==="entry"?"active":""} onClick={()=>setMode("entry")}>Giriş QR</button><button className={mode==="exit"?"active":""} onClick={()=>setMode("exit")}>Çıkış QR</button><button className={mode==="app"?"active":""} onClick={()=>setMode("app")}>Uygulama QR</button></div>{image&&<img src={image} alt="QR kod"/>}<strong>{mode==="app"?"Android Uygulamasını İndir":mode==="exit"?"Salondan Çıkış":"Salona Giriş"}</strong><small>{mode==="app"?"Üyeler Android telefonla bu kodu okutarak APK dosyasını indirebilir.":mode==="exit"?"Üyeler çıkarken bu kodu okutarak ziyaret süresini tamamlar.":"Bu kodu salon girişine asabilirsiniz."}</small><div className="qr-actions">{mode!=="app"?<button onClick={refresh}><RotateCcw/> QR’ı Yenile</button>:<a href="/fit-n-stop-v1.6.apk" download>APK İndir</a>}<button onClick={printPdf}><CalendarDays/> PDF Kaydet</button></div></section>;
}
function DashboardWithQr({members,onSlot}:{members:Member[];onSlot:(v:{time:string;date:string})=>void}){return <div className="dashboard-with-qr"><div className="dashboard-qr"><QrPanel/></div><Dashboard members={members} onSlot={onSlot}/></div>}
function ReservationsView({members,onMember}:{members:Member[];onMember:(member:Member)=>void}){
  const [date,setDate]=useState("");
  const allRows=members.flatMap(member=>(member.reservations||[]).map(reservation=>({member,reservation}))).sort((a,b)=>a.reservation.date.localeCompare(b.reservation.date)||a.reservation.timeSlot.localeCompare(b.reservation.timeSlot));
  const rows=date?allRows.filter(({reservation})=>reservation.date===date):allRows;
  return <section className="member-card reservations-view"><div className="card-title"><div><h3>Tüm Randevular</h3><p>Tarih, seans ve üye bazında güncel kayıtlar.</p></div><span>{rows.length} kayıt</span></div><div className="reservation-filter"><label><CalendarDays size={18}/><span>Takvimden gün seç</span><input type="date" value={date} onChange={event=>setDate(event.target.value)}/></label>{date&&<button onClick={()=>setDate("")}>Tüm tarihleri göster</button>}</div><div className="table-wrap"><table><thead><tr><th>Tarih</th><th>Seans</th><th>Üye</th><th>Telefon</th><th>Durum</th></tr></thead><tbody>{rows.length?rows.map(({member,reservation})=><tr key={reservation.id}><td>{dateTR(reservation.date)}</td><td><strong>{reservation.timeSlot}</strong></td><td><button className="reservation-member-link" onClick={()=>onMember(member)}>{member.fullName}</button></td><td>{member.phone}</td><td><span className="status active"><i/>Randevulu</span></td></tr>):<tr><td colSpan={5}><div className="empty-slot">{date?"Seçilen gün için randevu yok.":"Henüz randevu kaydı yok."}</div></td></tr>}</tbody></table></div></section>
}
function SettingsView(){const [days,setDays]=useState<Array<{date:string;reason:string}>>([]);const [date,setDate]=useState(currentDate());const [reason,setReason]=useState("Salon kapalı");const load=()=>fetch("/api/closed-days").then(r=>r.json()).then((d:any)=>setDays(d.closedDays||[]));useEffect(()=>{load();},[]);async function closeDay(e:FormEvent){e.preventDefault();await fetch("/api/closed-days",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({date,reason})});await load();}async function openDay(value:string){await fetch(`/api/closed-days?date=${value}`,{method:"DELETE"});await load();}return <div className="settings-grid"><section className="settings-card"><div className="card-title"><div><h3>Salon Takvimi</h3><p>Kapalı günleri belirleyin. O güne ait randevular otomatik iptal edilir.</p></div></div><form className="closure-form" onSubmit={closeDay}><label>Tarih<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Açıklama<input value={reason} onChange={e=>setReason(e.target.value)}/></label><button className="danger">Salonu Kapalı İşaretle</button></form><div className="closed-list"><h4>Kapalı Günler</h4>{days.length?days.map(day=><div key={day.date}><span><strong>{dateTR(day.date)}</strong><small>{day.reason}</small></span><button onClick={()=>openDay(day.date)}>Yeniden aç</button></div>):<p>Henüz kapalı gün belirlenmedi.</p>}</div></section><QrPanel/></div>}
function ExpandableSlotModal({time,date,members,onClose,onMember}:{time:string;date:string;members:Member[];onClose:()=>void;onMember:(v:Member)=>void}){const [expanded,setExpanded]=useState(false);const people=members.filter(member=>member.reservations?.some(r=>r.date===date&&r.timeSlot===time));const entered=people.filter(person=>person.attendances?.some(a=>a.date===date&&a.reservationTimeSlot===time));const shown=expanded?people:people.slice(0,5);return <div className="modal-backdrop"><div className="slot-modal"><div className="modal-head"><div><span>RANDEVU DETAYI · {dateTR(date)}</span><h3>{time}</h3></div><button onClick={onClose}><X/></button></div><div className="slot-summary"><div><b>{people.length}</b><span>Randevu aldı</span></div><div><b>{entered.length}</b><span>Giriş yaptı</span></div><div><b>{people.length-entered.length}</b><span>Henüz gelmedi</span></div></div><div className="slot-people">{shown.length?shown.map(person=>{const visit=person.attendances?.find(a=>a.date===date);return <button key={person.id} onClick={()=>onMember(person)}><div>{person.fullName.split(" ").map(x=>x[0]).join("").slice(0,2)}</div><span><strong>{person.fullName}</strong><small>{visit?`Giriş yaptı · ${visit.checkedInAt.slice(0,5)}`:"Henüz giriş yapmadı"}</small></span><em>Üye bilgileri</em></button>}):<div className="empty-slot">Bu seansa henüz randevu alınmadı.</div>}{people.length>5&&<button className="show-more" onClick={()=>setExpanded(!expanded)}>{expanded?"İlk 5 kişiyi göster":`+${people.length-5} kişi daha · Tümünü göster`}</button>}</div></div></div>}





