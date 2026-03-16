import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

const PREDEFINED_SOURCES = {
  lerito: {
    name: "Lerito",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vThTzKmTRk3F8icHWCdKa4sBRyBR1yixAt8lfgxoU6YJYCgxvmDCZc3oqdJjM7e3kyUU0TGKofPMAb1/pub?output=csv"
  }
};

// Only 'date' and 'weight' are required; all other columns are optional
const REQUIRED_HEADERS = ['date', 'weight'];

const DataImporter = ({ onDataLoaded, onError }) => {
  const [loadedSource, setLoadedSource] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadPredefinedSource('lerito');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const processCSV = (results, sourceName) => {
    if (results.errors && results.errors.length > 0) {
      console.error('CSV Parsing Errors:', results.errors);
      const errorMsg = `Error parsing CSV data from ${sourceName}.`;
      setError(errorMsg); onError(errorMsg); setLoadedSource(null); onDataLoaded(null);
      return;
    }

    if (!results.data || !Array.isArray(results.data) || results.data.length === 0) {
      const errorMsg = `No valid data rows found in CSV from ${sourceName}.`;
      setError(errorMsg); onError(errorMsg); setLoadedSource(null); onDataLoaded(null);
      return;
    }

    // Check only required headers exist
    const actualHeaders = Object.keys(results.data[0]).map(h => h.trim().toLowerCase());
    const missingHeaders = REQUIRED_HEADERS.filter(h => !actualHeaders.includes(h));
    if (missingHeaders.length > 0) {
      const errorMsg = `CSV from ${sourceName} is missing required columns: ${missingHeaders.join(', ')}.`;
      setError(errorMsg); onError(errorMsg); setLoadedSource(null); onDataLoaded(null);
      return;
    }

    // Process valid data — only date and weight are required, rest are optional
    const processedData = results.data
      .filter(row => {
        const date = row.date ?? row.Date ?? '';
        const weight = row.weight ?? row.Weight ?? '';
        return date !== null && date !== '' && weight !== null && weight !== '';
      })
      .map(row => {
        const weightVal = Number(row.weight ?? row.Weight) || null;
        return {
          date: String(row.date ?? row.Date ?? ''),
          time: String(row.time ?? row.Time ?? ''),
          weight: weightVal,
          // Optional columns — null if missing/invalid
          fat_percentage: row.fat_percentage != null ? (Number(row.fat_percentage) || null) : null,
          source: String(row.source ?? sourceName ?? 'unknown'),
        };
      })
      .filter(row => row.weight !== null && row.weight > 0);

    if (processedData.length === 0) {
      const errorMsg = `CSV from ${sourceName} contained no valid weight entries after processing.`;
      setError(errorMsg); onError(errorMsg); setLoadedSource(null); onDataLoaded(null);
      return;
    }

    setLoadedSource(sourceName);
    setError(null);
    onDataLoaded(processedData);
  };

  const loadPredefinedSource = async (sourceKey) => {
    const source = PREDEFINED_SOURCES[sourceKey];
    if (!source) {
      const errorMsg = `Source key "${sourceKey}" not found.`;
      setError(errorMsg); onError(errorMsg);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = `${source.url}&_=${new Date().getTime()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Network error (status: ${response.status})`);

      const csvText = await response.text();
      if (!csvText || csvText.trim().length === 0) throw new Error('Fetched CSV data is empty.');

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (results) => processCSV(results, source.name),
        error: (err) => {
          const errorMsg = `Error parsing CSV data from ${source.name}.`;
          console.error('PapaParse Error:', err.message);
          setError(errorMsg); onError(errorMsg); setLoadedSource(null); onDataLoaded(null);
        }
      });
    } catch (err) {
      console.error(`Error loading source ${source.name}:`, err);
      const errorMsg = `Error loading data for ${source.name}: ${err.message}`;
      setError(errorMsg); onError(errorMsg); setLoadedSource(null); onDataLoaded(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="data-importer">
      {isLoading ? (
        <p className="loading-message">⏳ Loading data...</p>
      ) : loadedSource ? (
        <button
          onClick={() => loadPredefinedSource('lerito')}
          className="control-button refresh-button"
          disabled={isLoading}
        >
          ↻ Refresh Data
        </button>
      ) : !error ? (
        <p className="loading-message">Initializing...</p>
      ) : null}
      {!isLoading && error && <p className="error-message importer-error">{error}</p>}
    </div>
  );
};

export default DataImporter;
