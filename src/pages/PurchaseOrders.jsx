import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Package, CheckCircle, XCircle, Eye } from 'lucide-react';
import DataTable from '../components/common/DataTable';
import FormModal from '../components/common/FormModal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import POForm from '../components/po/POForm';
import PODetails from '../components/po/PODetails';
import { toast } from 'sonner';

export default function PurchaseOrders() {
  const [showForm, setShowForm] = useState(false);
  const [editingPO, setEditingPO] = useState(null);
  const [viewingPO, setViewingPO] = useState(null);
  const [receivingPO, setReceivingPO] = useState(null);
  const queryClient = useQueryClient();

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ['purchaseOrders'],
    queryFn: () => base44.entities.PurchaseOrder.list('-created_date', 100)
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list('name', 500)
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => base44.entities.Warehouse.list('name', 500)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PurchaseOrder.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['purchaseOrders']);
      toast.success('Purchase order deleted');
    }
  });

  const receivePOMutation = useMutation({
    mutationFn: async (po) => {
      const items = await base44.entities.PurchaseOrderItem.filter({ po_id: po.id });
      
      for (const item of items) {
        const itemData = item.data || item;
        const products = await base44.entities.Product.filter({ id: itemData.product_id });
        if (products.length > 0) {
          const prod = products[0];
          const currentStock = (prod.data || prod).quantity_in_stock || 0;
          await base44.entities.Product.update(itemData.product_id, {
            quantity_in_stock: currentStock + itemData.quantity_ordered
          });
        }

        const transactionNumber = `PO-${po.po_number}-${Date.now()}`;
        await base44.entities.StockTransaction.create({
          transaction_number: transactionNumber,
          product_id: itemData.product_id,
          warehouse_id: po.warehouse_id,
          type: 'inward',
          quantity: itemData.quantity_ordered,
          unit_cost: itemData.unit_cost,
          total_cost: itemData.total_cost,
          currency: po.currency,
          supplier_id: po.supplier_id,
          reference_number: po.po_number,
          transaction_date: new Date().toISOString().split('T')[0],
          status: 'completed',
          notes: `Auto-generated from PO ${po.po_number}`
        });

        await base44.entities.PurchaseOrderItem.update(item.id, {
          quantity_received: itemData.quantity_ordered
        });
      }

      await base44.entities.PurchaseOrder.update(po.id, {
        status: 'received',
        actual_delivery_date: new Date().toISOString().split('T')[0],
        received_by: (await base44.auth.me()).email,
        received_date: new Date().toISOString()
      });
    },
 