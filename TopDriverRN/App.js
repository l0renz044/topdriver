import { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, Vibration, Modal, TextInput, StatusBar, SafeAreaView,
  Linking, PermissionsAndroid, AppState, Alert
} from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { useKeepAwake } from "expo-keep-awake";
import { WebView } from "react-native-webview";
import Svg, { Circle, Text as SvgText, Path, Defs, LinearGradient, Stop, ClipPath, Rect, G } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as DocumentPicker from "expo-document-picker";

// ═══════════════════════════════════════
// CONFIG & TRANSLATIONS
// ═══════════════════════════════════════
const APP_VERSION = "v6.62-RN";
const VERSION_CHECK_URL = "https://raw.githubusercontent.com/l0renz044/topdriver/main/version.json";
const APK_URL = "https://github.com/l0renz044/topdriver/raw/main/TopDriverRN_latest.apk";

const T = {
  fr: {
    gpsRequired: "Accès GPS requis",
    gpsDesc: "TopDriver utilise votre GPS pour mesurer la vitesse et détecter les infractions, même en arrière-plan.",
    allowGps: "Autoriser le GPS",
    gpsActive: "GPS actif", gpsSearching: "Recherche…", gpsError: "Erreur GPS",
    start: "▶  DÉMARRER LE TRAJET",
    stop: "⏹  TERMINER LE TRAJET",
    newTrip: "▶  NOUVEAU TRAJET",
    generateReport: "📊  GÉNÉRER LE RAPPORT",
    safeScore: "Safe-conduite",
    infractions: "Infractions", maxSpeed: "Vit. max",
    distance: "Distance", duration: "Durée",
    limit: "Limite",
    noInfraction: "Aucune infraction 👍",
    tripEnded: "Trajet terminé",
    saved: "Rapport sauvegardé !",
    toleranceNote: "Tolérance 5 km/h",
    zoneChange: "Changement de zone",
    language: "Langue", unit: "Unité de vitesse",
    bip: "Bip d'infraction", bipOn: "Activé", bipOff: "Désactivé",
    keepAwake: "Garder l'écran actif", keepAwakeOn: "Activé", keepAwakeOff: "Désactivé",
    close: "Fermer", save: "💾  Sauvegarder",
    reportTitle: "Rapport de trajet",
    reportNameLabel: "Nom du rapport",
    departure: "Départ", arrival: "Arrivée",
    totalInf: "Infractions",
    severe: "grave", moderate: "modérée", light: "légère",
    history: "Historique", settings: "Paramètres",
    noHistory: "Aucun rapport sauvegardé.",
    deleteReport: "Supprimer",
    verdicts: [
      "Conduite très dangereuse ! ⚠️",
      "Conduite dangereuse.",
      "Conduite correcte mais améliorable.",
      "Très bonne conduite !",
      "Conduite exemplaire ! 🏆",
    ],
  },
  en: {
    gpsRequired: "GPS access required",
    gpsDesc: "TopDriver uses your GPS to measure speed and detect violations, even in background.",
    allowGps: "Allow GPS",
    gpsActive: "GPS active", gpsSearching: "Searching…", gpsError: "GPS error",
    start: "▶  START TRIP",
    stop: "⏹  END TRIP",
    newTrip: "▶  NEW TRIP",
    generateReport: "📊  GENERATE REPORT",
    safeScore: "Safe driving",
    infractions: "Violations", maxSpeed: "Max speed",
    distance: "Distance", duration: "Duration",
    limit: "Limit",
    noInfraction: "No violations 👍",
    tripEnded: "Trip ended",
    saved: "Report saved!",
    toleranceNote: "5 km/h tolerance",
    zoneChange: "Zone change",
    language: "Language", unit: "Speed unit",
    bip: "Violation beep", bipOn: "On", bipOff: "Off",
    keepAwake: "Keep screen on", keepAwakeOn: "On", keepAwakeOff: "Off",
    close: "Close", save: "💾  Save",
    reportTitle: "Trip report",
    reportNameLabel: "Report name",
    departure: "Departure", arrival: "Arrival",
    totalInf: "Violations",
    severe: "severe", moderate: "moderate", light: "minor",
    history: "History", settings: "Settings",
    noHistory: "No saved reports.",
    deleteReport: "Delete",
    verdicts: [
      "Very dangerous driving! ⚠️",
      "Dangerous driving.",
      "Acceptable but improvable.",
      "Very good driving!",
      "Exemplary driving! 🏆",
    ],
  },
};

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
const fmtTime = d => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const fmtDate = d => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtDur = s => `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, "0")}s`;
const toSpd = (kmh, u) => u === "mph" ? Math.round(kmh * 0.621371) : kmh;
const toDist = (km, u) => {
  if (u === "mph") { const mi = km * 0.621371; return mi < 0.621 ? `${Math.round(mi * 5280)} ft` : `${mi.toFixed(2)} mi`; }
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`;
};
const scoreColor = s => s >= 4 ? "#22c55e" : s >= 3 ? "#0ea5e9" : s >= 2 ? "#f59e0b" : "#f97316";
const shields10 = score => Math.max(1, Math.min(10, Math.round(score)));

// ── Barème Radars France (fixe) ────────────────
// Marge officielle des radars : +5 km/h jusqu'à 100 km/h, +5% au-delà.
function getRadarThreshold(limit) {
  const margin = limit <= 100 ? 5 : Math.round(limit * 0.05);
  return limit + margin;
}

// Filtre une liste d'épisodes (calculés par rapport à la limite stricte) pour ne
// garder, pour le calcul du SCORE, que ceux dont le dépassement dépasse la marge
// radars France. Les épisodes affichés dans le rapport restent toujours ceux
// calculés par rapport à la limite stricte (non filtrés).
function filterEpisodesForRadarScore(episodes) {
  if (!episodes || episodes.length === 0) return [];
  return episodes.filter(ep => {
    const threshold = getRadarThreshold(ep.limit);
    const margin = threshold - ep.limit;
    return ep.maxOver > margin;
  });
}

function haversine(la1, lo1, la2, lo2) {
  const R = 6371, r = Math.PI / 180;
  const dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ═══════════════════════════════════════
// BACKGROUND LOCATION TASK
// ═══════════════════════════════════════
const BG_TASK = "topdriver-bg-location";
const BG_TRAJ_KEY = "td_bg_traj";
const BG_STATE_KEY = "td_bg_state";
const OSM_ENDPOINTS_KEY = "td_osm_endpoints";
const TRIP_ACTIVE_KEY = "td_trip_active";

// Helpers disponibles dans le contexte background (pas de React)
const bgHaversine = (la1, lo1, la2, lo2) => {
  const R = 6371, r = Math.PI / 180;
  const dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Cache en mémoire de la trajectoire en cours (évite de relire/réécrire tout le JSON
// à chaque position GPS reçue — un seul flush périodique vers AsyncStorage à la place).
let bgTrajCache = null; // tableau de points, chargé une fois puis tenu à jour en mémoire
let bgTaskRunning = false; // verrou anti-chevauchement
let bgLastFlush = 0;

function resetBgTrajCache() {
  bgTrajCache = [];
  bgLastFlush = 0;
}

async function flushBgTrajCache() {
  if (bgTrajCache && bgTrajCache.length > 0) {
    try { await AsyncStorage.setItem(BG_TRAJ_KEY, JSON.stringify(bgTrajCache)); } catch {}
  }
}

TaskManager.defineTask(BG_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  if (bgTaskRunning) return;
  bgTaskRunning = true;

  try {
    // Si le trajet n'est plus actif (app fermée), on arrête le service
    const tripActive = await AsyncStorage.getItem(TRIP_ACTIVE_KEY);
    if (tripActive !== "true") {
      try { await Location.stopLocationUpdatesAsync(BG_TASK); } catch {}
      bgTaskRunning = false;
      return;
    }
    const loc = data.locations[0];
    const lat = loc.coords.latitude;
    const lon = loc.coords.longitude;
    const rawSpeed = loc.coords.speed;
    const spd = rawSpeed != null && rawSpeed >= 0 ? Math.round(rawSpeed * 3.6) : 0;
    const now = Date.now();

    // Charger le cache trajectoire en mémoire une seule fois (premier appel du process)
    if (bgTrajCache === null) {
      try {
        const rawTraj = await AsyncStorage.getItem(BG_TRAJ_KEY);
        bgTrajCache = rawTraj ? JSON.parse(rawTraj) : [];
      } catch { bgTrajCache = []; }
    }

    const rawState = await AsyncStorage.getItem(BG_STATE_KEY);
    const state = rawState ? JSON.parse(rawState) : { dist: 0, maxSpd: 0, lastPt: null };

    let added = false;
    if (!state.lastPt || bgHaversine(state.lastPt.lat, state.lastPt.lon, lat, lon) > 0.003) {
      if (state.lastPt) {
        state.dist = (state.dist || 0) + bgHaversine(state.lastPt.lat, state.lastPt.lon, lat, lon);
      }
      state.lastPt = { lat, lon };
      added = true;
    }

    state.speed = spd;
    state.lat = lat;
    state.lon = lon;
    state.maxSpd = Math.max(state.maxSpd || 0, spd);
    state.lastTs = now;

    // Ajouter le point au cache mémoire (pas d'I/O disque ici)
    if (added) {
      const lastKnownLimit = state.lastLimitOSM ?? null;
      bgTrajCache.push({ lat, lon, t: now, speed: spd, limitOSM: lastKnownLimit });
      if (bgTrajCache.length > 5000) bgTrajCache.splice(0, bgTrajCache.length - 5000);
    }

    await AsyncStorage.setItem(BG_STATE_KEY, JSON.stringify(state));

    // Flush de la trajectoire vers AsyncStorage seulement toutes les ~5s
    // (pas à chaque point), pour limiter le coût d'écriture disque
    if (added && now - bgLastFlush > 5000) {
      bgLastFlush = now;
      await AsyncStorage.setItem(BG_TRAJ_KEY, JSON.stringify(bgTrajCache));
    }

  } catch (e) {
    console.warn("BG task error:", e);
  } finally {
    bgTaskRunning = false;
  }
});

// ═══════════════════════════════════════
// MAP HTML BUILDER (Leaflet)
// ═══════════════════════════════════════
function buildMapHTML(traj, infractions = []) {
  if (!traj || traj.length < 1) return null;
  const step = Math.max(1, Math.floor(traj.length / 200));
  const pts = traj.filter((_, i) => i % step === 0).map(p => [p.lat, p.lon]);
  const lats = traj.map(p => p.lat), lons = traj.map(p => p.lon);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;
  const bounds = traj.length >= 2
    ? [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]]
    : null;
  const start = traj[0], end = traj[traj.length - 1];
  const polyline = traj.length >= 2
    ? `L.polyline(${JSON.stringify(pts)},{color:'#0ea5e9',weight:4,opacity:.9}).addTo(map);`
    : "";
  const infMarkers = infractions
    .filter(e => e.sev !== "tolerance" && e.coords)
    .map(e => `L.circleMarker([${e.coords.lat},${e.coords.lon}],{radius:7,color:'#f43f5e',fillColor:'#f43f5e',fillOpacity:.85,weight:2}).addTo(map).bindPopup('<b>${e.sev}</b><br>+${e.avgOver} km/h · ${Math.round(e.duration)}s');`)
    .join("\n");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
    <style>html,body,#map{margin:0;padding:0;width:100%;height:100%;}</style>
    </head><body><div id="map"></div><script>
    const map=L.map('map',{zoomControl:true,attributionControl:false});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
    ${polyline}
    const si=L.divIcon({html:'<div style="background:#0ea5e9;width:12px;height:12px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>',className:'',iconAnchor:[6,6]});
    L.marker([${start.lat},${start.lon}],{icon:si}).addTo(map).bindPopup('Départ');
    ${traj.length >= 2 ? `const ei=L.divIcon({html:'<div style="background:#f43f5e;width:12px;height:12px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>',className:'',iconAnchor:[6,6]});L.marker([${end.lat},${end.lon}],{icon:ei}).addTo(map).bindPopup('Arrivée');` : ""}
    ${infMarkers}
    ${bounds ? `map.fitBounds(${JSON.stringify(bounds)},{padding:[20,20]});` : `map.setView([${centerLat},${centerLon}],15);`}
    <\/script></body></html>`;
}
// Un épisode = période continue de dépassement
// Structure: { startTime, endTime, duration, avgOver, maxOver, sev, color, coords }

function sevFromOver(over) {
  // `over` est désormais le dépassement par rapport au seuil de tolérance déjà choisi
  // (mode strict/radars/tolérant) — donc over > 0 signifie déjà "infraction".
  // Cette fonction ne fait que classifier la gravité, elle ne filtre plus elle-même.
  if (over <= 0) return "tolerance";
  if (over <= 10) return "light";
  if (over <= 25) return "moderate";
  return "severe";
}

function colorFromSev(sev) {
  return sev === "tolerance" ? "#94a3b8" : sev === "severe" ? "#f43f5e" : sev === "moderate" ? "#f59e0b" : "#f97316";
}

// Pénalité = gravité × log10(durée + 1)
const SEV_WEIGHT = { light: 0.3, moderate: 0.8, severe: 1.5 };

function computeScore(episodes) {
  const counted = episodes.filter(e => e.sev !== "tolerance");
  if (!counted.length) return 10;
  const penalty = counted.reduce((sum, e) => {
    const w = SEV_WEIGHT[e.sev] || 0;
    return sum + w * Math.log10(e.duration + 1);
  }, 0);
  return Math.max(0, Math.min(10, +(10 - penalty).toFixed(2)));
}

// ── Simple map using Leaflet WebView ──────────────
const DL = { motorway: 130, motorway_link: 110, trunk: 110, trunk_link: 90, primary: 80, primary_link: 70, secondary: 80, secondary_link: 70, tertiary: 80, tertiary_link: 70, residential: 30, living_street: 20, service: 20, unclassified: 50, road: 50 };
const UL = { motorway: 110, trunk: 90, primary: 50, secondary: 50, tertiary: 50, residential: 30, living_street: 20, service: 20, unclassified: 50, road: 50 };
const BP = ["motorway", "trunk", "primary", "secondary", "tertiary", "motorway_link", "trunk_link", "primary_link", "secondary_link", "unclassified", "residential"];
const parseMs = r => { if (!r) return null; const n = parseInt(r); if (!isNaN(n) && n > 0) return n; const sp = { "fr:urban": 50, "fr:rural": 80, "fr:motorway": 130, "walk": 20 }; return sp[r.trim().toLowerCase()] ?? null; };
const cache = new Map();
let currentEndpointIdx = 0; // index du serveur actif courant (sticky server)
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

async function fetchLimit(lat, lon, endpoints) {
  const ep = (endpoints && endpoints.length > 0) ? endpoints : OVERPASS_ENDPOINTS;
  const k = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const c = cache.get(k);
  if (c && Date.now() - c.ts < 300000) return c;
  const q = `[out:json][timeout:10];way(around:50,${lat},${lon})[highway][highway!~"footway|path|steps|cycleway"];out tags 5;`;

  // Stratégie sticky : un seul appel par point GPS
  // Succès → on garde le même serveur pour le point suivant
  // Échec  → on passe au serveur suivant pour le point suivant, ce point reste en échec
  const idx = Math.min(currentEndpointIdx, ep.length - 1);
  const endpoint = ep[idx];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const r = await fetch(`${endpoint}?data=${encodeURIComponent(q)}`, {
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    clearTimeout(timeoutId);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    // Succès → serveur conservé pour le prochain point
    if (!d.elements?.length) return { limit: 50, src: "défaut" };
    const sorted = [...d.elements].sort((a, b) => {
      const ia = BP.indexOf(a.tags?.highway || "");
      const ib = BP.indexOf(b.tags?.highway || "");
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
    for (const el of sorted) {
      const v = parseMs(el.tags?.maxspeed);
      if (v) {
        const res = { limit: v, src: "OSM", road: el.tags?.name || el.tags?.ref || "", ts: Date.now() };
        cache.set(k, res); return res;
      }
    }
    const hw = sorted[0].tags?.highway || "";
    const urban = ["residential", "living_street", "service", "unclassified"].includes(hw);
    const res = { limit: (urban ? UL : DL)[hw] ?? 50, src: urban ? "agglo" : "défaut", road: sorted[0].tags?.name || "", ts: Date.now() };
    cache.set(k, res); return res;
  } catch(e) {
    console.warn(`Overpass ${endpoint} failed:`, e.message);
    // Échec → on avance au serveur suivant pour le prochain point
    currentEndpointIdx = (idx + 1) % ep.length;
    return { limit: 50, src: "hors ligne" };
  }
}

// ── User limits ──────────────────────────────


// ── Reports storage ──────────────────────────
const RK = "td_reports";
const loadReps = async () => { try { return JSON.parse(await AsyncStorage.getItem(RK) || "[]"); } catch { return []; } };
const saveReps = async r => AsyncStorage.setItem(RK, JSON.stringify(r));

// ── Export / Import / Recalculate ────────────────
async function saveReportToDownloads(report, customName) {
  try {
    const data = {
      version: "1.0", app: "TopDriver",
      exportDate: new Date().toISOString(),
      date: report.date, startTime: report.startTime, endTime: report.endTime,
      elapsed: report.elapsed, unit: report.unit || "kmh",
      points: (report.traj || []).map(p => ({ lat: p.lat, lon: p.lon, speed: p.speed, t: p.t, limitOSM: p.limitOSM })),
    };
    const json = JSON.stringify(data, null, 2);
    // Nettoyer le nom fourni par l'utilisateur (retirer caractères interdits)
    let base = (customName || "").trim().replace(/[\\/:*?"<>|]/g, "_");
    if (!base) base = `topdriver_${new Date(report.date).toISOString().slice(0, 10)}`;
    const filename = base.toLowerCase().endsWith(".json") ? base : `${base}.json`;
    // Laisser l'utilisateur choisir le dossier
    const perms = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!perms.granted) return null;
    const uri = await FileSystem.StorageAccessFramework.createFileAsync(perms.directoryUri, filename, "application/json");
    await FileSystem.writeAsStringAsync(uri, json, { encoding: "utf8" });
    return filename;
  } catch (e) { throw new Error("Sauvegarde échouée : " + e.message); }
}

async function importReport() {
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
    if (result.canceled) return null;
    const json = await FileSystem.readAsStringAsync(result.assets[0].uri);
    const data = JSON.parse(json);
    if (!data.points || !Array.isArray(data.points)) throw new Error("Format invalide");
    return data;
  } catch (e) { throw new Error("Import échoué : " + e.message); }
}

// ── Consolidation précise (transitions de limite uniquement) ──
// Calcule toujours les épisodes en mode Strict (seuil = limite réelle).
// Le score par mode de tolérance est recalculé séparément via filterEpisodesForMode.
async function consolidateInfractions(traj, onProgress) {
  if (!traj || traj.length < 2) return { episodes: [], attempts: 0, failures: 0 };

  const INTERP_DIST = 0.030; // 30m en km

  // Passe 1 : identifier le travail à faire
  //  - transitions : segments entre 2 points réels avec limitOSM différent et connu -> interpolation
  //  - trous : points réels avec limitOSM == null -> fetch direct sur ce point
  const transitions = [];
  let gapCount = 0;
  for (let i = 0; i < traj.length; i++) {
    const p = traj[i];
    if (p.limitOSM == null) gapCount++;
    if (i < traj.length - 1) {
      const p1 = traj[i], p2 = traj[i + 1];
      const lim1 = p1.limitOSM, lim2 = p2.limitOSM;
      if (lim1 != null && lim2 != null && lim1 !== lim2) {
        const segDist = haversine(p1.lat, p1.lon, p2.lat, p2.lon);
        if (segDist > INTERP_DIST) {
          const steps = Math.floor(segDist / INTERP_DIST);
          transitions.push({ i, p1, p2, steps });
        }
      }
    }
  }
  const totalPoints = transitions.reduce((s, tr) => s + tr.steps, 0) + gapCount;
  if (onProgress) onProgress(0, totalPoints);

  // Passe 2 : construire la liste enrichie, en comblant les trous et en interpolant les transitions
  const enriched = [];
  let done = 0;
  let attempts = 0, failures = 0;
  let trIdx = 0;

  for (let i = 0; i < traj.length - 1; i++) {
    const p1 = traj[i], p2 = traj[i + 1];

    // Combler le trou sur p1 si besoin (fetch direct, pas d'interpolation)
    if (p1.limitOSM == null) {
      attempts++;
      try {
        const info = await fetchLimit(p1.lat, p1.lon);
        if (info.src === "hors ligne") failures++;
        p1.limitOSM = info.limit;
      } catch { failures++; p1.limitOSM = 50; }
      done++;
      if (onProgress) onProgress(done, totalPoints);
    }
    enriched.push(p1);

    if (trIdx < transitions.length && transitions[trIdx].i === i) {
      const { steps } = transitions[trIdx];
      trIdx++;
      for (let s = 1; s <= steps; s++) {
        const ratio = s / (steps + 1);
        const ipt = {
          lat: p1.lat + (p2.lat - p1.lat) * ratio,
          lon: p1.lon + (p2.lon - p1.lon) * ratio,
          speed: p1.speed + (p2.speed - p1.speed) * ratio,
          t: p1.t + (p2.t - p1.t) * ratio,
          limitOSM: null,
          interpolated: true,
        };
        attempts++;
        try {
          const info = await fetchLimit(ipt.lat, ipt.lon);
          if (info.src === "hors ligne") failures++;
          ipt.limitOSM = info.limit;
        } catch { failures++; ipt.limitOSM = p1.limitOSM; }
        enriched.push(ipt);
        done++;
        if (onProgress) onProgress(done, totalPoints);
      }
    }
  }

  // Combler le trou sur le tout dernier point si besoin
  const lastPt = traj[traj.length - 1];
  if (lastPt.limitOSM == null) {
    attempts++;
    try {
      const info = await fetchLimit(lastPt.lat, lastPt.lon);
      if (info.src === "hors ligne") failures++;
      lastPt.limitOSM = info.limit;
    } catch { failures++; lastPt.limitOSM = 50; }
    done++;
    if (onProgress) onProgress(done, totalPoints);
  }
  enriched.push(lastPt);

  // Recalculer les épisodes sur la liste enrichie (toujours mode Strict)
  const episodes = [];
  let curEp = null;
  for (let i = 0; i < enriched.length; i++) {
    const pt = enriched[i];
    const lim = pt.limitOSM ?? 50;
    const delta = Math.round(pt.speed) - lim;
    if (delta > 0) {
      if (!curEp) {
        curEp = { startTime: new Date(pt.t).toISOString(), startTs: pt.t, overValues: [delta], limit: lim, coords: { lat: pt.lat, lon: pt.lon } };
      } else { curEp.overValues.push(delta); }
    } else if (curEp) {
      const duration = Math.round((pt.t - curEp.startTs) / 1000);
      const avgOver = Math.round(curEp.overValues.reduce((s, v) => s + v, 0) / curEp.overValues.length);
      const maxOver = Math.max(...curEp.overValues);
      const sev = sevFromOver(avgOver);
      if (sev !== "tolerance") episodes.push({ startTime: curEp.startTime, endTime: new Date(pt.t).toISOString(), duration, avgOver, maxOver, limit: curEp.limit, sev, color: colorFromSev(sev), coords: curEp.coords });
      curEp = null;
    }
  }
  if (curEp && enriched.length > 0) {
    const last = enriched[enriched.length - 1];
    const duration = Math.round((last.t - curEp.startTs) / 1000);
    const avgOver = Math.round(curEp.overValues.reduce((s, v) => s + v, 0) / curEp.overValues.length);
    const maxOver = Math.max(...curEp.overValues);
    const sev = sevFromOver(avgOver);
    if (sev !== "tolerance") episodes.push({ startTime: curEp.startTime, endTime: new Date(last.t).toISOString(), duration, avgOver, maxOver, limit: curEp.limit, sev, color: colorFromSev(sev), coords: curEp.coords });
  }
  return { episodes, attempts, failures };
}

// ── Beep ─────────────────────────────────────
const beep = type => Vibration.vibrate(type === "severe" ? [0, 200, 100, 200] : [0, 150]);

// ═══════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════

// Bouclier SVG — 3 états :
// full  : haut-gauche bleu + bas-droit bleu (SVG original)
// half  : haut-gauche bleu uniquement
// empty : tout gris
const SHIELD_BLUE = "#5F83CF";
const SHIELD_GREY = "#C0C0C0";
const SHIELD_PATH = "M36.95987,13.15124l-0.02002,2.14001c0,7.85998-3.27002,15.27997-8.81,19.97998l-4.02067,3.40882c-0.06886,0.05838-0.16984,0.05838-0.2387,0l-4.02066-3.40882c-5.53998-4.70001-8.81-12.12-8.81-19.97998l-0.00001-1.68753c0-0.38642,0.42222-0.58507,0.75086-0.38179c1.83846,1.1372,5.85839,0.4789,8.6692-0.94069c1.54999-0.77002,2.81-1.77997,3.29999-2.84998c0.09998-0.20001,0.37-0.21002,0.46002-0.01001c0.50995,1.07001,1.81995,2.08997,3.41998,2.85999c3.13,1.53998,7.39996,2.22998,8.96997,0.72003C36.73984,12.87127,36.96988,12.96124,36.95987,13.15124z";

function ShieldIcon({ state = "full", size = 52 }) {
  const uid = `sh_${state}_${size}`;
  return (
    <Svg width={size} height={size} viewBox="10 7 28 34">
      <Defs>
        <ClipPath id={`cl_${uid}`}>
          <Rect x="0" y="0" width="24" height="48" />
        </ClipPath>
      </Defs>
      {/* Fond gris toujours présent */}
      <Path d={SHIELD_PATH} fill={SHIELD_GREY} />
      {/* Partie bleue selon état */}
      {state === "full" && <Path d={SHIELD_PATH} fill={SHIELD_BLUE} />}
      {state === "half" && <Path d={SHIELD_PATH} fill={SHIELD_BLUE} clipPath={`url(#cl_${uid})`} />}
      {/* Contour blanc + liseré noir fin */}
      <Path d={SHIELD_PATH} fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d={SHIELD_PATH} fill="none" stroke="#303030" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Composant principal : score 0-10 → 5 boucliers avec demi-boucliers
const Shields = ({ score, size = 52 }) => {
  // score sur 10 → valeur sur 5 avec pas de 0.5
  const val = Math.max(0, Math.min(10, score)) / 2; // 0 à 5
  const shields = [0, 1, 2, 3, 4].map(i => {
    const diff = val - i;
    if (diff >= 1) return "full";
    if (diff >= 0.5) return "half";
    return "empty";
  });
  return (
    <View style={{ flexDirection: "row", gap: 0, alignItems: "center" }}>
      {shields.map((state, i) => <ShieldIcon key={i} state={state} size={size} />)}
    </View>
  );
};

// Jauge circulaire simple avec View
const Gauge = ({ speed, limit, active, unit }) => {
  const ds = toSpd(speed, unit);
  const dl = toSpd(limit, unit);
  const color = speed > limit * 1.1 ? C.red : speed > limit + 5 ? C.warn : C.blue;
  return (
    <View style={gs.gaugeOuter}>
      <View style={[gs.gaugeRing, { borderColor: "#e2e8f0" }]} />
      <View style={[gs.gaugeRing, { borderColor: active ? color : "#e2e8f0", borderLeftColor: "transparent", borderBottomColor: "transparent", transform: [{ rotate: "45deg" }] }]} />
      <View style={gs.gaugeCenter}>
        <Text style={[gs.gaugeNum, { color: active ? color : C.muted }]}>{active ? ds : "--"}</Text>
        <Text style={gs.gaugeUnit}>{unit === "mph" ? "mph" : "km/h"}</Text>
      </View>
    </View>
  );
};

// Toast
const Toast = ({ msg }) => msg ? (
  <View style={gs.toast} pointerEvents="none">
    <Text style={gs.toastTxt}>{msg}</Text>
  </View>
) : null;

// ═══════════════════════════════════════
// MODAL: LIMIT EDITOR
// ═══════════════════════════════════════
// ═══════════════════════════════════════
// MODAL: REPORT
// ═══════════════════════════════════════
// Panneau de limitation SVG (style panneau français)
function SpeedSign({ limit, size = 48 }) {
  const digits = String(limit).length;
  const fontSize = digits >= 3 ? 28 : 40;
  const yOffset = digits >= 3 ? 64 : 66;
  return (
    <Svg width={size} height={size} viewBox="0 0 110 110">
      <Circle cx="55" cy="55" r="46" fill="white" stroke="#cc0000" strokeWidth="14" />
      <SvgText x="55" y={yOffset} textAnchor="middle"
        fontSize={fontSize} fontWeight="bold" fill="#111">{limit}</SvgText>
    </Svg>
  );
}

// Liste d'infractions groupées par limitation, avec accordéon
function InfractionGroups({ infractions, unit, ul, t, toSpd, fmtTime, fmtDur }) {
  const counted = (infractions || []).filter(ep => ep.sev !== "tolerance");
  const [openGroups, setOpenGroups] = useState({});

  if (counted.length === 0) {
    return (
      <View style={gs.block}>
        <Text style={gs.blockTitle}>🚨 {t.totalInf}</Text>
        <Text style={gs.empty}>{t.noInfraction}</Text>
      </View>
    );
  }

  // Grouper par limite, trier par ordre croissant
  const groups = {};
  counted.forEach(ep => {
    const k = ep.limit;
    if (!groups[k]) groups[k] = [];
    groups[k].push(ep);
  });
  const sortedLimits = Object.keys(groups).map(Number).sort((a, b) => a - b);

  const toggle = limit => setOpenGroups(prev => ({ ...prev, [limit]: !prev[limit] }));

  return (
    <View style={gs.block}>
      <Text style={[gs.blockTitle, { marginBottom: 10 }]}>🚨 {t.totalInf} ({counted.length})</Text>
      {sortedLimits.map(limit => {
        const eps = groups[limit];
        const isOpen = !!openGroups[limit];
        return (
          <View key={limit} style={{ marginBottom: 8 }}>
            {/* En-tête du groupe — panneau + compteur */}
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }}
              onPress={() => toggle(limit)}
              activeOpacity={0.7}
            >
              <SpeedSign limit={limit} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>
                  Zone {toSpd(limit, unit)} {ul}
                </Text>
                <Text style={{ fontSize: 12, color: C.muted }}>
                  {eps.length} infraction{eps.length > 1 ? "s" : ""}
                </Text>
              </View>
              <Text style={{ fontSize: 18, color: C.muted }}>{isOpen ? "▲" : "▼"}</Text>
            </TouchableOpacity>

            {/* Liste dépliée */}
            {isOpen && (
              <View style={{ paddingLeft: 56, gap: 6 }}>
                {eps.map((ep, i) => (
                  <View key={i} style={[gs.infRow, { marginBottom: 0 }]}>
                    <View style={[gs.infDot, { backgroundColor: ep.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={gs.infTxt}>
                        +{toSpd(ep.avgOver, unit)} {ul} moy. · max +{toSpd(ep.maxOver, unit)}
                      </Text>
                      <Text style={gs.infTime}>
                        {fmtTime(new Date(ep.startTime))} · {fmtDur(ep.duration)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Séparateur entre groupes */}
            {sortedLimits.indexOf(limit) < sortedLimits.length - 1 && (
              <View style={{ height: 1, backgroundColor: C.border, marginTop: 6 }} />
            )}
          </View>
        );
      })}
    </View>
  );
}

function ReportModal({ visible, report, t, unit, onClose, onSave, onConsolidate, isProcessing, processingProgress }) {
  if (!report) return null;
  const inf = report.infractions || []; // toujours par rapport à la limite stricte
  const sc = report.score ?? 10;
  const val5 = sc / 2; // score 0-10 → 0-5 pour l'affichage
  const counted = inf.filter(i => i.sev !== "tolerance");
  const ul = unit === "mph" ? "mph" : "km/h";
  const vColors = ["#f43f5e", "#f97316", "#f59e0b", "#0ea5e9", "#22c55e"];
  const verdictIdx = Math.min(4, Math.floor(val5)); // 0-1→0, 1-2→1, 2-3→2, 3-4→3, 4-5→4
  const colorIdx = Math.min(4, Math.floor(val5));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={gs.modalHeader}>
          <Text style={gs.modalTitle}>{t.reportTitle}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* Nom du rapport */}
          <View style={[gs.block, { marginBottom: 12 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={gs.histName}>{report.name || "Rapport de trajet"}</Text>
              {report.consolidatedDate && !isProcessing && (
                <Text style={{ fontSize: 11, color: "#22c55e", fontWeight: "700" }}>✅</Text>
              )}
              {isProcessing && (
                <Text style={{ fontSize: 11, color: C.blue, fontWeight: "700" }}>⏳</Text>
              )}
            </View>
            <Text style={gs.histDate}>{report.date ? fmtDate(new Date(report.date)) : ""}</Text>
          </View>

          {/* Bloc 1 — Safe-conduite */}
          <View style={gs.block}>
            <Text style={gs.blockTitle}>🛡️ {t.safeScore}</Text>
            <View style={{ alignItems: "center", marginVertical: 10 }}>
              <Shields score={sc} size={52} />
            </View>
            <View style={gs.grid2}>
              <View style={gs.cell}><Text style={gs.cellLbl}>{t.departure}</Text><Text style={gs.cellVal}>{report.startTime ? fmtTime(new Date(report.startTime)) : "--"}</Text></View>
              <View style={gs.cell}><Text style={gs.cellLbl}>{t.arrival}</Text><Text style={gs.cellVal}>{report.endTime ? fmtTime(new Date(report.endTime)) : "--"}</Text></View>
              <View style={gs.cell}><Text style={gs.cellLbl}>{t.duration}</Text><Text style={gs.cellVal}>{fmtDur(report.elapsed || 0)}</Text></View>
              <View style={gs.cell}><Text style={gs.cellLbl}>{t.distance}</Text><Text style={gs.cellVal}>{toDist(report.dist || 0, unit)}</Text></View>
              <View style={gs.cell}><Text style={gs.cellLbl}>{t.maxSpeed}</Text><Text style={gs.cellVal}>{toSpd(report.maxSpd || 0, unit)} {ul}</Text></View>
              <View style={gs.cell}><Text style={gs.cellLbl}>{t.totalInf}</Text><Text style={[gs.cellVal, { color: counted.length ? C.red : C.green }]}>{counted.length}</Text></View>
            </View>
            <View style={[gs.verdict, { backgroundColor: vColors[colorIdx] + "20" }]}>
              <Text style={[gs.verdictTxt, { color: vColors[colorIdx] }]}>{t.verdicts[verdictIdx]}</Text>
            </View>
          </View>

          {/* Bloc 2 — Infractions */}
          {/* Bloc 3 — Carte */}
          {report.traj && report.traj.length >= 1 && (() => {
            const html = buildMapHTML(report.traj, report.infractions || []);
            return html ? (
              <View style={gs.block}>
                <Text style={gs.blockTitle}>🗺 Trajet</Text>
                <View style={{ height: 240, borderRadius: 12, overflow: "hidden" }}>
                  <WebView
                    source={{ html }}
                    style={{ flex: 1 }}
                    scrollEnabled={false}
                    javaScriptEnabled
                    originWhitelist={["*"]}
                  />
                </View>
                <Text style={[gs.cellLbl, { marginTop: 6, textAlign: "right" }]}>
                  {report.traj.length} pts GPS
                  {report.osmAttempts != null && ` · 📡 ${report.osmAttempts} req. OSM`}
                  {report.osmAttempts != null && report.osmFailures > 0 && ` · ${report.osmFailures} échecs`}
                </Text>
              </View>
            ) : null;
          })()}

          {/* Bloc 4 — Épisodes d'infractions groupés par limitation */}
          <InfractionGroups infractions={inf} unit={unit} ul={ul} t={t} toSpd={toSpd} fmtTime={fmtTime} fmtDur={fmtDur} />

          {isProcessing && processingProgress?.total > 0 && (
            <View style={[gs.block, { backgroundColor: "rgba(14,165,233,.08)", marginBottom: 12 }]}>
              <Text style={{ fontSize: 12, color: C.blue, textAlign: "center", fontWeight: "700" }}>
                ⏳ Consolidation en cours... {processingProgress.done} / {processingProgress.total} points
              </Text>
            </View>
          )}
          {onSave && (
            <TouchableOpacity style={[gs.btn, gs.btnBlue]} onPress={async () => {
              await onSave();
              onClose();
            }}>
              <Text style={gs.btnTxt}>{t.save}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[gs.btn, gs.btnGhost]} onPress={onClose}>
            <Text style={gs.btnGhostTxt}>{t.close}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ═══════════════════════════════════════
// MODAL: HISTORY
// ═══════════════════════════════════════
function HistoryModal({ visible, reports, t, unit, onClose, onDelete, onView, onSaveFile, onImport, processingId }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={gs.modalHeader}>
          <Text style={gs.modalTitle}>{t.history}</Text>
          <TouchableOpacity onPress={onClose} style={gs.closeBtn}>
            <Text style={gs.closeBtnTxt}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <TouchableOpacity style={[gs.btn, gs.btnBlue, { marginBottom: 16 }]} onPress={onImport}>
            <Text style={gs.btnTxt}>📥 Importer un trajet</Text>
          </TouchableOpacity>
          {reports.length === 0 && <Text style={gs.empty}>{t.noHistory}</Text>}
          {reports.map(rep => (
            <View key={rep.id} style={gs.histItem}>
              <TouchableOpacity onPress={() => onView(rep)}>
                <View style={gs.histTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={gs.histName}>{rep.name || "Rapport"}{rep.imported ? " 📥" : ""}</Text>
                    <Text style={gs.histDate}>{new Date(rep.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Text>
                    {rep.consolidatedDate && <Text style={[gs.histDate, { color: "#22c55e" }]}>✅ Consolidé à {new Date(rep.consolidatedDate).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</Text>}
                    {processingId === rep.id && <Text style={[gs.histDate, { color: C.blue, fontWeight: "700" }]}>⏳ Consolidation en cours...</Text>}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Shields score={rep.score ?? 5} size={32} />
                  </View>
                </View>
                <Text style={gs.histMeta}>{toDist(rep.dist, rep.unit || "kmh")} · {fmtDur(rep.elapsed)} · {rep.infractions?.filter(i => i.sev !== "tolerance").length || 0} épisodes</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                <TouchableOpacity style={[gs.delBtn, { flex: 1, borderColor: "rgba(14,165,233,.3)", backgroundColor: "rgba(14,165,233,.06)" }]} onPress={() => onSaveFile(rep)}>
                  <Text style={[gs.delTxt, { color: C.blue }]}>💾  Sauvegarder</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[gs.delBtn, { flex: 1 }]} onPress={() => onDelete(rep.id)}>
                  <Text style={gs.delTxt}>🗑  {t.deleteReport}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ═══════════════════════════════════════
// MODAL: SAVE FILE (saisie du nom de fichier)
// ═══════════════════════════════════════
function SaveFileModal({ visible, defaultName, onCancel, onConfirm }) {
  const nameRef = useRef(defaultName || "");
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={gs.saveFileOverlay}>
        <View style={gs.saveFileBox}>
          <Text style={gs.saveFileTitle}>💾 Nom du fichier</Text>
          <TextInput
            style={gs.nameInput}
            defaultValue={defaultName}
            onChangeText={v => { nameRef.current = v; }}
            placeholder="topdriver_2026-06-17"
            placeholderTextColor={C.muted}
            autoFocus
          />
          <Text style={[gs.cellLbl, { marginTop: 6 }]}>L'extension .json sera ajoutée automatiquement</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            <TouchableOpacity style={[gs.btn, gs.btnGhost, { flex: 1, marginBottom: 0 }]} onPress={onCancel}>
              <Text style={gs.btnGhostTxt}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[gs.btn, gs.btnBlue, { flex: 1, marginBottom: 0 }]} onPress={() => onConfirm(nameRef.current)}>
              <Text style={gs.btnTxt}>Sauvegarder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


// ═══════════════════════════════════════
// MODAL: SETTINGS
// ═══════════════════════════════════════
const KNOWN_OSM_SERVERS = [
  { label: "overpass-api.de", url: "https://overpass-api.de/api/interpreter" },
  { label: "kumi.systems", url: "https://overpass.kumi.systems/api/interpreter" },
  { label: "maps.mail.ru", url: "https://maps.mail.ru/osm/tools/overpass/api/interpreter" },
  { label: "private.coffee", url: "https://overpass.private.coffee/api/interpreter" },
  { label: "lz4.overpass-api.de", url: "https://lz4.overpass-api.de/api/interpreter" },
  { label: "Personnalisé...", url: "" },
];

function OsmServerRow({ label, url, setUrl, rank, setRank }) {
  const [testStatus, setTestStatus] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  const isCustom = !KNOWN_OSM_SERVERS.slice(0, -1).some(s => s.url === url);
  const selectedLabel = isCustom ? "Personnalisé..." : (KNOWN_OSM_SERVERS.find(s => s.url === url)?.label || "Personnalisé...");

  const testServer = async () => {
    if (!url.trim()) return;
    setTestStatus("testing");
    try {
      const q = `[out:json][timeout:5];way(around:50,48.8566,2.3522)[highway];out tags 1;`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const r = await fetch(`${url.trim()}?data=${encodeURIComponent(q)}`, {
        signal: controller.signal,
        headers: { "Accept": "application/json" },
      });
      clearTimeout(timeoutId);
      setTestStatus(r.ok ? "ok" : "fail");
    } catch { setTestStatus("fail"); }
  };

  return (
    <View style={{ marginBottom: 12, backgroundColor: C.surface2, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border }}>
      <Text style={[gs.settingLbl, { marginBottom: 8 }]}>{label}</Text>

      {/* Menu déroulant simulé */}
      <TouchableOpacity
        style={{ borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10, marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
        onPress={() => setShowPicker(v => !v)}
      >
        <Text style={{ color: C.text, fontSize: 13 }}>{selectedLabel}</Text>
        <Text style={{ color: C.muted }}>{showPicker ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {showPicker && (
        <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 8, marginBottom: 8, overflow: "hidden" }}>
          {KNOWN_OSM_SERVERS.map(s => (
            <TouchableOpacity
              key={s.label}
              style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: url === s.url ? C.blue + "18" : C.surface }}
              onPress={() => { setUrl(s.url); setTestStatus(null); setShowPicker(false); }}
            >
              <Text style={{ color: url === s.url ? C.blue : C.text, fontSize: 13, fontWeight: url === s.url ? "700" : "400" }}>{s.label}</Text>
              {s.url ? <Text style={{ color: C.muted, fontSize: 10 }}>{s.url}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Champ texte libre si personnalisé */}
      {isCustom && (
        <TextInput
          style={[gs.pollInput, { width: "100%", textAlign: "left", paddingHorizontal: 10, fontSize: 11, marginBottom: 8 }]}
          value={url}
          onChangeText={v => { setUrl(v); setTestStatus(null); }}
          placeholder="https://mon-serveur.com/api/interpreter"
          placeholderTextColor={C.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      )}

      {/* Rang + Tester */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={[gs.settingLbl, { marginBottom: 0 }]}>Rang :</Text>
        <TextInput
          style={[gs.pollInput, { width: 48 }]}
          value={rank}
          onChangeText={v => { const n = parseInt(v, 10); if (v === "") { setRank(""); return; } if (!isNaN(n) && n > 0) setRank(String(n)); }}
          keyboardType="number-pad"
          maxLength={1}
          placeholder="—"
          placeholderTextColor={C.muted}
        />
        <TouchableOpacity
          style={{ backgroundColor: C.blue, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 }}
          onPress={testServer}
          disabled={testStatus === "testing" || !url.trim()}
        >
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
            {testStatus === "testing" ? "⏳" : "Tester"}
          </Text>
        </TouchableOpacity>
        {testStatus === "ok" && <Text style={{ color: "#22c55e", fontWeight: "700" }}>✅</Text>}
        {testStatus === "fail" && <Text style={{ color: C.red, fontWeight: "700" }}>❌</Text>}
      </View>
    </View>
  );
}

function SettingsModal({ visible, lang, setLang, unit, setUnit, bipEnabled, setBipEnabled, keepAwake, setKeepAwake, pollUrban, setPollUrban, pollRoad, setPollRoad, osmServer1Url, setOsmServer1Url, osmServer1Rank, setOsmServer1Rank, osmServer2Url, setOsmServer2Url, osmServer2Rank, setOsmServer2Rank, osmServer3Url, setOsmServer3Url, osmServer3Rank, setOsmServer3Rank, t, onClose }) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={gs.modalHeader}>
          <Text style={gs.modalTitle}>{t.settings}</Text>
          <TouchableOpacity onPress={onClose} style={gs.closeBtn}>
            <Text style={gs.closeBtnTxt}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>

          {/* ── Paramètres généraux ── */}
          <SettingRow label={t.language}>
            <ToggleGroup options={[{ v: "fr", l: "FR" }, { v: "en", l: "EN" }]} value={lang} onChange={setLang} />
          </SettingRow>
          <SettingRow label={t.unit}>
            <ToggleGroup options={[{ v: "kmh", l: "km/h" }, { v: "mph", l: "mph" }]} value={unit} onChange={setUnit} />
          </SettingRow>
          <SettingRow label={t.bip}>
            <ToggleGroup options={[{ v: true, l: t.bipOn }, { v: false, l: t.bipOff }]} value={bipEnabled} onChange={setBipEnabled} />
          </SettingRow>
          <SettingRow label={t.keepAwake} last>
            <ToggleGroup options={[{ v: true, l: t.keepAwakeOn }, { v: false, l: t.keepAwakeOff }]} value={keepAwake} onChange={setKeepAwake} />
          </SettingRow>

          {/* ── Paramètres avancés ── */}
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 12 }}
            onPress={() => setShowAdvanced(v => !v)}
          >
            <Text style={gs.blockTitle}>⚙️ Paramètres avancés</Text>
            <Text style={{ fontSize: 18, color: C.muted }}>{showAdvanced ? "▲" : "▼"}</Text>
          </TouchableOpacity>

          {showAdvanced && (
            <>
              {/* Fréquence OSM */}
              <Text style={[gs.cellLbl, { marginBottom: 4 }]}>Fréquence d'interrogation OSM (secondes, min. 2s)</Text>
              <Text style={[gs.cellLbl, { marginBottom: 10, fontSize: 11 }]}>Basée sur la limitation OSM en cours.</Text>
              <View style={gs.settingRow}>
                <Text style={gs.settingLbl}>Zone urbaine (≤ 70 km/h)</Text>
                <TextInput
                  style={gs.pollInput}
                  value={pollUrban}
                  onChangeText={v => { const n = parseInt(v, 10); if (v === "") { setPollUrban(""); return; } if (!isNaN(n)) setPollUrban(String(Math.max(2, n))); }}
                  keyboardType="number-pad" maxLength={3}
                />
              </View>
              <View style={[gs.settingRow, { marginBottom: 20 }]}>
                <Text style={gs.settingLbl}>Route/Autoroute ({'>'} 70 km/h)</Text>
                <TextInput
                  style={gs.pollInput}
                  value={pollRoad}
                  onChangeText={v => { const n = parseInt(v, 10); if (v === "") { setPollRoad(""); return; } if (!isNaN(n)) setPollRoad(String(Math.max(2, n))); }}
                  keyboardType="number-pad" maxLength={3}
                />
              </View>

              {/* Serveurs OSM */}
              <Text style={[gs.blockTitle, { marginBottom: 4 }]}>Serveurs OSM</Text>
              <Text style={[gs.cellLbl, { marginBottom: 12, fontSize: 11 }]}>
                Interrogés dans l'ordre du rang (croissant). Rang vide = désactivé.
              </Text>
              <OsmServerRow label="Serveur 1" url={osmServer1Url} setUrl={setOsmServer1Url} rank={osmServer1Rank} setRank={setOsmServer1Rank} />
              <OsmServerRow label="Serveur 2" url={osmServer2Url} setUrl={setOsmServer2Url} rank={osmServer2Rank} setRank={setOsmServer2Rank} />
              <OsmServerRow label="Serveur 3" url={osmServer3Url} setUrl={setOsmServer3Url} rank={osmServer3Rank} setRank={setOsmServer3Rank} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const SettingRow = ({ label, children, last }) => (
  <View style={[gs.settingRow, last && { borderBottomWidth: 0 }]}>
    <Text style={gs.settingLbl}>{label}</Text>
    {children}
  </View>
);

const ToggleGroup = ({ options, value, onChange }) => (
  <View style={{ flexDirection: "row", gap: 6 }}>
    {options.map(o => (
      <TouchableOpacity key={String(o.v)} style={[gs.toggleBtn, o.v === value && gs.toggleBtnOn]} onPress={() => onChange(o.v)}>
        <Text style={[gs.toggleTxt, o.v === value && gs.toggleTxtOn]}>{o.l}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

// ═══════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════
export default function App() {
  const [lang, setLang] = useState("fr");
  const [unit, setUnit] = useState("kmh");
  const [bipEnabled, setBipEnabled] = useState(true);
  const [keepAwake, setKeepAwake] = useState(true);
  const [pollUrban, setPollUrban] = useState("5");
  const [pollRoad, setPollRoad] = useState("15");
  // Serveurs OSM configurables (url + rang, vide = désactivé)
  const [osmServer1Url, setOsmServer1Url] = useState("https://overpass-api.de/api/interpreter");
  const [osmServer1Rank, setOsmServer1Rank] = useState("1");
  const [osmServer2Url, setOsmServer2Url] = useState("https://overpass.kumi.systems/api/interpreter");
  const [osmServer2Rank, setOsmServer2Rank] = useState("2");
  const [osmServer3Url, setOsmServer3Url] = useState("https://maps.mail.ru/osm/tools/overpass/api/interpreter");
  const [osmServer3Rank, setOsmServer3Rank] = useState("3");
  const settingsLoaded = useRef(false);

  // Liste ordonnée des endpoints actifs (recalculée à chaque changement de config)
  const osmEndpointsRef = useRef(OVERPASS_ENDPOINTS);
  useEffect(() => {
    const servers = [
      { url: osmServer1Url, rank: osmServer1Rank },
      { url: osmServer2Url, rank: osmServer2Rank },
      { url: osmServer3Url, rank: osmServer3Rank },
    ];
    const active = servers
      .filter(s => s.url.trim() && s.rank !== "" && !isNaN(parseInt(s.rank, 10)))
      .sort((a, b) => parseInt(a.rank, 10) - parseInt(b.rank, 10))
      .map(s => s.url.trim());
    const endpoints = active.length > 0 ? active : OVERPASS_ENDPOINTS;
    osmEndpointsRef.current = endpoints;
    // Persiste pour le TaskManager qui n'a pas accès aux états React
    AsyncStorage.setItem(OSM_ENDPOINTS_KEY, JSON.stringify(endpoints)).catch(() => {});
  }, [osmServer1Url, osmServer1Rank, osmServer2Url, osmServer2Rank, osmServer3Url, osmServer3Rank]);

  // Sauvegarder les paramètres uniquement après le chargement initial
  useEffect(() => {
    if (!settingsLoaded.current) return;
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({
      lang, unit, bipEnabled, keepAwake, pollUrban, pollRoad,
      osmServer1Url, osmServer1Rank, osmServer2Url, osmServer2Rank, osmServer3Url, osmServer3Rank,
    }));
  }, [lang, unit, bipEnabled, keepAwake, pollUrban, pollRoad,
      osmServer1Url, osmServer1Rank, osmServer2Url, osmServer2Rank, osmServer3Url, osmServer3Rank]);
  useKeepAwake(keepAwake && active ? "trip" : undefined);
  const t = T[lang];

  // Screens
  const [screen, setScreen] = useState("perm"); // perm | battery | main | end
  const [gpsStatus, setGpsStatus] = useState("idle");
  const [toast, setToast] = useState(null);

  // Modals
  const [showReport, setShowReport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [viewingRep, setViewingRep] = useState(null);
  const [savingRep, setSavingRep] = useState(null);

  // Trip state
  const [active, setActive] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [limitInfo, setLimitInfo] = useState({ limit: 50, src: "—", road: "" });
  const [infractions, setInfractions] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [maxSpd, setMaxSpd] = useState(0);
  const [traj, setTraj] = useState([]);
  const [dist, setDist] = useState(0);
  const [zoneCooldown, setZoneCooldown] = useState(0);
  const [reports, setReports] = useState([]);
  const [processingId, setProcessingId] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null); // { latest, url } si mise à jour dispo
  const [currentConsolidatedDate, setCurrentConsolidatedDate] = useState(null);
  const [processingLabel, setProcessingLabel] = useState("");
  const [processingProgress, setProcessingProgress] = useState({ done: 0, total: 0 });
  const [reportName, setReportName] = useState("Rapport de trajet");

  // Refs
  const locSub = useRef(null);
  const timerRef = useRef(null);
  const syncInterval = useRef(null);
  const startTimeRef = useRef(null);
  const activeRef = useRef(false);
  const trajRef = useRef([]);
  const limRef = useRef({ limit: 50 });
  const infRef = useRef([]);      // épisodes terminés
  const curEpRef = useRef(null);  // épisode en cours
  const lastFetch = useRef(0);
  const coolRef = useRef(0);
  const lastPosRef = useRef(null); // dernière position GPS reçue (pour calcul distance)
  const SETTINGS_KEY = "td_settings";
  const adaptRef = useRef(15000);
  const osmAttemptsRef = useRef(0);
  const osmFailuresRef = useRef(0);
  const [osmStats, setOsmStats] = useState({ attempts: 0, failures: 0 });
  const currentConsolidated = useRef(null);
  const lastOsm = useRef(50);
  const distRef = useRef(0);
  const bipRef = useRef(true);

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { limRef.current = limitInfo; }, [limitInfo]);
  useEffect(() => { coolRef.current = zoneCooldown; }, [zoneCooldown]);
  useEffect(() => { bipRef.current = bipEnabled; }, [bipEnabled]);

  useEffect(() => {
    loadReps().then(setReports);
    // Vérifier si une nouvelle version est disponible
    fetch(VERSION_CHECK_URL, { headers: { "Cache-Control": "no-cache" } })
      .then(r => r.json())
      .then(data => {
        if (data?.latest && data.latest !== APP_VERSION) {
          setUpdateInfo({ latest: data.latest });
        }
      })
      .catch(() => {}); // silencieux si pas de réseau
    // Charger les paramètres sauvegardés
    AsyncStorage.getItem(SETTINGS_KEY).then(raw => {
      if (raw) {
        try {
          const s = JSON.parse(raw);
          if (s.lang) setLang(s.lang);
          if (s.unit) setUnit(s.unit);
          if (s.bipEnabled !== undefined) setBipEnabled(s.bipEnabled);
          if (s.keepAwake !== undefined) setKeepAwake(s.keepAwake);
          if (s.pollUrban) setPollUrban(s.pollUrban);
          if (s.pollRoad) setPollRoad(s.pollRoad);
          if (s.osmServer1Url) setOsmServer1Url(s.osmServer1Url);
          if (s.osmServer1Rank !== undefined) setOsmServer1Rank(s.osmServer1Rank);
          if (s.osmServer2Url) setOsmServer2Url(s.osmServer2Url);
          if (s.osmServer2Rank !== undefined) setOsmServer2Rank(s.osmServer2Rank);
          if (s.osmServer3Url) setOsmServer3Url(s.osmServer3Url);
          if (s.osmServer3Rank !== undefined) setOsmServer3Rank(s.osmServer3Rank);
        } catch {}
      }
      settingsLoaded.current = true;
    });
  }, []);

  // Sync depuis le background quand l'app revient au premier plan
  useEffect(() => {
    const sub = AppState.addEventListener("change", async nextState => {
      if (nextState === "background" && !activeRef.current) {
        // App fermée sans trajet actif → arrêter le foreground service
        try {
          const isRegistered = await TaskManager.isTaskRegisteredAsync(BG_TASK);
          if (isRegistered) await Location.stopLocationUpdatesAsync(BG_TASK);
        } catch {}
      }
      if (nextState === "active" && activeRef.current) {
        try {
          // Lire la trajectoire accumulée en arrière-plan
          const rawTraj = await AsyncStorage.getItem(BG_TRAJ_KEY);
          if (rawTraj) {
            const bgTraj = JSON.parse(rawTraj);
            if (bgTraj.length > trajRef.current.length) {
              trajRef.current = bgTraj;
              setTraj([...bgTraj]);
            }
          }
          // Lire l'état courant
          const rawState = await AsyncStorage.getItem(BG_STATE_KEY);
          if (rawState) {
            const bgState = JSON.parse(rawState);
            if (bgState.maxSpd) setMaxSpd(prev => Math.max(prev, bgState.maxSpd));
            if (bgState.dist) { distRef.current = bgState.dist; setDist(bgState.dist); }
            if (bgState.speed != null) setSpeed(bgState.speed);
          }
        } catch {}
      }
      // Si l'app passe en arrière-plan sans trajet actif → arrêter le foreground service
      if (nextState === "background" && !activeRef.current) {
        try {
          const isRegistered = await TaskManager.isTaskRegisteredAsync(BG_TASK);
          if (isRegistered) await Location.stopLocationUpdatesAsync(BG_TASK);
        } catch {}
      }
    });
    return () => sub.remove();
  }, []);

  // Demander permission notifications au démarrage sur Android 13+
  useEffect(() => {
    if (Platform.OS === "android" && Platform.Version >= 33) {
      PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      ).catch(() => {});
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") setScreen("main");
    })();
  }, []);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const requestGPS = async () => {
    setGpsStatus("searching");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") { setGpsStatus("error"); return; }
    // Demander aussi la permission arrière-plan
    await Location.requestBackgroundPermissionsAsync();
    setGpsStatus("ok");
    // Afficher l'écran explicatif batterie avant de déclencher la popup système
    setScreen("battery");
  };

  const requestBatteryExemption = async () => {
    if (Platform.OS === "android") {
      try {
        // Écran dédié "Batterie" pour l'app (plus fiable que la popup automatique sur Android 16)
        await IntentLauncher.startActivityAsync(
          "android.settings.APPS_ENERGY_USAGE_SETTINGS",
          { data: "package:com.topdriver.app" }
        );
      } catch {
        try {
          // Repli : écran général "Informations sur l'application", d'où on accède à Batterie
          await IntentLauncher.startActivityAsync(
            "android.settings.APPLICATION_DETAILS_SETTINGS",
            { data: "package:com.topdriver.app" }
          );
        } catch {
          try { await Linking.openSettings(); } catch {}
        }
      }
    }
    setScreen("main");
  };

  const score = computeScore(filterEpisodesForRadarScore(infractions));

  const startTrip = async () => {
    setInfractions([]); infRef.current = []; curEpRef.current = null;
    setElapsed(0); setMaxSpd(0); setSpeed(0);
    setTraj([]); trajRef.current = [];
    setDist(0); distRef.current = 0;
    setEndTime(null); lastFetch.current = 0;
    coolRef.current = 0; setZoneCooldown(0);
    adaptRef.current = 15000;
    lastPosRef.current = null;
    osmAttemptsRef.current = 0; osmFailuresRef.current = 0; setOsmStats({ attempts: 0, failures: 0 });
    currentConsolidated.current = null; setCurrentConsolidatedDate(null);
    lastOsm.current = limRef.current.limit;
    cache.clear();
    currentEndpointIdx = 0;
    // Vider les données background du trajet précédent
    AsyncStorage.removeItem(BG_TRAJ_KEY);
    AsyncStorage.removeItem(BG_STATE_KEY);
    resetBgTrajCache();
    const now = new Date();
    setStartTime(now); startTimeRef.current = now;
    AsyncStorage.setItem(TRIP_ACTIVE_KEY, "true");
    setActive(true); setGpsStatus("searching");

    // Démarrer le foreground service si permission accordée (pour l'arrière-plan)
    const bgPerm = await Location.getBackgroundPermissionsAsync();
    if (bgPerm.status === "granted") {
      try {
        await Location.startLocationUpdatesAsync(BG_TASK, {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
          foregroundService: {
            notificationTitle: "TopDriver — Trajet en cours",
            notificationBody: "Surveillance de vitesse active",
            notificationColor: "#0ea5e9",
            notificationChannelId: "topdriver-location",
          },
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
        });
      } catch {}
    }

    // Toujours démarrer watchPosition pour un affichage temps réel fiable en premier plan
    locSub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
      loc => handlePosition(loc.coords.latitude, loc.coords.longitude, loc.coords.speed)
    );

    // Synchronisation périodique légère depuis AsyncStorage (complète les points captés
    // pendant que l'app était en arrière-plan, watchPosition étant suspendu par Android)
    let lastSyncedLen = 0;
    syncInterval.current = setInterval(async () => {
      try {
        const rawTraj = await AsyncStorage.getItem(BG_TRAJ_KEY);
        if (rawTraj) {
          const bgTraj = JSON.parse(rawTraj);
          if (bgTraj.length > lastSyncedLen) {
            lastSyncedLen = bgTraj.length;
            if (bgTraj.length > trajRef.current.length) {
              trajRef.current = bgTraj;
              setTraj(bgTraj);
            }
          }
        }
        const rawState = await AsyncStorage.getItem(BG_STATE_KEY);
        if (rawState) {
          const bgState = JSON.parse(rawState);
          if (bgState.maxSpd != null) setMaxSpd(prev => Math.max(prev, bgState.maxSpd));
          if (bgState.dist != null && bgState.dist > distRef.current) {
            distRef.current = bgState.dist; setDist(bgState.dist);
          }
        }
      } catch {}
    }, 4000);

    timerRef.current = setInterval(() => {
      if (startTimeRef.current) setElapsed(Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000));
    }, 1000);
  };

  // Callback GPS commun — utilisé par foreground et background
  const handlePosition = (lat, lon, rawSpeed) => {
      if (!activeRef.current) return;
      const spd = rawSpeed != null && rawSpeed >= 0 ? Math.round(rawSpeed * 3.6) : 0;
      setSpeed(spd); setMaxSpd(p => Math.max(p, spd)); setGpsStatus("ok");

      const now = Date.now();
      const pt = { lat, lon, t: now, speed: spd, limitOSM: limRef.current.limit };
      const prev = trajRef.current;
      let newPointAdded = false;
      if (!prev.length || haversine(prev[prev.length - 1].lat, prev[prev.length - 1].lon, lat, lon) > 0.003) {
        if (prev.length) { distRef.current += haversine(prev[prev.length - 1].lat, prev[prev.length - 1].lon, lat, lon); setDist(distRef.current); }
        trajRef.current = [...prev, pt];
        newPointAdded = true;
      }

      // Intervalle de polling basé sur la limite OSM courante :
      // ≤ 70 km/h (zone urbaine/péri-urbaine) → polling rapide
      // > 70 km/h (nationale/autoroute) → polling lent
      const currentLimit = limRef.current.limit;
      const urbanMs = Math.max(2, parseInt(pollUrban, 10) || 5) * 1000;
      const roadMs = Math.max(2, parseInt(pollRoad, 10) || 15) * 1000;
      adaptRef.current = currentLimit <= 70 ? urbanMs : roadMs;

      // Ne pas interroger OSM si aucun nouveau point de trajectoire n'a été retenu
      if (newPointAdded && now - lastFetch.current > adaptRef.current) {
        lastFetch.current = now;
        osmAttemptsRef.current++;
        fetchLimit(lat, lon, osmEndpointsRef.current).then(info => {
          if (info.src === "hors ligne") osmFailuresRef.current++;
          setOsmStats({ attempts: osmAttemptsRef.current, failures: osmFailuresRef.current });
          if (info.limit !== lastOsm.current) { coolRef.current = 3; setZoneCooldown(3); }
          lastOsm.current = info.limit; setLimitInfo(info); limRef.current = info;
        });
      }

      if (coolRef.current > 0) { coolRef.current--; setZoneCooldown(coolRef.current); return; }

      const lim = limRef.current.limit;
      const delta = spd - lim;

      if (delta > 0) {
        if (!curEpRef.current) {
          const sev = sevFromOver(delta);
          curEpRef.current = { startTime: new Date().toISOString(), startTs: now, overValues: [delta], limit: lim, sev, color: colorFromSev(sev), coords: { lat, lon } };
          if (bipRef.current) beep(sev === "severe" ? "severe" : "warn");
        } else {
          curEpRef.current.overValues.push(delta);
          const newSev = sevFromOver(delta);
          const sevOrder = ["light", "moderate", "severe"];
          if (sevOrder.indexOf(newSev) > sevOrder.indexOf(curEpRef.current.sev)) {
            curEpRef.current.sev = newSev;
            curEpRef.current.color = colorFromSev(newSev);
            if (bipRef.current) beep("severe");
          }
        }
      } else {
        if (curEpRef.current) {
          const ep = curEpRef.current;
          const duration = Math.round((now - ep.startTs) / 1000);
          const avgOver = Math.round(ep.overValues.reduce((s, v) => s + v, 0) / ep.overValues.length);
          const maxOver = Math.max(...ep.overValues);
          const finalSev = sevFromOver(avgOver);
          if (finalSev !== "tolerance") {
            const episode = { startTime: ep.startTime, endTime: new Date().toISOString(), duration, avgOver, maxOver, limit: ep.limit, sev: finalSev, color: colorFromSev(finalSev), coords: ep.coords };
            infRef.current = [...infRef.current, episode];
            setInfractions([...infRef.current]);
          }
          curEpRef.current = null;
        }
      }
  };

  const stopTrip = async () => {
    // Rattraper la distance/vitesse max accumulées en arrière-plan avant de finaliser
    // (évite une distance figée si l'app était en arrière-plan juste avant l'arrêt)
    try {
      const rawState = await AsyncStorage.getItem(BG_STATE_KEY);
      if (rawState) {
        const bgState = JSON.parse(rawState);
        if (bgState.dist != null && bgState.dist > distRef.current) {
          distRef.current = bgState.dist; setDist(bgState.dist);
        }
        if (bgState.maxSpd != null) setMaxSpd(prev => Math.max(prev, bgState.maxSpd));
      }
      const rawTraj = await AsyncStorage.getItem(BG_TRAJ_KEY);
      if (rawTraj) {
        const bgTraj = JSON.parse(rawTraj);
        if (bgTraj.length > trajRef.current.length) {
          trajRef.current = bgTraj; setTraj([...bgTraj]);
        }
      }
    } catch {}

    // Clore l'épisode en cours si existant
    if (curEpRef.current) {
      const ep = curEpRef.current;
      const duration = Math.round((Date.now() - ep.startTs) / 1000);
      const avgOver = Math.round(ep.overValues.reduce((s, v) => s + v, 0) / ep.overValues.length);
      const maxOver = Math.max(...ep.overValues);
      const finalSev = sevFromOver(avgOver);
      if (finalSev !== "tolerance") {
        const episode = { startTime: ep.startTime, endTime: new Date().toISOString(), duration, avgOver, maxOver, limit: ep.limit, sev: finalSev, color: colorFromSev(finalSev), coords: ep.coords };
        infRef.current = [...infRef.current, episode];
        setInfractions([...infRef.current]);
      }
      curEpRef.current = null;
    }
    // Synchroniser l'état traj depuis la ref (pas mis à jour en temps réel pendant le trajet)
    setTraj([...trajRef.current]);
    AsyncStorage.setItem(TRIP_ACTIVE_KEY, "false");
    setActive(false); setSpeed(0); setEndTime(new Date());
    if (typeof locSub.current?.remove === "function") {
      locSub.current.remove();
    } else {
      clearInterval(locSub.current);
    }
    clearInterval(syncInterval.current);
    await flushBgTrajCache();
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BG_TASK);
      if (isRegistered) await Location.stopLocationUpdatesAsync(BG_TASK);
    } catch {}
    clearInterval(timerRef.current);
    setGpsStatus("ok"); setReportName("Rapport de trajet");

    // Lancer la consolidation automatique avant d'afficher le rapport
    setScreen("consolidating");
    try {
      const { episodes, attempts, failures } = await consolidateInfractions(
        trajRef.current,
        (done, total) => setProcessingProgress({ done, total })
      );
      setInfractions(episodes);
      currentConsolidated.current = { consolidatedDate: new Date().toISOString(), attempts, failures };
      setCurrentConsolidatedDate(currentConsolidated.current.consolidatedDate);
    } catch (e) {
      console.warn("Consolidation échouée:", e.message);
      // On affiche quand même le rapport avec les données brutes
    } finally {
      setProcessingProgress({ done: 0, total: 0 });
    }
    setScreen("end");
  };

  const saveReport = async () => {
    const sc = computeScore(filterEpisodesForRadarScore(infractions));
    const rep = {
      id: Date.now(),
      name: "Rapport de trajet",
      date: new Date().toISOString(),
      startTime: startTime?.toISOString(), endTime: endTime?.toISOString(),
      elapsed, maxSpd, dist, infractions, traj,
      score: sc, unit,
      osmAttempts: osmStats.attempts, osmFailures: osmStats.failures,
      consolidatedDate: currentConsolidated.current?.consolidatedDate,
      consolidationAttempts: currentConsolidated.current?.attempts,
      consolidationFailures: currentConsolidated.current?.failures,
    };
    const updated = [rep, ...reports];
    await saveReps(updated); setReports(updated); showToast(t.saved);
  };

  // Consolidation d'un rapport déjà sauvegardé (depuis l'historique)
  // Calcule toujours les épisodes en mode Strict ; le score affiché suit le mode
  // actuel des Paramètres au moment de la consolidation (modifiable ensuite via le carrousel).
  const consolidateReport = async (repId, trajToUse) => {
    setProcessingId(repId); setProcessingLabel("consolidation");
    setProcessingProgress({ done: 0, total: 0 });
    try {
      const { episodes, attempts, failures } = await consolidateInfractions(trajToUse, (done, total) => {
        setProcessingProgress({ done, total });
      });
      const filtered = filterEpisodesForRadarScore(episodes);
      const sc = computeScore(filtered);
      const consolidatedDate = new Date().toISOString();
      setReports(prevReports => {
        const upd = prevReports.map(r => r.id === repId
          ? { ...r, infractions: episodes, score: sc, consolidatedDate, consolidationAttempts: attempts, consolidationFailures: failures }
          : r
        );
        saveReps(upd);
        return upd;
      });
      setViewingRep(prev => prev && prev.id === repId
        ? { ...prev, infractions: episodes, score: sc, consolidatedDate, consolidationAttempts: attempts, consolidationFailures: failures }
        : prev
      );
    } catch (e) {
      console.warn("Consolidation échouée:", e.message);
    } finally {
      setProcessingId(null); setProcessingLabel(""); setProcessingProgress({ done: 0, total: 0 });
    }
  };

  const updateReportName = async (id, newName) => {
    const updated = reports.map(r => r.id === id ? { ...r, name: newName } : r);
    await saveReps(updated); setReports(updated);
    setViewingRep(prev => prev ? { ...prev, name: newName } : prev);
    showToast(t.saved);
  };

  const deleteReport = async id => {
    const updated = reports.filter(r => r.id !== id);
    await saveReps(updated); setReports(updated);
  };

  const handleImport = async () => {
    try {
      const data = await importReport();
      if (!data) return;
      const traj = data.points.map(p => ({ lat: p.lat, lon: p.lon, speed: p.speed, t: p.t, limitOSM: p.limitOSM ?? null }));

      showToast("⏳ Import en cours, consolidation...");
      const { episodes, attempts, failures } = await consolidateInfractions(traj);
      const filtered = filterEpisodesForRadarScore(episodes);
      const sc = computeScore(filtered);
      const dist = traj.length > 1 ? traj.reduce((d, p, i) => i === 0 ? 0 : d + haversine(traj[i-1].lat, traj[i-1].lon, p.lat, p.lon), 0) : 0;
      const maxSpd = Math.max(...traj.map(p => p.speed), 0);
      const rep = {
        id: Date.now(), name: `Trajet importé ${new Date(data.date).toLocaleDateString("fr-FR")}`,
        date: data.date, startTime: data.startTime, endTime: data.endTime,
        elapsed: data.elapsed, maxSpd, dist, infractions: episodes, traj,
        score: sc, unit: data.unit || "kmh",
        imported: true,
        consolidatedDate: new Date().toISOString(),
        consolidationAttempts: attempts, consolidationFailures: failures,
      };
      const updated = [rep, ...reports];
      await saveReps(updated); setReports(updated);
      showToast("✅ Trajet importé !");
    } catch (e) { showToast("❌ " + e.message); }
  };

  // Current trip data for report modal
  const currentReport = {
    name: reportName,
    date: new Date().toISOString(),
    startTime: startTime?.toISOString(),
    endTime: endTime?.toISOString(),
    elapsed, maxSpd, dist, infractions, traj,
    score, unit,
    osmAttempts: osmStats.attempts, osmFailures: osmStats.failures,
    consolidatedDate: currentConsolidatedDate,
    consolidationAttempts: currentConsolidated.current?.attempts,
    consolidationFailures: currentConsolidated.current?.failures,
  };

  const alertInfo = () => {
    if (!active) return null;
    const d = speed - limitInfo.limit;
    if (zoneCooldown > 0) return { color: C.warn, msg: t.zoneChange };
    if (d > 20) return { color: C.red, msg: `🚨 +${d} ${unit === "mph" ? "mph" : "km/h"}` };
    if (d > 5) return { color: C.warn, msg: `⚠️ +${d} ${unit === "mph" ? "mph" : "km/h"}` };
    if (d > 0) return { color: C.warn, msg: t.toleranceNote };
    return null;
  };
  const al = alertInfo();

  // ── PERMISSION SCREEN ──
  if (screen === "perm") return (
    <SafeAreaView style={gs.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={gs.permScr}>
        <Text style={{ fontSize: 56, marginBottom: 8 }}>📍</Text>
        <Text style={gs.permTitle}>{t.gpsRequired}</Text>
        <Text style={gs.permDesc}>{t.gpsDesc}</Text>
        <TouchableOpacity style={[gs.btn, gs.btnBlue, { marginTop: 16, width: "100%" }]} onPress={requestGPS}>
          <Text style={gs.btnTxt}>{gpsStatus === "searching" ? t.gpsSearching : t.allowGps}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // ── BATTERY EXEMPTION SCREEN ──
  if (screen === "battery") return (
    <SafeAreaView style={gs.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={gs.permScr}>
        <Text style={{ fontSize: 56, marginBottom: 8 }}>🔋</Text>
        <Text style={gs.permTitle}>Optimisation batterie</Text>
        <Text style={gs.permDesc}>
          Pour que TopDriver continue de mesurer la vitesse même quand l'écran
          est éteint ou que l'application est en arrière-plan, Android doit
          autoriser l'application à fonctionner sans restriction de batterie.
        </Text>
        <Text style={[gs.permDesc, { marginTop: 12, fontWeight: "600" }]}>
          Sur l'écran suivant, recherchez "Batterie" puis choisissez
          "Sans restriction" (ou "Non optimisée").
        </Text>
        <TouchableOpacity style={[gs.btn, gs.btnBlue, { marginTop: 16, width: "100%" }]} onPress={requestBatteryExemption}>
          <Text style={gs.btnTxt}>Continuer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[gs.btn, gs.btnGhost, { width: "100%" }]} onPress={() => setScreen("main")}>
          <Text style={gs.btnGhostTxt}>Plus tard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // ── CONSOLIDATING SCREEN ──
  if (screen === "consolidating") {
    return (
      <SafeAreaView style={[gs.safe, { justifyContent: "center", alignItems: "center", padding: 32 }]}>
        <Text style={{ fontSize: 40, marginBottom: 20 }}>🔄</Text>
        <Text style={{ fontSize: 18, fontWeight: "700", color: C.text, marginBottom: 8, textAlign: "center" }}>
          Analyse du trajet en cours...
        </Text>
        {processingProgress.total > 0 && (
          <Text style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>
            {processingProgress.done} / {processingProgress.total} points traités
          </Text>
        )}
      </SafeAreaView>
    );
  }

  // ── END SCREEN ──
  if (screen === "end") {
    const sc = computeScore(filterEpisodesForRadarScore(infractions));
    return (
      <SafeAreaView style={gs.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <Toast msg={toast} />
        <View style={gs.endScr}>
          <Text style={gs.endTitle}>{t.tripEnded}</Text>
          <Text style={gs.endSub}>{fmtDur(elapsed)} · {toDist(dist, unit)}</Text>
          <View style={gs.endCards}>
            <View style={gs.endCard}>
              <Text style={gs.endCardLbl}>{t.safeScore}</Text>
              <Shields score={sc} size={52} />
            </View>
          </View>
          <TouchableOpacity style={[gs.btn, gs.btnBlue, { width: "100%" }]} onPress={() => setShowReport(true)}>
            <Text style={gs.btnTxt}>{t.generateReport}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[gs.btn, gs.btnGhost, { width: "100%" }]} onPress={() => { setScreen("main"); startTrip(); }}>
            <Text style={gs.btnGhostTxt}>{t.newTrip}</Text>
          </TouchableOpacity>
        </View>
        <ReportModal
          visible={showReport}
          report={{ ...currentReport, score: sc }}
          t={t} unit={unit}
          onClose={() => { setShowReport(false); setScreen("main"); }}
          onSave={saveReport}
          onConsolidate={undefined}
          isProcessing={processingId === "current"}
          processingProgress={processingProgress}
        />
      </SafeAreaView>
    );
  }

  // ── MAIN SCREEN ──
  return (
    <SafeAreaView style={gs.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <Toast msg={toast} />

      {/* Header */}
      <View style={gs.header}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <Text style={gs.logo}>TOP<Text style={{ color: C.blue }}>DRIVER</Text></Text>
          <Text style={{ fontSize: 10, color: C.muted, fontWeight: "600" }}>{APP_VERSION}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={[gs.gpsPill, gpsStatus === "ok" ? gs.gpsOk : gpsStatus === "searching" ? gs.gpsSrch : gs.gpsErr]}>
            <Text style={gs.gpsTxt}>{gpsStatus === "ok" ? t.gpsActive : gpsStatus === "searching" ? t.gpsSearching : t.gpsError}</Text>
          </View>
          <TouchableOpacity style={gs.iconBtn} onPress={() => setShowHistory(true)}>
            <Text style={{ fontSize: 16 }}>📋</Text>
          </TouchableOpacity>
          <TouchableOpacity style={gs.iconBtn} onPress={() => setShowSettings(true)}>
            <Text style={{ fontSize: 16 }}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bannière de mise à jour */}
      {updateInfo && (
        <View style={{ backgroundColor: C.blue, paddingVertical: 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => Linking.openURL(APK_URL).catch(() => {})}>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
              🆕 Mise à jour disponible : {updateInfo.latest}
            </Text>
            <Text style={{ color: "#fff", fontSize: 12, opacity: 0.85 }}>Télécharger →</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setUpdateInfo(null)} style={{ paddingLeft: 12 }}>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Gauge row: panneau gauche + jauge droite */}
      <View style={gs.gaugeCard}>
        <View style={gs.limitSign}>
          <Text style={gs.limitNum}>{toSpd(limitInfo.limit, unit)}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Gauge speed={speed} limit={limitInfo.limit} active={active} unit={unit} />
      </View>
      {(active || elapsed > 0) && limitInfo.src !== "—" && (
        <Text style={gs.limSrc}>{limitInfo.src}{limitInfo.road ? ` · ${limitInfo.road}` : ""}</Text>
      )}

      {/* Alert */}
      {al && (
        <View style={[gs.alert, { borderColor: al.color + "40", backgroundColor: al.color + "12" }]}>
          <Text style={[gs.alertTxt, { color: al.color }]}>{al.msg}</Text>
        </View>
      )}

      {/* Score cards */}
      <View style={gs.row}>
        <View style={gs.card}>
          <Text style={gs.cardLbl}>{t.safeScore}</Text>
          <Shields score={score} size={52} />
          <View style={gs.cardSub}>
            <View style={{ alignItems: "center" }}>
              <Text style={gs.cardSubLbl}>{t.infractions}</Text>
              <Text style={[gs.cardSubVal, { color: infractions.filter(i => i.sev !== "tolerance").length ? C.red : C.green }]}>
                {active || elapsed > 0 ? infractions.filter(i => i.sev !== "tolerance").length : "--"}
              </Text>
            </View>
            <View style={gs.divider} />
            <View style={{ alignItems: "center" }}>
              <Text style={gs.cardSubLbl}>{t.maxSpeed}</Text>
              <Text style={gs.cardSubVal}>{active || elapsed > 0 ? maxSpd : "--"}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={gs.row}>
        <View style={gs.statCard}>
          <Text style={gs.statLbl}>{t.distance}</Text>
          <Text style={gs.statVal}>{active || elapsed > 0 ? toDist(dist, unit) : "--"}</Text>
        </View>
        <View style={gs.statCard}>
          <Text style={gs.statLbl}>{t.duration}</Text>
          <Text style={gs.statVal}>{active || elapsed > 0 ? fmtDur(elapsed) : "--"}</Text>
        </View>
      </View>

      {/* CTA */}
      <View style={gs.cta}>
        {active
          ? <TouchableOpacity style={[gs.btn, gs.btnRed]} onPress={stopTrip}><Text style={gs.btnTxt}>{t.stop}</Text></TouchableOpacity>
          : <TouchableOpacity style={[gs.btn, gs.btnBlue]} onPress={startTrip}><Text style={gs.btnTxt}>{t.start}</Text></TouchableOpacity>
        }
      </View>

      {/* Modals */}
      <HistoryModal
        visible={showHistory} reports={reports} t={t} unit={unit}
        onClose={() => setShowHistory(false)}
        onDelete={id => deleteReport(id)}
        onView={rep => {
          setViewingRep(rep);
          setShowHistory(false);
          // Consolidation automatique si pas encore faite
          if (!rep.consolidatedDate) {
            consolidateReport(rep.id, rep.traj || []);
          }
        }}
        onSaveFile={rep => setSavingRep(rep)}
        onImport={handleImport}
        processingId={processingId}
      />

      <SaveFileModal
        visible={!!savingRep}
        defaultName={savingRep ? `topdriver_${new Date(savingRep.date).toISOString().slice(0, 10)}` : ""}
        onCancel={() => setSavingRep(null)}
        onConfirm={async customName => {
          const rep = savingRep;
          setSavingRep(null);
          try {
            const filename = await saveReportToDownloads(rep, customName);
            if (filename) showToast(`💾 Sauvegardé : ${filename}`);
          } catch (e) { Alert.alert("Erreur", e.message); }
        }}
      />

      <SettingsModal
        visible={showSettings} lang={lang} setLang={setLang}
        unit={unit} setUnit={setUnit}
        bipEnabled={bipEnabled} setBipEnabled={setBipEnabled}
        keepAwake={keepAwake} setKeepAwake={setKeepAwake}
        pollUrban={pollUrban} setPollUrban={setPollUrban}
        pollRoad={pollRoad} setPollRoad={setPollRoad}
        osmServer1Url={osmServer1Url} setOsmServer1Url={setOsmServer1Url}
        osmServer1Rank={osmServer1Rank} setOsmServer1Rank={setOsmServer1Rank}
        osmServer2Url={osmServer2Url} setOsmServer2Url={setOsmServer2Url}
        osmServer2Rank={osmServer2Rank} setOsmServer2Rank={setOsmServer2Rank}
        osmServer3Url={osmServer3Url} setOsmServer3Url={setOsmServer3Url}
        osmServer3Rank={osmServer3Rank} setOsmServer3Rank={setOsmServer3Rank}
        t={t}
        onClose={() => setShowSettings(false)}
      />

      {viewingRep && (
        <ReportModal
          visible={!!viewingRep} report={viewingRep} t={t} unit={viewingRep.unit || unit}
          onClose={() => { setViewingRep(null); setShowHistory(true); }}
          onConsolidate={undefined}
          isProcessing={processingId === viewingRep.id}
          processingProgress={processingProgress}
        />
      )}
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════
// COLORS & STYLES
// ═══════════════════════════════════════
const C = { bg: "#f0f4f8", surface: "#fff", surface2: "#f8fafc", blue: "#0ea5e9", red: "#f43f5e", warn: "#f59e0b", green: "#22c55e", text: "#1e293b", muted: "#94a3b8", border: "#e2e8f0" };
const F = Platform.OS === "ios" ? "System" : "sans-serif-condensed";

const gs = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg, paddingTop: StatusBar.currentHeight || 44 },
  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingTop: 4, paddingBottom: 10 },
  logo: { fontFamily: F, fontSize: 24, fontWeight: "900", color: C.text },
  iconBtn: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  gpsPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  gpsOk: { backgroundColor: "#0ea5e910", borderColor: "#0ea5e940" },
  gpsSrch: { backgroundColor: "#f59e0b10", borderColor: "#f59e0b40" },
  gpsErr: { backgroundColor: "#f43f5e10", borderColor: "#f43f5e40" },
  gpsTxt: { fontSize: 10, fontWeight: "600", color: C.text },

  // Gauge card
  gaugeCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 14, marginBottom: 6, backgroundColor: C.surface, borderRadius: 24, padding: 16, elevation: 2 },
  limitSign: { width: 72, height: 72, borderRadius: 36, borderWidth: 5, borderColor: C.red, alignItems: "center", justifyContent: "center", backgroundColor: C.surface, elevation: 3 },
  limitNum: { fontFamily: F, fontSize: 26, fontWeight: "900", color: C.text },
  limSrc: { fontSize: 10, color: C.muted, textAlign: "center", marginBottom: 6, opacity: 0.7 },

  // Gauge
  gaugeOuter: { width: 150, height: 150, alignItems: "center", justifyContent: "center", position: "relative" },
  gaugeRing: { position: "absolute", width: 140, height: 140, borderRadius: 70, borderWidth: 9 },
  gaugeCenter: { position: "absolute", alignItems: "center" },
  gaugeNum: { fontFamily: F, fontSize: 50, fontWeight: "700", lineHeight: 54 },
  gaugeUnit: { fontSize: 11, color: C.muted, letterSpacing: 1.5, textTransform: "uppercase" },

  // Alert
  alert: { marginHorizontal: 14, marginBottom: 8, padding: 10, borderRadius: 12, borderWidth: 1 },
  alertTxt: { fontSize: 13, fontWeight: "600", textAlign: "center" },

  // Cards
  row: { flexDirection: "row", gap: 10, marginHorizontal: 14, marginBottom: 10 },
  card: { flex: 1, backgroundColor: C.surface, borderRadius: 18, padding: 12, alignItems: "center", elevation: 2 },
  cardLbl: { fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  cardSub: { flexDirection: "row", gap: 10, marginTop: 8, alignItems: "center" },
  cardSubLbl: { fontSize: 9, color: C.muted, textTransform: "uppercase" },
  cardSubVal: { fontFamily: F, fontSize: 20, fontWeight: "700", color: C.text },
  divider: { width: 1, height: 28, backgroundColor: C.border },
  statCard: { flex: 1, backgroundColor: C.surface, borderRadius: 14, padding: 10, elevation: 2 },
  statLbl: { fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 },
  statVal: { fontFamily: F, fontSize: 20, fontWeight: "700", color: C.text },

  // CTA
  cta: { marginHorizontal: 14, marginTop: "auto", paddingBottom: 40 },

  // Buttons
  btn: { padding: 16, borderRadius: 16, alignItems: "center", marginBottom: 10 },
  btnBlue: { backgroundColor: C.blue, elevation: 4 },
  btnRed: { backgroundColor: C.red, elevation: 4 },
  btnGhost: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  btnTxt: { color: "#fff", fontSize: 17, fontWeight: "700", letterSpacing: 0.5 },
  btnGhostTxt: { color: C.text, fontSize: 17, fontWeight: "600" },

  // Toast
  toast: { position: "absolute", top: 50, alignSelf: "center", backgroundColor: C.blue, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, zIndex: 9999, elevation: 20 },
  toastTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // Perm
  permScr: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  permTitle: { fontFamily: F, fontSize: 24, fontWeight: "900", color: C.text, textAlign: "center", marginBottom: 12 },
  permDesc: { fontSize: 14, color: C.muted, lineHeight: 22, textAlign: "center", marginBottom: 8 },

  // End screen
  endScr: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  endTitle: { fontFamily: F, fontSize: 28, fontWeight: "900", color: C.text },
  endSub: { fontSize: 14, color: C.muted },
  endCards: { flexDirection: "row", gap: 12, width: "100%", marginVertical: 8 },
  endCard: { flex: 1, backgroundColor: C.surface, borderRadius: 18, padding: 16, alignItems: "center", gap: 8, elevation: 2 },
  endCardLbl: { fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 1 },

  // Modal common
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: (StatusBar.currentHeight || 44) + 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface },
  modalTitle: { fontFamily: F, fontSize: 22, fontWeight: "900", color: C.text },
  closeBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.surface2, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  closeBtnTxt: { fontSize: 14, fontWeight: "600", color: C.text },

  // Report
  block: { backgroundColor: C.surface2, borderRadius: 16, padding: 16, marginBottom: 12 },
  blockTitle: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: C.muted, marginBottom: 8, fontWeight: "600" },
  blockLabel: { fontSize: 11, color: C.muted, marginBottom: 6 },
  nameInput: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, fontSize: 15, color: C.text, fontWeight: "600" },
  pollInput: { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 8, paddingHorizontal: 12, fontSize: 15, color: C.text, fontWeight: "700", width: 60, textAlign: "center" },

  toleranceOption: { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12 },
  toleranceTab: { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  toleranceTabActive: { backgroundColor: C.blue, borderColor: C.blue },
  toleranceTabTxt: { fontSize: 12, fontWeight: "700", color: C.text },
  toleranceTabTxtActive: { color: "#fff" },
  toleranceOptionActive: { borderColor: C.blue, backgroundColor: "rgba(14,165,233,.08)" },
  toleranceOptionTitle: { fontSize: 14, fontWeight: "700", color: C.text, marginBottom: 2 },
  toleranceOptionTitleActive: { color: C.blue },
  toleranceOptionDesc: { fontSize: 12, color: C.muted },

  // Save file modal
  saveFileOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  saveFileBox: { backgroundColor: C.bg, borderRadius: 16, padding: 20, width: "100%" },
  saveFileTitle: { fontSize: 16, fontWeight: "700", color: C.text, marginBottom: 12 },
  grid2: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "50%", paddingVertical: 6 },
  cellLbl: { fontSize: 10, color: C.muted, marginBottom: 2 },
  cellVal: { fontFamily: F, fontSize: 18, fontWeight: "700", color: C.text },
  verdict: { marginTop: 12, padding: 12, borderRadius: 12 },
  verdictTxt: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  infRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  infDot: { width: 8, height: 8, borderRadius: 4 },
  infTxt: { fontSize: 12, color: C.text },
  infTime: { fontSize: 10, color: C.muted, marginTop: 1 },
  infDelta: { fontFamily: F, fontSize: 14, fontWeight: "700" },
  empty: { textAlign: "center", color: C.muted, fontSize: 13, paddingVertical: 16 },

  // History
  histItem: { backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, elevation: 2 },
  histTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  histName: { fontSize: 14, fontWeight: "700", color: C.text },
  histDate: { fontSize: 11, color: C.muted, marginTop: 2 },
  histMeta: { fontSize: 11, color: C.muted },
  delBtn: { marginTop: 10, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: C.red + "40", backgroundColor: C.red + "10", alignItems: "center" },
  delTxt: { fontSize: 12, fontWeight: "600", color: C.red },

  // Settings
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  settingLbl: { fontSize: 14, color: C.text },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface2 },
  toggleBtnOn: { backgroundColor: C.blue, borderColor: C.blue },
  toggleTxt: { fontSize: 13, fontWeight: "600", color: C.muted },
  toggleTxtOn: { color: "#fff" },

  // Limit editor
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 16 },
  presetBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: C.border, alignItems: "center", justifyContent: "center", backgroundColor: C.surface2 },
  presetBtnSel: { borderColor: C.red, backgroundColor: C.red + "12" },
  presetTxt: { fontFamily: F, fontSize: 22, fontWeight: "900", color: C.text },
  presetTxtSel: { color: C.red },
});
