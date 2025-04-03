import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

const PREDEFINED_SOURCES = {
  lerito: {
    name: "Lerito",
    url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vThTzKmTRk3F8icHWCdKa4sBRyBR1yixAt8lfgxoU6YJYCgxvmDCZc3oqdJjM7e3kyUU0TGKofPMAb1/pub?output=csv"
    // Add other sources here if needed
  }
};

const DataImporter = ({ onDataLoaded, onError }) => {
  const [loadedSource, setLoadedSource] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false); // Add loading state

  // Load initial data on mount
  useEffect(() => {
    // Start in loading state for the initial load
    // setIsLoading(true); // Set loading state within the function now
    loadPredefinedSource('lerito');
  }, []); // Empty dependency array ensures this runs only once on mount

  // REMOVED: clearData function is no longer needed

  const processCSV = (results, sourceName) => { // Pass sourceName for consistency
    if (results.errors && results.errors.length > 0) {
      console.error('CSV Parsing Errors:', results.errors);
      const errorMsg = `Error parsing CSV data from ${sourceName}. Check console for details.`;
      setError(errorMsg);
      onError(errorMsg);
      setLoadedSource(null); // Clear source if parsing fails
      onDataLoaded(null); // Clear data in parent
      return; // Stop processing
    }

     // Simple validation: Check if data exists and is an array
     if (!results.data || !Array.isArray(results.data) || results.data.length === 0) {
         const errorMsg = `No valid data rows found in CSV from ${sourceName}.`;
         setError(errorMsg);
         onError(errorMsg);
         setLoadedSource(null);
         onDataLoaded(null);
         return;
     }

     // More robust header check (optional but recommended)
     const requiredHeaders = ['date', 'time', 'weight', 'fat_percentage', 'bmi'];
     const actualHeaders = Object.keys(results.data[0]); // Assumes headers exist
     const missingHeaders = requiredHeaders.filter(h => !actualHeaders.includes(h));

     if (missingHeaders.length > 0) {
         const errorMsg = `CSV from ${sourceName} is missing required columns: ${missingHeaders.join(', ')}.`;
         setError(errorMsg);
         onError(errorMsg);
         setLoadedSource(null);
         onDataLoaded(null);
         return;
     }

    // Process valid data
    const processedData = results.data
        // Optional: Filter out potentially empty rows if papaparse includes them
        .filter(row => requiredHeaders.some(header => row[header] !== null && row[header] !== ''))
        .map(row => ({
            // Explicitly map required fields, handling potential nulls/types
            date: String(row.date || ''), // Ensure string
            time: String(row.time || ''), // Ensure string
            weight: Number(row.weight) || null, // Coerce to number, null if invalid
            fat_percentage: Number(row.fat_percentage) || null,
            bmi: Number(row.bmi) || null,
            // Include source, default if missing
            source: String(row.source || sourceName || 'unknown')
    }));

    // Final check if processed data has valid entries after mapping
     if (processedData.length === 0) {
          const errorMsg = `CSV from ${sourceName} contained rows, but none were valid after processing.`;
          setError(errorMsg);
          onError(errorMsg);
          setLoadedSource(null);
          onDataLoaded(null);
          return;
     }


    setLoadedSource(sourceName); // Set loaded source *after* successful processing
    setError(null); // Clear previous errors on success
    onDataLoaded(processedData); // Pass processed data up
  };

  const loadPredefinedSource = async (sourceKey) => {
    const source = PREDEFINED_SOURCES[sourceKey];
    if (!source) {
        const errorMsg = `Source key "${sourceKey}" not found.`;
        setError(errorMsg);
        onError(errorMsg); // Notify parent
        return;
    }

    setIsLoading(true); // Set loading TRUE when starting load/refresh
    setError(null);    // Clear previous errors

    console.log(`Attempting to load/refresh source: ${source.name}`);

    try {
        // Use cache-busting parameter to try and force refresh
        const url = `${source.url}&_=${new Date().getTime()}`;
        const response = await fetch(url); // Fetch the CSV

        if (!response.ok) {
            throw new Error(`Network response was not ok (status: ${response.status})`);
        }

        const csvText = await response.text();

        if (!csvText || csvText.trim().length === 0) {
            throw new Error('Fetched CSV data is empty.');
        }

        // Parse the CSV data
        Papa.parse(csvText, {
            header: true,        // Treat first row as headers
            skipEmptyLines: true, // Skip empty lines
            dynamicTyping: false, // Disable - handle type conversion manually for robustness
            complete: (results) => {
                console.log(`CSV parsing complete for ${source.name}. Processing...`);
                processCSV(results, source.name); // Process the parsed data
                // setIsLoading(false) is called within processCSV or its error path now
            },
            error: (err) => { // Handle PapaParse specific errors
                console.error("PapaParse Error:", err.message);
                const errorMsg = `Error parsing CSV data from ${source.name}.`;
                setError(errorMsg);
                onError(errorMsg);
                setLoadedSource(null);
                onDataLoaded(null);
                // setIsLoading(false); // Set loading false on error
            }
        });

    } catch (err) {
        console.error(`Error loading source ${source.name}:`, err);
        const errorMsg = `Error loading data for ${source.name}: ${err.message}`;
        setError(errorMsg);
        onError(errorMsg); // Notify parent
        setLoadedSource(null); // Clear source on fetch error
        onDataLoaded(null); // Clear data in parent
        // setIsLoading(false); // Set loading false on error
    } finally {
        // Ensure loading is set to false regardless of success or failure
        setIsLoading(false);
        console.log(`Finished loading attempt for ${source.name}. Loading state: false`);
    }
  };

  return (
    <div className="data-importer">
      {isLoading ? (
        <p className="loading-message">Loading data...</p> // Message shown only while loading
      ) : loadedSource ? (
        // Show Refresh button if not loading and a source was successfully loaded previously
        <button
          onClick={() => loadPredefinedSource('lerito')} // Re-load the 'lerito' source
          className="refresh-button control-button" // Apply consistent button styling
          disabled={isLoading} // Disable button while loading
        >
          Refresh Data ({loadedSource})
        </button>
      ) : !error ? (
          // Initial state before load completes, or if load failed silently
          // You might want a button here to manually trigger the load if useEffect fails
          <p className="loading-message">Initializing...</p> // Or a manual load button
      ) : null /* Don't show button if there was an error and not currently loading */ }

      {/* Show error message only if not currently loading and an error exists */}
      {!isLoading && error && <p className="error-message importer-error">{error}</p>}
    </div>
  );
};

export default DataImporter;