import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import CloudSyncCard from './CloudSyncCard';
import { useCloudSync } from './useCloudSync';

const TrendsCharts = lazy(() => import('./TrendsCharts'));

// ═══════════════════════════════════════════════════════════════════════════════
// CALCULATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

const UnitConvert = {
  lbsToKg: (lbs) => lbs * 0.453592,
  kgToLbs: (kg) => kg / 0.453592,
  inToCm: (inches) => inches * 2.54,
  cmToIn: (cm) => cm / 2.54,
  ftInToIn: (ft, inches) => ft * 12 + inches,
};

function calcBMR(weightKg, heightCm, age, sex) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

function calcTDEE(bmr, activityLevel) {
  const mult = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
  return Math.round(bmr * (mult[activityLevel] || 1.375));
}

function calcMacros(calories, weightLbs, goalWeightLbs, sex) {
  const protein = Math.round(Math.max(goalWeightLbs * 1.0, weightLbs * 0.82));
  const minFat = sex === 'male' ? 55 : 45;
  const fat = Math.max(minFat, Math.round((calories * 0.27) / 9));
  const carbCals = calories - (protein * 4) - (fat * 9);
  const carbs = Math.max(50, Math.round(carbCals / 4));
  return { protein, fat, carbs };
}

function generatePhases(tdee, baseSteps, sex) {
  const floor = sex === 'male' ? 1500 : 1200;
  const round25 = (n) => Math.round(n / 25) * 25;
  const round500 = (n) => Math.round(n / 500) * 500;

  const defs = [
    { phase: 1, weeks: [1, 2], calD: -300, stepD: 0, notes: 'Baseline', type: 'cut' },
    { phase: 2, weeks: [3, 4], calD: -400, stepD: 1000, type: 'cut' },
    { phase: 'D', weeks: [5], calD: -400, stepD: 1000, notes: 'DELOAD', type: 'deload' },
    { phase: 3, weeks: [6], calD: -400, stepD: 2000, type: 'cut' },
    { phase: 'B', weeks: [7, 8], calD: 0, stepD: 2000, notes: 'DIET BREAK', type: 'dietbreak' },
    { phase: 4, weeks: [9], calD: -500, stepD: 3000, type: 'cut' },
    { phase: 'D2', weeks: [10], calD: -500, stepD: 3000, notes: 'DELOAD', type: 'deload' },
    { phase: 5, weeks: [11, 12], calD: -500, stepD: 3500, type: 'cut' },
    { phase: 6, weeks: [13, 14], calD: -550, stepD: 4000, type: 'cut' },
    { phase: 7, weeks: [15, 16], calD: -600, stepD: 4500, notes: 'Final push', type: 'cut' },
  ];

  return defs.map(p => ({
    ...p,
    calories: p.type === 'dietbreak'
      ? round25(tdee)
      : Math.max(floor, round25(tdee + p.calD)),
    steps: round500(baseSteps + p.stepD),
  }));
}

function projectMilestones(startWeight, goalWeight, startBf, units) {
  const totalLoss = startWeight - goalWeight;
  const weeklyLoss = totalLoss / 16;
  const targetBf = Math.max(10, startBf - 10);
  const bfPerWeek = (startBf - targetBf) / 16;
  const wu = units === 'metric' ? 'kg' : 'lbs';
  const waistDeltaPerWeek = units === 'metric' ? 0.5 : 0.2;
  const waistUnit = units === 'metric' ? 'cm' : 'in';

  return [0, 4, 8, 12, 16].map(w => {
    const pw = Math.round(startWeight - weeklyLoss * w);
    const pbf = Math.round(startBf - bfPerWeek * w);
    const waist = (w * waistDeltaPerWeek).toFixed(1);
    return {
      week: w, weight: `${pw} ${wu}`, bf: `~${pbf}%`,
      waist: w > 0 ? `-${waist} ${waistUnit}` : '—',
      notice: w === 0 ? 'Baseline' : w <= 4 ? 'Strength stable, waist starts to change'
        : w <= 8 ? 'Clothes fit different' : w <= 12 ? 'Visible changes, face leaner'
        : 'Goal zone',
    };
  });
}

function estimateBfFromWaist(waistIn, sex) {
  if (!waistIn) return null;
  if (sex === 'male') return Math.round(Math.max(8, Math.min(40, (waistIn - 25) * 1.5)));
  return Math.round(Math.max(12, Math.min(45, (waistIn - 22) * 1.6)));
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS — WORKOUTS, STATUS, REFERENCE
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_CFG = {
  GREEN: { bg: '#052e16', text: '#4ade80', border: '#16a34a', label: 'Full workout. Push hard (RPE 8–9). Stop 1–2 reps before failure.' },
  YELLOW: { bg: '#431407', text: '#fbbf24', border: '#d97706', label: 'Same exercises, cut 1–2 sets, easier effort (RPE 7–8).' },
  'RED-A': { bg: '#450a0a', text: '#f87171', border: '#dc2626', label: 'Minimum dose only. 30 min max. Keep the habit.' },
  'RED-B': { bg: '#1c0505', text: '#b91c1c', border: '#7f1d1d', label: 'No lifting. Light walk only. Focus on recovery.' },
};

const GYMS = {
  work: {
    A: { title: 'Full Body A — Squat Focus', exercises: [
      { name: 'Barbell Back Squat', sets: '3-4', reps: '6-8', rir: '2-3', primary: true },
      { name: 'DB Bench Press', sets: '3-4', reps: '8-10', rir: '2' },
      { name: 'Cable Row', sets: '3-4', reps: '8-10', rir: '2' },
      { name: 'Leg Curl (odd wk) / RDL (even)', sets: '2-3', reps: '10-12', rir: '2' },
      { name: 'Curl + Pushdown superset', sets: '2 ea', reps: '10-12', rir: '1-2' },
    ]},
    B: { title: 'Full Body B — Hinge Focus', exercises: [
      { name: 'Trap Bar Deadlift or RDL', sets: '3', reps: '5-6', rir: '2-3', primary: true },
      { name: 'Standing OHP', sets: '3-4', reps: '8-10', rir: '2' },
      { name: 'Lat Pulldown / Pull-ups', sets: '3-4', reps: '8-10', rir: '2' },
      { name: 'Bulgarian Split Squat', sets: '2-3', reps: '10 ea', rir: '2' },
      { name: 'Plank + Dead Bug', sets: '2-3', reps: '30s / 10ea', rir: '—' },
    ]},
    C: { title: 'Full Body C — Volume', exercises: [
      { name: 'Front Squat / Hack Squat', sets: '3-4', reps: '8-10', rir: '2', primary: true },
      { name: 'Incline DB Press', sets: '3-4', reps: '8-10', rir: '2' },
      { name: 'Seated Cable Row', sets: '3-4', reps: '10-12', rir: '2' },
      { name: 'Hip Thrust', sets: '2-3', reps: '12-15', rir: '2' },
      { name: 'Lat Raise + Hammer Curl', sets: '2 ea', reps: '12-15', rir: '1-2' },
    ]},
    min: { title: 'Minimum Dose (30 min)', exercises: [
      { name: 'Leg Press or Goblet Squat', sets: '2', reps: '10', rir: '6-7', tag: 'SQUAT' },
      { name: 'Machine Press or Push-ups', sets: '2', reps: '10-12', rir: '6-7', tag: 'PRESS' },
      { name: 'Lat Pulldown or Machine Row', sets: '2', reps: '10', rir: '6-7', tag: 'PULL' },
    ]},
  },
  home: {
    A: { title: 'Full Body A — Lower Emphasis', exercises: [
      { name: 'Goblet Squat / DB Front Squat', sets: '3-4', reps: '8-12', rir: '2-3', primary: true },
      { name: 'DB Bench Press', sets: '3-4', reps: '8-10', rir: '2' },
      { name: 'DB Row (each arm)', sets: '3-4', reps: '8-10', rir: '2' },
      { name: 'DB Romanian Deadlift', sets: '3', reps: '10-12', rir: '2' },
      { name: 'DB Curl + Floor Ext superset', sets: '2 ea', reps: '10-12', rir: '1-2' },
    ]},
    B: { title: 'Full Body B — Pull Emphasis', exercises: [
      { name: 'Pull-ups / Chin-ups', sets: '3-4', reps: 'AMRAP', rir: '1-2', primary: true },
      { name: 'DB Overhead Press', sets: '3-4', reps: '8-10', rir: '2' },
      { name: 'DB Sumo Deadlift', sets: '3', reps: '8-10', rir: '2' },
      { name: 'Bulgarian Split Squat', sets: '2-3', reps: '10 ea', rir: '2' },
      { name: 'Plank + Dead Bug', sets: '2-3', reps: '30-45s / 10ea', rir: '—' },
    ]},
    C: { title: 'Full Body C — Push Emphasis', exercises: [
      { name: 'DB Step-ups / Lunges', sets: '3', reps: '10 ea', rir: '2', primary: true },
      { name: 'Incline DB Press', sets: '3-4', reps: '8-10', rir: '2' },
      { name: 'Inverted Row / DB Row', sets: '3-4', reps: '10-12', rir: '2' },
      { name: 'DB Hip Thrust', sets: '2-3', reps: '12-15', rir: '2' },
      { name: 'Heavy Bag (optional)', sets: '3 rnd', reps: '2-3 min', rir: '—', tag: 'FINISHER' },
    ]},
    min: { title: 'Minimum Dose (30 min)', exercises: [
      { name: 'Goblet Squat', sets: '2', reps: '10', rir: '6-7', tag: 'SQUAT' },
      { name: 'Push-ups', sets: '2', reps: '12', rir: '6-7', tag: 'PRESS' },
      { name: 'DB Row (each arm)', sets: '2', reps: '10 ea', rir: '6-7', tag: 'PULL' },
    ]},
  },
};

const INFO = {
  rpe: { title: 'RPE & RIR Explained', body: `RPE = Rate of Perceived Exertion (1–10 scale)\nRIR = Reps In Reserve (how many more you could do)\n\nRPE 6–7 = RIR 3–4 = "Easy, several reps left" (Red-A days)\nRPE 7–8 = RIR 2–3 = "Moderate effort" (Yellow days)\nRPE 8–9 = RIR 1–2 = "Hard, 1–2 more reps max" (Green days)\nRPE 10 = RIR 0 = Failure — AVOID this\n\nRule of thumb: If you're unsure, you probably have more reps left than you think. Stop earlier rather than later.` },
  liss: { title: 'What Counts as LISS?', body: `Low-Intensity Steady State = anything where you can hold a conversation.\n\n• Walking (any pace)\n• Light cycling\n• Easy swimming\n• Casual hiking\n\nHeart rate roughly 100–130 bpm. If you're breathing hard, it's not LISS.\n\nLISS is your DEFAULT cardio. HIIT is rare and earned.` },
  protein: { title: 'How to Hit Your Protein Target', body: `Quick anchors:\n• Chicken breast (palm-size) → ~45g\n• Steak/beef (palm-size) → ~40g\n• Fish (palm-size) → ~35g\n• Eggs (1 large) → ~6g\n• Greek yogurt (1 cup) → ~17g\n• Cottage cheese (1 cup) → ~25g\n• Whey protein (1 scoop) → ~25g\n\nQuick math: 4 palm-sized protein servings + 1 dairy + eggs at breakfast gets you close.\n\nYou don't need to weigh everything. Palm-size estimates work.` },
  progression: { title: 'Double Progression Method', body: `1. Start at the BOTTOM of the rep range with a challenging weight\n2. Each session, try to add reps (e.g., 6→7→8)\n3. When you hit the TOP of the range for ALL sets, add weight\n4. Drop back to the bottom of the range with new weight\n5. Repeat\n\nExample: Squat 3×6-8\n• Start: 185×6, 6, 6\n• Progress: 185×7, 7, 7 → 185×8, 8, 8\n• Add weight: 195×6, 6, 6\n• Repeat` },
  compliance: { title: 'What Counts as Compliant', body: `You need 12 out of 14 days hitting targets. NOT 14/14.\n\nCalories: Within ±100 kcal of phase target\nProtein: Hit your calculated protein target\nSteps: Weekly average within ±10% of target\nCaffeine: Last cup by 12:00 noon\n\nTwo "off" days per 2 weeks is built in. Don't let perfect kill good.` },
  deload: { title: 'What Is a Deload?', body: `Same exercises, same weights, but:\n• Cut sets in half (3-4 sets → 2 sets)\n• Stop very far from failure (RPE 5-6)\n• No HIIT\n• Keep walking\n• Eat at maintenance or slightly above\n• Sleep more if possible\n\nDeloads are SCHEDULED at Week 5 and Week 10.\n\nEMERGENCY deload: Trigger if ≥4 Yellow/Red days in any 7-day stretch.` },
  dietbreak: { title: 'What Is a Diet Break?', body: `Weeks 7–8: Calories go UP to maintenance.\n\nThis is intentional. Diet breaks:\n• Reset metabolic adaptation\n• Restore training performance\n• Give you a mental break\n• Improve long-term adherence\n\nYou are NOT falling off the wagon. This IS the plan. Keep protein high, keep training, keep walking. Just eat more.` },
  caffeine: { title: 'Caffeine Rules', body: `DEFAULT: Last caffeine by 12:00 PM noon.\n\nHalf-life of caffeine is 4–6 hours, meaning even "fast metabolizers" shouldn't rely on that.\n\nException allowed once per week max:\n• ≤50mg only (half a normal cup)\n• Before 2:30 PM\n• Only if safety-critical (driving, etc.)\n\n12 of 14 days compliant is the goal.` },
  plateau: { title: 'When the Scale Stalls', body: `Step 0: Rule out noise (salt, sleep, constipation, travel, new exercise)\n\nStep 1: Check compliance for 7 days — are you actually hitting targets?\n\nStep 2: Pick ONE lever:\n• Option A: Cut 100–150 kcal/day\n• Option B: Add 1,000–1,500 steps/day\n\n⚠️ NEVER BOTH AT ONCE. Cutting calories AND adding cardio accelerates muscle loss.\n\nHard floor: Your BMR. Exceptions only in final weeks with perfect recovery.` },
  tdee: { title: 'How Your Targets Are Calculated', body: `Your targets are based on the Mifflin-St Jeor equation:\n\nBMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age ± offset\n\nTDEE = BMR × activity multiplier:\n• Sedentary (desk job, no exercise): ×1.2\n• Lightly active (1–3 days exercise): ×1.375\n• Moderately active (3–5 days exercise): ×1.55\n• Very active (6–7 days exercise): ×1.725\n\nYour cutting calories = TDEE minus a progressive deficit (300–600 kcal over 16 weeks).\n\nProtein = ~1g per lb of goal body weight\nFat = ~27% of calories (minimum 45–55g for hormonal health)\nCarbs = remaining calories` },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const dateStr = (d = new Date()) => d.toISOString().split('T')[0];
const fmtDate = (s) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

function getWeekNum(startDate) {
  if (!startDate) return 0;
  const diff = Math.floor((new Date() - new Date(startDate + 'T00:00:00')) / 864e5);
  return Math.max(1, Math.min(16, Math.floor(diff / 7) + 1));
}

function getPhaseForWeek(phases, week) {
  for (const p of phases) { if (p.weeks.includes(week)) return p; }
  return phases[phases.length - 1];
}

function computeStatus(a) {
  if (!a || a.sleep === null || a.readiness === null || a.sick === null || a.secondBad === null) return null;
  if (a.sick || a.secondBad) return 'RED-B';
  if (a.sleep && a.readiness) return 'GREEN';
  if (!a.sleep && !a.readiness) return 'RED-A';
  return 'YELLOW';
}

function last7Stats(logs) {
  const counts = { GREEN: 0, YELLOW: 0, 'RED-A': 0, 'RED-B': 0 };
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const s = logs[dateStr(d)]?.status;
    if (s && counts[s] !== undefined) counts[s]++;
  }
  return counts;
}

function last14Compliance(logs) {
  let protein = 0, calories = 0, caffeine = 0, total = 0;
  for (let i = 0; i < 14; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ev = logs[dateStr(d)]?.evening;
    if (ev) {
      total++;
      if (ev.hitProtein) protein++;
      if (ev.hitCalories) calories++;
      if (ev.caffeineOk !== false) caffeine++;
    }
  }
  return { protein, calories, caffeine, total };
}

function weekQuality(counts) {
  const bad = counts.YELLOW + counts['RED-A'] + counts['RED-B'];
  if (bad >= 4) return 'DELOAD';
  if (counts.YELLOW >= 2 || counts['RED-B'] >= 1) return 'HOLD';
  return 'PUSH';
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

function useStore(key, initial) {
  const [data, setData] = useState(initial);
  const [loaded, setLoaded] = useState(false);

  const storage = useMemo(() => {
    if (typeof window === 'undefined') return null;
    if (window.storage && typeof window.storage.get === 'function' && typeof window.storage.set === 'function') {
      return {
        get: (k) => window.storage.get(k),
        set: (k, v) => window.storage.set(k, v),
      };
    }
    return {
      get: async (k) => ({ value: window.localStorage.getItem(k) }),
      set: async (k, v) => { window.localStorage.setItem(k, v); },
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (!storage) {
          setLoaded(true);
          return;
        }
        const r = await storage.get(key);
        if (r?.value) setData(JSON.parse(r.value));
      } catch (e) { /* fresh start */ }
      setLoaded(true);
    })();
  }, [key, storage]);

  const save = useCallback(async (val) => {
    setData(val);
    if (!storage) return;
    try { await storage.set(key, JSON.stringify(val)); } catch (e) { console.error('Save failed', e); }
  }, [key, storage]);

  return [data, save, loaded];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [profile, saveProfile, profileLoaded] = useStore('sc3_profile', null);
  const [logs, saveLogs, logsLoaded] = useStore('sc3_logs', {});
  const [weekly, saveWeekly, weeklyLoaded] = useStore('sc3_weekly', {});
  const [view, setView] = useState('loading');
  const [modal, setModal] = useState(null);

  const loaded = profileLoaded && logsLoaded && weeklyLoaded;
  const cloud = useCloudSync({ loaded, profile, logs, weekly, saveProfile, saveLogs, saveWeekly });

  useEffect(() => {
    if (loaded) setView(profile ? 'dashboard' : 'onboarding');
  }, [loaded, profile]);

  // ─── Derived state ──────────────────────────────────────────────────────
  const engine = useMemo(() => {
    if (!profile) return null;
    const wLbs = profile.units === 'metric' ? UnitConvert.kgToLbs(profile.weight) : profile.weight;
    const gLbs = profile.units === 'metric' ? UnitConvert.kgToLbs(profile.goalWeight) : profile.goalWeight;
    const hCm = profile.units === 'metric' ? profile.heightCm : UnitConvert.inToCm(profile.heightFt * 12 + (profile.heightIn || 0));
    const wKg = profile.units === 'metric' ? profile.weight : UnitConvert.lbsToKg(profile.weight);

    const bmr = calcBMR(wKg, hCm, profile.age, profile.sex);
    const tdee = calcTDEE(bmr, profile.activity);
    const phases = generatePhases(tdee, profile.baseSteps || 5000, profile.sex);
    const macros = calcMacros(phases[0].calories, wLbs, gLbs, profile.sex);
    const milestones = projectMilestones(
      profile.units === 'metric' ? profile.weight : profile.weight,
      profile.units === 'metric' ? profile.goalWeight : profile.goalWeight,
      profile.bodyFat || 22, profile.units
    );
    const floor = profile.sex === 'male' ? 1500 : 1200;

    return { bmr, tdee, phases, macros, milestones, wLbs, gLbs, floor };
  }, [profile]);

  const today = dateStr();
  const todayLog = logs[today];
  const currentWeek = profile ? getWeekNum(profile.startDate) : 0;
  const currentPhase = engine ? getPhaseForWeek(engine.phases, currentWeek) : null;
  const currentMacros = useMemo(() => {
    if (!engine || !currentPhase) return engine?.macros;
    const wLbs = engine.wLbs, gLbs = engine.gLbs;
    return calcMacros(currentPhase.calories, wLbs, gLbs, profile?.sex);
  }, [engine, currentPhase, profile]);

  const counts = useMemo(() => last7Stats(logs), [logs]);
  const comp14 = useMemo(() => last14Compliance(logs), [logs]);
  const wq = useMemo(() => weekQuality(counts), [counts]);
  const dayOfWeek = new Date().getDay();
  const isSunday = dayOfWeek === 0;

  const gymProg = profile ? GYMS[profile.gym] || GYMS.work : GYMS.work;
  const trainDays = profile?.trainingDays || [1, 3, 5];
  const slotIdx = trainDays.indexOf(dayOfWeek);
  const todayWk = slotIdx >= 0 ? ['A', 'B', 'C'][slotIdx] : null;
  const isDeload = currentPhase?.type === 'deload';
  const isDietBreak = currentPhase?.type === 'dietbreak';

  // ─── Handlers ───────────────────────────────────────────────────────────
  const saveDay = useCallback(async (update) => {
    const newLogs = { ...logs, [today]: { ...logs[today], ...update, date: today } };
    await saveLogs(newLogs);
  }, [logs, saveLogs, today]);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify({ profile, logs, weekly, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `sustainable-cut-${today}.json`; a.click();
    URL.revokeObjectURL(url);
  }, [profile, logs, weekly, today]);

  const handleCSV = useCallback(() => {
    const rows = [['Date', 'Status', 'Steps', 'Caffeine OK', 'Hit Protein', 'Hit Calories', 'Bedtime']];
    Object.entries(logs).sort((a, b) => a[0].localeCompare(b[0])).forEach(([d, l]) => {
      rows.push([d, l.status || '', l.evening?.steps || '', l.evening?.caffeineOk ?? '', l.evening?.hitProtein ?? '', l.evening?.hitCalories ?? '', l.evening?.bedtime || '']);
    });
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `sustainable-cut-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [logs, today]);

  const handleReset = useCallback(async () => {
    if (!confirm('This will delete ALL local data and start fresh. If cloud sync is enabled, this can sync to cloud too. Are you sure?')) return;
    await saveProfile(null);
    await saveLogs({});
    await saveWeekly({});
    setView('onboarding');
  }, [saveProfile, saveLogs, saveWeekly]);

  // ─── Loading ────────────────────────────────────────────────────────────
  if (!loaded || !cloud.authReady || cloud.hydrating || view === 'loading') {
    return <div style={S.root}><div style={S.center}><div style={S.spinner}/><p style={S.muted}>Loading…</p></div></div>;
  }

  return (
    <div style={S.root}>
      {/* Modal */}
      {modal && (
        <div style={S.overlay} onClick={() => setModal(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHead}>
              <h3 style={S.modalTitle}>{INFO[modal]?.title}</h3>
              <button style={S.modalX} onClick={() => setModal(null)}>✕</button>
            </div>
            <pre style={S.modalBody}>{INFO[modal]?.body}</pre>
          </div>
        </div>
      )}

      {/* ══════ ONBOARDING ══════ */}
      {view === 'onboarding' && (
        <Onboarding
          onComplete={async (p) => { await saveProfile(p); setView('dashboard'); }}
          cloud={cloud}
        />
      )}

      {/* ══════ MAIN APP ══════ */}
      {view !== 'onboarding' && profile && (
        <>
          <Header
            currentWeek={currentWeek}
            isDeload={isDeload}
            isDietBreak={isDietBreak}
            isFinal={currentPhase?.notes === 'Final push'}
            view={view}
            setView={setView}
            name={profile.name}
          />
          <main style={S.main}>
            {/* Deload / Diet Break banner */}
            {(isDeload || isDietBreak) && view !== 'settings' && (
              <div style={{ ...S.banner, borderColor: isDeload ? '#7c3aed' : '#3b82f6', background: isDeload ? 'linear-gradient(135deg,#1e0533,#0a0a0a)' : 'linear-gradient(135deg,#0c1e3d,#0a0a0a)' }}>
                <strong style={{ fontSize: '0.875rem' }}>{isDeload ? '📉 DELOAD WEEK' : '🔄 DIET BREAK WEEK'}</strong>
                <p style={{ margin: '0.375rem 0 0', fontSize: '0.8rem', opacity: 0.7, lineHeight: 1.4 }}>
                  {isDeload ? 'Same exercises, same weights. Cut sets in half. RPE 5–6. No HIIT. Keep walking.'
                    : `Calories UP to ${currentPhase.calories} kcal. This IS the plan. Keep protein at ${currentMacros?.protein}g+.`}
                </p>
                <button style={S.iLink} onClick={() => setModal(isDeload ? 'deload' : 'dietbreak')}>Learn why →</button>
              </div>
            )}

            {/* Sunday banner */}
            {isSunday && !weekly[`w${currentWeek}`] && view === 'dashboard' && (
              <button style={S.sundayBtn} onClick={() => setView('weekly')}>📊 It's Sunday — time for your weekly check-in →</button>
            )}

            {/* ──── DASHBOARD ──── */}
            {view === 'dashboard' && (
              <Dashboard
                todayLog={todayLog} today={today} currentPhase={currentPhase}
                macros={currentMacros} counts={counts} wq={wq} comp14={comp14}
                engine={engine} profile={profile}
                setView={setView} setModal={setModal}
              />
            )}

            {/* ──── CHECK-IN ──── */}
            {view === 'checkin' && (
              <CheckIn
                existing={todayLog?.statusAnswers}
                onSubmit={async (answers, status) => {
                  await saveDay({ status, statusAnswers: answers, completedAt: new Date().toISOString() });
                  setView('workout');
                }}
              />
            )}

            {/* ──── WORKOUT ──── */}
            {view === 'workout' && (
              <Workout
                status={todayLog?.status} gymProg={gymProg} todayWk={todayWk}
                isDeload={isDeload} currentPhase={currentPhase} counts={counts}
                logs={logs} todayLog={todayLog}
                setView={setView} setModal={setModal}
                gymLabel={profile.gym === 'home' ? '🏠 Home' : '🏢 Gym'}
              />
            )}

            {/* ──── EVENING LOG ──── */}
            {view === 'evening' && (
              <EveningLog
                existing={todayLog?.evening} phase={currentPhase}
                proteinTarget={currentMacros?.protein}
                onSubmit={async (ev) => {
                  await saveDay({ evening: ev, eveningAt: new Date().toISOString() });
                  setView('dashboard');
                }}
                setModal={setModal}
              />
            )}

            {/* ──── WEEKLY ──── */}
            {view === 'weekly' && (
              <WeeklyCheckIn
                week={currentWeek} counts={counts} wq={wq}
                units={profile.units}
                onSubmit={async (data) => {
                  await saveWeekly({ ...weekly, [`w${currentWeek}`]: { ...data, week: currentWeek, date: today, wq } });
                  setView('dashboard');
                }}
              />
            )}

            {/* ──── PLATEAU ──── */}
            {view === 'plateau' && (
              <PlateauWizard phase={currentPhase} engine={engine} setModal={setModal} onDone={() => setView('dashboard')} />
            )}

            {/* ──── TRENDS ──── */}
            {view === 'history' && (
              <Trends
                weekly={weekly} logs={logs} engine={engine}
                currentWeek={currentWeek} profile={profile}
              />
            )}

            {/* ──── SETTINGS ──── */}
            {view === 'settings' && (
              <Settings
                profile={profile} saveProfile={saveProfile}
                engine={engine} setModal={setModal}
                onExport={handleExport} onCSV={handleCSV} onReset={handleReset}
                cloud={cloud}
              />
            )}
          </main>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONBOARDING
// ═══════════════════════════════════════════════════════════════════════════════

const OB_SCREENS = [
  { icon: '⚡', title: 'The Sustainable Cut', sub: 'A protocol that adapts to your life', body: 'Your recovery dictates your intensity — not a calendar. Four morning questions determine your training color each day. The system works whether you slept great or the baby kept you up all night.' },
  { icon: '🚦', title: 'The Traffic Light System', sub: 'Every morning: 4 questions → 1 color → your plan', body: 'GREEN = full workout. YELLOW = reduced volume. RED-A = minimum dose (keep the habit). RED-B = rest day. Your sleep tracker data + how you feel determines everything.' },
  { icon: '📊', title: 'Personalized Targets', sub: 'Calculated from YOUR body, not a template', body: 'Your calories, protein, and step targets are calculated from your height, weight, age, and activity level using established sports science formulas. Everything adjusts as you progress.' },
  { icon: '💾', title: 'Save & Return', sub: 'Your data persists between sessions', body: 'Check in each morning, log each evening. Weekly check-ins on Sunday track your trends. All data is saved automatically — pick up right where you left off.' },
];

function Onboarding({ onComplete, cloud }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '', age: '', sex: 'male', units: 'imperial',
    heightFt: '', heightIn: '', heightCm: '',
    weight: '', goalWeight: '', bodyFat: '',
    activity: 'light', baseSteps: '', gym: 'work',
    trainingDays: [1, 3, 5], startDate: dateStr(),
    waist: '',
  });

  const upd = (k, v) => setForm({ ...form, [k]: v });
  const toggleDay = (d) => {
    const ds = form.trainingDays;
    if (ds.includes(d)) upd('trainingDays', ds.filter(x => x !== d));
    else if (ds.length < 3) upd('trainingDays', [...ds, d].sort((a, b) => a - b));
  };

  if (step < OB_SCREENS.length) {
    const s = OB_SCREENS[step];
    return (
      <div style={S.obWrap}>
        <div style={S.obDots}>{[...OB_SCREENS, {}].map((_, i) => <div key={i} style={{ ...S.dot6, background: i <= step ? '#16a34a' : '#333' }} />)}</div>
        <div style={S.obCard}>
          <span style={{ fontSize: '3rem' }}>{s.icon}</span>
          <h2 style={S.obTitle}>{s.title}</h2>
          <p style={{ color: '#16a34a', fontSize: '0.9rem', margin: '0.25rem 0 1rem' }}>{s.sub}</p>
          <p style={{ color: '#737373', fontSize: '0.9rem', lineHeight: 1.6 }}>{s.body}</p>
        </div>
        {cloud && (
          <div style={{ width: '100%', maxWidth: 380, marginTop: '1.25rem' }}>
            <CloudSyncCard sync={cloud} Card={Card} Label={Label} Input={Input} S={S} compact />
          </div>
        )}
        <div style={{ ...S.row, marginTop: '2rem', width: '100%', maxWidth: 380 }}>
          {step > 0 && <button style={S.ghost} onClick={() => setStep(step - 1)}>← Back</button>}
          <button style={{ ...S.cta, flex: 1 }} onClick={() => setStep(step + 1)}>
            {step === OB_SCREENS.length - 1 ? 'Set Up Profile →' : 'Next →'}
          </button>
        </div>
      </div>
    );
  }

  // Profile form
  const heightCm = form.units === 'metric' ? parseFloat(form.heightCm) || 0 : UnitConvert.inToCm((parseFloat(form.heightFt) || 0) * 12 + (parseFloat(form.heightIn) || 0));
  const weightKg = form.units === 'metric' ? parseFloat(form.weight) || 0 : UnitConvert.lbsToKg(parseFloat(form.weight) || 0);
  const canPreview = form.age && form.weight && form.goalWeight && (form.units === 'metric' ? form.heightCm : form.heightFt);

  let preview = null;
  if (canPreview) {
    const bmr = calcBMR(weightKg, heightCm, parseInt(form.age), form.sex);
    const tdee = calcTDEE(bmr, form.activity);
    const wLbs = form.units === 'metric' ? UnitConvert.kgToLbs(parseFloat(form.weight)) : parseFloat(form.weight);
    const gLbs = form.units === 'metric' ? UnitConvert.kgToLbs(parseFloat(form.goalWeight)) : parseFloat(form.goalWeight);
    const macros = calcMacros(tdee - 300, wLbs, gLbs, form.sex);
    preview = { bmr, tdee, startCal: Math.round((tdee - 300) / 25) * 25, macros };
  }

  const canSubmit = canPreview && form.startDate && form.trainingDays.length === 3;

  return (
    <div style={{ ...S.obWrap, justifyContent: 'flex-start', paddingTop: '2rem' }}>
      <div style={S.obDots}>{[...OB_SCREENS, {}].map((_, i) => <div key={i} style={{ ...S.dot6, background: '#16a34a' }} />)}</div>

      <div style={{ maxWidth: 440, width: '100%' }}>
        <h2 style={{ ...S.obTitle, marginBottom: '1.5rem' }}>Your Profile</h2>

        {cloud && (
          <CloudSyncCard sync={cloud} Card={Card} Label={Label} Input={Input} S={S} compact />
        )}

        <Card>
          <Label>Name (optional)</Label>
          <Input value={form.name} onChange={e => upd('name', e.target.value)} placeholder="How should we greet you?" />
        </Card>

        <Card>
          <Label>Units</Label>
          <div style={S.row}>
            <Pill active={form.units === 'imperial'} onClick={() => upd('units', 'imperial')}>🇺🇸 Imperial</Pill>
            <Pill active={form.units === 'metric'} onClick={() => upd('units', 'metric')}>🌍 Metric</Pill>
          </div>
        </Card>

        <Card>
          <div style={S.g2}>
            <div><Label>Age</Label><Input type="number" value={form.age} onChange={e => upd('age', e.target.value)} placeholder="30" /></div>
            <div>
              <Label>Sex</Label>
              <div style={S.row}>
                <Pill active={form.sex === 'male'} onClick={() => upd('sex', 'male')}>Male</Pill>
                <Pill active={form.sex === 'female'} onClick={() => upd('sex', 'female')}>Female</Pill>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <Label>Height</Label>
          {form.units === 'imperial' ? (
            <div style={S.row}>
              <Input type="number" value={form.heightFt} onChange={e => upd('heightFt', e.target.value)} placeholder="5" style={{ flex: 1 }} />
              <span style={S.muted}>ft</span>
              <Input type="number" value={form.heightIn} onChange={e => upd('heightIn', e.target.value)} placeholder="10" style={{ flex: 1 }} />
              <span style={S.muted}>in</span>
            </div>
          ) : (
            <div style={S.row}><Input type="number" value={form.heightCm} onChange={e => upd('heightCm', e.target.value)} placeholder="178" style={{ flex: 1 }} /><span style={S.muted}>cm</span></div>
          )}
        </Card>

        <Card>
          <div style={S.g2}>
            <div>
              <Label>Current Weight ({form.units === 'metric' ? 'kg' : 'lbs'})</Label>
              <Input type="number" value={form.weight} onChange={e => upd('weight', e.target.value)} placeholder={form.units === 'metric' ? '84' : '185'} />
            </div>
            <div>
              <Label>Goal Weight ({form.units === 'metric' ? 'kg' : 'lbs'})</Label>
              <Input type="number" value={form.goalWeight} onChange={e => upd('goalWeight', e.target.value)} placeholder={form.units === 'metric' ? '75' : '165'} />
            </div>
          </div>
        </Card>

        <Card>
          <div style={S.g2}>
            <div>
              <Label>Body Fat % (optional)</Label>
              <Input type="number" value={form.bodyFat} onChange={e => upd('bodyFat', e.target.value)} placeholder="22" />
            </div>
            <div>
              <Label>Waist at navel ({form.units === 'metric' ? 'cm' : 'in'})</Label>
              <Input type="number" value={form.waist} onChange={e => upd('waist', e.target.value)} placeholder={form.units === 'metric' ? '91' : '36'} />
              {form.waist && !form.bodyFat && (
                <button style={{ ...S.iLink, marginTop: 4 }} onClick={() => {
                  const waistIn = form.units === 'metric' ? UnitConvert.cmToIn(parseFloat(form.waist)) : parseFloat(form.waist);
                  upd('bodyFat', String(estimateBfFromWaist(waistIn, form.sex)));
                }}>
                  Estimate BF% from waist →
                </button>
              )}
            </div>
          </div>
        </Card>

        <Card>
          <Label>Activity Level</Label>
          {[
            ['sedentary', 'Sedentary — desk job, no exercise'],
            ['light', 'Lightly active — 1–3 days exercise/week'],
            ['moderate', 'Moderate — 3–5 days exercise/week'],
            ['active', 'Very active — 6–7 days exercise/week'],
          ].map(([k, l]) => (
            <button key={k} style={{ ...S.optBtn, ...(form.activity === k ? S.optActive : {}) }} onClick={() => upd('activity', k)}>{l}</button>
          ))}
        </Card>

        <Card>
          <Label>Current Daily Steps (average)</Label>
          <Input type="number" value={form.baseSteps} onChange={e => upd('baseSteps', e.target.value)} placeholder="5000" />
          <p style={{ color: '#525252', fontSize: '0.75rem', marginTop: 4 }}>Check your phone's health app for a recent average. If unsure, 5000 is a safe default.</p>
        </Card>

        <Card>
          <Label>Your Gym</Label>
          <div style={S.row}>
            <Pill active={form.gym === 'work'} onClick={() => upd('gym', 'work')}>🏢 Full Gym</Pill>
            <Pill active={form.gym === 'home'} onClick={() => upd('gym', 'home')}>🏠 Home Gym</Pill>
          </div>
        </Card>

        <Card>
          <Label>Training Days (pick 3)</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DAY_NAMES.map((n, i) => (
              <button key={i} style={{ ...S.dayBtn, ...(form.trainingDays.includes(i) ? S.dayActive : {}) }} onClick={() => toggleDay(i)}>{n}</button>
            ))}
          </div>
          <p style={{ color: '#525252', fontSize: '0.75rem', marginTop: 6 }}>Workouts A, B, C assigned in order to your selected days.</p>
        </Card>

        <Card>
          <Label>Start Date</Label>
          <Input type="date" value={form.startDate} onChange={e => upd('startDate', e.target.value)} />
        </Card>

        {/* Preview */}
        {preview && (
          <Card style={{ borderColor: '#16a34a33' }}>
            <h3 style={{ ...S.cardTitle, color: '#16a34a' }}>YOUR CALCULATED PLAN</h3>
            <div style={S.g2}>
              <Metric label="BMR" val={preview.bmr} unit="kcal" />
              <Metric label="TDEE" val={preview.tdee} unit="kcal" />
              <Metric label="Phase 1 Calories" val={preview.startCal} unit="kcal" />
              <Metric label="Protein" val={`${preview.macros.protein}g`} />
              <Metric label="Fat" val={`${preview.macros.fat}g`} />
              <Metric label="Carbs" val={`${preview.macros.carbs}g`} />
            </div>
          </Card>
        )}

        <div style={{ ...S.row, margin: '1.5rem 0 3rem' }}>
          <button style={S.ghost} onClick={() => setStep(step - 1)}>← Back</button>
          <button style={{ ...S.cta, flex: 1, opacity: canSubmit ? 1 : 0.4 }} disabled={!canSubmit}
            onClick={() => onComplete({
              ...form,
              age: parseInt(form.age),
              weight: parseFloat(form.weight),
              goalWeight: parseFloat(form.goalWeight),
              bodyFat: parseFloat(form.bodyFat) || null,
              baseSteps: parseInt(form.baseSteps) || 5000,
              heightFt: parseFloat(form.heightFt) || 0,
              heightIn: parseFloat(form.heightIn) || 0,
              heightCm: parseFloat(form.heightCm) || 0,
            })}>
            Start Protocol →
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════════════════════

function Header({ currentWeek, isDeload, isDietBreak, isFinal, view, setView, name }) {
  return (
    <header style={S.header}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h1 style={S.logo}>SC</h1>
          {name && <span style={{ color: '#525252', fontSize: '0.75rem' }}>— {name}</span>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={S.badge}>WK {currentWeek || '--'}</span>
          {isDeload && <span style={{ ...S.badge, background: '#5b21b6', color: '#c4b5fd' }}>DELOAD</span>}
          {isDietBreak && <span style={{ ...S.badge, background: '#1e40af', color: '#93c5fd' }}>DIET BREAK</span>}
          {isFinal && <span style={{ ...S.badge, background: '#7f1d1d', color: '#fca5a5' }}>FINAL</span>}
        </div>
      </div>
      <nav style={S.nav}>
        {[
          ['dashboard', 'Home'], ['checkin', 'Check In'], ['workout', 'Workout'],
          ['evening', 'Log'], ['history', 'Trends'], ['settings', '⚙'],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)} style={{ ...S.navBtn, ...(view === id ? S.navAct : {}) }}>{label}</button>
        ))}
      </nav>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function Dashboard({ todayLog, today, currentPhase, macros, counts, wq, comp14, engine, profile, setView, setModal }) {
  return (
    <div style={S.stack}>
      <Card>
        <div style={S.cardHead}><h2 style={S.cardTitle}>TODAY</h2><span style={S.dim}>{fmtDate(today)}</span></div>
        {todayLog?.status ? (
          <div style={{ ...S.statusBox, background: STATUS_CFG[todayLog.status].bg, borderColor: STATUS_CFG[todayLog.status].border }}>
            <span style={{ color: STATUS_CFG[todayLog.status].text, fontSize: '1.75rem', fontWeight: 800 }}>{todayLog.status}</span>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: 4 }}>{STATUS_CFG[todayLog.status].label}</p>
          </div>
        ) : (
          <button style={S.cta} onClick={() => setView('checkin')}>Complete Morning Check-In →</button>
        )}
      </Card>

      {currentPhase && macros && (
        <Card>
          <div style={S.cardHead}>
            <h2 style={S.cardTitle}>YOUR TARGETS</h2>
            <button style={S.iLink} onClick={() => setModal('tdee')}>How calculated? ⓘ</button>
          </div>
          <div style={S.g2}>
            <Metric label="kcal/day" val={currentPhase.calories} />
            <Metric label="steps/day" val={currentPhase.steps.toLocaleString()} />
            <Metric label="protein" val={`${macros.protein}g`} onClick={() => setModal('protein')} sub="ⓘ" />
            <Metric label="fat" val={`${macros.fat}g`} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <div style={{ flex: 1, background: '#111', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
              <span style={{ color: '#525252', fontSize: '0.65rem' }}>CARBS</span>
              <span style={{ display: 'block', color: '#a3a3a3', fontWeight: 600, fontSize: '0.85rem' }}>{macros.carbs}g</span>
            </div>
            <div style={{ flex: 1, background: '#111', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
              <span style={{ color: '#525252', fontSize: '0.65rem' }}>BMR</span>
              <span style={{ display: 'block', color: '#a3a3a3', fontWeight: 600, fontSize: '0.85rem' }}>{engine.bmr}</span>
            </div>
            <div style={{ flex: 1, background: '#111', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
              <span style={{ color: '#525252', fontSize: '0.65rem' }}>TDEE</span>
              <span style={{ display: 'block', color: '#a3a3a3', fontWeight: 600, fontSize: '0.85rem' }}>{engine.tdee}</span>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div style={S.cardHead}>
          <h2 style={S.cardTitle}>LAST 7 DAYS</h2>
          <span style={{ ...S.qBadge, background: wq === 'PUSH' ? '#052e16' : wq === 'HOLD' ? '#431407' : '#450a0a' }}>→ {wq}</span>
        </div>
        <StatusRow counts={counts} />
        {counts.YELLOW + counts['RED-A'] + counts['RED-B'] >= 4 && (
          <div style={S.alert}>⚠️ 4+ Yellow/Red days — consider an emergency deload <button style={S.iLink} onClick={() => setModal('deload')}>What's that? →</button></div>
        )}
      </Card>

      {comp14.total >= 7 && (
        <Card>
          <h2 style={S.cardTitle}>14-DAY COMPLIANCE</h2>
          <div style={{ marginTop: 8 }}>
            <CompBar label="Protein" hit={comp14.protein} total={comp14.total} />
            <CompBar label="Calories" hit={comp14.calories} total={comp14.total} />
            <CompBar label="Caffeine" hit={comp14.caffeine} total={comp14.total} />
          </div>
        </Card>
      )}

      <div style={S.g2}>
        {!todayLog?.evening && <button style={S.actCard} onClick={() => setView('evening')}>📝 Evening Log</button>}
        <button style={S.actCard} onClick={() => setView('workout')}>💪 Workout</button>
        <button style={S.actCard} onClick={() => setView('plateau')}>📉 Scale Stalled?</button>
        <button style={S.actCard} onClick={() => setView('history')}>📈 Trends</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK-IN
// ═══════════════════════════════════════════════════════════════════════════════

function CheckIn({ existing, onSubmit }) {
  const [a, setA] = useState(existing || { sleep: null, readiness: null, sick: null, secondBad: null });
  const status = computeStatus(a);

  const questions = [
    { key: 'sleep', q: 'Did you sleep ≥6 hours 45 min?', good: true },
    { key: 'readiness', q: 'Is your Readiness/recovery score ≥75?', good: true },
    { key: 'sick', q: 'Do you feel sick or run down?', good: false },
    { key: 'secondBad', q: 'Was last night your 2nd+ bad night in a row?', good: false },
  ];

  return (
    <div style={S.stack}>
      <h2 style={S.pageTitle}>Morning Check-In</h2>
      <p style={S.pageSub}>Open your sleep tracker, answer 4 questions</p>
      {questions.map((q, i) => (
        <Card key={q.key}>
          <p style={{ color: '#d4d4d4', fontWeight: 500, fontSize: '0.9375rem', margin: '0 0 0.75rem' }}>{i + 1}. {q.q}</p>
          <div style={S.row}>
            <button style={{ ...S.yn, ...(q.good ? (a[q.key] === true ? S.ynG : {}) : (a[q.key] === false ? S.ynG : {})) }}
              onClick={() => setA({ ...a, [q.key]: q.good ? true : false })}>{q.good ? 'Yes' : 'No'}</button>
            <button style={{ ...S.yn, ...(!q.good ? (a[q.key] === true ? S.ynR : {}) : (a[q.key] === false ? S.ynR : {})) }}
              onClick={() => setA({ ...a, [q.key]: q.good ? false : true })}>{q.good ? 'No' : 'Yes'}</button>
          </div>
        </Card>
      ))}
      {status && (
        <div style={{ ...S.statusBox, background: STATUS_CFG[status].bg, borderColor: STATUS_CFG[status].border, textAlign: 'center' }}>
          <span style={{ color: STATUS_CFG[status].text, fontSize: '1.5rem', fontWeight: 800 }}>{status}</span>
          <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: 4 }}>{STATUS_CFG[status].label}</p>
        </div>
      )}
      <button style={{ ...S.cta, opacity: status ? 1 : 0.4 }} disabled={!status} onClick={() => onSubmit(a, status)}>
        Save & View Workout →
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKOUT
// ═══════════════════════════════════════════════════════════════════════════════

function Workout({ status, gymProg, todayWk, isDeload, currentPhase, counts, logs, todayLog, setView, setModal, gymLabel }) {
  if (!status) {
    return <Card><p style={S.muted}>Complete your morning check-in first.</p><button style={S.cta} onClick={() => setView('checkin')}>Go to Check-In →</button></Card>;
  }

  return (
    <div style={S.stack}>
      <div style={{ ...S.statusBar, background: STATUS_CFG[status].bg, borderColor: STATUS_CFG[status].border }}>
        <span style={{ color: STATUS_CFG[status].text, fontWeight: 700 }}>{status} DAY</span>
        <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>{gymLabel}</span>
      </div>

      {status === 'RED-B' ? (
        <Card>
          <h2 style={S.cardTitle}>REST DAY</h2>
          <p style={S.muted}>No lifting today. Light walk if you want. Focus on sleep and recovery.</p>
          <p style={{ color: '#e5e5e5', fontWeight: 600, marginTop: '1rem' }}>This IS the workout.</p>
        </Card>
      ) : status === 'RED-A' ? (
        <Card>
          <div style={S.cardHead}><h2 style={S.cardTitle}>MINIMUM DOSE</h2><button style={S.iLink} onClick={() => setModal('rpe')}>RPE? ⓘ</button></div>
          <p style={S.muted}>1 squat/hinge + 1 press + 1 pull. 2 easy sets each. RPE 6–7. Done in 30 min.</p>
          <ExList exercises={gymProg.min.exercises} status="RED-A" isDeload={isDeload} />
        </Card>
      ) : todayWk && gymProg[todayWk] ? (
        <Card>
          <div style={S.cardHead}><h2 style={S.cardTitle}>{gymProg[todayWk].title}</h2><button style={S.iLink} onClick={() => setModal('rpe')}>RPE? ⓘ</button></div>
          <p style={S.muted}>
            {status === 'GREEN' && !isDeload && 'Push hard (RPE 8–9). Stop 1–2 reps before failure.'}
            {status === 'GREEN' && isDeload && 'DELOAD: Same weights, half sets. RPE 5–6.'}
            {status === 'YELLOW' && 'Cut 1–2 sets per exercise. RPE 7–8.'}
          </p>
          <ExList exercises={gymProg[todayWk].exercises} status={status} isDeload={isDeload} />
          <button style={{ ...S.iLink, marginTop: 12 }} onClick={() => setModal('progression')}>How do I progress weight? →</button>
        </Card>
      ) : (
        <Card>
          <h2 style={S.cardTitle}>REST DAY / CARDIO</h2>
          <p style={S.muted}>No scheduled lifting today. Hit your step target: <strong style={{ color: '#fff' }}>{currentPhase?.steps?.toLocaleString()} steps</strong></p>
          <button style={S.iLink} onClick={() => setModal('liss')}>What counts as LISS? →</button>
        </Card>
      )}

      {status === 'GREEN' && !isDeload && (
        <HiitGate counts={counts} logs={logs} todayLog={todayLog} />
      )}
    </div>
  );
}

function HiitGate({ counts, logs, todayLog }) {
  const hasHiit = Object.entries(logs).some(([d, l]) => {
    const dt = new Date(d + 'T12:00:00');
    const sow = new Date(); sow.setDate(sow.getDate() - sow.getDay()); sow.setHours(0, 0, 0, 0);
    return dt >= sow && dt < new Date() && l.didHiit;
  });

  const gates = [
    { label: 'No HIIT yet this week', ok: !hasHiit },
    { label: 'Today is GREEN', ok: todayLog?.status === 'GREEN' },
    { label: '≤1 Red-B day last 7 days', ok: counts['RED-B'] <= 1 },
  ];
  const allOk = gates.every(g => g.ok);

  return (
    <Card>
      <div style={S.cardHead}><h2 style={S.cardTitle}>HIIT CHECK</h2><span style={S.dim}>Default = LISS</span></div>
      <p style={S.muted}>HIIT is rare and earned. ALL gates must pass:</p>
      <div style={{ ...S.stack05, marginTop: 8 }}>
        {gates.map((g, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: g.ok ? '#16a34a' : '#dc2626', fontSize: '1rem' }}>{g.ok ? '✓' : '✗'}</span>
            <span style={{ color: '#d4d4d4', fontSize: '0.85rem' }}>{g.label}</span>
          </div>
        ))}
      </div>
      <div style={{ ...S.hiitBox, background: allOk ? '#052e16' : '#1c1917', borderColor: allOk ? '#16a34a' : '#44403c' }}>
        {allOk ? '✓ HIIT approved — 20–25 min, RPE 8–9' : '✗ Do 25–35 min easy walk instead'}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENING LOG
// ═══════════════════════════════════════════════════════════════════════════════

function EveningLog({ existing, phase, proteinTarget, onSubmit, setModal }) {
  const [ev, setEv] = useState(existing || { lastCaffeine: '', caffeineOk: null, steps: '', hitProtein: null, hitCalories: null, bedtime: '', wakeups: '' });
  const upd = (k, v) => setEv({ ...ev, [k]: v });

  return (
    <div style={S.stack}>
      <h2 style={S.pageTitle}>Evening Log</h2>
      <p style={S.pageSub}>60 seconds before bed</p>

      <Card>
        <Label>Last caffeine time</Label>
        <Input type="time" value={ev.lastCaffeine} onChange={e => upd('lastCaffeine', e.target.value)} />
        <div style={{ ...S.row, marginTop: 8 }}>
          <Pill active={ev.caffeineOk === true} onClick={() => upd('caffeineOk', true)}>Before noon ✓</Pill>
          <Pill active={ev.caffeineOk === false} warn onClick={() => upd('caffeineOk', false)}>After noon ✗</Pill>
        </div>
        {ev.caffeineOk === false && (
          <div style={S.inlineWarn}>☕ Late caffeine hurts sleep quality. <button style={S.iLink} onClick={() => setModal('caffeine')}>Rules →</button></div>
        )}
      </Card>

      <Card>
        <Label>Steps today</Label>
        <div style={S.row}>
          <Input type="number" value={ev.steps} onChange={e => upd('steps', e.target.value)} placeholder={String(phase?.steps || '')} style={{ flex: 1 }} />
          <span style={S.dim}>/ {phase?.steps?.toLocaleString()}</span>
        </div>
      </Card>

      <Card>
        <Label>Did you hit protein (≥{proteinTarget || '?'}g)?</Label>
        <div style={S.row}>
          <Pill active={ev.hitProtein === true} onClick={() => upd('hitProtein', true)}>Yes</Pill>
          <Pill active={ev.hitProtein === false} warn onClick={() => upd('hitProtein', false)}>No</Pill>
        </div>
        <button style={{ ...S.iLink, marginTop: 6 }} onClick={() => setModal('protein')}>Protein cheat sheet →</button>
      </Card>

      <Card>
        <Label>Did you hit calories (±100 of {phase?.calories})?</Label>
        <div style={S.row}>
          <Pill active={ev.hitCalories === true} onClick={() => upd('hitCalories', true)}>Yes</Pill>
          <Pill active={ev.hitCalories === false} warn onClick={() => upd('hitCalories', false)}>No</Pill>
        </div>
      </Card>

      <Card>
        <Label>Bedtime</Label>
        <Input type="time" value={ev.bedtime} onChange={e => upd('bedtime', e.target.value)} />
      </Card>

      <Card>
        <Label>Baby / night wakeups</Label>
        <Input type="number" value={ev.wakeups} onChange={e => upd('wakeups', e.target.value)} placeholder="0" min="0" />
      </Card>

      <button style={S.cta} onClick={() => onSubmit(ev)}>Save Evening Log ✓</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEKLY CHECK-IN
// ═══════════════════════════════════════════════════════════════════════════════

function WeeklyCheckIn({ week, counts, wq, units, onSubmit }) {
  const [f, setF] = useState({ avgWeight: '', waist: '', avgSleep: '', avgReadiness: '', squatW: '', squatR: '', deadW: '', deadR: '', benchW: '', benchR: '', rowW: '', rowR: '', notes: '' });
  const upd = (k, v) => setF({ ...f, [k]: v });
  const wu = units === 'metric' ? 'kg' : 'lbs';

  return (
    <div style={S.stack}>
      <h2 style={S.pageTitle}>Sunday Check-In</h2>
      <p style={S.pageSub}>Week {week} Review</p>

      <Card>
        <h3 style={S.cardTitle}>MEASUREMENTS</h3>
        <div style={S.g2}>
          <div><Label>7-Day Avg Weight ({wu})</Label><Input type="number" value={f.avgWeight} onChange={e => upd('avgWeight', e.target.value)} step="0.1" /></div>
          <div><Label>Waist at Navel ({units === 'metric' ? 'cm' : 'in'})</Label><Input type="number" value={f.waist} onChange={e => upd('waist', e.target.value)} step="0.25" /></div>
          <div><Label>Avg Sleep (hrs)</Label><Input type="number" value={f.avgSleep} onChange={e => upd('avgSleep', e.target.value)} step="0.25" /></div>
          <div><Label>Avg Readiness</Label><Input type="number" value={f.avgReadiness} onChange={e => upd('avgReadiness', e.target.value)} /></div>
        </div>
      </Card>

      <Card>
        <h3 style={S.cardTitle}>LIFT PERFORMANCE</h3>
        {[['Squat', 'squatW', 'squatR'], ['Deadlift/Hinge', 'deadW', 'deadR'], ['Bench/Press', 'benchW', 'benchR'], ['Row/Pull', 'rowW', 'rowR']].map(([name, wk, rk]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ flex: 1, color: '#d4d4d4', fontSize: '0.85rem' }}>{name}</span>
            <Input type="number" placeholder={wu} value={f[wk]} onChange={e => upd(wk, e.target.value)} style={{ width: 60, textAlign: 'center' }} />
            <span style={{ color: '#525252' }}>×</span>
            <Input type="number" placeholder="reps" value={f[rk]} onChange={e => upd(rk, e.target.value)} style={{ width: 60, textAlign: 'center' }} />
          </div>
        ))}
      </Card>

      <Card>
        <h3 style={S.cardTitle}>WEEK QUALITY</h3>
        <StatusRow counts={counts} />
        <div style={{ ...S.qBox, background: wq === 'PUSH' ? '#052e16' : wq === 'HOLD' ? '#431407' : '#450a0a' }}>
          Next week → <strong>{wq}</strong>
          {wq === 'PUSH' && ' — try to add reps or weight'}
          {wq === 'HOLD' && ' — same weights, no progression'}
          {wq === 'DELOAD' && ' — take an emergency deload'}
        </div>
      </Card>

      <Card>
        <Label>Notes (optional)</Label>
        <textarea value={f.notes} onChange={e => upd('notes', e.target.value)} style={{ ...S.inp, minHeight: 80, resize: 'vertical' }} placeholder="How did this week feel?" />
      </Card>

      <button style={S.cta} onClick={() => onSubmit(f)}>Save Weekly Check-In ✓</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLATEAU WIZARD
// ═══════════════════════════════════════════════════════════════════════════════

function PlateauWizard({ phase, engine, setModal, onDone }) {
  const [step, setStep] = useState(0);
  const [ans, setAns] = useState({});

  const noise = [
    ['sodium', 'High sodium yesterday? (water weight — wait 2–3 days)'],
    ['sleep', 'Poor sleep this week? (cortisol → water retention)'],
    ['constip', 'Constipation? (can mask 1–2 lbs of fat loss)'],
    ['travel', 'Recent travel or schedule disruption?'],
    ['newEx', 'New exercises or unusual soreness?'],
  ];

  const comp = [
    ['proteinOk', `Protein on target 12 of last 14 days?`],
    ['calsOk', `Calories within ±100 of ${phase?.calories || '---'}?`],
    ['stepsOk', 'Steps within ±10% of weekly target?'],
    ['recOk', 'Recovery normal? (NOT ≥3 Red-B or avg sleep <6:00)'],
  ];

  return (
    <div style={S.stack}>
      <h2 style={S.pageTitle}>Scale Stalled?</h2>
      <p style={S.pageSub}>Follow these steps in order. Don't skip.</p>

      {step === 0 && (
        <Card>
          <h3 style={S.cardTitle}>STEP 0: RULE OUT NOISE</h3>
          <p style={S.muted}>Has your 14-day trend not moved? First check:</p>
          <div style={{ ...S.stack05, marginTop: 8 }}>
            {noise.map(([k, l]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={ans[k] || false} onChange={e => setAns({ ...ans, [k]: e.target.checked })} style={{ accentColor: '#16a34a' }} />
                <span style={{ color: '#d4d4d4', fontSize: '0.85rem' }}>{l}</span>
              </label>
            ))}
          </div>
          {noise.some(([k]) => ans[k]) ? (
            <div style={{ ...S.alert, background: '#431407', marginTop: 12 }}>
              ⏳ Noise present. <strong>Wait 5–7 days</strong> before declaring a plateau.
              <button style={{ ...S.cta, marginTop: 8 }} onClick={onDone}>Got It — I'll Wait</button>
            </div>
          ) : (
            <button style={{ ...S.cta, marginTop: 12 }} onClick={() => setStep(1)}>None apply → Next</button>
          )}
        </Card>
      )}

      {step === 1 && (
        <Card>
          <h3 style={S.cardTitle}>STEP 1: CHECK COMPLIANCE</h3>
          <p style={S.muted}>If ANY is "No," fix that first for 7 days.</p>
          <div style={{ ...S.stack05, marginTop: 8 }}>
            {comp.map(([k, l]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ flex: 1, color: '#d4d4d4', fontSize: '0.85rem' }}>{l}</span>
                <div style={S.row}>
                  <MiniBtn active={ans[k] === true} onClick={() => setAns({ ...ans, [k]: true })}>Y</MiniBtn>
                  <MiniBtn active={ans[k] === false} warn onClick={() => setAns({ ...ans, [k]: false })}>N</MiniBtn>
                </div>
              </div>
            ))}
          </div>
          {comp.some(([k]) => ans[k] === false) ? (
            <div style={{ ...S.alert, background: '#431407', marginTop: 12 }}>
              🔧 Fix items marked "N" for 7 days, then reassess.
              <button style={{ ...S.cta, marginTop: 8 }} onClick={onDone}>Got It</button>
            </div>
          ) : comp.every(([k]) => ans[k] === true) ? (
            <button style={{ ...S.cta, marginTop: 12 }} onClick={() => setStep(2)}>All compliant → Pick a lever</button>
          ) : null}
        </Card>
      )}

      {step === 2 && (
        <Card>
          <h3 style={S.cardTitle}>STEP 2: PICK ONE LEVER</h3>
          <p style={S.muted}>Choose ONE adjustment:</p>
          <div style={{ ...S.g2, marginTop: 12 }}>
            <button style={S.leverCard} onClick={() => { setAns({ ...ans, lever: 'cal' }); setStep(3); }}>
              <strong style={{ color: '#fff' }}>Cut 150 kcal</strong>
              <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: 4 }}>New: {(phase?.calories || 2000) - 150} kcal</p>
            </button>
            <button style={S.leverCard} onClick={() => { setAns({ ...ans, lever: 'steps' }); setStep(3); }}>
              <strong style={{ color: '#fff' }}>Add 1,500 steps</strong>
              <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: 4 }}>New: {((phase?.steps || 8000) + 1500).toLocaleString()}</p>
            </button>
          </div>
          <div style={{ ...S.alert, background: '#450a0a', marginTop: 12 }}>⚠️ <strong>NEVER BOTH AT ONCE.</strong> Stacking accelerates muscle loss.</div>
          <p style={{ color: '#525252', fontSize: '0.75rem', marginTop: 8 }}>Hard floor: {engine?.floor || 1500} kcal (your BMR threshold).</p>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <h3 style={S.cardTitle}>✓ ADJUSTMENT SET</h3>
          <div style={{ ...S.statusBox, background: '#052e16', borderColor: '#16a34a', textAlign: 'center' }}>
            <p style={{ color: '#4ade80', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              {ans.lever === 'cal' ? `New target: ${(phase?.calories || 2000) - 150} kcal/day` : `New target: ${((phase?.steps || 8000) + 1500).toLocaleString()} steps/day`}
            </p>
          </div>
          <p style={{ ...S.muted, marginTop: 12 }}>Give this 14 days before reassessing.</p>
          <button style={{ ...S.cta, marginTop: 12 }} onClick={onDone}>Back to Dashboard</button>
        </Card>
      )}

      <button style={S.ghost} onClick={onDone}>← Back to Dashboard</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRENDS
// ═══════════════════════════════════════════════════════════════════════════════

function Trends({ weekly, logs, engine, currentWeek, profile }) {
  const weightData = useMemo(() =>
    Object.values(weekly).filter(v => v.avgWeight).sort((a, b) => (a.week || 0) - (b.week || 0))
      .map(v => ({ week: `W${v.week}`, weight: parseFloat(v.avgWeight), waist: parseFloat(v.waist) || null })),
    [weekly]);

  const liftData = useMemo(() =>
    Object.values(weekly).filter(v => v.squatW).sort((a, b) => (a.week || 0) - (b.week || 0))
      .map(v => ({ week: `W${v.week}`, squat: +v.squatW || 0, deadlift: +v.deadW || 0, bench: +v.benchW || 0 })),
    [weekly]);

  return (
    <div style={S.stack}>
      <h2 style={S.pageTitle}>Trends & History</h2>

      <Suspense fallback={<Card><p style={S.muted}>Loading charts…</p></Card>}>
        <TrendsCharts weightData={weightData} liftData={liftData} S={S} Card={Card} />
      </Suspense>

      {/* Milestones */}
      {engine?.milestones && (
        <Card>
          <h3 style={S.cardTitle}>PROJECTED MILESTONES</h3>
          {engine.milestones.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', opacity: currentWeek > m.week ? 0.4 : 1, borderLeft: currentWeek >= m.week && currentWeek < (engine.milestones[i + 1]?.week || 17) ? '3px solid #16a34a' : '3px solid #333' }}>
              <span style={{ fontWeight: 700, color: '#fff', minWidth: 32 }}>W{m.week}</span>
              <span style={{ color: '#d4d4d4', flex: 1, fontSize: '0.85rem' }}>{m.weight} • {m.bf} • {m.waist}</span>
              <span style={{ color: '#6b7280', fontSize: '0.7rem' }}>{m.notice}</span>
            </div>
          ))}
          <p style={{ color: '#525252', fontSize: '0.7rem', marginTop: 8 }}>* Projections assume consistent compliance. Actual results vary.</p>
        </Card>
      )}

      {/* Phase Progress */}
      {engine?.phases && (
        <Card>
          <h3 style={S.cardTitle}>PHASE PROGRESS</h3>
          {engine.phases.map((p, i) => {
            const isCur = p.weeks.includes(currentWeek);
            const isPast = p.weeks[p.weeks.length - 1] < currentWeek;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', opacity: isPast ? 0.35 : 1, borderLeft: isCur ? '3px solid #16a34a' : '3px solid transparent', fontSize: '0.8rem' }}>
                <span style={{ fontWeight: 700, color: '#fff', minWidth: 50 }}>W{p.weeks[0]}{p.weeks.length > 1 ? `–${p.weeks[p.weeks.length - 1]}` : ''}</span>
                <span style={{ color: '#9ca3af', flex: 1 }}>{p.calories} kcal • {p.steps.toLocaleString()} stp</span>
                {p.notes && <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#fbbf24', background: '#431407', padding: '2px 6px', borderRadius: 3 }}>{p.notes}</span>}
              </div>
            );
          })}
        </Card>
      )}

      {/* Log history */}
      <Card>
        <h3 style={S.cardTitle}>DAILY LOG HISTORY</h3>
        {Object.keys(logs).length === 0 && <p style={S.muted}>No logs yet.</p>}
        {Object.entries(logs).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 21).map(([d, l]) => (
          <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 4px', borderBottom: '1px solid #1a1a1a', flexWrap: 'wrap' }}>
            <span style={{ color: '#d4d4d4', fontSize: '0.78rem', minWidth: 85 }}>{fmtDate(d)}</span>
            {l.status && <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.63rem', fontWeight: 700, background: STATUS_CFG[l.status]?.bg, color: STATUS_CFG[l.status]?.text }}>{l.status}</span>}
            {l.evening?.steps && <span style={{ color: '#6b7280', fontSize: '0.72rem' }}>{parseInt(l.evening.steps).toLocaleString()} stp</span>}
            {l.evening?.hitProtein === true && <span style={{ color: '#16a34a', fontSize: '0.68rem' }}>P✓</span>}
            {l.evening?.hitProtein === false && <span style={{ color: '#f87171', fontSize: '0.68rem' }}>P✗</span>}
            {l.evening?.caffeineOk === false && <span style={{ color: '#fbbf24', fontSize: '0.68rem' }}>☕!</span>}
          </div>
        ))}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

function Settings({ profile, saveProfile, engine, setModal, onExport, onCSV, onReset, cloud }) {
  const upd = (k, v) => saveProfile({ ...profile, [k]: v });
  const wu = profile.units === 'metric' ? 'kg' : 'lbs';

  return (
    <div style={S.stack}>
      <h2 style={S.pageTitle}>Settings & Profile</h2>

      {cloud && (
        <CloudSyncCard sync={cloud} Card={Card} Label={Label} Input={Input} S={S} />
      )}

      <Card>
        <h3 style={S.cardTitle}>PROFILE</h3>
        <div style={S.g2}>
          <div><Label>Name</Label><Input value={profile.name || ''} onChange={e => upd('name', e.target.value)} /></div>
          <div><Label>Age</Label><Input type="number" value={profile.age} onChange={e => upd('age', parseInt(e.target.value) || '')} /></div>
          <div><Label>Weight ({wu})</Label><Input type="number" value={profile.weight} onChange={e => upd('weight', parseFloat(e.target.value) || '')} /></div>
          <div><Label>Goal ({wu})</Label><Input type="number" value={profile.goalWeight} onChange={e => upd('goalWeight', parseFloat(e.target.value) || '')} /></div>
        </div>
      </Card>

      <Card>
        <Label>Start Date</Label>
        <Input type="date" value={profile.startDate || ''} onChange={e => upd('startDate', e.target.value)} />
      </Card>

      <Card>
        <Label>Gym Type</Label>
        <div style={S.row}>
          <Pill active={profile.gym === 'work'} onClick={() => upd('gym', 'work')}>🏢 Full Gym</Pill>
          <Pill active={profile.gym === 'home'} onClick={() => upd('gym', 'home')}>🏠 Home Gym</Pill>
        </div>
      </Card>

      <Card>
        <Label>Training Days (pick 3)</Label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DAY_NAMES.map((n, i) => (
            <button key={i} style={{ ...S.dayBtn, ...(profile.trainingDays?.includes(i) ? S.dayActive : {}) }}
              onClick={() => {
                const ds = profile.trainingDays || [];
                if (ds.includes(i)) upd('trainingDays', ds.filter(d => d !== i));
                else if (ds.length < 3) upd('trainingDays', [...ds, i].sort((a, b) => a - b));
              }}>{n}</button>
          ))}
        </div>
      </Card>

      {engine && (
        <Card style={{ borderColor: '#16a34a33' }}>
          <h3 style={{ ...S.cardTitle, color: '#16a34a' }}>COMPUTED VALUES</h3>
          <div style={S.g2}>
            <Metric label="BMR" val={engine.bmr} unit="kcal" />
            <Metric label="TDEE" val={engine.tdee} unit="kcal" />
            <Metric label="Cal Floor" val={engine.floor} unit="kcal" />
            <Metric label="Protein" val={`${engine.macros.protein}g`} />
          </div>
          <button style={{ ...S.iLink, marginTop: 8 }} onClick={() => setModal('tdee')}>How are these calculated? →</button>
        </Card>
      )}

      <Card>
        <Label>Export Data</Label>
        <div style={S.row}>
          <button style={S.expBtn} onClick={onExport}>📦 JSON backup</button>
          <button style={S.expBtn} onClick={onCSV}>📊 CSV logs</button>
        </div>
      </Card>

      <Card>
        <Label>Quick Reference</Label>
        <div style={S.stack05}>
          {Object.entries(INFO).map(([k, v]) => (
            <button key={k} style={S.refBtn} onClick={() => setModal(k)}>{v.title} →</button>
          ))}
        </div>
      </Card>

      <Card>
        <button style={{ ...S.ghost, width: '100%', color: '#dc2626', borderColor: '#dc262644' }} onClick={onReset}>
          ⚠ Reset All Data
        </button>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function Card({ children, style = {} }) {
  return <div style={{ ...S.card, ...style }}>{children}</div>;
}

function Label({ children }) {
  return <label style={S.label}>{children}</label>;
}

function Input({ style = {}, ...props }) {
  return <input {...props} style={{ ...S.inp, ...style }} />;
}

function Pill({ active, warn, children, onClick }) {
  return (
    <button style={{ ...S.pill, ...(active ? (warn ? S.pillW : S.pillG) : {}) }} onClick={onClick}>{children}</button>
  );
}

function MiniBtn({ active, warn, children, onClick }) {
  return (
    <button style={{ ...S.miniBtn, ...(active ? (warn ? S.pillW : S.pillG) : {}) }} onClick={onClick}>{children}</button>
  );
}

function Metric({ label, val, unit, sub, onClick }) {
  return (
    <div style={S.metric} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      <span style={{ display: 'block', fontSize: '1.3rem', fontWeight: 700, color: '#fff' }}>{val}</span>
      <span style={{ display: 'block', fontSize: '0.68rem', color: '#525252', marginTop: 1 }}>{label} {sub} {unit}</span>
    </div>
  );
}

function StatusRow({ counts }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {Object.entries(counts).map(([s, c]) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_CFG[s].text, flexShrink: 0 }} />
          <span style={{ color: '#9ca3af', fontSize: '0.78rem' }}>{s}</span>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>{c}</span>
        </div>
      ))}
    </div>
  );
}

function CompBar({ label, hit, total }) {
  const pct = total > 0 ? Math.round((hit / total) * 100) : 0;
  const pass = hit >= Math.ceil(total * 0.86);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ color: '#d4d4d4', fontSize: '0.78rem' }}>{label}</span>
        <span style={{ color: pass ? '#16a34a' : '#f87171', fontSize: '0.78rem', fontWeight: 600 }}>{hit}/{total}</span>
      </div>
      <div style={{ height: 5, background: '#1c1917', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: pass ? '#16a34a' : '#f87171', borderRadius: 3, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

function ExList({ exercises, status, isDeload }) {
  const adjSets = (sets) => {
    if (isDeload) { const m = sets.match(/(\d+)/); if (m) return String(Math.ceil(parseInt(m[1]) / 2)); }
    if (status === 'YELLOW' && sets.includes('-')) return sets.split('-')[0];
    return sets;
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
      {exercises.map((ex, i) => (
        <div key={i} style={S.exRow}>
          {ex.tag && <span style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.1em', color: '#525252' }}>{ex.tag}</span>}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ color: ex.primary ? '#fff' : '#d4d4d4', fontWeight: ex.primary ? 600 : 400, fontSize: '0.85rem' }}>{ex.name}</span>
            <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{adjSets(ex.sets)} × {ex.reps}</span>
          </div>
          <span style={{ color: '#44403c', fontSize: '0.68rem' }}>RIR {ex.rir}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const S = {
  root: { minHeight: '100vh', background: '#0a0a0a', color: '#e5e5e5', fontFamily: "'Geist', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' },
  spinner: { width: 32, height: 32, border: '3px solid #1c1917', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  stack: { display: 'flex', flexDirection: 'column', gap: 14 },
  stack05: { display: 'flex', flexDirection: 'column', gap: 6 },
  row: { display: 'flex', gap: 8, alignItems: 'center' },
  g2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },

  header: { background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', padding: '10px 14px', position: 'sticky', top: 0, zIndex: 100 },
  logo: { margin: 0, fontSize: '1.3rem', fontWeight: 900, color: '#16a34a', letterSpacing: '-0.05em' },
  badge: { background: '#171717', padding: '4px 10px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', color: '#a3a3a3' },
  nav: { display: 'flex', gap: 2, overflowX: 'auto' },
  navBtn: { padding: '6px 10px', background: 'transparent', border: 'none', borderRadius: 8, color: '#525252', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' },
  navAct: { background: '#171717', color: '#fff' },

  main: { padding: 14, maxWidth: 560, margin: '0 auto', paddingBottom: 48 },

  card: { background: '#141414', borderRadius: 14, padding: 16, border: '1px solid #1f1f1f', marginBottom: 0 },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', color: '#525252', margin: 0 },

  statusBox: { padding: 18, borderRadius: 10, border: '2px solid' },
  statusBar: { padding: 10, borderRadius: 10, fontSize: '0.78rem', border: '2px solid', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },

  cta: { width: '100%', padding: 14, background: '#16a34a', border: 'none', borderRadius: 10, color: '#fff', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', marginTop: 10 },
  ghost: { padding: '10px 14px', background: 'transparent', border: '1px solid #333', borderRadius: 10, color: '#a3a3a3', fontSize: '0.85rem', cursor: 'pointer' },
  pill: { flex: 1, padding: 10, background: '#171717', border: '2px solid #292524', borderRadius: 8, color: '#6b7280', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textAlign: 'center' },
  pillG: { background: '#052e16', borderColor: '#16a34a', color: '#4ade80' },
  pillW: { background: '#431407', borderColor: '#d97706', color: '#fbbf24' },
  yn: { flex: 1, padding: 12, background: '#0f0f0f', border: '2px solid #292524', borderRadius: 10, color: '#6b7280', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', textAlign: 'center' },
  ynG: { background: '#052e16', borderColor: '#16a34a', color: '#4ade80' },
  ynR: { background: '#450a0a', borderColor: '#f87171', color: '#f87171' },
  actCard: { padding: 14, background: '#141414', border: '1px solid #1f1f1f', borderRadius: 12, color: '#d4d4d4', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', textAlign: 'center' },
  miniBtn: { padding: '5px 10px', background: '#171717', border: '2px solid #292524', borderRadius: 6, color: '#525252', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' },
  dayBtn: { padding: '8px 10px', background: '#171717', border: '2px solid #292524', borderRadius: 8, color: '#525252', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', minWidth: 42, textAlign: 'center' },
  dayActive: { background: '#052e16', borderColor: '#16a34a', color: '#4ade80' },
  expBtn: { flex: 1, padding: 10, background: '#171717', border: '1px solid #292524', borderRadius: 8, color: '#d4d4d4', fontSize: '0.78rem', cursor: 'pointer', textAlign: 'center' },
  refBtn: { width: '100%', padding: 8, background: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: 8, color: '#a3a3a3', fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left' },
  optBtn: { display: 'block', width: '100%', padding: 10, background: '#0f0f0f', border: '2px solid #292524', borderRadius: 8, color: '#9ca3af', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left', marginBottom: 6 },
  optActive: { background: '#052e16', borderColor: '#16a34a', color: '#4ade80' },

  label: { display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#737373', marginBottom: 4 },
  inp: { padding: 10, background: '#171717', border: '2px solid #292524', borderRadius: 10, color: '#fff', fontSize: '0.9375rem', outline: 'none', width: '100%', boxSizing: 'border-box' },
  metric: { background: '#0a0a0a', padding: 12, borderRadius: 10, textAlign: 'center', cursor: 'default' },

  iLink: { background: 'none', border: 'none', color: '#16a34a', fontSize: '0.72rem', fontWeight: 500, cursor: 'pointer', padding: '2px 0', textAlign: 'left' },
  alert: { background: '#450a0a', color: '#fca5a5', padding: 10, borderRadius: 8, fontSize: '0.78rem', lineHeight: 1.5, marginTop: 10 },
  inlineWarn: { background: '#431407', color: '#fde68a', padding: '8px 10px', borderRadius: 8, fontSize: '0.72rem', marginTop: 8, lineHeight: 1.5 },
  banner: { padding: 14, borderRadius: 12, border: '2px solid', marginBottom: 4, color: '#e5e5e5' },
  sundayBtn: { width: '100%', padding: 14, background: '#172554', border: '2px solid #3b82f6', borderRadius: 12, color: '#93c5fd', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', textAlign: 'center', marginBottom: 8 },

  qBadge: { padding: '3px 10px', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700, color: '#fff' },
  qBox: { padding: 10, borderRadius: 8, color: '#fff', fontSize: '0.78rem', marginTop: 10 },

  pageTitle: { fontSize: '1.3rem', fontWeight: 700, color: '#fff', margin: 0, textAlign: 'center' },
  pageSub: { color: '#525252', textAlign: 'center', fontSize: '0.85rem', margin: '3px 0 8px' },
  muted: { color: '#737373', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 },
  dim: { color: '#525252', fontSize: '0.72rem' },

  exRow: { padding: 10, background: '#0a0a0a', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 3 },
  hiitBox: { padding: 10, borderRadius: 8, textAlign: 'center', color: '#fff', fontWeight: 600, marginTop: 10, fontSize: '0.85rem', border: '1px solid' },
  leverCard: { padding: 14, background: '#141414', border: '2px solid #292524', borderRadius: 12, cursor: 'pointer', textAlign: 'left' },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 },
  modal: { background: '#171717', borderRadius: 16, padding: 20, maxWidth: 440, width: '100%', maxHeight: '80vh', overflow: 'auto', border: '1px solid #333' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  modalTitle: { margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff' },
  modalX: { background: 'none', border: 'none', color: '#6b7280', fontSize: '1.2rem', cursor: 'pointer', padding: 3 },
  modalBody: { color: '#a3a3a3', fontSize: '0.85rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 },

  obWrap: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 20px' },
  obDots: { display: 'flex', gap: 8, marginBottom: 24 },
  dot6: { width: 8, height: 8, borderRadius: '50%' },
  obCard: { maxWidth: 380, textAlign: 'center' },
  obTitle: { fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: '12px 0 4px', letterSpacing: '-0.02em' },
};

// Inject animation
if (typeof document !== 'undefined') {
  const styleId = 'sc3-global-style';
  if (!document.getElementById(styleId)) {
    const s = document.createElement('style');
    s.id = styleId;
    s.textContent = `@keyframes spin{to{transform:rotate(360deg)}} *{scrollbar-width:thin;scrollbar-color:#292524 transparent} ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-thumb{background:#292524;border-radius:3px}`;
    document.head.appendChild(s);
  }
}
