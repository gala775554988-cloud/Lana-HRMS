import React from 'react';
import { createRoot } from 'react-dom/client';
import { OdooRequestsWorkspace } from '../../components/enterprise/odoo-requests-workspace';
createRoot(document.getElementById('root')!).render(<div style={{padding:16,maxWidth:1400,margin:'auto'}}><OdooRequestsWorkspace employeeMode={location.search.includes('employee=1')}/></div>);
