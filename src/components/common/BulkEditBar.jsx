import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { X, Edit2, Check } from "lucide-react";

export default function BulkEditBar({ selectedCount, onApply, onClear, fields }) {
  const [selectedField, setSelectedField] = useState('');
  const [fieldValue, setFieldValue] = useState('');

  const handleApply = () => {
    if (!selectedField || fieldValue === '') return;
    onApply(selectedField, fieldValue);
    setSelectedField('');
    setFieldValue('');
  };

  const currentField = fields.find(f => f.key === selectedField);

  return (
    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center gap-2 text-blue-700 font-medium">
        <Edit2 className="w-4 h-4" />
        <span>{selectedCount} selected</span>
      </div>
      <div className="flex-1 flex items-center gap-2">
        <Select value={selectedField} onValueChange={(v) => { setSelectedField(v); setFieldValue(''); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Field to update" />
          </SelectTrigger>
          <SelectContent>
            {fields.map(f => (
              <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {currentField?.type === 'select' ? (
          <Select value={fieldValue} onValueChange={setFieldValue}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="New value" />
            </SelectTrigger>
            <SelectContent>
              {currentField.options.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : currentField ? (
          <Input
            type={currentField.type || 'text'}
            placeholder="New value"
            value={fieldValue}
            onChange={(e) => setFieldValue(e.target.value)}
            className="w-40"
          />
        ) : null}

        <Button size="sm" onClick={handleApply} disabled={!selectedField || fieldValue === ''}>
          <Check className="w-4 h-4 mr-1" /> Apply to {selectedCount}
        </Button>
      </div>
      <Button variant="ghost" size="icon" onClick={onClear}>
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}