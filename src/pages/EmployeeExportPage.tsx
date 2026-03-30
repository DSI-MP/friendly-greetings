import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Download, FileSpreadsheet, Search, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import type { Department } from '@/types/entities';

interface ApiResponse<T> { success?: boolean; data: T; }

export default function EmployeeExportPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [deptLoading, setDeptLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get<ApiResponse<any>>('/departments?limit=500')
      .then((r) => {
        const d = r.data?.data ?? r.data;
        const items = Array.isArray(d) ? d : d?.items ?? [];
        setDepartments(items);
      })
      .catch(() => setDepartments([]))
      .finally(() => setDeptLoading(false));
  }, []);

  const filteredDepts = departments.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.code?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleDept = (id: number) => {
    setSelectedDepts(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedDepts.length === filteredDepts.length) {
      setSelectedDepts([]);
    } else {
      setSelectedDepts(filteredDepts.map(d => d.id));
    }
  };

  const handleExport = async () => {
    if (selectedDepts.length === 0) {
      toast({ title: t('common.validationError'), description: t('employeeExport.selectAtLeastOne'), variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const response = await api.get('/employees/export/excel', {
        params: { departmentIds: selectedDepts.join(',') },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `employees_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: t('employeeExport.exportSuccess'), description: t('employeeExport.exportSuccessDesc', { count: selectedDepts.length }) });
    } catch {
      toast({ title: t('common.error'), description: t('employeeExport.exportFailed'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
          {t('employeeExport.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t('employeeExport.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" />
            {t('employeeExport.selectDepartments')}
          </CardTitle>
          <CardDescription>{t('employeeExport.selectDepartmentsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('departments.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={toggleAll} className="shrink-0">
              {selectedDepts.length === filteredDepts.length && filteredDepts.length > 0 ? t('employeeExport.deselectAll') : t('employeeExport.selectAll')}
            </Button>
          </div>

          {deptLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filteredDepts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t('employeeExport.noDepartments')}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto rounded-lg border border-border p-3">
              {filteredDepts.map((dept) => (
                <label
                  key={dept.id}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                    selectedDepts.includes(dept.id)
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-muted border border-transparent'
                  }`}
                >
                  <Checkbox
                    checked={selectedDepts.includes(dept.id)}
                    onCheckedChange={() => toggleDept(dept.id)}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-foreground truncate">{dept.name}</span>
                    {dept.code && <span className="text-xs text-muted-foreground">{dept.code}</span>}
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground">
              {t('employeeExport.selectedCount', { count: selectedDepts.length })}
            </p>
            <Button
              onClick={handleExport}
              disabled={loading || selectedDepts.length === 0}
              className="gap-2"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {loading ? t('employeeExport.exporting') : t('employeeExport.downloadExcel')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4">
          <p className="text-sm text-foreground/80">
            <strong>{t('employeeExport.includesLabel')}</strong> {t('employeeExport.includesDesc')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
