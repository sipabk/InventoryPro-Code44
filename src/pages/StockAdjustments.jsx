import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Check, X, Settings2, Calculator, Download } from "lucide-react";
import { format } from 'date-fns';
import DataTable from '@/components/common/DataTable';
import FormModal from '@/components/common/FormModal';
import { toast } from "sonner";

const ADJUSTMENT_TYPES = ['stock_take', 'damage', 'loss', 'correction', 'opening_balance', 'closing_balance'];
const VALUATION_METHODS = ['fifo', 'lifo', 'weighted_average'];

const initialAdjustment = {
  product_id: '', warehouse_id: '', adjustment_type: 'correction',
  valuation_method: 'weighted_average', previous_quantity: 0, new_quantity: 0,
  variance: 0, previous_value: 0, new_value: 0, value_variance: 0,
  reason: '', financial_year: new Date().getFullYear().toString(),
  status: 'draft', adjustment_date: ''
};

export default function StockAdjustments() {
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(initialAdjustment);
  
  const queryClient = useQueryClient();

  const { data: adjustments = [] } = useQuery({
    queryKey: ['adjustments'],
    queryFn: () => base44.entities.StockAdjustment.list('-created_date', 100),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => base44.entities.Warehouse.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const adjNumber = `ADJ-${Date.now()}`;
      return base44.entities.StockAdjustment.create({ ...data, adjustment_number: adjNumber });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adjustments'] });
      setModalOpen(false);
      toast.success('Adjustment created successfully');
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, status, adjustment }) => {
      const result = await base44.entities.StockAdjustment.update(id, { 
        status,
        approved_by: 'current_user',
        approved_date: new Date().toISOString()
      });
      
      // If approved, update product stock
      if (status === 'approved' && adjustment) {
        const prodId = adjustment.product_id;
        if (prodId) {
          await base44.entities.Product.update(prodId, { 
            quantity_in_stock: adjustment.new_quantity 
          });
        }
      }
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Adjustment status updated');
    },
  });

  const handleProductChange = (productId) => {
 