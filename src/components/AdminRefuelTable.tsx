import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, FileText, Edit2, Check, X, Image } from "lucide-react";
import { RefuelRecord, Staff } from "@/types/refuel";
import { format, isToday } from "date-fns";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

// Extended interface for Admin view
export interface AdminRefuelRecord extends RefuelRecord {
    branchName?: string;
}

interface AdminRefuelTableProps {
    records: AdminRefuelRecord[];
    onRemoveRecord: (id: string) => void;
    onUpdateRecord?: (id: string, updatedData: Partial<RefuelRecord>) => void;
    selectedDate?: Date;
    staff?: Staff[];
}

export const AdminRefuelTable = ({
    records,
    onRemoveRecord,
    onUpdateRecord,
    selectedDate = new Date(),
    staff = [],
}: AdminRefuelTableProps) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Partial<RefuelRecord>>({});
    const [editingPhoto, setEditingPhoto] = useState<File | null>(null);
    const totalAmount = records.reduce((sum, record) => sum + record.amount, 0);

    const startEditing = (record: RefuelRecord) => {
        setEditingId(record.id);
        setEditData({
            reservationNumber: record.reservationNumber,
            rego: record.rego,
            amount: record.amount,
            addedToRCM: record.addedToRCM,
            refuelledBy: record.refuelledBy,
            receiptPhotoUrl: record.receiptPhotoUrl,
            createdAt: record.createdAt,
        });
        setEditingPhoto(null);
    };

    const compressImage = (file: File, quality: number = 0.7): Promise<File> => {
        return new Promise((resolve) => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d")!;
            const img = new window.Image();

            img.onload = () => {
                const maxWidth = 1200;
                const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
                const newWidth = img.width * ratio;
                const newHeight = img.height * ratio;

                canvas.width = newWidth;
                canvas.height = newHeight;

                ctx.drawImage(img, 0, 0, newWidth, newHeight);
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            const compressedFile = new File([blob], file.name, {
                                type: "image/jpeg",
                                lastModified: Date.now(),
                            });
                            resolve(compressedFile);
                        }
                    },
                    "image/jpeg",
                    quality
                );
            };

            img.src = URL.createObjectURL(file);
        });
    };

    const saveEdit = async () => {
        if (editingId && onUpdateRecord) {
            let finalEditData = { ...editData };

            // Handle photo upload if new photo selected
            if (editingPhoto) {
                try {
                    const compressedFile = await compressImage(editingPhoto);
                    const fileExt = "jpg";
                    const fileName = `${Date.now()}-${Math.random()
                        .toString(36)
                        .substring(2)}.${fileExt}`;

                    const { data, error } = await supabase.storage
                        .from("refuel-receipts")
                        .upload(fileName, compressedFile);

                    if (error) throw error;
                    finalEditData.receiptPhotoUrl = data.path;
                } catch (error) {
                    console.error("Error uploading photo:", error);
                }
            }

            // Update handling delegated to parent via onUpdateRecord

            onUpdateRecord(editingId, finalEditData);

            setEditingId(null);
            setEditData({});
            setEditingPhoto(null);
        }
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditData({});
        setEditingPhoto(null);
    };

    if (records.length === 0) {
        return (
            <Card className="shadow-md">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary">
                        <FileText className="h-5 w-5" />
                        {isToday(selectedDate)
                            ? "Today's Refuel Records"
                            : `${format(selectedDate, "MMM d, yyyy")}'s Refuel Records`}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        No refuel records for today. Add some records to get started.
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-md">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                    <FileText className="h-5 w-5" />
                    {isToday(selectedDate)
                        ? "Today's Refuel Records"
                        : `${format(selectedDate, "MMM d, yyyy")}'s Refuel Records`}{" "}
                    ({records.length})
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead>Branch</TableHead> {/* NEW COLUMN */}
                                <TableHead>Reservation #</TableHead>
                                <TableHead>Registration</TableHead>
                                <TableHead>RCM Status</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead>Refuelled By</TableHead>
                                <TableHead>Added By</TableHead>
                                <TableHead>Date & Time</TableHead>
                                <TableHead>Receipt</TableHead>
                                <TableHead className="w-[100px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {records.map((record) => (
                                <TableRow key={record.id} className="hover:bg-muted/30">
                                    <TableCell>
                                        <Badge variant="outline" className="font-normal">
                                            {record.branchName || "Unknown"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {editingId === record.id ? (
                                            <Input
                                                value={editData.reservationNumber || ""}
                                                onChange={(e) =>
                                                    setEditData({
                                                        ...editData,
                                                        reservationNumber: e.target.value,
                                                    })
                                                }
                                                className="w-full"
                                            />
                                        ) : (
                                            record.reservationNumber
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editingId === record.id ? (
                                            <Input
                                                value={editData.rego || ""}
                                                onChange={(e) =>
                                                    setEditData({
                                                        ...editData,
                                                        rego: e.target.value.toUpperCase(),
                                                    })
                                                }
                                                className="w-full"
                                            />
                                        ) : (
                                            <Badge variant="outline" className="font-mono">
                                                {record.rego}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editingId === record.id ? (
                                            <Switch
                                                checked={editData.addedToRCM || false}
                                                onCheckedChange={(checked) =>
                                                    setEditData({ ...editData, addedToRCM: checked })
                                                }
                                            />
                                        ) : (
                                            <Badge
                                                variant={record.addedToRCM ? "default" : "secondary"}
                                            >
                                                {record.addedToRCM ? "Yes" : "No"}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {editingId === record.id ? (
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={editData.amount || ""}
                                                onChange={(e) =>
                                                    setEditData({
                                                        ...editData,
                                                        amount: parseFloat(e.target.value) || 0,
                                                    })
                                                }
                                                className="w-24 ml-auto"
                                            />
                                        ) : (
                                            `$${record.amount.toFixed(2)}`
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editingId === record.id ? (
                                            <Select
                                                value={editData.refuelledBy || ""}
                                                onValueChange={(value) =>
                                                    setEditData({ ...editData, refuelledBy: value })
                                                }
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select staff member" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-card z-50">
                                                    {staff.map((member) => (
                                                        <SelectItem key={member.id} value={member.id}>
                                                            {member.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            (staff.find(s => s.id === record.refuelledBy)?.name || record.refuelledBy)
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-muted-foreground text-sm">
                                            {record.addedBy || "-"}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {editingId === record.id ? (
                                            <Input
                                                type="datetime-local"
                                                value={format(
                                                    (editData.createdAt as Date) || record.createdAt,
                                                    "yyyy-MM-dd'T'HH:mm"
                                                )}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val) {
                                                        setEditData({
                                                            ...editData,
                                                            createdAt: new Date(val),
                                                        });
                                                    }
                                                }}
                                                className="w-56"
                                            />
                                        ) : (
                                            <div className="space-y-1">
                                                <div>{format(record.createdAt, "MMM d, yyyy")}</div>
                                                <div className="text-xs">
                                                    {format(record.createdAt, "HH:mm")}
                                                </div>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editingId === record.id ? (
                                            <div className="space-y-2">
                                                {(editData.receiptPhotoUrl || editingPhoto) && (
                                                    <div className="relative w-16 h-16">
                                                        <img
                                                            src={
                                                                editingPhoto
                                                                    ? URL.createObjectURL(editingPhoto)
                                                                    : editData.receiptPhotoUrl
                                                                        ? editData.receiptPhotoUrl.startsWith("http")
                                                                            ? editData.receiptPhotoUrl
                                                                            : supabase.storage
                                                                                .from("refuel-receipts")
                                                                                .getPublicUrl(editData.receiptPhotoUrl)
                                                                                .data.publicUrl
                                                                        : ""
                                                            }
                                                            alt="Receipt preview"
                                                            className="w-16 h-16 object-cover rounded border"
                                                        />
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            className="absolute -top-2 -right-2 h-6 w-6 p-0"
                                                            onClick={() => {
                                                                setEditData({
                                                                    ...editData,
                                                                    receiptPhotoUrl: undefined,
                                                                });
                                                                setEditingPhoto(null);
                                                            }}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                )}
                                                <Input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) setEditingPhoto(file);
                                                    }}
                                                    className="text-xs"
                                                />
                                            </div>
                                        ) : record.receiptPhotoUrl ? (
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
                                                            src={
                                                                record.receiptPhotoUrl.startsWith("http")
                                                                    ? record.receiptPhotoUrl
                                                                    : supabase.storage
                                                                        .from("refuel-receipts")
                                                                        .getPublicUrl(record.receiptPhotoUrl).data
                                                                        .publicUrl
                                                            }
                                                            alt={`Receipt for ${record.rego}`}
                                                            className="max-w-full max-h-96 object-contain rounded-md"
                                                            onError={(e) => {
                                                                console.error(
                                                                    "Image failed to load:",
                                                                    record.receiptPhotoUrl
                                                                );
                                                                e.currentTarget.src =
                                                                    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTkgOUg3VjdIOVY5WiIgZmlsbD0iIzk5OTk5OSIvPgo8cGF0aCBkPSJNMjEgNUgzQzEuOSA1IDEgNS45IDEgN1YxN0MxIDE4LjEgMS45IDE5IDMgMTlIMjFDMjIuMSAxOSAyMyAxOC4xIDIzIDE3VjdDMjMgNS45IDIyLjEgNSAyMSA1Wk0yMSAxN0gzVjlIMjFWMTdaIiBmaWxsPSIjOTk5OTk5Ii8+CjxwYXRoIGQ9Ik0xNi41IDEyTDE0IDkuNUwxMSAxMi41TDkgMTAuNUw3IDE0SDE3TDE2LjUgMTJaIiBmaWxsPSIjOTk5OTk5Ii8+Cjwvc3ZnPgo=";
                                                            }}
                                                        />
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">
                                                No receipt
                                            </span>
                                        )}
                                    </TableCell>

                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            {editingId === record.id ? (
                                                <>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 hover:bg-success hover:text-success-foreground"
                                                        onClick={saveEdit}
                                                    >
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 hover:bg-muted"
                                                        onClick={cancelEdit}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    {onUpdateRecord && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 hover:bg-primary hover:text-primary-foreground"
                                                            onClick={() => startEditing(record)}
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>
                                                                    Remove Record
                                                                </AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Are you sure you want to remove this refuel
                                                                    record? This action cannot be undone.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction
                                                                    onClick={() => onRemoveRecord(record.id)}
                                                                    className="bg-destructive hover:bg-destructive/90"
                                                                >
                                                                    Remove
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="bg-muted/30 font-medium">
                                <TableCell colSpan={4}>Total</TableCell>
                                <TableCell className="text-right">
                                    ${totalAmount.toFixed(2)}
                                </TableCell>
                                <TableCell colSpan={5}></TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};
