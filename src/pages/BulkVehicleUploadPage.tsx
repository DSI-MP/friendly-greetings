import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import api from '@/lib/api';
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle,
  Info, Loader2, FileUp, Shield, Truck,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface UploadResult {
  success?: boolean;
  totalRecords: number;
  created?: number;
  updated?: number;
  skipped?: number;
  failed: number;
  errors: { row: number; message: string }[];
}

const getSuccessCount = (d: UploadResult) => (d.created ?? 0) + (d.updated ?? 0) + (d.skipped ?? 0);

export default function BulkVehicleUploadPage() {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const handleDownloadTemplate = () => {
    const headers = [
      'registration_no', 'type', 'capacity', 'soft_overflow',
      'make', 'model', 'driver_name', 'driver_phone', 'driver_license_no', 'is_active',
    ];
    const sampleData = [
      {
        registration_no: 'WP-AB-1234', type: 'VAN', capacity: 14, soft_overflow: 2,
        make: 'Toyota', model: 'HiAce', driver_name: 'Kamal Silva',
        driver_phone: '0771234567', driver_license_no: 'B1234567', is_active: 'TRUE',
      },
      {
        registration_no: 'WP-CD-5678', type: 'BUS', capacity: 40, soft_overflow: 5,
        make: '', model: '', driver_name: '',
        driver_phone: '', driver_license_no: '', is_active: 'TRUE',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
    ws['!cols'] = [
      { wch: 16 }, { wch: 8 }, { wch: 10 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vehicles');
    XLSX.writeFile(wb, 'vehicle_upload_template.xlsx');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (!validTypes.includes(selected.type) && !selected.name.match(/\.xlsx?$/i)) {
      toast({ title: t('bulkUpload.invalidFormat'), variant: 'destructive' });
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      toast({ title: t('bulkUpload.fileTooLarge'), variant: 'destructive' });
      return;
    }
    setFile(selected);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/vehicles/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 5 * 60 * 1000,
      });
      const raw = res.data;
      const data: UploadResult = raw?.data?.totalRecords !== undefined ? raw.data : raw;
      const successful = getSuccessCount(data);
      setResult(data);
      if (data.failed > 0) {
        toast({
          title: data.errors?.[0]?.message || t('common.operationFailed'),
          description: `${successful} added/updated, ${data.failed} failed`,
          variant: 'destructive',
        });
      } else {
        toast({ title: t('bulkVehicleUpload.uploadComplete'), description: `${successful} vehicles processed` });
      }
    } catch (err: any) {
      const rd = err.response?.data;
      const src = rd?.data ?? rd;
      if (src?.totalRecords !== undefined) {
        setResult({
          success: false, totalRecords: src.totalRecords ?? 0,
          created: src.created ?? 0, updated: src.updated ?? 0, skipped: src.skipped ?? 0,
          failed: src.failed ?? 0, errors: src.errors ?? [],
        });
      }
      toast({
        title: src?.errors?.[0]?.message || src?.message || rd?.message || t('common.operationFailed'),
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const successCount = result ? getSuccessCount(result) : 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Truck className="h-6 w-6 text-primary" />
          {t('bulkVehicleUpload.title')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('bulkVehicleUpload.subtitle')}</p>
      </div>

      <Alert className="border-primary/20 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          {t('bulkVehicleUpload.infoMessage')}
          <br />
          <span className="font-medium text-foreground mt-1 inline-block">
            {t('bulkVehicleUpload.optionalNote')}
          </span>
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Step 1: Download Template */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Download size={16} className="text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{t('bulkUpload.step1Title')}</CardTitle>
                <CardDescription className="text-xs">{t('bulkVehicleUpload.step1Desc')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="rounded-lg border border-dashed p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground font-medium mb-2">{t('bulkUpload.requiredColumns')}:</p>
                <div className="flex flex-wrap gap-1.5">
                  {['registration_no', 'type', 'capacity'].map(c => (
                    <Badge key={c} variant="default" className="text-[10px] font-mono">{c}</Badge>
                  ))}
                  {['soft_overflow', 'make', 'model', 'driver_name', 'driver_phone', 'driver_license_no', 'is_active'].map(c => (
                    <Badge key={c} variant="secondary" className="text-[10px] font-mono">{c} <span className="ml-1 opacity-60">({t('bulkUpload.optional')})</span></Badge>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-dashed p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground font-medium mb-1">{t('bulkVehicleUpload.typeValues')}:</p>
                <div className="flex gap-1.5">
                  <Badge variant="outline" className="text-[10px] font-mono">VAN</Badge>
                  <Badge variant="outline" className="text-[10px] font-mono">BUS</Badge>
                </div>
              </div>
              <Button onClick={handleDownloadTemplate} className="w-full" variant="outline">
                <FileSpreadsheet size={16} className="mr-2" />
                {t('bulkUpload.downloadTemplate')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Upload */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Upload size={16} className="text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{t('bulkUpload.step2Title')}</CardTitle>
                <CardDescription className="text-xs">{t('bulkVehicleUpload.step2Desc')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div
                className="rounded-lg border-2 border-dashed p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <FileUp size={28} className="mx-auto text-muted-foreground mb-2" />
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground">{t('bulkUpload.clickToSelect')}</p>
                    <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls — {t('bulkUpload.maxSize')}</p>
                  </div>
                )}
                <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield size={12} />
                <span>{t('bulkVehicleUpload.maxRows')}</span>
              </div>
              <Button onClick={handleUpload} className="w-full" disabled={!file || uploading}>
                {uploading ? (
                  <><Loader2 size={16} className="mr-2 animate-spin" />{t('bulkUpload.uploading')}</>
                ) : (
                  <><Upload size={16} className="mr-2" />{t('bulkVehicleUpload.uploadButton')}</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {result.failed === 0 ? <CheckCircle2 size={18} className="text-green-500" /> : <AlertTriangle size={18} className="text-amber-500" />}
              {t('bulkUpload.resultsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{result.totalRecords}</p>
                <p className="text-xs text-muted-foreground">{t('bulkUpload.totalRecords')}</p>
              </div>
              <div className="rounded-lg bg-green-500/10 p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{result.created ?? 0}</p>
                <p className="text-xs text-muted-foreground">{t('bulkVehicleUpload.created')}</p>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{result.updated ?? 0}</p>
                <p className="text-xs text-muted-foreground">{t('bulkVehicleUpload.updated')}</p>
              </div>
              <div className="rounded-lg bg-destructive/10 p-3 text-center">
                <p className="text-2xl font-bold text-destructive">{result.failed}</p>
                <p className="text-xs text-muted-foreground">{t('bulkUpload.failedRecords')}</p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t('bulkUpload.successRate')}</span>
                <span>{result.totalRecords > 0 ? Math.round((successCount / result.totalRecords) * 100) : 0}%</span>
              </div>
              <Progress value={result.totalRecords > 0 ? (successCount / result.totalRecords) * 100 : 0} className="h-2" />
            </div>

            {result.errors.length > 0 && (
              <div>
                <Separator className="my-3" />
                <h4 className="text-sm font-semibold text-destructive mb-2 flex items-center gap-1.5">
                  <XCircle size={14} />
                  {t('bulkUpload.errorReport')} ({result.errors.length})
                </h4>
                <div className="rounded-lg border max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('bulkUpload.row')}</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t('bulkUpload.errorMessage')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((err, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 font-mono text-destructive">{err.row}</td>
                          <td className="px-3 py-2 text-foreground">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
