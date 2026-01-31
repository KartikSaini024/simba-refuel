import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, PenTool, RotateCcw } from 'lucide-react';
import { RefuelRecord, Staff } from '@/types/refuel';
import { useToast } from '@/hooks/use-toast';
import { generateRefuelPDF } from '@/utils/generateRefuelPDF';

interface PDFGeneratorProps {
  records: RefuelRecord[];
  staff: Staff[];
  branchName?: string;
  branchId?: string;
  reportDate?: Date | string; // New prop for report date
}

export const PDFGenerator = ({ records, staff, branchName, reportDate }: PDFGeneratorProps) => {
  const [checkedBy, setCheckedBy] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();


  // Signature canvas functions (mouse + touch)
  const getPointerPos = (e: React.MouseEvent<HTMLCanvasElement> | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else if ('clientX' in e) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    ctx.beginPath();
    const { x, y } = getPointerPos(e);
    ctx.moveTo(x, y);
  }, []);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let x = 0, y = 0;
    if ('touches' in e && e.touches.length > 0) {
      e.preventDefault();
      ({ x, y } = getPointerPos(e));
    } else if ('clientX' in e) {
      ({ x, y } = getPointerPos(e));
    }
    ctx.lineTo(x, y);
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

  const handleGeneratePDF = async () => {
    if (!checkedBy) return;
    setIsGenerating(true);

    try {
      const signatureData = getSignatureAsBase64();

      await generateRefuelPDF({
        records,
        branchName,
        checkedBy,
        reportDate,
        signatureData: signatureData !== 'data:,' ? signatureData : undefined,
        saveOnly: true
      });

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
              onTouchStart={e => startDrawing(e.nativeEvent)}
              onTouchMove={e => draw(e.nativeEvent)}
              onTouchEnd={stopDrawing}
              style={{ touchAction: 'none' }}
            />
            <p className="text-xs text-muted-foreground">Draw your signature above. It will be included in the PDF report.</p>
          </div>
        </div>

        <Button onClick={handleGeneratePDF} disabled={!canGenerate || isGenerating} className="w-full bg-gradient-primary hover:bg-primary-hover">
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

