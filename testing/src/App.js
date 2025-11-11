import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import HomePage from './HomePage';
import AuthPage from './AuthPage';
import DashboardPatient from './DashboardPatient';
import DashboardDoctor from './DashboardDoctor';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/dashboardpatient" element={<DashboardPatient />} />
        <Route path="/dashboarddoctor" element={<DashboardDoctor />} />
      </Routes>
    </Router>
  );
}

export default App;
