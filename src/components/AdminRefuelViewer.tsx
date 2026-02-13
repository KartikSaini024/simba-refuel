import React, { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { RefuelRecord, Staff } from "@/types/refuel";
import { AdminRefuelTable, AdminRefuelRecord } from "@/components/AdminRefuelTable";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Filter, ArrowUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface AdminRefuelViewerProps {
    branches: any[];
}

export const AdminRefuelViewer: React.FC<AdminRefuelViewerProps> = ({
    branches,
}) => {
    const [records, setRecords] = useState<AdminRefuelRecord[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
    const [dateRange, setDateRange] = useState<{
        from: Date | undefined;
        to: Date | undefined;
    }>({
        from: new Date(),
        to: new Date(),
    });
    const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

    useEffect(() => {
        fetchStaff();
    }, [branches]); // Fetch staff when branches load/change potentially

    // Fetch records whenever filters change
    useEffect(() => {
        fetchRecords();
    }, [selectedBranchId, dateRange, sortOrder]);

    const fetchStaff = async () => {
        const { data, error } = await supabase.from("staff").select("*").order("name");
        if (data) {
            // Map to Staff type
            const staff: Staff[] = data.map((s: any) => ({
                id: s.id,
                name: s.name,
                branchId: s.branch_id,
                status: s.status,
            }));
            setStaffList(staff);
        }
    };

    const fetchRecords = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from("refuel_records")
                .select(`
          *,
          refueler:staff!refuel_records_refueled_by_fkey(name),
          creator:profiles!refuel_records_created_by_fkey(first_name, last_name),
          branch:branches!refuel_records_branch_id_fkey(name, code)
        `);

            if (selectedBranchId !== "all") {
                query = query.eq("branch_id", selectedBranchId);
            }

            if (dateRange.from) {
                const fromStr = format(dateRange.from, "yyyy-MM-dd");
                query = query.gte("created_at", `${fromStr}T00:00:00`);
            }

            if (dateRange.to) {
                const toStr = format(dateRange.to, "yyyy-MM-dd");
                query = query.lte("created_at", `${toStr}T23:59:59`);
            }

            query = query.order("created_at", { ascending: sortOrder === "asc" });

            const { data, error } = await query;

            if (error) throw error;

            const formattedRecords: RefuelRecord[] = (data || []).map((r: any) => ({
                id: r.id,
                rego: r.rego,
                amount: r.amount,
                refuelledBy: r.refueler?.name || r.refuelled_by || r.refueled_by || "",
                addedBy: r.creator
                    ? `${r.creator.first_name} ${r.creator.last_name}`
                    : "System",
                reservationNumber: r.reservation_number,
                addedToRCM: r.added_to_rcm ?? false,
                createdAt: new Date(r.created_at),
                receiptPhotoUrl: r.receipt_photo_url || undefined,
                branchName: r.branch ? `${r.branch.code} - ${r.branch.name}` : undefined,
            }));

            setRecords(formattedRecords);
        } catch (error: any) {
            console.error("Error fetching admin records:", error);
            toast({
                variant: "destructive",
                title: "Error fetching records",
                description: error.message,
            });
        } finally {
            setLoading(false);
        }
    };

    // Group records by Date
    const groupedRecords = React.useMemo(() => {
        const groups: { [key: string]: AdminRefuelRecord[] } = {};
        records.forEach((record) => {
            // Use localized date string for grouping key to handle timezones simply for display
            // Ideally we use the raw date and format it
            const dateKey = format(record.createdAt, "yyyy-MM-dd");
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(record);
        });
        return groups;
    }, [records]);

    // Handlers for CRUD (Admin Power)
    const handleRemoveRecord = async (id: string) => {
        try {
            const { error } = await supabase.from("refuel_records").delete().eq("id", id);
            if (error) throw error;
            toast({ title: "Record deleted" });
            fetchRecords(); // Refresh
        } catch (error: any) {
            console.error("Delete error:", error);
            toast({ variant: "destructive", title: "Failed to delete", description: error.message });
        }
    };

    const handleUpdateRecord = async (id: string, updatedData: Partial<RefuelRecord>) => {
        try {
            // Convert frontend model back to DB model
            const dbData: any = {};
            if (updatedData.reservationNumber !== undefined) dbData.reservation_number = updatedData.reservationNumber;
            if (updatedData.rego !== undefined) dbData.rego = updatedData.rego;
            if (updatedData.amount !== undefined) dbData.amount = updatedData.amount;
            if (updatedData.addedToRCM !== undefined) dbData.added_to_rcm = updatedData.addedToRCM;
            if (updatedData.refuelledBy !== undefined) {
                // Check if it's a UUID (staff selection) or legacy string
                // Actually RefuelTable passes the value from Select which is UUID
                dbData.refueled_by = updatedData.refuelledBy;
                // We also update legacy field for safety if we want, but schema moving to UUID
            }
            if (updatedData.receiptPhotoUrl !== undefined) dbData.receipt_photo_url = updatedData.receiptPhotoUrl;
            if (updatedData.createdAt !== undefined) dbData.created_at = updatedData.createdAt.toISOString();

            const { error } = await supabase
                .from("refuel_records")
                .update(dbData)
                .eq("id", id);

            if (error) throw error;
            toast({ title: "Record updated" });
            fetchRecords();
        } catch (error: any) {
            console.error("Update error:", error);
            toast({ variant: "destructive", title: "Update failed", description: error.message });
        }
    };

    return (
        <div className="space-y-6">
            {/* Filters Header */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Show Records
                    </CardTitle>
                    <CardDescription>Narrow down the records by branch and date.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                            <Label>Branch</Label>
                            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Branches" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Branches</SelectItem>
                                    {branches.map((b) => (
                                        <SelectItem key={b.id} value={b.id}>
                                            {b.code} - {b.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>From Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !dateRange.from && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateRange.from ? format(dateRange.from, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={dateRange.from}
                                        onSelect={(d) => setDateRange((prev) => ({ ...prev, from: d }))}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label>To Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !dateRange.to && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateRange.to ? format(dateRange.to, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={dateRange.to}
                                        onSelect={(d) => setDateRange((prev) => ({ ...prev, to: d }))}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label>&nbsp;</Label>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                            >
                                <ArrowUpDown className="mr-2 h-4 w-4" />
                                Sort: {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Grouped Records Display */}
            <div className="space-y-8">
                {loading ? (
                    <div className="text-center py-10">Loading records...</div>
                ) : Object.keys(groupedRecords).length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">No records found for the selected criteria.</div>
                ) : (
                    Object.keys(groupedRecords).map((dateKey) => {
                        const dateGroup = groupedRecords[dateKey];
                        // Calculate totals for this group
                        const dayTotal = dateGroup.reduce((sum, r) => sum + r.amount, 0);

                        return (
                            <div key={dateKey} className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-lg font-semibold text-primary">
                                        {format(parseISO(dateKey), "EEEE, MMMM do, yyyy")}
                                    </h3>
                                    <div className="text-sm font-medium bg-secondary px-3 py-1 rounded-full">
                                        Total: ${dayTotal.toFixed(2)} ({dateGroup.length} records)
                                    </div>
                                </div>

                                {/* Use the AdminRefuelTable for a beautiful, consistent UI with Branch column */}
                                <AdminRefuelTable
                                    records={dateGroup}
                                    onRemoveRecord={handleRemoveRecord}
                                    onUpdateRecord={handleUpdateRecord}
                                    selectedDate={parseISO(dateKey)}
                                    staff={staffList}
                                />
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
