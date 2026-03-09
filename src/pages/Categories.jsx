import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, FolderTree } from "lucide-react";
import DataTable from '@/components/common/DataTable';
import FormModal from '@/components/common/FormModal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { toast } from "sonner";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const initialCategory = { name: '', description: '', parent_id: '', color: '#3b82f6', status: 'active' };

export default function Categories() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState(initialCategory);
  
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Category.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setModalOpen(false);
      toast.success('Category created successfully');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Category.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setModalOpen(false);
      toast.success('Category updated successfully');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Category.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setDeleteOpen(false);
      toast.success('Category deleted successfully');
    },
  });

  const handleSubmit = () => {
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openCreate = () => {
    setEditingCategory(null);
    setFormData(initialCategory);
    setModalOpen(true);
  };

  const openEdit = (category) => {
    setEditingCategory(category);
    setFormData(category);
    setModalOpen(true);
  };

  const columns = [
    { 
      header: 'Category', 
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: row.color + '20' }}>
            <FolderTree className="w-5 h-5" style={{ color: row.color }} />
          </div>
 