import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

const ENTITY_TYPES = [
  { value: 'products', label: 'Products', entity: 'Product' },
  { value: 'categories', label: 'Categories', entity: 'Category' },
  { value: 'warehouses', label: 'Warehouses', entity: 'Warehouse' },
  { value: 'suppliers', label: 'Suppliers', entity: 'Supplier' },
  { value: 'warranties', label: 'Warranties', entity: 'Warranty' },
];

export default function ImportExport() {
  const [selectedEntity, setSelectedEntity] = useState('products');
  const [uploadFile, setUploadFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => base44.entities.Warehouse.list(),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => base44.entities.Supplier.list(),
  });

  const { data: warranties = [] } = useQuery({
    queryKey: ['warranties'],
    queryFn: () => base44.entities.Warranty.list(),
  });

  const getEntityData = (type) => {
    switch(type) {
      case 'products': return products;
      case 'categories': return categories;
      case 'warehouses': return warehouses;
      case 'suppliers': return suppliers;
      case 'warranties': return warranties;
      default: return [];
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadFile(file);
    setImportResults(null);
    
    // Upload file and extract data
    setImporting(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    
    const entityConfig = ENTITY_TYPES.find(t => t.value === selectedEntity);
    const schema = await base44.entities[entityConfig.entity].schema();
    
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "array",
        items: { type: "object", properties: schema.properties }
      }
    });
 