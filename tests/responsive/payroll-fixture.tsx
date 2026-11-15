// Render the production client components with synthetic API data only.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PayrollReports } from '../../components/payroll/reports';
import { PayrollRunManager } from '../../components/enterprise/payroll-run-manager';
import { CompensationConsole } from '../../components/payroll/compensation-console';
import { PayrollRegister } from '../../components/payroll/register-workspace';
import { PayslipDetail } from '../../components/payroll/payslip-detail';
import { EmployeeFinance } from '../../components/payroll/employee-finance';
import { EmployeeAdvancesClient } from '../../components/employee/EmployeeAdvancesClient';
import PayslipPrintPage from '../../app/print-reports/payslip/page';
import PayrollRegisterPrintPage from '../../app/print-reports/payroll-register/page';
const view = new URLSearchParams(location.search).get('view');
const advance = { id: 'fixture', amount: 10000, monthlyDeduction: 1000, installments: 10, paidInstallments: 2, reason: 'سلفة تجريبية لاختبار العرض على الأجهزة المختلفة', startDate: '2026-11-01', createdAt: '2026-11-01', status: 'APPROVED', managerStatus: 'APPROVED', hrStatus: 'APPROVED', financeStatus: 'PENDING' };
createRoot(document.getElementById('root')!).render(<div style={{ padding: 16, maxWidth: 1280, margin: 'auto' }}>
  {view === 'reports' ? <PayrollReports/> : view === 'process' ? <PayrollRunManager canManage canApprove initialCreate/> : view === 'compensation' ? <CompensationConsole/> : view === 'register' ? <PayrollRegister view="payslips" /> :
    view === 'detail' ? <PayslipDetail selection={{ id: 'fixture', source: 'ODOO' }} onClose={() => {}} /> :
    view === 'advances' ? <EmployeeAdvancesClient initialRecords={[advance]} /> :
    view === 'finance' ? <EmployeeFinance /> :
    view === 'payslip' ? <PayslipPrintPage /> : <PayrollRegisterPrintPage />}
</div>);
