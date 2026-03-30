import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
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
  Info, Loader2, FileUp, Shield,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface UploadResult {
  success?: boolean;
  totalRecords: number;
  created?: number;
  updated?: number;
  skipped?: number;
  successful?: number;
  failed: number;
  errors: { row: number; message: string }[];
}

const getSuccessfulCount = (data: UploadResult) => data.successful ?? ((data.created ?? 0) + (data.updated ?? 0) + (data.skipped ?? 0));

export default function BulkEmployeeUploadPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const handleDownloadTemplate = () => {
    const headers = ['emp_id_number', 'emp_name', 'emp_mobile_number', 'emp_email', 'latitude', 'longitude', 'location_name'];
    const sampleData = [
      { emp_id_number: 'EMP001', emp_name: 'John Silva', emp_mobile_number: '0771234567', emp_email: 'john@email.com', latitude: 6.9271, longitude: 79.8612, location_name: 'Colombo Fort' },
      { emp_id_number: 'EMP002', emp_name: 'Nimal Perera', emp_mobile_number: '0719876543', emp_email: 'nimal@email.com', latitude: '', longitude: '', location_name: '' },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });
    ws['!cols'] = [
      { wch: 16 }, { wch: 20 }, { wch: 18 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 18 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, 'employee_upload_template.xlsx');
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

  /** Extract the best error message from any response shape */
  const extractErrorInfo = (responseData: any): { errors: { row: number; message: string }[]; message: string | null } => {
    // Try nested data.errors[], top-level errors[], data.message, message
    const nestedData = responseData?.data;
    const errors: { row: number; message: string }[] =
      (Array.isArray(nestedData?.errors) && nestedData.errors.length > 0 ? nestedData.errors : null) ||
      (Array.isArray(responseData?.errors) && responseData.errors.length > 0 ? responseData.errors : null) ||
      [];
    const message =
      errors[0]?.message ||
      nestedData?.message ||
      responseData?.message ||
      responseData?.error ||
      null;
    return { errors, message };
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/employees/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 10 * 60 * 1000,
      });

      // Unwrap: TransformInterceptor may wrap as { success, data } or pass through { success, ... }
      const raw = res.data;
      const data: UploadResult = raw?.data?.totalRecords !== undefined ? raw.data : raw;
      const successful = getSuccessfulCount(data);
      setResult(data);
      console.log('Bulk upload response:', JSON.stringify(raw));

      if (data.success === false || data.failed > 0) {
        const firstErr = data.errors?.[0]?.message;
        toast({
          title: firstErr || t('common.operationFailed'),
          description: `${successful} ${t('bulkUpload.successfullyAdded')}, ${data.failed} ${t('bulkUpload.failedRecords')}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: t('bulkUpload.uploadComplete'),
          description: `${successful} ${t('bulkUpload.successfullyAdded')}`,
        });
      }
    } catch (err: any) {
      const responseData = err.response?.data;
      const statusCode = err.response?.status;
      console.error('Bulk upload error:', JSON.stringify({ status: statusCode, data: responseData, message: err.message }));

      const { errors: rowErrors, message: serverMsg } = extractErrorInfo(responseData);

      if (rowErrors.length > 0 || responseData?.totalRecords !== undefined || responseData?.data?.totalRecords !== undefined) {
        const src = responseData?.data ?? responseData;
        setResult({
          success: false,
          totalRecords: src?.totalRecords ?? 0,
          created: src?.created ?? 0,
          updated: src?.updated ?? 0,
          skipped: src?.skipped ?? 0,
          failed: src?.failed ?? rowErrors.length,
          errors: rowErrors,
        });
      }

      const msg = serverMsg
        ? `${serverMsg}${statusCode ? ` (${statusCode})` : ''}`
        : (err.code === 'ECONNABORTED' ? 'Upload timed out — try a smaller file' : `${t('common.operationFailed')}${statusCode ? ` (${statusCode})` : ''}`);

      toast({
        title: msg,
        description: rowErrors[0] ? `Row ${rowErrors[0].row}: ${rowErrors[0].message}` : undefined,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const successfulCount = result ? getSuccessfulCount(result) : 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('bulkUpload.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('bulkUpload.subtitle')}</p>
      </div>

      <Alert className="border-primary/20 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          {t('bulkUpload.infoMessage')}
          <br />
          <span className="font-medium text-foreground mt-1 inline-block">
            {t('bulkUpload.defaultPasswordNote')}
          </span>
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Download size={16} className="text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{t('bulkUpload.step1Title')}</CardTitle>
                <CardDescription className="text-xs">{t('bulkUpload.step1Desc')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="rounded-lg border border-dashed p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground font-medium mb-2">{t('bulkUpload.requiredColumns')}:</p>
                <div className="flex flex-wrap gap-1.5">
                  {['emp_id_number', 'emp_name', 'emp_mobile_number', 'emp_email'].map(c => (
                    <Badge key={c} variant="default" className="text-[10px] font-mono">{c}</Badge>
                  ))}
                  {['latitude', 'longitude', 'location_name'].map(c => (
                    <Badge key={c} variant="secondary" className="text-[10px] font-mono">{c} <span className="ml-1 opacity-60">({t('bulkUpload.optional')})</span></Badge>
                  ))}
                </div>
              </div>
              <Button onClick={handleDownloadTemplate} className="w-full" variant="outline">
                <FileSpreadsheet size={16} className="mr-2" />
                {t('bulkUpload.downloadTemplate')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Upload size={16} className="text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{t('bulkUpload.step2Title')}</CardTitle>
                <CardDescription className="text-xs">{t('bulkUpload.step2Desc')}</CardDescription>
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
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield size={12} />
                <span>{t('bulkUpload.maxRows')}</span>
              </div>

              <Button onClick={handleUpload} className="w-full" disabled={!file || uploading}>
                {uploading ? (
                  <><Loader2 size={16} className="mr-2 animate-spin" />{t('bulkUpload.uploading')}</>
                ) : (
                  <><Upload size={16} className="mr-2" />{t('bulkUpload.uploadButton')}</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {result.failed === 0 ? (
                <CheckCircle2 size={18} className="text-green-500" />
              ) : (
                <AlertTriangle size={18} className="text-amber-500" />
              )}
              {t('bulkUpload.resultsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{result.totalRecords}</p>
                <p className="text-xs text-muted-foreground">{t('bulkUpload.totalRecords')}</p>
              </div>
              <div className="rounded-lg bg-green-500/10 p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{successfulCount}</p>
                <p className="text-xs text-muted-foreground">{t('bulkUpload.successfullyAdded')}</p>
              </div>
              <div className="rounded-lg bg-destructive/10 p-3 text-center">
                <p className="text-2xl font-bold text-destructive">{result.failed}</p>
                <p className="text-xs text-muted-foreground">{t('bulkUpload.failedRecords')}</p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t('bulkUpload.successRate')}</span>
                <span>{result.totalRecords > 0 ? Math.round((successfulCount / result.totalRecords) * 100) : 0}%</span>
              </div>
              <Progress value={result.totalRecords > 0 ? (successfulCount / result.totalRecords) * 100 : 0} className="h-2" />
            </div>

            {successfulCount > 0 && (
              <Alert className="border-green-500/30 bg-green-500/5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-sm">
                  {t('bulkUpload.successMessage')}
                </AlertDescription>
              </Alert>
            )}

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
