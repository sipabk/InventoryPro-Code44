import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, CheckCircle, XCircle } from "lucide-react";
import { format, differenceInDays } from 'date-fns';

const statusConfig = {
  active: { icon: CheckCircle, color: "bg-emerald-100 text-emerald-700", label: "Active" },
  expiring_soon: { icon: AlertTriangle, color: "bg-amber-100 text-amber-700", label: "Expiring Soon" },
  expired: { icon: XCircle, color: "bg-red-100 text-red-700", label: "Expired" },
  claimed: { icon: Clock, color: "bg-blue-100 text-blue-700", label: "Claimed" },
};

export default function WarrantyAlerts({ warranties, products }) {
  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId);
    return product?.name || 'Unknown Product';
  };

  const getDaysRemaining = (endDate) => {
    return differenceInDays(new Date(endDate), new Date());
  };

  const alertWarranties = warranties.filter(w => {
    const days = getDaysRemaining(w.end_date);
    return days <= 30 || w.status === 'expiring_soon' || w.status === 'expired';
  }).slice(0, 5);

  return (
    <Card className="border-2 border-slate-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Warranty Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alertWarranties.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No warranty alerts</p>
          ) : (
            alertWarranties.map((warranty) => {
              const daysLeft = getDaysRemaining(warranty.end_date);
              const status = daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'expiring_soon' : warranty.status;
              const config = statusConfig[status] || statusConfig.active;
              const Icon = config.icon;

              return (
                <div key={warranty.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{getProductName(warranty.product_id)}</p>
                      <p className="text-xs text-slate-500">
                        {warranty.warranty_provider} • Ends {format(new Date(warranty.end_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={config.color}>{config.label}</Badge>
                    <p className={`text-xs mt-1 ${daysLeft < 0 ? 'text-red-600' : daysLeft <= 30 ? 'text-amber-600' : 'text-slate-500'}`}>
                      {daysLeft < 0 ? `${Math.abs(daysLeft)} days ago` : `${daysLeft} days left`}
                    </p>
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