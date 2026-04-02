import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function ScheduledReportForm({ report, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    report_name: '',
    report_type: 'stock_levels',
    frequency: 'weekly',
    recipients: [],
    status: 'active',
    filters: {}
  });

  const [newRecipient, setNewRecipient] = useState('');

  useEffect(() => {
    if (report) {
      setFormData(report.data || report);
    }
  }, [report]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (report) {
        await base44.entities.ScheduledReport.update(report.id, formData);
      } else {
        await base44.entities.ScheduledReport.create(formData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledReports'] });
      toast.success(report ? 'Report updated' : 'Report scheduled');
      onClose();
    }
  });

  const addRecipient = () => {
    if (newRecipient && /\S+@\S+\.\S+/.test(newRecipient)) {
      setFormData({
        ...formData,
        recipients: [...(formData.recipients || []), newRecipient]
      });
      setNewRecipient('');
    } else {
      toast.error('Please enter a valid email address');
    }
  };

  const removeRecipient = (email) => {
    setFormData({
      ...formData,
      recipients: formData.recipients.filter(r => r !== email)
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{report ? 'Edit Scheduled Report' : 'New Scheduled Report'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Report Name *</Label>
            <Input
              value={formData.report_name}
              onChange={(e) => setFormData({ ...formData, report_name: e.target.value })}
              placeholder="e.g., Weekly Stock Summary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Report Type *</Label>
              <Select value={formData.report_type} onValueChange={(v) => setFormData({ ...formData, report_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock_levels">Stock Levels</SelectItem>
                  <SelectItem value="aging_analysis">Aging Analysis</SelectItem>
                  <SelectItem value="stock_movement">Stock Movement</SelectItem>
                  <SelectItem value="valuation">Valuation Report</SelectItem>
                  <SelectItem value="supplier_performance">Supplier Performance</SelectItem>
                  <SelectItem value="warranty_expiry">Warranty Expiry</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Frequency *</Label>
              <Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Email Recipients</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                placeholder="email@example.com"
                onKeyPress={(e) => e.key === 'Enter' && addRecipient()}
              />
              <Button onClick={addRecipient} size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(formData.recipients || []).map((email, idx) => (
                <div key={idx} className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-sm">
                  {email}
                  <button onClick={() => removeRecipient(email)} className="ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !formData.report_name}
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? 'Saving...' : 'Save Schedule'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}