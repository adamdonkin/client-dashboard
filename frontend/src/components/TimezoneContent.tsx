"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, Sun } from 'lucide-react';
import { RevenueFilter, RevenueFilterType } from './RevenueFilter';

interface ClientByRegion {
  client_id: string;
  client_name: string;
  location: string;
  region: string;
  referral_source?: string;
}

interface TimezoneContentProps {
  clients: ClientByRegion[];
}

const REGION_ORDER = ['West Coast', 'Mountain', 'Central', 'East Coast', 'Europe', 'Asia Pacific'];
const MORNING_PRESSURE_REGIONS = new Set(['East Coast', 'Europe']);

function getRegionColor(region: string) {
  switch (region) {
    case 'West Coast':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'Mountain':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'Central':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'East Coast':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'Europe':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'Asia Pacific':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function getTimeOffset(region: string) {
  switch (region) {
    case 'West Coast':
      return 'Same timezone as you';
    case 'Mountain':
      return '+1 hour';
    case 'Central':
      return '+2 hours';
    case 'East Coast':
      return '+3 hours';
    case 'Europe':
      return '+8-9 hours';
    case 'Asia Pacific':
      return '+15-18 hours';
    default:
      return 'Unknown';
  }
}

export function TimezoneContent({ clients }: TimezoneContentProps) {
  const [filter, setFilter] = useState<RevenueFilterType>('mochary-method');

  const filteredClients = useMemo(() => {
    if (filter === 'mochary-method') {
      return clients.filter(c => c.referral_source === 'Mochary Method');
    }
    return clients;
  }, [clients, filter]);

  const { regions, clientsByRegionMap, pressure } = useMemo(() => {
    const total = filteredClients.length;

    const byRegion: Record<string, ClientByRegion[]> = {};
    for (const c of filteredClients) {
      if (!byRegion[c.region]) byRegion[c.region] = [];
      byRegion[c.region].push(c);
    }

    const regionStats = REGION_ORDER
      .filter(r => byRegion[r]?.length)
      .map(r => ({
        region: r,
        client_count: byRegion[r].length,
        percentage: total > 0 ? Math.round((byRegion[r].length / total) * 1000) / 10 : 0,
      }));

    const morningClients = filteredClients.filter(c => MORNING_PRESSURE_REGIONS.has(c.region)).length;

    return {
      regions: regionStats,
      clientsByRegionMap: byRegion,
      pressure: {
        morning_clients: morningClients,
        total_clients_with_location: total,
        morning_pressure_pct: total > 0 ? Math.round((morningClients / total) * 1000) / 10 : 0,
      },
    };
  }, [filteredClients]);

  return (
    <>
      <RevenueFilter value={filter} onChange={setFilter} />

      {/* Morning Pressure Summary */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">Morning Slot Pressure</CardTitle>
          <Sun className="h-5 w-5 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">{pressure.morning_pressure_pct}%</span>
            <span className="text-muted-foreground">of clients need morning PT slots</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {pressure.morning_clients} of {pressure.total_clients_with_location} clients with locations are in East Coast or Europe timezones
          </p>
          {pressure.morning_pressure_pct > 50 && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
              High morning pressure - consider prioritizing West Coast or flexible-schedule clients for new engagements
            </div>
          )}
        </CardContent>
      </Card>

      {/* Region Breakdown */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">Client Regions</CardTitle>
          <Globe className="h-5 w-5 text-blue-500" />
        </CardHeader>
        <CardContent>
          {regions.length > 0 ? (
            <div className="space-y-4">
              {regions.map((region) => (
                <div
                  key={region.region}
                  className={`p-4 rounded-lg border ${getRegionColor(region.region)}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-medium">{region.region}</div>
                      <div className="text-sm opacity-75">{getTimeOffset(region.region)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{region.client_count}</div>
                      <div className="text-sm opacity-75">{region.percentage}%</div>
                    </div>
                  </div>
                  {clientsByRegionMap[region.region] && (
                    <div className="pt-3 border-t border-current/20">
                      <div className="flex flex-wrap gap-2">
                        {clientsByRegionMap[region.region].map((client) => (
                          <Link
                            key={client.client_id}
                            href={`/?client=${client.client_id}`}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/50 hover:bg-white/80 transition-colors cursor-pointer"
                            title={client.location}
                          >
                            {client.client_name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No client locations set yet</p>
              <p className="text-sm mt-1">Add locations to clients in Supabase to see distribution</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="mt-6 p-4 bg-muted rounded-lg">
        <h3 className="text-sm font-medium text-foreground mb-2">Color Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span>Flexible (same TZ)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-500"></div>
            <span>Slight pressure</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-orange-500"></div>
            <span>Morning pressure</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span>High morning pressure</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-purple-500"></div>
            <span>Evening slots</span>
          </div>
        </div>
      </div>
    </>
  );
}
