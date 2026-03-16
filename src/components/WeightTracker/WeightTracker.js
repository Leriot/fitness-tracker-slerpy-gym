import React, { useState, createContext, useCallback, useMemo } from 'react';
import DataImporter from '../DataImporter/DataImporter';
import TrendGraph from './TrendGraph';
import SimpleTrendGraph from './SimpleTrendGraph';

export const WeightTrackerContext = createContext();

const HEIGHT_M    = 1.71;
const BMI_DIVISOR = HEIGHT_M * HEIGHT_M; // 2.9241

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, unit, sub, color }) => (
  <div className="stat-card" style={{ borderColor: color || '#0f3460' }}>
    <div className="stat-value" style={{ color: color || '#64b5f6' }}>{value}</div>
    {unit && <div className="stat-unit">{unit}</div>}
    <div className="stat-label">{label}</div>
    {sub && <div className="stat-sub">{sub}</div>}
  </div>
);

// ── Helpers ───────────────────────────────────────────────────────────────────
const bmiCategory = (bmi) => {
  if (bmi == null) return '';
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25)   return 'Normal';
  if (bmi < 30)   return 'Overweight';
  return 'Obese';
};

const bmiColor = (bmi) => {
  if (bmi == null) return '#64b5f6';
  if (bmi < 18.5)  return '#64b5f6';
  if (bmi < 25)    return '#69f0ae';
  if (bmi < 30)    return '#ffcc44';
  return '#ff5252';
};

const quickRegression = (data) => {
  if (!data || data.length < 2) return null;
  const t0  = data[0].dateObj.getTime();
  const pts = data
    .map(d => ({ x: (d.dateObj.getTime() - t0) / 86400000, y: d.weight }))
    .filter(p => isFinite(p.x) && p.y > 0);
  if (pts.length < 2) return null;
  const n   = pts.length;
  const xm  = pts.reduce((a, p) => a + p.x, 0) / n;
  const ym  = pts.reduce((a, p) => a + p.y, 0) / n;
  const sXY = pts.reduce((a, p) => a + (p.x - xm) * (p.y - ym), 0);
  const sXX = pts.reduce((a, p) => a + (p.x - xm) ** 2, 0);
  if (sXX === 0) return null;
  const slope     = sXY / sXX;
  const intercept = ym - slope * xm;
  return { slope, intercept, t0 };
};

// ── Main Component ─────────────────────────────────────────────────────────────
const WeightTracker = () => {
  const [fitnessData, setFitnessData]             = useState([]);
  const [showGraphs, setShowGraphs]               = useState(false);
  const [targetWeightInput, setTargetWeightInput] = useState(64);
  const [effectiveTarget, setEffectiveTarget]     = useState(64);
  const [yearFilter, setYearFilter]               = useState('ALL'); // 'ALL' | '2025' | '2026' | ...
  const [timeRange, setTimeRange]                 = useState('ALL');
  const [isTableExpanded, setIsTableExpanded]     = useState(false);
  const [error, setError]                         = useState(null);

  // ── Data processing ──────────────────────────────────────────────────────────
  const processData = useCallback((data) => {
    if (!Array.isArray(data)) return [];
    return data
      .filter(row => row && row.date && row.weight != null && row.weight > 0)
      .map(row => {
        const dateObj     = new Date(row.date);
        const displayDate = !isNaN(dateObj)
          ? dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
          : 'Invalid';
        const displayTime = typeof row.time === 'string'
          ? row.time.split(':').slice(0, 2).join(':')
          : '--:--';
        const weight = Number(row.weight) || 0;
        const bmi    = weight > 0 ? +(weight / BMI_DIVISOR).toFixed(1) : null;
        return { ...row, date: displayDate, time: displayTime, dateObj, weight, bmi };
      })
      .filter(row => !isNaN(row.dateObj))
      .sort((a, b) => a.dateObj - b.dateObj);
  }, []);

  const handleDataLoaded = useCallback((data) => {
    setError(null); setShowGraphs(false); setIsTableExpanded(false);
    if (!data || data.length === 0) { setFitnessData([]); return; }
    try {
      setFitnessData(processData(data));
    } catch (err) {
      console.error('Error processing data:', err);
      setError('Failed to process the loaded data.');
      setFitnessData([]);
    }
  }, [processData]);

  const handleError = (msg) => {
    setError(msg); setFitnessData([]); setShowGraphs(false);
  };

  // ── Derived years list (dynamic — works for 2025, 2026, and beyond) ──────────
  const availableYears = useMemo(() =>
    [...new Set(fitnessData.map(d => String(d.dateObj.getFullYear())))].sort()
  , [fitnessData]);

  // ── Year filter ───────────────────────────────────────────────────────────────
  const yearFilteredData = useMemo(() => {
    if (yearFilter === 'ALL' || fitnessData.length === 0) return fitnessData;
    const yr = parseInt(yearFilter);
    return fitnessData.filter(d => d.dateObj.getFullYear() === yr);
  }, [fitnessData, yearFilter]);

  // ── Time-range filter (applied on top of year filter) ────────────────────────
  const timeFilteredData = useMemo(() => {
    if (timeRange === 'ALL' || yearFilteredData.length === 0) return yearFilteredData;
    const daysMap = { '30D': 30, '90D': 90, '180D': 180, '1Y': 365 };
    const days    = daysMap[timeRange];
    if (!days) return yearFilteredData;
    const lastDate = yearFilteredData[yearFilteredData.length - 1].dateObj;
    const cutoff   = new Date(lastDate.getTime() - days * 86400000);
    return yearFilteredData.filter(d => d.dateObj >= cutoff);
  }, [yearFilteredData, timeRange]);

  // ── Stat card values ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (fitnessData.length === 0) return null;
    // Always show latest weight from full dataset
    const last  = fitnessData[fitnessData.length - 1];
    // Total change relative to the start of the current year filter view
    const viewFirst = yearFilteredData.length > 0 ? yearFilteredData[0] : fitnessData[0];
    const totalChange = last.weight - viewFirst.weight;

    const reg        = quickRegression(timeFilteredData);
    const weeklyRate = reg ? reg.slope * 7 : null;

    let daysToTarget = null;
    if (reg && reg.slope !== 0) {
      const lastDays  = (last.dateObj.getTime() - reg.t0) / 86400000;
      const tgtDays   = (effectiveTarget - reg.intercept) / reg.slope;
      const remaining = tgtDays - lastDays;
      if (remaining > 0) daysToTarget = Math.ceil(remaining);
    }

    return { viewFirst, last, totalChange, currentBMI: last.bmi, weeklyRate, daysToTarget };
  }, [fitnessData, yearFilteredData, timeFilteredData, effectiveTarget]);

  const hasData   = fitnessData.length > 0;
  const hasEnough = timeFilteredData.length > 1;

  // ── JSX ───────────────────────────────────────────────────────────────────────
  return (
    <WeightTrackerContext.Provider value={{ targetWeight: effectiveTarget }}>
      <div className="weight-tracker">
        <h1>🏋️ Lerito Weight Tracker</h1>

        <DataImporter onDataLoaded={handleDataLoaded} onError={handleError} />

        {error && <div className="error-message">{error}</div>}

        {/* ── Stat Cards ───────────────────────────────────────────────── */}
        {stats && (
          <div className="stat-cards">
            <StatCard label="Current Weight" value={stats.last.weight.toFixed(1)} unit="kg"
              sub={stats.last.date} color="#64b5f6" />
            <StatCard
              label={yearFilter === 'ALL' ? 'Total Change' : `${yearFilter} Change`}
              value={(stats.totalChange >= 0 ? '+' : '') + stats.totalChange.toFixed(1)}
              unit="kg" sub={`from ${stats.viewFirst.weight.toFixed(1)} kg`}
              color={stats.totalChange < 0 ? '#69f0ae' : '#ff5252'} />
            <StatCard label="Current BMI"
              value={stats.currentBMI != null ? stats.currentBMI.toFixed(1) : '—'}
              sub={bmiCategory(stats.currentBMI)} color={bmiColor(stats.currentBMI)} />
            <StatCard label="Weekly Rate"
              value={stats.weeklyRate != null ? (stats.weeklyRate >= 0 ? '+' : '') + stats.weeklyRate.toFixed(2) : '—'}
              unit="kg/wk"
              sub={yearFilter !== 'ALL' ? `${yearFilter} trend` : 'current range'}
              color={stats.weeklyRate != null && stats.weeklyRate < 0 ? '#69f0ae' : '#ffcc44'} />
            <StatCard label="Target" value={effectiveTarget} unit="kg"
              sub={stats.daysToTarget != null
                ? `~${stats.daysToTarget} days away`
                : stats.last.weight <= effectiveTarget ? '✓ Reached!' : 'trend away'}
              color="#e040fb" />
          </div>
        )}

        {/* ── Year Toggle ── sits above everything else ─────────────────── */}
        {hasData && availableYears.length > 1 && (
          <div className="year-toggle-bar">
            <span className="control-label">Year</span>
            <div className="year-toggle">
              {availableYears.map(yr => (
                <button
                  key={yr}
                  className={`control-button year-btn ${yearFilter === yr ? 'active-year' : ''}`}
                  onClick={() => { setYearFilter(yr); setTimeRange('ALL'); setShowGraphs(false); }}
                >
                  {yr}
                </button>
              ))}
              <button
                className={`control-button year-btn ${yearFilter === 'ALL' ? 'active-year' : ''}`}
                onClick={() => { setYearFilter('ALL'); setShowGraphs(false); }}
              >
                All Time
              </button>
            </div>
          </div>
        )}

        {/* ── Controls ─────────────────────────────────────────────────── */}
        {hasData && (
          <div className="controls">
            {/* Time Range */}
            <div className="control-group">
              <span className="control-label">Range</span>
              <div className="time-range-controls">
                {['30D', '90D', '180D', '1Y', 'ALL'].map(r => (
                  <button
                    key={r}
                    className={`control-button time-btn ${timeRange === r ? 'active' : ''}`}
                    onClick={() => setTimeRange(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Weight */}
            <div className="control-group target-weight-control">
              <span className="control-label">Target</span>
              <input
                type="number"
                value={targetWeightInput}
                onChange={e => setTargetWeightInput(Number(e.target.value) || 0)}
                step="0.5"
              />
              <span className="control-label">kg</span>
              <button className="control-button action-button"
                onClick={() => setEffectiveTarget(targetWeightInput)}>
                Set
              </button>
            </div>
          </div>
        )}

        {/* ── Data Table ───────────────────────────────────────────────── */}
        {hasData && (
          <div className="data-preview">
            <div className="table-header">
              <h2>
                {yearFilter !== 'ALL' ? `${yearFilter} Data` : 'Recent Data'}
                {' '}({timeFilteredData.length} entries)
              </h2>
              {timeFilteredData.length > 4 && (
                <button onClick={() => setIsTableExpanded(v => !v)}
                  className="table-toggle control-button subtle-button">
                  {isTableExpanded ? 'Show Less ▲' : 'Show More ▼'}
                </button>
              )}
            </div>
            {!isTableExpanded && timeFilteredData.length > 4 && (
              <div className="table-notice">Showing most recent 4 entries.</div>
            )}
            <table>
              <thead>
                <tr><th>Date</th><th>Time</th><th>Weight (kg)</th><th>BMI</th></tr>
              </thead>
              <tbody>
                {(isTableExpanded ? [...timeFilteredData] : timeFilteredData.slice(-4))
                  .reverse()
                  .map((entry, i) => (
                    <tr key={`${entry.dateObj?.getTime()}-${i}`}>
                      <td>{entry.date}</td>
                      <td>{entry.time}</td>
                      <td><strong>{entry.weight?.toFixed(1)}</strong></td>
                      <td style={{ color: bmiColor(entry.bmi) }}>{entry.bmi?.toFixed(1)}</td>
                    </tr>
                  ))}
                {!isTableExpanded && timeFilteredData.length > 4 && (
                  <tr className="table-indicator"><td colSpan="4">···</td></tr>
                )}
                {timeFilteredData.length === 0 && (
                  <tr><td colSpan="4">No data in selected range.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Generate Graphs Button ───────────────────────────────────── */}
        {hasData && !showGraphs && (
          <div className="generate-graphs-section">
            <button
              className="control-button action-button"
              onClick={() => {
                if (hasEnough) { setShowGraphs(true); setError(null); }
                else { setError('Need at least 2 data points in selected range.'); }
              }}
              disabled={!hasEnough}
            >
              📊 Generate Graphs
            </button>
            {!hasEnough && <p><small>Need at least 2 data points.</small></p>}
          </div>
        )}

        {/* ── Graphs ───────────────────────────────────────────────────── */}
        {hasEnough && showGraphs && (
          <div className="graphs">
            <TrendGraph data={timeFilteredData} />
            <SimpleTrendGraph data={timeFilteredData} />
          </div>
        )}

      </div>
    </WeightTrackerContext.Provider>
  );
};

export default WeightTracker;
