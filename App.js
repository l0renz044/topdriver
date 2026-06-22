import { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Platform, Vibration, Dimensions
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";

// ═══════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════
const APP_VERSION = "v12.5-RN";
const { width: SW } = Dimensions.get("window");

// ═══════════════════════════════════════════════
// TRADUCTIONS
// ═══════════════════════════════════════════════
const T = {
  fr: {
    gpsRequired: "Accès GPS requis",
    gpsDesc: "TopDriver utilise votre GPS pour mesurer la vitesse et détecter les infractions, même en arrière-plan.",
    allowGps: "Autoriser le GPS",
    gpsActive: "GPS actif", gpsSearching: "Recherche…", gpsError: "GPS erreur",
    start: "▶ Démarrer le trajet", stop: "⏹ Terminer le trajet",
    newTrip: "▶ Nouveau trajet", generateReport: "📊 Générer le rapport",
    safeScore: "Safe-conduite", ecoScore: "Éco-conduite",
    infractions: "Infractions", distance: "Distance", maxSpeed: "Vit. max", duration: "Durée",
    limit: "Limite", noInfraction: "Aucune infraction 👍",
    tripEnded: "Trajet terminé", saved: "Rapport sauvegardé !",
    toleranceNote: "Tolérance 5 km/h", zoneChange: "Changement de zone",
    settings: "Paramètres", language: "Langue", unit: "Unité",
    bip: "Bip d'infraction", bipOn: "Activé", bipOff: "Désactivé",
    wakelock: "Garder l'écran actif", wakelockOn: "Activé", wakelockOff: "Désactivé",
    close: "Fermer", save: "💾 Sauvegarder", share: "↗ Partager",
    reportTitle: "Rapport de trajet", departure: "Départ", arrival: "Arrivée",
    totalInfractions: "Infractions", severe: "graves", moderate: "modérées", light: "légères",
    verdicts: [
      "Conduite très dangereuse ! ⚠️",
      "Conduite dangereuse.",
      "Conduite correcte mais améliorable.",
      "Très bonne conduite !",
      "Conduite exemplaire ! 🏆",
    ],
    ecoVerdicts: [
      "Conduite très agressive. 🌫️",
      "Conduite agressive. 🍂",
      "Quelques accélérations brusques. 🌿",
      "Bonne éco-conduite. 🌱",
      "Éco-conduite exemplaire ! 🌳",
    ],
  },
  en: {
    gpsRequired: "GPS access required",
    gpsDesc: "TopDriver uses your GPS to measure speed and detect violations, even in background.",
    allowGps: "Allow GPS",
    gpsActive: "GPS active", gpsSearching: "Searching…", gpsError: "GPS error",
    start: "▶ Start trip", stop: "⏹ End trip",
    newTrip: "▶ New trip", generateReport: "📊 Generate report",
    safeScore: "Safe driving", ecoScore: "Eco driving",
    infractions: "Violations", distance: "Distance", maxSpeed: "Max speed", duration: "Duration",
    limit: "Limit", noInfraction: "No violations 👍",
    tripEnded: "Trip ended", saved: "Report saved!",
    toleranceNote: "5 km/h tolerance", zoneChange: "Zone change",
    settings: "Settings", language: "Language", unit: "Unit",
    bip: "Violation beep", bipOn: "On", bipOff: "Off",
    wakelock: "Keep screen on", wakelockOn: "On", wakelockOff: "Off",
    close: "Close", save: "💾 Save", share: "↗ Share",
    reportTitle: "Trip report", departure: "Departure", arrival: "Arrival",
    totalInfractions: "Violations", severe: "severe", moderate: "moderate", light: "minor",
    verdicts: [
      "Very dangerous driving! ⚠️",
      "Dangerous driving.",
      "Acceptable but improvable.",
      "Very good driving!",
      "Exemplary driving! 🏆",
    ],
    ecoVerdicts: [
      "Very aggressive driving. 🌫️",
      "Aggressive driving. 🍂",
      "Some harsh acceleration. 🌿",
      "Good eco-driving. 🌱",
      "Exemplary eco-driving! 🌳",
    ],
  },
};

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
function fmtTime(d) {
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDate(d) {
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function fmtDuration(s) {
  return `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, "0")}s`;
}
function scoreColor(s) {
  return s >= 4 ? "#22c55e" : s >= 3 ? "#0ea5e9" : s >= 2 ? "#f59e0b" : s >= 1 ? "#f97316" : "#f43f5e";
}
function shieldsFromScore(score) {
  if (score >= 4.5) return 5;
  if (score >= 3.5) return 4;
  if (score >= 2.5) return 3;
  if (score >= 1.5) return 2;
  return 1;
}
function toDisplaySpeed(kmh, unit) {
  return unit === "mph" ? Math.round(kmh * 0.621371) : kmh;
}
function toDisplayDist(km, unit) {
  if (unit === "mph") {
    const mi = km * 0.621371;
    return mi < 0.621 ? `${Math.round(mi * 5280)} ft` : `${mi.toFixed(2)} mi`;
  }
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`;
}
function haversine(la1, lo1, la2, lo2) {
  const R = 6371, r = Math.PI / 180;
  const dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Eco score ──────────────────────────────────
function computeEcoScore(trajectory) {
  if (trajectory.length < 3) return { leaves: 5, avgAccel: 0, peakAccel: 0 };
  const accels = [];
  for (let i = 1; i < trajectory.length; i++) {
    const prev = trajectory[i - 1], curr = trajectory[i];
    const dt = Math.max((curr.t - prev.t) / 1000, 0.5);
    const dv = (curr.speed - prev.speed) / 3.6;
    if (dv > 0) accels.push(dv / dt);
  }
  if (!accels.length) return { leaves: 5, avgAccel: 0, peakAccel: 0 };
  const avg = accels.reduce((s, a) => s + a, 0) / accels.length;
  const peak = Math.max(...accels);
  const peakPenalty = peak > 2.5 ? 0.5 : 0;
  let leaves = avg <= 0.5 ? 5 : avg <= 0.9 ? 4 : avg <= 1.4 ? 3 : avg <= 2.0 ? 2 : 1;
  return { leaves: Math.max(1, Math.round(leaves - peakPenalty)), avgAccel: +avg.toFixed(2), peakAccel: +peak.toFixed(2) };
}

// ── Speed limits OSM ───────────────────────────
const DEFAULT_LIMITS = {
  motorway: 130, motorway_link: 110, trunk: 110, trunk_link: 90,
  primary: 80, primary_link: 70, secondary: 80, secondary_link: 70,
  tertiary: 80, tertiary_link: 70, residential: 30, living_street: 20,
  service: 20, unclassified: 50, road: 50,
};
const URBAN_LIMITS = {
  motorway: 110, trunk: 90, primary: 50, secondary: 50, tertiary: 50,
  residential: 30, living_street: 20, service: 20, unclassified: 50, road: 50,
};
const BUS_PRIORITY = ["motorway", "trunk", "primary", "secondary", "tertiary", "motorway_link", "trunk_link", "primary_link", "secondary_link", "unclassified", "residential"];

function parseMaxspeed(raw) {
  if (!raw) return null;
  const n = raw.trim().toLowerCase();
  const num = parseInt(n);
  if (!isNaN(num) && num > 0) return num;
  const special = { "fr:urban": 50, "fr:living_street": 20, "fr:rural": 80, "fr:motorway": 130, "fr:trunk": 110, "walk": 20, "none": 130 };
  return special[n] ?? null;
}

const speedCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function fetchSpeedLimit(lat, lon) {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = speedCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached;
  const q = `[out:json][timeout:10];way(around:50,${lat},${lon})[highway][highway!~"footway|path|steps|cycleway|track"];out tags 5;`;
  try {
    const res = await fetch(`https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (!data.elements?.length) return { limit: 50, source: "défaut" };
    const sorted = [...data.elements].sort((a, b) => {
      const ia = BUS_PRIORITY.indexOf(a.tags?.highway || "");
      const ib = BUS_PRIORITY.indexOf(b.tags?.highway || "");
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    for (const el of sorted) {
      const tags = el.tags || {};
      const limit = parseMaxspeed(tags.maxspeed);
      if (limit !== null) {
        const r = { limit, source: "OSM", road: tags.name || tags.ref || tags.highway || "", ts: Date.now() };
        speedCache.set(key, r); return r;
      }
    }
    const tags = sorted[0].tags || {};
    const hw = tags.highway || "";
    const isUrban = ["residential", "living_street", "service", "unclassified"].includes(hw);
    const limit = (isUrban ? URBAN_LIMITS : DEFAULT_LIMITS)[hw] ?? 50;
    const r = { limit, source: isUrban ? `agglo (${hw})` : `défaut (${hw})`, road: tags.name || tags.ref || hw || "", ts: Date.now() };
    speedCache.set(key, r); return r;
  } catch { return { limit: 50, source: "hors ligne" }; }
}

// ── User limits ────────────────────────────────
const USER_LIMITS_KEY = "topdriver_user_limits";
const TTL_90 = 90 * 24 * 60 * 60 * 1000;

async function loadUserLimits() {
  try {
    const raw = await AsyncStorage.getItem(USER_LIMITS_KEY);
    const arr = JSON.parse(raw || "[]");
    return arr.filter(e => Date.now() - e.savedAt < TTL_90);
  } catch { return []; }
}
async function findUserLimit(lat, lon) {
  const limits = await loadUserLimits();
  for (const e of limits) {
    if (haversine(lat, lon, e.lat, e.lon) * 1000 <= 50) return e.limit;
  }
  return null;
}
async function saveUserLimit(lat, lon, limit) {
  const limits = await loadUserLimits();
  const filtered = limits.filter(e => haversine(lat, lon, e.lat, e.lon) * 1000 > 50);
  filtered.push({ lat, lon, limit, savedAt: Date.now() });
  await AsyncStorage.setItem(USER_LIMITS_KEY, JSON.stringify(filtered));
}
async function clearUserLimits() {
  await AsyncStorage.removeItem(USER_LIMITS_KEY);
}

// ── Storage reports ────────────────────────────
const REPORTS_KEY = "topdriver_reports";
async function loadReports() {
  try { return JSON.parse(await AsyncStorage.getItem(REPORTS_KEY) || "[]"); } catch { return []; }
}
async function saveReports(reports) {
  await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
}

// ── Beep ──────────────────────────────────────
async function playBeep(type = "warn") {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const freq = type === "severe" ? 440 : 880;
    // Vibration comme fallback universel
    Vibration.vibrate(type === "severe" ? [0, 200, 100, 200] : [0, 150]);
  } catch {}
}

// ═══════════════════════════════════════════════
// COMPOSANTS UI
// ═══════════════════════════════════════════════

// Jauge circulaire — version sans SVG, utilise des View avec border
function SpeedGauge({ speed, limit, active, unit }) {
  const dispSpeed = toDisplaySpeed(speed, unit);
  const dispLimit = toDisplaySpeed(limit, unit);
  const pct = Math.min(dispSpeed / Math.max(dispLimit * 1.5, 1), 1);
  const color = speed > limit * 1.1 ? "#f43f5e" : speed > limit + 5 ? "#f59e0b" : "#0ea5e9";
  // Arc simulé avec rotation de bordure
  const deg = Math.round(pct * 360);

  return (
    <View style={s.gaugeWrap}>
      {/* Cercle de fond */}
      <View style={[s.gaugeRing, { borderColor: "#e2e8f0" }]} />
      {/* Arc coloré simulé avec un overlay rotatif */}
      <View style={[s.gaugeRingFill, { borderColor: color, opacity: active ? 1 : 0.3 }]} />
      <View style={s.gaugeCenter}>
        <Text style={[s.speedValue, { color: active ? color : "#94a3b8" }]}>
          {active ? dispSpeed : "--"}
        </Text>
        <Text style={s.speedUnit}>{unit === "mph" ? "mph" : "km/h"}</Text>
      </View>
    </View>
  );
}

// Panneau de limitation
function LimitSign({ limit, manual, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.limitSign, manual && s.limitSignManual]}>
      <Text style={s.limitSignText}>{limit}</Text>
      {manual && <Text style={s.limitManualBadge}>✏️</Text>}
    </TouchableOpacity>
  );
}

// Boucliers Safe-conduite — version sans SVG
function Shields({ score, size = 20 }) {
  const color = scoreColor(score);
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.min(1, Math.max(0, score - i));
        return (
          <View key={i} style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: size * 0.85, opacity: fill > 0.5 ? 1 : 0.2 }}>🛡️</Text>
          </View>
        );
      })}
    </View>
  );
}

// Feuilles Éco-conduite
function Leaves({ count, size = 18 }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Text key={i} style={{ fontSize: size, opacity: i < count ? 1 : 0.15 }}>🍃</Text>
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════
export default function App() {
  const [lang, setLang] = useState("fr");
  const [unit, setUnit] = useState("kmh");
  const [bipEnabled, setBipEnabled] = useState(true);
  const t = T[lang];

  const [screen, setScreen] = useState("perm");
  const [gpsStatus, setGpsStatus] = useState("idle");
  const [toast, setToast] = useState(null);

  const [active, setActive] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [limitInfo, setLimitInfo] = useState({ limit: 50, source: "—" });
  const [infractions, setInfractions] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [trajectory, setTrajectory] = useState([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [ecoData, setEcoData] = useState({ leaves: 5, avgAccel: 0, peakAccel: 0 });
  const [zoneChangeCooldown, setZoneChangeCooldown] = useState(0);
  const [isLimitManual, setIsLimitManual] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showLimitEditor, setShowLimitEditor] = useState(false);
  const [reports, setReports] = useState([]);
  const [reportName, setReportName] = useState("Rapport de trajet");

  const locationSub = useRef(null);
  const elapsedRef = useRef(null);
  const activeRef = useRef(false);
  const trajectoryRef = useRef([]);
  const limitInfoRef = useRef({ limit: 50 });
  const infractionsRef = useRef([]);
  const lastLimitFetch = useRef(0);
  const lastInfractionRef = useRef(0);
  const zoneChangeCooldownRef = useRef(0);
  const prevSpeedRef = useRef(0);
  const adaptiveIntervalRef = useRef(15000);
  const lastOsmLimitRef = useRef(50);
  const isLimitManualRef = useRef(false);
  const bipEnabledRef = useRef(true);
  const totalDistanceRef = useRef(0);

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { limitInfoRef.current = limitInfo; }, [limitInfo]);
  useEffect(() => { zoneChangeCooldownRef.current = zoneChangeCooldown; }, [zoneChangeCooldown]);
  useEffect(() => { bipEnabledRef.current = bipEnabled; }, [bipEnabled]);
  useEffect(() => { isLimitManualRef.current = isLimitManual; }, [isLimitManual]);

  // Charger rapports
  useEffect(() => { loadReports().then(setReports); }, []);

  // Vérifier permission GPS au démarrage
  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") setScreen("main");
    })();
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const requestGPS = async () => {
    setGpsStatus("searching");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") { setGpsStatus("error"); return; }
    // Demander aussi permission arrière-plan
    await Location.requestBackgroundPermissionsAsync();
    setGpsStatus("ok"); setScreen("main");
  };

  const computeScore = (infs = infractions) => {
    const counted = infs.filter(i => i.severity !== "tolerance");
    if (!counted.length) return 5;
    const g = counted.filter(i => i.severity === "severe").length;
    const m = counted.filter(i => i.severity === "moderate").length;
    const l = counted.filter(i => i.severity === "light").length;
    return Math.max(0, Math.min(5, +(5 - g * 1.2 - m * 0.5 - l * 0.2).toFixed(2)));
  };

  const handleStart = async () => {
    setInfractions([]); infractionsRef.current = [];
    setElapsed(0); setMaxSpeed(0); setSpeed(0);
    setTrajectory([]); trajectoryRef.current = [];
    setTotalDistance(0); totalDistanceRef.current = 0;
    setEcoData({ leaves: 5, avgAccel: 0, peakAccel: 0 });
    setEndTime(null); lastLimitFetch.current = 0;
    lastInfractionRef.current = 0; zoneChangeCooldownRef.current = 0;
    setZoneChangeCooldown(0); prevSpeedRef.current = 0;
    adaptiveIntervalRef.current = 15000; lastOsmLimitRef.current = 50;
    setIsLimitManual(false); isLimitManualRef.current = false;
    speedCache.clear();
    setStartTime(new Date()); setActive(true); setGpsStatus("searching");

    locationSub.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 0,
      },
      (loc) => {
        if (!activeRef.current) return;
        const { latitude: lat, longitude: lon, speed: raw } = loc.coords;
        const spd = raw != null && raw >= 0 ? Math.round(raw * 3.6) : 0;
        setSpeed(spd); setMaxSpeed(prev => Math.max(prev, spd)); setGpsStatus("ok");

        const now = Date.now();
        const newPt = { lat, lon, t: now, speed: spd };
        const prev = trajectoryRef.current;
        if (prev.length === 0 || haversine(prev[prev.length - 1].lat, prev[prev.length - 1].lon, lat, lon) > 0.003) {
          if (prev.length > 0) {
            totalDistanceRef.current += haversine(prev[prev.length - 1].lat, prev[prev.length - 1].lon, lat, lon);
            setTotalDistance(totalDistanceRef.current);
          }
          trajectoryRef.current = [...prev, newPt];
          setTrajectory([...trajectoryRef.current]);
          if (trajectoryRef.current.length % 5 === 0) setEcoData(computeEcoScore(trajectoryRef.current));
        }

        const speedDelta = Math.abs(spd - prevSpeedRef.current);
        prevSpeedRef.current = spd;
        adaptiveIntervalRef.current = speedDelta > 15 ? 2000 : speedDelta > 5 ? 5000 : 15000;

        if (now - lastLimitFetch.current > adaptiveIntervalRef.current) {
          lastLimitFetch.current = now;
          // Vérifier d'abord les limites utilisateur
          findUserLimit(lat, lon).then(userLimit => {
            if (userLimit !== null) {
              const info = { limit: userLimit, source: "👤 Personnel", road: "" };
              setLimitInfo(info); limitInfoRef.current = info;
            } else {
              fetchSpeedLimit(lat, lon).then(info => {
                if (isLimitManualRef.current) {
                  if (info.limit !== lastOsmLimitRef.current) {
                    setIsLimitManual(false); isLimitManualRef.current = false;
                    setLimitInfo(info); limitInfoRef.current = info;
                    lastOsmLimitRef.current = info.limit;
                    zoneChangeCooldownRef.current = 3; setZoneChangeCooldown(3);
                  } else { lastOsmLimitRef.current = info.limit; }
                } else {
                  if (info.limit !== lastOsmLimitRef.current) { zoneChangeCooldownRef.current = 3; setZoneChangeCooldown(3); }
                  lastOsmLimitRef.current = info.limit;
                  setLimitInfo(info); limitInfoRef.current = info;
                }
              });
            }
          });
        }

        if (zoneChangeCooldownRef.current > 0) {
          zoneChangeCooldownRef.current--; setZoneChangeCooldown(zoneChangeCooldownRef.current); return;
        }

        const lim = limitInfoRef.current.limit;
        const delta = spd - lim;
        if (delta > 0 && now - lastInfractionRef.current > 3000) {
          lastInfractionRef.current = now;
          const severity = delta <= 5 ? "tolerance" : delta > 25 ? "severe" : delta > 10 ? "moderate" : "light";
          const color = severity === "tolerance" ? "#94a3b8" : severity === "severe" ? "#f43f5e" : severity === "moderate" ? "#f59e0b" : "#f97316";
          if (bipEnabledRef.current && severity !== "tolerance") playBeep(severity === "severe" ? "severe" : "warn");
          const entry = { time: new Date().toISOString(), speed: spd, limit: lim, delta, severity, color, coords: { lat, lon } };
          infractionsRef.current = [...infractionsRef.current, entry];
          setInfractions([...infractionsRef.current]);
        }
      }
    );

    elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  };

  const handleStop = () => {
    setActive(false); setSpeed(0); setEndTime(new Date());
    locationSub.current?.remove?.();
    clearInterval(elapsedRef.current);
    setGpsStatus("ok"); setReportName("Rapport de trajet"); setScreen("end");
  };

  const handleSave = async () => {
    const sc = computeScore();
    const eco = computeEcoScore(trajectory);
    const report = {
      id: Date.now(), name: reportName,
      date: new Date().toISOString(),
      startTime: startTime?.toISOString(), endTime: endTime?.toISOString(),
      elapsed, maxSpeed, totalDistance, infractions, trajectory,
      score: sc, shields: shieldsFromScore(sc), ecoData: eco, unit,
    };
    const updated = [report, ...reports];
    await saveReports(updated); setReports(updated); showToast(t.saved);
  };

  const score = computeScore();
  const shields = shieldsFromScore(score);
  const infCount = infractions.filter(i => i.severity !== "tolerance").length;
  const unitLabel = unit === "mph" ? "mph" : "km/h";
  const dispLimit = toDisplaySpeed(limitInfo.limit, unit);

  const alertMsg = () => {
    if (!active) return null;
    const diff = speed - limitInfo.limit;
    if (zoneChangeCooldown > 0) return { color: "#f59e0b", msg: t.zoneChange };
    if (diff > 20) return { color: "#f43f5e", msg: `🚨 +${diff} ${unitLabel}` };
    if (diff > 5) return { color: "#f59e0b", msg: `⚠️ +${diff} ${unitLabel}` };
    if (diff > 0) return { color: "#f59e0b", msg: t.toleranceNote };
    return null;
  };
  const alert = alertMsg();

  // ── ÉCRAN PERMISSION ──
  if (screen === "perm") return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      <View style={s.permScreen}>
        <Text style={s.permIcon}>📍</Text>
        <Text style={s.permTitle}>{t.gpsRequired}</Text>
        <Text style={s.permDesc}>{t.gpsDesc}</Text>
        <TouchableOpacity style={s.btnPrimary} onPress={requestGPS}>
          <Text style={s.btnPrimaryText}>{gpsStatus === "searching" ? t.gpsSearching : t.allowGps}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── ÉCRAN FIN ──
  if (screen === "end") {
    const sc = computeScore(); const sh = shieldsFromScore(sc);
    const eco = computeEcoScore(trajectory);
    return (
      <View style={s.screen}>
        <StatusBar style="dark" />
        {toast && <View style={s.toast}><Text style={s.toastText}>{toast}</Text></View>}
        <View style={s.header}>
          <Text style={s.logo}>TOP<Text style={s.logoAccent}>DRIVER</Text></Text>
          <Text style={s.version}>{APP_VERSION}</Text>
        </View>
        <View style={s.endScreen}>
          <Text style={s.endTitle}>{t.tripEnded}</Text>
          <Text style={s.endSub}>{fmtDuration(elapsed)} · {toDisplayDist(totalDistance, unit)}</Text>
          <View style={s.endScores}>
            <View style={s.endScoreCard}>
              <Text style={s.scoreCardLabel}>{t.safeScore}</Text>
              <Shields score={sc} size={24} />
            </View>
            <View style={s.endScoreCard}>
              <Text style={s.scoreCardLabel}>{t.ecoScore}</Text>
              <Leaves count={eco.leaves} size={22} />
            </View>
          </View>
          <TouchableOpacity style={s.btnPrimary} onPress={() => { setShowReport(true); }}>
            <Text style={s.btnPrimaryText}>{t.generateReport}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnSecondary} onPress={handleStart}>
            <Text style={s.btnSecondaryText}>{t.newTrip}</Text>
          </TouchableOpacity>
        </View>
        {showReport && (
          <ReportModal
            report={{ name: reportName, date: new Date().toISOString(), startTime: startTime?.toISOString(), endTime: endTime?.toISOString(), elapsed, maxSpeed, totalDistance, infractions, trajectory, score: sc, shields: sh, ecoData: eco, unit }}
            t={t} unit={unit}
            onClose={() => { setShowReport(false); setScreen("main"); }}
            onSave={handleSave}
            toDisplaySpeed={toDisplaySpeed} toDisplayDist={toDisplayDist}
            fmtTime={fmtTime} fmtDate={fmtDate} fmtDuration={fmtDuration}
          />
        )}
      </View>
    );
  }

  // ── ÉCRAN PRINCIPAL ──
  return (
    <View style={s.screen}>
      <StatusBar style="dark" />
      {toast && <View style={s.toast}><Text style={s.toastText}>{toast}</Text></View>}

      <View style={s.header}>
        <Text style={s.logo}>TOP<Text style={s.logoAccent}>DRIVER</Text></Text>
        <View style={s.headerRight}>
          <View style={[s.gpsPill, gpsStatus === "ok" ? s.gpsOk : gpsStatus === "searching" ? s.gpsSearching : s.gpsError]}>
            <Text style={s.gpsPillText}>{gpsStatus === "ok" ? t.gpsActive : gpsStatus === "searching" ? t.gpsSearching : t.gpsError}</Text>
          </View>
          <Text style={s.version}>{APP_VERSION}</Text>
        </View>
      </View>

      {/* Gauge card */}
      <View style={s.gaugeCard}>
        <LimitSign limit={dispLimit} manual={isLimitManual} onPress={() => setShowLimitEditor(true)} />
        <View style={{ flex: 1 }} />
        <SpeedGauge speed={speed} limit={limitInfo.limit} active={active} unit={unit} />
      </View>
      {(active || elapsed > 0) && limitInfo.source !== "—" && (
        <Text style={s.limitSource}>{limitInfo.source}{limitInfo.road ? ` · ${limitInfo.road}` : ""}</Text>
      )}

      {alert && <View style={s.alertBanner}><Text style={[s.alertText, { color: alert.color }]}>{alert.msg}</Text></View>}

      {/* Scores */}
      <View style={s.scoresRow}>
        <View style={s.scoreCard}>
          <Text style={s.scoreCardLabel}>{t.safeScore}</Text>
          <Shields score={score} size={18} />
          <View style={s.scoreCardSub}>
            <View style={s.scoreMini}>
              <Text style={s.scoreMiniLabel}>{t.infractions}</Text>
              <Text style={[s.scoreMiniVal, { color: infCount > 0 ? "#f43f5e" : "#22c55e" }]}>{active || elapsed > 0 ? infCount : "--"}</Text>
            </View>
            <View style={s.scoreDivider} />
            <View style={s.scoreMini}>
              <Text style={s.scoreMiniLabel}>{t.maxSpeed}</Text>
              <Text style={s.scoreMiniVal}>{active || elapsed > 0 ? maxSpeed : "--"}</Text>
            </View>
          </View>
        </View>
        <View style={s.scoreCard}>
          <Text style={s.scoreCardLabel}>{t.ecoScore}</Text>
          <Leaves count={ecoData.leaves} size={18} />
          <Text style={s.ecoSub}>{active || elapsed > 0 ? `${ecoData.avgAccel} m/s²` : "--"}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statLabel}>{t.distance}</Text>
          <Text style={s.statValue}>{active || elapsed > 0 ? toDisplayDist(totalDistance, unit) : "--"}</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statLabel}>{t.duration}</Text>
          <Text style={s.statValue}>{active || elapsed > 0 ? fmtDuration(elapsed) : "--"}</Text>
        </View>
      </View>

      {/* CTA */}
      <View style={s.ctaWrap}>
        {active
          ? <TouchableOpacity style={s.btnStop} onPress={handleStop}><Text style={s.btnStopText}>{t.stop}</Text></TouchableOpacity>
          : <TouchableOpacity style={s.btnPrimary} onPress={handleStart}><Text style={s.btnPrimaryText}>{t.start}</Text></TouchableOpacity>
        }
      </View>

      {/* Limit editor */}
      {showLimitEditor && (
        <LimitEditorModal
          currentLimit={limitInfo.limit} unit={unit} t={t}
          onApply={async (newLimit) => {
            const info = { limit: newLimit, source: "👤 Manuel", road: "" };
            setLimitInfo(info); limitInfoRef.current = info;
            setIsLimitManual(true); isLimitManualRef.current = true;
            if (trajectory.length > 0) {
              const last = trajectory[trajectory.length - 1];
              await saveUserLimit(last.lat, last.lon, newLimit);
              showToast("Limite mémorisée ✓");
            }
            setShowLimitEditor(false);
          }}
          onReset={() => {
            setIsLimitManual(false); isLimitManualRef.current = false;
            lastLimitFetch.current = 0; setShowLimitEditor(false);
          }}
          onClose={() => setShowLimitEditor(false)}
        />
      )}
    </View>
  );
}

// ── LimitEditorModal ───────────────────────────
const PRESETS = [20, 30, 50, 70, 80, 90, 110, 130];
function LimitEditorModal({ currentLimit, unit, t, onApply, onReset, onClose }) {
  const [selected, setSelected] = useState(currentLimit);
  return (
    <View style={s.modalOverlay}>
      <View style={s.modalSheet}>
        <Text style={s.modalTitle}>{t.limit}</Text>
        <View style={s.presets}>
          {PRESETS.map(v => (
            <TouchableOpacity key={v} style={[s.presetBtn, selected === v && s.presetBtnSelected]} onPress={() => setSelected(v)}>
              <Text style={[s.presetBtnText, selected === v && s.presetBtnTextSelected]}>{toDisplaySpeed(v, unit)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={s.btnPrimary} onPress={() => onApply(selected)}>
          <Text style={s.btnPrimaryText}>Appliquer — {toDisplaySpeed(selected, unit)} {unit === "mph" ? "mph" : "km/h"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnSecondary} onPress={onReset}>
          <Text style={s.btnSecondaryText}>↺ Rétablir automatique (OSM)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnSecondary} onPress={onClose}>
          <Text style={s.btnSecondaryText}>{t.close}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── ReportModal ────────────────────────────────
function ReportModal({ report, t, unit, onClose, onSave, toDisplaySpeed, toDisplayDist, fmtTime, fmtDate, fmtDuration }) {
  const inf = report.infractions || [];
  const sc = report.score ?? 5;
  const sh = report.shields ?? shieldsFromScore(sc);
  const eco = report.ecoData;
  const counted = inf.filter(i => i.severity !== "tolerance");
  const unitLabel = unit === "mph" ? "mph" : "km/h";
  const verdictColors = ["#f43f5e", "#f43f5e", "#f59e0b", "#0ea5e9", "#22c55e"];

  return (
    <View style={s.modalOverlay}>
      <ScrollView style={s.reportSheet} showsVerticalScrollIndicator={false}>
        <Text style={s.modalTitle}>{t.reportTitle}</Text>
        <Text style={s.modalSubtitle}>{report.date ? fmtDate(new Date(report.date)) : ""}</Text>

        {/* Bloc 1 — Safe-conduite */}
        <View style={s.repBlock}>
          <Text style={s.repBlockTitle}>🛡️ {t.safeScore}</Text>
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <Shields score={sc} size={28} />
          </View>
          <View style={s.repGrid}>
            <View style={s.repCell}><Text style={s.repCellLabel}>{t.departure}</Text><Text style={s.repCellValue}>{report.startTime ? fmtTime(new Date(report.startTime)) : "--"}</Text></View>
            <View style={s.repCell}><Text style={s.repCellLabel}>{t.arrival}</Text><Text style={s.repCellValue}>{report.endTime ? fmtTime(new Date(report.endTime)) : "--"}</Text></View>
            <View style={s.repCell}><Text style={s.repCellLabel}>{t.duration}</Text><Text style={s.repCellValue}>{fmtDuration(report.elapsed || 0)}</Text></View>
            <View style={s.repCell}><Text style={s.repCellLabel}>{t.distance}</Text><Text style={s.repCellValue}>{toDisplayDist(report.totalDistance || 0, unit)}</Text></View>
            <View style={s.repCell}><Text style={s.repCellLabel}>{t.maxSpeed}</Text><Text style={s.repCellValue}>{toDisplaySpeed(report.maxSpeed || 0, unit)} {unitLabel}</Text></View>
            <View style={s.repCell}><Text style={s.repCellLabel}>{t.totalInfractions}</Text><Text style={[s.repCellValue, { color: counted.length > 0 ? "#f43f5e" : "#22c55e" }]}>{counted.length}</Text></View>
          </View>
          <View style={[s.verdict, { backgroundColor: `${verdictColors[sh - 1]}18` }]}>
            <Text style={[s.verdictText, { color: verdictColors[sh - 1] }]}>{t.verdicts[sh - 1]}</Text>
          </View>
        </View>

        {/* Bloc 2 — Éco-conduite */}
        {eco && (
          <View style={s.repBlock}>
            <Text style={s.repBlockTitle}>🍃 {t.ecoScore}</Text>
            <View style={{ alignItems: "center", marginBottom: 8 }}>
              <Leaves count={eco.leaves} size={26} />
            </View>
            <Text style={s.ecoVerdictText}>{t.ecoVerdicts[eco.leaves - 1]}</Text>
            <View style={s.repGrid}>
              <View style={s.repCell}><Text style={s.repCellLabel}>Accél. moy.</Text><Text style={s.repCellValue}>{eco.avgAccel} m/s²</Text></View>
              <View style={s.repCell}><Text style={s.repCellLabel}>Accél. max</Text><Text style={s.repCellValue}>{eco.peakAccel} m/s²</Text></View>
            </View>
          </View>
        )}

        {/* Bloc 3 — Infractions */}
        <View style={s.repBlock}>
          <Text style={s.repBlockTitle}>🚨 Infractions</Text>
          {counted.length === 0
            ? <Text style={s.emptyState}>{t.noInfraction}</Text>
            : inf.map((inf, i) => inf.severity !== "tolerance" && (
              <View key={i} style={s.infRow}>
                <View style={[s.infDot, { backgroundColor: inf.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.infText}>{toDisplaySpeed(inf.speed, unit)} → {toDisplaySpeed(inf.limit, unit)} {unitLabel}</Text>
                  <Text style={s.infTime}>{fmtTime(new Date(inf.time))} · {inf.severity}</Text>
                </View>
                <Text style={[s.infDelta, { color: inf.color }]}>+{toDisplaySpeed(inf.delta, unit)}</Text>
              </View>
            ))
          }
        </View>

        <View style={s.reportActions}>
          {onSave && <TouchableOpacity style={[s.actionBtn, { flex: 1 }]} onPress={onSave}><Text style={s.actionBtnText}>{t.save}</Text></TouchableOpacity>}
        </View>
        <TouchableOpacity style={[s.btnSecondary, { marginTop: 8, marginBottom: 40 }]} onPress={onClose}>
          <Text style={s.btnSecondaryText}>{t.close}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════
const C = {
  bg: "#f0f4f8", surface: "#ffffff", surface2: "#f8fafc",
  accent: "#0ea5e9", accent2: "#f43f5e", warn: "#f59e0b",
  text: "#1e293b", muted: "#94a3b8", border: "#e2e8f0",
};
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingTop: 48 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10 },
  logo: { fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-condensed", fontSize: 24, fontWeight: "900", color: C.text },
  logoAccent: { color: C.accent },
  version: { fontSize: 11, color: C.muted, fontWeight: "700" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  gpsPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  gpsOk: { backgroundColor: "rgba(14,165,233,.1)", borderColor: "rgba(14,165,233,.25)" },
  gpsSearching: { backgroundColor: "rgba(245,158,11,.1)", borderColor: "rgba(245,158,11,.25)" },
  gpsError: { backgroundColor: "rgba(244,63,94,.1)", borderColor: "rgba(244,63,94,.25)" },
  gpsPillText: { fontSize: 10, fontWeight: "600", color: C.text },

  gaugeCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 14, marginBottom: 8, backgroundColor: C.surface, borderRadius: 26, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  gaugeWrap: { width: 160, height: 160, alignItems: "center", justifyContent: "center", position: "relative" },
  gaugeRing: { position: "absolute", width: 150, height: 150, borderRadius: 75, borderWidth: 10 },
  gaugeRingFill: { position: "absolute", width: 150, height: 150, borderRadius: 75, borderWidth: 10, borderTopColor: "transparent", borderRightColor: "transparent" },
  gaugeCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  speedValue: { fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-condensed", fontSize: 52, fontWeight: "700", lineHeight: 56 },
  speedUnit: { fontSize: 11, color: C.muted, letterSpacing: 2, textTransform: "uppercase" },
  limitSign: { width: 76, height: 76, borderRadius: 38, borderWidth: 5, borderColor: C.accent2, alignItems: "center", justifyContent: "center", backgroundColor: C.surface, shadowColor: C.accent2, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  limitSignManual: { borderColor: C.accent },
  limitSignText: { fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-condensed", fontSize: 26, fontWeight: "900", color: C.text },
  limitManualBadge: { fontSize: 10, position: "absolute", bottom: -4 },
  limitSource: { fontSize: 10, color: C.muted, textAlign: "center", marginTop: -4, marginBottom: 8, opacity: 0.7 },

  alertBanner: { marginHorizontal: 14, padding: 10, borderRadius: 12, backgroundColor: "rgba(245,158,11,.08)", marginBottom: 8 },
  alertText: { fontSize: 13, fontWeight: "600", textAlign: "center" },

  scoresRow: { flexDirection: "row", gap: 10, marginHorizontal: 14, marginBottom: 10 },
  scoreCard: { flex: 1, backgroundColor: C.surface, borderRadius: 20, padding: 12, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  scoreCardLabel: { fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  scoreCardSub: { flexDirection: "row", gap: 8, marginTop: 8, alignItems: "flex-end" },
  scoreMini: { alignItems: "center" },
  scoreMiniLabel: { fontSize: 9, color: C.muted, textTransform: "uppercase" },
  scoreMiniVal: { fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-condensed", fontSize: 20, fontWeight: "700", color: C.text },
  scoreDivider: { width: 1, height: 24, backgroundColor: C.border },
  ecoSub: { fontSize: 11, color: C.muted, marginTop: 6 },

  statsRow: { flexDirection: "row", gap: 10, marginHorizontal: 14, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: C.surface, borderRadius: 16, padding: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  statLabel: { fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 },
  statValue: { fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-condensed", fontSize: 20, fontWeight: "700", color: C.text },

  ctaWrap: { marginHorizontal: 14, marginTop: "auto" },
  btnPrimary: { backgroundColor: C.accent, padding: 16, borderRadius: 18, alignItems: "center", shadowColor: C.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6, marginBottom: 8 },
  btnPrimaryText: { color: "#fff", fontSize: 18, fontWeight: "700", letterSpacing: 1 },
  btnStop: { backgroundColor: C.accent2, padding: 16, borderRadius: 18, alignItems: "center", shadowColor: C.accent2, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6, marginBottom: 8 },
  btnStopText: { color: "#fff", fontSize: 18, fontWeight: "700", letterSpacing: 1 },
  btnSecondary: { backgroundColor: C.surface, padding: 14, borderRadius: 14, alignItems: "center", borderWidth: 1, borderColor: C.border, marginBottom: 8 },
  btnSecondaryText: { color: C.text, fontSize: 16, fontWeight: "600" },

  toast: { position: "absolute", top: 60, alignSelf: "center", backgroundColor: C.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, zIndex: 999 },
  toastText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  permScreen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 },
  permIcon: { fontSize: 52 },
  permTitle: { fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-condensed", fontSize: 24, fontWeight: "900", color: C.text, textAlign: "center" },
  permDesc: { fontSize: 14, color: C.muted, lineHeight: 22, textAlign: "center" },

  endScreen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  endTitle: { fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-condensed", fontSize: 28, fontWeight: "900", color: C.text },
  endSub: { fontSize: 14, color: C.muted },
  endScores: { flexDirection: "row", gap: 12, width: "100%" },
  endScoreCard: { flex: 1, backgroundColor: C.surface, borderRadius: 20, padding: 16, alignItems: "center", gap: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  endBtns: { width: "100%", gap: 10 },

  modalOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15,23,42,.6)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  reportSheet: { backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, maxHeight: "93%" },
  modalTitle: { fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-condensed", fontSize: 22, fontWeight: "900", color: C.text, marginBottom: 4 },
  modalSubtitle: { fontSize: 12, color: C.muted, marginBottom: 18 },

  presets: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  presetBtn: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: C.border, alignItems: "center", justifyContent: "center", backgroundColor: C.surface2 },
  presetBtnSelected: { borderColor: C.accent2, backgroundColor: "rgba(244,63,94,.08)" },
  presetBtnText: { fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-condensed", fontSize: 18, fontWeight: "900", color: C.text },
  presetBtnTextSelected: { color: C.accent2 },

  repBlock: { backgroundColor: C.surface2, borderRadius: 18, padding: 16, marginBottom: 12 },
  repBlockTitle: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: C.muted, marginBottom: 12, fontWeight: "600" },
  repGrid: { flexDirection: "row", flexWrap: "wrap" },
  repCell: { width: "50%", paddingVertical: 6 },
  repCellLabel: { fontSize: 10, color: C.muted, marginBottom: 2 },
  repCellValue: { fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-condensed", fontSize: 18, fontWeight: "700", color: C.text },
  verdict: { marginTop: 12, padding: 12, borderRadius: 12 },
  verdictText: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  ecoVerdictText: { fontSize: 12, color: C.muted, textAlign: "center", marginBottom: 10 },
  infRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  infDot: { width: 8, height: 8, borderRadius: 4 },
  infText: { fontSize: 12, color: C.text },
  infTime: { fontSize: 10, color: C.muted, marginTop: 1 },
  infDelta: { fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-condensed", fontSize: 14, fontWeight: "700" },
  emptyState: { textAlign: "center", color: C.muted, fontSize: 13, paddingVertical: 12 },
  reportActions: { flexDirection: "row", gap: 8, marginTop: 14 },
  actionBtn: { backgroundColor: C.surface2, padding: 13, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: C.border },
  actionBtnText: { fontFamily: Platform.OS === "ios" ? "System" : "sans-serif-condensed", fontSize: 14, fontWeight: "700", color: C.text },
});
