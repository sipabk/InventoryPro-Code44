import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Eye, LogIn, LogOut, Download, Upload, Check, X, Activity } from "lucide-react";
import { format } from 'date-fns';
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
};

export default function ActivityLogs() {
  const { data: logs = [] } = useQuery({
    queryKey: ['activityLogs'],
    queryFn: () => base44.entities.ActivityLog.list('-created_date', 200),
  });

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
    { header: 'User', accessor: 'user_name' },
    { header: 'Entity', accessor: 'entity_type' },
    { header: 'Item', accessor: 'entity_name', cellClassName: 'max-w-48 truncate' },
    { header: 'Details', accessor: 'details', cellClassName: 'max-w-64 truncate' },
    { 
      header: 'Time', 
      accessor: (row) => row.created_date ? format(new Date(row.created_date), 'MMM d, yyyy HH:mm') : '-'
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Activity Logs</h1>
          <p className="text-slate-500 mt-1">Track all system activities</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <DataTable 
          data={logs} 
          columns={columns} 
          searchPlaceholder="Search logs..." 
          emptyMessage="No activity logs found"
          pageSize={25}
        />
      </div>
    </div>
  );
}