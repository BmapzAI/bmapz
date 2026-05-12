import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  SlidersHorizontal, ArrowUpDown, X, Eye, EyeOff, 
  DollarSign, Target, Calendar, User, Crown
} from 'lucide-react';

export default function KanbanFilters({ 
  filters, 
  onFiltersChange, 
  sortBy, 
  onSortChange,
  visibleColumns,
  onColumnsChange,
  stages 
}) {
  const [isOpen, setIsOpen] = useState(false);

  const sortOptions = [
    { value: 'created_date', label: 'Date Added', icon: Calendar },
    { value: 'icp_score', label: 'ICP Score', icon: Target },
    { value: 'estimated_value', label: 'Deal Value', icon: DollarSign },
    { value: 'lead_name', label: 'Lead Name', icon: User },
    { value: 'lead_company_name', label: 'Company Name', icon: User },
  ];

  const handleFilterChange = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      icpScoreMin: 0,
      icpScoreMax: 100,
      minValue: 0,
      maxValue: null,
      decisionMakerOnly: false,
      source: 'all',
    });
  };

  const hasActiveFilters = filters.icpScoreMin > 0 || 
    filters.icpScoreMax < 100 || 
    filters.minValue > 0 || 
    filters.maxValue ||
    filters.decisionMakerOnly ||
    filters.source !== 'all';

  return (
    <div className="flex items-center gap-2">
      {/* Sort */}
      <Select value={sortBy.field} onValueChange={(val) => onSortChange({ ...sortBy, field: val })}>
        <SelectTrigger className="w-[160px] bg-black/30 border-white/10 text-white">
          <ArrowUpDown size={14} className="mr-2 text-gray-400" />
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent className="bg-[#1a1a1a] border-white/10">
          {sortOptions.map(opt => (
            <SelectItem key={opt.value} value={opt.value} className="text-white hover:bg-white/10">
              <div className="flex items-center gap-2">
                <opt.icon size={14} />
                {opt.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        onClick={() => onSortChange({ ...sortBy, direction: sortBy.direction === 'asc' ? 'desc' : 'asc' })}
        className="border-white/10 text-white hover:bg-white/5"
      >
        <ArrowUpDown size={16} className={sortBy.direction === 'desc' ? 'rotate-180' : ''} />
      </Button>

      {/* Filters */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className={`border-white/10 text-white hover:bg-white/5 gap-2 
              ${hasActiveFilters ? 'border-[#38b6ff]/50 bg-[#38b6ff]/10' : ''}`}
          >
            <SlidersHorizontal size={16} />
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-[#38b6ff]" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 bg-[#1a1a1a] border-white/10 text-white p-4" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Filters</h4>
              {hasActiveFilters && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearFilters}
                  className="text-gray-400 hover:text-white h-auto p-0"
                >
                  <X size={14} className="mr-1" /> Clear
                </Button>
              )}
            </div>

            {/* ICP Score Range */}
            <div>
              <Label className="text-gray-400 text-sm flex items-center gap-2">
                <Target size={14} />
                ICP Score Range
              </Label>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-sm text-gray-400 w-8">{filters.icpScoreMin}%</span>
                <Slider
                  value={[filters.icpScoreMin, filters.icpScoreMax]}
                  onValueChange={([min, max]) => {
                    handleFilterChange('icpScoreMin', min);
                    handleFilterChange('icpScoreMax', max);
                  }}
                  max={100}
                  step={5}
                  className="flex-1"
                />
                <span className="text-sm text-gray-400 w-8">{filters.icpScoreMax}%</span>
              </div>
            </div>

            {/* Min Deal Value */}
            <div>
              <Label className="text-gray-400 text-sm flex items-center gap-2">
                <DollarSign size={14} />
                Minimum Deal Value
              </Label>
              <Input
                type="number"
                value={filters.minValue || ''}
                onChange={(e) => handleFilterChange('minValue', parseInt(e.target.value) || 0)}
                placeholder="0"
                className="mt-1.5 bg-black/30 border-white/10 text-white"
              />
            </div>

            {/* Decision Maker Only */}
            <div className="flex items-center justify-between">
              <Label className="text-gray-400 text-sm flex items-center gap-2">
                <Crown size={14} />
                Decision Makers Only
              </Label>
              <Switch
                checked={filters.decisionMakerOnly}
                onCheckedChange={(val) => handleFilterChange('decisionMakerOnly', val)}
              />
            </div>

            {/* Lead Source */}
            <div>
              <Label className="text-gray-400 text-sm">Lead Source</Label>
              <Select 
                value={filters.source} 
                onValueChange={(val) => handleFilterChange('source', val)}
              >
                <SelectTrigger className="mt-1.5 bg-black/30 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-white/10">
                  <SelectItem value="all" className="text-white">All Sources</SelectItem>
                  <SelectItem value="manual" className="text-white">Manual</SelectItem>
                  <SelectItem value="csv" className="text-white">CSV Import</SelectItem>
                  <SelectItem value="api" className="text-white">API</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Column Visibility */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="border-white/10 text-white hover:bg-white/5 gap-2">
            <Eye size={16} />
            Columns
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 bg-[#1a1a1a] border-white/10 text-white p-4" align="end">
          <h4 className="font-semibold mb-3">Visible Stages</h4>
          <div className="space-y-2">
            {stages.map(stage => (
              <div key={stage.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="text-sm">{stage.name}</span>
                </div>
                <Switch
                  checked={visibleColumns.includes(stage.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onColumnsChange([...visibleColumns, stage.id]);
                    } else {
                      onColumnsChange(visibleColumns.filter(c => c !== stage.id));
                    }
                  }}
                />
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}