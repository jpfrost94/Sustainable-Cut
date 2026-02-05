import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

// ─── CONSTANTS ──────────────────────────────────────────────────────────────────

const PHASES = [
  { phase: 1, weeks: [1, 2], calories: 2150, steps: 6500, notes: 'Baseline', type: 'cut' },
  { phase: 2, weeks: [3, 4], calories: 2050, steps: 7500, notes: '', type: 'cut' },
  { phase: 'D', weeks: [5], calories: 2050, steps: 7500, notes: 'DELOAD', type: 'deload' },
  { phase: 3, weeks: [6], calories: 2050, steps: 8500, notes: '', type: 'cut' },
  { phase: 'B', weeks: [7, 8], calories: 2450, steps: 8500, notes: 'DIET BREAK', type: 'dietbreak' },
  { phase: 4, weeks: [9], calories: 2000, steps: 9500, notes: '', type: 'cut' },
  { phase: 'D2', weeks: [10], calories: 2000, steps: 9500, notes: 'DELOAD', type: 'deload' },
  { phase: 5, weeks: [11, 12], calories: 2000, steps: 10000, notes: '', type: 'cut' },
  { phase: 6, weeks: [13, 14], calories: 1950, steps: 10500, notes: '', type: 'cut' },
  { phase: 7, weeks: [15, 16], calories: 1900, steps: 11000, notes: 'Final push', type: 'cut' },
];

const STATUS_CONFIG = {
  GREEN: { bg: '#065f46', text: '#34d399', border: '#10b981', label: 'Full workout. Push hard (RPE 8-9). Stop 1-2 reps before failure.' },
  YELLOW: { bg: '#78350f', text: '#fbbf24', border: '#f59e0b', label: 'Same exercises, cut 1-2 sets, easier effort (RPE 7-8).' },
  'RED-A': { bg: '#7f1d1d', text: '#f87171', border: '#ef4444', label: 'Minimum dose only. 30 min max. Keep the habit.' },
  'RED-B': { bg: '#450a0a', text: '#dc2626', border: '#b91c1c', label: 'No lifting. Light walk only. Focus on recovery.' },
};

const WORK_GYM = {
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
  C: { title: 'Full Body C — Volume Focus', exercises: [
    { name: 'Front Squat / Hack Squat', sets: '3-4', reps: '8-10', rir: '2', primary: true },
    { name: 'Incline DB Press', sets: '3-4', reps: '8-10', rir: '2' },
    { name: 'Seated Cable Row', sets: '3-4', reps: '10-12', rir: '2' },
    { name: 'Hip Thrust', sets: '2-3', reps: '12-15', rir: '2' },
    { name: 'Lat Raise + Hammer Curl', sets: '2 ea', reps: '12-15', rir: '1-2' },
  ]},
  minDose: { title: 'Minimum Dose (30 min)', exercises: [
    { name: 'Leg Press or Goblet Squat', sets: '2', reps: '10', rir: '6-7', pattern: 'SQUAT/HINGE' },
    { name: 'Machine Press or Push-ups', sets: '2', reps: '10-12', rir: '6-7', pattern: 'PRESS' },
    { name: 'Lat Pulldown or Machine Row', sets: '2', reps: '10', rir: '6-7', pattern: 'PULL' },
  ]},
};

const HOME_GYM = {
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
    { name: 'Heavy Bag (optional)', sets: '3 rnd', reps: '2-3 min', rir: '—', pattern: 'FINISHER' },
  ]},
  minDose: { title: 'Minimum Dose (30 min)', exercises: [
    { name: 'Goblet Squat', sets: '2', reps: '10', rir: '6-7', pattern: 'SQUAT/HINGE' },
    { name: 'Push-ups', sets: '2', reps: '12', rir: '6-7', pattern: 'PRESS' },
    { name: 'DB Row (each arm)', sets: '2', reps: '10 ea', rir: '6-7', pattern: 'PULL' },
  ]},
};

const PROTEIN_GUIDE = [
  { food: 'Chicken breast', portion: 'Palm-sized (150g)', protein: '~45g' },
  { food: 'Steak / beef', portion: 'Palm-sized (150g)', protein: '~40g' },
  { food: 'Fish (salmon, tilapia)', portion: 'Palm-sized (150g)', protein: '~35g' },
  { food: 'Eggs', portion: '1 large', protein: '~6g' },
  { food: 'Greek yogurt', portion: '1 cup (200g)', protein: '~17g' },
  { food: 'Cottage cheese', portion: '1 cup', protein: '~25g' },
  { food: 'Whey protein', portion: '1 scoop', protein: '~25g' },
  { food: 'Black beans', portion: '½ cup cooked', protein: '~8g' },
];

const MILESTONES = [
  { week: 0, weight: '185 lbs', bf: '~22%', notice: 'Baseline' },
  { week: 4, weight: '180-182', bf: '~20%', notice: 'Waist -0.5-1″, strength stable' },
  { week: 8, weight: '175-178', bf: '~17%', notice: 'Waist -1.5-2″, clothes fit different' },
  { week: 12, weight: '170-173', bf: '~15%', notice: 'Waist -2-3″, face leaner' },
  { week: 16, weight: '165-170', bf: '12-14%', notice: 'Waist -3-4″, abs visible in morning' },
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── HELPERS ────────────────────────────────────────────────────────────────────

const getDateStr = (d = new Date()) => d.toISOString().split('T')[0];
const formatDate = (str) => new Date(str + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function computeStatus(answers) {
  const { sleep, readiness, sick, secondBadNight } = answers;
  if (sleep === null || readiness === null || sick === null || secondBadNight === null) return null;
  if (sick === true || secondBadNight === true) return 'RED-B';
  if (sleep === true && readiness === true) return 'GREEN';
  if (sleep === false || readiness === false) return 'YELLOW';
  return 'YELLOW';
}

function getWeekNumber(startDate) {
  if (!startDate) return 0;
  const start = new Date(startDate + 'T00:00:00');
  const now = new Date();
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  return clamp(Math.floor(diffDays / 7) + 1, 1, 16);
}

function getPhaseForWeek(week) {
  for (const p of PHASES) {
    if (p.weeks.includes(week)) return p;
  }
  return PHASES[PHASES.length - 1];
}

function getLast7DaysStats(logs) {
  const counts = { GREEN: 0, YELLOW: 0, 'RED-A': 0, 'RED-B': 0 };
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = getDateStr(d);
    if (logs[ds]?.status) {
      counts[logs[ds].status]++;
      days.push(logs[ds]);
    }
  }
  return { counts, days, total: days.length };
}

function getLast14DaysStats(logs) {
  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = getDateStr(d);
    if (logs[ds]) days.push(logs[ds]);
  }
  let proteinDays = 0, calorieDays = 0, caffeineDays = 0, stepDays = 0, totalWithEvening = 0;
  days.forEach(d => {
    if (d.eveningLog) {
      totalWithEvening++;
      if (d.eveningLog.hitProtein) proteinDays++;
      if (d.eveningLog.hitCalories) calorieDays++;
      if (d.eveningLog.caffeineBeforeNoon !== false) caffeineDays++;
    }
  });
  return { proteinDays, calorieDays, caffeineDays, stepDays, totalWithEvening, days };
}

function getWeekQuality(stats7) {
  const { counts } = stats7;
  const yellowRedTotal = counts.YELLOW + counts['RED-A'] + counts['RED-B'];
  if (yellowRedTotal >= 4) return 'DELOAD';
  if (counts.YELLOW >= 2 || counts['RED-B'] >= 1) return 'HOLD';
  return 'PUSH';
}

// ─── INFO MODAL CONTENT ────────────────────────────────────────────────────────

const INFO_CONTENT = {
  rpe: {
    title: 'RPE & RIR Explained',
    body: `RPE = Rate of Perceived Exertion (1-10 scale)
RIR = Reps In Reserve (how many more you could do)

RPE 6-7 = RIR 3-4 = "Easy, several reps left" (Red-A days)
RPE 7-8 = RIR 2-3 = "Moderate effort" (Yellow days)
RPE 8-9 = RIR 1-2 = "Hard, 1-2 more reps max" (Green days)
RPE 10 = RIR 0 = Failure — AVOID this

Rule of thumb: If you're unsure, you probably have more reps left than you think. Stop earlier rather than later.`
  },
  liss: {
    title: 'What Counts as LISS?',
    body: `Low-Intensity Steady State = anything where you can hold a conversation.

• Walking (any pace)
• Light cycling (not spinning hard)
• Easy swimming
• Casual hiking

Heart rate roughly 100-130 bpm. If you're breathing hard, it's not LISS.

LISS is your DEFAULT cardio. HIIT is rare and earned.`
  },
  protein: {
    title: 'How to Hit 180g Protein',
    body: `Quick anchors:
• Chicken breast (palm-size) → ~45g
• Steak/beef (palm-size) → ~40g
• Fish (palm-size) → ~35g
• Eggs (1 large) → ~6g
• Greek yogurt (1 cup) → ~17g
• Cottage cheese (1 cup) → ~25g
• Whey protein (1 scoop) → ~25g

Quick math: 4 palm-sized protein servings + 1 dairy + eggs at breakfast ≈ 180g

You don't need to weigh everything. Palm-size estimates work.`
  },
  progression: {
    title: 'Double Progression Method',
    body: `This is the only system you need:

1. Start at the BOTTOM of the rep range with a challenging weight
2. Each session, try to add reps (e.g., 6→7→8)
3. When you hit the TOP of the range for ALL sets, add weight
4. Drop back to the bottom of the range with new weight
5. Repeat

Example: Squat 3×6-8
• Start: 185×6, 6, 6
• Progress: 185×7, 7, 7 → 185×8, 8, 8
• Add weight: 195×6, 6, 6
• Repeat`
  },
  compliance: {
    title: 'What Counts as Compliant',
    body: `You need 12 out of 14 days hitting targets. NOT 14/14.

Calories: Within ±100 kcal of phase target
Protein: ≥180g for the day
Steps: Weekly average within ±10% of target
Caffeine: Last cup by 12:00 noon

Two "off" days per 2 weeks is built in. Don't let perfect kill good.`
  },
  deload: {
    title: 'What Is a Deload?',
    body: `Same exercises, same weights, but:
• Cut sets in half (3-4 sets → 2 sets)
• Stop very far from failure (RPE 5-6)
• No HIIT
• Keep walking
• Eat at maintenance or slightly above
• Sleep more if possible

Deloads are SCHEDULED at Week 5 and Week 10.

EMERGENCY deload: Trigger if ≥4 Yellow/Red days in any 7-day stretch.`
  },
  dietbreak: {
    title: 'What Is a Diet Break?',
    body: `Weeks 7-8: Calories go UP to 2,450.

This is intentional. Diet breaks:
• Reset metabolic adaptation
• Restore training performance
• Give you a mental break
• Improve long-term adherence

You are NOT falling off the wagon. This IS the plan. Keep protein at 180g+, keep training, keep walking. Just eat more.`
  },
  caffeine: {
    title: 'Caffeine Rules',
    body: `DEFAULT: Last caffeine by 12:00 PM noon.

You're a fast caffeine metabolizer (23andMe), which means you process it quickly — but that doesn't mean it can't affect sleep. Half-life is still 4-6 hours.

Exception allowed once per week max:
• ≤50mg only (half a normal cup)
• Before 2:30 PM
• Only if safety-critical (driving, etc.)

12 of 14 days compliant is the goal.`
  },
  plateau: {
    title: 'When the Scale Stalls',
    body: `Follow this sequence — do NOT skip steps:

Step 0: Rule out noise (salt, sleep, constipation, travel, new exercise, menstrual cycle)

Step 1: Check compliance for 7 days — are you actually hitting targets?

Step 2: Pick ONE lever:
• Option A: Cut 150 kcal/day
• Option B: Add 1,500 steps/day

⚠️ NEVER BOTH AT ONCE. Cutting calories AND adding cardio accelerates muscle loss.

Hard floor: 1,900 kcal (exceptions only in final weeks with perfect recovery).`
  },
};

// ─── ONBOARDING ─────────────────────────────────────────────────────────────────

const ONBOARDING_SCREENS = [
  {
    icon: '⚡',
    title: 'The Sustainable Cut',
    subtitle: '16 weeks to 165-170 lbs at 12-14% body fat',
    body: 'A protocol designed for sleep-deprived parents. Your recovery dictates your intensity — not a calendar. The system adapts to how you actually feel each day.',
  },
  {
    icon: '🚦',
    title: 'The Traffic Light System',
    subtitle: 'Every morning: 4 questions → 1 color → your plan',
    body: 'GREEN = full workout. YELLOW = reduced volume. RED-A = minimum dose (keep the habit). RED-B = rest day. Your Oura ring data + how you feel determines everything.',
  },
  {
    icon: '🎯',
    title: 'Simple Targets',
    subtitle: 'One calorie number. One protein number. Steps.',
    body: '180g+ protein daily (non-negotiable). Phase-specific calories. Gradually increasing step targets. 12 of 14 days compliant = success. Two off days are built in.',
  },
  {
    icon: '🔧',
    title: 'What You Need',
    subtitle: 'Equipment & tracking',
    body: 'Oura ring (or similar sleep tracker). A way to estimate calories (app or pen & paper). Access to a gym OR home dumbbells + bench + pull-up bar. That\'s it.',
  },
];

// ─── MAIN APP ───────────────────────────────────────────────────────────────────

export default function SustainableCutApp() {
  const [view, setView] = useState('dashboard');
  const [settings, setSettings] = useState({
    startDate: null,
    gym: 'work',
    trainingDays: [1, 3, 5],
    onboardingDone: false,
  });
  const [logs, setLogs] = useState({});
  const [weeklyLogs, setWeeklyLogs] = useState({});
  const [loading, setLoading] = useState(true);
  const [infoModal, setInfoModal] = useState(null);
  const [onboardingStep, setOnboardingStep] = useState(0);

  // Today's state
  const [statusAnswers, setStatusAnswers] = useState({ sleep: null, readiness: null, sick: null, secondBadNight: null });
  const [eveningLog, setEveningLog] = useState({
    lastCaffeine: '', caffeineBeforeNoon: null, steps: '',
    training: '', bedtime: '', babyWakeups: '', hitProtein: null, hitCalories: null,
  });
  const [weeklyCheckIn, setWeeklyCheckIn] = useState({
    avgWeight: '', waist: '', avgSleep: '', avgReadiness: '',
    squatWeight: '', squatReps: '', deadliftWeight: '', deadliftReps: '',
    benchWeight: '', benchReps: '', rowWeight: '', rowReps: '', notes: '',
  });
  const [hiitAnswers, setHiitAnswers] = useState({ noHiitYet: false, isGreen: false, avgSleepOk: false, fewRedDays: false });
  const [plateauStep, setPlateauStep] = useState(0);
  const [plateauAnswers, setPlateauAnswers] = useState({});

  const today = getDateStr();
  const dayOfWeek = new Date().getDay();
  const todayLog = logs[today];

  // ─── DATA LOADING ───────────────────────────────────────────────────────────

  useEffect(() => { loadAllData(); }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [settingsRes, logsRes, weeklyRes] = await Promise.all([
        window.storage.get('sc_settings').catch(() => null),
        window.storage.get('sc_logs').catch(() => null),
        window.storage.get('sc_weekly').catch(() => null),
      ]);
      if (settingsRes?.value) {
        const s = JSON.parse(settingsRes.value);
        setSettings(s);
        if (!s.onboardingDone) setView('onboarding');
      } else {
        setView('onboarding');
      }
      if (logsRes?.value) {
        const parsed = JSON.parse(logsRes.value);
        setLogs(parsed);
        if (parsed[today]?.statusAnswers) setStatusAnswers(parsed[today].statusAnswers);
        if (parsed[today]?.eveningLog) setEveningLog(parsed[today].eveningLog);
      }
      if (weeklyRes?.value) setWeeklyLogs(JSON.parse(weeklyRes.value));
    } catch (e) {
      console.log('Fresh start — no saved data');
      setView('onboarding');
    }
    setLoading(false);
  };

  const saveSettings = async (newSettings) => {
    setSettings(newSettings);
    try { await window.storage.set('sc_settings', JSON.stringify(newSettings)); } catch (e) { console.error('Save failed:', e); }
  };

  const saveLogs = async (newLogs) => {
    setLogs(newLogs);
    try { await window.storage.set('sc_logs', JSON.stringify(newLogs)); } catch (e) { console.error('Save failed:', e); }
  };

  const saveWeeklyLogs = async (newWeekly) => {
    setWeeklyLogs(newWeekly);
    try { await window.storage.set('sc_weekly', JSON.stringify(newWeekly)); } catch (e) { console.error('Save failed:', e); }
  };

  // ─── COMPUTED VALUES ──────────────────────────────────────────────────────────

  const currentWeek = useMemo(() => getWeekNumber(settings.startDate), [settings.startDate]);
  const currentPhase = useMemo(() => getPhaseForWeek(currentWeek), [currentWeek]);
  const status = useMemo(() => computeStatus(statusAnswers), [statusAnswers]);
  const stats7 = useMemo(() => getLast7DaysStats(logs), [logs]);
  const stats14 = useMemo(() => getLast14DaysStats(logs), [logs]);
  const weekQuality = useMemo(() => getWeekQuality(stats7), [stats7]);
  const isSunday = dayOfWeek === 0;
  const isDeloadWeek = currentPhase?.type === 'deload';
  const isDietBreakWeek = currentPhase?.type === 'dietbreak';

  const gymProgram = settings.gym === 'home' ? HOME_GYM : WORK_GYM;
  const trainingDays = settings.trainingDays || [1, 3, 5];
  const workoutSlot = trainingDays.indexOf(dayOfWeek);
  const workoutKeys = ['A', 'B', 'C'];
  const todayWorkoutKey = workoutSlot >= 0 ? workoutKeys[workoutSlot] : null;

  // Auto-compute HIIT gates
  useEffect(() => {
    if (todayLog?.status) {
      const hasHiitThisWeek = Object.entries(logs).some(([date, log]) => {
        const d = new Date(date + 'T12:00:00');
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        return d >= startOfWeek && d < now && log.didHiit;
      });
      setHiitAnswers(prev => ({
        ...prev,
        noHiitYet: !hasHiitThisWeek,
        isGreen: todayLog.status === 'GREEN',
        fewRedDays: stats7.counts['RED-B'] <= 1,
      }));
    }
  }, [todayLog?.status, logs, stats7]);

  // Auto-route to Sunday check-in
  useEffect(() => {
    if (isSunday && settings.onboardingDone && !weeklyLogs[`week_${currentWeek}`] && view === 'dashboard') {
      // Don't auto-navigate but we'll show a prominent banner
    }
  }, [isSunday, settings.onboardingDone, currentWeek, weeklyLogs, view]);

  // ─── EVENT HANDLERS ─────────────────────────────────────────────────────────

  const handleOnboardingComplete = async (startDate, gym, days) => {
    const newSettings = { ...settings, startDate, gym, trainingDays: days, onboardingDone: true };
    await saveSettings(newSettings);
    setView('dashboard');
  };

  const handleStatusSubmit = async () => {
    const s = computeStatus(statusAnswers);
    const newLog = { ...todayLog, date: today, status: s, statusAnswers, completedAt: new Date().toISOString() };
    const newLogs = { ...logs, [today]: newLog };
    await saveLogs(newLogs);
    setView('workout');
  };

  const handleEveningSubmit = async () => {
    const newLog = { ...todayLog, eveningLog, eveningCompletedAt: new Date().toISOString() };
    const newLogs = { ...logs, [today]: newLog };
    await saveLogs(newLogs);
    setView('dashboard');
  };

  const handleWeeklySubmit = async () => {
    const key = `week_${currentWeek}`;
    const newWeekly = { ...weeklyLogs, [key]: { ...weeklyCheckIn, weekNumber: currentWeek, date: today, weekQuality } };
    await saveWeeklyLogs(newWeekly);
    setView('dashboard');
  };

  const handleExportData = () => {
    const data = { settings, logs, weeklyLogs, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sustainable-cut-export-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const rows = [['Date', 'Status', 'Steps', 'Caffeine Before Noon', 'Hit Protein', 'Hit Calories', 'Baby Wakeups', 'Bedtime']];
    Object.entries(logs).sort((a, b) => a[0].localeCompare(b[0])).forEach(([date, log]) => {
      rows.push([
        date, log.status || '', log.eveningLog?.steps || '', log.eveningLog?.caffeineBeforeNoon ?? '',
        log.eveningLog?.hitProtein ?? '', log.eveningLog?.hitCalories ?? '',
        log.eveningLog?.babyWakeups || '', log.eveningLog?.bedtime || '',
      ]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sustainable-cut-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── CHART DATA ─────────────────────────────────────────────────────────────

  const weightChartData = useMemo(() => {
    return Object.entries(weeklyLogs)
      .filter(([, v]) => v.avgWeight)
      .sort((a, b) => (a[1].weekNumber || 0) - (b[1].weekNumber || 0))
      .map(([, v]) => ({ week: `W${v.weekNumber}`, weight: parseFloat(v.avgWeight), waist: parseFloat(v.waist) || null }));
  }, [weeklyLogs]);

  const liftChartData = useMemo(() => {
    return Object.entries(weeklyLogs)
      .filter(([, v]) => v.squatWeight)
      .sort((a, b) => (a[1].weekNumber || 0) - (b[1].weekNumber || 0))
      .map(([, v]) => ({
        week: `W${v.weekNumber}`,
        squat: parseFloat(v.squatWeight) || 0,
        deadlift: parseFloat(v.deadliftWeight) || 0,
        bench: parseFloat(v.benchWeight) || 0,
      }));
  }, [weeklyLogs]);

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={S.container}>
        <div style={S.center}><div style={S.spinner} /><p style={{ color: '#6b7280', marginTop: '1rem' }}>Loading...</p></div>
      </div>
    );
  }

  return (
    <div style={S.container}>
      {/* Info Modal */}
      {infoModal && (
        <div style={S.modalOverlay} onClick={() => setInfoModal(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h3 style={S.modalTitle}>{INFO_CONTENT[infoModal]?.title}</h3>
              <button style={S.modalClose} onClick={() => setInfoModal(null)}>✕</button>
            </div>
            <pre style={S.modalBody}>{INFO_CONTENT[infoModal]?.body}</pre>
          </div>
        </div>
      )}

      {/* ─── ONBOARDING ─── */}
      {view === 'onboarding' && (
        <OnboardingFlow
          step={onboardingStep}
          setStep={setOnboardingStep}
          onComplete={handleOnboardingComplete}
          existingSettings={settings}
        />
      )}

      {/* ─── MAIN APP ─── */}
      {view !== 'onboarding' && (
        <>
          {/* Header */}
          <header style={S.header}>
            <div style={S.headerRow}>
              <h1 style={S.logo}>SC</h1>
              <div style={S.headerBadges}>
                <span style={S.weekBadge}>WK {currentWeek || '--'}</span>
                {isDeloadWeek && <span style={{ ...S.typeBadge, backgroundColor: '#5b21b6', color: '#c4b5fd' }}>DELOAD</span>}
                {isDietBreakWeek && <span style={{ ...S.typeBadge, backgroundColor: '#1e40af', color: '#93c5fd' }}>DIET BREAK</span>}
                {currentPhase?.notes === 'Final push' && <span style={{ ...S.typeBadge, backgroundColor: '#7f1d1d', color: '#fca5a5' }}>FINAL</span>}
              </div>
            </div>
            <nav style={S.nav}>
              {[
                { id: 'dashboard', label: 'Home' },
                { id: 'checkin', label: 'Check In' },
                { id: 'workout', label: 'Workout' },
                { id: 'evening', label: 'Log' },
                { id: 'history', label: 'Trends' },
                { id: 'settings', label: '⚙' },
              ].map(n => (
                <button key={n.id} onClick={() => setView(n.id)} style={{ ...S.navBtn, ...(view === n.id ? S.navActive : {}) }}>
                  {n.label}
                </button>
              ))}
            </nav>
          </header>

          <main style={S.main}>

            {/* ─── DELOAD / DIET BREAK BANNER ─── */}
            {(isDeloadWeek || isDietBreakWeek) && view !== 'settings' && (
              <div style={{
                ...S.specialBanner,
                backgroundColor: isDeloadWeek ? '#2e1065' : '#172554',
                borderColor: isDeloadWeek ? '#7c3aed' : '#3b82f6',
              }}>
                <strong style={{ fontSize: '0.875rem' }}>{isDeloadWeek ? '📉 DELOAD WEEK' : '🔄 DIET BREAK WEEK'}</strong>
                <p style={{ margin: '0.375rem 0 0', fontSize: '0.8rem', opacity: 0.8, lineHeight: 1.4 }}>
                  {isDeloadWeek
                    ? 'Same exercises, same weights. Cut sets in half. RPE 5-6. No HIIT. Keep walking. Rest more.'
                    : `Calories UP to ${currentPhase.calories} kcal. This is the plan — not a slip. Keep protein at 180g+, keep training.`}
                </p>
                <button style={S.infoLink} onClick={() => setInfoModal(isDeloadWeek ? 'deload' : 'dietbreak')}>
                  Learn why →
                </button>
              </div>
            )}

            {/* ─── SUNDAY BANNER ─── */}
            {isSunday && !weeklyLogs[`week_${currentWeek}`] && view === 'dashboard' && (
              <button style={S.sundayBanner} onClick={() => setView('weekly')}>
                📊 It's Sunday — time for your weekly check-in →
              </button>
            )}

            {/* ─── DASHBOARD ─── */}
            {view === 'dashboard' && (
              <div style={S.stack}>
                {/* Today's Status */}
                <div style={S.card}>
                  <div style={S.cardHeader}>
                    <h2 style={S.cardTitle}>TODAY</h2>
                    <span style={S.dateLabel}>{formatDate(today)}</span>
                  </div>
                  {todayLog?.status ? (
                    <div style={{ ...S.statusBox, backgroundColor: STATUS_CONFIG[todayLog.status].bg, borderColor: STATUS_CONFIG[todayLog.status].border }}>
                      <span style={{ color: STATUS_CONFIG[todayLog.status].text, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                        {todayLog.status}
                      </span>
                      <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.375rem' }}>
                        {STATUS_CONFIG[todayLog.status].label}
                      </p>
                    </div>
                  ) : (
                    <button style={S.ctaBtn} onClick={() => setView('checkin')}>Complete Morning Check-In →</button>
                  )}
                </div>

                {/* Targets */}
                {currentPhase && (
                  <div style={S.card}>
                    <div style={S.cardHeader}>
                      <h2 style={S.cardTitle}>TARGETS</h2>
                      <button style={S.infoLink} onClick={() => setInfoModal('compliance')}>What counts? ⓘ</button>
                    </div>
                    <div style={S.grid2}>
                      <div style={S.metricBox}>
                        <span style={S.metricVal}>{currentPhase.calories}</span>
                        <span style={S.metricLabel}>kcal/day</span>
                      </div>
                      <div style={S.metricBox}>
                        <span style={S.metricVal}>{currentPhase.steps.toLocaleString()}</span>
                        <span style={S.metricLabel}>steps/day</span>
                      </div>
                      <div style={S.metricBox} onClick={() => setInfoModal('protein')} role="button" tabIndex={0}>
                        <span style={S.metricVal}>180g+</span>
                        <span style={S.metricLabel}>protein ⓘ</span>
                      </div>
                      <div style={S.metricBox}>
                        <span style={S.metricVal}>65g</span>
                        <span style={S.metricLabel}>fats</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 7-Day Overview */}
                <div style={S.card}>
                  <div style={S.cardHeader}>
                    <h2 style={S.cardTitle}>LAST 7 DAYS</h2>
                    <span style={{ ...S.qualityBadge, backgroundColor: weekQuality === 'PUSH' ? '#065f46' : weekQuality === 'HOLD' ? '#78350f' : '#7f1d1d' }}>
                      → {weekQuality}
                    </span>
                  </div>
                  <div style={S.statusRow}>
                    {Object.entries(stats7.counts).map(([s, c]) => (
                      <div key={s} style={S.statusStat}>
                        <div style={{ ...S.dot, backgroundColor: STATUS_CONFIG[s].text }} />
                        <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{s}</span>
                        <span style={{ color: '#fff', fontWeight: 700 }}>{c}</span>
                      </div>
                    ))}
                  </div>
                  {stats7.counts.YELLOW + stats7.counts['RED-A'] + stats7.counts['RED-B'] >= 4 && (
                    <div style={S.alertBox}>
                      ⚠️ 4+ Yellow/Red days — consider an emergency deload
                      <button style={S.infoLink} onClick={() => setInfoModal('deload')}>What's a deload? →</button>
                    </div>
                  )}
                </div>

                {/* Auto-Compliance */}
                {stats14.totalWithEvening >= 7 && (
                  <div style={S.card}>
                    <h2 style={S.cardTitle}>14-DAY COMPLIANCE (auto-tracked)</h2>
                    <div style={S.complianceGrid}>
                      <ComplianceBar label="Protein" hit={stats14.proteinDays} total={stats14.totalWithEvening} />
                      <ComplianceBar label="Calories" hit={stats14.calorieDays} total={stats14.totalWithEvening} />
                      <ComplianceBar label="Caffeine" hit={stats14.caffeineDays} total={stats14.totalWithEvening} />
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div style={S.grid2}>
                  {!todayLog?.eveningLog && (
                    <button style={S.actionCard} onClick={() => setView('evening')}>📝 Evening Log</button>
                  )}
                  <button style={S.actionCard} onClick={() => setView('workout')}>💪 Workout</button>
                  <button style={S.actionCard} onClick={() => setView('plateau')}>📉 Scale Stalled?</button>
                  <button style={S.actionCard} onClick={() => setView('history')}>📈 Trends</button>
                </div>
              </div>
            )}

            {/* ─── CHECK-IN ─── */}
            {view === 'checkin' && (
              <div style={S.stack}>
                <h2 style={S.pageTitle}>Morning Check-In</h2>
                <p style={S.pageSubtitle}>Open Oura, answer 4 questions</p>
                {[
                  { key: 'sleep', q: 'Did you sleep ≥6 hours 45 min?', yesIsGood: true },
                  { key: 'readiness', q: 'Is your Readiness score ≥75?', yesIsGood: true },
                  { key: 'sick', q: 'Do you feel sick or run down?', yesIsGood: false },
                  { key: 'secondBadNight', q: 'Was last night your 2nd+ bad night in a row?', yesIsGood: false },
                ].map((item, i) => (
                  <div key={item.key} style={S.questionBox}>
                    <p style={S.questionText}>{i + 1}. {item.q}</p>
                    <div style={S.row}>
                      <button
                        style={{
                          ...S.ynBtn,
                          ...(statusAnswers[item.key] === item.yesIsGood ? S.ynGreen : {}),
                          ...(statusAnswers[item.key] === !item.yesIsGood ? {} : {}),
                          ...(!item.yesIsGood && statusAnswers[item.key] === false ? S.ynGreen : {}),
                          ...(item.yesIsGood && statusAnswers[item.key] === true ? S.ynGreen : {}),
                        }}
                        onClick={() => setStatusAnswers({ ...statusAnswers, [item.key]: item.yesIsGood ? true : false })}
                      >
                        {item.yesIsGood ? 'Yes' : 'No'}
                      </button>
                      <button
                        style={{
                          ...S.ynBtn,
                          ...(!item.yesIsGood && statusAnswers[item.key] === true ? S.ynRed : {}),
                          ...(item.yesIsGood && statusAnswers[item.key] === false ? S.ynRed : {}),
                        }}
                        onClick={() => setStatusAnswers({ ...statusAnswers, [item.key]: item.yesIsGood ? false : true })}
                      >
                        {item.yesIsGood ? 'No' : 'Yes'}
                      </button>
                    </div>
                  </div>
                ))}
                {status && (
                  <div style={{ ...S.statusPreview, backgroundColor: STATUS_CONFIG[status].bg, borderColor: STATUS_CONFIG[status].border }}>
                    <span style={{ color: STATUS_CONFIG[status].text, fontSize: '1.5rem', fontWeight: 800 }}>{status}</span>
                    <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.375rem' }}>{STATUS_CONFIG[status].label}</p>
                  </div>
                )}
                <button
                  style={{ ...S.ctaBtn, opacity: status ? 1 : 0.4 }}
                  disabled={!status}
                  onClick={handleStatusSubmit}
                >
                  Save & View Workout →
                </button>
              </div>
            )}

            {/* ─── WORKOUT ─── */}
            {view === 'workout' && (
              <div style={S.stack}>
                {todayLog?.status ? (
                  <>
                    <div style={{ ...S.statusBar, backgroundColor: STATUS_CONFIG[todayLog.status].bg, borderColor: STATUS_CONFIG[todayLog.status].border }}>
                      <span style={{ color: STATUS_CONFIG[todayLog.status].text, fontWeight: 700 }}>{todayLog.status} DAY</span>
                      <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{settings.gym === 'home' ? '🏠 Home Gym' : '🏢 Work Gym'}</span>
                    </div>

                    {todayLog.status === 'RED-B' ? (
                      <div style={S.card}>
                        <h2 style={S.cardTitle}>REST DAY</h2>
                        <p style={S.muted}>No lifting today. Light walk if you want. Focus on sleep and recovery.</p>
                        <p style={{ color: '#e5e5e5', fontWeight: 600, marginTop: '1rem' }}>This IS the workout.</p>
                      </div>
                    ) : todayLog.status === 'RED-A' ? (
                      <div style={S.card}>
                        <div style={S.cardHeader}>
                          <h2 style={S.cardTitle}>MINIMUM DOSE</h2>
                          <button style={S.infoLink} onClick={() => setInfoModal('rpe')}>RPE? ⓘ</button>
                        </div>
                        <p style={S.muted}>1 squat/hinge + 1 press + 1 pull. 2 easy sets each. RPE 6-7. Done in 30 min.</p>
                        <ExerciseList exercises={gymProgram.minDose.exercises} status="RED-A" isDeload={isDeloadWeek} />
                      </div>
                    ) : todayWorkoutKey ? (
                      <div style={S.card}>
                        <div style={S.cardHeader}>
                          <h2 style={S.cardTitle}>{gymProgram[todayWorkoutKey].title}</h2>
                          <button style={S.infoLink} onClick={() => setInfoModal('rpe')}>RPE? ⓘ</button>
                        </div>
                        <p style={S.muted}>
                          {todayLog.status === 'GREEN' && !isDeloadWeek && 'Push hard (RPE 8-9). Stop 1-2 reps before failure.'}
                          {todayLog.status === 'GREEN' && isDeloadWeek && 'DELOAD: Same weights, cut sets in half. RPE 5-6. Stay far from failure.'}
                          {todayLog.status === 'YELLOW' && 'Cut 1-2 sets per exercise. RPE 7-8. Stop 2-3 reps before failure.'}
                        </p>
                        <ExerciseList exercises={gymProgram[todayWorkoutKey].exercises} status={todayLog.status} isDeload={isDeloadWeek} />
                        <div style={{ marginTop: '1rem' }}>
                          <button style={S.infoLink} onClick={() => setInfoModal('progression')}>How do I progress weight? →</button>
                        </div>
                      </div>
                    ) : (
                      <div style={S.card}>
                        <h2 style={S.cardTitle}>REST DAY / CARDIO</h2>
                        <p style={S.muted}>No scheduled lifting today. Focus on hitting your step target: <strong style={{ color: '#fff' }}>{currentPhase?.steps.toLocaleString()} steps</strong></p>
                        <button style={S.infoLink} onClick={() => setInfoModal('liss')}>What counts as LISS? →</button>
                      </div>
                    )}

                    {/* HIIT Gate */}
                    {todayLog.status === 'GREEN' && !isDeloadWeek && (
                      <div style={S.card}>
                        <div style={S.cardHeader}>
                          <h2 style={S.cardTitle}>HIIT CHECK</h2>
                          <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Default = LISS</span>
                        </div>
                        <p style={S.muted}>HIIT is rare and earned. ALL 4 must be checked:</p>
                        <div style={S.stack05}>
                          {[
                            { key: 'noHiitYet', label: 'No HIIT yet this week', auto: true },
                            { key: 'isGreen', label: 'Today I am GREEN', auto: true },
                            { key: 'avgSleepOk', label: 'Weekly avg sleep ≥6:30', auto: false },
                            { key: 'fewRedDays', label: '≤1 Red-B day last 7 days', auto: true },
                          ].map(g => (
                            <label key={g.key} style={S.checkRow}>
                              <input
                                type="checkbox"
                                checked={hiitAnswers[g.key]}
                                onChange={e => setHiitAnswers({ ...hiitAnswers, [g.key]: e.target.checked })}
                                style={S.check}
                              />
                              <span style={{ color: '#e5e5e5', fontSize: '0.875rem' }}>{g.label}</span>
                              {g.auto && <span style={S.autoBadge}>auto</span>}
                            </label>
                          ))}
                        </div>
                        <div style={{
                          ...S.hiitResult,
                          backgroundColor: Object.values(hiitAnswers).every(v => v) ? '#065f46' : '#292524',
                          borderColor: Object.values(hiitAnswers).every(v => v) ? '#10b981' : '#57534e',
                        }}>
                          {Object.values(hiitAnswers).every(v => v)
                            ? '✓ HIIT approved — 20-25 min, RPE 8-9'
                            : '✗ Do 25-35 min easy walk instead'}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={S.card}>
                    <p style={S.muted}>Complete your morning check-in to see today's workout.</p>
                    <button style={S.ctaBtn} onClick={() => setView('checkin')}>Go to Check-In →</button>
                  </div>
                )}
              </div>
            )}

            {/* ─── EVENING LOG ─── */}
            {view === 'evening' && (
              <div style={S.stack}>
                <h2 style={S.pageTitle}>Evening Log</h2>
                <p style={S.pageSubtitle}>60 seconds before bed</p>

                <div style={S.card}>
                  <label style={S.label}>Last caffeine time</label>
                  <input type="time" value={eveningLog.lastCaffeine} onChange={e => setEveningLog({ ...eveningLog, lastCaffeine: e.target.value })} style={S.input} />
                  <div style={{ ...S.row, marginTop: '0.5rem' }}>
                    <button style={{ ...S.pillBtn, ...(eveningLog.caffeineBeforeNoon === true ? S.pillGreen : {}) }} onClick={() => setEveningLog({ ...eveningLog, caffeineBeforeNoon: true })}>
                      Before noon ✓
                    </button>
                    <button style={{ ...S.pillBtn, ...(eveningLog.caffeineBeforeNoon === false ? S.pillWarn : {}) }} onClick={() => setEveningLog({ ...eveningLog, caffeineBeforeNoon: false })}>
                      After noon ✗
                    </button>
                  </div>
                  {eveningLog.caffeineBeforeNoon === false && (
                    <div style={S.inlineWarn}>
                      ☕ Late caffeine hurts sleep quality — even for fast metabolizers.
                      <button style={S.infoLink} onClick={() => setInfoModal('caffeine')}>Rules →</button>
                    </div>
                  )}
                </div>

                <div style={S.card}>
                  <label style={S.label}>Steps today</label>
                  <div style={S.row}>
                    <input type="number" value={eveningLog.steps} onChange={e => setEveningLog({ ...eveningLog, steps: e.target.value })} placeholder="8500" style={{ ...S.input, flex: 1 }} />
                    <span style={{ color: '#6b7280', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>/ {currentPhase?.steps.toLocaleString()}</span>
                  </div>
                </div>

                <div style={S.card}>
                  <label style={S.label}>Did you hit protein (≥180g)?</label>
                  <div style={S.row}>
                    <button style={{ ...S.pillBtn, ...(eveningLog.hitProtein === true ? S.pillGreen : {}) }} onClick={() => setEveningLog({ ...eveningLog, hitProtein: true })}>Yes</button>
                    <button style={{ ...S.pillBtn, ...(eveningLog.hitProtein === false ? S.pillWarn : {}) }} onClick={() => setEveningLog({ ...eveningLog, hitProtein: false })}>No</button>
                  </div>
                  <button style={{ ...S.infoLink, marginTop: '0.5rem' }} onClick={() => setInfoModal('protein')}>Protein cheat sheet →</button>
                </div>

                <div style={S.card}>
                  <label style={S.label}>Did you hit calories (±100 of {currentPhase?.calories})?</label>
                  <div style={S.row}>
                    <button style={{ ...S.pillBtn, ...(eveningLog.hitCalories === true ? S.pillGreen : {}) }} onClick={() => setEveningLog({ ...eveningLog, hitCalories: true })}>Yes</button>
                    <button style={{ ...S.pillBtn, ...(eveningLog.hitCalories === false ? S.pillWarn : {}) }} onClick={() => setEveningLog({ ...eveningLog, hitCalories: false })}>No</button>
                  </div>
                </div>

                <div style={S.card}>
                  <label style={S.label}>Bedtime</label>
                  <input type="time" value={eveningLog.bedtime} onChange={e => setEveningLog({ ...eveningLog, bedtime: e.target.value })} style={S.input} />
                </div>

                <div style={S.card}>
                  <label style={S.label}>Baby wakeups</label>
                  <input type="number" value={eveningLog.babyWakeups} onChange={e => setEveningLog({ ...eveningLog, babyWakeups: e.target.value })} placeholder="2" style={S.input} min="0" max="10" />
                </div>

                <button style={S.ctaBtn} onClick={handleEveningSubmit}>Save Evening Log ✓</button>
              </div>
            )}

            {/* ─── WEEKLY CHECK-IN ─── */}
            {view === 'weekly' && (
              <div style={S.stack}>
                <h2 style={S.pageTitle}>Sunday Check-In</h2>
                <p style={S.pageSubtitle}>Week {currentWeek} Review • ~10 minutes</p>

                <div style={S.card}>
                  <h3 style={S.cardTitle}>MEASUREMENTS</h3>
                  <div style={S.grid2}>
                    <div style={S.inputGroup}><label style={S.label}>7-Day Avg Weight</label><input type="number" value={weeklyCheckIn.avgWeight} onChange={e => setWeeklyCheckIn({ ...weeklyCheckIn, avgWeight: e.target.value })} style={S.input} step="0.1" placeholder="lbs" /></div>
                    <div style={S.inputGroup}><label style={S.label}>Waist at Navel</label><input type="number" value={weeklyCheckIn.waist} onChange={e => setWeeklyCheckIn({ ...weeklyCheckIn, waist: e.target.value })} style={S.input} step="0.25" placeholder="inches" /></div>
                    <div style={S.inputGroup}><label style={S.label}>Avg Sleep (hrs)</label><input type="number" value={weeklyCheckIn.avgSleep} onChange={e => setWeeklyCheckIn({ ...weeklyCheckIn, avgSleep: e.target.value })} style={S.input} step="0.25" /></div>
                    <div style={S.inputGroup}><label style={S.label}>Avg Readiness</label><input type="number" value={weeklyCheckIn.avgReadiness} onChange={e => setWeeklyCheckIn({ ...weeklyCheckIn, avgReadiness: e.target.value })} style={S.input} /></div>
                  </div>
                </div>

                <div style={S.card}>
                  <h3 style={S.cardTitle}>LIFT PERFORMANCE</h3>
                  {[
                    { name: 'Squat', wKey: 'squatWeight', rKey: 'squatReps' },
                    { name: 'Deadlift / Hinge', wKey: 'deadliftWeight', rKey: 'deadliftReps' },
                    { name: 'Bench / Press', wKey: 'benchWeight', rKey: 'benchReps' },
                    { name: 'Row / Pull', wKey: 'rowWeight', rKey: 'rowReps' },
                  ].map(lift => (
                    <div key={lift.name} style={S.liftRow}>
                      <span style={{ flex: 1, color: '#d4d4d4', fontSize: '0.875rem' }}>{lift.name}</span>
                      <input type="number" placeholder="lbs" value={weeklyCheckIn[lift.wKey]} onChange={e => setWeeklyCheckIn({ ...weeklyCheckIn, [lift.wKey]: e.target.value })} style={S.liftInput} />
                      <span style={{ color: '#525252' }}>×</span>
                      <input type="number" placeholder="reps" value={weeklyCheckIn[lift.rKey]} onChange={e => setWeeklyCheckIn({ ...weeklyCheckIn, [lift.rKey]: e.target.value })} style={S.liftInput} />
                    </div>
                  ))}
                </div>

                <div style={S.card}>
                  <div style={S.cardHeader}>
                    <h3 style={S.cardTitle}>WEEK QUALITY (auto-computed)</h3>
                  </div>
                  <div style={S.statusRow}>
                    {Object.entries(stats7.counts).map(([s, c]) => (
                      <div key={s} style={S.statusStat}>
                        <div style={{ ...S.dot, backgroundColor: STATUS_CONFIG[s].text }} />
                        <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>{s}</span>
                        <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.875rem' }}>{c}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ ...S.qualityBox, backgroundColor: weekQuality === 'PUSH' ? '#065f46' : weekQuality === 'HOLD' ? '#78350f' : '#7f1d1d' }}>
                    Next week → <strong>{weekQuality}</strong>
                    {weekQuality === 'PUSH' && ' — try to add reps or weight'}
                    {weekQuality === 'HOLD' && ' — same weights, no progression attempts'}
                    {weekQuality === 'DELOAD' && ' — take an emergency deload'}
                  </div>
                </div>

                <div style={S.card}>
                  <label style={S.label}>Notes (optional)</label>
                  <textarea value={weeklyCheckIn.notes} onChange={e => setWeeklyCheckIn({ ...weeklyCheckIn, notes: e.target.value })} style={{ ...S.input, minHeight: '80px', resize: 'vertical' }} placeholder="How did this week feel?" />
                </div>

                <button style={S.ctaBtn} onClick={handleWeeklySubmit}>Save Weekly Check-In ✓</button>
              </div>
            )}

            {/* ─── PLATEAU WIZARD ─── */}
            {view === 'plateau' && (
              <PlateauWizard
                step={plateauStep}
                setStep={setPlateauStep}
                answers={plateauAnswers}
                setAnswers={setPlateauAnswers}
                currentPhase={currentPhase}
                onDone={() => { setPlateauStep(0); setPlateauAnswers({}); setView('dashboard'); }}
                openInfo={setInfoModal}
              />
            )}

            {/* ─── TRENDS / HISTORY ─── */}
            {view === 'history' && (
              <div style={S.stack}>
                <h2 style={S.pageTitle}>Trends & History</h2>

                {/* Weight Chart */}
                {weightChartData.length >= 2 && (
                  <div style={S.card}>
                    <h3 style={S.cardTitle}>WEIGHT TREND</h3>
                    <div style={{ width: '100%', height: 200 }}>
                      <ResponsiveContainer>
                        <AreaChart data={weightChartData}>
                          <defs>
                            <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="week" stroke="#525252" fontSize={12} />
                          <YAxis domain={['auto', 'auto']} stroke="#525252" fontSize={12} />
                          <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#e5e5e5' }} />
                          <Area type="monotone" dataKey="weight" stroke="#10b981" fill="url(#wg)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Waist Chart */}
                {weightChartData.filter(d => d.waist).length >= 2 && (
                  <div style={S.card}>
                    <h3 style={S.cardTitle}>WAIST TREND</h3>
                    <div style={{ width: '100%', height: 200 }}>
                      <ResponsiveContainer>
                        <AreaChart data={weightChartData.filter(d => d.waist)}>
                          <defs>
                            <linearGradient id="wsg" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="week" stroke="#525252" fontSize={12} />
                          <YAxis domain={['auto', 'auto']} stroke="#525252" fontSize={12} />
                          <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#e5e5e5' }} />
                          <Area type="monotone" dataKey="waist" stroke="#fbbf24" fill="url(#wsg)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Lift Chart */}
                {liftChartData.length >= 2 && (
                  <div style={S.card}>
                    <h3 style={S.cardTitle}>LIFT PERFORMANCE</h3>
                    <div style={{ width: '100%', height: 220 }}>
                      <ResponsiveContainer>
                        <LineChart data={liftChartData}>
                          <XAxis dataKey="week" stroke="#525252" fontSize={12} />
                          <YAxis stroke="#525252" fontSize={12} />
                          <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#e5e5e5' }} />
                          <Line type="monotone" dataKey="squat" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Squat" />
                          <Line type="monotone" dataKey="deadlift" stroke="#f87171" strokeWidth={2} dot={{ r: 3 }} name="Deadlift" />
                          <Line type="monotone" dataKey="bench" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} name="Bench" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                      <span style={{ color: '#10b981', fontSize: '0.75rem' }}>● Squat</span>
                      <span style={{ color: '#f87171', fontSize: '0.75rem' }}>● Deadlift</span>
                      <span style={{ color: '#60a5fa', fontSize: '0.75rem' }}>● Bench</span>
                    </div>
                  </div>
                )}

                {weightChartData.length < 2 && liftChartData.length < 2 && (
                  <div style={S.card}>
                    <p style={S.muted}>Charts will appear after 2+ weekly check-ins. Complete your Sunday check-in to start tracking trends.</p>
                  </div>
                )}

                {/* Milestones */}
                <div style={S.card}>
                  <h3 style={S.cardTitle}>EXPECTED MILESTONES</h3>
                  {MILESTONES.map((m, i) => (
                    <div key={i} style={{ ...S.milestoneRow, opacity: currentWeek > m.week ? 0.5 : 1, borderLeft: currentWeek >= m.week && currentWeek < (MILESTONES[i + 1]?.week || 17) ? '3px solid #10b981' : '3px solid #333' }}>
                      <span style={{ fontWeight: 700, color: '#fff', minWidth: '40px' }}>W{m.week || '0'}</span>
                      <span style={{ color: '#d4d4d4', flex: 1 }}>{m.weight} • {m.bf}</span>
                      <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>{m.notice}</span>
                    </div>
                  ))}
                </div>

                {/* Phase Progress */}
                <div style={S.card}>
                  <h3 style={S.cardTitle}>PHASE PROGRESS</h3>
                  {PHASES.map((p, i) => {
                    const isCurrent = currentPhase?.phase === p.phase;
                    const isPast = p.weeks[p.weeks.length - 1] < currentWeek;
                    return (
                      <div key={i} style={{ ...S.phaseRow, opacity: isPast ? 0.4 : 1, borderLeft: isCurrent ? '3px solid #10b981' : '3px solid transparent' }}>
                        <span style={{ fontWeight: 700, color: '#fff', minWidth: '55px', fontSize: '0.8rem' }}>
                          W{p.weeks[0]}{p.weeks.length > 1 ? `-${p.weeks[p.weeks.length - 1]}` : ''}
                        </span>
                        <span style={{ color: '#9ca3af', fontSize: '0.8rem', flex: 1 }}>{p.calories} kcal • {p.steps.toLocaleString()} steps</span>
                        {p.notes && <span style={S.phaseTag}>{p.notes}</span>}
                      </div>
                    );
                  })}
                </div>

                {/* Recent Logs */}
                <div style={S.card}>
                  <h3 style={S.cardTitle}>DAILY LOG HISTORY</h3>
                  {Object.entries(logs).length === 0 && <p style={S.muted}>No logs yet.</p>}
                  {Object.entries(logs).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 21).map(([date, log]) => (
                    <div key={date} style={S.logRow}>
                      <span style={{ color: '#d4d4d4', fontSize: '0.8rem', minWidth: '90px' }}>{formatDate(date)}</span>
                      {log.status && <span style={{ ...S.logBadge, backgroundColor: STATUS_CONFIG[log.status]?.bg, color: STATUS_CONFIG[log.status]?.text }}>{log.status}</span>}
                      {log.eveningLog?.steps && <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>{parseInt(log.eveningLog.steps).toLocaleString()} stp</span>}
                      {log.eveningLog?.hitProtein === true && <span style={{ color: '#10b981', fontSize: '0.7rem' }}>P✓</span>}
                      {log.eveningLog?.hitProtein === false && <span style={{ color: '#f87171', fontSize: '0.7rem' }}>P✗</span>}
                      {log.eveningLog?.caffeineBeforeNoon === false && <span style={{ color: '#fbbf24', fontSize: '0.7rem' }}>☕!</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── SETTINGS ─── */}
            {view === 'settings' && (
              <div style={S.stack}>
                <h2 style={S.pageTitle}>Settings</h2>

                <div style={S.card}>
                  <label style={S.label}>Start Date</label>
                  <input type="date" value={settings.startDate || ''} onChange={e => saveSettings({ ...settings, startDate: e.target.value })} style={S.input} />
                </div>

                <div style={S.card}>
                  <label style={S.label}>Gym Type</label>
                  <div style={S.row}>
                    <button style={{ ...S.pillBtn, ...(settings.gym === 'work' ? S.pillGreen : {}) }} onClick={() => saveSettings({ ...settings, gym: 'work' })}>
                      🏢 Work Gym
                    </button>
                    <button style={{ ...S.pillBtn, ...(settings.gym === 'home' ? S.pillGreen : {}) }} onClick={() => saveSettings({ ...settings, gym: 'home' })}>
                      🏠 Home Gym
                    </button>
                  </div>
                </div>

                <div style={S.card}>
                  <label style={S.label}>Training Days (pick 3)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {DAY_NAMES.map((name, i) => (
                      <button
                        key={i}
                        style={{
                          ...S.dayBtn,
                          ...(settings.trainingDays?.includes(i) ? S.dayBtnActive : {}),
                        }}
                        onClick={() => {
                          const days = settings.trainingDays || [];
                          const newDays = days.includes(i) ? days.filter(d => d !== i) : days.length < 3 ? [...days, i].sort() : days;
                          saveSettings({ ...settings, trainingDays: newDays });
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  <p style={{ color: '#525252', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                    Workouts A, B, C are assigned in order to your selected days.
                  </p>
                </div>

                <div style={S.card}>
                  <label style={S.label}>Export Data</label>
                  <div style={S.row}>
                    <button style={S.exportBtn} onClick={handleExportData}>📦 JSON (full backup)</button>
                    <button style={S.exportBtn} onClick={handleExportCSV}>📊 CSV (daily logs)</button>
                  </div>
                </div>

                <div style={S.card}>
                  <label style={S.label}>Quick Reference</label>
                  <div style={S.stack05}>
                    {Object.entries(INFO_CONTENT).map(([key, val]) => (
                      <button key={key} style={S.refBtn} onClick={() => setInfoModal(key)}>
                        {val.title} →
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </main>
        </>
      )}
    </div>
  );
}

// ─── SUB-COMPONENTS ─────────────────────────────────────────────────────────────

function OnboardingFlow({ step, setStep, onComplete, existingSettings }) {
  const [startDate, setStartDate] = useState(existingSettings?.startDate || '');
  const [gym, setGym] = useState(existingSettings?.gym || 'work');
  const [days, setDays] = useState(existingSettings?.trainingDays || [1, 3, 5]);

  if (step < ONBOARDING_SCREENS.length) {
    const screen = ONBOARDING_SCREENS[step];
    return (
      <div style={S.onboardingContainer}>
        <div style={S.onboardingDots}>
          {ONBOARDING_SCREENS.map((_, i) => (
            <div key={i} style={{ ...S.onboardingDot, backgroundColor: i === step ? '#10b981' : '#333' }} />
          ))}
          <div style={{ ...S.onboardingDot, backgroundColor: step >= ONBOARDING_SCREENS.length ? '#10b981' : '#333' }} />
        </div>
        <div style={S.onboardingCard}>
          <span style={{ fontSize: '3rem' }}>{screen.icon}</span>
          <h2 style={S.onboardingTitle}>{screen.title}</h2>
          <p style={S.onboardingSubtitle}>{screen.subtitle}</p>
          <p style={S.onboardingBody}>{screen.body}</p>
        </div>
        <div style={{ ...S.row, marginTop: '2rem' }}>
          {step > 0 && <button style={S.ghostBtn} onClick={() => setStep(step - 1)}>← Back</button>}
          <button style={{ ...S.ctaBtn, flex: 1 }} onClick={() => setStep(step + 1)}>
            {step === ONBOARDING_SCREENS.length - 1 ? 'Set Up →' : 'Next →'}
          </button>
        </div>
      </div>
    );
  }

  // Setup screen
  return (
    <div style={S.onboardingContainer}>
      <div style={S.onboardingDots}>
        {ONBOARDING_SCREENS.map((_, i) => <div key={i} style={{ ...S.onboardingDot, backgroundColor: '#10b981' }} />)}
        <div style={{ ...S.onboardingDot, backgroundColor: '#10b981' }} />
      </div>
      <div style={S.onboardingCard}>
        <h2 style={S.onboardingTitle}>Let's Set Up</h2>

        <div style={{ ...S.inputGroup, marginTop: '1.5rem', textAlign: 'left', width: '100%' }}>
          <label style={S.label}>Start Date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={S.input} />
        </div>

        <div style={{ ...S.inputGroup, marginTop: '1rem', textAlign: 'left', width: '100%' }}>
          <label style={S.label}>Your Gym</label>
          <div style={S.row}>
            <button style={{ ...S.pillBtn, flex: 1, ...(gym === 'work' ? S.pillGreen : {}) }} onClick={() => setGym('work')}>🏢 Work Gym</button>
            <button style={{ ...S.pillBtn, flex: 1, ...(gym === 'home' ? S.pillGreen : {}) }} onClick={() => setGym('home')}>🏠 Home Gym</button>
          </div>
        </div>

        <div style={{ ...S.inputGroup, marginTop: '1rem', textAlign: 'left', width: '100%' }}>
          <label style={S.label}>Training Days (pick 3)</label>
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {DAY_NAMES.map((name, i) => (
              <button key={i} style={{ ...S.dayBtn, ...(days.includes(i) ? S.dayBtnActive : {}) }}
                onClick={() => {
                  if (days.includes(i)) setDays(days.filter(d => d !== i));
                  else if (days.length < 3) setDays([...days, i].sort());
                }}>
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ ...S.row, marginTop: '1.5rem' }}>
        <button style={S.ghostBtn} onClick={() => setStep(step - 1)}>← Back</button>
        <button style={{ ...S.ctaBtn, flex: 1, opacity: startDate && days.length === 3 ? 1 : 0.4 }}
          disabled={!startDate || days.length !== 3}
          onClick={() => onComplete(startDate, gym, days)}>
          Start Protocol →
        </button>
      </div>
    </div>
  );
}

function ExerciseList({ exercises, status, isDeload }) {
  const getAdjustedSets = (sets) => {
    if (isDeload) {
      const match = sets.match(/(\d+)/);
      if (match) return String(Math.ceil(parseInt(match[1]) / 2));
    }
    if (status === 'YELLOW') {
      if (sets.includes('-')) {
        const [lo] = sets.split('-');
        return lo;
      }
    }
    return sets;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
      {exercises.map((ex, i) => (
        <div key={i} style={S.exerciseRow}>
          {ex.pattern && <span style={S.patternTag}>{ex.pattern}</span>}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ color: ex.primary ? '#fff' : '#d4d4d4', fontWeight: ex.primary ? 600 : 400, fontSize: '0.875rem' }}>{ex.name}</span>
            <span style={S.setsLabel}>{getAdjustedSets(ex.sets)} × {ex.reps}</span>
          </div>
          <span style={{ color: '#525252', fontSize: '0.7rem' }}>RIR {ex.rir}</span>
        </div>
      ))}
    </div>
  );
}

function ComplianceBar({ label, hit, total }) {
  const pct = total > 0 ? Math.round((hit / total) * 100) : 0;
  const target = Math.ceil(total * 0.86);
  const passing = hit >= target;
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <span style={{ color: '#d4d4d4', fontSize: '0.8rem' }}>{label}</span>
        <span style={{ color: passing ? '#10b981' : '#f87171', fontSize: '0.8rem', fontWeight: 600 }}>{hit}/{total}</span>
      </div>
      <div style={{ height: '6px', backgroundColor: '#292524', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: passing ? '#10b981' : '#f87171', borderRadius: '3px', transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

function PlateauWizard({ step, setStep, answers, setAnswers, currentPhase, onDone, openInfo }) {
  const noiseChecks = [
    { key: 'highSodium', label: 'High sodium yesterday? (water weight — wait 2-3 days)' },
    { key: 'poorSleep', label: 'Poor sleep this week? (cortisol ↑ water retention)' },
    { key: 'constipation', label: 'Constipation? (can mask 1-2 lbs of fat loss)' },
    { key: 'travel', label: 'Recent travel or schedule disruption?' },
    { key: 'newExercise', label: 'New exercises or unusual soreness?' },
  ];

  const complianceChecks = [
    { key: 'proteinOk', label: 'Protein ≥180g on 12 of last 14 days?' },
    { key: 'caloriesOk', label: `Calories within ±100 of ${currentPhase?.calories || '---'}?` },
    { key: 'stepsOk', label: 'Steps within ±10% of weekly target?' },
    { key: 'recoveryOk', label: 'Recovery normal? (NOT ≥3 Red-B or avg sleep <6:00)' },
  ];

  return (
    <div style={S.stack}>
      <h2 style={S.pageTitle}>Scale Stalled?</h2>
      <p style={S.pageSubtitle}>Follow these steps in order. Don't skip.</p>

      {step === 0 && (
        <div style={S.card}>
          <h3 style={S.cardTitle}>STEP 0: IS IT ACTUALLY A STALL?</h3>
          <p style={S.muted}>Has your 14-day weight trend not moved? First rule out noise:</p>
          <div style={S.stack05}>
            {noiseChecks.map(c => (
              <label key={c.key} style={S.checkRow}>
                <input type="checkbox" checked={answers[c.key] || false} onChange={e => setAnswers({ ...answers, [c.key]: e.target.checked })} style={S.check} />
                <span style={{ color: '#d4d4d4', fontSize: '0.85rem' }}>{c.label}</span>
              </label>
            ))}
          </div>
          {Object.values(answers).some(v => v === true) ? (
            <div style={{ ...S.alertBox, backgroundColor: '#78350f', marginTop: '1rem' }}>
              ⏳ One or more noise sources present. <strong>Wait it out</strong> before declaring a plateau. Come back in 5-7 days.
              <button style={{ ...S.ctaBtn, marginTop: '0.75rem' }} onClick={onDone}>Got It — I'll Wait</button>
            </div>
          ) : (
            <button style={{ ...S.ctaBtn, marginTop: '1rem' }} onClick={() => setStep(1)}>None of these apply → Next</button>
          )}
        </div>
      )}

      {step === 1 && (
        <div style={S.card}>
          <h3 style={S.cardTitle}>STEP 1: CHECK COMPLIANCE</h3>
          <p style={S.muted}>Answer honestly. If ANY is "No," fix that thing for 7 days first.</p>
          <div style={S.stack05}>
            {complianceChecks.map(c => (
              <div key={c.key} style={S.compRow}>
                <span style={{ flex: 1, color: '#d4d4d4', fontSize: '0.85rem' }}>{c.label}</span>
                <div style={S.row}>
                  <button style={{ ...S.miniBtn, ...(answers[c.key] === true ? S.pillGreen : {}) }} onClick={() => setAnswers({ ...answers, [c.key]: true })}>Y</button>
                  <button style={{ ...S.miniBtn, ...(answers[c.key] === false ? S.pillWarn : {}) }} onClick={() => setAnswers({ ...answers, [c.key]: false })}>N</button>
                </div>
              </div>
            ))}
          </div>
          {complianceChecks.some(c => answers[c.key] === false) ? (
            <div style={{ ...S.alertBox, backgroundColor: '#78350f', marginTop: '1rem' }}>
              🔧 Fix the items marked "N" for 7 days, then reassess.
              {answers.recoveryOk === false && <p style={{ marginTop: '0.5rem' }}>Recovery compromised → AUTO-HOLD for 7 days. Don't adjust calories or steps.</p>}
              <button style={{ ...S.ctaBtn, marginTop: '0.75rem' }} onClick={onDone}>Got It</button>
            </div>
          ) : complianceChecks.every(c => answers[c.key] === true) ? (
            <button style={{ ...S.ctaBtn, marginTop: '1rem' }} onClick={() => setStep(2)}>All compliant → Pick a lever</button>
          ) : null}
        </div>
      )}

      {step === 2 && (
        <div style={S.card}>
          <h3 style={S.cardTitle}>STEP 2: PICK ONE LEVER</h3>
          <p style={S.muted}>Compliance is real and it's been 14+ days. Choose ONE:</p>
          <div style={{ ...S.grid2, marginTop: '1rem' }}>
            <button style={S.leverCard} onClick={() => { setAnswers({ ...answers, lever: 'calories' }); setStep(3); }}>
              <strong style={{ color: '#fff', fontSize: '1rem' }}>Cut 150 kcal</strong>
              <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                New target: {(currentPhase?.calories || 2000) - 150} kcal
              </p>
              <p style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.5rem' }}>
                Use if: energy is stable and you're already at step target
              </p>
            </button>
            <button style={S.leverCard} onClick={() => { setAnswers({ ...answers, lever: 'steps' }); setStep(3); }}>
              <strong style={{ color: '#fff', fontSize: '1rem' }}>Add 1,500 steps</strong>
              <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                New target: {((currentPhase?.steps || 8000) + 1500).toLocaleString()} steps
              </p>
              <p style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: '0.5rem' }}>
                Use if: feeling hungry or low energy
              </p>
            </button>
          </div>
          <div style={{ ...S.alertBox, backgroundColor: '#450a0a', marginTop: '1rem' }}>
            ⚠️ <strong>NEVER BOTH AT ONCE.</strong> Cutting calories AND adding cardio accelerates muscle loss.
          </div>
          <p style={{ color: '#525252', fontSize: '0.75rem', marginTop: '0.75rem' }}>
            Hard floor: 1,900 kcal. Cannot go below except in final weeks with perfect recovery.
          </p>
        </div>
      )}

      {step === 3 && (
        <div style={S.card}>
          <h3 style={S.cardTitle}>✓ ADJUSTMENT SET</h3>
          <div style={{ ...S.statusBox, backgroundColor: '#065f46', borderColor: '#10b981' }}>
            <p style={{ color: '#10b981', fontSize: '1.1rem', fontWeight: 700 }}>
              {answers.lever === 'calories'
                ? `New calorie target: ${(currentPhase?.calories || 2000) - 150} kcal/day`
                : `New step target: ${((currentPhase?.steps || 8000) + 1500).toLocaleString()} steps/day`}
            </p>
          </div>
          <p style={{ ...S.muted, marginTop: '1rem' }}>
            Give this adjustment 14 days before reassessing. Don't stack changes.
          </p>
          <button style={{ ...S.ctaBtn, marginTop: '1rem' }} onClick={onDone}>Back to Dashboard</button>
        </div>
      )}

      <button style={S.ghostBtn} onClick={onDone}>← Back to Dashboard</button>
    </div>
  );
}

// ─── STYLES ─────────────────────────────────────────────────────────────────────

const S = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0a0a0a',
    color: '#e5e5e5',
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' },
  spinner: { width: 36, height: 36, border: '3px solid #222', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  stack: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  stack05: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  row: { display: 'flex', gap: '0.5rem', alignItems: 'center' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },

  // Header
  header: { backgroundColor: '#0a0a0a', borderBottom: '1px solid #1a1a1a', padding: '0.75rem 1rem', position: 'sticky', top: 0, zIndex: 100 },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' },
  logo: { margin: 0, fontSize: '1.375rem', fontWeight: 900, color: '#10b981', letterSpacing: '-0.05em' },
  headerBadges: { display: 'flex', gap: '0.375rem', alignItems: 'center' },
  weekBadge: { backgroundColor: '#171717', padding: '0.3rem 0.65rem', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', color: '#a3a3a3' },
  typeBadge: { padding: '0.3rem 0.65rem', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 700 },
  nav: { display: 'flex', gap: '0.125rem', overflowX: 'auto' },
  navBtn: { padding: '0.4rem 0.75rem', backgroundColor: 'transparent', border: 'none', borderRadius: '8px', color: '#525252', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' },
  navActive: { backgroundColor: '#171717', color: '#fff' },

  // Main
  main: { padding: '1rem', maxWidth: '560px', margin: '0 auto', paddingBottom: '3rem' },

  // Cards
  card: { backgroundColor: '#141414', borderRadius: '14px', padding: '1.125rem', border: '1px solid #1f1f1f' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' },
  cardTitle: { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', color: '#525252', margin: 0 },

  // Status
  statusBox: { padding: '1.25rem', borderRadius: '10px', textAlign: 'center', border: '2px solid' },
  statusBar: { padding: '0.625rem', borderRadius: '10px', textAlign: 'center', fontSize: '0.8rem', border: '2px solid', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  statusPreview: { padding: '1.25rem', borderRadius: '10px', textAlign: 'center', border: '2px solid', marginTop: '0.25rem' },
  statusRow: { display: 'flex', flexWrap: 'wrap', gap: '0.75rem' },
  statusStat: { display: 'flex', alignItems: 'center', gap: '0.375rem' },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },

  // Buttons
  ctaBtn: { width: '100%', padding: '0.875rem', backgroundColor: '#10b981', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.75rem' },
  ghostBtn: { padding: '0.75rem 1rem', backgroundColor: 'transparent', border: '1px solid #333', borderRadius: '10px', color: '#a3a3a3', fontSize: '0.875rem', cursor: 'pointer' },
  pillBtn: { flex: 1, padding: '0.625rem', backgroundColor: '#171717', border: '2px solid #292524', borderRadius: '8px', color: '#6b7280', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textAlign: 'center' },
  pillGreen: { backgroundColor: '#065f46', borderColor: '#10b981', color: '#10b981' },
  pillWarn: { backgroundColor: '#78350f', borderColor: '#f59e0b', color: '#fbbf24' },
  ynBtn: { flex: 1, padding: '0.75rem', backgroundColor: '#0f0f0f', border: '2px solid #292524', borderRadius: '10px', color: '#6b7280', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', textAlign: 'center' },
  ynGreen: { backgroundColor: '#065f46', borderColor: '#10b981', color: '#10b981' },
  ynRed: { backgroundColor: '#7f1d1d', borderColor: '#f87171', color: '#f87171' },
  actionCard: { padding: '0.875rem', backgroundColor: '#141414', border: '1px solid #1f1f1f', borderRadius: '12px', color: '#d4d4d4', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', textAlign: 'center' },
  miniBtn: { padding: '0.375rem 0.75rem', backgroundColor: '#171717', border: '2px solid #292524', borderRadius: '6px', color: '#525252', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' },
  exportBtn: { flex: 1, padding: '0.75rem', backgroundColor: '#171717', border: '1px solid #292524', borderRadius: '8px', color: '#d4d4d4', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'center' },
  dayBtn: { padding: '0.5rem 0.75rem', backgroundColor: '#171717', border: '2px solid #292524', borderRadius: '8px', color: '#525252', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', minWidth: '44px', textAlign: 'center' },
  dayBtnActive: { backgroundColor: '#065f46', borderColor: '#10b981', color: '#10b981' },
  refBtn: { width: '100%', padding: '0.625rem', backgroundColor: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: '8px', color: '#a3a3a3', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'left' },

  // Forms
  label: { fontSize: '0.8rem', fontWeight: 600, color: '#737373', marginBottom: '0.25rem' },
  input: { padding: '0.75rem', backgroundColor: '#171717', border: '2px solid #292524', borderRadius: '10px', color: '#fff', fontSize: '0.9375rem', outline: 'none', width: '100%', boxSizing: 'border-box' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },

  // Workout
  exerciseRow: { padding: '0.75rem', backgroundColor: '#0a0a0a', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  patternTag: { fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', color: '#525252' },
  setsLabel: { color: '#10b981', fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap' },

  // Info links
  infoLink: { background: 'none', border: 'none', color: '#10b981', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', padding: '0.25rem 0', textAlign: 'left' },

  // Alerts
  alertBox: { backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '0.75rem', borderRadius: '8px', fontSize: '0.8rem', lineHeight: 1.5, marginTop: '0.75rem' },
  inlineWarn: { backgroundColor: '#78350f', color: '#fde68a', padding: '0.625rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem', marginTop: '0.5rem', lineHeight: 1.5 },

  // Special banners
  specialBanner: { padding: '0.875rem', borderRadius: '12px', border: '2px solid', marginBottom: '0.25rem', color: '#e5e5e5' },
  sundayBanner: { width: '100%', padding: '0.875rem', backgroundColor: '#1e3a5f', border: '2px solid #3b82f6', borderRadius: '12px', color: '#93c5fd', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', textAlign: 'center', marginBottom: '0.5rem' },

  // Quality
  qualityBadge: { padding: '0.25rem 0.625rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, color: '#fff' },
  qualityBox: { padding: '0.75rem', borderRadius: '8px', color: '#fff', fontSize: '0.8rem', marginTop: '0.75rem' },

  // Page titles
  pageTitle: { fontSize: '1.375rem', fontWeight: 700, color: '#fff', margin: 0, textAlign: 'center' },
  pageSubtitle: { color: '#525252', textAlign: 'center', fontSize: '0.85rem', margin: '0.25rem 0 0.5rem' },
  muted: { color: '#737373', fontSize: '0.85rem', lineHeight: 1.5, margin: 0 },

  // Questions
  questionBox: { backgroundColor: '#141414', padding: '1rem', borderRadius: '12px', border: '1px solid #1f1f1f' },
  questionText: { color: '#d4d4d4', marginBottom: '0.75rem', fontWeight: 500, fontSize: '0.9375rem', marginTop: 0 },

  // Checklist
  checkRow: { display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer' },
  check: { width: 18, height: 18, accentColor: '#10b981', flexShrink: 0 },
  autoBadge: { fontSize: '0.6rem', color: '#525252', backgroundColor: '#1a1a1a', padding: '0.125rem 0.375rem', borderRadius: '4px' },
  hiitResult: { padding: '0.75rem', borderRadius: '8px', textAlign: 'center', color: '#fff', fontWeight: 600, marginTop: '0.75rem', fontSize: '0.85rem', border: '1px solid' },

  // Metrics
  metricBox: { backgroundColor: '#0a0a0a', padding: '0.875rem', borderRadius: '10px', textAlign: 'center', cursor: 'pointer' },
  metricVal: { display: 'block', fontSize: '1.375rem', fontWeight: 700, color: '#fff' },
  metricLabel: { display: 'block', fontSize: '0.7rem', color: '#525252', marginTop: '0.125rem' },

  // Compliance
  complianceGrid: { marginTop: '0.5rem' },
  compRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' },

  // Lifts
  liftRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' },
  liftInput: { width: 60, padding: '0.5rem', backgroundColor: '#0a0a0a', border: '2px solid #292524', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', textAlign: 'center', outline: 'none' },

  // History
  milestoneRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.75rem', flexWrap: 'wrap' },
  phaseRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.625rem', borderRadius: '4px' },
  phaseTag: { fontSize: '0.625rem', fontWeight: 700, color: '#fbbf24', backgroundColor: '#78350f', padding: '0.15rem 0.4rem', borderRadius: '4px' },
  logRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', borderBottom: '1px solid #1a1a1a', flexWrap: 'wrap' },
  logBadge: { padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 },

  // Plateau
  leverCard: { padding: '1rem', backgroundColor: '#141414', border: '2px solid #292524', borderRadius: '12px', cursor: 'pointer', textAlign: 'left' },

  // Modal
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  modal: { backgroundColor: '#171717', borderRadius: '16px', padding: '1.5rem', maxWidth: '440px', width: '100%', maxHeight: '80vh', overflow: 'auto', border: '1px solid #333' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' },
  modalTitle: { margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#fff' },
  modalClose: { background: 'none', border: 'none', color: '#6b7280', fontSize: '1.25rem', cursor: 'pointer', padding: '0.25rem' },
  modalBody: { color: '#a3a3a3', fontSize: '0.85rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 },

  // Onboarding
  onboardingContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' },
  onboardingDots: { display: 'flex', gap: '0.5rem', marginBottom: '2rem' },
  onboardingDot: { width: 8, height: 8, borderRadius: '50%' },
  onboardingCard: { maxWidth: '380px', textAlign: 'center' },
  onboardingTitle: { fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: '1rem 0 0.375rem', letterSpacing: '-0.02em' },
  onboardingSubtitle: { color: '#10b981', fontSize: '0.9rem', fontWeight: 500, margin: '0 0 1rem' },
  onboardingBody: { color: '#737373', fontSize: '0.9rem', lineHeight: 1.6 },
  dateLabel: { color: '#525252', fontSize: '0.75rem' },
};

// Inject spinner animation
if (typeof document !== 'undefined') {
  const sheet = document.createElement('style');
  sheet.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(sheet);
}
