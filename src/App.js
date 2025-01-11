import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, NavLink } from 'react-router-dom';
import WeightTracker from './components/WeightTracker/WeightTracker';
import GymTracker from './components/GymTracker/GymTracker';
import Home from './components/Home/Home';
import './App.css';

const App = () => {
  return (
    <Router>
      <div className="App dark-mode">
        <nav className="main-nav">
          <NavLink to="/" className={({ isActive }) => 
            isActive ? "nav-link active" : "nav-link"
          }>
            Home
          </NavLink>
          <NavLink to="/weight" className={({ isActive }) => 
            isActive ? "nav-link active" : "nav-link"
          }>
            Weight Tracker
          </NavLink>
          <NavLink to="/gym" className={({ isActive }) => 
            isActive ? "nav-link active" : "nav-link"
          }>
            Gym Progress
          </NavLink>
        </nav>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/weight" element={<WeightTracker />} />
          <Route path="/gym" element={<GymTracker />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;