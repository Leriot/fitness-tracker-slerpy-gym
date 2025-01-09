import React, { useState } from 'react';
import Papa from 'papaparse';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './App.css'; // Import the CSS file for dark mode

const App = () => {
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [fitnessData, setFitnessData] = useState([]);
  const [error, setError] = useState('');
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

  const processCSV = (results) => {
    try {
      const hasAllColumns = results.data.every(row => row.date && row.weight && row.fat_percentage && row.bmi);
      if (!hasAllColumns) {
        setError('CSV is missing required columns');
        return;
      }

      const processedData = results.data
        .filter(row => row.date && row.weight)
        .map(row => ({
          ...row,
          date: new Date(row.date).toLocaleDateString(), // Convert to readable date string
          dateObj: new Date(row.date) // Keep original date for sorting
        }))
        .sort((a, b) => a.dateObj - b.dateObj);

      if (normalize) {
        const earliest = processedData[0];
        processedData.forEach(row => {
          row.weight = (row.weight / earliest.weight) * 100;
          row.fat_percentage = (row.fat_percentage / earliest.fat_percentage) * 100;
          row.bmi = (row.bmi / earliest.bmi) * 100;
        });
      }

      setFitnessData(processedData);
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
    setNormalize(prevNormalize => !prevNormalize);
  };

  const filteredData = selectedSource === 'both' 
    ? fitnessData 
    : fitnessData.filter(data => data.source === selectedSource);

  return (
    <div className="App dark-mode">
      <h1>Fitness Progress Tracker</h1>
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
      
      {fitnessData.length > 0 && (
        <div className="data-preview">
          <h2>Loaded Data Preview</h2>
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

      {showGraphs && fitnessData.length > 0 && (
        <div className="graphs-container">
          <h2>Fitness Progress Graphs</h2>
          
          <button onClick={handleToggle}>
            Toggle Source (Current: {selectedSource})
          </button>

          {/* Weight Graph */}
          <div className="graph">
            <h3>Weight Progression</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="weight" 
                  stroke="#8884d8" 
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Fat Percentage Graph */}
          <div className="graph">
            <h3>Fat Percentage Progression</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="fat_percentage" 
                  stroke="#82ca9d" 
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* BMI Graph */}
          <div className="graph">
            <h3>BMI Progression</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="bmi" 
                  stroke="#ffc658" 
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;