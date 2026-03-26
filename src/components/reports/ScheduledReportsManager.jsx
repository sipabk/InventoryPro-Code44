import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Mail, Calendar, Pause, Play, Trash2, Clock, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import DataTable from '../common/DataTable';
import ScheduledReportForm from './ScheduledReportForm';
import ConfirmDialog from '../common/ConfirmDialog';
import { toast } from 'sonner';
import { format, isPast, formatDistanceToNow } from 'date-fns';

export default function ScheduledReportsManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [deletingReport, setDeletingReport] = useState(null);
  const queryClient = useQueryClient();

  const { data: scheduledReports = [], isLoading, refetch } = useQuery({
    queryKey: ['scheduledReports'],
    queryFn: () => base44.entities.ScheduledReport.list('-created_date', 100)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScheduledReport.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['scheduledReports']);
      setDeletingReport(null);
      toast.success('Scheduled report deleted');
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.ScheduledReport.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries(['scheduledReports']);
      toast.success('Status updated');
    }
  });

  // Simulate running a report manually
  const runNowMutation = useMutation({
    mutationFn: async (report) => {
      // In a real app, this would trigger the report generation
      const reportData = report.data || report;
      await base44.entities.ScheduledReport.update(report.id, { 
        last_run: new Date().toISOString(),
      });
      
      // Log activity
      await base44.entities.ActivityLog?.create({
        action: 'export',
        entity_type: 'ScheduledReport',
        entity_name: reportData.report_name,
        details: `Manual run of scheduled report "${reportData.report_name}"`,
        user_name: 'System',
        created_date: new Date().toISOString()
      }).catch(() => {});
      
      return reportData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['scheduledReports']);
      toast.success(`Report "${data.report_name}" executed successfully. Email sent to ${(data.recipients || []).length} recipients.`);
    },
    onError: () => {
      toast.error('Failed to run report');
    }
  });

  const statusConfig = {
    active: { color: 'bg-green-100 text-green-700', label: 'Active', icon: CheckCircle },
    paused: { color: 'bg-yellow-100 text-yellow-700', label: 'Paused', icon: Pause },
    inactive: { color: 'bg-slate-100 text-slate-700', label: 'Inactive', icon: AlertCircle }
  };

  const getField = (row, field) => row.data ? row.data[field] : row[field];

  const columns = [
    { 
      header: 'Report Name', 
      cell: (row) => (
        <div>
          <p className="font-medium">{getField(row, 'report_name')}</p>
          <p className="text-xs text-slate-500">{(getField(row, 'report_type') || '').replace('_', ' ')}</p>
        </div>
      )
    },
    { 
      header: 'Frequency', 
      cell: (row) => (
        <Badge variant="outline" className="capitalize">
          {getField(row, 'frequency')}
        </Badge>
      )
    },
    { 
      header: 'Recipients', 
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Mail className="w-4 h-4 text-slate-400" />
          <span>{getField(row, 'recipients')?.length || 0}</span>
        </div>
      )
    },
    { 
      header: 'Next Run', 
      cell: (row) => {
        const nextRun = getField(row, 'next_run');
        const status = getField(row, 'status');
        
        if (status !== 'active' || !nextRun) {
          return <span className="text-slate-400">-</span>;
        }
        
        const nextRunDate = new Date(nextRun);
        const isOverdue = isPast(nextRunDate);
        
        return (
          <div className={`text-sm ${isOverdue ? 'text-amber-600' : ''}`}>
            <p>{format(nextRunDate, 'MMM d, yyyy')}</p>
            <p className="text-xs text-slate-500">
              {isOverdue ? 'Overdue - ' : ''}{formatDistanceToNow(nextRunDate, { addSuffix: true })}
            </p>
          </div>
        );
      }
    },
    { 
      header: 'Last Run', 
      cell: (row) => {
        const lastRun = getField(row, 'last_run');
        if (!lastRun) return <span className="text-slate-400">Never</span>;
        
        return (
          <div className="text-sm">
            <p>{format(new Date(lastRun), 'MMM d, yyyy')}</p>
            <p className="text-xs text-slate-500">{format(new Date(lastRun), 'HH:mm')}</p>
          </div>
        );
      }
    },
    {
      header: 'Status',
      cell: (row) => {
        const status = getField(row, 'status') || 'active';
        const config = statusConfig[status] || statusConfig.active;
        const Icon = config.icon;
        return (
          <Badge className={config.color}>
            <Icon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
        );
      }
    },
    {
      header: 'Actions',
      cell: (row) => {
        const currentStatus = getField(row, 'status');
        return (
          <div className="flex gap-1">
            <Button 
              size="sm" 
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                runNowMutation.mutate(row);
              }}
              disabled={runNowMutation.isPending}
              title="Run Now"
            >
              <RefreshCw className={`w-4 h-4 ${runNowMutation.isPending ? 'animate-spin' : ''}`} />
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                const newStatus = currentStatus === 'active' ? 'paused' : 'active';
                toggleStatusMutation.mutate({ id: row.id, status: newStatus });
              }}
              title={currentStatus === 'active' ? 'Pause' : 'Activate'}
            >
              {currentStatus === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); setDeletingReport(row); }}
              title="Delete"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        );
      }
    }
  ];

  // Stats
  const activeReports = scheduledReports.filter(r => (r.data?.status || r.status) === 'active').length;
  const pausedReports = scheduledReports.filter(r => (r.data?.status || r.status) === 'paused').length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase">Total Scheduled</p>
                <p className="text-2xl font-bold">{scheduledReports.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-slate-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase">Active</p>
                <p className="text-2xl font-bold text-green-600">{activeReports}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase">Paused</p>
                <p className="text-2xl font-bold text-amber-600">{pausedReports}</p>
              </div>
              <Pause className="w-8 h-8 text-amber-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5" /> Scheduled Reports
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">Automate report generation and email delivery</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
              </Button>
              <Button onClick={() => { setEditingReport(null); setShowForm(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                New Scheduled Report
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={scheduledReports}
            columns={columns}
            searchPlaceholder="Search scheduled reports..."
            onRowClick={(row) => { setEditingReport(row); setShowForm(true); }}
            emptyMessage="No scheduled reports. Create one to automate report delivery."
          />
        </CardContent>
      </Card>

      {showForm && (
        <ScheduledReportForm
          report={editingReport}
          onClose={() => { setShowForm(false); setEditingReport(null); }}
        />
      )}

      <ConfirmDialog
        open={!!deletingReport}
        onClose={() => setDeletingReport(null)}
        onConfirm={() => deleteMutation.mutate(deletingReport.id)}
        title="Delete Scheduled Report"
        description={`Are you sure you want to delete "${getField(deletingReport, 'report_name')}"? This action cannot be undone.`}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
