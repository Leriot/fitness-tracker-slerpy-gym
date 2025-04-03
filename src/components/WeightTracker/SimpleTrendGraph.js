import React, { useMemo, useContext } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { WeightTrackerContext } from './WeightTracker';

const SimpleTrendGraph = ({ data }) => {
  const { targetWeight } = useContext(WeightTrackerContext);
  // console.log("SimpleTrendGraph Render - Data length:", data?.length, "Target:", targetWeight);

  const { combinedData, estimatedDate, trendStats, movingAway, targetReachedDate } = useMemo(() => {
    // console.log("SimpleTrendGraph useMemo start");

    if (!data || data.length < 2 || targetWeight == null || !isFinite(targetWeight)) {
      return { combinedData: [], estimatedDate: null, trendStats: null, movingAway: false, targetReachedDate: null };
    }

    const firstPoint = data[0];
    const lastPoint = data[data.length - 1];

    if (!(firstPoint.dateObj instanceof Date) || isNaN(firstPoint.dateObj.getTime()) ||
        !(lastPoint.dateObj instanceof Date) || isNaN(lastPoint.dateObj.getTime())) {
        console.error("SimpleTrendGraph: Invalid Date objects found.");
        return { combinedData: [], estimatedDate: null, trendStats: null, movingAway: false, targetReachedDate: null };
    }

    const totalDays = (lastPoint.dateObj.getTime() - firstPoint.dateObj.getTime()) / (1000 * 60 * 60 * 24);

    if (totalDays <= 0) {
       const currentData = data.map(d => ({ ...d, weight: Number(d.weight.toFixed(1)), trendWeight: null }));
       return { combinedData: currentData, estimatedDate: null, trendStats: { weeklyRate: 0, daysRemaining: null }, movingAway: false, targetReachedDate: null };
    }

    const totalWeightChange = lastPoint.weight - firstPoint.weight;
    const weightChangePerDay = totalWeightChange / totalDays;

    if (!isFinite(weightChangePerDay)) {
        const currentData = data.map(d => ({ ...d, weight: Number(d.weight.toFixed(1)), trendWeight: null }));
        return { combinedData: currentData, estimatedDate: null, trendStats: null, movingAway: false, targetReachedDate: null };
    }

    // Handle Flat Trend
    if (Math.abs(weightChangePerDay) < 0.001) {
         const flatData = data.map(d => ({ ...d, weight: Number(d.weight.toFixed(1)), trendWeight: d.weight }));
         const isAtTarget = Math.abs(lastPoint.weight - targetWeight) < 0.1;
        return {
            combinedData: flatData,
            estimatedDate: null,
            trendStats: { weeklyRate: 0, daysRemaining: null },
            movingAway: !isAtTarget,
            targetReachedDate: isAtTarget ? lastPoint.dateObj : null
        };
    }

    // --- Calculate Trend vs Target ---
    const weightDifferenceNeeded = targetWeight - lastPoint.weight; // Target - Current
    const currentWeightToLose = lastPoint.weight - targetWeight; // Current - Target (for moving away check)
    const isMovingAway = Math.sign(weightDifferenceNeeded) !== Math.sign(weightChangePerDay);
    const isEffectivelyAtTarget = Math.abs(currentWeightToLose) < 0.1;
    const finalMovingAway = isMovingAway && !isEffectivelyAtTarget;

    let daysToTargetDuration = null;
    let calculatedTargetDate = null;
    let isTargetAlreadyReached = false;

    if (!finalMovingAway) {
        daysToTargetDuration = weightDifferenceNeeded / weightChangePerDay; // This is the correct duration calculation

        if (!isFinite(daysToTargetDuration)) {
            daysToTargetDuration = null;
        } else {
            if (daysToTargetDuration <= 0) { // Check if duration is non-positive (target reached/passed)
                isTargetAlreadyReached = true;
                calculatedTargetDate = new Date(lastPoint.dateObj.getTime() + (daysToTargetDuration * 24 * 60 * 60 * 1000)); // Date it was reached
                daysToTargetDuration = 0; // Set remaining duration to 0
            } else { // Target is in the future
                calculatedTargetDate = new Date(lastPoint.dateObj.getTime() + (daysToTargetDuration * 24 * 60 * 60 * 1000));
            }
        }
    }

    // --- Projection points ---
    const futurePoints = [];
    if (!finalMovingAway && !isTargetAlreadyReached && daysToTargetDuration !== null && daysToTargetDuration > 0) {
        const pointCount = 3;
        const durationToTarget = daysToTargetDuration; // Correct positive duration
        const dayInterval = durationToTarget / pointCount;

        for (let i = 1; i <= pointCount; i++) {
            const futureDate = new Date(lastPoint.dateObj.getTime() + (i * dayInterval * 24 * 60 * 60 * 1000));
            const projectedWeight = Number((lastPoint.weight + (weightChangePerDay * i * dayInterval)).toFixed(1));

            futurePoints.push({
                date: i === pointCount && calculatedTargetDate ?
                    calculatedTargetDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }) :
                    `+${Math.round(i * dayInterval / 7)}w`,
                dateObj: futureDate,
                weight: null,
                trendWeight: projectedWeight,
                isTrendpoint: true
            });
        }
        if (futurePoints.length > 0 && isFinite(targetWeight)) {
            futurePoints[futurePoints.length - 1].trendWeight = targetWeight;
             if (calculatedTargetDate) {
                futurePoints[futurePoints.length - 1].date = calculatedTargetDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
             }
        }
    }

    // --- Combine historical data with projections ---
     const combinedData = [
          ...data.map((d, i) => ({ ...d, weight: Number(d.weight.toFixed(1)), trendWeight: i === 0 ? Number(d.weight.toFixed(1)) : null })),
          { ...lastPoint, weight: null, trendWeight: Number(lastPoint.weight.toFixed(1)) },
          ...futurePoints
     ];

    return {
      combinedData,
      estimatedDate: finalMovingAway ? null : calculatedTargetDate,
      trendStats: { weeklyRate: weightChangePerDay * 7, daysRemaining: finalMovingAway || daysToTargetDuration === null ? null : daysToTargetDuration },
      movingAway: finalMovingAway,
      targetReachedDate: isTargetAlreadyReached ? calculatedTargetDate : null
    };

  }, [data, targetWeight]);

   // --- Rendering Logic ---
   if (!combinedData || combinedData.length === 0) { return <div className="graph-container">Insufficient data for simple trend analysis.</div>; }
   // ... Domain calculation ...
    const allWeights = combinedData.flatMap(d => [ typeof d.weight === 'number' ? d.weight : null, typeof d.trendWeight === 'number' ? d.trendWeight : null ]).filter(w => w !== null && isFinite(w));
    if (allWeights.length === 0) { return <div className="graph-container">No valid weight data to display.</div>; }
    const minWeight = Math.floor(Math.min(...allWeights));
    const maxWeight = Math.ceil(Math.max(...allWeights));
    const domainMin = isFinite(minWeight) ? minWeight - 1 : 0;
    const domainMax = isFinite(maxWeight) ? maxWeight + 1 : 100;
    const tickCount = Math.max(3, Math.min(10, Math.ceil(domainMax - domainMin) + 1));

  return (
    <div className="graph-container">
      <h2>Simple Weight Trend Analysis</h2>

      {/* Message Logic */}
      {movingAway && ( <div className="estimate-info warning"> <p>Simple trend (first vs last) is moving away from the target ({targetWeight}kg).</p> <p>Rate (first/last): {(trendStats?.weeklyRate ?? 0).toFixed(2)} kg/week</p> </div> )}
      {!movingAway && targetReachedDate && ( <div className="estimate-info success"> <p>Target ({targetWeight}kg) was likely reached/passed around {targetReachedDate.toLocaleDateString('en-GB')} (based on first/last point trend).</p> <p>Current Rate (first/last): {(trendStats?.weeklyRate ?? 0).toFixed(2)} kg/week</p> </div> )}
      {!movingAway && !targetReachedDate && estimatedDate && trendStats && trendStats.daysRemaining !== null && Math.abs(trendStats.weeklyRate) > 0.01 && ( <div className="estimate-info"> <p>Est. date (first/last) to reach {targetWeight}kg: {estimatedDate.toLocaleDateString('en-GB')}</p> <p>Rate (first/last): {trendStats.weeklyRate.toFixed(2)} kg/week</p> <p>Est. days remaining: {Math.ceil(trendStats.daysRemaining)}</p> </div> )}
      {!movingAway && !targetReachedDate && trendStats && Math.abs(trendStats.weeklyRate) < 0.01 && ( <div className="estimate-info"> <p>Simple trend (first vs last point) is flat.</p> </div> )}

      {/* Chart Rendering */}
       <ResponsiveContainer width="100%" height={400}>
            <LineChart data={combinedData} margin={{ top: 30, right: 50, left: 30, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#555555" />
                <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} tick={{ dy: 10, fontSize: '0.8em', fill: '#cccccc' }} interval="preserveStartEnd"/>
                <YAxis domain={[domainMin, domainMax]} tick={{ fontSize: '0.8em', fill: '#cccccc' }} tickCount={tickCount} allowDecimals={false}/>
                <Tooltip contentStyle={{ backgroundColor: 'rgba(30, 30, 30, 0.85)', border: '1px solid #555555', borderRadius: '4px', color: '#ffffff' }} formatter={(value, name) => [`${value} kg`, name]}/>
                <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingTop: '10px', paddingBottom: '10px', color: '#cccccc' }}/>
                <Line type="monotone" dataKey="weight" stroke="#8884d8" strokeWidth={2} dot={{ fill: '#8884d8', r: 3 }} activeDot={{ r: 5 }} name="Weight" connectNulls={false}/>
                <Line // Simple Trend Line
                    type="linear"
                    dataKey="trendWeight"
                    stroke="#ff7300" // Orange for simple trend
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Simple Trend"
                    connectNulls={true}
                 /> {/* Comment moved outside */}
            </LineChart>
       </ResponsiveContainer>
    </div>
  );
};

export default SimpleTrendGraph; // Ensure export default is present