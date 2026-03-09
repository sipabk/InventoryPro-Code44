import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export default function DataTable({ 
  data, 
  columns, 
  searchable = true, 
  searchPlaceholder = "Search...",
  pageSize: initialPageSize = 10,
  onRowClick,
  emptyMessage = "No data found"
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    return data.filter(row => 
      columns.some(col => {
        const value = typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor];
        return String(value || '').toLowerCase().includes(searchTerm.toLowerCase());
      })
    );
  }, [data, searchTerm, columns]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-4">
      {searchable && (
 