import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Calendar, TrendingUp, BarChart3, AlertTriangle } from 'lucide-react';

interface StatsSectionProps {
  statsData: {
    sessionsThisWeek: number;
    avgSessionsPerWeek: number;
    avgSessionsPerMonth: number;
    rescheduleRate: number;
  };
}

export function StatsSection({ statsData }: StatsSectionProps) {
  return (
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

      {/* Reschedule/Cancel Rate */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Reschedule/Cancel Rate</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{statsData.rescheduleRate}%</div>
          <p className="text-xs text-muted-foreground">
            All time
          </p>
        </CardContent>
      </Card>
    </div>
  );
} 