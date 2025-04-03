import React, { useState, useEffect, createContext, useContext, useCallback, useMemo, useRef } from 'react';
import DataImporter from '../DataImporter/DataImporter';
import TrendGraph from './TrendGraph';
import SimpleTrendGraph from './SimpleTrendGraph';

export const WeightTrackerContext = createContext();

function useOutsideAlerter(ref, callback) {
  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        callback();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [ref, callback]);
}

const WeightTracker = () => {
  // === State ===
  const [originalData, setOriginalData] = useState([]);
  const [fitnessData, setFitnessData] = useState([]);
  const [showGraphs, setShowGraphs] = useState(false);
  const [availableSources, setAvailableSources] = useState([]);
  const [selectedSources, setSelectedSources] = useState(new Set());
  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState(false);
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [targetWeightInput, setTargetWeightInput] = useState(64);
  const [effectiveTargetWeight, setEffectiveTargetWeight] = useState(64);
  const [error, setError] = useState(null);

  const sourceDropdownRef = useRef(null);
  useOutsideAlerter(sourceDropdownRef, () => setIsSourceMenuOpen(false));

  // === Derived State ===
  const filteredData = useMemo(() => fitnessData.filter(data =>
    selectedSources.has(data.source)
  ), [fitnessData, selectedSources]);

  const hasEnoughDataForGraphs = filteredData.length > 1;
  const hasLoadedData = fitnessData.length > 0;

  // Calculate Weight Change Info
  const weightChangeInfo = useMemo(() => {
    if (fitnessData.length < 1) { return null; }
    const firstDataPoint = fitnessData[0];
    const lastDataPoint = fitnessData[fitnessData.length - 1];
    const firstWeight = firstDataPoint?.weight;
    const lastWeight = lastDataPoint?.weight;
    if (firstWeight == null || !isFinite(firstWeight) || lastWeight == null || !isFinite(lastWeight)) { return null; }
    let percentageChange = 0;
    let absoluteChange = lastWeight - firstWeight;
    if (fitnessData.length >= 2 && firstWeight !== 0) {
        percentageChange = (absoluteChange / firstWeight) * 100;
    } else if (fitnessData.length < 2) {
        absoluteChange = 0; percentageChange = 0;
    }
    return { firstWeight, lastWeight, percentageChange, absoluteChange };
  }, [fitnessData]);

  // === Data Processing ===
  const processData = useCallback((data) => {
     if (!Array.isArray(data)) { console.error("processData received non-array data:", data); return []; }
     const processedData = data
       .filter(row => row && row.date && row.weight != null)
       .map(row => {
           const dateObj = new Date(row.date);
           const displayDate = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }) : 'Invalid Date';
           const displayTime = typeof row.time === 'string' ? row.time.split(':').slice(0, 2).join(':') : '--:--';
           return {
               ...row, date: displayDate, time: displayTime, dateObj: dateObj,
               weight: Number(row.weight) || 0, fat_percentage: Number(row.fat_percentage) || 0, bmi: Number(row.bmi) || 0,
           };
        })
       .filter(row => !isNaN(row.dateObj.getTime()))
       .sort((a, b) => a.dateObj - b.dateObj);
     return processedData;
  }, []);

  // === Event Handlers ===
  const handleDataLoaded = useCallback((data) => {
     setError(null); setShowGraphs(false); setIsTableExpanded(false); setIsSourceMenuOpen(false);
     if (!data || data.length === 0) {
         setOriginalData([]); setFitnessData([]); setAvailableSources([]); setSelectedSources(new Set()); return;
     }
     try {
         const sources = [...new Set(data.map(row => String(row.source || 'Unknown')))];
         setAvailableSources(sources); setSelectedSources(new Set(sources));
         const processed = processData(data);
         setOriginalData(data); setFitnessData(processed);
     } catch (err) {
         console.error("Error processing loaded data:", err); setError("Failed to process the loaded data.");
         setOriginalData([]); setFitnessData([]);
     }
  }, [processData]);

  const handleSourceToggle = (source) => {
    const newSelection = new Set(selectedSources);
    if (newSelection.has(source)) { newSelection.delete(source); } else { newSelection.add(source); }
    setSelectedSources(newSelection);
  };

  const handleTargetWeightInputChange = (event) => {
    setTargetWeightInput(Number(event.target.value) || 0);
  };

  const handleUpdateTargetWeight = () => {
    setEffectiveTargetWeight(targetWeightInput);
  };

  const handleGenerateGraphs = () => {
    if (hasEnoughDataForGraphs) { setShowGraphs(true); setError(null); }
    else { setError("Need at least two data points from selected sources."); setShowGraphs(false); }
  };

  const handleError = (errorMessage) => {
    setError(errorMessage); setOriginalData([]); setFitnessData([]); setShowGraphs(false);
  };

  // === Context Value ===
  const contextValue = useMemo(() => ({
    targetWeight: effectiveTargetWeight,
  }), [effectiveTargetWeight]);


  // === JSX ===
  return (
    <WeightTrackerContext.Provider value={contextValue}>
      <div className="weight-tracker">
        <h1>Lerito Weight Tracker</h1>

        {/* Weight Change Summary */}
        {weightChangeInfo && (
            <p className="weight-change-summary">
                {weightChangeInfo.percentageChange < -0.1 ?
                    `Congrats! You have lost ${Math.abs(weightChangeInfo.percentageChange).toFixed(1)}% (${Math.abs(weightChangeInfo.absoluteChange).toFixed(1)}kg) since your first measurement (${weightChangeInfo.firstWeight.toFixed(1)}kg → ${weightChangeInfo.lastWeight.toFixed(1)}kg).`
                    : weightChangeInfo.percentageChange > 0.1 ?
                    `Weight has increased by ${weightChangeInfo.percentageChange.toFixed(1)}% (${weightChangeInfo.absoluteChange.toFixed(1)}kg) since the first measurement (${weightChangeInfo.firstWeight.toFixed(1)}kg → ${weightChangeInfo.lastWeight.toFixed(1)}kg).`
                    : fitnessData.length > 1 ?
                    `Body weight has remained stable since the first measurement (${weightChangeInfo.firstWeight.toFixed(1)}kg).`
                    :
                    `Current weight: ${weightChangeInfo.lastWeight.toFixed(1)}kg.`
                }
            </p>
        )}

        <DataImporter onDataLoaded={handleDataLoaded} onError={handleError} />

        {error && <div className="error-message">{error}</div>}

        {/* Controls */}
        {hasLoadedData && (
          <div className="controls">
            <div className="source-selection" ref={sourceDropdownRef}>
              <button className="control-button dropdown-button" onClick={() => setIsSourceMenuOpen(!isSourceMenuOpen)}>
                Select Sources ({selectedSources.size}/{availableSources.length}) {isSourceMenuOpen ? '▲' : '▼'}
              </button>
              {isSourceMenuOpen && (
                 <div className="source-menu">
                   {availableSources.length > 0 ? availableSources.map(source => (
                     <label key={source}>
                       <input type="checkbox" checked={selectedSources.has(source)} onChange={() => handleSourceToggle(source)} /> {source}
                     </label>
                   )) : <span>No sources available</span>}
                 </div>
               )}
            </div>
            <div className="target-weight-control">
                <label> Target Weight: <input type="number" value={targetWeightInput} onChange={handleTargetWeightInputChange}/> </label>
                <button className="control-button" onClick={handleUpdateTargetWeight} title="Apply target weight change"> Update Target </button>
            </div>
          </div>
        )}

        {/* Data Preview Table - ** RESTORED FULL STRUCTURE HERE ** */}
        {hasLoadedData && (
          <div className="data-preview">
            <div className="table-header">
              <h2>Loaded Data ({filteredData.length} entries selected)</h2>
              {filteredData.length > 4 && (
                 <button onClick={() => setIsTableExpanded(!isTableExpanded)} className="table-toggle control-button subtle-button" >
                    {isTableExpanded ? 'Show Less ▲' : 'Show More ▼'}
                  </button>
              )}
            </div>
            {!isTableExpanded && filteredData.length > 4 && (
              <div className="table-notice">
                Showing most recent 4 entries. Click 'Show More'.
              </div>
            )}
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Time</th><th>Weight</th><th>Fat %</th><th>BMI</th><th>Source</th>
                </tr>
              </thead>
              <tbody>
                {(isTableExpanded ? [...filteredData] : filteredData.slice(-4))
                .reverse()
                .map((entry, index) => (
                  <tr key={`${entry.dateObj?.getTime()}-${entry.source}-${index}`}>
                    <td>{entry.date}</td><td>{entry.time}</td><td>{entry.weight?.toFixed(1)}</td><td>{entry.fat_percentage?.toFixed(1)}</td><td>{entry.bmi?.toFixed(1)}</td><td>{entry.source}</td>
                  </tr>
                ))}
                {!isTableExpanded && filteredData.length > 4 && ( <tr className="table-indicator"><td colSpan="6">...</td></tr> )}
                {filteredData.length === 0 && hasLoadedData && ( <tr><td colSpan="6">No data matching selected sources.</td></tr> )}
                {!hasLoadedData && ( <tr><td colSpan="6">Load data to see the table.</td></tr> )}
              </tbody>
            </table>
          </div> // End data-preview
        )}
        {/* **** END OF RESTORED BLOCK **** */}

        {/* Generate Graphs Button */}
        {hasLoadedData && !showGraphs && (
             <div className="generate-graphs-section">
                 <button className="control-button action-button" onClick={handleGenerateGraphs} disabled={!hasEnoughDataForGraphs}> Generate Graphs </button>
                 {!hasEnoughDataForGraphs && <p><small>Need at least 2 data points from selected sources.</small></p>}
             </div>
        )}

        {/* Graphs Area */}
        {hasEnoughDataForGraphs && showGraphs && (
          <div className="graphs">
            <TrendGraph data={filteredData} />
            <SimpleTrendGraph data={filteredData} />
          </div>
        )}

      </div> {/* End weight-tracker */}
    </WeightTrackerContext.Provider>
  );
};

export default WeightTracker;