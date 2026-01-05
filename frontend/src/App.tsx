import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import DatasetsView from './pages/DatasetsView';
import MinerFlowsDashboard from './pages/MinerFlowsDashboard';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-950">
        {/* Simple navigation */}
        <nav className="bg-slate-900 border-b border-white/10 p-4">
          <div className="max-w-7xl mx-auto flex gap-6 items-center">
            <h1 className="text-white font-bold text-xl">TAO Galaxy Institutional</h1>
            <Link to="/" className="text-slate-300 hover:text-white">
              Miner Flows
            </Link>
            <Link to="/datasets" className="text-slate-300 hover:text-white">
              Datasets
            </Link>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<MinerFlowsDashboard />} />
          <Route path="/datasets" element={<DatasetsView />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
