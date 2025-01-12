import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import DataImporter from '../DataImporter/DataImporter';
import DataGraph from './DataGraph';
import TrendGraph from './TrendGraph';
import './WeightTracker.css';

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
  const [estimatedDate, setEstimatedDate] = useState(null);

  // Move filteredData declaration here
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
    // First process dates and sort
    const processedData = data
      .filter(row => row.date && row.weight)
      .map(row => ({
        ...row,
        date: new Date(row.date).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit'
        }),
        time: row.time.split(':').slice(0, 2).join(':'), // Format time as HH:mm
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

  const calculateTrendline = (data) => {
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
    
    // Calculate days until target weight
    const currentWeight = data[data.length - 1].weight;
    const targetWeight = 64;
    const daysToTarget = (targetWeight - currentWeight) / slope;
    
    const lastDate = new Date(data[data.length - 1].dateObj);
    const targetDate = new Date(lastDate.setDate(lastDate.getDate() + daysToTarget));
    
    return {
      targetDate,
      slope,
      intercept
    };
  };

  const processDataWithTrendline = (data) => {
    if (!data || data.length < 2) return data;

    const { targetDate, slope, intercept } = calculateTrendline(data);
    setEstimatedDate(targetDate);

    // Add 3 empty points between last real data and prediction
    const lastDate = new Date(data[data.length - 1].dateObj);
    const daysBetween = (targetDate - lastDate) / (4 * 86400000); // 4 segments

    const trendData = [...data];
    for (let i = 1; i <= 3; i++) {
      const emptyDate = new Date(lastDate.getTime() + (daysBetween * i * 86400000));
      trendData.push({
        date: emptyDate.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit'
        }),
        dateObj: emptyDate,
        isTrendpoint: true
      });
    }

    // Add target point
    trendData.push({
      date: targetDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit'
      }),
      dateObj: targetDate,
      weight: 64,
      isTrendpoint: true
    });

    return trendData;
  };

  const generateGraphs = () => {
    setShowGraphs(true);
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

  const trendlineData = useMemo(() => {
    if (!filteredData || filteredData.length < 2) return null;
    
    const { targetDate, slope, intercept } = calculateTrendline(filteredData);
    return { targetDate, slope, intercept };
  }, [filteredData]);

  useEffect(() => {
    if (trendlineData) {
      setEstimatedDate(trendlineData.targetDate);
    }
  }, [trendlineData]);

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
        <>
          <DataGraph data={filteredData} />
          <TrendGraph data={filteredData} />
        </>
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