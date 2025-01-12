import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const TrendGraph = ({ data }) => {
  const { combinedData, estimatedDate } = useMemo(() => {
    if (!data || data.length < 2) return { combinedData: [], estimatedDate: null };

    // Calculate main trend
    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    data.forEach((point, index) => {
      const x = index;
      const y = point.weight;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate standard deviation from trend line
    const residuals = data.map((point, index) => {
      const predicted = slope * index + intercept;
      return point.weight - predicted;
    });
    
    const variance = residuals.reduce((sum, r) => sum + r * r, 0) / (n - 2);
    const stdDev = Math.sqrt(variance);

    // Start trends from last real point
    const lastPoint = data[data.length - 1];
    const lastWeight = lastPoint.weight;
    const targetWeight = 64;
    
    const daysToTarget = Math.abs((targetWeight - lastWeight) / slope);
    const lastDate = new Date(lastPoint.dateObj);
    const targetDate = new Date(lastDate.getTime() + (daysToTarget * 24 * 60 * 60 * 1000));

    // Create future points with bounds
    const futurePoints = [];
    const pointCount = 4;
    const dayInterval = daysToTarget / pointCount;
    const weeksInterval = Math.round(dayInterval / 7);

    for (let i = 1; i <= pointCount; i++) {
      const futureDate = new Date(lastDate.getTime() + (i * dayInterval * 24 * 60 * 60 * 1000));
      const projectedWeight = lastWeight + (slope * i * dayInterval);
      const deviation = stdDev * Math.sqrt(1 + 1/n + Math.pow(i - n/2, 2)/(n * sumXX));
      
      futurePoints.push({
        date: i === pointCount ? 
          futureDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }) :
          `+${i * weeksInterval}w`,
        dateObj: futureDate,
        weight: null,
        trendWeight: projectedWeight,
        upperBound: projectedWeight + 2 * deviation,
        lowerBound: projectedWeight - 2 * deviation,
        isTrendpoint: true
      });
    }

    const combinedData = [
      ...data.map(d => ({
        ...d,
        trendWeight: d === lastPoint ? d.weight : null,
        upperBound: d === lastPoint ? d.weight : null,
        lowerBound: d === lastPoint ? d.weight : null
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