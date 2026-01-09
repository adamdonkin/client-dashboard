import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Calendar, TrendingUp, BarChart3, DollarSign, Target, Users, Clock, Gauge } from 'lucide-react';
import { RevenueFilter, RevenueFilterType } from './RevenueFilter';

interface RevenueStats {
  total_monthly_revenue: string;
  annual_projection: string;
  active_paying_clients: number;
  average_client_fee: string;
  pending_monthly_revenue?: string;
  pending_clients?: number;
  capacity_count?: number;
}

interface StatsSectionProps {
  statsData: {
    sessionsThisWeek: number;
    scheduledSessionsThisWeek: number;
    avgSessionsPerWeek: number;
    avgSessionsPerMonth: number;
    sessionsThisMonth: number;
    rescheduleRate: number;
    avgEngagementLength: number;
    totalSessionsThisYear: number;
    revenueStats: RevenueStats;
    revenueStatsMochary?: RevenueStats;
  };
  onRevenueFilterChange?: (filter: RevenueFilterType) => void;
}

export function StatsSection({ statsData, onRevenueFilterChange }: StatsSectionProps) {
  const [revenueFilter, setRevenueFilter] = useState<RevenueFilterType>('all');
  
  const handleFilterChange = (filter: RevenueFilterType) => {
    setRevenueFilter(filter);
    onRevenueFilterChange?.(filter);
  };
  
  // Use filtered revenue stats based on current filter
  const currentRevenueStats = revenueFilter === 'mochary-method' 
    ? (statsData.revenueStatsMochary || statsData.revenueStats)
    : statsData.revenueStats;

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Capacity calculations (always use total, not filtered)
  // Use capacity_count if available (active + pending), otherwise fall back to active_paying_clients
  const capacityCount = statsData.revenueStats?.capacity_count || statsData.revenueStats?.active_paying_clients || 0;
  const activeClientCount = statsData.revenueStats?.active_paying_clients || 0;
  const pendingClientCount = statsData.revenueStats?.pending_clients || 0;
  const pendingRevenue = parseFloat(statsData.revenueStats?.pending_monthly_revenue || '0');
  const maxCapacity = 20;
  const availableSlots = Math.max(0, maxCapacity - capacityCount);
  
  // Traffic light color for capacity (matching navbar)
  const getCapacityColor = (count: number) => {
    if (count >= 20) return 'text-danger';
    if (count >= 18) return 'text-warning';
    return 'text-success';
  };

  const getCapacityBgColor = (count: number) => {
    if (count >= 20) return 'bg-red-50 dark:bg-red-950/20';
    if (count >= 18) return 'bg-amber-50 dark:bg-amber-950/20';
    return 'bg-green-50 dark:bg-green-950/20';
  };

  const getCapacityText = () => {
    // Always show breakdown if there are pending clients
    if (pendingClientCount > 0) {
      return `${activeClientCount} active + ${pendingClientCount} pending`;
    }
    if (availableSlots === 0) return 'At Capacity';
    if (availableSlots === 1) return '1 slot available';
    return `${availableSlots} slots available`;
  };

  return (
    <div className="space-y-6">
      {/* Revenue Filter */}
      <RevenueFilter value={revenueFilter} onChange={handleFilterChange} />
      
      {/* Revenue Statistics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Capacity */}
          <Card className={`flex flex-col ${getCapacityBgColor(capacityCount)}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Capacity</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-end">
              <div className={`text-2xl font-bold ${getCapacityColor(capacityCount)}`}>
                {capacityCount}
              </div>
              <p className="text-xs text-muted-foreground">
                {getCapacityText()}
              </p>
            </CardContent>
          </Card>

          {/* Monthly Recurring Revenue */}
          <Card className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-end">
              <div className="text-2xl font-bold">
                {currentRevenueStats ? formatCurrency(currentRevenueStats.total_monthly_revenue) : '$0'}
              </div>
              {pendingRevenue > 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  +{formatCurrency(pendingRevenue)} pending
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Monthly revenue
                </p>
              )}
            </CardContent>
          </Card>

          {/* Annual Projection */}
          <Card className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Annual</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-end">
              <div className="text-2xl font-bold">
                {currentRevenueStats ? formatCurrency(currentRevenueStats.annual_projection) : '$0'}
              </div>
              {pendingRevenue > 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  +{formatCurrency(pendingRevenue * 12)} pending
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Annual revenue
                </p>
              )}
            </CardContent>
          </Card>

          {/* Average Client Fee */}
          <Card className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Rate</CardTitle>
              <Gauge className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-end">
              <div className="text-2xl font-bold">
                {currentRevenueStats ? formatCurrency(currentRevenueStats.average_client_fee) : '$0'}
              </div>
              <p className="text-xs text-muted-foreground">
                Per month per client
              </p>
            </CardContent>
          </Card>
      </div>

      {/* Session Statistics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sessions Completed: Week / Month / Year */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sessions Completed</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end">
                <div className="text-center">
                  <div className="text-2xl">
                    <span className="font-bold">{statsData.sessionsThisWeek}</span>
                    <span className="text-muted-foreground">/{statsData.scheduledSessionsThisWeek}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">This Week</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{statsData.sessionsThisMonth}</div>
                  <p className="text-xs text-muted-foreground">{new Date().toLocaleString('en-US', { month: 'short' })}</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{statsData.totalSessionsThisYear}</div>
                  <p className="text-xs text-muted-foreground">2025</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Avg Sessions: Week / Month */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Sessions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end">
                <div className="text-center">
                  <div className="text-2xl font-bold">{statsData.avgSessionsPerWeek}</div>
                  <p className="text-xs text-muted-foreground">Per Week</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{statsData.avgSessionsPerMonth}</div>
                  <p className="text-xs text-muted-foreground">Per Month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Avg Engagement Length */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Engagement</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.avgEngagementLength} mo</div>
              <p className="text-xs text-muted-foreground">
                Client retention length
              </p>
            </CardContent>
          </Card>
      </div>
    </div>
  );
}