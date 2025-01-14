import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import _ from 'lodash';

// T-distribution critical values for 95% confidence level
const T_TABLE = {
  1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
  6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
  15: 2.131, 20: 2.086, 30: 2.042, 60: 2.000, Infinity: 1.960
};

const calculateTValue = (degreesOfFreedom) => {
  const dfs = Object.keys(T_TABLE).map(Number);
  const closestDf = dfs.reduce((prev, curr) => 
    Math.abs(curr - degreesOfFreedom) < Math.abs(prev - degreesOfFreedom) ? curr : prev
  );
  return T_TABLE[closestDf];
};

const calculateLinearRegression = (data) => {
  if (!data || data.length < 2) return null;

  try {
    // Convert dates to days since first entry
    const firstDate = new Date(data[0].dateObj);
    const daysArray = data.map(point => {
      const currentDate = new Date(point.dateObj);
      return (currentDate - firstDate) / (24 * 60 * 60 * 1000);
    });

    const n = data.length;
    const weights = data.map(point => point.weight);

    // Check for data validity
    if (daysArray.some(isNaN) || weights.some(w => !isFinite(w))) {
      throw new Error('Invalid data points detected');
    }

    // Calculate means
    const xMean = _.mean(daysArray);
    const yMean = _.mean(weights);

    // Calculate regression parameters
    const sumXY = _.sum(daysArray.map((x, i) => (x - xMean) * (weights[i] - yMean)));
    const sumXX = _.sum(daysArray.map(x => Math.pow(x - xMean, 2)));

    if (sumXX === 0) {
      throw new Error('No variation in x values');
    }

    const slope = sumXY / sumXX;
    const intercept = yMean - (slope * xMean);

    // Calculate R-squared
    const predictions = daysArray.map(x => slope * x + intercept);
    const residuals = weights.map((y, i) => y - predictions[i]);
    const totalSS = _.sum(weights.map(y => Math.pow(y - yMean, 2)));
    const residualSS = _.sum(residuals.map(r => r * r));
    const rSquared = 1 - (residualSS / totalSS);

    return {
      slope,
      intercept,
      daysArray,
      firstDate,
      sumXX,
      xMean,
      residuals,
      rSquared,
      n
    };
  } catch (error) {
    console.error('Error in regression calculation:', error);
    return null;
  }
};

const calculateDeviationParams = (regression) => {
  if (!regression) return null;
  const { residuals, n } = regression;

  // Calculate standard error of regression
  const degreesOfFreedom = n - 2;
  const residualSS = _.sum(residuals.map(r => r * r));
  const standardError = Math.sqrt(residualSS / degreesOfFreedom);
  
  // Get t-value for confidence intervals
  const tValue = calculateTValue(degreesOfFreedom);

  return { standardError, tValue, degreesOfFreedom };
};

const TrendGraph = ({ data, targetWeight = 64 }) => {
  const { combinedData, estimatedDate, regressionStats } = useMemo(() => {
    if (!data || data.length < 2) {
      return { combinedData: [], estimatedDate: null, regressionStats: null };
    }

    // Calculate regression
    const regression = calculateLinearRegression(data);
    if (!regression) {
      return { combinedData: [], estimatedDate: null, regressionStats: null };
    }

    const { slope, intercept, daysArray, firstDate, sumXX, n, rSquared } = regression;
    const deviationParams = calculateDeviationParams(regression);
    if (!deviationParams) {
      return { combinedData: [], estimatedDate: null, regressionStats: null };
    }

    const { standardError, tValue } = deviationParams;

    // Start trends from last real point
    const lastPoint = data[data.length - 1];
    const lastWeight = lastPoint.weight;
    const lastDate = new Date(lastPoint.dateObj);

    // Calculate days until target
    const daysToTarget = (targetWeight - lastWeight) / slope;
    const targetDate = new Date(lastDate.getTime() + (daysToTarget * 24 * 60 * 60 * 1000));
    
    // Create future points for trend projection
    const futurePoints = [];
    const pointCount = 4;
    const dayInterval = Math.abs(daysToTarget / pointCount);
    const weeksInterval = Math.round(dayInterval / 7);

    for (let i = 1; i <= pointCount; i++) {
      const futureDate = new Date(lastDate.getTime() + (i * dayInterval * 24 * 60 * 60 * 1000));
      const daysFromStart = (futureDate - firstDate) / (24 * 60 * 60 * 1000);
      const projectedWeight = Number((lastWeight + (slope * i * dayInterval)).toFixed(1));

      // Calculate prediction interval
      const xDiff = daysFromStart - _.mean(daysArray);
      const predictionVariance = Math.pow(standardError, 2) * (
        1 + 1/n + Math.pow(xDiff, 2)/(n * sumXX)
      );
      const predictionInterval = tValue * Math.sqrt(predictionVariance);

      futurePoints.push({
        date: i === pointCount ? 
          futureDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }) :
          `+${i * weeksInterval}w`,
        dateObj: futureDate,
        weight: null,
        trendWeight: projectedWeight,
        upperBound: Number((projectedWeight + predictionInterval).toFixed(1)),
        lowerBound: Number((projectedWeight - predictionInterval).toFixed(1)),
        isTrendpoint: true
      });
    }

    // Combine historical data with projections
    const combinedData = [
      ...data.map(d => ({
        ...d,
        weight: Number(d.weight.toFixed(1)),
        trendWeight: d === lastPoint ? Number(d.weight.toFixed(1)) : null,
        upperBound: d === lastPoint ? Number(d.weight.toFixed(1)) : null,
        lowerBound: d === lastPoint ? Number(d.weight.toFixed(1)) : null
      })),
      ...futurePoints
    ];

    return { 
      combinedData, 
      estimatedDate: targetDate,
      regressionStats: {
        rSquared,
        slope: slope * 7, // Convert to weekly rate
        daysToTarget: Math.abs(daysToTarget)
      }
    };
  }, [data, targetWeight]);

  if (!combinedData.length) {
    return <div>Insufficient data for trend analysis</div>;
  }

  // Calculate y-axis domain
  const allWeights = combinedData.flatMap(d => [
    d.weight,
    d.trendWeight,
    d.upperBound,
    d.lowerBound
  ]).filter(Boolean);
  
  const minWeight = Math.floor(Math.min(...allWeights));
  const maxWeight = Math.ceil(Math.max(...allWeights));
  const padding = 1; // 1kg padding

  return (
    <div className="graph-container">
      <h2>Weight Trend Analysis</h2>
      {estimatedDate && regressionStats && (
        <div className="estimate-info">
          <p>
            Estimated date to reach {targetWeight}kg: {estimatedDate.toLocaleDateString('en-GB')}
            <br />
            Weekly rate of change: {regressionStats.slope.toFixed(2)}kg
            <br />
            Estimated days remaining: {Math.ceil(regressionStats.daysToTarget)}
            <br />
            R² (model fit): {regressionStats.rSquared.toFixed(3)}
          </p>
        </div>
      )}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart 
          data={combinedData} 
          margin={{ top: 30, right: 50, left: 30, bottom: 50 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
          <XAxis
            dataKey="date"
            angle={-45}
            textAnchor="end"
            height={60}
            tick={{ dy: 30, fill: '#ffffff' }}
          />
          <YAxis
            domain={[minWeight - padding, maxWeight + padding]}
            tick={{ fill: '#ffffff' }}
            tickCount={maxWeight - minWeight + 3}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#333333',
              border: 'none',
              borderRadius: '4px',
              color: '#ffffff'
            }}
          />
          <Legend 
            verticalAlign="top" 
            height={36}
            wrapperStyle={{
              paddingTop: '10px',
              paddingBottom: '10px',
              color: '#ffffff'
            }}
          />
          {/* Actual weight line */}
          <Line
            type="monotone"
            dataKey="weight"
            stroke="#8884d8"
            strokeWidth={2}
            dot={{ fill: '#8884d8' }}
            name="Weight"
            connectNulls={false}
          />
          {/* Trend line */}
          <Line
            type="monotone"
            dataKey="trendWeight"
            stroke="#82ca9d"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="Trend"
            connectNulls={true}
          />
          {/* Prediction intervals */}
          <Line
            type="monotone"
            dataKey="upperBound"
            stroke="#ff9999"
            strokeWidth={1}
            strokeDasharray="3 3"
            dot={false}
            name="Upper Bound"
            connectNulls={true}
          />
          <Line
            type="monotone"
            dataKey="lowerBound"
            stroke="#99ff99"
            strokeWidth={1}
            strokeDasharray="3 3"
            dot={false}
            name="Lower Bound"
            connectNulls={true}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendGraph;