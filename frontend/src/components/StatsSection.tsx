import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Calendar, TrendingUp, BarChart3, DollarSign, Target, Users, Clock, Gauge } from 'lucide-react';

interface RevenueStats {
  total_monthly_revenue: string;
  annual_projection: string;
  active_paying_clients: number;
  average_client_fee: string;
}

interface StatsSectionProps {
  statsData: {
    sessionsThisWeek: number;
    avgSessionsPerWeek: number;
    avgSessionsPerMonth: number;
    rescheduleRate: number;
    avgEngagementLength: number;
    totalSessionsThisYear: number;
    revenueStats: RevenueStats;
  };
}

export function StatsSection({ statsData }: StatsSectionProps) {
  const { revenueStats } = statsData;

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Capacity calculations
  const activeClientCount = revenueStats?.active_paying_clients || 0;
  const maxCapacity = 22;
  const availableSlots = Math.max(0, maxCapacity - activeClientCount);
  
  // Traffic light color for capacity (matching navbar)
  const getCapacityColor = (count: number) => {
    if (count >= 22) return 'text-danger';
    if (count >= 20) return 'text-warning';
    return 'text-success';
  };

  const getCapacityBgColor = (count: number) => {
    if (count >= 22) return 'bg-red-50 dark:bg-red-950/20';
    if (count >= 20) return 'bg-amber-50 dark:bg-amber-950/20';
    return 'bg-green-50 dark:bg-green-950/20';
  };

  const getCapacityText = (available: number) => {
    if (available === 0) return 'At Capacity';
    if (available === 1) return '1 slot available';
    return `${available} slots available`;
  };

  return (
    <div className="space-y-6">
      {/* Revenue Statistics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Capacity */}
          <Card className={`flex flex-col ${getCapacityBgColor(activeClientCount)}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Capacity</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-end">
              <div className={`text-2xl font-bold ${getCapacityColor(activeClientCount)}`}>
                {activeClientCount}
              </div>
              <p className="text-xs text-muted-foreground">
                {getCapacityText(availableSlots)}
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
                {revenueStats ? formatCurrency(revenueStats.total_monthly_revenue) : '$0'}
              </div>
              <p className="text-xs text-muted-foreground">
                Monthly revenue
              </p>
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
                {revenueStats ? formatCurrency(revenueStats.annual_projection) : '$0'}
              </div>
              <p className="text-xs text-muted-foreground">
                Annual revenue
              </p>
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
                {revenueStats ? formatCurrency(revenueStats.average_client_fee) : '$0'}
              </div>
              <p className="text-xs text-muted-foreground">
                Per month per client
              </p>
            </CardContent>
          </Card>
      </div>

      {/* Session Statistics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sessions Summary: Week / Month / Year */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Session Count</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end">
                <div className="text-center">
                  <div className="text-2xl font-bold">{statsData.sessionsThisWeek}</div>
                  <p className="text-xs text-muted-foreground">Week</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{statsData.avgSessionsPerMonth}</div>
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