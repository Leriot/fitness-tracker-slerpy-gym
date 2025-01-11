import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import WeightTracker from './components/WeightTracker/WeightTracker';
import GymTracker from './components/GymTracker/GymTracker';
import './App.css';

const App = () => {
  return (
    <Router>
      <div className="App dark-mode">
        <nav className="main-nav">
          <Link to="/" className="nav-link">Home</Link>
        </nav>

        <Routes>
          <Route path="/" element={
            <div className="tracker-selection">
              <h1>Fitness Tracker Hub</h1>
              <div className="tracker-buttons">
                <Link to="/weight" className="tracker-button">Weight Tracker</Link>
                <Link to="/gym" className="tracker-button">Gym Progress</Link>
              </div>
            </div>
          } />
          <Route path="/weight" element={<WeightTracker />} />
          <Route path="/gym" element={<GymTracker />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;