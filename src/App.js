import React, { useState } from 'react';
import Papa from 'papaparse';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './App.css'; // Import the CSS file for dark mode

const PREDEFINED_SOURCES = {
  lerito: {
    name: "Lerito",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vThTzKmTRk3F8icHWCdKa4sBRyBR1yixAt8lfgxoU6YJYCgxvmDCZc3oqdJjM7e3kyUU0TGKofPMAb1/pub?output=csv"
  }
  // Add more sources here as needed
};

const App = () => {
  // Add new state for original data
  const [originalData, setOriginalData] = useState([]);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [fitnessData, setFitnessData] = useState([]);
  const [error, setError] = useState(null);
  const [showGraphs, setShowGraphs] = useState(false);
  const [selectedSource, setSelectedSource] = useState('both');
  const [normalize, setNormalize] = useState(false);
  const [availableSources, setAvailableSources] = useState([]);
  const [selectedSources, setSelectedSources] = useState(new Set());
  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState(false);
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [loadedSource, setLoadedSource] = useState(null);

  const clearData = () => {
    setOriginalData([]);
    setFitnessData([]);
    setShowGraphs(false);
    setError(null);
    setLoadedSource(null);
    setGoogleSheetsUrl('');
  };

  const loadPredefinedSource = async (sourceKey) => {
    const source = PREDEFINED_SOURCES[sourceKey];
    if (!source) return;
    
    try {
      const response = await fetch(source.url);
      if (!response.ok) throw new Error('Failed to fetch CSV');
      
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
          setLoadedSource(source.name);
          processCSV(results);
        }
      });
    } catch (err) {
      setError('Error loading CSV: ' + err.message);
      console.error(err);
    }
  };

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

  const processDataWithNormalization = (data, shouldNormalize, activeData) => {
    // First process dates and sort
    const processedData = data
      .filter(row => row.date && row.weight)
      .map(row => ({
        ...row,
        date: new Date(row.date).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit'
        }),
        dateObj: new Date(row.date)
      }))
      .sort((a, b) => a.dateObj - b.dateObj);

    if (shouldNormalize && activeData && activeData.length > 0) {
      // Use first entry of currently displayed data as baseline
      const earliest = activeData[0];
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
      
      // Extract unique sources
      const sources = [...new Set(results.data.map(row => row.source))];
      setAvailableSources(sources);
      setSelectedSources(new Set(sources)); // Initially select all sources
      
      const filtered = results.data;  // Initially all data is filtered
      const processed = processDataWithNormalization(results.data, normalize, filtered);
      setOriginalData(results.data);
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

  const handleSourceToggle = (source) => {
    const newSources = new Set(selectedSources);
    if (newSources.has(source)) {
      newSources.delete(source);
    } else {
      newSources.add(source);
    }
    
    // Filter data with new sources before processing
    const filtered = originalData.filter(data => 
      newSources.has(data.source)
    );
    const processed = processDataWithNormalization(originalData, normalize, filtered);
    
    setSelectedSources(newSources);
    setFitnessData(processed);
  };

  const handleNormalizeToggle = () => {
    const newNormalize = !normalize;
    const filtered = originalData.filter(data => 
      selectedSources.has(data.source)
    );
    const processed = processDataWithNormalization(originalData, newNormalize, filtered);
    
    setNormalize(newNormalize);
    setFitnessData(processed);
  };

  const filteredData = fitnessData.filter(data => 
    selectedSources.has(data.source)
  );

  return (
    <div className="App dark-mode">
      <h1>Weight Data Tracker</h1>
      
      {!fitnessData.length > 0 ? (
        <div className="data-source-selection">
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
          
          <div className="predefined-sources">
            {Object.entries(PREDEFINED_SOURCES).map(([key, source]) => (
              <button
                key={key}
                onClick={() => loadPredefinedSource(key)}
                className="source-button"
              >
                {source.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="data-actions">
          <button onClick={clearData} className="clear-button">
            Clear Data {loadedSource ? `(${loadedSource})` : ''}
          </button>
          <button 
            className="generate-graphs-button" 
            onClick={generateGraphs}
          >
            Generate Graphs
          </button>
          <div className="source-selector">
            <button 
              onClick={() => setIsSourceMenuOpen(!isSourceMenuOpen)}
              className="source-menu-button"
            >
              Data Sources ▼
            </button>
            {isSourceMenuOpen && (
              <div className="source-menu">
                {availableSources.map(source => (
                  <label key={source} className="source-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedSources.has(source)}
                      onChange={() => handleSourceToggle(source)}
                    />
                    {source}
                  </label>
                ))}
              </div>
            )}
          </div>
          <button onClick={handleNormalizeToggle}>
            {normalize ? 'Disable Normalization' : 'Enable Normalization'}
          </button>
        </div>
      )}
      
      {error && <p className="error-message">{error}</p>}
      
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
      )}
      
      {/* Table moved below graph */}
      {fitnessData.length > 0 && (
        <div className="data-preview">
          <div className="table-header">
            <h2>Loaded Data Table Preview</h2>
            <button 
              onClick={() => setIsTableExpanded(!isTableExpanded)}
              className="table-toggle"
            >
              {isTableExpanded ? 'Show Less ▲' : 'Show More ▼'}
            </button>
          </div>
          {!isTableExpanded && filteredData.length > 1 && (
            <div className="table-notice">
              Showing most recent entry only. Click 'Show More' to see all {filteredData.length} entries.
            </div>
          )}
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
              {(isTableExpanded ? [...filteredData].reverse() : [filteredData[filteredData.length - 1]]).map((entry, index) => (
                <tr key={index}>
                  <td>{entry.date}</td>
                  <td>{entry.weight}</td>
                  <td>{entry.fat_percentage}</td>
                  <td>{entry.bmi}</td>
                  <td>{entry.source}</td>
                </tr>
              ))}
              {!isTableExpanded && filteredData.length > 1 && (
                <tr className="table-indicator">
                  <td colSpan="5">...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default App;