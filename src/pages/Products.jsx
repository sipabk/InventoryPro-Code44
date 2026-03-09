import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Package, Download, Upload, Filter, X, Hash } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import DataTable from '@/components/common/DataTable';
import FormModal from '@/components/common/FormModal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import BulkEditBar from '@/components/common/BulkEditBar';
import { useCurrencies } from '@/components/common/useCurrencies';
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
const STATUSES = ['active', 'inactive', 'discontinued'];

const initialProduct = {
  sku: '', name: '', description: '', category_id: '', supplier_id: '', preferred_supplier_id: '', warehouse_id: '',
  unit_price: 0, cost_price: 0, currency: 'USD', quantity_in_stock: 0, reorder_level: 10,
  reorder_quantity: 50, unit_of_measure: 'piece', serial_number_tracking: false,
  length: 0, width: 0, height: 0, weight: 0,
  dimension_unit: 'cm', weight_unit: 'kg', purchase_date: '', barcode: '', status: 'active', tax_rate: 0
};

const BULK_FIELDS = [
  { key: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'discontinued', label: 'Discontinued' }] },
  { key: 'unit_price', label: 'Unit Price', type: 'number' },
  { key: 'cost_price', label: 'Cost Price', type: 'number' },
  { key: 'reorder_level', label: 'Reorder Level', type: 'number' },
  { key: 'tax_rate', label: 'Tax Rate (%)', type: 'number' },
];

export default function Products() {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(initialProduct);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  
  const queryClient = useQueryClient();
  const currencies = useCurrencies();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => base44.entities.Warehouse.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setModalOpen(false);
      toast.success('Product created successfully');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setModalOpen(false);
      toast.success('Product updated successfully');
    },
  });

  const deleteMutation = useMutation({
 