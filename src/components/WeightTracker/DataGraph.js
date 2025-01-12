import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const DataGraph = ({ data }) => {
  return (
    <div className="graph-container">
      <h2>Data Preview</h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={data}
          margin={{
            top: 20,
            right: 50,
            left: 30,
            bottom: 50
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
          <XAxis
            dataKey="date"
            angle={-90}
            textAnchor="end"
            height={60}
            tick={{ dy: 30, fill: '#ffffff' }}
          />
          <YAxis
            yAxisId="weight"
            orientation="left"
            stroke="#8884d8"
            tick={{ fill: '#ffffff' }}
          />
          <YAxis
            yAxisId="metrics"
            orientation="right"
            domain={[10, 30]}
            stroke="#82ca9d"
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
              color: '#ffffff',
              paddingTop: '10px'
            }}
          />
          <Line
            yAxisId="weight"
            type="monotone"
            dataKey="weight"
            stroke="#8884d8"
            strokeWidth={2}
            dot={{ fill: '#8884d8' }}
            name="Weight"
          />
          <Line
            yAxisId="metrics"
            type="monotone"
            dataKey="fat_percentage"
            stroke="#82ca9d"
            strokeWidth={2}
            dot={{ fill: '#82ca9d' }}
            name="Body Fat %"
          />
          <Line
            yAxisId="metrics"
            type="monotone"
            dataKey="bmi"
            stroke="#ffc658"
            strokeWidth={2}
            dot={{ fill: '#ffc658' }}
            name="BMI"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DataGraph;