import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRefuelStatistics, SearchFilters } from '@/hooks/useRefuelStatistics';
import { CalendarIcon, BarChart3, TrendingUp, Calendar as CalendarIconAlt } from 'lucide-react';
import { format, subDays, subWeeks, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { Branch } from '@/types/database';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
interface RefuelStatisticsProps {
  branches: Branch[];
}

export const RefuelStatistics = ({ branches }: RefuelStatisticsProps) => {
  const { statistics, loading, fetchStatistics } = useRefuelStatistics();
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);

  const handleQuickFilter = (period: 'today' | 'week' | 'month' | 'custom') => {
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = subWeeks(now, 1);
        break;
      case 'month':
        startDate = subMonths(now, 1);
        break;
      default:
        return;
    }
    
    const newFilters = { ...filters, startDate, endDate: now };
    setFilters(newFilters);
    fetchStatistics(newFilters);
  };

  const handleGetStatistics = () => {
    fetchStatistics(filters);
  };

  return (
    <div className="space-y-6">
      {/* Quick Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Statistical Summary
          </CardTitle>
          <CardDescription>
            Generate statistics and search refuel records across all branches
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button
              variant="outline"
              onClick={() => handleQuickFilter('today')}
              className="justify-start"
            >
              Today
            </Button>
            <Button
              variant="outline"
              onClick={() => handleQuickFilter('week')}
              className="justify-start"
            >
              Last 7 Days
            </Button>
            <Button
              variant="outline"
              onClick={() => handleQuickFilter('month')}
              className="justify-start"
            >
              Last 30 Days
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const startDate = new Date('2024-01-01');
                const endDate = new Date();
                const newFilters = { ...filters, startDate, endDate };
                setFilters(newFilters);
                fetchStatistics(newFilters);
              }}
              className="justify-start"
            >
              All Time
            </Button>
          </div>

          {/* Custom Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover open={showDatePicker === 'start'} onOpenChange={(open) => setShowDatePicker(open ? 'start' : null)}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.startDate ? format(filters.startDate, "PPP") : <span>Pick start date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.startDate}
                    onSelect={(date) => {
                      setFilters(prev => ({ ...prev, startDate: date }));
                      setShowDatePicker(null);
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover open={showDatePicker === 'end'} onOpenChange={(open) => setShowDatePicker(open ? 'end' : null)}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.endDate ? format(filters.endDate, "PPP") : <span>Pick end date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.endDate}
                    onSelect={(date) => {
                      setFilters(prev => ({ ...prev, endDate: date }));
                      setShowDatePicker(null);
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={filters.branchId || 'all'} onValueChange={(value) => setFilters(prev => ({ ...prev, branchId: value === 'all' ? undefined : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.code} - {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleGetStatistics} disabled={loading} className="w-full">
            {loading ? 'Loading...' : 'Generate Statistics'}
          </Button>
        </CardContent>
      </Card>

      {/* Statistics Display */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{statistics.totalRecords}</p>
                  <p className="text-sm text-muted-foreground">Total Records</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/10 rounded-lg">
                  <span className="text-success font-bold">$</span>
                </div>
                <div>
                  <p className="text-2xl font-bold">${statistics.totalAmount.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <CalendarIconAlt className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{statistics.dailyTotals.length}</p>
                  <p className="text-sm text-muted-foreground">Active Days</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-secondary/10 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{statistics.recordsByBranch.length}</p>
                  <p className="text-sm text-muted-foreground">Active Branches</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {statistics && statistics.dailyTotals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Refuel Cost Trend</CardTitle>
            <CardDescription>
              {filters.branchId ? 'Daily total amount for selected branch' : 'Daily total amount by branch'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={
                filters.branchId 
                  ? { amount: { label: 'Total Amount', color: 'hsl(var(--primary))' } }
                  : statistics.recordsByBranch.reduce((acc, branch, index) => {
                      const colors = [
                        'hsl(var(--primary))',
                        'hsl(var(--secondary))',
                        'hsl(var(--accent))',
                        'hsl(210, 40%, 60%)',
                        'hsl(330, 40%, 60%)',
                        'hsl(120, 40%, 60%)'
                      ];
                      acc[branch.branchCode] = {
                        label: branch.branchName,
                        color: colors[index % colors.length]
                      };
                      return acc;
                    }, {} as any)
              }
              className="w-full"
            >
              <LineChart 
                data={
                  filters.branchId 
                    ? statistics.dailyTotals.slice().reverse().map((d) => ({ date: d.date, amount: d.totalAmount }))
                    : (() => {
                        // Create multi-branch data using actual daily branch data
                        const chartData = statistics.dailyTotalsByBranch.map(dayData => {
                          const dataPoint: any = { date: dayData.date };
                          statistics.recordsByBranch.forEach(branch => {
                            dataPoint[branch.branchCode] = dayData.branches[branch.branchCode] || 0;
                          });
                          return dataPoint;
                        });
                        return chartData;
                      })()
                }
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'MMM d')} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                {filters.branchId ? (
                  <Line type="monotone" dataKey="amount" stroke="var(--color-amount)" strokeWidth={2} dot={false} />
                ) : (
                  statistics.recordsByBranch.map((branch, index) => (
                    <Line 
                      key={branch.branchCode}
                      type="monotone" 
                      dataKey={branch.branchCode} 
                      stroke={`var(--color-${branch.branchCode})`} 
                      strokeWidth={2} 
                      dot={false}
                      name={branch.branchName}
                    />
                  ))
                )}
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Branch Breakdown */}
      {statistics && statistics.recordsByBranch.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Branch Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-right">Average</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statistics.recordsByBranch.map((branch, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{branch.branchName}</div>
                        <div className="text-sm text-muted-foreground">{branch.branchCode}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{branch.recordCount}</TableCell>
                    <TableCell className="text-right">${branch.totalAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">${(branch.totalAmount / branch.recordCount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

    </div>
  );
};