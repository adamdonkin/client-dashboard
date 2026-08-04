"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type RevenueFilterType = 'all' | 'mochary-method';

interface RevenueFilterProps {
  value: RevenueFilterType;
  onChange: (value: RevenueFilterType) => void;
}

export function RevenueFilter({ value, onChange }: RevenueFilterProps) {
  return (
    <div className="mb-4">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select filter" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Clients</SelectItem>
          <SelectItem value="mochary-method">Mochary</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
