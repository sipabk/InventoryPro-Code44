import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ArrowDownCircle, ArrowUpCircle, RefreshCw, Settings2, Check, X, Download } from "lucide-react";
import { format } from 'date-fns';
import DataTable from '@/components/common/DataTable';
import FormModal from '@/components/common/FormModal';
import { useCurrencies } from '@/components/common/useCurrencies';
import { toast } from "sonner";

const TYPES = ['inward', 'outward', 'transfer', 'adjustment', 'return'];

const typeIcons = {
  inward: ArrowDownCircle,
  outward: ArrowUpCircle,
  transfer: RefreshCw,
  adjustment: Settings2,
  return: ArrowDownCircle,
};

const initialTransaction = {
  transaction_number: '', product_id: '', warehouse_id: '', type: 'inward',
  quantity: 0, unit_cost: 0, total_cost: 0, currency: 'USD',
  reference_number: '', supplier_id: '', transaction_date: '', notes: '', status: 'pending',
  serial_numbers: []
};

export default function Transactions() {
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(initialTransaction);
  
  const queryClient = useQueryClient();
  const currencies = useCurrencies();

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.StockTransaction.list('-created_date', 100),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => base44.entities.Warehouse.list(),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const txNumber = `TXN-${Date.now()}`;
      const transaction = await base44.entities.StockTransaction.create({ ...data, transaction_number: txNumber });
      
      // Update product stock
      const product = products.find(p => p.id === data.product_id);
      if (product) {
        const currentStock = product.quantity_in_stock || 0;
        const newQty = data.type === 'inward' || data.type === 'return'
          ? currentStock + data.quantity
          : currentStock - data.quantity;
        await base44.entities.Product.update(product.id, { quantity_in_stock: Math.max(0, newQty) });
      }
      
      return transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setModalOpen(false);
      toast.success('Transaction created successfully');
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, status }) => {
 