import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Package, CheckCircle, XCircle, Eye, Trash2 } from 'lucide-react';
import DataTable from '../components/common/DataTable';
import FormModal from '../components/common/FormModal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import POForm from '../components/po/POForm';
import PODetails from '../components/po/PODetails';
import { toast } from 'sonner';
import { format } from 'date-fns';

const statusColors = {
  draft: 'bg-slate-100 text-slate-700',
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  ordered: 'bg-purple-100 text-purple-700',
  received: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function PurchaseOrders() {
  const [showForm, setShowForm] = useState(false);
  const [editingPO, setEditingPO] = useState(null);
  const [viewingPO, setViewingPO] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingPO, setDeletingPO] = useState(null);
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

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PurchaseOrder.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['purchaseOrders']);
      setDeleteOpen(false);
      toast.success('Purchase order deleted');
    }
  });

  const receivePOMutation = useMutation({
    mutationFn: async (po) => {
      // Update PO status to received
      await base44.entities.PurchaseOrder.update(po.id, {
        status: 'received',
        actual_delivery_date: new Date().toISOString().split('T')[0],
      });
      
      // Create stock transaction for each item
      if (po.items && po.items.length > 0) {
        for (const item of po.items) {
          const product = products.find(p => p.id === item.product_id);
          if (product) {
            const currentStock = product.quantity_in_stock || 0;
            await base44.entities.Product.update(item.product_id, {
              quantity_in_stock: currentStock + item.quantity_ordered
            });
            
            await base44.entities.StockTransaction.create({
              transaction_number: `PO-${po.po_number}-${Date.now()}`,
              product_id: item.product_id,
              warehouse_id: po.warehouse_id,
              type: 'inward',
              quantity: item.quantity_ordered,
              unit_cost: item.unit_cost,
              total_cost: item.total_cost,
              currency: po.currency,
              supplier_id: po.supplier_id,
              reference_number: po.po_number,
              transaction_date: new Date().toISOString().split('T')[0],
              status: 'completed',
              notes: `Auto-generated from PO ${po.po_number}`
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['purchaseOrders']);
      queryClient.invalidateQueries(['products']);
      queryClient.invalidateQueries(['transactions']);
      toast.success('Purchase order received and stock updated');
    }
  });

  const getSupplierName = (id) => suppliers.find(s => s.id === id)?.name || '-';
  const getWarehouseName = (id) => warehouses.find(w => w.id === id)?.name || '-';

  const columns = [
    { 
      header: 'PO Number', 
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-slate-800">{row.po_number}</p>
            <p className="text-xs text-slate-500">{row.order_date ? format(new Date(row.order_date), 'MMM d, yyyy') : '-'}</p>
          </div>
        </div>
      )
    },
    { header: 'Supplier', accessor: (row) => getSupplierName(row.supplier_id) },
    { header: 'Warehouse', accessor: (row) => getWarehouseName(row.warehouse_id) },
    { 
      header: 'Total', 
      accessor: (row) => `${row.currency || 'USD'} ${(row.total_amount || 0).toLocaleString()}`
    },
    { 
      header: 'Status', 
      cell: (row) => (
        <Badge className={statusColors[row.status] || statusColors.draft}>
          {row.status}
        </Badge>
      )
    },
    { 
      header: 'Actions', 
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setViewingPO(row)}>
            <Eye className="w-4 h-4" />
          </Button>
          {row.status === 'approved' && (
            <Button variant="ghost" size="icon" onClick={() => receivePOMutation.mutate(row)}>
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </Button>
          )}
          {(row.status === 'draft' || row.status === 'pending') && (
            <Button variant="ghost" size="icon" onClick={() => { setDeletingPO(row); setDeleteOpen(true); }}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          )}
        </div>
      )
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Purchase Orders</h1>
          <p className="text-slate-500 mt-1">Manage supplier orders</p>
        </div>
        <Button onClick={() => { setEditingPO(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> New Order
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <DataTable 
          data={pos} 
          columns={columns} 
          searchPlaceholder="Search orders..." 
          emptyMessage="No purchase orders found"
        />
      </div>

      {/* Create/Edit Form */}
      <FormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingPO ? 'Edit Purchase Order' : 'New Purchase Order'}
        onSubmit={() => {}}
        size="xl"
      >
        <POForm 
          po={editingPO}
          suppliers={suppliers}
          warehouses={warehouses}
          products={products}
          onSuccess={() => {
            setShowForm(false);
            queryClient.invalidateQueries(['purchaseOrders']);
          }}
        />
      </FormModal>

      {/* View Details */}
      {viewingPO && (
        <PODetails 
          po={viewingPO}
          suppliers={suppliers}
          warehouses={warehouses}
          products={products}
          onClose={() => setViewingPO(null)}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate(deletingPO?.id)}
        title="Delete Purchase Order"
        description="Are you sure you want to delete this purchase order? This action cannot be undone."
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
