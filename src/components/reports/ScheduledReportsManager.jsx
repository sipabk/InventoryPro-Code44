import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Mail, Calendar, Pause, Play, Trash2 } from 'lucide-react';
import DataTable from '../common/DataTable';
import ScheduledReportForm from './ScheduledReportForm';
import ConfirmDialog from '../common/ConfirmDialog';
import { toast } from 'sonner';

export default function ScheduledReportsManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [deletingReport, setDeletingReport] = useState(null);
  const queryClient = useQueryClient();

  const { data: scheduledReports = [] } = useQuery({
    queryKey: ['scheduledReports'],
    queryFn: () => base44.entities.ScheduledReport.list('-created_date', 100)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScheduledReport.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledReports'] });
      setDeletingReport(null);
      toast.success('Scheduled report deleted');
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.ScheduledReport.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledReports'] });
      toast.success('Status updated');
    }
  });

  const statusConfig = {
    active: { color: 'bg-green-100 text-green-700', label: 'Active' },
    paused: { color: 'bg-yellow-100 text-yellow-700', label: 'Paused' },
    inactive: { color: 'bg-slate-100 text-slate-700', label: 'Inactive' }
  };

  const getField = (row, field) => row.data ? row.data[field] : row[field];

  const columns = [
    { header: 'Report Name', accessor: (row) => getField(row, 'report_name') },
    { header: 'Type', accessor: (row) => (getField(row, 'report_type') || '').replace('_', ' ') },
    { header: 'Frequency', accessor: (row) => getField(row, 'frequency') },
    {
      header: 'Recipients',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Mail className="w-4 h-4" />
          {getField(row, 'recipients')?.length || 0}
        </div>
      )
    },
    { header: 'Last Run', accessor: (row) => getField(row, 'last_run') || 'Never' },
    {
      header: 'Status',
      cell: (row) => {
        const status = getField(row, 'status') || 'active';
        const config = statusConfig[status] || statusConfig.active;
        return <Badge className={config.color}>{config.label}</Badge>;
      }
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              const currentStatus = getField(row, 'status');
              const newStatus = currentStatus === 'active' ? 'paused' : 'active';
              toggleStatusMutation.mutate({ id: row.id, status: newStatus });
            }}
          >
            {getField(row, 'status') === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => { e.stopPropagation(); setDeletingReport(row); }}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5" /> Scheduled Reports
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">Automate report generation and email delivery</p>
            </div>
            <Button onClick={() => { setEditingReport(null); setShowForm(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              New Scheduled Report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            data={scheduledReports}
            columns={columns}
            searchPlaceholder="Search scheduled reports..."
            onRowClick={(row) => { setEditingReport(row); setShowForm(true); }}
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
        description={`Are you sure you want to delete "${deletingReport ? getField(deletingReport, 'report_name') : ''}"?`}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}