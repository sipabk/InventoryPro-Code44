import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, DollarSign, Bell, Calendar, Database, Shield, Save, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

const PRESET_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'JPY', 'CNY'];

const defaultSettings = {
  // General
  company_name: '',
  timezone: 'UTC',
  date_format: 'MM/dd/yyyy',
  // Financial
  default_currency: 'USD',
  financial_year_start: '01',
  tax_rate: 0,
  valuation_method: 'weighted_average',
  custom_currencies: '',
  // Notifications
  low_stock_alert: true,
  warranty_expiry_alert: true,
  warranty_alert_days: 30,
  email_notifications: true,
  // Backup
  auto_backup: false,
  backup_frequency: 'weekly',
};

export default function Settings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [newCurrency, setNewCurrency] = useState('');
  
  const queryClient = useQueryClient();

  const { data: existingSettings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.SystemSettings.list(),
  });

  useEffect(() => {
    if (existingSettings.length > 0) {
      const loadedSettings = { ...defaultSettings };
      existingSettings.forEach(s => {
        if (s.setting_key in loadedSettings) {
          loadedSettings[s.setting_key] = s.setting_value === 'true' ? true : 
            s.setting_value === 'false' ? false : 
            !isNaN(s.setting_value) ? parseFloat(s.setting_value) : s.setting_value;
        }
      });
      setSettings(loadedSettings);
    }
  }, [existingSettings]);

  const handleSave = async () => {
    setSaving(true);
    
    for (const [key, value] of Object.entries(settings)) {
      const existing = existingSettings.find(s => s.setting_key === key);
      const stringValue = String(value);
      
      if (existing) {
        await base44.entities.SystemSettings.update(existing.id, { setting_value: stringValue });
      } else {
        await base44.entities.SystemSettings.create({ 
          setting_key: key, 
          setting_value: stringValue,
          setting_type: key.includes('currency') || key.includes('tax') || key.includes('financial') ? 'financial' :
            key.includes('alert') || key.includes('notification') ? 'notification' :
            key.includes('backup') ? 'backup' : 'general'
        });
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ['settings'] });
    setSaving(false);
    toast.success('Settings saved successfully');
  };

 