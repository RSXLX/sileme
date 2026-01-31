import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './contexts/AppContext';
import { AppStatus } from './types';

// Import App directly since we'll use it for all routes
import App from './App';

const Router: React.FC = () => {
  return (
    <Routes>
      {/* All routes render the same App component */}
      {/* App internally decides what to show based on status */}
      <Route path="/" element={<App />} />
      <Route path="/configure" element={<App />} />
      <Route path="/dashboard" element={<App />} />
      <Route path="/execute" element={<App />} />
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default Router;
