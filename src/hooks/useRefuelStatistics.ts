import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { DatabaseRefuelRecord } from '@/types/database';

export interface RefuelStatistics {
  totalRecords: number;
  totalAmount: number;
  recordsByBranch: Array<{
    branchName: string;
    branchCode: string;
    recordCount: number;
    totalAmount: number;
  }>;
  dailyTotals: Array<{
    date: string;
    recordCount: number;
    totalAmount: number;
  }>;
}

export interface SearchFilters {
  startDate?: Date;
  endDate?: Date;
  branchId?: string;
  rego?: string;
}

export const useRefuelStatistics = () => {
  const [statistics, setStatistics] = useState<RefuelStatistics | null>(null);
  const [searchResults, setSearchResults] = useState<DatabaseRefuelRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchStatistics = async (filters: SearchFilters = {}) => {
    setLoading(true);
    try {
      let query = supabase
        .from('refuel_records')
        .select(`
          *,
          branches:branch_id (
            name,
            code
          )
        `)
        ;

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }
      if (filters.branchId) {
        query = query.eq('branch_id', filters.branchId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const records = data || [];
      
      // Calculate statistics
      const totalRecords = records.length;
      const totalAmount = records.reduce((sum, record) => sum + Number(record.amount), 0);
      
      // Group by branch
      const branchMap = new Map();
      records.forEach(record => {
        const branchKey = record.branch_id;
        if (!branchMap.has(branchKey)) {
          branchMap.set(branchKey, {
          branchName: (record as any).branches?.name || 'Unknown',
          branchCode: (record as any).branches?.code || 'N/A',
            recordCount: 0,
            totalAmount: 0,
          });
        }
        const branch = branchMap.get(branchKey);
        branch.recordCount++;
        branch.totalAmount += Number(record.amount);
      });

      // Group by date
      const dateMap = new Map();
      records.forEach(record => {
        const date = record.created_at.split('T')[0];
        if (!dateMap.has(date)) {
          dateMap.set(date, {
            date,
            recordCount: 0,
            totalAmount: 0,
          });
        }
        const day = dateMap.get(date);
        day.recordCount++;
        day.totalAmount += Number(record.amount);
      });

      setStatistics({
        totalRecords,
        totalAmount,
        recordsByBranch: Array.from(branchMap.values()),
        dailyTotals: Array.from(dateMap.values()).sort((a, b) => b.date.localeCompare(a.date)),
      });
    } catch (error) {
      console.error('Error fetching statistics:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch refuel statistics.",
      });
    } finally {
      setLoading(false);
    }
  };

  const searchRefuelRecords = async (filters: SearchFilters) => {
    setSearchLoading(true);
    try {
      let query = supabase
        .from('refuel_records')
        .select(`
          *,
          branches:branch_id (
            name,
            code
          )
        `)
        ;

      if (filters.rego) {
        query = query.ilike('rego', `%${filters.rego}%`);
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }
      if (filters.branchId) {
        query = query.eq('branch_id', filters.branchId);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching records:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to search refuel records.",
      });
    } finally {
      setSearchLoading(false);
    }
  };

  return {
    statistics,
    searchResults,
    loading,
    searchLoading,
    fetchStatistics,
    searchRefuelRecords,
  };
};