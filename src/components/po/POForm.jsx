import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrencies } from '@/components/common/useCurrencies';

export default function POForm({ po, onClose, suppliers, warehouses }) {
  const queryClient = useQueryClient();
  const currencies = useCurrencies();
  const [formData, setFormData] = useState({
    po_number: '',
    supplier_id: '',
    warehouse_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    status: 'draft',
    currency: 'USD',
    payment_terms: 'net_30',
    shipping_cost: 0,
    notes: ''
  });

  const [items, setItems] = useState([]);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('name', 500)
  });

  useEffect(() => {
    if (po) {
      setFormData(po.data || po);
      base44.entities.PurchaseOrderItem.filter({ po_id: po.id }).then(setItems);
    } else {
      const poNumber = `PO-${Date.now()}`;
      setFormData(prev => ({ ...prev, po_number: poNumber }));
    }
  }, [po]);

  const addItem = () => {
    setItems([...items, {
      product_id: '',
      quantity_ordered: 1,
      unit_cost: 0,
      tax_rate: 0,
      total_cost: 0
    }]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'quantity_ordered' || field === 'unit_cost') {
      const qty = field === 'quantity_ordered' ? value : updated[index].quantity_ordered;
      const cost = field === 'unit_cost' ? value : updated[index].unit_cost;
      updated[index].total_cost = qty * cost;
    }

    setItems(updated);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.total_cost || 0), 0);
    const taxAmount = items.reduce((sum, item) => {
      const itemData = item.data || item;
      return sum + (itemData.total_cost || 0) * (itemData.tax_rate || 0) / 100;
    }, 0);
    const total = subtotal + taxAmount + (formData.shipping_cost || 0);
    return { subtotal, taxAmount, total };
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { subtotal, taxAmount, total } = calculateTotals();
      const poData = {
        ...formData,
        subtotal,
        tax_amount: taxAmount,
        total_amount: total
      };

      let poId;
      if (po) {
        await base44.entities.PurchaseOrder.update(po.id, poData);
        poId = po.id;

        const existingItems = await base44.entities.PurchaseOrderItem.filter({ po_id: po.id });
        for (const item of existingItems) {
          await base44.entities.PurchaseOrderItem.delete(item.id);
        }
      } else {
        const created = await base44.entities.PurchaseOrder.create(poData);
        poId = created.id;
      }

      for (const item of items) {
        const itemData = item.data || item;
        await base44.entities.PurchaseOrderItem.create({
          po_id: poId,
          product_id: itemData.product_id,
          quantity_ordered: itemData.quantity_ordered,
          unit_cost: itemData.unit_cost,
          tax_rate: itemData.tax_rate || 0,
          total_cost: itemData.total_cost
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['purchaseOrders']);
      toast.success(po ? 'PO updated' : 'PO created');
      onClose();
    }
  });

  const { subtotal, taxAmount, total } = calculateTotals();

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{po ? 'Edit Purchase Order' : 'New Purchase Order'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>PO Number</Label>
              <Input value={formData.po_number} disabled />
            </div>
            <div>
              <Label>Supplier *</Label>
              <Select value={formData.supplier_id} onValueChange={(v) => setFormData({ ...formData, supplier_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.data?.name || s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Warehouse *</Label>
              <Select value={formData.warehouse_id} onValueChange={(v) => setFormData({ ...formData, warehouse_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.data?.name || w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label>Order Date</Label>
              <Input
                type="date"
                value={formData.order_date}
                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Expected Delivery</Label>
              <Input
                type="date"
                value={formData.expected_delivery_date}
                onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="ordered">Ordered</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <Label className="text-lg font-semibold">Line Items</Label>
              <Button size="sm" onClick={addItem}>
                <Plus className="w-4 h-4 mr-1" /> Add Item
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-2 text-sm font-semibold">Product</th>
                    <th className="text-left p-2 text-sm font-semibold">Qty</th>
                    <th className="text-left p-2 text-sm font-semibold">Unit Cost</th>
                    <th className="text-left p-2 text-sm font-semibold">Tax %</th>
                    <th className="text-left p-2 text-sm font-semibold">Total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const itemData = item.data || item;
                    return (
                      <tr key={idx} className="border-t">
                        <td className="p-2">
                          <Select
                            value={itemData.product_id}
                            onValueChange={(v) => updateItem(idx, 'product_id', v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.data?.name || p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            value={itemData.quantity_ordered}
                            onChange={(e) => updateItem(idx, 'quantity_ordered', Number(e.target.value))}
                            className="w-20"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            value={itemData.unit_cost}
                            onChange={(e) => updateItem(idx, 'unit_cost', Number(e.target.value))}
                            className="w-24"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            value={itemData.tax_rate || 0}
                            onChange={(e) => updateItem(idx, 'tax_rate', Number(e.target.value))}
                            className="w-20"
                          />
                        </td>
                        <td className="p-2 font-semibold">
                          {itemData.total_cost?.toFixed(2)}
                        </td>
                        <td className="p-2">
                          <Button size="sm" variant="ghost" onClick={() => removeItem(idx)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
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
                <span className="font-semibold">{formData.currency} {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax:</span>
                <span className="font-semibold">{formData.currency} {taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Shipping:</span>
                <Input
                  type="number"
                  value={formData.shipping_cost}
                  onChange={(e) => setFormData({ ...formData, shipping_cost: Number(e.target.value) })}
                  className="w-28 h-7 text-right"
                />
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span>{formData.currency} {total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !formData.supplier_id}>
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? 'Saving...' : 'Save Purchase Order'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}