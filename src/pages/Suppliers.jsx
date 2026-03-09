import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Building2, Star } from "lucide-react";
import DataTable from '@/components/common/DataTable';
import FormModal from '@/components/common/FormModal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useCurrencies } from '@/components/common/useCurrencies';
import { toast } from "sonner";
const PAYMENT_TERMS = ['net_30', 'net_60', 'net_90', 'immediate', 'cod'];

const initialSupplier = {
  name: '', code: '', contact_person: '', email: '', phone: '',
  address: '', city: '', country: '', payment_terms: 'net_30',
  currency: 'USD', tax_id: '', rating: 3, status: 'active'
};

export default function Suppliers() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [formData, setFormData] = useState(initialSupplier);
  
  const queryClient = useQueryClient();
  const currencies = useCurrencies();

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Supplier.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setModalOpen(false);
      toast.success('Supplier created successfully');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Supplier.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setModalOpen(false);
      toast.success('Supplier updated successfully');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Supplier.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setDeleteOpen(false);
      toast.success('Supplier deleted successfully');
    },
  });

  const handleSubmit = () => {
    if (editingSupplier) {
      updateMutation.mutate({ id: editingSupplier.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openCreate = () => {
    setEditingSupplier(null);
    setFormData(initialSupplier);
    setModalOpen(true);
  };

  const openEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormData(supplier);
    setModalOpen(true);
  };

  const columns = [
    { 
      header: 'Supplier', 
      cell: (row) => (
 