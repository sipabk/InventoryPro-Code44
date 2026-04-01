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
    onSuccess: () => {
      queryClient.invalidateQueries(['purchaseOrders']);
      queryClient.invalidateQueries(['products']);
      queryClient.invalidateQueries(['stockTransactions']);
      setReceivingPO(null);
      toast.success('Purchase order received and inventory updated');
    }
  });

  const statusConfig = {
    draft: { icon: FileText, color: 'bg-slate-100 text-slate-700', label: 'Draft' },
    ordered: { icon: Package, color: 'bg-blue-100 text-blue-700', label: 'Ordered' },
    received: { icon: CheckCircle, color: 'bg-green-100 text-green-700', label: 'Received' },
    cancelled: { icon: XCircle, color: 'bg-red-100 text-red-700', label: 'Cancelled' }
  };

  const getSupplierName = (id) => { const s = suppliers.find(s => s.id === id); return s?.data?.name || s?.name || 'N/A'; };
  const getWarehouseName = (id) => { const w = warehouses.find(w => w.id === id); return w?.data?.name || w?.name || 'N/A'; };

  const columns = [
    { header: 'PO Number', accessor: (row) => row.po_number },
    { header: 'Supplier', accessor: (row) => getSupplierName(row.supplier_id) },
    { header: 'Order Date', accessor: (row) => row.order_date },
    { header: 'Warehouse', accessor: (row) => getWarehouseName(row.warehouse_id) },
    {
      header: 'Total',
      accessor: (row) => `${row.currency} ${row.total_amount?.toLocaleString() || '0'}`
    },
    {
      header: 'Status',
      cell: (row) => {
        const config = statusConfig[row.status] || statusConfig.draft;
        const Icon = config.icon;
        return (
          <Badge className={config.color}>
            <Icon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
        );
      }
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setViewingPO(row); }}>
            <Eye className="w-4 h-4" />
          </Button>
          {row.status === 'ordered' && (
            <Button
              size="sm"
              onClick={(e) => { e.stopPropagation(); setReceivingPO(row); }}
              className="bg-green-600 hover:bg-green-700"
            >
              Receive
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase Orders</h1>
          <p className="text-slate-500 mt-1">Manage supplier purchase orders and inventory receipts</p>
        </div>
        <Button onClick={() => { setEditingPO(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          New Purchase Order
        </Button>
      </div>

      <DataTable
        data={pos}
        columns={columns}
        searchPlaceholder="Search purchase orders..."
        onRowClick={(row) => setViewingPO(row)}
      />

      {showForm && (
        <POForm
          po={editingPO}
          onClose={() => { setShowForm(false); setEditingPO(null); }}
          suppliers={suppliers}
          warehouses={warehouses}
        />
      )}

      {viewingPO && (
        <PODetails
          po={viewingPO}
          onClose={() => setViewingPO(null)}
          suppliers={suppliers}
          warehouses={warehouses}
        />
      )}

      <ConfirmDialog
        open={!!receivingPO}
        onClose={() => setReceivingPO(null)}
        onConfirm={() => receivePOMutation.mutate(receivingPO)}
        title="Receive Purchase Order"
        description={`Are you sure you want to receive PO ${receivingPO?.po_number}? This will automatically update inventory levels and create stock transactions.`}
        confirmLabel="Receive PO"
        isLoading={receivePOMutation.isPending}
      />
    </div>
  );
}