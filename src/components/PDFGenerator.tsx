import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, PenTool, RotateCcw } from 'lucide-react';
import { RefuelRecord, Staff } from '@/types/refuel';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import simbaLogo from '@/assets/simba-logo-hd.png';

interface PDFGeneratorProps {
  records: RefuelRecord[];
  staff: Staff[];
  branchName?: string;
  branchId?: string;
}

export const PDFGenerator = ({ records, staff, branchName }: PDFGeneratorProps) => {
  const [checkedBy, setCheckedBy] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Signature canvas functions
  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }, []);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  }, [isDrawing]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getSignatureAsBase64 = (): string => {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    return canvas.toDataURL('image/png');
  };

  // Convert image to base64
  const getImageAsBase64 = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/png');
        resolve(dataURL);
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const generatePDF = async (saveOnly = true) => {
    if (!checkedBy) return;
    setIsGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;

      // Logo
      try {
        const logoBase64 = await getImageAsBase64(simbaLogo);
        const logoWidth = 50;
        const logoHeight = 20;
        doc.addImage(logoBase64, 'PNG', (pageWidth - logoWidth) / 2, 10, logoWidth, logoHeight);
      } catch {
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("SIMBA CAR HIRE", pageWidth / 2, 25, { align: "center" });
      }

      // Title & Branch Info
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("REFUEL LIST REPORT", pageWidth / 2, 40, { align: "center" });
      doc.setFontSize(12);
      doc.setTextColor(33, 82, 135);
      doc.text(`Branch: ${branchName || 'Unknown Branch'}`, pageWidth / 2, 50, { align: "center" });

      // Date/Time
      const currentDate = new Date();
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Report Date: ${format(currentDate, 'EEEE, MMMM d, yyyy')}`, pageWidth / 2, 58, { align: "center" });
      doc.text(`Generated: ${format(currentDate, 'h:mm a')}`, pageWidth / 2, 65, { align: "center" });

      // Separator
      doc.setDrawColor(33, 82, 135);
      doc.line(20, 72, pageWidth - 20, 72);

      // Process receipts
      const processedRecords = await Promise.all(
        records.map(async (record) => {
          let receiptImage = null;
          if (record.receiptPhotoUrl) {
            try {
              let publicUrl: string;
              if (record.receiptPhotoUrl.startsWith("http")) {
                // Already a full URL
                publicUrl = record.receiptPhotoUrl;
              } else {
                // It's a key/path
                const { data } = supabase
                  .storage
                  .from("refuel-receipts")
                  .getPublicUrl(record.receiptPhotoUrl);
                publicUrl = data.publicUrl;
              }

              console.log("Receipt URL used:", publicUrl);

              const response = await fetch(publicUrl);
              const blob = await response.blob();
              const reader = new FileReader();

              await new Promise((resolve) => {
                reader.onload = () => {
                  receiptImage = reader.result;
                  resolve(null);
                };
                reader.readAsDataURL(blob);
              });
            } catch (err) {
              console.error("Error loading receipt image:", err);
            }
          }
          return { ...record, receiptImage };
        })
      );

      // Table
      const tableData = processedRecords.map((record, index) => [
        (index + 1).toString(),
        record.reservationNumber,
        record.rego,
        record.addedToRCM ? "✓ Yes" : "✗ No",
        `$${record.amount.toFixed(2)}`,
        record.refuelledBy,
        format(record.createdAt, "HH:mm"),
        record.receiptImage ? "📷" : ""
      ]);

      const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
      const rcmCount = records.filter(r => r.addedToRCM).length;

      autoTable(doc, {
        startY: 80,
        head: [['#', 'Reservation', 'Rego', 'RCM', 'Amount', 'Refuelled By', 'Time', 'Receipt']],
        body: tableData,
        foot: [['', '', 'TOTAL:', `${rcmCount} in RCM`, `$${totalAmount.toFixed(2)}`, `${records.length} records`, '', '']],
        theme: 'striped',
        headStyles: { fillColor: [33, 82, 135], textColor: 255, halign: 'center' },
        bodyStyles: { fontSize: 9, valign: 'middle', textColor: [51, 51, 51] },
        footStyles: { fillColor: [245, 247, 250], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 251, 253] },
        margin: { left: 15, right: 15 },
      });

      let currentY = (doc as any).lastAutoTable.finalY + 15;

      // Receipt Images
      for (const [index, record] of processedRecords.entries()) {
        if (record.receiptImage) {
          if (currentY > pageHeight - 100) {
            doc.addPage();
            currentY = 20;
          }
          doc.setFontSize(10);
          doc.text(`Receipt #${index + 1} - ${record.rego}`, 20, currentY);

          try {
            const base64Img = record.receiptImage as string;
            const isPng = base64Img.startsWith("data:image/png");
            const format = isPng ? "PNG" : "JPEG";

            const maxWidth = 120;
            const maxHeight = 80;

            const img = new Image();
            img.src = base64Img;
            await new Promise((resolve) => {
              img.onload = () => {
                const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
                const displayWidth = img.width * ratio;
                const displayHeight = img.height * ratio;
                doc.addImage(base64Img, format, 20, currentY + 5, displayWidth, displayHeight);
                currentY += displayHeight + 20;
                resolve(null);
              };
            });
          } catch (err) {
            console.error("Error adding receipt image:", err);
            doc.setFontSize(8);
            doc.text("Error loading receipt image", 20, currentY + 10);
            currentY += 20;
          }
        }
      }

      // Summary Box
      const summaryY = currentY + 10;
      doc.setFillColor(240, 245, 250);
      doc.setDrawColor(180, 180, 180);
      doc.rect(20, summaryY, pageWidth - 40, 25, 'F');
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 82, 135);
      doc.text("REPORT SUMMARY", 25, summaryY + 8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 51, 51);
      doc.text(`Total Records: ${records.length}`, 25, summaryY + 18);
      doc.text(`Total Fuel Cost: $${totalAmount.toFixed(2)}`, 100, summaryY + 18);
      doc.text(`RCM Entries: ${rcmCount}`, 180, summaryY + 18, { align: "right" });

      // Verification Section
      const signatureY = summaryY + 40;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 51, 51);
      doc.text("Report Verification", 25, signatureY);
      doc.setFont("helvetica", "normal");
      doc.text(`Checked and verified by: ${checkedBy}`, 25, signatureY + 10);
      doc.text(`Date: ${format(currentDate, 'dd/MM/yyyy')}`, 25, signatureY + 18);
      doc.text(`Time: ${format(currentDate, 'HH:mm')}`, 25, signatureY + 26);

      // Signature
      const signatureData = getSignatureAsBase64();
      if (signatureData && signatureData !== 'data:,') {
        try {
          doc.addImage(signatureData, 'PNG', 120, signatureY + 5, 60, 20);
        } catch {
          doc.line(120, signatureY + 20, 180, signatureY + 20);
          doc.text("Signature", 145, signatureY + 25);
        }
      } else {
        doc.line(120, signatureY + 20, 180, signatureY + 20);
        doc.text("Signature", 145, signatureY + 25);
      }

      // Footer with page numbers
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(102, 102, 102);
        doc.text("This report was automatically generated by Simba Car Hire Refuel Management System",
          pageWidth / 2, pageHeight - 15, { align: "center" });
        doc.text(
          `Page ${i} of ${pageCount} • Generated on ${format(currentDate, 'dd/MM/yyyy')} at ${format(currentDate, 'HH:mm')}`,
          pageWidth / 2, pageHeight - 8, { align: "center" }
        );
      }

      const fileName = `Simba-Car-Hire-Refuel-Report-${branchName?.replace(/\s+/g, '-') || 'Branch'}-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
      if (saveOnly) {
        doc.save(fileName);
      }
      return { fileName, pdfData: doc.output('datauristring') };

    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({ title: "PDF Generation Error", description: "There was an issue generating the PDF.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = records.length > 0 && checkedBy;

  return (
    <Card className="shadow-md border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Download className="h-5 w-5" />
          Generate PDF Report
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="checkedBy">Checked By (Required)</Label>
          <Select value={checkedBy} onValueChange={setCheckedBy}>
            <SelectTrigger>
              <SelectValue placeholder="Select who checked the list" />
            </SelectTrigger>
            <SelectContent className="bg-card">
              {staff.map((member) => (
                <SelectItem key={member.id} value={member.name}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Signature Canvas */}
        <div className="space-y-2">
          <Label>Digital Signature (Optional)</Label>
          <div className="border rounded-lg p-4 bg-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PenTool className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Sign here</span>
              </div>
              <Button variant="outline" size="sm" onClick={clearSignature} className="text-xs">
                <RotateCcw className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
            <canvas
              ref={canvasRef}
              width={300}
              height={80}
              className="border border-border rounded bg-white cursor-crosshair w-full"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              style={{ touchAction: 'none' }}
            />
            <p className="text-xs text-muted-foreground">Draw your signature above. It will be included in the PDF report.</p>
          </div>
        </div>

        <Button onClick={() => generatePDF(true)} disabled={!canGenerate || isGenerating} className="w-full bg-gradient-primary hover:bg-primary-hover">
          {isGenerating ? "Generating PDF..." : (<><Download className="mr-2 h-4 w-4" />Generate PDF Report</>)}
        </Button>

        {!canGenerate && (
          <p className="text-xs text-muted-foreground text-center">
            {records.length === 0 ? "Add some refuel records first" : "Select who checked the list to generate PDF"}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
