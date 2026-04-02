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
          <div>
            <p className="font-medium text-slate-800">{row.name}</p>
            <p className="text-xs text-slate-500">{row.code}</p>
          </div>
        </div>
      )
    },
    {
      header: 'Location',
      cell: (row) => (
        <div className="flex items-center gap-1 text-slate-600">
          <MapPin className="w-4 h-4" />
          <span>{row.city}, {row.country}</span>
        </div>
      )
    },
    { header: 'Manager', accessor: 'manager_name' },
    { header: 'Capacity', accessor: (row) => row.capacity?.toLocaleString() || '-' },
    {
      header: 'Status',
      cell: (row) => (
        <Badge className={row.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}>
          {row.status}
        </Badge>
      )
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { setEditingWarehouse(row); setDeleteOpen(true); }}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Warehouses</h1>
          <p className="text-slate-500 mt-1">Manage your storage locations</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Add Warehouse
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <DataTable data={warehouses} columns={columns} searchPlaceholder="Search warehouses..." />
      </div>

      <FormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingWarehouse ? 'Edit Warehouse' : 'Add New Warehouse'}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
        size="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Code *</Label>
            <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Address</Label>
            <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Country</Label>
            <Input value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Manager Name</Label>
            <Input value={formData.manager_name} onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Manager Email</Label>
            <Input type="email" value={formData.manager_email} onChange={(e) => setFormData({ ...formData, manager_email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Capacity</Label>
            <Input type="number" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormModal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate(editingWarehouse?.id)}
        title="Delete Warehouse"
        description={`Are you sure you want to delete "${editingWarehouse?.name}"?`}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}