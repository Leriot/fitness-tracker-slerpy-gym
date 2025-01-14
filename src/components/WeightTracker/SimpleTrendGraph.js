import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SimpleTrendGraph = ({ data, targetWeight = 64 }) => {
  const { combinedData, estimatedDate, trendStats } = useMemo(() => {
    if (!data || data.length < 2) return { combinedData: [], estimatedDate: null, trendStats: null };

    // Get first and last points
    const firstPoint = data[0];
    const lastPoint = data[data.length - 1];
    
    // Calculate total days between first and last measurement
    const totalDays = (lastPoint.dateObj - firstPoint.dateObj) / (24 * 60 * 60 * 1000);
    
    // Calculate weight change per day
    const totalWeightChange = lastPoint.weight - firstPoint.weight;
    const weightChangePerDay = totalWeightChange / totalDays;
    
    // Calculate days until target based on current rate
    const weightToLose = lastPoint.weight - targetWeight;
    const daysToTarget = Math.abs(weightToLose / weightChangePerDay);
    
    // Calculate estimated target date
    const targetDate = new Date(lastPoint.dateObj.getTime() + (daysToTarget * 24 * 60 * 60 * 1000));
    
    // Create future points for visualization
    const futurePoints = [];
    const pointCount = 3; // Number of points to show in projection
    const dayInterval = daysToTarget / pointCount;
    const weeksInterval = Math.round(dayInterval / 7);
    
    for (let i = 1; i <= pointCount; i++) {
      const futureDate = new Date(lastPoint.dateObj.getTime() + (i * dayInterval * 24 * 60 * 60 * 1000));
      const projectedWeight = Number((lastPoint.weight + (weightChangePerDay * i * dayInterval)).toFixed(1));
      
      futurePoints.push({
        date: i === pointCount ? 
          futureDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }) :
          `+${i * weeksInterval}w`,
        dateObj: futureDate,
        weight: null,
        trendWeight: projectedWeight,
        isTrendpoint: true
      });
    }

    // Ensure last point hits target weight
    if (futurePoints.length > 0) {
      futurePoints[futurePoints.length - 1].trendWeight = targetWeight;
    }

    // Combine historical data with projections
    const combinedData = [
      ...data.map(d => ({
        ...d,
        weight: Number(d.weight.toFixed(1)),
        trendWeight: d === lastPoint ? Number(d.weight.toFixed(1)) : null
      })),
      ...futurePoints
    ];

    return { 
      combinedData, 
      estimatedDate: targetDate,
      trendStats: {
        weeklyRate: weightChangePerDay * 7,
        daysRemaining: daysToTarget
      }
    };
  }, [data, targetWeight]);

  if (!combinedData.length) {
    return <div>Insufficient data for trend analysis</div>;
  }

  // Calculate y-axis domain
  const allWeights = combinedData.flatMap(d => [
    d.weight, 
    d.trendWeight
  ]).filter(Boolean);

  const minWeight = Math.floor(Math.min(...allWeights));
  const maxWeight = Math.ceil(Math.max(...allWeights));
  const padding = 1; // 1kg padding

  return (
    <div className="graph-container">
      <h2>Simple Weight Trend Analysis</h2>
      {estimatedDate && (
        <div className="estimate-info">
          <p>
            Estimated date to reach {targetWeight}kg: {estimatedDate.toLocaleDateString('en-GB')}
            <br />
            Weekly rate of change: {trendStats.weeklyRate.toFixed(2)}kg
            <br />
            Estimated days remaining: {Math.ceil(trendStats.daysRemaining)}
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
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SimpleTrendGraph;