import React, { useState } from 'react';
import Papa from 'papaparse';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './App.css'; // Import the CSS file for dark mode

const App = () => {
  // Add new state for original data
  const [originalData, setOriginalData] = useState([]);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [fitnessData, setFitnessData] = useState([]);
  const [error, setError] = useState(null);
  const [showGraphs, setShowGraphs] = useState(false);
  const [selectedSource, setSelectedSource] = useState('xiaomi');
  const [normalize, setNormalize] = useState(false);

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch(googleSheetsUrl);
      
      if (!response.ok) {
        throw new Error('Failed to fetch CSV');
      }

      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            setError('Error parsing CSV');
            console.error(results.errors);
            return;
          }

          processCSV(results);
        }
      });
    } catch (err) {
      setError('Error loading CSV: ' + err.message);
      console.error(err);
    }
  };

  const processDataWithNormalization = (data, shouldNormalize) => {
    const processedData = data
      .filter(row => row.date && row.weight)
      .map(row => ({
        ...row,
        date: new Date(row.date).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit'
        }), // Format as DD/MM
        dateObj: new Date(row.date)
      }))
      .sort((a, b) => a.dateObj - b.dateObj);

    if (shouldNormalize) {
      const earliest = processedData[0];
      return processedData.map(row => ({
        ...row,
        weight: Number((row.weight / earliest.weight * 100).toFixed(1)),
        fat_percentage: Number((row.fat_percentage / earliest.fat_percentage * 100).toFixed(1)),
        bmi: Number((row.bmi / earliest.bmi * 100).toFixed(1))
      }));
    }
    return processedData;
  };

  const processCSV = (results) => {
    try {
      const hasAllColumns = results.data.every(row => 
        row.date && row.weight && row.fat_percentage && row.bmi
      );
      if (!hasAllColumns) {
        setError('CSV is missing required columns');
        return;
      }
      
      const processed = processDataWithNormalization(results.data, normalize);
      setOriginalData(results.data); // Store original data
      setFitnessData(processed);
      setShowGraphs(false);
    } catch (err) {
      setError('Error loading CSV: ' + err.message);
      console.error(err);
    }
  };

  const generateGraphs = () => {
    setShowGraphs(true);
  };

  const handleToggle = () => {
    setSelectedSource(prevSource => {
      if (prevSource === 'xiaomi') return 'inbody';
      if (prevSource === 'inbody') return 'both';
      return 'xiaomi';
    });
  };

  const handleNormalizeToggle = () => {
    setNormalize(prev => !prev);
    if (originalData.length > 0) {
      const processed = processDataWithNormalization(originalData, !normalize);
      setFitnessData(processed);
    }
  };

  const filteredData = selectedSource === 'both' 
    ? fitnessData 
    : fitnessData.filter(data => data.source === selectedSource);

  return (
    <div className="App dark-mode">
      <h1>Fitness Progress Tracker</h1>
      
      {/* Form and buttons remain at top */}
      <form onSubmit={handleUrlSubmit} className="csv-uploader">
        <input 
          type="text" 
          value={googleSheetsUrl}
          onChange={(e) => setGoogleSheetsUrl(e.target.value)}
          placeholder="Enter Google Sheets Published CSV URL"
          className="url-input"
        />
        <button type="submit" className="submit-button">
          Load CSV
        </button>
      </form>
      
      {error && <p className="error-message">{error}</p>}
      
      {fitnessData.length > 0 && (
        <div className="data-actions">
          <button 
            className="generate-graphs-button" 
            onClick={generateGraphs}
          >
            Generate Graphs
          </button>
          <button onClick={handleToggle}>
            Toggle Source (Current: {selectedSource})
          </button>
          <button onClick={handleNormalizeToggle}>
            {normalize ? 'Disable Normalization' : 'Enable Normalization'}
          </button>
        </div>
      )}
      
      {/* Graph moved above table */}
      {showGraphs && (
        <div className="graph-container">
          <h2>Data Preview</h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={filteredData}
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
              {/* Left Y-axis for Weight */}
              <YAxis
                yAxisId="weight"
                orientation="left"
                stroke="#8884d8"
                tick={{ fill: '#ffffff' }}
              />
              {/* Right Y-axis for BMI and Fat % */}
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
              <Legend wrapperStyle={{ color: '#ffffff' }}/>
              <Line
                yAxisId="weight"
                type="monotone"
                dataKey="weight"
                stroke="#8884d8"
                strokeWidth={2}
                dot={{ fill: '#8884d8' }}
              />
              <Line
                yAxisId="metrics"
                type="monotone"
                dataKey="fat_percentage"
                stroke="#82ca9d"
                strokeWidth={2}
                dot={{ fill: '#82ca9d' }}
              />
              <Line
                yAxisId="metrics"
                type="monotone"
                dataKey="bmi"
                stroke="#ffc658"
                strokeWidth={2}
                dot={{ fill: '#ffc658' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      
      {/* Table moved below graph */}
      {fitnessData.length > 0 && (
        <div className="data-preview">
          <h2>Loaded Data Table Preview</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Weight</th>
                <th>Fat %</th>
                <th>BMI</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((entry, index) => (
                <tr key={index}>
                  <td>{entry.date}</td>
                  <td>{entry.weight}</td>
                  <td>{entry.fat_percentage}</td>
                  <td>{entry.bmi}</td>
                  <td>{entry.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default App;