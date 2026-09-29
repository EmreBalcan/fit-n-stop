"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CalendarDays, Check, ChevronDown, CircleUserRound, Clock3, Dumbbell, KeyRound, LayoutDashboard, LogIn, Menu, MoreHorizontal, Pencil, Plus, RotateCcw, Search, Settings, Snowflake, Trash2, UserRoundCheck, Users, X } from "lucide-react";

type Status = "active" | "frozen" | "cancelled";
type Member = { id: number; fullName: string; phone: string; email: string | null; startDate: string; endDate: string; status: Status; notes: string; createdAt: string; updatedAt: string; tcLast4?: string|null; hasPassword?: boolean };
const emptyForm = { fullName: "", phone: "", email: "", startDate: new Date().toISOString().slice(0, 10), endDate: "", status: "active" as Status, notes: "", tcNo:"", password:"" };
const nav = [
  { label: "Genel Bakış", icon: LayoutDashboard, view:"dashboard" },
  { label: "Üyeler", icon: Users, view:"members" },
  { label: "Randevular", icon: CalendarDays, disabled: true, view:undefined },
  { label: "Ayarlar", icon: Settings, disabled: true, view:undefined },
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
  const [view,setView]=useState<"dashboard"|"members">("dashboard");
  const [detail,setDetail]=useState<{name:string;appointment?:string;warning?:boolean}|null>(null);
  const [slotDetail,setSlotDetail]=useState<string|null>(null);
  const [oneTimePassword,setOneTimePassword]=useState<{name:string;password:string}|null>(null);

  async function load() {
    setLoading(true); setError("");
    try { const response = await fetch("/api/members"); const data = await response.json(); if (!response.ok) throw new Error(data.error); setMembers(data.members); }
    catch (e) { setError(e instanceof Error ? e.message : "Üyeler yüklenemedi."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

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
  function flash(text: string) { setToast(text); window.setTimeout(() => setToast(""), 2800); }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/members", { method: editing ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(editing ? { id: editing.id, ...form } : form) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setMembers((current) => editing ? current.map((m) => m.id === editing.id ? data.member : m) : [data.member, ...current]);
      setModal(false); flash(editing ? "Üye bilgileri güncellendi." : "Yeni üye başarıyla eklendi.");
    } catch (e) { setError(e instanceof Error ? e.message : "İşlem tamamlanamadı."); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!deleteTarget) return;
    try { const response = await fetch(`/api/members?id=${deleteTarget.id}`, { method: "DELETE" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setMembers((current) => current.filter((m) => m.id !== deleteTarget.id)); setDeleteTarget(null); flash("Üye kaydı silindi."); }
    catch (e) { setError(e instanceof Error ? e.message : "Üye silinemedi."); }
  }
  async function resetPassword(member:Member){
    try{const response=await fetch("/api/members/reset-password",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:member.id})});const data=await response.json();if(!response.ok)throw new Error(data.error);setOneTimePassword({name:member.fullName,password:data.password});}
    catch(e){setError(e instanceof Error?e.message:"Şifre sıfırlanamadı.");}
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
      <div className="brand"><span className="brand-fit">FİT</span><span className="brand-n">N</span><span>STOP</span></div>
      <div className="branch-pill"><span className="live-dot" /> Merkez Şube <ChevronDown size={15} /></div>
      <nav>{nav.map((item) => <button key={item.label} onClick={()=>{if(item.view)setView(item.view as "dashboard"|"members");setMobileNav(false)}} className={`${item.view===view ? "active" : ""} ${item.disabled ? "disabled" : ""}`} title={item.disabled ? "Yakında" : undefined}><item.icon size={19} /><span>{item.label}</span>{item.disabled && <small>Yakında</small>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="admin-avatar">EB</div><div><strong>Emre Balcan</strong><span>Yönetici</span></div><MoreHorizontal size={20} /></div>
    </aside>

    <main>
      <header className="topbar"><button className="menu-button" onClick={() => setMobileNav(!mobileNav)} aria-label="Menü"><Menu /></button><div><span>29 Eylül 2026, Salı</span><h1>{view==="dashboard"?"Genel Bakış":"Üye Yönetimi"}</h1></div><div className="top-actions"><button className="profile-button"><CircleUserRound size={20} /> Yönetici</button>{view==="members"&&<button className="add-button" onClick={openNew}><Plus size={19} /> Yeni Üye</button>}</div></header>
      <section className="content">
       {view==="dashboard"?<Dashboard onSlot={setSlotDetail} onMember={setDetail}/>:<>
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
            {loading ? <tr><td colSpan={6}><div className="loading"><Activity className="spin"/> Üyeler yükleniyor...</div></td></tr> : shown.length === 0 ? <tr><td colSpan={6}><div className="empty"><div><Dumbbell/></div><h4>{members.length ? "Aramana uygun üye bulunamadı" : "Henüz üye eklenmedi"}</h4><p>{members.length ? "Arama veya filtre seçimini değiştirebilirsin." : "İlk üye kaydını oluşturarak başlayabilirsin."}</p>{!members.length && <button onClick={openNew}><Plus size={17}/> İlk üyeyi ekle</button>}</div></td></tr> : shown.map((member) => <MemberRow key={member.id} member={member} onEdit={() => openEdit(member)} onDelete={() => setDeleteTarget(member)} onReset={()=>resetPassword(member)} onDetail={()=>setDetail({name:member.fullName})} />)}
          </tbody></table></div>
        </section></>}
      </section>
    </main>
    {modal && <MemberModal editing={editing} form={form} setForm={setForm} saving={saving} onClose={() => setModal(false)} onSubmit={save} />}
    {deleteTarget && <div className="modal-backdrop"><div className="confirm-modal"><div className="danger-icon"><Trash2/></div><h3>Üyeyi silmek istiyor musun?</h3><p><strong>{deleteTarget.fullName}</strong> adlı üyenin kaydı kalıcı olarak silinecek.</p><div><button className="secondary" onClick={() => setDeleteTarget(null)}>Vazgeç</button><button className="danger" onClick={remove}>Üyeyi Sil</button></div></div></div>}
    {oneTimePassword&&<div className="modal-backdrop"><div className="password-result"><KeyRound/><span>TEK KULLANIMLIK ŞİFRE</span><h3>{oneTimePassword.name}</h3><code>{oneTimePassword.password}</code><p>Bu şifre yalnızca şimdi gösterilir. Üye ilk girişinde yeni şifre belirlemelidir.</p><button className="primary" onClick={()=>setOneTimePassword(null)}>Tamam</button></div></div>}
    {slotDetail&&<SlotModal time={slotDetail} onClose={()=>setSlotDetail(null)} onMember={setDetail}/>} 
    {detail&&<MemberDetail data={detail} onClose={()=>setDetail(null)}/>} 
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

const hours=[{t:"06.00–08.00",r:8,g:7},{t:"08.00–10.00",r:14,g:12},{t:"10.00–12.00",r:20,g:18},{t:"12.00–14.00",r:11,g:9},{t:"14.00–16.00",r:9,g:8},{t:"16.00–18.00",r:18,g:13,now:true},{t:"18.00–20.00",r:25,g:0},{t:"20.00–22.00",r:16,g:0}];
const movements=[{name:"Ahmet Yılmaz",time:"17.08",appointment:"16.00–18.00",ok:true,new:true},{name:"Elif Kaya",time:"17.02",appointment:"16.00–18.00",ok:true},{name:"Mert Demir",time:"16.51",appointment:"18.00–20.00",ok:false},{name:"Zeynep Akın",time:"16.34",appointment:"16.00–18.00",ok:true},{name:"Can Öztürk",time:"16.12",appointment:"14.00–16.00",ok:false}];
function Dashboard({onSlot,onMember}:{onSlot:(v:string)=>void;onMember:(v:{name:string;appointment?:string;warning?:boolean})=>void}){return <><div className="welcome"><div><p>İyi akşamlar, Emre</p><h2>Bugünkü salon hareketleri.</h2></div><div className="system-ok"><Check size={16}/><span><strong>Canlı takip açık</strong> QR girişleri anlık</span></div></div><section className="hour-section"><div className="dash-head"><div><span>BUGÜN · 29 EYLÜL</span><h3>Randevu Dolulukları</h3></div><small>Kapasite: 25 kişi</small></div><div className="hour-grid">{hours.map(h=><button key={h.t} className={h.now?"current":""} onClick={()=>onSlot(h.t)}><div><Clock3/><strong>{h.t}</strong></div><div className="hour-numbers"><span><b>{h.r}</b> Randevu</span><span><b>{h.g}</b> Giriş</span></div><div className="occupancy"><i style={{width:`${h.r/25*100}%`}}/></div>{h.now&&<em>ŞİMDİ</em>}</button>)}</div></section><section className="activity-card"><div className="dash-head"><div><span>CANLI AKIŞ</span><h3>Son Giriş Hareketleri</h3></div><small>Bugün 47 giriş</small></div><div className="movement-list">{movements.map((m,i)=><button key={i} className={`${m.ok?"movement-ok":"movement-warn"} ${m.new?"movement-new":""}`} onClick={()=>onMember({name:m.name,appointment:m.appointment,warning:!m.ok})}><div className="move-icon">{m.ok?<LogIn/>:<AlertTriangle/>}</div><div className="move-main"><strong>{m.name}</strong><span>{m.ok?"Salona giriş yaptı":"Randevu saati uyuşmazlığı"}</span></div><div className="move-meta"><strong>{m.time}</strong><span>Randevu: {m.appointment}</span></div><span className="info-link">Üye bilgileri</span></button>)}</div></section></>}
function SlotModal({time,onClose,onMember}:{time:string;onClose:()=>void;onMember:(v:{name:string;appointment?:string})=>void}){const people=["Ahmet Yılmaz","Elif Kaya","Zeynep Akın","Mehmet Balcı","Deniz Arslan"];return <div className="modal-backdrop"><div className="slot-modal"><div className="modal-head"><div><span>RANDEVU DETAYI</span><h3>{time}</h3></div><button onClick={onClose}><X/></button></div><div className="slot-summary"><div><b>18</b><span>Randevu aldı</span></div><div><b>13</b><span>Giriş yaptı</span></div><div><b>5</b><span>Henüz gelmedi</span></div></div><div className="slot-people">{people.map((p,i)=><button key={p} onClick={()=>onMember({name:p,appointment:time})}><div>{p.split(" ").map(x=>x[0]).join("")}</div><span><strong>{p}</strong><small>{i<3?"Giriş yaptı · 17.0"+i:"Henüz giriş yapmadı"}</small></span><em>Üye bilgileri</em></button>)}</div></div></div>}
function MemberDetail({data,onClose}:{data:{name:string;appointment?:string;warning?:boolean};onClose:()=>void}){return <div className="modal-backdrop"><div className="detail-modal"><div className="modal-head"><div><span>ÜYE BİLGİLERİ</span><h3>{data.name}</h3></div><button onClick={onClose}><X/></button></div>{data.warning&&<div className="detail-warning"><AlertTriangle/>Randevu saati uyuşmazlığı</div>}<div className="detail-profile"><div>{data.name.split(" ").map(x=>x[0]).join("")}</div><span><strong>Aktif Üye</strong><small>Üye #0024 · TC •••• 4821</small></span></div><div className="detail-facts"><div><small>Telefon</small><strong>0532 555 41 28</strong></div><div><small>Üyelik Bitişi</small><strong>01 Mart 2027</strong></div><div><small>Bugünkü Randevu</small><strong>{data.appointment||"16.00–18.00"}</strong></div><div><small>Son Giriş</small><strong>Bugün · 17.08</strong></div></div><div className="visit-history"><h4>Son 5 Geliş</h4>{["29 Eyl 2026 · 17.08","27 Eyl 2026 · 16.42","24 Eyl 2026 · 17.11","21 Eyl 2026 · 16.36","18 Eyl 2026 · 17.04"].map((v,i)=><div key={v}><span><i/>{v}</span><em>{i===0&&data.warning?"Saat uyuşmazlığı":"Randevu ile giriş"}</em></div>)}</div></div></div>}
