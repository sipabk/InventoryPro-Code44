import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit2, Trash2, Eye, LogIn, LogOut, Download, Upload, Check, X, Activity, FileText, Package, Warehouse, Users, ShoppingCart, Shield, AlertTriangle, RefreshCw, Filter, Calendar } from "lucide-react";
import { format, isWithinInterval, startOfDay, endOfDay, subDays, subWeeks, subMonths } from 'date-fns';
import DataTable from '@/components/common/DataTable';
import { toast } from 'sonner';

const ACTION_TYPES = [
  { value: 'create', label: 'New Entry', icon: Plus, color: 'bg-emerald-100 text-emerald-700' },
  { value: 'read', label: 'View', icon: Eye, color: 'bg-blue-100 text-blue-700' },
  { value: 'update', label: 'Edit', icon: Edit2, color: 'bg-amber-100 text-amber-700' },
  { value: 'delete', label: 'Delete', icon: Trash2, color: 'bg-red-100 text-red-700' },
  { value: 'login', label: 'Login', icon: LogIn, color: 'bg-purple-100 text-purple-700' },
  { value: 'logout', label: 'Logout', icon: LogOut, color: 'bg-slate-100 text-slate-700' },
  { value: 'export', label: 'Export', icon: Download, color: 'bg-cyan-100 text-cyan-700' },
  { value: 'import', label: 'Import', icon: Upload, color: 'bg-indigo-100 text-indigo-700' },
  { value: 'approve', label: 'Approve', icon: Check, color: 'bg-emerald-100 text-emerald-700' },
  { value: 'reject', label: 'Reject', icon: X, color: 'bg-red-100 text-red-700' },
  { value: 'receipt', label: 'Receipt', icon: FileText, color: 'bg-green-100 text-green-700' },
  { value: 'issue', label: 'Issue/Issuance', icon: Package, color: 'bg-orange-100 text-orange-700' },
  { value: 'stock_in', label: 'Stock In', icon: Download, color: 'bg-emerald-100 text-emerald-700' },
  { value: 'stock_out', label: 'Stock Out', icon: Upload, color: 'bg-amber-100 text-amber-700' },
  { value: 'transfer', label: 'Transfer', icon: RefreshCw, color: 'bg-blue-100 text-blue-700' },
  { value: 'adjustment', label: 'Adjustment', icon: Edit2, color: 'bg-purple-100 text-purple-700' },
  { value: 'faulty_return', label: 'Faulty Return', icon: AlertTriangle, color: 'bg-red-100 text-red-700' },
  { value: 'report_generated', label: 'Report Generated', icon: FileText, color: 'bg-cyan-100 text-cyan-700' },
  { value: 'clear_all_data', label: 'Data Cleared', icon: Trash2, color: 'bg-red-100 text-red-700' },
];

const ENTITY_TYPES = [
  { value: 'Product', label: 'Products', icon: Package },
  { value: 'Category', label: 'Categories', icon: Package },
  { value: 'Warehouse', label: 'Warehouses', icon: Warehouse },
  { value: 'Supplier', label: 'Suppliers', icon: Users },
  { value: 'StockTransaction', label: 'Transactions', icon: ShoppingCart },
  { value: 'Warranty', label: 'Warranties', icon: Shield },
  { value: 'PurchaseOrder', label: 'Purchase Orders', icon: ShoppingCart },
  { value: 'User', label: 'Users', icon: Users },
  { value: 'ScheduledReport', label: 'Reports', icon: FileText },
  { value: 'System', label: 'System', icon: Activity },
];

const DATE_RANGES = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Range' },
];

export default function ActivityLogs() {
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['activityLogs'],
    queryFn: () => base44.entities.ActivityLog.list('-created_date', 500),
  });

  // Get unique users from logs
  const uniqueUsers = useMemo(() => {
    const users = new Set();
    logs.forEach(log => {
      const data = log.data || log;
      if (data.user_name) users.add(data.user_name);
    });
    return Array.from(users);
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const data = log.data || log;
      
      // Action filter
      if (actionFilter !== 'all' && data.action !== actionFilter) return false;
      
      // Entity filter
      if (entityFilter !== 'all' && data.entity_type !== entityFilter) return false;
      
      // User filter
      if (userFilter !== 'all' && data.user_name !== userFilter) return false;
      
      // Date filter
      if (dateRange !== 'all' && data.created_date) {
        const logDate = new Date(data.created_date);
        const now = new Date();
        
        switch (dateRange) {
          case 'today':
            if (!isWithinInterval(logDate, { start: startOfDay(now), end: endOfDay(now) })) return false;
            break;
          case 'yesterday':
            const yesterday = subDays(now, 1);
            if (!isWithinInterval(logDate, { start: startOfDay(yesterday), end: endOfDay(yesterday) })) return false;
            break;
          case 'week':
            if (!isWithinInterval(logDate, { start: subWeeks(now, 1), end: now })) return false;
            break;
          case 'month':
            if (!isWithinInterval(logDate, { start: subMonths(now, 1), end: now })) return false;
            break;
          case 'custom':
            if (customDateFrom && customDateTo) {
              if (!isWithinInterval(logDate, { 
                start: startOfDay(new Date(customDateFrom)), 
                end: endOfDay(new Date(customDateTo)) 
              })) return false;
            }
            break;
        }
      }
      
      return true;
    });
  }, [logs, actionFilter, entityFilter, userFilter, dateRange, customDateFrom, customDateTo]);

  // Statistics
  const stats = useMemo(() => {
    const today = new Date();
    const todayLogs = logs.filter(log => {
      const data = log.data || log;
      return data.created_date && isWithinInterval(new Date(data.created_date), { 
        start: startOfDay(today), 
        end: endOfDay(today) 
      });
    });

    const actionCounts = {};
    logs.forEach(log => {
      const action = (log.data || log).action;
      actionCounts[action] = (actionCounts[action] || 0) + 1;
    });

    return {
      total: logs.length,
      today: todayLogs.length,
      creates: actionCounts['create'] || 0,
      updates: actionCounts['update'] || 0,
      deletes: actionCounts['delete'] || 0,
      imports: actionCounts['import'] || 0,
      exports: actionCounts['export'] || 0,
    };
  }, [logs]);

  const exportLogs = () => {
    const csv = [
      'Timestamp,Action,User,Entity Type,Entity Name,Details',
      ...filteredLogs.map(log => {
        const data = log.data || log;
        return [
          data.created_date,
          data.action,
          data.user_name,
          data.entity_type,
          `"${(data.entity_name || '').replace(/"/g, '""')}"`,
          `"${(data.details || '').replace(/"/g, '""')}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    toast.success('Logs exported successfully');
  };

  const clearFilters = () => {
    setActionFilter('all');
    setEntityFilter('all');
    setUserFilter('all');
    setDateRange('all');
    setCustomDateFrom('');
    setCustomDateTo('');
  };

  const getActionConfig = (action) => {
    return ACTION_TYPES.find(a => a.value === action) || { 
      icon: Activity, 
      color: 'bg-slate-100 text-slate-700',
      label: action 
    };
  };

  const columns = [
    { 
      header: 'Action', 
      cell: (row) => {
        const data = row.data || row;
        const config = getActionConfig(data.action);
        const Icon = config.icon;
        return (
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <Badge className={config.color}>{config.label || data.action}</Badge>
          </div>
        );
      }
    },
    { 
      header: 'User', 
      cell: (row) => {
        const data = row.data || row;
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium">
              {(data.user_name || 'U')[0].toUpperCase()}
            </div>
            <span>{data.user_name || 'Unknown'}</span>
          </div>
        );
      }
    },
    { 
      header: 'Entity', 
      cell: (row) => {
        const data = row.data || row;
        const entityConfig = ENTITY_TYPES.find(e => e.value === data.entity_type);
        const Icon = entityConfig?.icon || Package;
        return (
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-slate-400" />
            <span>{data.entity_type}</span>
          </div>
        );
      }
    },
    { 
      header: 'Item', 
      accessor: (row) => (row.data || row).entity_name,
      cellClassName: 'max-w-48 truncate' 
    },
    { 
      header: 'Details', 
      accessor: (row) => (row.data || row).details, 
      cellClassName: 'max-w-64 truncate text-slate-500 text-sm' 
    },
    { 
      header: 'Time', 
      cell: (row) => {
        const data = row.data || row;
        return data.created_date ? (
          <div className="text-sm">
            <p>{format(new Date(data.created_date), 'MMM d, yyyy')}</p>
            <p className="text-slate-500">{format(new Date(data.created_date), 'HH:mm:ss')}</p>
          </div>
        ) : '-';
      }
    },
  ];

  const hasActiveFilters = actionFilter !== 'all' || entityFilter !== 'all' || userFilter !== 'all' || dateRange !== 'all';

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Activity Logs</h1>
          <p className="text-slate-500 mt-1">Track all system activities and changes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-2" /> 
            Filters
            {hasActiveFilters && (
              <Badge className="ml-2 bg-blue-500 text-white text-xs">Active</Badge>
            )}
          </Button>
          <Button variant="outline" onClick={exportLogs}>
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase">Total Logs</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase">Today</p>
          <p className="text-2xl font-bold text-blue-600">{stats.today}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase">Creates</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.creates}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase">Updates</p>
          <p className="text-2xl font-bold text-amber-600">{stats.updates}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase">Deletes</p>
          <p className="text-2xl font-bold text-red-600">{stats.deletes}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase">Imports</p>
          <p className="text-2xl font-bold text-indigo-600">{stats.imports}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase">Exports</p>
          <p className="text-2xl font-bold text-cyan-600">{stats.exports}</p>
        </Card>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Filter className="w-5 h-5" /> Filters
              </span>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-1" /> Clear All
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Label className="text-xs">Action Type</Label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {ACTION_TYPES.map(action => (
                      <SelectItem key={action.value} value={action.value}>
                        {action.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Entity Type</Label>
                <Select value={entityFilter} onValueChange={setEntityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Entities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Entities</SelectItem>
                    {ENTITY_TYPES.map(entity => (
                      <SelectItem key={entity.value} value={entity.value}>
                        {entity.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">User</Label>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {uniqueUsers.map(user => (
                      <SelectItem key={user} value={user}>{user}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Date Range</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Time" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_RANGES.map(range => (
                      <SelectItem key={range.value} value={range.value}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {dateRange === 'custom' && (
                <div className="lg:col-span-1">
                  <Label className="text-xs">Custom Range</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={customDateFrom}
                      onChange={(e) => setCustomDateFrom(e.target.value)}
                      className="text-sm"
                    />
                    <Input
                      type="date"
                      value={customDateTo}
                      onChange={(e) => setCustomDateTo(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-500">
            Showing {filteredLogs.length} of {logs.length} logs
          </p>
        </div>
        <DataTable 
          data={filteredLogs} 
          columns={columns} 
          searchPlaceholder="Search logs..." 
          emptyMessage="No activity logs found"
          pageSize={25}
        />
      </div>
    </div>
  );
}
