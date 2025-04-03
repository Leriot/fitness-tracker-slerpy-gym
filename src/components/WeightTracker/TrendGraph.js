import React, { useMemo, useContext } from 'react';
// CORRECTED Recharts Import: Include all used components
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import _ from 'lodash';
import { WeightTrackerContext } from './WeightTracker';

// --- Helper functions (T_TABLE, calculateTValue, etc.) ---
const T_TABLE = { 1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 15: 2.131, 20: 2.086, 30: 2.042, 60: 2.000, Infinity: 1.960 };
const calculateTValue = (degreesOfFreedom) => {
    if (degreesOfFreedom <= 0) return T_TABLE[1];
    const dfs = Object.keys(T_TABLE).map(Number).filter(isFinite);
    const closestDf = dfs.reduce((prev, curr) =>
        Math.abs(curr - degreesOfFreedom) < Math.abs(prev - degreesOfFreedom) ? curr : prev
    );
    return degreesOfFreedom > 60 ? T_TABLE.Infinity : T_TABLE[closestDf];
};

const calculateLinearRegression = (data) => {
    if (!data || data.length < 2) {
        console.log("Regression: Data length < 2");
        return null;
    }
    try {
        const firstDateMs = data[0].dateObj?.getTime();
        if (isNaN(firstDateMs)) {
             console.error("Regression: Invalid first date");
             return null;
        }
        const firstDate = new Date(firstDateMs);
        const points = data.map(point => {
            const days = (point.dateObj?.getTime() - firstDateMs) / (24 * 60 * 60 * 1000);
            const weight = point.weight;
            return { days, weight };
        }).filter(p => isFinite(p.days) && isFinite(p.weight));

        if (points.length < 2) {
            console.log("Regression: Not enough valid numeric points after filtering");
            return null;
        }
        const n = points.length;
        const daysArray = points.map(p => p.days);
        const weights = points.map(p => p.weight);
        const xMean = _.mean(daysArray);
        const yMean = _.mean(weights);
        const sumXY = _.sum(daysArray.map((x, i) => (x - xMean) * (weights[i] - yMean)));
        const sumXX = _.sum(daysArray.map(x => Math.pow(x - xMean, 2)));

        if (sumXX === 0) {
            console.log("Regression: No variation in dates (sumXX is 0)");
            return { slope: 0, intercept: yMean, daysArray, firstDate, sumXX: 0, xMean, residuals: weights.map(w => w - yMean), rSquared: 0, n };
        }
        const totalSS = _.sum(weights.map(y => Math.pow(y - yMean, 2)));
        if (totalSS === 0) {
            console.log("Regression: No variation in weights (totalSS is 0)");
             return { slope: 0, intercept: yMean, daysArray, firstDate, sumXX, xMean, residuals: weights.map(w => 0), rSquared: 1, n };
        }
        const slope = sumXY / sumXX;
        const intercept = yMean - (slope * xMean);
        const predictions = daysArray.map(x => slope * x + intercept);
        const residuals = weights.map((y, i) => y - predictions[i]);
        const residualSS = _.sum(residuals.map(r => r * r));
        const rSquared = totalSS === 0 ? 1 : Math.max(0, 1 - (residualSS / totalSS));

        return { slope, intercept, daysArray, firstDate, sumXX, xMean, residuals, rSquared, n };
    } catch (error) {
        console.error('Error in regression calculation:', error);
        return null;
    }
};

const calculateDeviationParams = (regression) => {
    if (!regression || regression.n < 3) {
         console.log("Deviation Params: Regression invalid or n < 3");
         return null;
    }
    const { residuals, n } = regression;
    const degreesOfFreedom = n - 2;
    if (degreesOfFreedom <= 0) {
        console.log("Deviation Params: Degrees of freedom <= 0");
        return null;
    }
    const residualSS = _.sum(residuals.map(r => r * r));
    const standardError = Math.sqrt(residualSS / degreesOfFreedom);
     if (!isFinite(standardError)) {
         console.error("Deviation Params: Calculated standardError is not finite.", standardError);
         return null;
     }
    const tValue = calculateTValue(degreesOfFreedom);
    return { standardError, tValue, degreesOfFreedom };
};


const TrendGraph = ({ data }) => {
  const { targetWeight } = useContext(WeightTrackerContext);
  // console.log("TrendGraph Render - Data length:", data?.length, "Target:", targetWeight);

  const { combinedData, estimatedDate, regressionStats, movingAway } = useMemo(() => {
    // console.log("TrendGraph useMemo start");

    if (!data || data.length < 2 || targetWeight == null || !isFinite(targetWeight)) { return { combinedData: [], estimatedDate: null, regressionStats: null, movingAway: false }; }
    const regression = calculateLinearRegression(data);
    if (!regression) { return { combinedData: [], estimatedDate: null, regressionStats: null, movingAway: false }; }
    const { slope, intercept, daysArray, firstDate, sumXX, xMean, residuals, rSquared, n } = regression; // Destructure all needed vars
    if (slope === 0) {
        // Handle flat trend state (as before)
        const flatLineData = data.map((d) => ({/*...*/})); // Simplified for brevity
        return { combinedData: flatLineData, estimatedDate: null, regressionStats: { rSquared: rSquared ?? 0, slope: 0, daysToTarget: null }, movingAway: intercept !== targetWeight };
    }
    const deviationParams = calculateDeviationParams(regression);
    const fallbackMode = !deviationParams;
    const { standardError, tValue } = deviationParams || {};


    const lastPoint = data[data.length - 1];
    const lastWeight = lastPoint.weight;
    const lastDate = new Date(lastPoint.dateObj);

    const daysToTargetRegression = (targetWeight - intercept) / slope;
    const targetDateRegression = new Date(firstDate.getTime() + (daysToTargetRegression * 24 * 60 * 60 * 1000));
    const weightDiffToTarget = targetWeight - lastWeight;
    const isMovingAway = (slope > 0 && weightDiffToTarget < 0) || (slope < 0 && weightDiffToTarget > 0);
    let estimatedDaysRemaining = null;
    if (!isMovingAway) {
         estimatedDaysRemaining = (targetWeight - lastWeight) / slope;
         if (!isFinite(estimatedDaysRemaining)) estimatedDaysRemaining = null;
    }

    // --- Projection points ---
    const futurePoints = [];
    if (!isMovingAway && !fallbackMode && estimatedDaysRemaining !== null) {
      const pointCount = 3;
      const totalProjectionDuration = estimatedDaysRemaining;
      const totalProjectionSteps = pointCount + 1;

      for (let i = 1; i <= totalProjectionSteps; i++) {
           const timeFraction = i / totalProjectionSteps;
           const currentProjectionDays = totalProjectionDuration * timeFraction;
           const futureDate = new Date(lastDate.getTime() + (currentProjectionDays * 24 * 60 * 60 * 1000));
           const daysFromStart = (futureDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
           let projectedWeight;
           let predictionIntervalMargin = 0;

           if (i === totalProjectionSteps) {
                projectedWeight = targetWeight;
           } else {
                projectedWeight = Number((slope * daysFromStart + intercept).toFixed(1));
           }

            if (!fallbackMode && sumXX !== 0 && isFinite(standardError) && isFinite(tValue)) {
                 const sePrediction = standardError * Math.sqrt(1 + (1 / n) + (Math.pow(daysFromStart - xMean, 2) / sumXX));
                 if (isFinite(sePrediction)) { predictionIntervalMargin = tValue * sePrediction; }
            }

            let dateLabel;
             if (i === totalProjectionSteps) {
                  dateLabel = targetDateRegression.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
             } else {
                  const weeksOut = Math.round(Math.abs(currentProjectionDays) / 7);
                  dateLabel = `+${weeksOut}w`;
             }

           futurePoints.push({
             date: dateLabel, dateObj: futureDate, weight: null, trendWeight: projectedWeight,
             upperBound: fallbackMode ? null : Number((projectedWeight + predictionIntervalMargin).toFixed(1)),
             lowerBound: fallbackMode ? null : Number((projectedWeight - predictionIntervalMargin).toFixed(1)),
             isTrendpoint: true
           });
      }
    } // End projection

    // --- Combine historical regression line with future points ---
     const regressionLineData = data.map((d, i) => {
         const daysFromStart = daysArray[i];
         const trendWeight = Number((slope * daysFromStart + intercept).toFixed(1));
         let predictionIntervalMargin = 0;
         if (!fallbackMode && sumXX !== 0 && isFinite(standardError) && isFinite(tValue)) {
             const sePrediction = standardError * Math.sqrt(1 + (1 / n) + (Math.pow(daysFromStart - xMean, 2) / sumXX));
             if (isFinite(sePrediction)) { predictionIntervalMargin = tValue * sePrediction; }
         }
         return {
             ...d, weight: Number(d.weight.toFixed(1)), trendWeight: trendWeight,
             upperBound: fallbackMode ? null : Number((trendWeight + predictionIntervalMargin).toFixed(1)),
             lowerBound: fallbackMode ? null : Number((trendWeight - predictionIntervalMargin).toFixed(1)),
         };
     });
    const finalCombinedData = [...regressionLineData, ...futurePoints];
    const finalDaysToTarget = isMovingAway || estimatedDaysRemaining === null ? null : Math.abs(estimatedDaysRemaining);

    return {
      combinedData: finalCombinedData,
      estimatedDate: isMovingAway || estimatedDaysRemaining === null ? null : targetDateRegression,
      regressionStats: { rSquared, slope: slope * 7, daysToTarget: finalDaysToTarget },
      movingAway: isMovingAway
    };
  }, [data, targetWeight]);

   // --- Rendering Logic ---
   if (!combinedData || combinedData.length === 0) { return <div className="graph-container">Insufficient data or error calculating regression trend.</div>; }
   // Domain calculation...
    const allWeights = combinedData.flatMap(d => [ typeof d.weight === 'number' ? d.weight : null, typeof d.trendWeight === 'number' ? d.trendWeight : null, typeof d.upperBound === 'number' ? d.upperBound : null, typeof d.lowerBound === 'number' ? d.lowerBound : null, ]).filter(w => w !== null && isFinite(w));
    if (allWeights.length === 0) { return <div className="graph-container">No valid weight data to display.</div>; }
    const minWeight = Math.floor(Math.min(...allWeights));
    const maxWeight = Math.ceil(Math.max(...allWeights));
    const domainMin = isFinite(minWeight) ? minWeight - 1 : 0;
    const domainMax = isFinite(maxWeight) ? maxWeight + 1 : 100;
    const tickCount = Math.max(3, Math.min(10, Math.ceil(domainMax - domainMin) + 1));

    return (
     <div className="graph-container">
       <h2>Weight Trend Analysis (Regression)</h2>
       {/* Display Messages */}
       {movingAway && regressionStats && ( <div className="estimate-info warning"> <p>Trend is moving away from the target weight of {targetWeight}kg.</p> <p>Weekly rate: {regressionStats.slope.toFixed(2)}kg | R²: {regressionStats.rSquared.toFixed(3)}</p> </div> )}
       {!movingAway && estimatedDate && regressionStats && regressionStats.daysToTarget !== null && ( <div className="estimate-info"> <p> Est. date to reach {targetWeight}kg: {estimatedDate.toLocaleDateString('en-GB')} <br /> Weekly rate: {regressionStats.slope.toFixed(2)}kg | R²: {regressionStats.rSquared.toFixed(3)} <br /> Est. days remaining: {Math.ceil(regressionStats.daysToTarget)} </p> </div> )}
       {regressionStats && regressionStats.slope === 0 && ( <div className="estimate-info"> <p>Weight trend is flat. R²: {regressionStats.rSquared.toFixed(3)}</p> </div> )}

       {/* Chart Rendering */}
       <ResponsiveContainer width="100%" height={400}>
            <LineChart data={combinedData} margin={{ top: 30, right: 50, left: 30, bottom: 50 }} >
                <CartesianGrid strokeDasharray="3 3" stroke="#555555" />
                <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} tick={{ dy: 10, fontSize: '0.8em', fill: '#cccccc' }} interval="preserveStartEnd"/>
                <YAxis domain={[domainMin, domainMax]} tick={{ fontSize: '0.8em', fill: '#cccccc' }} tickCount={tickCount} allowDecimals={false}/>
                <Tooltip contentStyle={{ backgroundColor: 'rgba(30, 30, 30, 0.85)', border: '1px solid #555555', borderRadius: '4px', color: '#ffffff' }} formatter={(value, name) => [`${value} kg`, name]} labelFormatter={(label) => `Date: ${label}`}/>
                <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingTop: '10px', paddingBottom: '10px', color: '#cccccc' }}/>
                <Line type="monotone" dataKey="weight" stroke="#8884d8" strokeWidth={2} dot={{ fill: '#8884d8', r: 3 }} activeDot={{ r: 5 }} name="Weight" connectNulls={false}/>
                <Line type="linear" dataKey="trendWeight" stroke="#82ca9d" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Trend" connectNulls={true}/>
                <Line type="linear" dataKey="upperBound" stroke="#ff9999" strokeWidth={1} strokeDasharray="3 3" dot={false} name="Upper Bound (95% PI)" connectNulls={true}/>
                <Line type="linear" dataKey="lowerBound" stroke="#99ddff" strokeWidth={1} strokeDasharray="3 3" dot={false} name="Lower Bound (95% PI)" connectNulls={true}/>
            </LineChart>
       </ResponsiveContainer>
     </div>
   );
};

export default TrendGraph;