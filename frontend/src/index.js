import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./Login";
import Register from "./Register";
import Dashboard from "./Dashboard";
import CreateCampaign from "./CreateCampaign";
import TargetProfiles from "./TargetProfiles";
import NewsPage from './NewsPage';
import Training from "./Training";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />@
        <Route path="/create-campaign" element={<CreateCampaign />} />
        @<Route path="/dashboard" element={<Dashboard />} />
        <Route path="/target-profiles" element={<TargetProfiles />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/training" element={<Training />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
