import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileText, PenTool, RotateCcw } from 'lucide-react';
import { RefuelRecord, Staff } from '@/types/refuel';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '@/hooks/use-toast';
import simbaLogo from '@/assets/simba-logo-hd.png';

interface PDFGeneratorProps {
  records: RefuelRecord[];
  staff: Staff[];
  receiptImages?: string[];
}

export const PDFGenerator = ({ records, staff, receiptImages = [] }: PDFGeneratorProps) => {
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

  // Function to convert image to base64
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

  const generatePDF = async () => {
    if (!checkedBy) return;
    
    setIsGenerating(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      // Load and add company logo
      try {
        const logoBase64 = await getImageAsBase64(simbaLogo);
        const logoWidth = 40;
        const logoHeight = 15;
        const logoX = (pageWidth - logoWidth) / 2;
        doc.addImage(logoBase64, 'PNG', logoX, 15, logoWidth, logoHeight);
      } catch (logoError) {
        console.warn('Logo loading failed:', logoError);
        // Fallback to text if logo fails to load
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(33, 82, 135);
        doc.text("SIMBA CAR HIRE", pageWidth / 2, 25, { align: "center" });
      }
      
      // Add title with professional styling
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 51, 51);
      doc.text("REFUEL LIST REPORT", pageWidth / 2, 45, { align: "center" });
      
      // Add date and time with better formatting
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(102, 102, 102);
      const currentDate = new Date();
      doc.text(`Report Date: ${format(currentDate, 'EEEE, MMMM d, yyyy')}`, pageWidth / 2, 55, { align: "center" });
      doc.text(`Generated: ${format(currentDate, 'h:mm a')}`, pageWidth / 2, 62, { align: "center" });
      
      // Add separator line
      doc.setDrawColor(33, 82, 135);
      doc.setLineWidth(0.5);
      doc.line(20, 68, pageWidth - 20, 68);
      
      // Prepare table data with better formatting
      const tableData = records.map((record, index) => [
        (index + 1).toString(),
        record.reservationNumber,
        record.rego,
        record.addedToRCM ? "Yes" : "No",
        `$${record.amount.toFixed(2)}`,
        record.refuelledBy,
        format(record.createdAt, 'HH:mm')
      ]);
      
      // Add summary row
      const totalAmount = records.reduce((sum, record) => sum + record.amount, 0);
      const rcmCount = records.filter(r => r.addedToRCM).length;
      
      // Generate professional table
      autoTable(doc, {
        startY: 75,
        head: [['#', 'Reservation', 'Registration', 'RCM Status', 'Amount', 'Refuelled By', 'Time']],
        body: tableData,
        foot: [['', '', 'TOTALS:', `${rcmCount} in RCM`, `$${totalAmount.toFixed(2)}`, `${records.length} records`, '']],
        theme: 'striped',
        headStyles: {
          fillColor: [33, 82, 135],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          cellPadding: { top: 8, right: 5, bottom: 8, left: 5 }
        },
        bodyStyles: {
          fontSize: 9,
          cellPadding: { top: 6, right: 5, bottom: 6, left: 5 },
          valign: 'middle',
          textColor: [51, 51, 51]
        },
        footStyles: {
          fillColor: [245, 247, 250],
          textColor: [51, 51, 51],
          fontSize: 10,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          cellPadding: { top: 8, right: 5, bottom: 8, left: 5 }
        },
        alternateRowStyles: {
          fillColor: [250, 251, 253]
        },
        columnStyles: {
          0: { cellWidth: 15, halign: 'center' }, // #
          1: { cellWidth: 30, halign: 'center' }, // Reservation
          2: { cellWidth: 25, halign: 'center', fontStyle: 'bold' }, // Registration
          3: { cellWidth: 25, halign: 'center' }, // RCM Status
          4: { cellWidth: 25, halign: 'right', fontStyle: 'bold' }, // Amount
          5: { cellWidth: 35, halign: 'left' }, // Refuelled By
          6: { cellWidth: 20, halign: 'center' } // Time
        },
        margin: { left: 15, right: 15 },
        styles: {
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
        }
      });
      
      // Get final Y position after table
      const finalY = (doc as any).lastAutoTable.finalY || 150;
      
      // Add summary box
      const summaryY = finalY + 15;
      doc.setFillColor(245, 247, 250);
      doc.rect(20, summaryY, pageWidth - 40, 25, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(20, summaryY, pageWidth - 40, 25);
      
      // Summary text
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 82, 135);
      doc.text("REPORT SUMMARY", 25, summaryY + 8);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 51, 51);
      doc.text(`Total Records: ${records.length}`, 25, summaryY + 15);
      doc.text(`Total Fuel Cost: $${totalAmount.toFixed(2)}`, 80, summaryY + 15);
      doc.text(`RCM Entries: ${rcmCount}`, 140, summaryY + 15);
      
      // Add signature section
      const signatureY = summaryY + 35;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 51, 51);
      doc.text("Report Verification:", 25, signatureY);
      
      doc.setFont("helvetica", "normal");
      doc.text(`Checked and verified by: ${checkedBy}`, 25, signatureY + 8);
      doc.text(`Date: ${format(currentDate, 'dd/MM/yyyy')}`, 25, signatureY + 16);
      doc.text(`Time: ${format(currentDate, 'HH:mm')}`, 25, signatureY + 24);
      
      // Add signature if available
      const signatureData = getSignatureAsBase64();
      if (signatureData && signatureData !== 'data:,') {
        try {
          doc.addImage(signatureData, 'PNG', 120, signatureY + 8, 60, 20);
        } catch (error) {
          console.warn('Signature could not be added:', error);
          // Fallback to signature line
          doc.setDrawColor(150, 150, 150);
          doc.line(120, signatureY + 20, 180, signatureY + 20);
          doc.setFontSize(8);
          doc.setTextColor(102, 102, 102);
          doc.text("Signature", 145, signatureY + 25);
        }
      } else {
        // Add signature line
        doc.setDrawColor(150, 150, 150);
        doc.line(120, signatureY + 20, 180, signatureY + 20);
        doc.setFontSize(8);
        doc.setTextColor(102, 102, 102);
        doc.text("Signature", 145, signatureY + 25);
      }
      
      // Add receipt images if present (fit 2 per row) with pagination
      if (receiptImages.length > 0) {
        const marginLeft = 20;
        const marginRight = 20;
        const marginTop = 20;
        const marginBottom = 20;
        const footerReserve = 20;

        const renderSectionHeader = () => {
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(51, 51, 51);
          doc.text("Receipt Images", marginLeft, y);
          y += 6;
        };

        const imageWidth = (pageWidth - (marginLeft + marginRight) - 20) / 2; // 20px gap
        const imageHeight = 50;
        const gap = 20;
        let x = marginLeft;
        let y = signatureY + 40;

        const ensureSpace = (needsHeader: boolean) => {
          const required = (needsHeader ? 6 : 0) + imageHeight;
          if (y + required > pageHeight - (marginBottom + footerReserve)) {
            doc.addPage();
            x = marginLeft;
            y = marginTop;
            if (needsHeader) renderSectionHeader();
          }
        };

        // If initial position doesn't have space for header + first image, paginate
        ensureSpace(true);
        renderSectionHeader();

        receiptImages.forEach((img, idx) => {
          ensureSpace(false);
          const formatGuess = img.startsWith('data:image/png') ? 'PNG' : 'JPEG';
          try {
            doc.addImage(img, formatGuess as any, x, y, imageWidth, imageHeight, undefined, 'FAST');
          } catch {
            try { doc.addImage(img, 'PNG', x, y, imageWidth, imageHeight, undefined, 'FAST'); } catch {}
          }
          x += imageWidth + gap;
          if ((idx + 1) % 2 === 0) {
            x = marginLeft;
            y += imageHeight + 10;
          }
        });
      }

      // Add footer
      doc.setFontSize(8);
      doc.setTextColor(102, 102, 102);
      doc.text("This report was automatically generated by Simba Car Hire Refuel Management System", 
        pageWidth / 2, pageHeight - 15, { align: "center" });
      doc.text(`Generated on ${format(currentDate, 'dd/MM/yyyy')} at ${format(currentDate, 'HH:mm')}`, 
        pageWidth / 2, pageHeight - 10, { align: "center" });
      
      // Save the PDF with better filename
      const fileName = `Simba-Car-Hire-Refuel-Report-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "PDF Generation Error",
        description: "There was an issue generating the PDF. Please try again.",
        variant: "destructive",
      });
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

        <div className="flex items-center gap-4 p-4 bg-gradient-subtle rounded-lg border border-primary/10">
          <FileText className="h-6 w-6 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium text-primary">Professional PDF Report</p>
            <p className="text-xs text-muted-foreground mb-2">
              {records.length} records • Total: ${records.reduce((sum, record) => sum + record.amount, 0).toFixed(2)}
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Company Logo</span>
              <span className="text-xs bg-success/10 text-success px-2 py-1 rounded">Professional Table</span>
              <span className="text-xs bg-accent/10 text-accent px-2 py-1 rounded">Digital Signature</span>
            </div>
          </div>
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
              <Button
                variant="outline"
                size="sm"
                onClick={clearSignature}
                className="text-xs"
              >
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
            <p className="text-xs text-muted-foreground">
              Draw your signature above. It will be included in the PDF report.
            </p>
          </div>
        </div>

        <Button
          onClick={generatePDF}
          disabled={!canGenerate || isGenerating}
          className="w-full bg-gradient-primary hover:bg-primary-hover"
        >
          {isGenerating ? (
            "Generating PDF..."
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Generate PDF Report
            </>
          )}
        </Button>

        {!canGenerate && (
          <p className="text-xs text-muted-foreground text-center">
            {records.length === 0 
              ? "Add some refuel records first" 
              : "Select who checked the list to generate PDF"}
          </p>
        )}
      </CardContent>
    </Card>
  );
};