import React, { useMemo, useContext } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Brush, ReferenceLine
} from 'recharts';
import { WeightTrackerContext } from './WeightTracker';

// ── T-table (two-tailed 95%, α=0.05) ─────────────────────────────────────────
const T_TABLE = {
  1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
  6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
  15: 2.131, 20: 2.086, 30: 2.042, 60: 2.000
};
const T_INF = 1.960;
const T_DF_KEYS = Object.keys(T_TABLE).map(Number).sort((a, b) => a - b);

/** Linear interpolation through the t-table for better accuracy */
const calculateTValue = (df) => {
  if (df <= 0)  return T_TABLE[1];
  if (df > 60)  return T_INF;
  // Exact match
  if (T_TABLE[df] !== undefined) return T_TABLE[df];
  // Interpolate
  const lower = T_DF_KEYS.filter(k => k <= df).pop();
  const upper = T_DF_KEYS.find(k => k > df);
  if (upper === undefined) return T_TABLE[60];
  const t = (df - lower) / (upper - lower);
  return T_TABLE[lower] + t * (T_TABLE[upper] - T_TABLE[lower]);
};

/**
 * OLS linear regression.
 * Returns slope, intercept (and associated stats) expressed in day-units
 * measured from firstDateMs (the first date in `data`).
 */
const calculateLinearRegression = (data) => {
  if (!data || data.length < 2) return null;
  try {
    const firstDateMs = data[0].dateObj?.getTime();
    if (!isFinite(firstDateMs)) return null;

    // Only include rows with valid, positive weights
    const pts = data.map(d => ({
      x: (d.dateObj.getTime() - firstDateMs) / 86400000,
      y: d.weight,
    })).filter(p => isFinite(p.x) && isFinite(p.y) && p.y > 0);

    if (pts.length < 2) return null;

    const n   = pts.length;
    const xm  = pts.reduce((s, p) => s + p.x, 0) / n;
    const ym  = pts.reduce((s, p) => s + p.y, 0) / n;
    const sXY = pts.reduce((s, p) => s + (p.x - xm) * (p.y - ym), 0);
    const sXX = pts.reduce((s, p) => s + (p.x - xm) ** 2, 0);

    if (sXX === 0) {
      return { slope: 0, intercept: ym, firstDateMs, xMean: xm, sumXX: 0, n, residuals: pts.map(p => p.y - ym), rSquared: 0 };
    }

    const slope     = sXY / sXX;
    const intercept = ym - slope * xm;
    const preds     = pts.map(p => slope * p.x + intercept);
    const residuals = pts.map((p, i) => p.y - preds[i]);
    const RSS       = residuals.reduce((s, r) => s + r * r, 0);
    const TSS       = pts.reduce((s, p) => s + (p.y - ym) ** 2, 0);
    const rSquared  = TSS === 0 ? 1 : Math.max(0, 1 - RSS / TSS);

    // Standard error of regression (SE of residuals)
    const dof = n - 2;
    const se  = dof > 0 ? Math.sqrt(RSS / dof) : 0;
    const t   = dof > 0 ? calculateTValue(dof) : 0;

    return { slope, intercept, firstDateMs, xMean: xm, sumXX: sXX, n, residuals, rSquared, se, t, dof };
  } catch (err) {
    console.error('Regression error:', err);
    return null;
  }
};

/** 95% prediction interval half-width at a given daysFromStart */
const predictionMargin = ({ se, t, n, xMean, sumXX }, daysFromStart) => {
  if (!se || !t || !sumXX) return 0;
  const sePred = se * Math.sqrt(1 + 1 / n + (daysFromStart - xMean) ** 2 / sumXX);
  return isFinite(sePred) ? t * sePred : 0;
};

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

// ── TrendGraph ────────────────────────────────────────────────────────────────
/**
 * Props:
 *   data           – all data points to display (weight dots + regression line)
 *   regressionData – optional subset to compute regression from (e.g. 2026-only);
 *                    if null/undefined the full `data` array is used
 */
const TrendGraph = ({ data, regressionData }) => {
  const { targetWeight } = useContext(WeightTrackerContext);

  const { combinedData, estimatedDate, regressionStats, movingAway, using2026 } = useMemo(() => {
    const empty = { combinedData: [], estimatedDate: null, regressionStats: null, movingAway: false, using2026: false };
    if (!data || data.length < 2 || !isFinite(targetWeight)) return empty;

    // Use regressionData for the regression calc if provided, otherwise use full data
    const regSource = regressionData && regressionData.length >= 2 ? regressionData : data;
    const using2026 = regSource !== data;

    const reg = calculateLinearRegression(regSource);
    if (!reg) return empty;

    const { slope, intercept, firstDateMs, rSquared, se } = reg;

    // Apply regression to ALL display data points (may extrapolate for pre-2026)
    const regressionLineData = data.map(d => {
      const daysFromStart = (d.dateObj.getTime() - firstDateMs) / 86400000;
      const trend = slope * daysFromStart + intercept;
      const margin = predictionMargin(reg, daysFromStart);
      return {
        ...d,
        weight:     d.weight > 0 ? +d.weight.toFixed(1) : null,
        trendWeight: +trend.toFixed(1),
        upperBound: se > 0 ? +(trend + margin).toFixed(1) : null,
        lowerBound: se > 0 ? +(trend - margin).toFixed(1) : null,
      };
    });

    // ── Projection ────────────────────────────────────────────────────────
    const lastPoint  = data[data.length - 1];
    const lastDays   = (lastPoint.dateObj.getTime() - firstDateMs) / 86400000;
    const daysToTgt  = slope !== 0 ? (targetWeight - intercept) / slope : null;
    const remaining  = daysToTgt !== null ? daysToTgt - lastDays : null;

    const isMovingAway =
      (slope < 0 && targetWeight > lastPoint.weight) ||
      (slope > 0 && targetWeight < lastPoint.weight) ||
      slope === 0;

    const futurePoints = [];
    let estimatedDate  = null;

    if (!isMovingAway && remaining !== null && remaining > 0 && isFinite(remaining)) {
      estimatedDate = new Date(firstDateMs + daysToTgt * 86400000);
      const STEPS = 4;
      for (let i = 1; i <= STEPS; i++) {
        const frac        = i / STEPS;
        const futureDays  = lastDays + remaining * frac;
        const futureDate  = new Date(firstDateMs + futureDays * 86400000);
        const projWeight  = i === STEPS ? targetWeight : +(slope * futureDays + intercept).toFixed(1);
        const dateLabel   = i === STEPS
          ? estimatedDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })
          : `+${Math.round(remaining * frac / 7)}w`;
        // No prediction interval bands on projection points to keep chart clean
        futurePoints.push({
          date: dateLabel, dateObj: futureDate,
          weight: null, trendWeight: projWeight,
          upperBound: null, lowerBound: null,
          isTrendpoint: true,
        });
      }
    }

    return {
      combinedData:    [...regressionLineData, ...futurePoints],
      estimatedDate,
      regressionStats: { rSquared, weeklyRate: slope * 7, daysRemaining: remaining },
      movingAway:      isMovingAway,
      using2026,
    };
  }, [data, regressionData, targetWeight]);

  if (!combinedData || combinedData.length === 0) {
    return <div className="graph-container">Insufficient data for regression analysis.</div>;
  }

  // ── Domain ────────────────────────────────────────────────────────────────
  const allW = combinedData.flatMap(d => [d.weight, d.trendWeight, d.upperBound, d.lowerBound])
    .filter(w => w != null && isFinite(w));
  if (allW.length === 0) return <div className="graph-container">No valid weight data.</div>;

  const domainMin = Math.min(Math.floor(Math.min(...allW)), Math.floor(targetWeight)) - 1;
  const domainMax = Math.max(Math.ceil(Math.max(...allW)),  Math.ceil(targetWeight))  + 1;
  const tickCount = Math.max(4, Math.min(12, domainMax - domainMin + 1));

  // Show ~16 x-axis labels regardless of data density
  const xInterval = Math.max(0, Math.floor(combinedData.length / 16));

  return (
    <div className="graph-container">
      <div className="graph-header">
        <h2>Weight Trend — Regression</h2>
        {using2026 && <span className="badge badge-2026">2026 Data Only</span>}
      </div>

      {/* Stats banner */}
      {regressionStats && (
        <div className={`estimate-info ${movingAway ? 'warning' : ''}`}>
          {movingAway ? (
            <p>⚠️ Trend is moving <strong>away</strong> from target {targetWeight} kg &nbsp;|&nbsp;
               Weekly: {regressionStats.weeklyRate.toFixed(2)} kg &nbsp;|&nbsp;
               R²: {regressionStats.rSquared.toFixed(3)}</p>
          ) : estimatedDate ? (
            <p>
              🎯 Est. reach <strong>{targetWeight} kg</strong>: {estimatedDate.toLocaleDateString('en-GB')}
              &nbsp;·&nbsp; {Math.ceil(regressionStats.daysRemaining)} days
              &nbsp;·&nbsp; {regressionStats.weeklyRate.toFixed(2)} kg/wk
              &nbsp;·&nbsp; R²: {regressionStats.rSquared.toFixed(3)}
            </p>
          ) : (
            <p>R²: {regressionStats.rSquared.toFixed(3)} &nbsp;|&nbsp; Weekly: {regressionStats.weeklyRate.toFixed(2)} kg</p>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={420}>
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

          {/* Target weight reference line */}
          <ReferenceLine
            y={targetWeight}
            stroke="#e040fb"
            strokeDasharray="6 3"
            label={{ value: `Target ${targetWeight} kg`, fill: '#e040fb', fontSize: '0.72em', position: 'insideTopRight' }}
          />

          {/* Prediction interval bands — historical only (connectNulls=false stops at null values) */}
          <Line type="linear" dataKey="upperBound" stroke="#ff6b8a" strokeWidth={1}
            strokeDasharray="3 3" dot={false} name="Upper 95% PI" connectNulls={false} legendType="none" />
          <Line type="linear" dataKey="lowerBound" stroke="#56ccf2" strokeWidth={1}
            strokeDasharray="3 3" dot={false} name="Lower 95% PI" connectNulls={false} legendType="none" />

          {/* Regression / projection trend */}
          <Line type="linear" dataKey="trendWeight" stroke="#69f0ae" strokeWidth={2}
            strokeDasharray="6 3" dot={false} name="Regression Trend" connectNulls={true} />

          {/* Actual weight measurements */}
          <Line type="monotone" dataKey="weight" stroke="#7c83fd" strokeWidth={2}
            dot={{ fill: '#7c83fd', r: 2 }} activeDot={{ r: 5 }} name="Weight" connectNulls={false} />

          {/* Zoom brush */}
          <Brush dataKey="date" height={22} stroke="#333" fill="#0d0d1a" travellerWidth={8}
            startIndex={Math.max(0, combinedData.length - 90)}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendGraph;
