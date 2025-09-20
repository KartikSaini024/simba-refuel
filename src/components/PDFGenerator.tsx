import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileText, PenTool, RotateCcw } from 'lucide-react';
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

const generatePDF = async (saveOnly = true) => {
  if (!checkedBy) return;

  setIsGenerating(true);

  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const currentDate = new Date();

    /* ---------------------- HEADER ---------------------- */
    try {
      const logoBase64 = await getImageAsBase64(simbaLogo);
      const logoWidth = 50;
      const logoHeight = 20;
      const logoY = 10;
      doc.addImage(logoBase64, "PNG", (pageWidth - logoWidth) / 2, logoY, logoWidth, logoHeight);
    } catch {
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 82, 135);
      doc.text("SIMBA CAR HIRE", pageWidth / 2, 20, { align: "center" });
    }

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 51, 51);
    doc.text("REFUEL LIST REPORT", pageWidth / 2, 40, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(33, 82, 135);
    doc.text(`Branch: ${branchName || "Unknown Branch"}`, pageWidth / 2, 50, { align: "center" });

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(102, 102, 102);
    doc.text(`Report Date: ${format(currentDate, "EEEE, MMMM d, yyyy")}`, pageWidth / 2, 60, { align: "center" });
    doc.text(`Generated: ${format(currentDate, "h:mm a")}`, pageWidth / 2, 68, { align: "center" });

    doc.setDrawColor(33, 82, 135);
    doc.setLineWidth(0.5);
    doc.line(20, 75, pageWidth - 20, 75);

    /* ---------------------- RECORDS TABLE ---------------------- */
    const processedRecords = await Promise.all(
      records.map(async (record) => {
        let receiptImage = null;
        if (record.receiptPhotoUrl) {
          try {
            const { data } = supabase.storage.from("refuel-receipts").getPublicUrl(record.receiptPhotoUrl);
            const response = await fetch(data.publicUrl);
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
            console.error("Error loading receipt:", err);
          }
        }
        return { ...record, receiptImage };
      })
    );

    const tableData = processedRecords.map((record, index) => [
      (index + 1).toString(),
      record.reservationNumber,
      record.rego,
      record.addedToRCM ? "✓ Yes" : "✗ No",
      `$${record.amount.toFixed(2)}`,
      record.refuelledBy,
      format(record.createdAt, "HH:mm"),
      record.receiptImage ? "📷" : "",
    ]);

    const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
    const rcmCount = records.filter((r) => r.addedToRCM).length;

    autoTable(doc, {
      startY: 85,
      head: [["#", "Reservation", "Rego", "RCM", "Amount", "Refuelled By", "Time", "Receipt"]],
      body: tableData,
      foot: [["", "", "TOTALS:", `${rcmCount} in RCM`, `$${totalAmount.toFixed(2)}`, `${records.length} records`, "", ""]],
      theme: "striped",
      headStyles: {
        fillColor: [33, 82, 135],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: "bold",
        halign: "center",
        valign: "middle",
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [51, 51, 51],
        valign: "middle",
      },
      footStyles: {
        fillColor: [240, 245, 250],
        textColor: [51, 51, 51],
        fontSize: 10,
        fontStyle: "bold",
        halign: "center",
        valign: "middle",
      },
      alternateRowStyles: {
        fillColor: [250, 251, 253],
      },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 28, halign: "center" },
        2: { cellWidth: 22, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: 22, halign: "right", fontStyle: "bold" },
        5: { cellWidth: 30, halign: "left" },
        6: { cellWidth: 18, halign: "center" },
        7: { cellWidth: 15, halign: "center" },
      },
      margin: { left: 15, right: 15 },
    });

    let currentY = (doc as any).lastAutoTable.finalY + 20;

    /* ---------------------- RECEIPTS ---------------------- */
    for (const [i, record] of processedRecords.entries()) {
      if (record.receiptImage) {
        if (currentY > pageHeight - 90) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Receipt #${i + 1} - ${record.rego}`, 20, currentY);

        try {
          const img = new Image();
          img.src = record.receiptImage as string;
          const maxWidth = 120;
          const maxHeight = 80;
          img.onload = () => {
            const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
            doc.addImage(record.receiptImage, "JPEG", 20, currentY + 5, img.width * ratio, img.height * ratio);
          };
        } catch {
          doc.setFontSize(8);
          doc.text("Error loading receipt image", 20, currentY + 10);
        }

        currentY += 90;
      }
    }

    /* ---------------------- SUMMARY ---------------------- */
    const summaryY = currentY + 10;
    doc.setFillColor(240, 245, 250);
    doc.setDrawColor(180, 180, 180);
    doc.rect(20, summaryY, pageWidth - 40, 25, "F");
    doc.rect(20, summaryY, pageWidth - 40, 25);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(33, 82, 135);
    doc.text("REPORT SUMMARY", 25, summaryY + 8);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 51, 51);
    doc.text(`Total Records: ${records.length}`, 25, summaryY + 15);
    doc.text(`Total Fuel Cost: $${totalAmount.toFixed(2)}`, 90, summaryY + 15);
    doc.text(`RCM Entries: ${rcmCount}`, 160, summaryY + 15);

    /* ---------------------- VERIFICATION ---------------------- */
    const signatureY = summaryY + 40;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 51, 51);
    doc.text("Report Verification:", 25, signatureY);

    doc.setFont("helvetica", "normal");
    doc.text(`Checked and verified by: ${checkedBy}`, 25, signatureY + 8);
    doc.text(`Date: ${format(currentDate, "dd/MM/yyyy")}`, 25, signatureY + 16);
    doc.text(`Time: ${format(currentDate, "HH:mm")}`, 25, signatureY + 24);

    const signatureData = getSignatureAsBase64();
    if (signatureData && signatureData !== "data:,") {
      try {
        doc.addImage(signatureData, "PNG", 120, signatureY + 5, 60, 20);
      } catch {
        doc.line(120, signatureY + 20, 180, signatureY + 20);
        doc.setFontSize(8);
        doc.text("Signature", 145, signatureY + 25);
      }
    } else {
      doc.line(120, signatureY + 20, 180, signatureY + 20);
      doc.setFontSize(8);
      doc.text("Signature", 145, signatureY + 25);
    }

    /* ---------------------- FOOTER ---------------------- */
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(102, 102, 102);
      doc.text(
        "This report was automatically generated by Simba Car Hire Refuel Management System",
        pageWidth / 2,
        pageHeight - 15,
        { align: "center" }
      );
      doc.text(
        `Page ${i} of ${pageCount} • Generated on ${format(currentDate, "dd/MM/yyyy")} at ${format(currentDate, "HH:mm")}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: "center" }
      );
    }

    /* ---------------------- SAVE ---------------------- */
    const fileName = `Simba-Car-Hire-Refuel-Report-${branchName?.replace(/\s+/g, "-") || "Branch"}-${format(
      new Date(),
      "yyyy-MM-dd-HHmm"
    )}.pdf`;

    if (saveOnly) doc.save(fileName);

    return { fileName, pdfData: doc.output("datauristring") };
  } catch (error) {
    console.error("Error generating PDF:", error);
    toast({
      title: "PDF Generation Error",
      description: "There was an issue generating the PDF. Please try again.",
      variant: "destructive",
    });
  } finally {
    setIsGenerating(false);
  }
};
