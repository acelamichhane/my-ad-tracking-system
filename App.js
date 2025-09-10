
/**
 * Ad Tracking Dashboard - Main App Component
 */

import React, { useState, useEffect } from 'react';
import './App.css';

// Mock API service (replace with actual API calls)
const API = {
  baseURL: 'http://localhost:3000/api',

  async get(endpoint) {
    const response = await fetch(`${this.baseURL}${endpoint}`);
    return response.json();
  },

  async post(endpoint, data) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }
};

// Dashboard Header Component
const Header = ({ title }) => {
  return (
    <header className="dashboard-header">
      <div className="container">
        <h1>🎯 {title}</h1>
        <div className="header-actions">
          <button className="btn btn-primary">Sync Meta Data</button>
          <button className="btn btn-secondary">Settings</button>
        </div>
      </div>
    </header>
  );
};

// Metrics Cards Component
const MetricsCards = ({ metrics, loading }) => {
  if (loading) {
    return (
      <div className="metrics-grid">
        {[1,2,3,4].map(i => (
          <div key={i} className="metric-card loading">
            <div className="skeleton"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="metrics-grid">
      <div className="metric-card">
        <div className="metric-value">{metrics.totalClicks?.toLocaleString() || '0'}</div>
        <div className="metric-label">Total Clicks</div>
        <div className="metric-change positive">+{metrics.clicksChange || '0'}%</div>
      </div>

      <div className="metric-card">
        <div className="metric-value">{metrics.totalConversions?.toLocaleString() || '0'}</div>
        <div className="metric-label">Conversions</div>
        <div className="metric-change positive">+{metrics.conversionsChange || '0'}%</div>
      </div>

      <div className="metric-card">
        <div className="metric-value">${metrics.totalRevenue?.toLocaleString() || '0'}</div>
        <div className="metric-label">Revenue</div>
        <div className="metric-change positive">+{metrics.revenueChange || '0'}%</div>
      </div>

      <div className="metric-card">
        <div className="metric-value">{metrics.averageROAS?.toFixed(2) || '0.00'}x</div>
        <div className="metric-label">Average ROAS</div>
        <div className="metric-change negative">-{metrics.roasChange || '0'}%</div>
      </div>
    </div>
  );
};

// Campaign Table Component
const CampaignTable = ({ campaigns, loading }) => {
  const [sortField, setSortField] = useState('revenue');
  const [sortDirection, setSortDirection] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const aVal = a[sortField] || 0;
    const bVal = b[sortField] || 0;
    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });

  if (loading) {
    return (
      <div className="campaign-table-container">
        <div className="loading-table">Loading campaigns...</div>
      </div>
    );
  }

  return (
    <div className="campaign-table-container">
      <div className="table-header">
        <h2>Campaign Performance</h2>
        <div className="table-actions">
          <button className="btn btn-sm">Export CSV</button>
          <button className="btn btn-sm btn-primary">New Campaign</button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="campaign-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} className="sortable">
                Campaign Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('clicks')} className="sortable">
                Clicks {sortField === 'clicks' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('conversions')} className="sortable">
                Conversions {sortField === 'conversions' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('conversion_rate')} className="sortable">
                CVR {sortField === 'conversion_rate' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('revenue')} className="sortable">
                Revenue {sortField === 'revenue' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('cost')} className="sortable">
                Cost {sortField === 'cost' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('roas')} className="sortable">
                ROAS {sortField === 'roas' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedCampaigns.map((campaign, index) => (
              <tr key={campaign.campaign_id || index}>
                <td className="campaign-name">
                  <div className="campaign-info">
                    <span className="name">{campaign.name}</span>
                    <span className="id">{campaign.campaign_id}</span>
                  </div>
                </td>
                <td>{(campaign.clicks || 0).toLocaleString()}</td>
                <td>{(campaign.conversions || 0).toLocaleString()}</td>
                <td className="conversion-rate">
                  {(campaign.conversion_rate || 0).toFixed(2)}%
                </td>
                <td className="revenue">
                  ${(campaign.revenue || 0).toLocaleString()}
                </td>
                <td className="cost">
                  ${(campaign.cost || 0).toLocaleString()}
                </td>
                <td className={`roas ${(campaign.roas || 0) > 2 ? 'good' : 'poor'}`}>
                  {(campaign.roas || 0).toFixed(2)}x
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="btn btn-xs">View</button>
                    <button className="btn btn-xs">Edit</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Date Range Picker Component
const DateRangePicker = ({ startDate, endDate, onChange }) => {
  return (
    <div className="date-range-picker">
      <input
        type="date"
        value={startDate}
        onChange={(e) => onChange({ startDate: e.target.value, endDate })}
        className="date-input"
      />
      <span>to</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => onChange({ startDate, endDate: e.target.value })}
        className="date-input"
      />
      <div className="preset-buttons">
        <button onClick={() => onChange({ 
          startDate: new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0]
        })}>
          Last 7 Days
        </button>
        <button onClick={() => onChange({ 
          startDate: new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0]
        })}>
          Last 30 Days
        </button>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const loadData = async () => {
    setLoading(true);
    try {
      // Load campaigns
      const campaignParams = new URLSearchParams({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate
      });

      const campaignResponse = await API.get(`/reports/campaigns?${campaignParams}`);

      if (campaignResponse.success) {
        setCampaigns(campaignResponse.data);

        // Calculate aggregate metrics
        const totalClicks = campaignResponse.data.reduce((sum, c) => sum + (c.clicks || 0), 0);
        const totalConversions = campaignResponse.data.reduce((sum, c) => sum + (c.conversions || 0), 0);
        const totalRevenue = campaignResponse.data.reduce((sum, c) => sum + (c.revenue || 0), 0);
        const totalCost = campaignResponse.data.reduce((sum, c) => sum + (c.cost || 0), 0);

        setMetrics({
          totalClicks,
          totalConversions,
          totalRevenue,
          averageROAS: totalCost > 0 ? totalRevenue / totalCost : 0,
          clicksChange: Math.floor(Math.random() * 20), // Mock data
          conversionsChange: Math.floor(Math.random() * 15),
          revenueChange: Math.floor(Math.random() * 25),
          roasChange: Math.floor(Math.random() * 5)
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
      // Mock data for development
      setCampaigns([
        {
          campaign_id: 'camp_001',
          name: 'Summer Sale 2025',
          clicks: 15420,
          conversions: 234,
          conversion_rate: 1.52,
          revenue: 12450,
          cost: 3200,
          roas: 3.89
        },
        {
          campaign_id: 'camp_002', 
          name: 'Product Launch Campaign',
          clicks: 8930,
          conversions: 156,
          conversion_rate: 1.75,
          revenue: 8750,
          cost: 2100,
          roas: 4.17
        }
      ]);

      setMetrics({
        totalClicks: 24350,
        totalConversions: 390,
        totalRevenue: 21200,
        averageROAS: 4.0,
        clicksChange: 12,
        conversionsChange: 8,
        revenueChange: 15,
        roasChange: 2
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateRange]);

  return (
    <div className="app">
      <Header title="Ad Tracking Dashboard" />

      <main className="main-content">
        <div className="container">
          {/* Controls */}
          <div className="dashboard-controls">
            <DateRangePicker
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              onChange={setDateRange}
            />
            <button onClick={loadData} className="btn btn-primary">
              Refresh Data
            </button>
          </div>

          {/* Metrics Overview */}
          <section className="metrics-section">
            <h2>Performance Overview</h2>
            <MetricsCards metrics={metrics} loading={loading} />
          </section>

          {/* Campaign Table */}
          <section className="campaigns-section">
            <CampaignTable campaigns={campaigns} loading={loading} />
          </section>
        </div>
      </main>
    </div>
  );
};

export default App;
