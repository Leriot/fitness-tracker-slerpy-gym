import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const calculateConfidenceMultiplier = (sampleSize) => {
  // Base multiplier of 2 (95% confidence interval)
  // Adjust based on sample size
  if (sampleSize < 5) return 4.0;      // Very small dataset
  if (sampleSize < 10) return 3.0;     // Small dataset
  if (sampleSize < 20) return 2.5;     // Medium dataset
  if (sampleSize < 30) return 2.0;     // Large dataset
  return 1.8;                          // Very large dataset
};

const calculateLinearRegression = (data) => {
  const n = data.length;
  if (n < 2) return null;

  // Convert dates to days since first entry
  const firstDate = new Date(data[0].dateObj);
  const daysArray = data.map(point => {
    const currentDate = new Date(point.dateObj);
    return (currentDate - firstDate) / (24 * 60 * 60 * 1000); // Convert to days
  });

  // Calculate means using actual days
  const xMean = daysArray.reduce((sum, days) => sum + days, 0) / n;
  const yMean = data.reduce((sum, point) => sum + point.weight, 0) / n;

  // Calculate sums for least squares using actual time intervals
  let sumXY = 0, sumXX = 0;
  data.forEach((point, index) => {
    const xDiff = daysArray[index] - xMean;
    const yDiff = point.weight - yMean;
    sumXY += xDiff * yDiff;
    sumXX += xDiff * xDiff;
  });

  // Prevent division by zero
  if (sumXX === 0) return null;

  // Calculate slope (weight change per day) and intercept
  const slope = sumXY / sumXX;
  const intercept = yMean - (slope * xMean);

  return { 
    slope, 
    intercept,
    daysArray,
    firstDate,
    sumXX,
    xMean 
  };
};

const calculateDeviationParams = (data, regression) => {
  const { slope, intercept, daysArray, xMean } = regression;
  const n = data.length;

  // Calculate residuals using actual days
  const residuals = data.map((point, index) => {
    const predicted = slope * daysArray[index] + intercept;
    return point.weight - predicted;
  });
  
  const variance = residuals.reduce((sum, r) => sum + r * r, 0) / (n - 2);
  const stdDev = Math.sqrt(variance);

  return { n, stdDev };
};

const TrendGraph = ({ data }) => {
  const { combinedData, estimatedDate } = useMemo(() => {
    if (!data || data.length < 2) return { combinedData: [], estimatedDate: null };

    const regression = calculateLinearRegression(data);
    if (!regression) return { combinedData: [], estimatedDate: null };

    const { slope, intercept, daysArray, firstDate, sumXX, xMean } = regression;
    const { n, stdDev } = calculateDeviationParams(data, regression);
    const confidenceMultiplier = calculateConfidenceMultiplier(n);

    // Start trends from last real point
    const lastPoint = data[data.length - 1];
    const lastWeight = lastPoint.weight;
    const targetWeight = 64;
    const lastDate = new Date(lastPoint.dateObj);
    
    // Calculate days until target based on trend line
    const daysToTarget = Math.abs((targetWeight - lastWeight) / slope);
    const targetDate = new Date(lastDate.getTime() + (daysToTarget * 24 * 60 * 60 * 1000));

    // Create future points
    const futurePoints = [];
    const pointCount = 4;
    const dayInterval = daysToTarget / pointCount;
    const weeksInterval = Math.round(dayInterval / 7);

    for (let i = 1; i <= pointCount; i++) {
      const futureDate = new Date(lastDate.getTime() + (i * dayInterval * 24 * 60 * 60 * 1000));
      const projectedWeight = Number((lastWeight + (slope * i * dayInterval)).toFixed(1));
      const timeUncertainty = 1 + (i / pointCount) * 0.5;
      const deviation = stdDev * Math.sqrt(1 + 1/n + Math.pow(i * dayInterval - n/2, 2)/(n * sumXX)) * timeUncertainty;
      
      futurePoints.push({
        date: i === pointCount ? 
          futureDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }) :
          `+${i * weeksInterval}w`,
        dateObj: futureDate,
        weight: null,
        trendWeight: projectedWeight,
        upperBound: Number((projectedWeight + confidenceMultiplier * deviation).toFixed(1)),
        lowerBound: Number((projectedWeight - confidenceMultiplier * deviation).toFixed(1)),
        isTrendpoint: true
      });
    }

    // Ensure last point hits target weight
    if (futurePoints.length > 0) {
      futurePoints[futurePoints.length - 1].trendWeight = targetWeight;
    }

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

    return { combinedData, estimatedDate: targetDate };
  }, [data]);

  return (
    <div className="graph-container">
      <h2>Weight Trend Analysis</h2>
      {estimatedDate && (
        <div className="estimate-info">
          Estimated date to reach 64kg: {estimatedDate.toLocaleDateString('en-GB')}
        </div>
      )}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={combinedData} margin={{ top: 30, right: 50, left: 30, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
          <XAxis
            dataKey="date"
            angle={-45}
            textAnchor="end"
            height={60}
            tick={{ dy: 30, fill: '#ffffff' }}
          />
          <YAxis
            domain={[60, 80]}
            tick={{ fill: '#ffffff' }}
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
          <Line
            type="monotone"
            dataKey="weight"
            stroke="#8884d8"
            strokeWidth={2}
            dot={{ fill: '#8884d8' }}
            name="Weight"
            connectNulls={false}
          />
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