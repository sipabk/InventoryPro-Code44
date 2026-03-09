import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Warehouse, MapPin, Phone, Mail } from "lucide-react";
import DataTable from '@/components/common/DataTable';
import FormModal from '@/components/common/FormModal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { toast } from "sonner";

const initialWarehouse = {
  name: '', code: '', address: '', city: '', country: '',
  manager_name: '', manager_email: '', phone: '', capacity: 0, status: 'active'
};

export default function Warehouses() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [formData, setFormData] = useState(initialWarehouse);
  
  const queryClient = useQueryClient();

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => base44.entities.Warehouse.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Warehouse.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setModalOpen(false);
      toast.success('Warehouse created successfully');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Warehouse.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setModalOpen(false);
      toast.success('Warehouse updated successfully');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Warehouse.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setDeleteOpen(false);
      toast.success('Warehouse deleted successfully');
    },
  });

  const handleSubmit = () => {
    if (editingWarehouse) {
      updateMutation.mutate({ id: editingWarehouse.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openCreate = () => {
    setEditingWarehouse(null);
    setFormData(initialWarehouse);
    setModalOpen(true);
  };

  const openEdit = (warehouse) => {
    setEditingWarehouse(warehouse);
    setFormData(warehouse);
    setModalOpen(true);
  };

  const columns = [
    { 
      header: 'Warehouse', 
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Warehouse className="w-5 h-5 text-blue-600" />
          </div>
 