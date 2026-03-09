import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpCircle, ArrowDownCircle, RefreshCw, Settings2 } from "lucide-react";
import { format } from 'date-fns';

const typeIcons = {
  inward: ArrowDownCircle,
  outward: ArrowUpCircle,
  transfer: RefreshCw,
  adjustment: Settings2,
};

const typeColors = {
  inward: "bg-emerald-100 text-emerald-700",
  outward: "bg-amber-100 text-amber-700",
  transfer: "bg-blue-100 text-blue-700",
  adjustment: "bg-purple-100 text-purple-700",
};

const statusColors = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function RecentTransactions({ transactions, products }) {
  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product?.name || 'Unknown Product';
  };

  return (
    <Card className="border-2 border-slate-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-800">Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No recent transactions</p>
          ) : (
            transactions.slice(0, 6).map((tx) => {
              const Icon = typeIcons[tx.type] || ArrowDownCircle;
              return (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${typeColors[tx.type]}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{getProductName(tx.product_id)}</p>
                      <p className="text-xs text-slate-500">
                        {tx.transaction_number} • {tx.transaction_date && format(new Date(tx.transaction_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${tx.type === 'inward' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {tx.type === 'inward' ? '+' : '-'}{tx.quantity}
                    </p>
                    <Badge className={statusColors[tx.status]}>{tx.status}</Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}