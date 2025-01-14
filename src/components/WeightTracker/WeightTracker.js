import React, { useState, useEffect } from 'react';
import DataImporter from '../DataImporter/DataImporter';
import DataGraph from './DataGraph';
import TrendGraph from './TrendGraph';
import SimpleTrendGraph from './SimpleTrendGraph';

const WeightTracker = () => {
  const [originalData, setOriginalData] = useState([]);
  const [fitnessData, setFitnessData] = useState([]);
  const [showGraphs, setShowGraphs] = useState(false);
  const [normalize, setNormalize] = useState(false);
  const [availableSources, setAvailableSources] = useState([]);
  const [selectedSources, setSelectedSources] = useState(new Set());
  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState(false);
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [error, setError] = useState(null);

  const filteredData = fitnessData.filter(data => 
    selectedSources.has(data.source)
  );

  const handleDataLoaded = (data) => {
    if (!data) {
      setOriginalData([]);
      setFitnessData([]);
      setShowGraphs(false);
      return;
    }
    
    const sources = [...new Set(data.map(row => row.source))];
    setAvailableSources(sources);
    setSelectedSources(new Set(sources));
    
    const processed = processDataWithNormalization(data, normalize);
    setOriginalData(data);
    setFitnessData(processed);
  };

  const processDataWithNormalization = (data, shouldNormalize, activeData) => {
    const processedData = data
      .filter(row => row.date && row.weight)
      .map(row => ({
        ...row,
        date: new Date(row.date).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit'
        }),
        time: row.time.split(':').slice(0, 2).join(':'),
        dateObj: new Date(row.date)
      }))
      .sort((a, b) => a.dateObj - b.dateObj);

    if (shouldNormalize && activeData && activeData.length > 0) {
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

  const handleSourceToggle = (source) => {
    setSelectedSources(prev => {
      const newSources = new Set(prev);
      if (newSources.has(source)) {
        newSources.delete(source);
      } else {
        newSources.add(source);
      }
      return newSources;
    });
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

  useEffect(() => {
    if (originalData.length > 0) {
      const filtered = originalData.filter(data => 
        selectedSources.has(data.source)
      );
      const processed = processDataWithNormalization(originalData, normalize, filtered);
      setFitnessData(processed);
    }
  }, [originalData, selectedSources, normalize]);

  return (
    <div className="weight-tracker">
      <h1>Weight Data Tracker</h1>
      
      {!fitnessData.length > 0 ? (
        <div className="data-source-selection">
          <DataImporter onDataLoaded={handleDataLoaded} />
        </div>
      ) : (
        <div className="data-actions">
          <button onClick={() => handleDataLoaded(null)} className="clear-button">
            Clear Data
          </button>
          <button 
            className="generate-graphs-button" 
            onClick={() => setShowGraphs(true)}
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
        <>
          <DataGraph data={filteredData} />
          <TrendGraph data={filteredData} targetWeight={64} />
          <SimpleTrendGraph data={filteredData} targetWeight={64} />
        </>
      )}
      
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
                <th>Time</th>
                <th>Weight</th>
                <th>Fat %</th>
                <th>BMI</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {(isTableExpanded ? [...filteredData].reverse() : filteredData.length ? [filteredData[filteredData.length - 1]] : []).map((entry, index) => (
                <tr key={index}>
                  <td>{entry.date}</td>
                  <td>{entry.time}</td>
                  <td>{entry.weight}</td>
                  <td>{entry.fat_percentage}</td>
                  <td>{entry.bmi}</td>
                  <td>{entry.source}</td>
                </tr>
              ))}
              {!isTableExpanded && filteredData.length > 1 && (
                <tr className="table-indicator">
                  <td colSpan="6">...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default WeightTracker;