import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, X, Image } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export interface RefuelRecord {
  id: string;
  reservation_number: string;
  rego: string;
  amount: number;
  added_to_rcm: boolean;
  refuelled_by: string;
  created_by: string;
  refuel_datetime: string;
  receipt_photo_url?: string;
  created_at: string;
  created_by_name?: string;
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

interface RefuelRecordSearchProps {
  branches?: any[];
}

const RefuelRecordSearch: React.FC<RefuelRecordSearchProps> = ({ branches = [] }) => {
  const [searchField, setSearchField] = useState<string>('rego');
  const [searchValue, setSearchValue] = useState<string>('');
  const [rcmStatus, setRcmStatus] = useState<string>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [results, setResults] = useState<RefuelRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { toast } = useToast();

  const searchFieldOptions = [
  { value: 'rego', label: 'Vehicle Registration' },
  { value: 'reservation_number', label: 'Reservation Number' },
  { value: 'refuelled_by', label: 'Refuelled By' },
  // { value: 'created_by', label: 'Created By' }, // commented out
  { value: 'rcm_status', label: 'RCM Status' }
  ];

  const handleSearch = async () => {
    if (!searchValue.trim() && searchField !== 'rcm_status') {
      toast({
        title: "Search value required",
        description: "Please enter a search value.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      let query = supabase
        .from('refuel_records')
        .select(`
          *,
          profiles!refuel_records_created_by_fkey(first_name, last_name)
        `)
        .gte('refuel_datetime', `${dateFrom}T00:00:00`)
        .lt('refuel_datetime', `${dateTo}T23:59:59`)
        .order('refuel_datetime', { ascending: false });

      // Apply branch filter
      if (selectedBranchId !== 'all') {
        query = query.eq('branch_id', selectedBranchId);
      }

      // Apply field-specific filters
      if (searchField === 'rcm_status') {
        if (rcmStatus !== 'all') {
          query = query.eq('added_to_rcm', rcmStatus === 'true');
        }
      }
      // else if (searchField === 'created_by') {
      //   // Search by first or last name in joined profile (Supabase PostgREST syntax)
      //   query = query.or(`(profiles.first_name.ilike.%${searchValue}%,profiles.last_name.ilike.%${searchValue}%)`);
      // }
      else if (searchField === 'rego') {
        query = query.ilike('rego', `%${searchValue.toUpperCase()}%`);
      } else {
        query = query.ilike(searchField, `%${searchValue}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Process results to include created_by name
      const processedResults = (data || []).map((record: any) => ({
        ...record,
        created_by_name: record.profiles ? `${record.profiles.first_name} ${record.profiles.last_name}` : 'Unknown User'
      }));

      setResults(processedResults);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search failed",
        description: "Failed to search refuel records. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSearchValue('');
    setRcmStatus('all');
    setSelectedBranchId('all');
    setDateFrom(format(new Date(), 'yyyy-MM-dd'));
    setDateTo(format(new Date(), 'yyyy-MM-dd'));
    setResults([]);
    setHasSearched(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Refuel Records
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label htmlFor="searchField">Search By</Label>
              <Select value={searchField} onValueChange={setSearchField}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card z-50">
                  {searchFieldOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card z-50">
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.code} - {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {searchField === 'rcm_status' ? (
              <div className="space-y-2">
                <Label htmlFor="rcmStatus">RCM Status</Label>
                <Select value={rcmStatus} onValueChange={setRcmStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card z-50">
                    <SelectItem value="all">All Records</SelectItem>
                    <SelectItem value="true">Added to RCM</SelectItem>
                    <SelectItem value="false">Not Added to RCM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="searchValue">Search Value</Label>
                <Input
                  id="searchValue"
                  placeholder={`Enter ${searchFieldOptions.find(o => o.value === searchField)?.label.toLowerCase()}`}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="dateFrom">From Date</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">To Date</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <div className="flex gap-2">
                <Button 
                  onClick={handleSearch} 
                  disabled={loading}
                  className="flex-1"
                >
                  <Search className="h-4 w-4 mr-2" />
                  {loading ? 'Searching...' : 'Search'}
                </Button>
                <Button variant="outline" onClick={handleClear}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle>
              Search Results ({results.length} record{results.length !== 1 ? 's' : ''} found)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No records found matching your search criteria.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Reservation #</TableHead>
                      <TableHead>Registration</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>RCM Status</TableHead>
                      <TableHead>Refuelled By</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((record) => (
                      <TableRow key={record.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">
                          {record.reservation_number}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {record.rego}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${record.amount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={record.added_to_rcm ? "default" : "secondary"}>
                            {record.added_to_rcm ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell>{record.refuelled_by}</TableCell>
                        <TableCell>{record.created_by_name || 'Unknown User'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          <div className="space-y-1">
                            <div>{format(new Date(record.refuel_datetime), 'MMM d, yyyy')}</div>
                            <div className="text-xs">{format(new Date(record.refuel_datetime), 'HH:mm')}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.receipt_photo_url ? (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <Image className="h-4 w-4 text-success" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Receipt for {record.rego}</DialogTitle>
                                </DialogHeader>
                                <div className="flex justify-center">
                                  <img
                                    src={supabase.storage.from('refuel-receipts').getPublicUrl(record.receipt_photo_url.replace(/^.*refuel-receipts\//, "")).data.publicUrl}
                                    alt={`Receipt for ${record.rego}`}
                                    className="max-w-full max-h-96 object-contain rounded-md"
                                    onError={(e) => {
                                      console.error('Image failed to load:', record.receipt_photo_url);
                                      e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTkgOUg3VjdIOVY5WiIgZmlsbD0iIzk5OTk5OSIvPgo8cGF0aCBkPSJNMjEgNUgzQzEuOSA1IDEgNS45IDEgN1YxN0MxIDE4LjEgMS45IDE5IDMgMTlIMjFDMjIuMSAxOSAyMyAxOC4xIDIzIDE3VjdDMjMgNS45IDIyLjEgNSAyMSA1Wk0yMSAxN0gzVjlIMjFWMTdaIiBmaWxsPSIjOTk5OTk5Ii8+CjxwYXRoIGQ9Ik0xNi41IDEyTDE0IDkuNUwxMSAxMi41TDkgMTAuNUw3IDE0SDE3TDE2LjUgMTJaIiBmaWxsPSIjOTk5OTk5Ii8+Cjwvc3ZnPgo=';
                                    }}
                                  />
                                </div>
                              </DialogContent>
                            </Dialog>
                          ) : (
                            <span className="text-muted-foreground text-xs">No receipt</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RefuelRecordSearch;