import { useState, useEffect, useRef } from "react";

// ── Beep sonore ────────────────────────────────────────────────────────────────
function playBeep(type = "warn") {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    if (type === "severe") {
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2);
      const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
      o2.connect(g2); g2.connect(ctx.destination);
      o2.frequency.value = 380;
      g2.gain.setValueAtTime(0.4, ctx.currentTime + 0.3);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      o2.start(ctx.currentTime + 0.3); o2.stop(ctx.currentTime + 0.5);
    } else {
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
    }
  } catch {}
}

// ── User-saved speed limits ────────────────────────────────────────────────────
const USER_LIMITS_KEY = "topdriver_user_limits";
const USER_LIMITS_TTL = 90 * 24 * 60 * 60 * 1000;
const USER_LIMIT_RADIUS = 50;
function loadUserLimits() { try { const r = JSON.parse(localStorage.getItem(USER_LIMITS_KEY) || "[]"); return r.filter(e => Date.now() - e.savedAt < USER_LIMITS_TTL); } catch { return []; } }
function saveUserLimits(l) { localStorage.setItem(USER_LIMITS_KEY, JSON.stringify(l)); }
function findUserLimit(lat, lon) { for (const e of loadUserLimits()) { if (haversineM(lat, lon, e.lat, e.lon) <= USER_LIMIT_RADIUS) return e.limit; } return null; }
function saveUserLimit(lat, lon, limit) { const l = loadUserLimits().filter(e => haversineM(lat, lon, e.lat, e.lon) > USER_LIMIT_RADIUS); l.push({ lat, lon, limit, savedAt: Date.now() }); saveUserLimits(l); }
function clearUserLimits() { localStorage.removeItem(USER_LIMITS_KEY); }
function haversineM(la1, lo1, la2, lo2) { return haversine(la1, lo1, la2, lo2) * 1000; }

// ═══════════════════════════════════════════════════════
// TRADUCTIONS
// ═══════════════════════════════════════════════════════
const T = {
  fr: {
    appName: "TOPDRIVER", allowGps: "Autoriser le GPS", gpsRequired: "Accès GPS requis",
    gpsDesc: "TopDriver utilise votre GPS pour mesurer la vitesse et enregistrer votre trajet sur une carte réelle.",
    gpsSearching: "Recherche…", gpsDenied: "Accès refusé. Autorisez la localisation dans Chrome → Paramètres du site.",
    gpsActive: "GPS actif", gpsError: "GPS erreur",
    start: "▶ Démarrer le trajet", stop: "⏹ Terminer le trajet",
    newTrip: "▶ Nouveau trajet", generateReport: "📊 Générer le rapport",
    report: "📊 Générer le rapport",
    safeScore: "Safe-conduite", ecoScore: "Éco-conduite",
    infractions: "Infractions", distance: "Distance", score: "Score", maxSpeed: "Vit. max",
    noInfraction: "Aucune infraction 👍", lastInfractions: "Dernières infractions",
    limit: "Limite", source: "Source", duration: "Durée",
    reportTitle: "Rapport de trajet", reportName: "Nom du rapport",
    departure: "Départ", arrival: "Arrivée",
    totalInfractions: "Total infractions",
    light: "légères", moderate: "modérées", severe: "graves",
    trip: "🗺 Trajet parcouru", totalDist: "Distance totale", gpsPoints: "Points GPS",
    close: "Fermer", save: "💾 Sauvegarder", share: "↗ Partager", history: "📋 Historique",
    noHistory: "Aucun rapport sauvegardé.", delete: "Supprimer",
    language: "Langue", unit: "Unité de vitesse", wakelock: "Garder l'écran actif",
    wakelockOn: "Activé", wakelockOff: "Désactivé", saved: "Rapport sauvegardé !",
    bip: "Bip d'infraction", bipOn: "Activé", bipOff: "Désactivé",
    userLimits: "Limites personnalisées", userLimitsClear: "Effacer",
    userLimitsSaved: "Limite mémorisée ✓", userLimitsCleared: "Limites effacées",
    toleranceNote: "Tolérance 5 km/h appliquée", zoneChange: "Changement de zone — 3 mesures ignorées",
    editLimit: "Modifier la limite",
    editLimitSub: "Appuyez sur une valeur ou saisissez manuellement",
    customLimit: "Autre valeur (km/h)",
    applyLimit: "Appliquer",
    limitManual: "Manuel",
    arrival: "Arrivée", infList: "Détail des infractions", noInfractionReport: "Aucune infraction enregistrée ✅",
    avgAccel: "Accél. moy.", peakAccel: "Accél. max",
    verdicts: [
      "Conduite très dangereuse ! Infractions graves répétées. ⚠️",
      "Conduite dangereuse. Plusieurs infractions graves relevées.",
      "Conduite correcte mais des améliorations sont nécessaires.",
      "Très bonne conduite, quelques dépassements mineurs.",
      "Conduite exemplaire. Toutes les limites respectées ! 🏆",
    ],
    ecoVerdicts: [
      "Conduite très agressive. Accélérations brutales fréquentes. 🌫️",
      "Conduite agressive. Des efforts sont nécessaires. 🍂",
      "Conduite correcte, quelques accélérations brusques. 🌿",
      "Bonne éco-conduite, accélérations maîtrisées. 🌱",
      "Éco-conduite exemplaire ! Accélérations très douces. 🌳",
    ],
    severityLabels: { tolerance: "tolérance", light: "légère", moderate: "modérée", severe: "grave" },
  },
  en: {
    appName: "TOPDRIVER", allowGps: "Allow GPS", gpsRequired: "GPS access required",
    gpsDesc: "TopDriver uses your GPS to measure speed and record your trip on a real map.",
    gpsSearching: "Searching…", gpsDenied: "Access denied. Allow location in Chrome → Site settings.",
    gpsActive: "GPS active", gpsError: "GPS error",
    start: "▶ Start trip", stop: "⏹ End trip",
    newTrip: "▶ New trip", generateReport: "📊 Generate report",
    report: "📊 Generate report",
    safeScore: "Safe driving", ecoScore: "Eco driving",
    infractions: "Violations", distance: "Distance", score: "Score", maxSpeed: "Max speed",
    noInfraction: "No violations 👍", lastInfractions: "Latest violations",
    limit: "Limit", source: "Source", duration: "Duration",
    reportTitle: "Trip report", reportName: "Report name",
    departure: "Departure", arrival: "Arrival",
    totalInfractions: "Total violations",
    light: "minor", moderate: "moderate", severe: "severe",
    trip: "🗺 Trip route", totalDist: "Total distance", gpsPoints: "GPS points",
    close: "Close", save: "💾 Save", share: "↗ Share", history: "📋 History",
    noHistory: "No saved reports.", delete: "Delete",
    language: "Language", unit: "Speed unit", wakelock: "Keep screen on",
    wakelockOn: "On", wakelockOff: "Off", saved: "Report saved!",
    bip: "Violation beep", bipOn: "On", bipOff: "Off",
    userLimits: "Custom limits", userLimitsClear: "Clear",
    userLimitsSaved: "Limit saved ✓", userLimitsCleared: "Limits cleared",
    toleranceNote: "5 km/h tolerance applied", zoneChange: "Zone change — 3 readings ignored",
    editLimit: "Edit speed limit",
    editLimitSub: "Tap a value or enter manually",
    customLimit: "Other value (km/h)",
    applyLimit: "Apply",
    limitManual: "Manual",
    infList: "Violation details", noInfractionReport: "No violations recorded ✅",
    avgAccel: "Avg accel.", peakAccel: "Peak accel.",
    verdicts: [
      "Very dangerous driving! Repeated severe violations. ⚠️",
      "Dangerous driving. Several severe violations recorded.",
      "Acceptable driving but improvements needed.",
      "Very good driving, a few minor violations.",
      "Exemplary driving. All speed limits respected! 🏆",
    ],
    ecoVerdicts: [
      "Very aggressive driving. Frequent harsh acceleration. 🌫️",
      "Aggressive driving. Improvements needed. 🍂",
      "Acceptable driving, some harsh acceleration. 🌿",
      "Good eco-driving, controlled acceleration. 🌱",
      "Exemplary eco-driving! Very smooth acceleration. 🌳",
    ],
    severityLabels: { tolerance: "tolerance", light: "minor", moderate: "moderate", severe: "severe" },
  },
};

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const APP_VERSION = "v12.4";

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=DM+Sans:wght@300;400;500;600&display=swap');
  :root {
    --bg:#f0f4f8;--surface:#ffffff;--surface2:#f8fafc;
    --accent:#0ea5e9;--accent2:#f43f5e;--warn:#f59e0b;
    --text:#1e293b;--muted:#94a3b8;--border:#e2e8f0;
    --shadow:0 2px 12px rgba(0,0,0,.06);
    --shadow-lg:0 6px 24px rgba(14,165,233,.12);
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;height:100vh;display:flex;justify-content:center;overflow:hidden;}
  .phone{width:390px;height:100vh;background:var(--bg);display:flex;flex-direction:column;overflow:hidden;}

  .status-bar{display:flex;justify-content:space-between;padding:12px 18px 2px;font-size:11px;color:var(--muted);flex-shrink:0;}
  .app-version{font-weight:700;color:#64748b;font-size:11px;}
  .header{padding:4px 18px 10px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;}
  .logo{font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:900;color:var(--text);}
  .logo span{color:var(--accent);}
  .header-right{display:flex;align-items:center;gap:6px;}
  .icon-btn{background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:5px 9px;cursor:pointer;font-size:13px;color:#64748b;box-shadow:0 1px 3px rgba(0,0,0,.05);}

  .gps-pill{display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;}
  .gps-ok{background:rgba(14,165,233,.1);color:var(--accent);border:1px solid rgba(14,165,233,.25);}
  .gps-searching{background:rgba(245,158,11,.1);color:var(--warn);border:1px solid rgba(245,158,11,.25);}
  .gps-error{background:rgba(244,63,94,.1);color:var(--accent2);border:1px solid rgba(244,63,94,.25);}
  .gps-dot{width:6px;height:6px;border-radius:50%;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.2}}
  .blink{animation:pulse 1.2s infinite;}

  /* Gauge card */
  .gauge-card{margin:0 14px 12px;background:var(--surface);border-radius:26px;padding:18px 18px 18px 20px;box-shadow:var(--shadow-lg);border:1px solid rgba(14,165,233,.1);display:flex;align-items:center;flex-shrink:0;}
  .limit-sign-large{width:76px;height:76px;border-radius:50%;border:5px solid var(--accent2);display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;color:var(--text);background:var(--surface);flex-shrink:0;box-shadow:0 3px 12px rgba(244,63,94,.18);}
  .gauge-spacer{flex:1;}
  .gauge-ring{position:relative;width:150px;height:150px;flex-shrink:0;}
  .gauge-ring svg{width:100%;height:100%;transform:rotate(-90deg);}
  .gauge-track{fill:none;stroke:#e2e8f0;stroke-width:9;}
  .gauge-fill{fill:none;stroke-width:9;stroke-linecap:round;transition:stroke-dashoffset .4s cubic-bezier(.4,0,.2,1),stroke .3s;}
  .gauge-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}
  .speed-value{font-family:'Barlow Condensed',sans-serif;font-size:52px;font-weight:700;line-height:1;}
  .speed-unit{font-size:11px;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin-top:1px;}
  .limit-source-small{font-size:9px;color:var(--muted);margin-top:-6px;margin-bottom:10px;text-align:center;opacity:.7;flex-shrink:0;}

  /* Alert */
  .alert-banner{margin:0 14px 10px;padding:9px 13px;border-radius:12px;font-size:11px;font-weight:500;display:flex;align-items:center;gap:8px;flex-shrink:0;}
  .alert-warn{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);color:var(--warn);}
  .alert-danger{background:rgba(244,63,94,.08);border:1px solid rgba(244,63,94,.2);color:var(--accent2);}
  .alert-tolerance{background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.15);color:var(--warn);opacity:.85;}

  /* Scores row */
  .scores-row{display:flex;gap:10px;margin:0 14px 10px;flex-shrink:0;}
  .score-card{flex:1;background:var(--surface);border-radius:20px;padding:12px 14px;box-shadow:var(--shadow);border:1px solid var(--border);display:flex;flex-direction:column;align-items:center;}
  .score-card-label{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;text-align:center;}
  .score-card-icons{display:flex;gap:2px;margin-bottom:8px;justify-content:center;}
  .score-card-sub{display:flex;gap:8px;align-items:flex-end;justify-content:center;}
  .score-mini-label{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;text-align:center;}
  .score-mini-val{font-family:'Barlow Condensed',sans-serif;font-size:21px;font-weight:700;color:var(--text);line-height:1;text-align:center;}
  .score-divider{width:1px;background:var(--border);margin:0 2px;align-self:stretch;}
  .eco-sub{font-size:10px;color:var(--muted);text-align:center;}
  .eco-sub span{font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:700;color:var(--text);}

  /* Stats row */
  .stats-row{display:flex;gap:10px;margin:0 14px 12px;flex-shrink:0;}
  .stat-card{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:10px 13px;box-shadow:var(--shadow);}
  .stat-label{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px;}
  .stat-value{font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;color:var(--text);}

  /* End trip screen */
  .end-screen{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px;gap:16px;}
  .end-title{font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;color:var(--text);text-align:center;}
  .end-sub{font-size:13px;color:var(--muted);text-align:center;line-height:1.5;}
  .end-scores{display:flex;gap:12px;width:100%;}
  .end-score-card{flex:1;background:var(--surface);border-radius:20px;padding:16px;box-shadow:var(--shadow);border:1px solid var(--border);display:flex;flex-direction:column;align-items:center;gap:8px;}
  .end-score-label{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;}
  .end-btns{display:flex;flex-direction:column;gap:10px;width:100%;}

  /* CTA */
  .cta-wrap{padding:0 14px;flex-shrink:0;margin-top:auto;}
  .cta-btn{width:100%;padding:16px;border-radius:18px;border:none;cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;transition:transform .15s;}
  .cta-btn:active{transform:scale(.97);}
  .cta-start{background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;box-shadow:0 6px 20px rgba(14,165,233,.35);}
  .cta-stop{background:linear-gradient(135deg,#f43f5e,#e11d48);color:#fff;box-shadow:0 6px 20px rgba(244,63,94,.3);}
  .cta-secondary{background:var(--surface);color:var(--text);border:1px solid var(--border);box-shadow:var(--shadow);}
  .live-dot{width:6px;height:6px;border-radius:50%;background:var(--accent2);animation:pulse 1s infinite;display:inline-block;margin-right:5px;}

  /* Modal */
  .modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:100;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn .2s;}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  .modal{width:390px;background:var(--surface);border-radius:28px 28px 0 0;padding:26px 22px 38px;animation:slideUp .3s cubic-bezier(.4,0,.2,1);border:1px solid var(--border);border-bottom:none;max-height:93vh;overflow-y:auto;}
  @keyframes slideUp{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}
  .modal-title{font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:900;margin-bottom:3px;color:var(--text);}
  .modal-subtitle{font-size:12px;color:var(--muted);margin-bottom:18px;}

  /* Report name input */
  .report-name-input{width:100%;padding:10px 14px;border-radius:12px;border:1px solid var(--border);background:var(--surface2);font-family:'DM Sans',sans-serif;font-size:14px;color:var(--text);margin-bottom:14px;outline:none;}
  .report-name-input:focus{border-color:var(--accent);}

  /* Report blocks */
  .rep-block{background:var(--surface2);border-radius:18px;padding:16px;margin-bottom:12px;border:1px solid var(--border);}
  .rep-block-title{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:12px;font-weight:600;}
  .rep-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;}
  .rep-cell{padding:6px 0;}
  .rep-cell-label{font-size:10px;color:var(--muted);margin-bottom:2px;}
  .rep-cell-value{font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;color:var(--text);line-height:1.1;}
  .rep-cell-value.danger{color:var(--accent2);}
  .rep-cell-value.ok{color:#22c55e;}
  .rep-divider{grid-column:1/-1;height:1px;background:var(--border);margin:6px 0;}
  .rep-verdict{margin-top:12px;padding:10px 12px;border-radius:12px;font-size:12px;line-height:1.5;font-weight:500;text-align:center;}
  .rep-shields{display:flex;gap:4px;justify-content:center;margin-bottom:8px;}
  .rep-eco-leaves{display:flex;gap:5px;justify-content:center;font-size:26px;margin-bottom:10px;}
  .eco-verdict{font-size:12px;color:var(--muted);text-align:center;line-height:1.5;margin-bottom:10px;}

  /* Infraction list */
  .inf-group{margin-bottom:10px;}
  .inf-group-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;display:flex;align-items:center;gap:6px;}
  .inf-row{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px;}
  .inf-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
  .inf-row-info{flex:1;}
  .inf-row-time{font-size:10px;color:var(--muted);margin-top:1px;}
  .inf-row-delta{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;flex-shrink:0;}

  /* Report actions */
  .report-actions{display:flex;gap:8px;margin-top:14px;}
  .action-btn{flex:1;padding:13px;border-radius:12px;border:1px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;display:flex;align-items:center;justify-content:center;gap:5px;}
  .modal-close{margin-top:12px;width:100%;padding:14px;border-radius:12px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;}

  /* History */
  .history-item{background:var(--surface);border-radius:14px;padding:12px 14px;margin-bottom:8px;cursor:pointer;border:1px solid var(--border);box-shadow:var(--shadow);}
  .history-item:active{border-color:var(--accent);}
  .history-item-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:3px;}
  .history-item-name{font-size:13px;font-weight:600;color:var(--text);}
  .history-item-date{font-size:10px;color:var(--muted);margin-top:1px;}
  .history-item-meta{font-size:11px;color:var(--muted);margin-top:4px;}
  .history-actions{display:flex;gap:6px;margin-top:8px;}
  .del-btn{flex:1;padding:7px;border-radius:8px;border:1px solid rgba(244,63,94,.25);background:rgba(244,63,94,.06);color:var(--accent2);font-size:12px;font-weight:600;cursor:pointer;font-family:'Barlow Condensed',sans-serif;letter-spacing:.04em;text-transform:uppercase;}

  /* Settings */
  .settings-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border);}
  .settings-label{color:var(--muted);font-size:12px;}
  .toggle-group{display:flex;gap:6px;}
  .toggle-btn{padding:6px 14px;border-radius:20px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;}
  .toggle-btn.active{background:var(--accent);color:#fff;border-color:var(--accent);}

  /* Perm screen */
  .perm-screen{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 28px;text-align:center;gap:14px;}
  .perm-icon{font-size:52px;}
  .perm-title{font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:900;color:var(--text);}
  .perm-desc{font-size:13px;color:var(--muted);line-height:1.6;}
  .perm-btn{margin-top:6px;padding:15px;border-radius:14px;border:none;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-size:17px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;width:100%;box-shadow:0 6px 20px rgba(14,165,233,.35);}

  /* Toast */
  .toast{position:fixed;top:24px;left:50%;transform:translateX(-50%);background:var(--accent);color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:700;z-index:999;animation:toastIn .3s;white-space:nowrap;box-shadow:0 4px 16px rgba(14,165,233,.4);}
  @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
  .empty-state{text-align:center;color:var(--muted);font-size:12px;padding:16px 0;}

  /* Speed limit editor */
  .limit-edit-overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:200;display:flex;align-items:flex-end;justify-content:center;}
  .limit-edit-sheet{width:390px;background:var(--surface);border-radius:28px 28px 0 0;padding:24px 20px 36px;border:1px solid var(--border);border-bottom:none;}
  .limit-edit-title{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:var(--text);margin-bottom:4px;}
  .limit-edit-sub{font-size:12px;color:var(--muted);margin-bottom:18px;}
  .limit-presets{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;}
  .limit-preset-btn{width:64px;height:64px;border-radius:50%;border:3px solid var(--border);background:var(--surface2);font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;color:var(--text);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;}
  .limit-preset-btn:active{transform:scale(.95);}
  .limit-preset-btn.selected{border-color:var(--accent2);background:rgba(244,63,94,.08);color:var(--accent2);}
  .limit-custom-row{display:flex;gap:10px;margin-bottom:16px;align-items:center;}
  .limit-custom-input{flex:1;padding:12px 14px;border-radius:12px;border:1px solid var(--border);background:var(--surface2);font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:700;color:var(--text);text-align:center;outline:none;}
  .limit-custom-input:focus{border-color:var(--accent);}
  .limit-apply-btn{width:100%;padding:15px;border-radius:14px;border:none;background:linear-gradient(135deg,#f43f5e,#e11d48);color:#fff;font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;box-shadow:0 4px 16px rgba(244,63,94,.3);}
  .limit-cancel-btn{width:100%;padding:12px;border-radius:12px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-size:15px;font-weight:600;cursor:pointer;margin-top:8px;}
  .limit-sign-large{width:76px;height:76px;border-radius:50%;border:5px solid var(--accent2);display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;color:var(--text);background:var(--surface);flex-shrink:0;box-shadow:0 3px 12px rgba(244,63,94,.18);cursor:pointer;transition:transform .15s;}
  .limit-sign-large:active{transform:scale(.95);}
  .limit-sign-large.manual{border-color:var(--accent);box-shadow:0 3px 12px rgba(14,165,233,.2);}
  .limit-manual-badge{font-size:8px;color:var(--accent);text-align:center;margin-top:-8px;margin-bottom:6px;letter-spacing:.06em;text-transform:uppercase;}
`;

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
function fmtTime(d) { return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function fmtDate(d) { return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
function fmtDuration(s) { return `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, "0")}s`; }
function scoreColor(s) { return s >= 4 ? "#22c55e" : s >= 3 ? "#0ea5e9" : s >= 2 ? "#f59e0b" : s >= 1 ? "#f97316" : "#f43f5e"; }

// Shields (safe-conduite) — dégradé horizontal pour les demi-valeurs
function Shield({ fill, size = 22, color = "#0ea5e9" }) {
  const id = `sg-${Math.round(fill * 10)}-${size}-${color.replace("#", "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset={`${fill * 100}%`} stopColor={color} />
          <stop offset={`${fill * 100}%`} stopColor="#cbd5e1" />
        </linearGradient>
      </defs>
      <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6L12 2z"
        fill={`url(#${id})`} stroke="white" strokeWidth="0.5" />
    </svg>
  );
}

function renderShields(score, size = 22) {
  const color = scoreColor(score);
  return Array.from({ length: 5 }, (_, i) => (
    <Shield key={i} fill={Math.min(1, Math.max(0, score - i))} size={size} color={color} />
  ));
}

function renderLeaves(count, size = 20) {
  return Array.from({ length: 5 }, (_, i) => (
    <span key={i} style={{ fontSize: size, opacity: i < count ? 1 : 0.15 }}>🍃</span>
  ));
}

function shieldsFromScore(score) {
  if (score >= 4.5) return 5;
  if (score >= 3.5) return 4;
  if (score >= 2.5) return 3;
  if (score >= 1.5) return 2;
  return 1;
}

function haversine(la1, lo1, la2, lo2) {
  const R = 6371, r = Math.PI / 180;
  const dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toDisplaySpeed(kmh, unit) { return unit === "mph" ? Math.round(kmh * 0.621371) : kmh; }
function toDisplayDist(km, unit) {
  if (unit === "mph") { const mi = km * 0.621371; return mi < 0.621 ? `${Math.round(mi * 5280)} ft` : `${mi.toFixed(2)} mi`; }
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`;
}

// ── Eco score ──────────────────────────────────────────────────────────────
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

// ── Speed limit ──────────────────────────────────────────────────────────────
const DEFAULT_LIMITS = { motorway: 130, motorway_link: 110, trunk: 110, trunk_link: 90, primary: 80, primary_link: 70, secondary: 80, secondary_link: 70, tertiary: 80, tertiary_link: 70, residential: 30, living_street: 20, pedestrian: 20, service: 20, unclassified: 50, road: 50 };
const URBAN_LIMITS = { motorway: 110, trunk: 90, primary: 50, secondary: 50, tertiary: 50, residential: 30, living_street: 20, service: 20, unclassified: 50, road: 50 };
const BUS_ROUTE_PRIORITY = ["motorway", "trunk", "primary", "secondary", "tertiary", "motorway_link", "trunk_link", "primary_link", "secondary_link", "unclassified", "residential"];
function parseMaxspeed(raw) {
  if (!raw) return null;
  const n = raw.trim().toLowerCase();
  const num = parseInt(n);
  if (!isNaN(num) && num > 0) return num;
  const special = { "fr:urban": 50, "fr:living_street": 20, "fr:rural": 80, "fr:motorway": 130, "fr:trunk": 110, "walk": 20, "none": 130 };
  return special[n] ?? null;
}
const speedLimitCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
function cacheKey(lat, lon) { return `${lat.toFixed(4)},${lon.toFixed(4)}`; }
const OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter";
async function fetchSpeedLimit(lat, lon) {
  // Vérifier d'abord les limites personnalisées sauvegardées
  const userLimit = findUserLimit(lat, lon);
  if (userLimit !== null) return { limit: userLimit, source: "👤 Personnel", road: "" };
  const key = cacheKey(lat, lon);
  const cached = speedLimitCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return { ...cached, source: cached.source + " ✓" };
  const q = `[out:json][timeout:10];way(around:50,${lat},${lon})[highway][highway!~"footway|path|steps|cycleway|track"];out tags 5;`;
  try {
    const res = await fetch(`${OVERPASS_URL}?data=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (!data.elements?.length) return { limit: 50, source: "défaut" };
    const sorted = [...data.elements].sort((a, b) => {
      const ia = BUS_ROUTE_PRIORITY.indexOf(a.tags?.highway || ""); const ib = BUS_ROUTE_PRIORITY.indexOf(b.tags?.highway || "");
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    for (const el of sorted) { const tags = el.tags || {}; const limit = parseMaxspeed(tags.maxspeed); if (limit !== null) { const r = { limit, source: "OSM", road: tags.name || tags.ref || tags.highway || "", ts: Date.now() }; speedLimitCache.set(key, r); return r; } }
    const tags = sorted[0].tags || {}; const hw = tags.highway || "";
    const isUrban = tags["zone:maxspeed"]?.includes("urban") || tags["maxspeed:type"]?.includes("urban") || tags.urban === "yes" || ["residential", "living_street", "service", "unclassified"].includes(hw);
    const limit = (isUrban ? URBAN_LIMITS : DEFAULT_LIMITS)[hw] ?? 50;
    const r = { limit, source: isUrban ? `défaut agglo (${hw})` : `défaut (${hw})`, road: tags.name || tags.ref || hw || "", ts: Date.now() };
    speedLimitCache.set(key, r); return r;
  } catch { return { limit: 50, source: "hors ligne" }; }
}

// ── Leaflet map ───────────────────────────────────────────────────────────────
function buildMapHTML(points, infractions) {
  if (points.length < 2) return null;
  const step = Math.max(1, Math.floor(points.length / 300));
  const sampled = points.filter((_, i) => i % step === 0);
  const latlngs = sampled.map(p => [p.lat, p.lon]);
  const start = points[0], end = points[points.length - 1];
  const lats = points.map(p => p.lat), lons = points.map(p => p.lon);
  const bounds = [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]];
  const infMarkers = infractions.filter(i => i.coords && i.severity !== "tolerance").map(i =>
    `L.circleMarker([${i.coords.lat},${i.coords.lon}],{radius:7,color:'#f43f5e',fillColor:'#f43f5e',fillOpacity:.85,weight:2}).addTo(map).bindPopup('<b>${i.severity}</b><br>${i.speed}→${i.limit} +${i.delta}');`
  ).join("\n");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script><style>html,body,#map{margin:0;padding:0;width:100%;height:100%;}<\/style></head><body><div id="map"></div><script>
    const map=L.map('map',{zoomControl:true,attributionControl:false});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
    L.polyline(${JSON.stringify(latlngs)},{color:'#0ea5e9',weight:4,opacity:.9}).addTo(map);
    const si=L.divIcon({html:'<div style="background:#0ea5e9;width:13px;height:13px;border-radius:50%;border:3px solid white;"></div>',className:'',iconAnchor:[6,6]});
    L.marker([${start.lat},${start.lon}],{icon:si}).addTo(map).bindPopup('Départ');
    const ei=L.divIcon({html:'<div style="background:#f43f5e;width:13px;height:13px;border-radius:50%;border:3px solid white;"></div>',className:'',iconAnchor:[6,6]});
    L.marker([${end.lat},${end.lon}],{icon:ei}).addTo(map).bindPopup('Arrivée');
    ${infMarkers}
    map.fitBounds(${JSON.stringify(bounds)},{padding:[18,18]});
  <\/script></body></html>`;
}
function LeafletMap({ points, infractions }) {
  if (points.length < 2) return <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 28 }}>Pas assez de points GPS.</div>;
  return <iframe srcDoc={buildMapHTML(points, infractions)} title="map" sandbox="allow-scripts allow-same-origin" style={{ border: "none", width: "100%", height: 240, borderRadius: 14, display: "block" }} />;
}

// ── Storage ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "topdriver_reports";
function loadReports() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; } }
function saveReports(r) { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)); }

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════
export default function TopDriver() {
  const [lang, setLang] = useState("fr");
  const [unit, setUnit] = useState("kmh");
  const [wakelockOn, setWakelockOn] = useState(true);
  const [bipEnabled, setBipEnabled] = useState(true);
  const bipEnabledRef = useRef(true);
  const t = T[lang];

  // Screens: perm | main | end | settings | history
  const [screen, setScreen] = useState(() => {
    // Si la permission GPS a déjà été accordée, on va directement sur main
    return localStorage.getItem("topdriver_gps_perm") === "granted" ? "main" : "perm";
  });
  const [permState, setPermState] = useState(() => {
    return localStorage.getItem("topdriver_gps_perm") || "unknown";
  });
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
  const [showLimitEditor, setShowLimitEditor] = useState(false);
  const [isLimitManual, setIsLimitManual] = useState(false);
  const isLimitManualRef = useRef(false);
  const lastOsmLimitRef = useRef(50); // dernière limite reçue d'OSM

  const [showReport, setShowReport] = useState(false);
  const [reports, setReports] = useState(loadReports);
  const [viewingReport, setViewingReport] = useState(null);
  const [reportName, setReportName] = useState("Rapport de trajet");

  const watchRef = useRef(null);
  const elapsedRef = useRef(null);
  const wakelockRef = useRef(null);
  const lastLimitFetch = useRef(0);
  const lastInfractionRef = useRef(0);
  const infractionsRef = useRef([]);
  const activeRef = useRef(false);
  const trajectoryRef = useRef([]);
  const limitInfoRef = useRef({ limit: 50 });
  const totalDistanceRef = useRef(0);
  const zoneChangeCooldownRef = useRef(0);
  const prevSpeedRef = useRef(0);
  const adaptiveIntervalRef = useRef(15000);

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { limitInfoRef.current = limitInfo; }, [limitInfo]);
  useEffect(() => { zoneChangeCooldownRef.current = zoneChangeCooldown; }, [zoneChangeCooldown]);
  useEffect(() => { bipEnabledRef.current = bipEnabled; }, [bipEnabled]);

  // WakeLock
  useEffect(() => {
    if (!active || !wakelockOn) { wakelockRef.current?.release?.(); return; }
    if ("wakeLock" in navigator) navigator.wakeLock.request("screen").then(l => { wakelockRef.current = l; }).catch(() => {});
    return () => { wakelockRef.current?.release?.(); };
  }, [active, wakelockOn]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  const requestGPS = async () => {
    setGpsStatus("searching");
    try {
      await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 }));
      // Demande permission notifications en même temps
      localStorage.setItem("topdriver_gps_perm", "granted");
      setPermState("granted"); setGpsStatus("ok"); setScreen("main");
    } catch { setPermState("denied"); setGpsStatus("error"); }
  };

  const computeScore = (infs) => {
    if (!infs) infs = infractions;
    const counted = infs.filter(i => i.severity !== "tolerance");
    if (!counted.length) return 5;
    const g = counted.filter(i => i.severity === "severe").length;
    const m = counted.filter(i => i.severity === "moderate").length;
    const l = counted.filter(i => i.severity === "light").length;
    return Math.max(0, Math.min(5, +(5 - g * 1.2 - m * 0.5 - l * 0.2).toFixed(2)));
  };
  const score = computeScore();
  const shields = shieldsFromScore(score);

  const handleStart = () => {
    setInfractions([]); infractionsRef.current = [];
    setElapsed(0); setMaxSpeed(0); setSpeed(0);
    setTrajectory([]); trajectoryRef.current = [];
    setTotalDistance(0); totalDistanceRef.current = 0;
    setEcoData({ leaves: 5, avgAccel: 0, peakAccel: 0 });
    setEndTime(null);
    lastLimitFetch.current = 0; lastInfractionRef.current = 0;
    zoneChangeCooldownRef.current = 0; setZoneChangeCooldown(0);
    prevSpeedRef.current = 0; adaptiveIntervalRef.current = 15000;
    speedLimitCache.clear();
    setIsLimitManual(false); isLimitManualRef.current = false;
    lastOsmLimitRef.current = 50;
    setStartTime(new Date()); setActive(true); setGpsStatus("searching"); setScreen("main");

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (!activeRef.current) return;
        const { latitude: lat, longitude: lon, speed: raw } = pos.coords;
        const spd = raw != null && raw >= 0 ? Math.round(raw * 3.6) : 0;
        setSpeed(spd); setMaxSpeed(prev => Math.max(prev, spd)); setGpsStatus("ok");

        const now = Date.now();
        const newPt = { lat, lon, t: now, speed: spd };
        const prev = trajectoryRef.current;
        if (prev.length === 0 || haversine(prev[prev.length - 1].lat, prev[prev.length - 1].lon, lat, lon) > 0.003) {
          if (prev.length > 0) { totalDistanceRef.current += haversine(prev[prev.length - 1].lat, prev[prev.length - 1].lon, lat, lon); setTotalDistance(totalDistanceRef.current); }
          trajectoryRef.current = [...prev, newPt]; setTrajectory([...trajectoryRef.current]);
          if (trajectoryRef.current.length % 5 === 0) setEcoData(computeEcoScore(trajectoryRef.current));
        }

        const speedDelta = Math.abs(spd - prevSpeedRef.current);
        prevSpeedRef.current = spd;
        adaptiveIntervalRef.current = speedDelta > 15 ? 2000 : speedDelta > 5 ? 5000 : 15000;

        if (now - lastLimitFetch.current > adaptiveIntervalRef.current) {
          lastLimitFetch.current = now;
          fetchSpeedLimit(lat, lon).then(info => {
            if (isLimitManualRef.current) {
              // Mode manuel : OSM continue de tourner en arrière-plan
              // Si OSM renvoie une limite DIFFÉRENTE de la dernière connue → changement de zone → repasser en auto
              if (info.limit !== lastOsmLimitRef.current) {
                setIsLimitManual(false); isLimitManualRef.current = false;
                setLimitInfo(info); limitInfoRef.current = info;
                lastOsmLimitRef.current = info.limit;
                zoneChangeCooldownRef.current = 3; setZoneChangeCooldown(3);
              }
              // Même zone → on garde la valeur manuelle, on mémorise juste la valeur OSM
              else { lastOsmLimitRef.current = info.limit; }
            } else {
              // Mode automatique normal
              if (info.limit !== lastOsmLimitRef.current) { zoneChangeCooldownRef.current = 3; setZoneChangeCooldown(3); }
              lastOsmLimitRef.current = info.limit;
              setLimitInfo(info); limitInfoRef.current = info;
            }
          });
        }

        if (zoneChangeCooldownRef.current > 0) { zoneChangeCooldownRef.current--; setZoneChangeCooldown(zoneChangeCooldownRef.current); return; }

        const lim = limitInfoRef.current.limit;
        const delta = spd - lim;
        if (delta > 0 && now - lastInfractionRef.current > 3000) {
          lastInfractionRef.current = now;
          const severity = delta <= 5 ? "tolerance" : delta > 25 ? "severe" : delta > 10 ? "moderate" : "light";
          const color = severity === "tolerance" ? "#94a3b8" : severity === "severe" ? "#f43f5e" : severity === "moderate" ? "#f59e0b" : "#f97316";
          // Bip sonore
          if (bipEnabledRef.current && severity !== "tolerance") playBeep(severity === "severe" ? "severe" : "warn");
          const entry = { time: new Date(), speed: spd, limit: lim, delta, severity, color, coords: { lat, lon } };
          infractionsRef.current = [...infractionsRef.current, entry];
          setInfractions([...infractionsRef.current]);
        }

        // Mettre à jour la notification toutes les 3s
      },
      () => setGpsStatus("error"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
    elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  };

  const handleStop = () => {
    setActive(false); setSpeed(0); setEndTime(new Date());
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    clearInterval(elapsedRef.current); setGpsStatus("ok");
    setReportName("Rapport de trajet");
    setScreen("end");
  };

  useEffect(() => () => {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    clearInterval(elapsedRef.current);
  }, []);

  const handleSave = () => {
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
    saveReports(updated); setReports(updated); showToast(t.saved);
  };

  const handleShare = () => {
    const sc = computeScore(); const sh = shieldsFromScore(sc);
    const eco = computeEcoScore(trajectory);
    const text = `🚌 TopDriver — ${reportName}\n📅 ${new Date().toLocaleDateString("fr-FR")}\n🛡️ Safe-conduite : ${"🛡".repeat(sh)}${"·".repeat(5 - sh)}\n🍃 Éco-conduite : ${"🍃".repeat(eco.leaves)}${"·".repeat(5 - eco.leaves)}\n📍 Distance : ${toDisplayDist(totalDistance, unit)}\n⏱ Durée : ${fmtDuration(elapsed)}\n🚨 Infractions : ${infractions.filter(i => i.severity !== "tolerance").length}`;
    if (navigator.share) { navigator.share({ title: "TopDriver", text }); }
    else { navigator.clipboard?.writeText(text); showToast("Copié !"); }
  };

  const alertStatus = () => {
    if (!active) return null;
    const diff = speed - limitInfo.limit;
    if (zoneChangeCooldown > 0) return { cls: "alert-tolerance", icon: "🔄", msg: t.zoneChange };
    if (diff > 20) return { cls: "alert-danger", icon: "🚨", msg: `+${diff} ${unit === "mph" ? "mph" : "km/h"} !` };
    if (diff > 5) return { cls: "alert-warn", icon: "⚠️", msg: `+${diff} ${unit === "mph" ? "mph" : "km/h"}` };
    if (diff > 0) return { cls: "alert-tolerance", icon: "〰️", msg: t.toleranceNote };
    return null;
  };
  const alert = alertStatus();

  const gpsUI = () => {
    if (gpsStatus === "ok") return { cls: "gps-ok", dot: "#0ea5e9", label: t.gpsActive, blink: false };
    if (gpsStatus === "searching") return { cls: "gps-searching", dot: "#f59e0b", label: t.gpsSearching, blink: true };
    if (gpsStatus === "idle") return { cls: "gps-searching", dot: "#cbd5e1", label: "GPS", blink: false };
    return { cls: "gps-error", dot: "#f43f5e", label: t.gpsError, blink: false };
  };
  const gps = gpsUI();

  const dispSpeed = toDisplaySpeed(speed, unit);
  const dispLimit = toDisplaySpeed(limitInfo.limit, unit);
  const R = 66, CIRC = 2 * Math.PI * R;
  const pct = Math.min(dispSpeed / Math.max(dispLimit * 1.5, 1), 1);
  const gaugeColor = speed > limitInfo.limit * 1.1 ? "#f43f5e" : speed > limitInfo.limit + 5 ? "#f59e0b" : "#0ea5e9";
  const unitLabel = unit === "mph" ? "mph" : "km/h";
  const infCount = infractions.filter(i => i.severity !== "tolerance").length;

  const activeReport = viewingReport || {
    name: reportName, date: new Date().toISOString(),
    startTime: startTime?.toISOString(), endTime: endTime?.toISOString(),
    elapsed, maxSpeed, totalDistance, infractions, trajectory,
    score, shields, ecoData, unit,
  };

  // ── PERMISSION ──
  if (screen === "perm") return (
    <>
      <style>{STYLE}</style>
      <div className="phone">
        <div className="status-bar"><span className="app-version">{APP_VERSION}</span><span>{new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span></div>
        <div className="header"><div className="logo">TOP<span>DRIVER</span></div></div>
        <div className="perm-screen">
          <div className="perm-icon">📍</div>
          <div className="perm-title">{t.gpsRequired}</div>
          <div className="perm-desc">{t.gpsDesc}</div>
          {permState === "denied" && <div style={{ color: "#f43f5e", fontSize: 12, background: "rgba(244,63,94,.08)", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(244,63,94,.2)" }}>{t.gpsDenied}</div>}
          <button className="perm-btn" onClick={requestGPS}>{gpsStatus === "searching" ? t.gpsSearching : t.allowGps}</button>
        </div>
      </div>
    </>
  );

  // ── SETTINGS ──
  if (screen === "settings") return (
    <>
      <style>{STYLE}</style>
      <div className="phone">
        <div className="status-bar"><span className="app-version">{APP_VERSION}</span></div>
        <div className="header"><div className="logo">TOP<span>DRIVER</span></div><button className="icon-btn" onClick={() => setScreen("main")}>✕</button></div>
        <div style={{ padding: "0 20px" }}>
          <div className="settings-row"><span className="settings-label">{t.language}</span><div className="toggle-group"><button className={`toggle-btn ${lang === "fr" ? "active" : ""}`} onClick={() => setLang("fr")}>FR</button><button className={`toggle-btn ${lang === "en" ? "active" : ""}`} onClick={() => setLang("en")}>EN</button></div></div>
          <div className="settings-row"><span className="settings-label">{t.unit}</span><div className="toggle-group"><button className={`toggle-btn ${unit === "kmh" ? "active" : ""}`} onClick={() => setUnit("kmh")}>km/h</button><button className={`toggle-btn ${unit === "mph" ? "active" : ""}`} onClick={() => setUnit("mph")}>mph</button></div></div>
          <div className="settings-row"><span className="settings-label">{t.wakelock}</span><div className="toggle-group"><button className={`toggle-btn ${wakelockOn ? "active" : ""}`} onClick={() => setWakelockOn(true)}>{t.wakelockOn}</button><button className={`toggle-btn ${!wakelockOn ? "active" : ""}`} onClick={() => setWakelockOn(false)}>{t.wakelockOff}</button></div></div>
          <div className="settings-row"><span className="settings-label">{t.bip}</span><div className="toggle-group"><button className={`toggle-btn ${bipEnabled ? "active" : ""}`} onClick={() => setBipEnabled(true)}>{t.bipOn}</button><button className={`toggle-btn ${!bipEnabled ? "active" : ""}`} onClick={() => setBipEnabled(false)}>{t.bipOff}</button></div></div>
          <div className="settings-row"><span className="settings-label">{t.userLimits}</span><button className="toggle-btn" style={{ color: "#f43f5e", borderColor: "rgba(244,63,94,.3)" }} onClick={() => { clearUserLimits(); showToast(t.userLimitsCleared); }}>{t.userLimitsClear}</button></div>
        </div>
      </div>
    </>
  );

  // ── HISTORY ──
  if (screen === "history") return (
    <>
      <style>{STYLE}</style>
      <div className="phone">
        <div className="status-bar"><span className="app-version">{APP_VERSION}</span></div>
        <div className="header"><div className="logo">TOP<span>DRIVER</span></div><button className="icon-btn" onClick={() => setScreen("main")}>✕</button></div>
        <div style={{ padding: "0 16px", flex: 1, overflowY: "auto" }}>
          {reports.length === 0 && <div className="empty-state" style={{ marginTop: 40 }}>{t.noHistory}</div>}
          {reports.map(rep => (
            <div key={rep.id} className="history-item" onClick={() => { setViewingReport(rep); setShowReport(true); }}>
              <div className="history-item-top">
                <div>
                  <div className="history-item-name">{rep.name || "Rapport de trajet"}</div>
                  <div className="history-item-date">{new Date(rep.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <div style={{ display: "flex", gap: 2 }}>{renderShields(rep.score ?? 5, 16)}</div>
                  <div style={{ display: "flex", gap: 2 }}>{renderLeaves(rep.ecoData?.leaves ?? 5, 14)}</div>
                </div>
              </div>
              <div className="history-item-meta">{toDisplayDist(rep.totalDistance, rep.unit || "kmh")} · {fmtDuration(rep.elapsed)} · {rep.infractions?.filter(i => i.severity !== "tolerance").length || 0} inf.</div>
              <div className="history-actions">
                <button className="del-btn" onClick={e => { e.stopPropagation(); if (window.confirm("Supprimer ce rapport ?")) { const u = reports.filter(r => r.id !== rep.id); saveReports(u); setReports(u); } }}>🗑 {t.delete}</button>
              </div>
            </div>
          ))}
        </div>
        {showReport && viewingReport && (
          <ReportModal report={viewingReport} onClose={() => { setShowReport(false); setViewingReport(null); }}
            onShare={handleShare} t={t} unit={viewingReport.unit || unit}
            toDisplaySpeed={toDisplaySpeed} toDisplayDist={toDisplayDist}
            fmtTime={fmtTime} fmtDate={fmtDate} fmtDuration={fmtDuration}
            renderShields={renderShields} renderLeaves={renderLeaves}
            scoreColor={scoreColor}
          />
        )}
      </div>
    </>
  );

  // ── END SCREEN ──
  if (screen === "end") {
    const sc = computeScore(); const sh = shieldsFromScore(sc);
    const eco = computeEcoScore(trajectory);
    return (
      <>
        <style>{STYLE}</style>
        {toast && <div className="toast">{toast}</div>}
        <div className="phone">
          <div className="status-bar"><span className="app-version">{APP_VERSION}</span><span>{new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span></div>
          <div className="header"><div className="logo">TOP<span>DRIVER</span></div></div>
          <div className="end-screen">
            <div className="end-title">Trajet terminé</div>
            <div className="end-sub">{fmtDuration(elapsed)} · {toDisplayDist(totalDistance, unit)}</div>

            {/* Scores */}
            <div className="end-scores">
              <div className="end-score-card">
                <div className="end-score-label">{t.safeScore}</div>
                <div style={{ display: "flex", gap: 3 }}>{renderShields(sc, 22)}</div>
              </div>
              <div className="end-score-card">
                <div className="end-score-label">{t.ecoScore}</div>
                <div style={{ display: "flex", gap: 2 }}>{renderLeaves(eco.leaves, 20)}</div>
              </div>
            </div>

            {/* Buttons */}
            <div className="end-btns">
              <button className="cta-btn cta-start" onClick={() => { setViewingReport(null); setShowReport(true); }}>
                {t.generateReport}
              </button>
              <button className="cta-btn cta-secondary" onClick={handleStart}>
                {t.newTrip}
              </button>
            </div>
          </div>
        </div>

        {showReport && (
          <ReportModal report={activeReport} onClose={() => setShowReport(false)}
            onSave={handleSave} onShare={handleShare} t={t} unit={unit}
            toDisplaySpeed={toDisplaySpeed} toDisplayDist={toDisplayDist}
            fmtTime={fmtTime} fmtDate={fmtDate} fmtDuration={fmtDuration}
            renderShields={renderShields} renderLeaves={renderLeaves}
            scoreColor={scoreColor} reportName={reportName} setReportName={setReportName}
          />
        )}
      </>
    );
  }

  // ── MAIN DRIVING SCREEN ──
  return (
    <>
      <style>{STYLE}</style>
      {toast && <div className="toast">{toast}</div>}
      <div className="phone">
        <div className="status-bar">
          <span className="app-version">{APP_VERSION}</span>
          {active ? <span><span className="live-dot" />{fmtDuration(elapsed)}</span>
            : <span>{new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>}
        </div>
        <div className="header">
          <div className="logo">TOP<span>DRIVER</span></div>
          <div className="header-right">
            <div className={`gps-pill ${gps.cls}`}><div className={`gps-dot ${gps.blink ? "blink" : ""}`} style={{ background: gps.dot }} />{gps.label}</div>
            <button className="icon-btn" onClick={() => setScreen("history")}>📋</button>
            <button className="icon-btn" onClick={() => setScreen("settings")}>⚙️</button>
          </div>
        </div>

        {/* Gauge card */}
        <div className="gauge-card">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div
              className={`limit-sign-large ${isLimitManual ? "manual" : ""}`}
              onClick={() => setShowLimitEditor(true)}
              title="Modifier la limite"
            >{dispLimit}</div>
            {isLimitManual && <div className="limit-manual-badge">{t.limitManual} ✏️</div>}
          </div>
          <div className="gauge-spacer" />
          <div className="gauge-ring">
            <svg viewBox="0 0 150 150">
              <circle className="gauge-track" cx="75" cy="75" r={R} />
              <circle className="gauge-fill" cx="75" cy="75" r={R} stroke={gaugeColor}
                strokeDasharray={CIRC} strokeDashoffset={active ? CIRC * (1 - pct) : CIRC}
                style={{ filter: `drop-shadow(0 0 6px ${gaugeColor}66)` }} />
            </svg>
            <div className="gauge-center">
              <div className="speed-value" style={{ color: active ? gaugeColor : "var(--muted)" }}>{active ? dispSpeed : "--"}</div>
              <div className="speed-unit">{unitLabel}</div>
            </div>
          </div>
        </div>
        {(active || elapsed > 0) && limitInfo.source !== "—" && (
          <div className="limit-source-small">{limitInfo.source}{limitInfo.road ? ` · ${limitInfo.road}` : ""}</div>
        )}

        {alert && <div className={`alert-banner ${alert.cls}`}><span style={{ fontSize: 15 }}>{alert.icon}</span><span>{alert.msg}</span></div>}

        {/* Scores */}
        <div className="scores-row">
          <div className="score-card">
            <div className="score-card-label">{t.safeScore}</div>
            <div className="score-card-icons">{renderShields(score, 20)}</div>
            <div className="score-card-sub">
              <div><div className="score-mini-label">{t.infractions}</div><div className="score-mini-val" style={{ color: infCount > 0 ? "var(--accent2)" : "#22c55e" }}>{active || elapsed > 0 ? infCount : "--"}</div></div>
              <div className="score-divider" />
              <div><div className="score-mini-label">{t.maxSpeed}</div><div className="score-mini-val">{active || elapsed > 0 ? maxSpeed : "--"}</div></div>
            </div>
          </div>
          <div className="score-card">
            <div className="score-card-label">{t.ecoScore}</div>
            <div className="score-card-icons">{renderLeaves(ecoData.leaves, 20)}</div>
            <div className="eco-sub">{t.avgAccel}<br /><span>{active || elapsed > 0 ? `${ecoData.avgAccel} m/s²` : "--"}</span></div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card"><div className="stat-label">{t.distance}</div><div className="stat-value" style={{ fontSize: 18 }}>{active || elapsed > 0 ? toDisplayDist(totalDistance, unit) : "--"}</div></div>
          <div className="stat-card"><div className="stat-label">{t.duration}</div><div className="stat-value" style={{ fontSize: 18 }}>{active || elapsed > 0 ? fmtDuration(elapsed) : "--"}</div></div>
        </div>

        <div className="cta-wrap">
          {active
            ? <button className="cta-btn cta-stop" onClick={handleStop}>{t.stop}</button>
            : <button className="cta-btn cta-start" onClick={handleStart}>{t.start}</button>}
        </div>
      </div>

      {/* Speed limit editor */}
      {showLimitEditor && (
        <LimitEditor
          currentLimit={limitInfo.limit}
          unit={unit}
          t={t}
          onApply={(newLimit) => {
            const info = { limit: newLimit, source: "👤 " + t.limitManual, road: "" };
            setLimitInfo(info); limitInfoRef.current = info;
            setIsLimitManual(true); isLimitManualRef.current = true;
            // Sauvegarder pour les prochains trajets
            if (trajectory.length > 0) {
              const last = trajectory[trajectory.length - 1];
              saveUserLimit(last.lat, last.lon, newLimit);
              showToast(t.userLimitsSaved);
            }
            setShowLimitEditor(false);
          }}
          onClose={() => setShowLimitEditor(false)}
          onReset={() => {
            setIsLimitManual(false); isLimitManualRef.current = false;
            lastLimitFetch.current = 0; // force re-fetch OSM
            setShowLimitEditor(false);
          }}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════
// LIMIT EDITOR
// ═══════════════════════════════════════════════════════
const PRESET_LIMITS = [20, 30, 50, 70, 80, 90, 110, 130];

function LimitEditor({ currentLimit, unit, t, onApply, onClose, onReset }) {
  const [selected, setSelected] = useState(currentLimit);
  const [custom, setCustom] = useState("");
  const isCustom = !PRESET_LIMITS.includes(selected);

  const handlePreset = (val) => { setSelected(val); setCustom(""); };
  const handleCustomChange = (e) => {
    const v = e.target.value.replace(/\D/g, "");
    setCustom(v);
    if (v) setSelected(parseInt(v));
  };
  const handleApply = () => {
    const val = custom ? parseInt(custom) : selected;
    if (val > 0 && val <= 200) onApply(val);
  };

  return (
    <div className="limit-edit-overlay" onClick={onClose}>
      <div className="limit-edit-sheet" onClick={e => e.stopPropagation()}>
        <div className="limit-edit-title">{t.editLimit}</div>
        <div className="limit-edit-sub">{t.editLimitSub}</div>

        {/* Boutons prédéfinis */}
        <div className="limit-presets">
          {PRESET_LIMITS.map(v => (
            <div
              key={v}
              className={`limit-preset-btn ${selected === v && !custom ? "selected" : ""}`}
              onClick={() => handlePreset(v)}
            >{unit === "mph" ? Math.round(v * 0.621) : v}</div>
          ))}
        </div>

        {/* Saisie libre */}
        <div className="limit-custom-row">
          <input
            className="limit-custom-input"
            type="number"
            placeholder={t.customLimit}
            value={custom}
            onChange={handleCustomChange}
            min="10" max="200"
          />
          <span style={{ fontSize: 13, color: "var(--muted)", flexShrink: 0 }}>{unit === "mph" ? "mph" : "km/h"}</span>
        </div>

        <button className="limit-apply-btn" onClick={handleApply}>{t.applyLimit} — {unit === "mph" ? Math.round((custom || selected) * 0.621) : (custom || selected)} {unit === "mph" ? "mph" : "km/h"}</button>

        {/* Réinitialiser vers OSM */}
        <button className="limit-cancel-btn" onClick={onReset}>↺ Rétablir la limite automatique (OSM)</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// REPORT MODAL
// ═══════════════════════════════════════════════════════
function ReportModal({ report, onClose, onSave, onShare, t, unit, toDisplaySpeed, toDisplayDist, fmtTime, fmtDate, fmtDuration, renderShields, renderLeaves, scoreColor, reportName, setReportName }) {
  const inf = report.infractions || [];
  const sc = report.score ?? 5;
  const traj = report.trajectory || [];
  const counted = inf.filter(i => i.severity !== "tolerance");
  const unitLabel = unit === "mph" ? "mph" : "km/h";
  const sh = report.shields ?? shieldsFromScore(sc);

  const verdictBg = { 1: "rgba(244,63,94,.1)", 2: "rgba(244,63,94,.07)", 3: "rgba(245,158,11,.1)", 4: "rgba(14,165,233,.07)", 5: "rgba(34,197,94,.1)" };
  const verdictCol = { 1: "#f43f5e", 2: "#f43f5e", 3: "#f59e0b", 4: "#0ea5e9", 5: "#22c55e" };

  const severityGroups = [
    { key: "severe", label: t.severe, color: "#f43f5e", bg: "rgba(244,63,94,.08)" },
    { key: "moderate", label: t.moderate, color: "#f59e0b", bg: "rgba(245,158,11,.08)" },
    { key: "light", label: t.light, color: "#f97316", bg: "rgba(249,115,22,.08)" },
    { key: "tolerance", label: t.severityLabels?.tolerance || "tolérance", color: "#94a3b8", bg: "rgba(148,163,184,.08)" },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{t.reportTitle}</div>
        <div className="modal-subtitle">{report.date ? fmtDate(new Date(report.date)) : ""}</div>

        {/* Nom du rapport — éditable */}
        {setReportName && (
          <input
            className="report-name-input"
            value={reportName}
            onChange={e => setReportName(e.target.value)}
            placeholder={t.reportName}
          />
        )}
        {!setReportName && report.name && (
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 14, padding: "8px 12px", background: "var(--surface2)", borderRadius: 10 }}>{report.name}</div>
        )}

        {/* ── Bloc 1 : Résumé ── */}
        <div className="rep-block">
          <div className="rep-block-title">🛡️ {t.safeScore}</div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>{renderShields(sc, 28)}</div>
          <div className="rep-grid">
            <div className="rep-cell"><div className="rep-cell-label">{t.departure}</div><div className="rep-cell-value" style={{ fontSize: 17 }}>{report.startTime ? fmtTime(new Date(report.startTime)) : "--"}</div></div>
            <div className="rep-cell"><div className="rep-cell-label">{t.arrival}</div><div className="rep-cell-value" style={{ fontSize: 17 }}>{report.endTime ? fmtTime(new Date(report.endTime)) : "--"}</div></div>
            <div className="rep-divider" />
            <div className="rep-cell"><div className="rep-cell-label">{t.duration}</div><div className="rep-cell-value" style={{ fontSize: 17 }}>{fmtDuration(report.elapsed || 0)}</div></div>
            <div className="rep-cell"><div className="rep-cell-label">{t.distance}</div><div className="rep-cell-value" style={{ fontSize: 17 }}>{toDisplayDist(report.totalDistance || 0, unit)}</div></div>
            <div className="rep-divider" />
            <div className="rep-cell"><div className="rep-cell-label">{t.maxSpeed}</div><div className="rep-cell-value">{toDisplaySpeed(report.maxSpeed || 0, unit)} <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>{unitLabel}</span></div></div>
            <div className="rep-cell"><div className="rep-cell-label">{t.totalInfractions}</div><div className={`rep-cell-value ${counted.length > 0 ? "danger" : "ok"}`}>{counted.length}</div></div>
          </div>
          <div className="rep-verdict" style={{ background: verdictBg[sh], color: verdictCol[sh] }}>
            {t.verdicts[sh - 1]}
          </div>
        </div>

        {/* ── Bloc 2 : Éco-conduite ── */}
        {report.ecoData && (() => {
          const eco = report.ecoData;
          return (
            <div className="rep-block">
              <div className="rep-block-title">🍃 {t.ecoScore}</div>
              <div className="rep-eco-leaves">{renderLeaves(eco.leaves, 26)}</div>
              <div className="eco-verdict">{t.ecoVerdicts[eco.leaves - 1]}</div>
              <div className="rep-grid">
                <div className="rep-cell"><div className="rep-cell-label">{t.avgAccel}</div><div className="rep-cell-value" style={{ fontSize: 17 }}>{eco.avgAccel} <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>m/s²</span></div></div>
                <div className="rep-cell"><div className="rep-cell-label">{t.peakAccel}</div><div className="rep-cell-value" style={{ fontSize: 17 }}>{eco.peakAccel} <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>m/s²</span></div></div>
              </div>
            </div>
          );
        })()}

        {/* ── Bloc 3 : Carte ── */}
        <div className="rep-block">
          <div className="rep-block-title">{t.trip}</div>
          <LeafletMap points={traj} infractions={inf} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
            <span>{toDisplayDist(report.totalDistance || 0, unit)}</span>
            <span>{traj.length} {t.gpsPoints}</span>
          </div>
        </div>

        {/* ── Bloc 4 : Infractions ── */}
        <div className="rep-block">
          <div className="rep-block-title">🚨 {t.infList}</div>
          {counted.length === 0 && inf.filter(i => i.severity === "tolerance").length === 0
            ? <div className="empty-state">{t.noInfractionReport}</div>
            : severityGroups.map(grp => {
                const items = inf.filter(i => i.severity === grp.key);
                if (!items.length) return null;
                return (
                  <div key={grp.key} className="inf-group">
                    <div className="inf-group-title" style={{ color: grp.color }}>
                      <span style={{ background: grp.bg, borderRadius: 6, padding: "2px 8px" }}>{grp.label} ({items.length})</span>
                    </div>
                    {items.map((inf, i) => (
                      <div key={i} className="inf-row">
                        <div className="inf-dot" style={{ background: inf.color }} />
                        <div className="inf-row-info">
                          <div>{toDisplaySpeed(inf.speed, unit)} → {toDisplaySpeed(inf.limit, unit)} {unitLabel}</div>
                          <div className="inf-row-time">{fmtTime(inf.time)}</div>
                        </div>
                        <div className="inf-row-delta" style={{ color: inf.color }}>+{toDisplaySpeed(inf.delta, unit)}</div>
                      </div>
                    ))}
                  </div>
                );
              })
          }
        </div>

        {/* Actions */}
        <div className="report-actions">
          {onSave && <button className="action-btn" onClick={onSave}>{t.save}</button>}
          <button className="action-btn" onClick={onShare}>{t.share}</button>
        </div>
        <button className="modal-close" onClick={onClose}>{t.close}</button>
      </div>
    </div>
  );
}
