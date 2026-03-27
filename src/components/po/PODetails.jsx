import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, Package, CheckCircle, XCircle, Calendar, Warehouse, DollarSign } from 'lucide-react';

export default function PODetails({ po, onClose, suppliers, warehouses }) {
  const { data: items = [] } = useQuery({
    queryKey: ['poItems', po.id],
    queryFn: () => base44.entities.PurchaseOrderItem.filter({ po_id: po.id })
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('name', 500)
  });

  const statusConfig = {
    draft: { icon: FileText, color: 'bg-slate-100 text-slate-700', label: 'Draft' },
    ordered: { icon: Package, color: 'bg-blue-100 text-blue-700', label: 'Ordered' },
    received: { icon: CheckCircle, color: 'bg-green-100 text-green-700', label: 'Received' },
    cancelled: { icon: XCircle, color: 'bg-red-100 text-red-700', label: 'Cancelled' }
  };

  const poData = po.data || po;
  const config = statusConfig[poData.status] || statusConfig.draft;
  const Icon = config.icon;
  const supplier = suppliers.find(s => s.id === poData.supplier_id);
  const supplierData = supplier?.data || supplier || {};
  const warehouse = warehouses.find(w => w.id === poData.warehouse_id);
  const warehouseData = warehouse?.data || warehouse || {};
  const getProductName = (id) => { const p = products.find(p => p.id === id); return p?.data?.name || p?.name || 'N/A'; };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl">Purchase Order #{poData.po_number}</DialogTitle>
              <Badge className={`${config.color} mt-2`}>
                <Icon className="w-3 h-3 mr-1" />
                {config.label}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4" /> Supplier Information
              </h3>
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <div><span className="font-medium">Name:</span> {supplierData.name}</div>
                <div><span className="font-medium">Contact:</span> {supplierData.contact_person}</div>
                <div><span className="font-medium">Email:</span> {supplierData.email}</div>
                <div><span className="font-medium">Phone:</span> {supplierData.phone}</div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Order Details
              </h3>
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <div><span className="font-medium">Order Date:</span> {poData.order_date}</div>
                <div><span className="font-medium">Expected Delivery:</span> {poData.expected_delivery_date || 'N/A'}</div>
                <div><span className="font-medium">Warehouse:</span> {warehouseData.name}</div>
                <div><span className="font-medium">Payment Terms:</span> {poData.payment_terms}</div>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Line Items</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3 text-sm font-semibold">Product</th>
                    <th className="text-left p-3 text-sm font-semibold">Qty Ordered</th>
                    <th className="text-left p-3 text-sm font-semibold">Qty Received</th>
                    <th className="text-left p-3 text-sm font-semibold">Unit Cost</th>
                    <th className="text-left p-3 text-sm font-semibold">Tax %</th>
                    <th className="text-right p-3 text-sm font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const d = item.data || item;
                    return (
                      <tr key={idx} className="border-t">
                        <td className="p-3">{getProductName(d.product_id)}</td>
                        <td className="p-3">{d.quantity_ordered}</td>
                        <td className="p-3">{d.quantity_received || 0}</td>
                        <td className="p-3">{poData.currency} {d.unit_cost?.toFixed(2)}</td>
                        <td className="p-3">{d.tax_rate || 0}%</td>
                        <td className="p-3 text-right font-semibold">
                          {poData.currency} {d.total_cost?.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="w-80 space-y-2 border-t pt-4">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span className="font-semibold">{poData.currency} {poData.subtotal?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax:</span>
                <span className="font-semibold">{poData.currency} {poData.tax_amount?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Shipping:</span>
                <span className="font-semibold">{poData.currency} {poData.shipping_cost?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span>{poData.currency} {poData.total_amount?.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {poData.notes && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Notes</h3>
              <div className="bg-slate-50 p-4 rounded-lg">
                {poData.notes}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}