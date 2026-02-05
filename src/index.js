import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, Users, TrendingUp, Target, Plus, Download, Trash2, ArrowUpDown, Edit2, Save, X, ChevronLeft, ChevronRight, Upload, RefreshCw } from 'lucide-react';

const App = () => {
  const [tab, setTab] = useState('dashboard');
  const [jobs, setJobs] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState('');
  const [editId, setEditId] = useState(null);
  const [draggedJob, setDraggedJob] = useState(null);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [customerSortKey, setCustomerSortKey] = useState('revenue');
  const [customerSortDir, setCustomerSortDir] = useState('desc');
  const [showMapView, setShowMapView] = useState(false);
  const [draggedMapJob, setDraggedMapJob] = useState(null);
  const [jobOrder, setJobOrder] = useState({});
  const [lastClearTime, setLastClearTime] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const jobFileInputRef = useRef(null);
  const customerFileInputRef = useRef(null);
  
  // Google Sheets configuration
  const SHEET_ID = '1yI7XSioWgOdMQJxln-mbPNk39NQPvbF5Bylstu1A6o4';
  const SHEET_NAME = 'Sheet1'; // Change this if your tab has a different name
  
  useEffect(() => {
    const load = async () => {
      try {
        const j = await window.storage.get('jobs');
        const c = await window.storage.get('contractors');
        const cu = await window.storage.get('customers');
        
        if (j?.value) setJobs(JSON.parse(j.value));
        if (c?.value) setContractors(JSON.parse(c.value));
        if (cu?.value) setCustomers(JSON.parse(cu.value));
      } catch (e) {
        console.error('Error loading data:', e);
      }
    };
    load();
  }, []);
  
  useEffect(() => {
    (async () => {
      try {
        await window.storage.set('jobs', JSON.stringify(jobs));
        await window.storage.set('contractors', JSON.stringify(contractors));
        await window.storage.set('customers', JSON.stringify(customers));
      } catch (e) {
        console.error('Error saving data:', e);
      }
    })();
  }, [jobs, contractors, customers]);

  // Google Sheets Sync Function
  const syncFromGoogleSheet = async () => {
    setIsSyncing(true);
    try {
      // Construct the CSV export URL
      const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
      
      const response = await fetch(csvUrl);
      if (!response.ok) throw new Error('Failed to fetch Google Sheet');
      
      const csvText = await response.text();
      const lines = csvText.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        alert('⚠️ No data found in Google Sheet');
        setIsSyncing(false);
        return;
      }
      
      // Skip header row, parse data rows
      const dataRows = lines.slice(1);
      const newJobs = [];
      
      dataRows.forEach((line, idx) => {
        // Parse CSV properly handling quoted fields
        const fields = [];
        let currentField = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            fields.push(currentField.trim());
            currentField = '';
          } else {
            currentField += char;
          }
        }
        fields.push(currentField.trim());
        
        // Map columns: Date, Business, Service, Customer, Phone, Address, Revenue, Expenses, Payment Method, Lead Source
        if (fields.length >= 6 && fields[0]) { // At least need date, business, service, customer, phone, address
          const job = {
            id: Date.now() + idx, // Unique ID
            date: fields[0] || '',
            business: fields[1] || '',
            service: fields[2] || '',
            customerName: fields[3] || '',
            phone: fields[4] || '',
            address: fields[5] || '',
            revenue: fields[6] || '0',
            expenses: fields[7] || '0',
            paymentMethod: fields[8] || '',
            leadSource: fields[9] || '',
            status: 'completed'
          };
          newJobs.push(job);
        }
      });
      
      if (newJobs.length > 0) {
        setJobs(newJobs);
        setLastSyncTime(new Date().toLocaleTimeString());
        alert(`✅ Synced ${newJobs.length} jobs from Google Sheet!`);
      } else {
        alert('⚠️ No valid jobs found in Google Sheet');
      }
      
    } catch (error) {
      console.error('Sync error:', error);
      alert('❌ Failed to sync from Google Sheet. Make sure the sheet is shared as "Anyone with the link can view"');
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-sync customers from jobs whenever jobs change
  useEffect(() => {
    const syncClientsFromJobs = () => {
      const jobClients = new Map();
      
      jobs.forEach(job => {
        if (job.customerName) {
          const key = job.customerName.toLowerCase();
          if (!jobClients.has(key)) {
            jobClients.set(key, {
              name: job.customerName,
              phone: '',
              address: job.address || '',
              email: '',
              notes: ''
            });
          } else {
            const existing = jobClients.get(key);
            if (job.address && !existing.address) {
              existing.address = job.address;
            }
          }
        }
      });
      
      const updatedClients = [...customers];
      
      jobClients.forEach((jobCustomer, key) => {
        const existingIndex = updatedClients.findIndex(c => c.name.toLowerCase() === key);
        
        if (existingIndex === -1) {
          updatedClients.push({
            id: Date.now() + Math.random(),
            ...jobCustomer
          });
        } else {
          if (jobCustomer.address && !updatedClients[existingIndex].address) {
            updatedClients[existingIndex].address = jobCustomer.address;
          }
        }
      });
      
      if (JSON.stringify(updatedClients) !== JSON.stringify(customers)) {
        setCustomers(updatedClients);
      }
    };
    
    syncClientsFromJobs();
  }, [jobs]);

  const handleRemoveDuplicates = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const seen = new Set();
    const uniqueJobs = [];
    
    jobs.forEach(job => {
      const key = `${job.date}-${job.customerName}-${job.service}-${job.revenue}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueJobs.push(job);
      }
    });
    
    const duplicateCount = jobs.length - uniqueJobs.length;
    
    if (duplicateCount > 0) {
      if (window.confirm(`Found ${duplicateCount} duplicate(s). Remove them?`)) {
        setJobs(uniqueJobs);
        alert(`✅ Removed ${duplicateCount} duplicate(s)!`);
      }
    } else {
      alert('✅ No duplicates found!');
    }
  };

  const handleJobDragStart = (e, job) => {
    setDraggedJob(job);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDayDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDayDrop = (e, day) => {
    e.preventDefault();
    if (draggedJob && day) {
      const newDate = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      setJobs(jobs.map(j => j.id === draggedJob.id ? {...j, date: newDate} : j));
      setDraggedJob(null);
    }
  };

  const handleMapJobDragStart = (e, job, dateKey) => {
    setDraggedMapJob({ job, dateKey });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleMapJobDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleMapJobDrop = (e, targetJob, dateKey) => {
    e.preventDefault();
    if (!draggedMapJob || draggedMapJob.dateKey !== dateKey) return;

    const dayJobs = jobs.filter(j => j.date === dateKey);
    const currentOrder = jobOrder[dateKey] || dayJobs.map(j => j.id);
    
    const draggedId = draggedMapJob.job.id;
    const targetId = targetJob.id;
    
    const newOrder = [...currentOrder];
    const draggedIndex = newOrder.indexOf(draggedId);
    const targetIndex = newOrder.indexOf(targetId);
    
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedId);
    
    setJobOrder({ ...jobOrder, [dateKey]: newOrder });
    setDraggedMapJob(null);
  };

  const getOrderedJobsForDate = (dateKey, dayJobs) => {
    const order = jobOrder[dateKey];
    if (!order) return dayJobs;
    
    const orderedJobs = [];
    order.forEach(id => {
      const job = dayJobs.find(j => j.id === id);
      if (job) orderedJobs.push(job);
    });
    
    dayJobs.forEach(job => {
      if (!order.includes(job.id)) orderedJobs.push(job);
    });
    
    return orderedJobs;
  };

  const syncWithGoogleCalendar = () => {
    // Generate ICS file content
    const icsContent = generateICSFile();
    
    // Create downloadable ICS file
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `jobs_calendar_${new Date().toISOString().split('T')[0]}.ics`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert('📅 Calendar file downloaded!\n\nTo sync with Google Calendar:\n1. Open Google Calendar\n2. Click the "+" next to "Other calendars"\n3. Select "Import"\n4. Upload the downloaded .ics file');
  };

  const generateICSFile = () => {
    let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Service Business OS//Jobs Calendar//EN\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n';
    
    jobs.forEach(job => {
      if (job.date) {
        const dateStr = job.date.replace(/-/g, '');
        const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        
        icsContent += 'BEGIN:VEVENT\n';
        icsContent += `UID:${job.id}@servicebusinessos.com\n`;
        icsContent += `DTSTAMP:${now}\n`;
        icsContent += `DTSTART;VALUE=DATE:${dateStr}\n`;
        icsContent += `SUMMARY:${job.service} - ${job.customerName}\n`;
        icsContent += `DESCRIPTION:Business: ${job.business}\\nCustomer: ${job.customerName}\\nAddress: ${job.address}\\nRevenue: $${job.revenue}\n`;
        icsContent += `LOCATION:${job.address}\n`;
        icsContent += 'END:VEVENT\n';
      }
    });
    
    icsContent += 'END:VCALENDAR';
    return icsContent;
  };

  const totalRev = jobs.reduce((sum, j) => sum + Number(j.revenue || 0), 0);
  const totalExp = jobs.reduce((sum, j) => sum + Number(j.expenses || 0), 0);
  const profit = totalRev - totalExp;
  const completedJobsCount = jobs.filter(j => j.status === 'completed').length;

  const getCustomerLifetimeRevenue = (customerName) => {
    return jobs
      .filter(j => j.customerName && j.customerName.toLowerCase() === customerName.toLowerCase())
      .reduce((sum, j) => sum + Number(j.revenue || 0), 0);
  };

  const handleCustomerSort = (key) => {
    if (customerSortKey === key) {
      setCustomerSortDir(customerSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setCustomerSortKey(key);
      setCustomerSortDir(key === 'revenue' ? 'desc' : 'asc');
    }
  };

  const getSortedClients = () => {
    return [...customers].sort((a, b) => {
      let aVal, bVal;
      
      if (customerSortKey === 'revenue') {
        aVal = getCustomerLifetimeRevenue(a.name);
        bVal = getCustomerLifetimeRevenue(b.name);
      } else if (customerSortKey === 'jobs') {
        aVal = jobs.filter(j => j.customerName && j.customerName.toLowerCase() === a.name.toLowerCase()).length;
        bVal = jobs.filter(j => j.customerName && j.customerName.toLowerCase() === b.name.toLowerCase()).length;
      } else {
        aVal = (a[customerSortKey] || '').toString().toLowerCase();
        bVal = (b[customerSortKey] || '').toString().toLowerCase();
      }
      
      if (aVal < bVal) return customerSortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return customerSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const exportJobsCSV = () => {
    const headers = ['Date','Business','Service','Customer Name','Address','Revenue','Expenses','Payment Method','Lead Source'];
    const rows = jobs.map(j => [
      j.date || '',
      j.business || '',
      j.service || '',
      j.customerName || '',
      j.address || '',
      j.revenue || 0,
      j.expenses || 0,
      j.paymentMethod || '',
      j.leadSource || ''
    ]);
    const csvData = [headers, ...rows];
    const csvContent = csvData.map(row => row.map(cell => {
      const cellStr = String(cell);
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return '"' + cellStr.replace(/"/g, '""') + '"';
      }
      return cellStr;
    }).join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'jobs_export_' + new Date().toISOString().split('T')[0] + '.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importJobsCSV = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        
        const importedJobs = [];
        
        for (let i = 1; i < lines.length; i++) {
          const values = [];
          let current = '';
          let inQuotes = false;
          
          for (let char of lines[i]) {
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim().replace(/^"|"$/g, ''));
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim().replace(/^"|"$/g, ''));
          
          const job = {};
          headers.forEach((header, idx) => {
            job[header.replace(/\s+/g, '')] = values[idx] || '';
          });
          
          const rev = Number(job.revenue || 0);
          const exp = Number(job.expenses || 0);
          const profit = rev - exp;
          const margin = rev > 0 ? ((profit / rev) * 100).toFixed(1) : 0;
          
          const newJob = {
            id: Date.now() + i + Math.random(),
            date: job.date || '',
            business: job.business || '',
            service: job.service || '',
            customerName: job.customername || job.customer || '',
            address: job.address || '',
            revenue: rev,
            expenses: exp,
            profit: profit,
            margin: margin,
            paymentMethod: job.paymentmethod || '',
            leadSource: job.leadsource || job.source || '',
            status: 'completed'
          };
          
          importedJobs.push(newJob);
        }
        
        setJobs(prev => [...prev, ...importedJobs]);
        alert(`Successfully imported ${importedJobs.length} job(s)!`);
      } catch (e) {
        alert('Error importing CSV: ' + e.message);
      }
    };
    reader.readAsText(file);
  };

  const exportClientsCSV = () => {
    const headers = ['Name','Phone','Address','Email','Notes','Lifetime Revenue'];
    const rows = customers.map(c => {
      const rev = getCustomerLifetimeRevenue(c.name);
      return [
        c.name,
        c.phone || '',
        c.address || '',
        c.email || '',
        c.notes || '',
        rev.toFixed(2)
      ];
    });
    const csvData = [headers, ...rows];
    const csvContent = csvData.map(row => row.map(cell => {
      const cellStr = String(cell);
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return '"' + cellStr.replace(/"/g, '""') + '"';
      }
      return cellStr;
    }).join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'customers_export_' + new Date().toISOString().split('T')[0] + '.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importClientsCSV = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        
        const importedClients = [];
        for (let i = 1; i < lines.length; i++) {
          const values = [];
          let current = '';
          let inQuotes = false;
          
          for (let char of lines[i]) {
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim().replace(/^"|"$/g, ''));
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim().replace(/^"|"$/g, ''));
          
          const customer = {};
          headers.forEach((header, idx) => {
            customer[header.replace(/\s+/g, '')] = values[idx] || '';
          });
          
          importedClients.push({
            id: Date.now() + i + Math.random(),
            name: customer.name || '',
            phone: customer.phone || '',
            address: customer.address || '',
            email: customer.email || '',
            notes: customer.notes || ''
          });
        }
        
        setCustomers(prev => [...prev, ...importedClients]);
        alert(`Successfully imported ${importedClients.length} customer(s)!`);
      } catch (e) {
        alert('Error importing CSV: ' + e.message);
      }
    };
    reader.readAsText(file);
  };

  const getCalendarDays = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const getJobsForDate = (day) => {
    if (!day) return [];
    const dateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return jobs.filter(j => j.date === dateStr);
  };

  const addJobFromCalendar = (day) => {
    const dateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDay(day);
    document.getElementById('jd').value = dateStr;
    setShowForm('job');
    setTab('jobs');
  };

  const getMonthlyRevenue = () => {
    const monthlyData = {};
    jobs.forEach(j => {
      if (j.date) {
        const month = j.date.substring(0, 7);
        monthlyData[month] = (monthlyData[month] || 0) + Number(j.revenue || 0);
      }
    });
    return Object.entries(monthlyData).sort().slice(-6);
  };
  
  const revenueData = getMonthlyRevenue();
  const maxRevenue = Math.max(...revenueData.map(m => m[1]), 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap');
        * { font-family: 'Outfit', sans-serif; }
      `}</style>

      <input 
        ref={jobFileInputRef}
        type="file" 
        accept=".csv" 
        className="hidden"
        onChange={(e) => {
          if(e.target.files?.[0]) {
            importJobsCSV(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />

      <input 
        ref={customerFileInputRef}
        type="file" 
        accept=".csv" 
        className="hidden"
        onChange={(e) => {
          if(e.target.files?.[0]) {
            importClientsCSV(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />

      <div className="max-w-7xl mx-auto">
        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Service Business OS
              </h1>
              <div className="text-xs text-slate-500 mt-1">
                Data: {jobs.length} jobs • {customers.length} clients
              </div>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold text-yellow-800">⚠️ Data Management Tools</div>
              {lastClearTime && (
                <div className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-semibold">
                  ✅ Data cleared at {lastClearTime}
                </div>
              )}
              {lastSyncTime && (
                <div className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">
                  📥 Last sync: {lastSyncTime}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button 
                onClick={syncFromGoogleSheet}
                disabled={isSyncing}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                {isSyncing ? '⏳ Syncing...' : '📥 Sync from Google Sheet'}
              </button>
              <button 
                onMouseDown={() => {
                  const seen = new Set();
                  const uniqueJobs = [];
                  jobs.forEach(job => {
                    const key = `${job.date}-${job.customerName}-${job.service}-${job.revenue}`;
                    if (!seen.has(key)) {
                      seen.add(key);
                      uniqueJobs.push(job);
                    }
                  });
                  const duplicateCount = jobs.length - uniqueJobs.length;
                  if (duplicateCount > 0) {
                    setJobs(uniqueJobs);
                  }
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-lg text-sm font-semibold"
              >
                🗑️ Remove Duplicates
              </button>
              <button 
                onMouseDown={() => {
                  setJobs([]);
                  setCustomers([]);
                  setContractors([]);
                  setLastClearTime(new Date().toLocaleTimeString());
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-semibold"
              >
                🔄 Clear All Data
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-lg mb-6 p-2">
          <div className="flex gap-2 overflow-x-auto">
            {['dashboard','calendar','jobs','customers','contractors'].map(t => (
              <button 
                key={t} 
                onClick={() => setTab(t)} 
                className={`px-6 py-3 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${
                  tab===t ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg' : 'bg-white/50 text-slate-700 hover:bg-white'
                }`}
              >
                {t === 'customers' ? 'Clients' : t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-xl p-6">
          {tab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Dashboard</h2>
                <div className="text-sm text-slate-600">
                  {jobs.length} jobs • {customers.length} customers
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl shadow border-l-4 border-green-500">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-slate-600 font-semibold">Total Revenue</span>
                    <DollarSign className="text-green-500" size={20} />
                  </div>
                  <div className="text-3xl font-bold">${totalRev.toLocaleString()}</div>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow border-l-4 border-blue-500">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-slate-600 font-semibold">Avg Job Value</span>
                    <TrendingUp className="text-blue-500" size={20} />
                  </div>
                  <div className="text-3xl font-bold">${jobs.length > 0 ? (totalRev / jobs.length).toFixed(0) : 0}</div>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow border-l-4 border-purple-500">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-slate-600 font-semibold">Clients</span>
                    <Users className="text-purple-500" size={20} />
                  </div>
                  <div className="text-3xl font-bold">{customers.length}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {(() => {
                      const thisMonth = new Date().toISOString().substring(0, 7);
                      const newThisMonth = customers.filter(c => {
                        const customerJobs = jobs.filter(j => j.customerName && j.customerName.toLowerCase() === c.name.toLowerCase());
                        if (customerJobs.length === 0) return false;
                        const firstJob = customerJobs.sort((a, b) => new Date(a.date) - new Date(b.date))[0];
                        return firstJob.date && firstJob.date.startsWith(thisMonth);
                      }).length;
                      return `${newThisMonth} new this month`;
                    })()}
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow border-l-4 border-orange-500">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-slate-600 font-semibold">Total Jobs</span>
                    <Target className="text-orange-500" size={20} />
                  </div>
                  <div className="text-3xl font-bold">{jobs.length}</div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow">
                <h3 className="font-bold text-lg mb-4">Revenue by Month</h3>
                {revenueData.length > 0 ? (
                  <div className="space-y-2">
                    {revenueData.map(([month, revenue]) => {
                      const monthName = new Date(month + '-15').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                      return (
                        <div key={month}>
                          <div className="w-full bg-slate-200 rounded-full h-8 relative overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-indigo-500 h-8 rounded-full transition-all flex items-center justify-end pr-3"
                              style={{width: `${(revenue/maxRevenue)*100}%`, minWidth: revenue > 0 ? '60px' : '0'}}
                            >
                              <span className="text-white font-bold text-sm">${revenue.toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="text-xs text-slate-600 mt-1 font-medium">{monthName}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">No jobs with dates yet</div>
                )}
              </div>

              <div className="bg-white p-6 rounded-xl shadow">
                <h3 className="font-bold text-lg mb-4">Revenue - Last 4 Weeks</h3>
                {(() => {
                  const today = new Date();
                  const weeks = [];
                  
                  for (let i = 3; i >= 0; i--) {
                    const weekEnd = new Date(today);
                    weekEnd.setDate(today.getDate() - (i * 7));
                    const weekStart = new Date(weekEnd);
                    weekStart.setDate(weekEnd.getDate() - 6);
                    
                    const weekJobs = jobs.filter(j => {
                      if (!j.date) return false;
                      const jobDate = new Date(j.date);
                      return jobDate >= weekStart && jobDate <= weekEnd;
                    });
                    
                    const weekRevenue = weekJobs.reduce((sum, j) => sum + Number(j.revenue || 0), 0);
                    
                    weeks.push({
                      label: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
                      revenue: weekRevenue,
                      jobs: weekJobs.length
                    });
                  }
                  
                  const maxWeekRevenue = Math.max(...weeks.map(w => w.revenue), 1);
                  
                  return weeks.length > 0 ? (
                    <div className="space-y-2">
                      {weeks.map((week, idx) => (
                        <div key={idx}>
                          <div className="w-full bg-slate-200 rounded-full h-8 relative overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-green-500 to-emerald-500 h-8 rounded-full transition-all flex items-center justify-end pr-3"
                              style={{width: `${(week.revenue/maxWeekRevenue)*100}%`, minWidth: week.revenue > 0 ? '60px' : '0'}}
                            >
                              <span className="text-white font-bold text-sm">${week.revenue.toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="text-xs text-slate-600 mt-1 font-medium">{week.label} ({week.jobs} jobs)</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">No jobs in last 4 weeks</div>
                  );
                })()}
              </div>
            </div>
          )}

          {tab === 'calendar' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Job Calendar</h2>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowMapView(!showMapView)}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${showMapView ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                  >
                    {showMapView ? '📅 Calendar' : '🗺️ Map View'}
                  </button>
                  <button 
                    onClick={syncWithGoogleCalendar}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                  >
                    <Download size={16}/>
                    Sync Google Calendar
                  </button>
                  <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1))} className="p-2 hover:bg-slate-100 rounded">
                    <ChevronLeft size={20} />
                  </button>
                  <div className="font-bold">
                    {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </div>
                  <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1))} className="p-2 hover:bg-slate-100 rounded">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>

              {!showMapView ? (
                <>
                  <div className="bg-white rounded-xl shadow overflow-hidden">
                    <div className="grid grid-cols-7 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-center text-sm font-semibold">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="p-3">{day}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-px bg-slate-200">
                      {getCalendarDays().map((day, idx) => {
                        const dayJobs = getJobsForDate(day);
                        const dateStr = day ? `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
                        const orderedJobs = dateStr ? getOrderedJobsForDate(dateStr, dayJobs) : dayJobs;
                        
                        return (
                          <div 
                            key={idx} 
                            className={`bg-white p-2 min-h-[100px] ${!day ? 'bg-slate-50' : 'hover:bg-blue-50 cursor-pointer'} ${draggedJob && day ? 'border-2 border-dashed border-blue-400' : ''}`}
                            onClick={() => day && addJobFromCalendar(day)}
                            onDragOver={day ? handleDayDragOver : undefined}
                            onDrop={day ? (e) => handleDayDrop(e, day) : undefined}
                          >
                            {day && (
                              <>
                                <div className="font-semibold text-sm mb-1">{day}</div>
                                {orderedJobs.map((job, jobIdx) => (
                                  <div 
                                    key={job.id} 
                                    draggable
                                    onDragStart={(e) => {
                                      handleJobDragStart(e, job);
                                      handleMapJobDragStart(e, job, dateStr);
                                    }}
                                    onDragOver={handleMapJobDragOver}
                                    onDrop={(e) => {
                                      e.stopPropagation();
                                      handleMapJobDrop(e, job, dateStr);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-xs bg-blue-500 hover:bg-blue-600 text-white p-1 rounded mb-1 truncate cursor-move"
                                  >
                                    {jobIdx + 1}. {job.service} - {job.customerName}
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 text-center">Click any day to add a job • Drag jobs to reschedule or reorder</p>
                </>
              ) : (
                <div className="bg-white rounded-xl shadow p-6">
                  <h3 className="text-lg font-bold mb-4">Daily Route Map - {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
                  <p className="text-sm text-slate-600 mb-4">💡 Tip: Drag and drop jobs to reorder your route for each day</p>
                  
                  {/* Get all days with jobs for this month and sort by most recent job added */}
                  {(() => {
                    const daysWithJobs = getCalendarDays()
                      .filter(d => d !== null)
                      .map(day => {
                        const dayJobs = getJobsForDate(day);
                        if (dayJobs.length === 0) return null;
                        
                        const dateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        
                        // Sort jobs by ID (newest first since ID is timestamp-based)
                        const sortedJobs = [...dayJobs].sort((a, b) => b.id - a.id);
                        
                        return { day, dateStr, jobs: sortedJobs };
                      })
                      .filter(d => d !== null)
                      // Sort days by the most recent job ID (newest day first)
                      .sort((a, b) => {
                        const maxIdA = Math.max(...a.jobs.map(j => j.id));
                        const maxIdB = Math.max(...b.jobs.map(j => j.id));
                        return maxIdB - maxIdA;
                      });
                    
                    return daysWithJobs.length > 0 ? daysWithJobs.map(({ day, dateStr, jobs: dayJobs }) => {
                      const orderedJobs = getOrderedJobsForDate(dateStr, dayJobs);
                      
                      return (
                        <div key={day} className="mb-6 border-b pb-4">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="font-bold text-lg">
                              {new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </h4>
                            <span className="text-sm text-slate-600">{orderedJobs.length} job{orderedJobs.length > 1 ? 's' : ''}</span>
                          </div>
                          
                          <div className="space-y-2">
                            {orderedJobs.map((job, idx) => (
                              <div 
                                key={job.id} 
                                draggable
                                onDragStart={(e) => handleMapJobDragStart(e, job, dateStr)}
                                onDragOver={handleMapJobDragOver}
                                onDrop={(e) => handleMapJobDrop(e, job, dateStr)}
                                className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg cursor-move hover:bg-slate-100 transition-colors"
                              >
                                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                                  {idx + 1}
                                </div>
                                <div className="flex-grow">
                                  <div className="font-semibold">{job.service} - {job.customerName}</div>
                                  <div className="text-sm text-slate-600">{job.address}</div>
                                  <div className="text-xs text-slate-500 mt-1">Revenue: ${job.revenue}</div>
                                </div>
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex-shrink-0 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-semibold"
                                >
                                  🗺️ Navigate
                                </a>
                              </div>
                            ))}
                          </div>
                          
                          <div className="mt-3">
                            <div className="flex flex-wrap gap-2 mb-2">
                            <div className="flex flex-wrap gap-2 mb-2">
                              <a
                                href={`mailto:?subject=Route for ${new Date(dateStr).toLocaleDateString()}&body=${encodeURIComponent(orderedJobs.map((j, idx) => `${idx + 1}. ${j.service} - ${j.customerName}\n${j.address}\n`).join('\n'))}`}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2"
                              >
                                📧 Email Route
                              </a>
                              
                              <button
                                onClick={() => {
                                  const googleMapsUrl = `https://www.google.com/maps/dir/${orderedJobs.map(j => encodeURIComponent(j.address)).join('/')}`;
                                  window.open(googleMapsUrl, '_blank');
                                }}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2"
                              >
                                🗺️ View on Map
                              </button>
                            </div>
                            
                            <div className="text-sm text-slate-600 flex items-center mt-2">
                              Total Revenue: <span className="font-bold text-green-600 ml-1">${orderedJobs.reduce((sum, j) => sum + Number(j.revenue || 0), 0).toLocaleString()}</span>
                            </div>
                          </div>
                            
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                              <strong>💡 Tip:</strong> Use "Text to Myself" or "Copy Route" → Send via Messages. On iPhone, tap each address to open in Apple Maps and add to your route.
                            </div>
                            
                            <div className="text-sm text-slate-600 flex items-center mt-2">
                              Total Revenue: <span className="font-bold text-green-600 ml-1">${orderedJobs.reduce((sum, j) => sum + Number(j.revenue || 0), 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="text-center py-8 text-slate-500">No jobs scheduled this month</div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {tab === 'jobs' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Jobs ({jobs.length} total)</h2>
                <div className="flex gap-2">
                  <button onClick={() => jobFileInputRef.current?.click()} className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2">
                    <Upload size={18}/>Import CSV
                  </button>
                  <button onClick={exportJobsCSV} className="bg-green-600 text-white px-4 py-2 rounded-xl flex items-center gap-2">
                    <Download size={18}/>Export CSV
                  </button>
                  <button onClick={()=>setShowForm(showForm==='job'?'':'job')} className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2">
                    <Plus size={18}/>Add Job
                  </button>
                </div>
              </div>

              {showForm==='job' && (
                <div className="bg-green-50 p-4 rounded-xl border-2 border-green-200">
                  <div className="grid grid-cols-2 gap-3">
                    <input id="jd" type="date" className="px-3 py-2 border-2 rounded-lg"/>
                    <select id="jb" className="px-3 py-2 border-2 rounded-lg">
                      <option value="">Business</option>
                      <option>SMC</option>
                      <option>Express</option>
                    </select>
                    <select id="js" className="px-3 py-2 border-2 rounded-lg">
                      <option value="">Service</option>
                      <option>Garden/Yard</option>
                      <option>Snow</option>
                      <option>Handyman</option>
                      <option>Moving</option>
                      <option>Junk Removal</option>
                    </select>
                    <input id="jcn" placeholder="Customer Name" className="px-3 py-2 border-2 rounded-lg"/>
                    <input id="jad" placeholder="Address" className="px-3 py-2 border-2 rounded-lg col-span-2"/>
                    <input id="jr" type="number" placeholder="Revenue" className="px-3 py-2 border-2 rounded-lg"/>
                    <input id="je" type="number" placeholder="Expenses" className="px-3 py-2 border-2 rounded-lg"/>
                    <select id="jpm" className="px-3 py-2 border-2 rounded-lg">
                      <option value="">Payment Method</option>
                      <option>Cash</option>
                      <option>Venmo</option>
                      <option>Check</option>
                      <option>Zelle</option>
                      <option>Credit Card</option>
                    </select>
                    <select id="jls" className="px-3 py-2 border-2 rounded-lg">
                      <option value="">Lead Source</option>
                      <option>Google</option>
                      <option>Referral</option>
                      <option>Tasker</option>
                      <option>Facebook</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={()=>{
                      const d=document.getElementById('jd').value,b=document.getElementById('jb').value,s=document.getElementById('js').value,cn=document.getElementById('jcn').value,ad=document.getElementById('jad').value,r=Number(document.getElementById('jr').value),e=Number(document.getElementById('je').value),pm=document.getElementById('jpm').value,ls=document.getElementById('jls').value;
                      if(d&&b&&s&&cn){
                        const p=r-e,m=r>0?((p/r)*100).toFixed(1):0;
                        setJobs([...jobs,{id:Date.now(),date:d,business:b,service:s,customerName:cn,address:ad,revenue:r,expenses:e,profit:p,margin:m,paymentMethod:pm,leadSource:ls,status:'completed'}]);
                        
                        ['jd','jb','js','jcn','jad','jr','je','jpm','jls'].forEach(id=>document.getElementById(id).value='');
                        setShowForm('');
                      }
                    }} className="bg-green-600 text-white px-4 py-2 rounded-lg">Add Job</button>
                    <button onClick={()=>setShowForm('')} className="bg-slate-300 px-4 py-2 rounded-lg">Cancel</button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full bg-white rounded-xl shadow text-sm">
                  <thead className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Business</th>
                      <th className="px-3 py-2 text-left">Service</th>
                      <th className="px-3 py-2 text-left">Customer</th>
                      <th className="px-3 py-2 text-left">Address</th>
                      <th className="px-3 py-2 text-left">Revenue</th>
                      <th className="px-3 py-2 text-left">Expenses</th>
                      <th className="px-3 py-2 text-left">Payment</th>
                      <th className="px-3 py-2 text-left">Source</th>
                      <th className="px-3 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(j=> editId === j.id ? (
                      <tr key={j.id} className="border-t bg-green-50">
                        <td className="px-3 py-2"><input id={'ejd'+j.id} type="date" defaultValue={j.date} className="px-2 py-1 border rounded w-full text-sm"/></td>
                        <td className="px-3 py-2"><input id={'ejb'+j.id} defaultValue={j.business} className="px-2 py-1 border rounded w-full text-sm"/></td>
                        <td className="px-3 py-2"><input id={'ejs'+j.id} defaultValue={j.service} className="px-2 py-1 border rounded w-full text-sm"/></td>
                        <td className="px-3 py-2"><input id={'ejcn'+j.id} defaultValue={j.customerName} className="px-2 py-1 border rounded w-full text-sm"/></td>
                        <td className="px-3 py-2"><input id={'ejad'+j.id} defaultValue={j.address} className="px-2 py-1 border rounded w-full text-sm"/></td>
                        <td className="px-3 py-2"><input id={'ejr'+j.id} type="number" defaultValue={j.revenue} className="px-2 py-1 border rounded w-full text-sm"/></td>
                        <td className="px-3 py-2"><input id={'eje'+j.id} type="number" defaultValue={j.expenses} className="px-2 py-1 border rounded w-full text-sm"/></td>
                        <td className="px-3 py-2"><input id={'ejpm'+j.id} defaultValue={j.paymentMethod} className="px-2 py-1 border rounded w-full text-sm"/></td>
                        <td className="px-3 py-2"><input id={'ejls'+j.id} defaultValue={j.leadSource} className="px-2 py-1 border rounded w-full text-sm"/></td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button onClick={()=>{
                              const r=Number(document.getElementById('ejr'+j.id).value),e=Number(document.getElementById('eje'+j.id).value),p=r-e,m=r>0?((p/r)*100).toFixed(1):0;
                              setJobs(jobs.map(x=>x.id===j.id?{
                                ...x,
                                date:document.getElementById('ejd'+j.id).value,
                                business:document.getElementById('ejb'+j.id).value,
                                service:document.getElementById('ejs'+j.id).value,
                                customerName:document.getElementById('ejcn'+j.id).value,
                                address:document.getElementById('ejad'+j.id).value,
                                revenue:r,
                                expenses:e,
                                profit:p,
                                margin:m,
                                paymentMethod:document.getElementById('ejpm'+j.id).value,
                                leadSource:document.getElementById('ejls'+j.id).value
                              }:x));
                              setEditId(null);
                            }} className="text-green-600"><Save size={16}/></button>
                            <button onClick={()=>setEditId(null)} className="text-slate-600"><X size={16}/></button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={j.id} className="border-t hover:bg-green-50">
                        <td className="px-3 py-2">{j.date}</td>
                        <td className="px-3 py-2 font-semibold">{j.business}</td>
                        <td className="px-3 py-2">{j.service}</td>
                        <td className="px-3 py-2">{j.customerName}</td>
                        <td className="px-3 py-2 text-xs">{j.address}</td>
                        <td className="px-3 py-2 font-bold text-green-600">${j.revenue}</td>
                        <td className="px-3 py-2">${j.expenses}</td>
                        <td className="px-3 py-2 text-xs">{j.paymentMethod}</td>
                        <td className="px-3 py-2 text-xs">{j.leadSource}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <button onClick={()=>setEditId(j.id)} className="text-blue-500"><Edit2 size={16}/></button>
                            <button onClick={()=>setJobs(jobs.filter(x=>x.id!==j.id))} className="text-red-500"><Trash2 size={16}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {jobs.length === 0 && <div className="text-center py-8 text-slate-500">No jobs yet. Add your first job or import from CSV.</div>}
              </div>
            </div>
          )}

          {tab === 'customers' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Clients ({customers.length} total)</h2>
                <div className="flex gap-2">
                  <button onClick={() => customerFileInputRef.current?.click()} className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2">
                    <Upload size={18}/>Import CSV
                  </button>
                  <button onClick={exportClientsCSV} className="bg-green-600 text-white px-4 py-2 rounded-xl flex items-center gap-2">
                    <Download size={18}/>Export CSV
                  </button>
                  <button onClick={()=>setShowForm(showForm==='customer'?'':'customer')} className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2">
                    <Plus size={18}/>Add Manually
                  </button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
                ℹ️ <strong>Auto-sync enabled:</strong> Clients are automatically added from jobs. You can also add customers manually or import from CSV.
              </div>

              {showForm==='customer' && (
                <div className="bg-blue-50 p-4 rounded-xl border-2 border-blue-200">
                  <div className="grid grid-cols-2 gap-3">
                    <input id="cn" placeholder="Name" className="px-3 py-2 border-2 rounded-lg"/>
                    <input id="cp" placeholder="Phone" className="px-3 py-2 border-2 rounded-lg"/>
                    <input id="ca" placeholder="Address" className="px-3 py-2 border-2 rounded-lg col-span-2"/>
                    <textarea id="cno" placeholder="Notes" className="px-3 py-2 border-2 rounded-lg col-span-2" rows="2"></textarea>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={()=>{
                      const n=document.getElementById('cn').value,p=document.getElementById('cp').value,a=document.getElementById('ca').value,no=document.getElementById('cno').value;
                      if(n&&p){
                        setCustomers([...customers,{id:Date.now(),name:n,phone:p,address:a,notes:no,email:''}]);
                        ['cn','cp','ca','cno'].forEach(id=>document.getElementById(id).value='');
                        setShowForm('');
                      }
                    }} className="bg-blue-600 text-white px-4 py-2 rounded-lg">Add</button>
                    <button onClick={()=>setShowForm('')} className="bg-slate-300 px-4 py-2 rounded-lg">Cancel</button>
                  </div>
                </div>
              )}

              {selectedCustomer && (
                <div className="bg-white p-6 rounded-xl shadow border-2 border-blue-200">
                  <div className="flex justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold">{selectedCustomer.name}</h3>
                      <p className="text-sm text-slate-600">{selectedCustomer.phone}</p>
                      <p className="text-sm text-slate-600">{selectedCustomer.address}</p>
                    </div>
                    <button onClick={()=>setSelectedCustomer(null)}><X size={20}/></button>
                  </div>
                  <div className="mb-4">
                    <div className="text-2xl font-bold text-green-600 mb-2">
                      ${getCustomerLifetimeRevenue(selectedCustomer.name).toFixed(2)}
                    </div>
                    <div className="text-sm text-slate-500">Lifetime Revenue</div>
                  </div>
                  <h4 className="font-semibold mb-2">Job History</h4>
                  <div className="space-y-2 mb-4">
                    {jobs.filter(j => j.customerName && j.customerName.toLowerCase() === selectedCustomer.name.toLowerCase()).map(j => (
                      <div key={j.id} className="bg-slate-50 p-3 rounded">
                        <div className="flex justify-between">
                          <span className="font-semibold">{j.service}</span>
                          <span className="text-green-600 font-bold">${j.revenue}</span>
                        </div>
                        <div className="text-xs text-slate-500">{j.date} • {j.business}</div>
                      </div>
                    ))}
                  </div>
                  <h4 className="font-semibold mb-2">Notes</h4>
                  <textarea
                    value={selectedCustomer.notes || ''}
                    onChange={(e) => {
                      setCustomers(customers.map(c => c.id === selectedCustomer.id ? {...c, notes: e.target.value} : c));
                      setSelectedCustomer({...selectedCustomer, notes: e.target.value});
                    }}
                    className="w-full px-3 py-2 border-2 rounded-lg"
                    rows="3"
                    placeholder="Customer notes..."
                  />
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full bg-white rounded-xl shadow">
                  <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    <tr>
                      <th onClick={() => handleCustomerSort('name')} className="px-3 py-3 text-left cursor-pointer hover:bg-blue-700 transition-colors">
                        <div className="flex items-center gap-1">
                          Name <ArrowUpDown size={14}/>
                        </div>
                      </th>
                      <th onClick={() => handleCustomerSort('phone')} className="px-3 py-3 text-left cursor-pointer hover:bg-blue-700 transition-colors">
                        <div className="flex items-center gap-1">
                          Phone <ArrowUpDown size={14}/>
                        </div>
                      </th>
                      <th onClick={() => handleCustomerSort('address')} className="px-3 py-3 text-left cursor-pointer hover:bg-blue-700 transition-colors">
                        <div className="flex items-center gap-1">
                          Address <ArrowUpDown size={14}/>
                        </div>
                      </th>
                      <th onClick={() => handleCustomerSort('revenue')} className="px-3 py-3 text-left cursor-pointer hover:bg-blue-700 transition-colors">
                        <div className="flex items-center gap-1">
                          Lifetime Revenue <ArrowUpDown size={14}/>
                          {customerSortKey === 'revenue' && <span className="text-xs ml-1">({customerSortDir})</span>}
                        </div>
                      </th>
                      <th onClick={() => handleCustomerSort('jobs')} className="px-3 py-3 text-left cursor-pointer hover:bg-blue-700 transition-colors">
                        <div className="flex items-center gap-1">
                          Jobs <ArrowUpDown size={14}/>
                        </div>
                      </th>
                      <th className="px-3 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedClients().map(c => editId === c.id ? (
                      <tr key={c.id} className="border-t bg-blue-50">
                        <td className="px-3 py-2"><input id={'ecn'+c.id} defaultValue={c.name} className="px-2 py-1 border rounded w-full"/></td>
                        <td className="px-3 py-2"><input id={'ecp'+c.id} defaultValue={c.phone} className="px-2 py-1 border rounded w-full"/></td>
                        <td className="px-3 py-2"><input id={'eca'+c.id} defaultValue={c.address} className="px-2 py-1 border rounded w-full"/></td>
                        <td className="px-3 py-2 font-bold text-green-600">${getCustomerLifetimeRevenue(c.name).toFixed(2)}</td>
                        <td className="px-3 py-2">{jobs.filter(j => j.customerName && j.customerName.toLowerCase() === c.name.toLowerCase()).length}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button onClick={()=>{
                              setCustomers(customers.map(x=>x.id===c.id?{...x,name:document.getElementById('ecn'+c.id).value,phone:document.getElementById('ecp'+c.id).value,address:document.getElementById('eca'+c.id).value}:x));
                              setEditId(null);
                            }} className="text-green-600"><Save size={16}/></button>
                            <button onClick={()=>setEditId(null)} className="text-slate-600"><X size={16}/></button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={c.id} className="border-t hover:bg-blue-50 cursor-pointer" onClick={()=>setSelectedCustomer(c)}>
                        <td className="px-3 py-3 font-semibold">{c.name}</td>
                        <td className="px-3 py-3">{c.phone}</td>
                        <td className="px-3 py-3 text-sm">{c.address}</td>
                        <td className="px-3 py-3 font-bold text-green-600">${getCustomerLifetimeRevenue(c.name).toFixed(2)}</td>
                        <td className="px-3 py-3">{jobs.filter(j => j.customerName && j.customerName.toLowerCase() === c.name.toLowerCase()).length} jobs</td>
                        <td className="px-3 py-3">
                          <div className="flex gap-2">
                            <button onClick={(e)=>{e.stopPropagation();setEditId(c.id);}} className="text-blue-500"><Edit2 size={16}/></button>
                            <button onClick={(e)=>{e.stopPropagation();setCustomers(customers.filter(x=>x.id!==c.id));}} className="text-red-500"><Trash2 size={16}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {customers.length === 0 && <div className="text-center py-8 text-slate-500">No customers yet. Clients are automatically added when you log jobs, or you can add them manually.</div>}
              </div>
            </div>
          )}

          {tab === 'contractors' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Contractors</h2>
                <button onClick={()=>setShowForm(showForm==='contractor'?'':'contractor')} className="bg-purple-600 text-white px-4 py-2 rounded-xl flex items-center gap-2">
                  <Plus size={18}/>Add
                </button>
              </div>

              {showForm==='contractor' && (
                <div className="bg-purple-50 p-4 rounded-xl border-2 border-purple-200">
                  <div className="grid grid-cols-2 gap-3">
                    <input id="ctn" placeholder="Name" className="px-3 py-2 border-2 rounded-lg"/>
                    <input id="ctp" placeholder="Phone" className="px-3 py-2 border-2 rounded-lg"/>
                    <input id="cts" placeholder="Skills" className="px-3 py-2 border-2 rounded-lg"/>
                    <input id="ctr" type="number" placeholder="Rate" className="px-3 py-2 border-2 rounded-lg"/>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={()=>{
                      const n=document.getElementById('ctn').value,p=document.getElementById('ctp').value,s=document.getElementById('cts').value,r=document.getElementById('ctr').value;
                      if(n&&p&&s&&r){
                        setContractors([...contractors,{id:Date.now(),name:n,phone:p,skills:s,rate:r,status:'available'}]);
                        ['ctn','ctp','cts','ctr'].forEach(id=>document.getElementById(id).value='');
                        setShowForm('');
                      }
                    }} className="bg-purple-600 text-white px-4 py-2 rounded-lg">Add</button>
                    <button onClick={()=>setShowForm('')} className="bg-slate-300 px-4 py-2 rounded-lg">Cancel</button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contractors.map(c => (
                  <div key={c.id} className="bg-white p-5 rounded-xl shadow">
                    <div className="flex justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-lg">{c.name}</h3>
                        <p className="text-sm text-slate-600">{c.phone}</p>
                      </div>
                      <button onClick={()=>setContractors(contractors.filter(x=>x.id!==c.id))} className="text-red-500">
                        <Trash2 size={16}/>
                      </button>
                    </div>
                    <div className="text-sm"><strong>Skills:</strong> {c.skills}</div>
                    <div className="text-sm"><strong>Rate:</strong> ${c.rate}/hr</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
