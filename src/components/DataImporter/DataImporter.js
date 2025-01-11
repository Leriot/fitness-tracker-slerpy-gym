import React, { useState } from 'react';
import Papa from 'papaparse';
import './DataImporter.css';

const PREDEFINED_SOURCES = {
  lerito: {
    name: "Lerito",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vThTzKmTRk3F8icHWCdKa4sBRyBR1yixAt8lfgxoU6YJYCgxvmDCZc3oqdJjM7e3kyUU0TGKofPMAb1/pub?output=csv"
  }
};

const DataImporter = ({ onDataLoaded, onError }) => {
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [loadedSource, setLoadedSource] = useState(null);
  const [error, setError] = useState(null);

  const clearData = () => {
    setGoogleSheetsUrl('');
    setLoadedSource(null);
    setError(null);
    onDataLoaded(null);
  };

  const processCSV = (results) => {
    if (results.errors.length > 0) {
      const error = 'Error parsing CSV';
      setError(error);
      onError(error);
      return;
    }

    // Validate required columns
    const hasRequiredColumns = results.data.every(row => 
      row.date && 
      row.time && 
      row.weight && 
      row.fat_percentage && 
      row.bmi
    );

    if (!hasRequiredColumns) {
      const error = 'CSV must have date, time, weight, fat_percentage, and bmi columns';
      setError(error);
      onError(error);
      return;
    }

    // Process data with new time column
    const processedData = results.data.map(row => ({
      ...row,
      date: row.date,
      time: row.time,
      weight: Number(row.weight),
      fat_percentage: Number(row.fat_percentage),
      bmi: Number(row.bmi),
      source: row.source || 'unknown'
    }));

    onDataLoaded(processedData);
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
          setLoadedSource(source.name);
          processCSV(results);
        }
      });
    } catch (err) {
      const errorMsg = 'Error loading CSV: ' + err.message;
      setError(errorMsg);
      onError(errorMsg);
    }
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(googleSheetsUrl);
      if (!response.ok) throw new Error('Failed to fetch CSV');
      
      const csvText = await response.text();
      Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        complete: processCSV
      });
    } catch (err) {
      const errorMsg = 'Error loading CSV: ' + err.message;
      setError(errorMsg);
      onError(errorMsg);
    }
  };

  return (
    <div className="data-importer">
      {!loadedSource ? (
        <>
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
        </>
      ) : (
        <button onClick={clearData} className="clear-button">
          Clear Data ({loadedSource})
        </button>
      )}
      
      {error && <p className="error-message">{error}</p>}
    </div>
  );
};

export default DataImporter;