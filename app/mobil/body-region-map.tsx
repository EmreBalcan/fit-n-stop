"use client";

import { useState } from "react";

type View = "front" | "back";
type Hotspot = { region: string; label: string; x: number; y: number };

const FRONT: Hotspot[] = [
  { region: "chest", label: "Göğüs", x: 51, y: 29 },
  { region: "shoulders", label: "Omuz", x: 30, y: 26 },
  { region: "biceps", label: "Biceps", x: 26, y: 39 },
  { region: "abs", label: "Karın", x: 51, y: 43 },
  { region: "legs", label: "Ön Bacak", x: 49, y: 66 },
  { region: "legs", label: "Baldır", x: 51, y: 81 },
];
const BACK: Hotspot[] = [
  { region: "back", label: "Sırt", x: 51, y: 30 },
  { region: "shoulders", label: "Omuz", x: 29, y: 26 },
  { region: "triceps", label: "Triceps", x: 25, y: 40 },
  { region: "glutes", label: "Kalça", x: 51, y: 57 },
  { region: "legs", label: "Arka Bacak", x: 51, y: 69 },
  { region: "legs", label: "Baldır", x: 51, y: 81 },
];

export default function BodyRegionMap({ onSelect }: { onSelect: (region: string) => void }) {
  const [view, setView] = useState<View>("front");
  const [highlight, setHighlight] = useState("");
  const points = view === "front" ? FRONT : BACK;
  const highlighted = `${view}-${highlight}`;
  const image = highlight && ["front-chest", "front-shoulders", "front-biceps", "front-abs", "front-legs", "back-back", "back-shoulders", "back-triceps", "back-glutes", "back-legs"].includes(highlighted)
    ? `/training-assets/body-model/highlights/${highlighted}.webp`
    : `/training-assets/body-model/${view}.webp`;
  return <section className="training-body-map" aria-label="Vücut bölgesi seçimi">
    <div className="training-map-heading"><div><span>İNTERAKTİF KAS HARİTASI</span><h3>Bölgeye dokun</h3></div><div className="training-map-switch"><button className={view === "front" ? "active" : ""} onClick={() => { setView("front"); setHighlight(""); }}>Ön</button><button className={view === "back" ? "active" : ""} onClick={() => { setView("back"); setHighlight(""); }}>Arka</button></div></div>
    <div className="training-map-stage">
      <img src={image} alt={view === "front" ? "Sporcu önden görünüm" : "Sporcu arkadan görünüm"} />
      {points.map((point, index) => <button key={`${view}-${point.label}-${index}`} className="training-map-hotspot" style={{ left: `${point.x}%`, top: `${point.y}%` }} onPointerEnter={() => setHighlight(point.region)} onPointerLeave={() => setHighlight("")} onFocus={() => setHighlight(point.region)} onBlur={() => setHighlight("")} onClick={() => onSelect(point.region)} aria-label={`${point.label} hareketlerini göster`}>{point.label}</button>)}
    </div>
    <p>Ön ve arka görünüm arasında geçerek çalışmak istediğin bölgeyi seç.</p>
  </section>;
}
