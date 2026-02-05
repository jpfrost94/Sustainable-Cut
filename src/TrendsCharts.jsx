import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function TrendsCharts({ weightData, liftData, S, Card }) {
  const waistData = weightData.filter((d) => d.waist);

  return (
    <>
      {weightData.length >= 2 && (
        <Card>
          <h3 style={S.cardTitle}>WEIGHT TREND</h3>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <AreaChart data={weightData}>
                <defs>
                  <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="week" stroke="#525252" fontSize={12} />
                <YAxis domain={['auto', 'auto']} stroke="#525252" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: 8, color: '#e5e5e5' }} />
                <Area type="monotone" dataKey="weight" stroke="#16a34a" fill="url(#wg)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {waistData.length >= 2 && (
        <Card>
          <h3 style={S.cardTitle}>WAIST TREND</h3>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <AreaChart data={waistData}>
                <defs>
                  <linearGradient id="wsg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="week" stroke="#525252" fontSize={12} />
                <YAxis domain={['auto', 'auto']} stroke="#525252" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: 8, color: '#e5e5e5' }} />
                <Area type="monotone" dataKey="waist" stroke="#fbbf24" fill="url(#wsg)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {liftData.length >= 2 && (
        <Card>
          <h3 style={S.cardTitle}>LIFT PERFORMANCE</h3>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={liftData}>
                <XAxis dataKey="week" stroke="#525252" fontSize={12} />
                <YAxis stroke="#525252" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: 8, color: '#e5e5e5' }} />
                <Line type="monotone" dataKey="squat" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} name="Squat" />
                <Line type="monotone" dataKey="deadlift" stroke="#f87171" strokeWidth={2} dot={{ r: 3 }} name="Deadlift" />
                <Line type="monotone" dataKey="bench" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} name="Bench" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 6 }}>
            <span style={{ color: '#16a34a', fontSize: '0.75rem' }}>● Squat</span>
            <span style={{ color: '#f87171', fontSize: '0.75rem' }}>● Deadlift</span>
            <span style={{ color: '#60a5fa', fontSize: '0.75rem' }}>● Bench</span>
          </div>
        </Card>
      )}

      {weightData.length < 2 && liftData.length < 2 && (
        <Card>
          <p style={S.muted}>Charts appear after 2+ weekly check-ins. Complete your Sunday check-in to start.</p>
        </Card>
      )}
    </>
  );
}
