import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Calendar, TrendingUp, BarChart3, DollarSign, Target, Users, Clock } from 'lucide-react';

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

  return (
    <div className="space-y-6">
      {/* Session Statistics Row */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Sessions This Week */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sessions This Week</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.sessionsThisWeek}</div>
              <p className="text-xs text-muted-foreground">
                Sunday to Saturday (LA time)
              </p>
            </CardContent>
          </Card>

          {/* Avg Sessions/Week */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Sessions/Week</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.avgSessionsPerWeek}</div>
              <p className="text-xs text-muted-foreground">
                Rolling 12 weeks
              </p>
            </CardContent>
          </Card>

          {/* Avg Sessions/Month */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Sessions/Month</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.avgSessionsPerMonth}</div>
              <p className="text-xs text-muted-foreground">
                Last 3 months
              </p>
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

      {/* Revenue Statistics Row */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Monthly Recurring Revenue */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {revenueStats ? formatCurrency(revenueStats.total_monthly_revenue) : '$0'}
              </div>
              <p className="text-xs text-muted-foreground">
                Active paying clients
              </p>
            </CardContent>
          </Card>

          {/* Annual Projection */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Annual Projection</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {revenueStats ? formatCurrency(revenueStats.annual_projection) : '$0'}
              </div>
              <p className="text-xs text-muted-foreground">
                Based on current MRR
              </p>
            </CardContent>
          </Card>

          {/* Average Client Fee */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Client Fee</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {revenueStats ? formatCurrency(revenueStats.average_client_fee) : '$0'}
              </div>
              <p className="text-xs text-muted-foreground">
                Per month per client
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}