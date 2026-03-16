import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WeightTracker from './components/WeightTracker/WeightTracker';
import './App.css';

const App = () => {
  return (
    <Router basename={process.env.PUBLIC_URL}>
      <div className="App dark-mode">
        <Routes>
          <Route path="/" element={<WeightTracker />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;