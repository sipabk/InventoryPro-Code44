import React from 'react';
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function StatsCard({ title, value, icon: Icon, trend, trendValue, color = "blue", subtitle }) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    red: "bg-red-50 text-red-600 border-red-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    slate: "bg-slate-50 text-slate-600 border-slate-100",
  };

  const iconBg = {
    blue: "bg-blue-500",
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    purple: "bg-purple-500",
    slate: "bg-slate-500",
  };

  return (
    <Card className={cn("p-6 border-2 transition-all hover:shadow-lg", colorClasses[color])}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">{title}</p>
          <p className="text-3xl font-bold text-slate-900">{value}</p>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          {trend && (
            <div className={cn("flex items-center gap-1 text-sm font-medium",
              trend === 'up' ? 'text-emerald-600' : 'text-red-600'
            )}>
              {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        <div className={cn("p-3 rounded-xl", iconBg[color])}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </Card>
  );
}