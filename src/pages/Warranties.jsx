import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Shield, AlertTriangle, CheckCircle, XCircle, Clock, Download } from "lucide-react";
import { format, differenceInDays, addMonths } from 'date-fns';
import DataTable from '@/components/common/DataTable';
import FormModal from '@/components/common/FormModal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { toast } from "sonner";

const WARRANTY_TYPES = ['manufacturer', 'extended', 'third_party', 'in_house'];
const STATUSES = ['active', 'expired', 'expiring_soon', 'claimed', 'void'];

const statusConfig = {
  active: { icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700' },
  expiring_soon: { icon: AlertTriangle, color: 'bg-amber-100 text-amber-700' },
  expired: { icon: XCircle, color: 'bg-red-100 text-red-700' },
  claimed: { icon: Clock, color: 'bg-blue-100 text-blue-700' },
  void: { icon: XCircle, color: 'bg-slate-100 text-slate-700' },
};

const initialWarranty = {
  product_id: '', serial_number: '', warranty_provider: '', provider_contact: '',
  provider_email: '', provider_phone: '', start_date: '', end_date: '',
  duration_months: 12, warranty_type: 'manufacturer', coverage_details: '',
  terms_conditions: '', status: 'active', document_url: ''
};

export default function Warranties() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingWarranty, setEditingWarranty] = useState(null);
  const [formData, setFormData] = useState(initialWarranty);
  
  const queryClient = useQueryClient();

  const { data: warranties = [] } = useQuery({
    queryKey: ['warranties'],
    queryFn: () => base44.entities.Warranty.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Warranty.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warranties'] });
      setModalOpen(false);
      toast.success('Warranty created successfully');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Warranty.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warranties'] });
      setModalOpen(false);
      toast.success('Warranty updated successfully');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Warranty.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warranties'] });
      setDeleteOpen(false);
      toast.success('Warranty deleted successfully');
    },
  });

  const handleSubmit = () => {
    // Auto-calculate status
    const daysLeft = differenceInDays(new Date(formData.end_date), new Date());
    let status = formData.status;
    if (daysLeft < 0) status = 'expired';
    else if (daysLeft <= 30) status = 'expiring_soon';
    else if (status !== 'claimed' && status !== 'void') status = 'active';

 