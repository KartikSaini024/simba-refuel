import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { RefuelRecord } from '@/types/refuel';
import { supabase } from '@/integrations/supabase/client';
import simbaLogo from '@/assets/simba-logo-hd.png';

interface GenerateRefuelPDFParams {
  records: RefuelRecord[];
  branchName?: string;
  checkedBy: string;
  reportDate?: Date | string;
  signatureData?: string;
  saveOnly?: boolean; // If true, saves the file. If false, returns data URI.
}

// Convert image to base64
const getImageAsBase64 = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL('image/png');
          resolve(dataURL);
      } else {
        reject(new Error("Could not get canvas context"));
      }
    };
    img.onerror = reject;
    img.src = url;
  });
};

export const generateRefuelPDF = async ({
  records,
  branchName,
  checkedBy,
  reportDate,
  signatureData,
  saveOnly = true
}: GenerateRefuelPDFParams): Promise<{ fileName: string; pdfData: string }> => {
  const reportDateObj = reportDate ? new Date(reportDate) : new Date();
  const generatedDateObj = new Date(); // Always now

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
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`Report Date: ${format(reportDateObj, 'EEEE, MMMM d, yyyy')}`, pageWidth / 2, 58, { align: "center" });
  doc.text(`Generated: ${format(generatedDateObj, 'h:mm a')}`, pageWidth / 2, 65, { align: "center" });

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

          // Fetch the image and convert to Base64 to embed in PDF
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
    record.addedToRCM ? "Yes" : "No",
    `$${record.amount.toFixed(2)}`,
    record.refuelledBy,
    format(new Date(record.createdAt), "HH:mm"),
    record.receiptImage ? "Yes" : "No"
  ]);

  const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
  const rcmCount = records.filter(r => r.addedToRCM).length;

  autoTable(doc, {
    startY: 80,
    head: [['#', 'Reservation', 'Rego', 'RCM', 'Amount', 'Refuelled By', 'Time', 'Receipt']],
    body: tableData,
    foot: [['', '', 'TOTAL:', `${rcmCount} in RCM`, `$${totalAmount.toFixed(2)}`, `${records.length} records`, '', '']],
    theme: 'grid',
    headStyles: {
      fillColor: [33, 82, 135],
      textColor: 255,
      halign: 'center',
      valign: 'middle',
      fontStyle: 'bold',
      fontSize: 11,
      lineWidth: 0.5,
      lineColor: [180, 180, 180],
    },
    bodyStyles: {
      fontSize: 10,
      valign: 'middle',
      halign: 'center',
      textColor: [51, 51, 51],
      lineWidth: 0.3,
      lineColor: [220, 220, 220],
      minCellHeight: 10,
    },
    footStyles: {
      fillColor: [245, 247, 250],
      fontStyle: 'bold',
      halign: 'center',
      textColor: [33, 82, 135],
      fontSize: 10,
    },
    alternateRowStyles: {
      fillColor: [235, 240, 250],
    },
    margin: { left: 15, right: 15 },
    tableLineWidth: 0.5,
    tableLineColor: [180, 180, 180],
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
  doc.text(`Date: ${format(reportDateObj, 'dd/MM/yyyy')}`, 25, signatureY + 18);
  doc.text(`Time: ${format(generatedDateObj, 'HH:mm')}`, 25, signatureY + 26);

  // Signature
  if (signatureData) {
     try {
       // If empty or invalid, might fail
       if (signatureData.length > 100) {
          doc.addImage(signatureData, 'PNG', 120, signatureY - 10, 60, 20);
       } else {
         throw new Error("Invalid signature data");
       }
     } catch {
       doc.line(120, signatureY + 20, 180, signatureY + 20);
       doc.text("Signature", 145, signatureY + 25);
     }
  } else {
    doc.line(120, signatureY + 20, 180, signatureY + 20);
    doc.text("Signature", 145, signatureY + 25);
  }

  // Footer with page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(102, 102, 102);
    doc.text("This report was automatically generated by Simba Car Hire Refuel Management System",
      pageWidth / 2, pageHeight - 15, { align: "center" });
    doc.text(
      `Page ${i} of ${pageCount} • Generated on ${format(generatedDateObj, 'dd/MM/yyyy')} at ${format(generatedDateObj, 'HH:mm')}`,
      pageWidth / 2, pageHeight - 8, { align: "center" }
    );
  }

  const fileName = `Simba-Car-Hire-Refuel-Report-${branchName?.replace(/\s+/g, '-') || 'Branch'}-${format(reportDateObj, 'yyyy-MM-dd-HHmm')}.pdf`;
  if (saveOnly) {
    doc.save(fileName);
  }
  return { fileName, pdfData: doc.output('datauristring') };
};
