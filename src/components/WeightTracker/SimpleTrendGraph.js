import React, { useMemo, useContext } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Brush, ReferenceLine
} from 'recharts';
import { WeightTrackerContext } from './WeightTracker';

// ── Custom tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="custom-tooltip">
      <p className="tt-label">{label}</p>
      {payload.map(p => p.value != null && (
        <p key={p.dataKey} style={{ color: p.color, margin: '2px 0' }}>
          {p.name}: <strong>{p.value} kg</strong>
        </p>
      ))}
    </div>
  );
};

// ── SimpleTrendGraph ──────────────────────────────────────────────────────────
/**
 * Simple "first-point to last-point" linear extrapolation.
 * Less statistically rigorous than the regression graph but fast and intuitive.
 */
const SimpleTrendGraph = ({ data }) => {
  const { targetWeight } = useContext(WeightTrackerContext);

  const { combinedData, estimatedDate, trendStats, movingAway, targetReachedDate } = useMemo(() => {
    const empty = { combinedData: [], estimatedDate: null, trendStats: null, movingAway: false, targetReachedDate: null };
    if (!data || data.length < 2 || !isFinite(targetWeight)) return empty;

    const first = data[0];
    const last  = data[data.length - 1];

    if (!(first.dateObj instanceof Date) || isNaN(first.dateObj) ||
        !(last.dateObj  instanceof Date) || isNaN(last.dateObj))  return empty;

    const totalDays   = (last.dateObj - first.dateObj) / 86400000;
    if (totalDays <= 0) {
      return { combinedData: data.map(d => ({ ...d, weight: +d.weight.toFixed(1), trendWeight: null })), ...empty };
    }

    const weightChangePerDay = (last.weight - first.weight) / totalDays;
    if (!isFinite(weightChangePerDay)) return empty;

    if (Math.abs(weightChangePerDay) < 0.001) {
      return {
        combinedData:     data.map(d => ({ ...d, weight: +d.weight.toFixed(1), trendWeight: d.weight })),
        estimatedDate:    null,
        trendStats:       { weeklyRate: 0, daysRemaining: null },
        movingAway:       Math.abs(last.weight - targetWeight) >= 0.1,
        targetReachedDate: null,
      };
    }

    const weightNeeded = targetWeight - last.weight;
    const isMovingAway = Math.sign(weightNeeded) !== Math.sign(weightChangePerDay)
                      && Math.abs(last.weight - targetWeight) >= 0.1;

    let daysToTarget = null;
    let calcTargetDate = null;
    let alreadyReached = false;

    if (!isMovingAway) {
      daysToTarget = weightNeeded / weightChangePerDay;
      if (!isFinite(daysToTarget)) {
        daysToTarget = null;
      } else if (daysToTarget <= 0) {
        alreadyReached = true;
        calcTargetDate = new Date(last.dateObj.getTime() + daysToTarget * 86400000);
        daysToTarget   = 0;
      } else {
        calcTargetDate = new Date(last.dateObj.getTime() + daysToTarget * 86400000);
      }
    }

    // Projection points
    const futurePoints = [];
    if (!isMovingAway && !alreadyReached && daysToTarget !== null && daysToTarget > 0) {
      const STEPS = 4;
      const step  = daysToTarget / STEPS;
      for (let i = 1; i <= STEPS; i++) {
        const futureDate  = new Date(last.dateObj.getTime() + i * step * 86400000);
        const projWeight  = i === STEPS ? targetWeight
          : +(last.weight + weightChangePerDay * i * step).toFixed(1);
        const dateLabel = i === STEPS && calcTargetDate
          ? calcTargetDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })
          : `+${Math.round(i * step / 7)}w`;
        futurePoints.push({
          date: dateLabel, dateObj: futureDate,
          weight: null, trendWeight: projWeight,
          isTrendpoint: true,
        });
      }
    }

    const historicalData = data.map((d, i) => ({
      ...d,
      weight:      +d.weight.toFixed(1),
      // Only anchor the trend line at the first and last points
      trendWeight: (i === 0 || i === data.length - 1) ? +d.weight.toFixed(1) : null,
    }));

    return {
      combinedData:     [...historicalData, ...futurePoints],
      estimatedDate:    isMovingAway ? null : calcTargetDate,
      trendStats:       { weeklyRate: weightChangePerDay * 7, daysRemaining: daysToTarget },
      movingAway:       isMovingAway,
      targetReachedDate: alreadyReached ? calcTargetDate : null,
    };
  }, [data, targetWeight]);

  if (!combinedData || combinedData.length === 0) {
    return <div className="graph-container">Insufficient data for simple trend.</div>;
  }

  const allW = combinedData.flatMap(d => [d.weight, d.trendWeight])
    .filter(w => w != null && isFinite(w));
  if (allW.length === 0) return <div className="graph-container">No valid weight data.</div>;

  const domainMin = Math.min(Math.floor(Math.min(...allW)), Math.floor(targetWeight)) - 1;
  const domainMax = Math.max(Math.ceil(Math.max(...allW)),  Math.ceil(targetWeight))  + 1;
  const tickCount = Math.max(4, Math.min(12, domainMax - domainMin + 1));
  const xInterval = Math.max(0, Math.floor(combinedData.length / 16));

  return (
    <div className="graph-container">
      <h2>Simple Weight Trend (First → Last)</h2>

      {movingAway && (
        <div className="estimate-info warning">
          <p>⚠️ Trend moving away from target {targetWeight} kg &nbsp;|&nbsp;
             Rate: {(trendStats?.weeklyRate ?? 0).toFixed(2)} kg/wk</p>
        </div>
      )}
      {!movingAway && targetReachedDate && (
        <div className="estimate-info success">
          <p>✅ Target {targetWeight} kg reached around {targetReachedDate.toLocaleDateString('en-GB')} &nbsp;|&nbsp;
             Rate: {(trendStats?.weeklyRate ?? 0).toFixed(2)} kg/wk</p>
        </div>
      )}
      {!movingAway && !targetReachedDate && estimatedDate && trendStats?.daysRemaining != null && (
        <div className="estimate-info">
          <p>🎯 Est. reach <strong>{targetWeight} kg</strong>: {estimatedDate.toLocaleDateString('en-GB')}
             &nbsp;·&nbsp; {Math.ceil(trendStats.daysRemaining)} days
             &nbsp;·&nbsp; {trendStats.weeklyRate.toFixed(2)} kg/wk</p>
        </div>
      )}

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={combinedData} margin={{ top: 20, right: 40, left: 10, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
          <XAxis
            dataKey="date"
            angle={-45}
            textAnchor="end"
            height={60}
            tick={{ dy: 10, fontSize: '0.72em', fill: '#8892b0' }}
            interval={xInterval}
            axisLine={{ stroke: '#444' }}
            tickLine={{ stroke: '#444' }}
          />
          <YAxis
            domain={[domainMin, domainMax]}
            tick={{ fontSize: '0.8em', fill: '#8892b0' }}
            tickCount={tickCount}
            allowDecimals={false}
            axisLine={{ stroke: '#444' }}
            tickLine={{ stroke: '#444' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            height={36}
            wrapperStyle={{ paddingTop: '8px', fontSize: '0.85em', color: '#8892b0' }}
          />

          <ReferenceLine
            y={targetWeight}
            stroke="#e040fb"
            strokeDasharray="6 3"
            label={{ value: `Target ${targetWeight} kg`, fill: '#e040fb', fontSize: '0.72em', position: 'insideTopRight' }}
          />

          <Line type="linear" dataKey="trendWeight" stroke="#ff9f43" strokeWidth={2}
            strokeDasharray="6 3" dot={false} name="Simple Trend" connectNulls={true} />
          <Line type="monotone" dataKey="weight" stroke="#7c83fd" strokeWidth={2}
            dot={{ fill: '#7c83fd', r: 2 }} activeDot={{ r: 5 }} name="Weight" connectNulls={false} />

          <Brush dataKey="date" height={22} stroke="#333" fill="#0d0d1a" travellerWidth={8}
            startIndex={Math.max(0, combinedData.length - 90)}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SimpleTrendGraph;
