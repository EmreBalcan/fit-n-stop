"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Activity, CalendarDays, Check, ChevronDown, CircleUserRound, Clock3, Dumbbell, LayoutDashboard, Menu, MoreHorizontal, Pencil, Plus, Search, Settings, Snowflake, Trash2, UserRoundCheck, Users, X } from "lucide-react";

type Status = "active" | "frozen" | "cancelled";
type Member = { id: number; fullName: string; phone: string; email: string | null; startDate: string; endDate: string; status: Status; notes: string; createdAt: string; updatedAt: string };
const emptyForm = { fullName: "", phone: "", email: "", startDate: new Date().toISOString().slice(0, 10), endDate: "", status: "active" as Status, notes: "" };
const nav = [
  { label: "Genel Bakış", icon: LayoutDashboard },
  { label: "Üyeler", icon: Users, active: true },
  { label: "Randevular", icon: CalendarDays, disabled: true },
  { label: "Ayarlar", icon: Settings, disabled: true },
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
  function openEdit(member: Member) { setEditing(member); setForm({ fullName: member.fullName, phone: member.phone, email: member.email ?? "", startDate: member.startDate, endDate: member.endDate, status: member.status, notes: member.notes }); setModal(true); }
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

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
      <div className="brand"><span className="brand-fit">FİT</span><span className="brand-n">N</span><span>STOP</span></div>
      <div className="branch-pill"><span className="live-dot" /> Merkez Şube <ChevronDown size={15} /></div>
      <nav>{nav.map((item) => <button key={item.label} className={`${item.active ? "active" : ""} ${item.disabled ? "disabled" : ""}`} title={item.disabled ? "Yakında" : undefined}><item.icon size={19} /><span>{item.label}</span>{item.disabled && <small>Yakında</small>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="admin-avatar">EB</div><div><strong>Emre Balcan</strong><span>Yönetici</span></div><MoreHorizontal size={20} /></div>
    </aside>

    <main>
      <header className="topbar"><button className="menu-button" onClick={() => setMobileNav(!mobileNav)} aria-label="Menü"><Menu /></button><div><span>29 Eylül 2026, Salı</span><h1>Üye Yönetimi</h1></div><div className="top-actions"><button className="profile-button"><CircleUserRound size={20} /> Yönetici</button><button className="add-button" onClick={openNew}><Plus size={19} /> Yeni Üye</button></div></header>
      <section className="content">
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
            {loading ? <tr><td colSpan={6}><div className="loading"><Activity className="spin"/> Üyeler yükleniyor...</div></td></tr> : shown.length === 0 ? <tr><td colSpan={6}><div className="empty"><div><Dumbbell/></div><h4>{members.length ? "Aramana uygun üye bulunamadı" : "Henüz üye eklenmedi"}</h4><p>{members.length ? "Arama veya filtre seçimini değiştirebilirsin." : "İlk üye kaydını oluşturarak başlayabilirsin."}</p>{!members.length && <button onClick={openNew}><Plus size={17}/> İlk üyeyi ekle</button>}</div></td></tr> : shown.map((member) => <MemberRow key={member.id} member={member} onEdit={() => openEdit(member)} onDelete={() => setDeleteTarget(member)} />)}
          </tbody></table></div>
        </section>
      </section>
    </main>
    {modal && <MemberModal editing={editing} form={form} setForm={setForm} saving={saving} onClose={() => setModal(false)} onSubmit={save} />}
    {deleteTarget && <div className="modal-backdrop"><div className="confirm-modal"><div className="danger-icon"><Trash2/></div><h3>Üyeyi silmek istiyor musun?</h3><p><strong>{deleteTarget.fullName}</strong> adlı üyenin kaydı kalıcı olarak silinecek.</p><div><button className="secondary" onClick={() => setDeleteTarget(null)}>Vazgeç</button><button className="danger" onClick={remove}>Üyeyi Sil</button></div></div></div>}
    {toast && <div className="toast"><Check size={18}/>{toast}</div>}
  </div>;
}

function MemberRow({ member, onEdit, onDelete }: { member: Member; onEdit: () => void; onDelete: () => void }) {
  const state = effectiveStatus(member);
  const labels: Record<string, string> = { active: "Aktif", expiring: "Süresi yaklaşıyor", expired: "Süresi doldu", frozen: "Donduruldu", cancelled: "İptal edildi" };
  return <tr><td><div className="member-name"><div>{member.fullName.split(" ").map((x) => x[0]).join("").slice(0,2).toLocaleUpperCase("tr")}</div><span><strong>{member.fullName}</strong><small>Üye #{String(member.id).padStart(4,"0")}</small></span></div></td><td><div className="contact"><span>{member.phone}</span><small>{member.email || "E-posta eklenmedi"}</small></div></td><td>{dateTR(member.startDate)}</td><td><div className="end-date"><span>{dateTR(member.endDate)}</span>{state === "expiring" && <small>{daysUntil(member.endDate)} gün kaldı</small>}</div></td><td><span className={`status ${state}`}><i/>{labels[state]}</span></td><td><div className="row-actions"><button onClick={onEdit} title="Düzenle"><Pencil size={17}/></button><button onClick={onDelete} title="Sil" className="delete"><Trash2 size={17}/></button></div></td></tr>;
}

function MemberModal({ editing, form, setForm, saving, onClose, onSubmit }: { editing: Member | null; form: typeof emptyForm; setForm: (value: typeof emptyForm) => void; saving: boolean; onClose: () => void; onSubmit: (e: FormEvent) => void }) {
  const update = (key: keyof typeof form, value: string) => setForm({ ...form, [key]: value });
  return <div className="modal-backdrop"><form className="member-modal" onSubmit={onSubmit}><div className="modal-head"><div><span>{editing ? "ÜYE DÜZENLE" : "YENİ ÜYE"}</span><h3>{editing ? editing.fullName : "Üye bilgilerini girin"}</h3></div><button type="button" onClick={onClose}><X/></button></div><div className="form-grid"><label className="span-2">Ad Soyad <input required value={form.fullName} onChange={(e)=>update("fullName",e.target.value)} placeholder="Örn. Ayşe Yılmaz"/></label><label>Telefon <input required value={form.phone} onChange={(e)=>update("phone",e.target.value)} placeholder="05__ ___ __ __"/></label><label>E-posta <input type="email" value={form.email} onChange={(e)=>update("email",e.target.value)} placeholder="uye@email.com"/></label><label>Başlangıç Tarihi <input required type="date" value={form.startDate} onChange={(e)=>update("startDate",e.target.value)}/></label><label>Bitiş Tarihi <input required type="date" min={form.startDate} value={form.endDate} onChange={(e)=>update("endDate",e.target.value)}/></label><label className="span-2">Üyelik Durumu <select value={form.status} onChange={(e)=>update("status",e.target.value)}><option value="active">Aktif</option><option value="frozen">Dondurulmuş</option><option value="cancelled">İptal edilmiş</option></select></label><label className="span-2">Notlar <textarea value={form.notes} onChange={(e)=>update("notes",e.target.value)} placeholder="Sağlık notu, özel bilgi veya hatırlatma..." rows={3}/></label></div><div className="modal-footer"><button type="button" className="secondary" onClick={onClose}>Vazgeç</button><button type="submit" className="primary" disabled={saving}>{saving ? "Kaydediliyor..." : editing ? "Değişiklikleri Kaydet" : "Üyeyi Kaydet"}</button></div></form></div>;
}
