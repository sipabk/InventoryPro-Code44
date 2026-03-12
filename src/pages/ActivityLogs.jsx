import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Eye, LogIn, LogOut, Download, Upload, Check, X, Activity, Filter, RefreshCw, FileText, Package, ArrowRightLeft, Shield, Users, Warehouse, Tag } from "lucide-react";
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import DataTable from '@/components/common/DataTable';

const actionIcons = {
  create: Plus,
  read: Eye,
  update: Edit2,
  delete: Trash2,
  login: LogIn,
  logout: LogOut,
  export: Download,
  import: Upload,
  approve: Check,
  reject: X,
  issue: ArrowRightLeft,
  receipt: Package,
  adjustment: RefreshCw,
};

const actionColors = {
  create: 'bg-emerald-100 text-emerald-700',
  read: 'bg-blue-100 text-blue-700',
  update: 'bg-amber-100 text-amber-700',
  delete: 'bg-red-100 text-red-700',
  login: 'bg-purple-100 text-purple-700',
  logout: 'bg-slate-100 text-slate-700',
  export: 'bg-cyan-100 text-cyan-700',
  import: 'bg-indigo-100 text-indigo-700',
  approve: 'bg-emerald-100 text-emerald-700',
  reject: 'bg-red-100 text-red-700',
  issue: 'bg-orange-100 text-orange-700',
  receipt: 'bg-teal-100 text-teal-700',
  adjustment: 'bg-pink-100 text-pink-700',
};

const entityIcons = {
  Product: Package,
  StockTransaction: ArrowRightLeft,
  Warranty: Shield,
  User: Users,
  Warehouse: Warehouse,
  Category: Tag,
  Supplier: Users,
};

const ACTION_TYPES = [
  { value: 'create', label: 'New Entry / Create' },
  { value: 'update', label: 'Edit / Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'issue', label: 'Issue / Issuance' },
  { value: 'import', label: 'Import' },
  { value: 'export', label: 'Export' },
  { value: 'approve', label: 'Approve' },
  { value: 'reject', label: 'Reject' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
];

const ENTITY_TYPES = [
  { value: 'Product', label: 'Products' },
  { value: 'StockTransaction', label: 'Stock Transactions' },
  { value: 'Warranty', label: 'Warranties' },
  { value: 'Category', label: 'Categories' },
  { value: 'Supplier', label: 'Suppliers' },
  { value: 'Warehouse', label: 'Warehouses' },
  { value: 'User', label: 'Users' },
  { value: 'PurchaseOrder', label: 'Purchase Orders' },
  { value: 'StockAdjustment', label: 'Stock Adjustments' },
];

export default function ActivityLogs() {
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['activityLogs'],
    queryFn: () => base44.entities.ActivityLog.list('-created_date', 500),
  });

  // Get unique users for filter dropdown
  const uniqueUsers = useMemo(() => {
    const users = new Set();
    logs.forEach(log => {
      if (log.user_name) users.add(log.user_name);
    });
    return Array.from(users).sort();
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Action filter
      if (actionFilter && log.action !== actionFilter) return false;
      
      // Entity filter
      if (entityFilter && log.entity_type !== entityFilter) return false;
      
      // User filter
      if (userFilter && log.user_name !== userFilter) return false;
      
      // Date range filter
      if (dateFrom || dateTo) {
        const logDate = log.created_date ? parseISO(log.created_date) : null;
        if (!logDate) return false;
        
        if (dateFrom && dateTo) {
          if (!isWithinInterval(logDate, { 
            start: startOfDay(parseISO(dateFrom)), 
            end: endOfDay(parseISO(dateTo)) 
          })) return false;
        } else if (dateFrom) {
          if (logDate < startOfDay(parseISO(dateFrom))) return false;
        } else if (dateTo) {
          if (logDate > endOfDay(parseISO(dateTo))) return false;
        }
      }
      
      return true;
    });
  }, [logs, actionFilter, entityFilter, userFilter, dateFrom, dateTo]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    const todayLogs = logs.filter(log => {
      if (!log.created_date) return false;
      const logDate = parseISO(log.created_date);
      return logDate.toDateString() === today.toDateString();
    });
    
    return {
      total: logs.length,
      today: todayLogs.length,
      creates: logs.filter(l => l.action === 'create').length,
      updates: logs.filter(l => l.action === 'update').length,
      deletes: logs.filter(l => l.action === 'delete').length,
    };
  }, [logs]);

  const clearFilters = () => {
    setActionFilter('');
    setEntityFilter('');
    setUserFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const hasFilters = actionFilter || entityFilter || userFilter || dateFrom || dateTo;

  const columns = [
    { 
      header: 'Action', 
      cell: (row) => {
        const Icon = actionIcons[row.action] || Activity;
        return (
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${actionColors[row.action] || 'bg-slate-100'}`}>
              <Icon className="w-4 h-4" />
            </div>
            <Badge className={actionColors[row.action]}>{row.action}</Badge>
          </div>
        );
      }
    },
    { 
      header: 'Entity', 
      cell: (row) => {
        const EntityIcon = entityIcons[row.entity_type] || FileText;
        return (
          <div className="flex items-center gap-2">
            <EntityIcon className="w-4 h-4 text-slate-400" />
            <span className="text-sm">{row.entity_type}</span>
          </div>
        );
      }
    },
    { header: 'User', accessor: 'user_name', cellClassName: 'font-medium' },
    { header: 'Item', accessor: 'entity_name', cellClassName: 'max-w-48 truncate' },
    { 
      header: 'Details', 
      cell: (row) => (
        <p className="max-w-64 truncate text-sm text-slate-600" title={row.details}>
          {row.details || '-'}
        </p>
      )
    },
    { 
      header: 'Time', 
      cell: (row) => (
        <div className="text-sm">
          <p>{row.created_date ? format(new Date(row.created_date), 'MMM d, yyyy') : '-'}</p>
          <p className="text-slate-500">{row.created_date ? format(new Date(row.created_date), 'HH:mm:ss') : ''}</p>
        </div>
      )
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Activity Logs</h1>
          <p className="text-slate-500 mt-1">Track all system activities and changes</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase">Total Logs</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Activity className="w-8 h-8 text-slate-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase">Today</p>
                <p className="text-2xl font-bold">{stats.today}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase">Creates</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.creates}</p>
              </div>
              <Plus className="w-8 h-8 text-emerald-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase">Updates</p>
                <p className="text-2xl font-bold text-amber-600">{stats.updates}</p>
              </div>
              <Edit2 className="w-8 h-8 text-amber-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase">Deletes</p>
                <p className="text-2xl font-bold text-red-600">{stats.deletes}</p>
              </div>
              <Trash2 className="w-8 h-8 text-red-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label>Action Type</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Actions</SelectItem>
                  {ACTION_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Entity Type</Label>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Entities</SelectItem>
                  {ENTITY_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>User</Label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Users</SelectItem>
                  {uniqueUsers.map(user => (
                    <SelectItem key={user} value={user}>{user}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label>Date To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          {hasFilters && (
            <div className="mt-4 flex items-center gap-2">
              <Badge variant="secondary">{filteredLogs.length} results</Badge>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" /> Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
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
