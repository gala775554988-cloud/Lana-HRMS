export const plan = [
  {
    "kind": "index",
    "table": "WorkflowInstance",
    "name": "WorkflowInstance_employeeId_status_createdAt_idx",
    "sql": "CREATE INDEX \"WorkflowInstance_employeeId_status_createdAt_idx\" ON \"WorkflowInstance\"(\"employeeId\", \"status\", \"createdAt\")",
    "migration": "202611050001_self_service_lifecycle"
  },
  {
    "kind": "index",
    "table": "WorkflowInstance",
    "name": "WorkflowInstance_type_entityId_idx",
    "sql": "CREATE INDEX \"WorkflowInstance_type_entityId_idx\" ON \"WorkflowInstance\"(\"type\", \"entityId\")",
    "migration": "202611050001_self_service_lifecycle"
  },
  {
    "kind": "index",
    "table": "WorkflowInstance",
    "name": "WorkflowInstance_pending_revocation_key",
    "sql": "CREATE UNIQUE INDEX \"WorkflowInstance_pending_revocation_key\" ON \"WorkflowInstance\"(\"entityId\") WHERE \"type\" = 'REVOKE' AND \"status\" = 'PENDING'",
    "migration": "202611050001_self_service_lifecycle"
  },
  {
    "kind": "column",
    "table": "SocialInsuranceRecord",
    "name": "coverageCohort",
    "sql": "ALTER TABLE \"SocialInsuranceRecord\" ADD COLUMN \"coverageCohort\" TEXT",
    "migration": "202611050002_payroll_compensation"
  },
  {
    "kind": "column",
    "table": "SocialInsuranceRecord",
    "name": "firstCoverageDate",
    "sql": "ALTER TABLE \"SocialInsuranceRecord\" ADD COLUMN \"firstCoverageDate\" TIMESTAMP(3)",
    "migration": "202611050002_payroll_compensation"
  },
  {
    "kind": "column",
    "table": "PayrollItem",
    "name": "calculationSnapshot",
    "sql": "ALTER TABLE \"PayrollItem\" ADD COLUMN \"calculationSnapshot\" JSONB",
    "migration": "202611050002_payroll_compensation"
  },
  {
    "kind": "column",
    "table": "PayrollItem",
    "name": "employerInsurance",
    "sql": "ALTER TABLE \"PayrollItem\" ADD COLUMN \"employerInsurance\" DECIMAL(12,2) NOT NULL DEFAULT 0",
    "migration": "202611050002_payroll_compensation"
  },
  {
    "kind": "table",
    "table": "gosi_settings",
    "name": "gosi_settings",
    "sql": "CREATE TABLE \"gosi_settings\" (\"id\" TEXT PRIMARY KEY, \"cohort\" TEXT NOT NULL, \"effectiveFrom\" TIMESTAMP(3) NOT NULL, \"effectiveTo\" TIMESTAMP(3), \"employeeRate\" DECIMAL(5,2) NOT NULL, \"employerRate\" DECIMAL(5,2) NOT NULL, \"minimumWage\" DECIMAL(12,2) NOT NULL, \"maximumWage\" DECIMAL(12,2) NOT NULL, \"housingIncluded\" BOOLEAN NOT NULL DEFAULT true, \"newSystemCutoff\" TIMESTAMP(3), \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT \"gosi_policy_range\" CHECK (\"employeeRate\" BETWEEN 0 AND 100 AND \"employerRate\" BETWEEN 0 AND 100 AND \"minimumWage\" >= 0 AND \"maximumWage\" >= \"minimumWage\" AND (\"effectiveTo\" IS NULL OR \"effectiveTo\" >= \"effectiveFrom\")))",
    "migration": "202611050002_payroll_compensation"
  },
  {
    "kind": "index",
    "table": "gosi_settings",
    "name": "gosi_settings_cohort_effectiveFrom_key",
    "sql": "CREATE UNIQUE INDEX \"gosi_settings_cohort_effectiveFrom_key\" ON \"gosi_settings\"(\"cohort\", \"effectiveFrom\")",
    "migration": "202611050002_payroll_compensation"
  },
  {
    "kind": "table",
    "table": "salary_rules",
    "name": "salary_rules",
    "sql": "CREATE TABLE \"salary_rules\" (\"id\" TEXT PRIMARY KEY, \"code\" TEXT NOT NULL UNIQUE, \"name\" TEXT NOT NULL, \"category\" TEXT NOT NULL, \"isActive\" BOOLEAN NOT NULL DEFAULT true)",
    "migration": "202611050002_payroll_compensation"
  },
  {
    "kind": "table",
    "table": "OdooPayrollSnapshot",
    "name": "OdooPayrollSnapshot",
    "sql": "CREATE TABLE \"OdooPayrollSnapshot\" (\"id\" TEXT PRIMARY KEY, \"source\" TEXT NOT NULL, \"odooPayslipId\" INTEGER NOT NULL, \"employeeId\" TEXT NOT NULL, \"state\" TEXT NOT NULL, \"period\" TEXT NOT NULL, \"currency\" TEXT NOT NULL, \"moveId\" INTEGER, \"raw\" JSONB NOT NULL, \"lines\" JSONB NOT NULL, \"updatedAt\" TIMESTAMP(3) NOT NULL)",
    "migration": "202611050002_payroll_compensation"
  },
  {
    "kind": "index",
    "table": "OdooPayrollSnapshot",
    "name": "OdooPayrollSnapshot_source_odooPayslipId_key",
    "sql": "CREATE UNIQUE INDEX \"OdooPayrollSnapshot_source_odooPayslipId_key\" ON \"OdooPayrollSnapshot\"(\"source\", \"odooPayslipId\")",
    "migration": "202611050002_payroll_compensation"
  },
  {
    "kind": "index",
    "table": "OdooPayrollSnapshot",
    "name": "OdooPayrollSnapshot_employeeId_period_idx",
    "sql": "CREATE INDEX \"OdooPayrollSnapshot_employeeId_period_idx\" ON \"OdooPayrollSnapshot\"(\"employeeId\", \"period\")",
    "migration": "202611050002_payroll_compensation"
  },
  {
    "kind": "table",
    "table": "PayrollAccountingOutbox",
    "name": "PayrollAccountingOutbox",
    "sql": "CREATE TABLE \"PayrollAccountingOutbox\" (\"id\" TEXT PRIMARY KEY, \"payrollRunId\" TEXT NOT NULL UNIQUE, \"status\" TEXT NOT NULL DEFAULT 'PENDING', \"attempts\" INTEGER NOT NULL DEFAULT 0, \"lastError\" TEXT, \"payload\" JSONB NOT NULL, \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, \"updatedAt\" TIMESTAMP(3) NOT NULL)",
    "migration": "202611050002_payroll_compensation"
  },
  {
    "kind": "column",
    "table": "Loan",
    "name": "odooLoanId",
    "sql": "ALTER TABLE \"Loan\" ADD COLUMN     \"odooLoanId\" INTEGER",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "column",
    "table": "Loan",
    "name": "odooLoanModel",
    "sql": "ALTER TABLE \"Loan\" ADD COLUMN \"odooLoanModel\" TEXT",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "column",
    "table": "Loan",
    "name": "odooSource",
    "sql": "ALTER TABLE \"Loan\" ADD COLUMN \"odooSource\" TEXT",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "column",
    "table": "Loan",
    "name": "odooWriteDate",
    "sql": "ALTER TABLE \"Loan\" ADD COLUMN \"odooWriteDate\" TIMESTAMP(3)",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "table",
    "table": "OdooMigrationJob",
    "name": "OdooMigrationJob",
    "sql": "CREATE TABLE \"OdooMigrationJob\" (\n    \"id\" TEXT NOT NULL,\n    \"source\" TEXT NOT NULL,\n    \"connectionId\" TEXT,\n    \"actorUserId\" TEXT NOT NULL,\n    \"status\" TEXT NOT NULL DEFAULT 'PENDING',\n    \"phase\" TEXT NOT NULL DEFAULT 'EMPLOYEES',\n    \"config\" JSONB NOT NULL,\n    \"cursor\" INTEGER NOT NULL DEFAULT 0,\n    \"upperId\" INTEGER,\n    \"month\" TEXT,\n    \"page\" INTEGER NOT NULL DEFAULT 0,\n    \"lastWriteDate\" TEXT,\n    \"imported\" INTEGER NOT NULL DEFAULT 0,\n    \"updated\" INTEGER NOT NULL DEFAULT 0,\n    \"skipped\" INTEGER NOT NULL DEFAULT 0,\n    \"failed\" INTEGER NOT NULL DEFAULT 0,\n    \"processed\" INTEGER NOT NULL DEFAULT 0,\n    \"phaseProcessed\" INTEGER NOT NULL DEFAULT 0,\n    \"phaseTotal\" INTEGER NOT NULL DEFAULT 0,\n    \"leaseToken\" TEXT,\n    \"leaseUntil\" TIMESTAMP(3),\n    \"lastError\" TEXT,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n    \"finishedAt\" TIMESTAMP(3),\n\n    CONSTRAINT \"OdooMigrationJob_pkey\" PRIMARY KEY (\"id\")\n)",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "table",
    "table": "OdooMigrationError",
    "name": "OdooMigrationError",
    "sql": "CREATE TABLE \"OdooMigrationError\" (\n    \"id\" TEXT NOT NULL,\n    \"jobId\" TEXT NOT NULL,\n    \"entity\" TEXT NOT NULL,\n    \"externalId\" INTEGER NOT NULL,\n    \"code\" TEXT NOT NULL,\n    \"message\" TEXT NOT NULL,\n    \"status\" TEXT NOT NULL DEFAULT 'OPEN',\n    \"attempts\" INTEGER NOT NULL DEFAULT 1,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n\n    CONSTRAINT \"OdooMigrationError_pkey\" PRIMARY KEY (\"id\")\n)",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "table",
    "table": "OdooSourceRecord",
    "name": "OdooSourceRecord",
    "sql": "CREATE TABLE \"OdooSourceRecord\" (\n    \"id\" TEXT NOT NULL,\n    \"source\" TEXT NOT NULL,\n    \"entity\" TEXT NOT NULL,\n    \"externalId\" INTEGER NOT NULL,\n    \"localId\" TEXT,\n    \"writeDate\" TEXT,\n    \"checksum\" TEXT NOT NULL,\n    \"raw\" JSONB NOT NULL,\n    \"status\" TEXT NOT NULL DEFAULT 'STAGED',\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n\n    CONSTRAINT \"OdooSourceRecord_pkey\" PRIMARY KEY (\"id\")\n)",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "table",
    "table": "OdooLoanInstallment",
    "name": "OdooLoanInstallment",
    "sql": "CREATE TABLE \"OdooLoanInstallment\" (\n    \"id\" TEXT NOT NULL,\n    \"loanId\" TEXT NOT NULL,\n    \"source\" TEXT NOT NULL,\n    \"externalId\" INTEGER NOT NULL,\n    \"dueDate\" TIMESTAMP(3) NOT NULL,\n    \"amount\" DECIMAL(20,6) NOT NULL,\n    \"remotePaid\" BOOLEAN NOT NULL,\n    \"localPaidAt\" TIMESTAMP(3),\n    \"raw\" JSONB NOT NULL,\n\n    CONSTRAINT \"OdooLoanInstallment_pkey\" PRIMARY KEY (\"id\")\n)",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "table",
    "table": "HistoricalPayrollRun",
    "name": "HistoricalPayrollRun",
    "sql": "CREATE TABLE \"HistoricalPayrollRun\" (\n    \"id\" TEXT NOT NULL,\n    \"source\" TEXT NOT NULL,\n    \"period\" TEXT NOT NULL,\n    \"companyOdooId\" INTEGER NOT NULL,\n    \"externalRunId\" INTEGER NOT NULL DEFAULT 0,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n\n    CONSTRAINT \"HistoricalPayrollRun_pkey\" PRIMARY KEY (\"id\")\n)",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "table",
    "table": "HistoricalPayslip",
    "name": "HistoricalPayslip",
    "sql": "CREATE TABLE \"HistoricalPayslip\" (\n    \"id\" TEXT NOT NULL,\n    \"runId\" TEXT NOT NULL,\n    \"source\" TEXT NOT NULL,\n    \"odooPayslipId\" INTEGER NOT NULL,\n    \"employeeId\" TEXT NOT NULL,\n    \"state\" TEXT NOT NULL,\n    \"currency\" TEXT NOT NULL,\n    \"fromDate\" TIMESTAMP(3) NOT NULL,\n    \"toDate\" TIMESTAMP(3) NOT NULL,\n    \"basic\" DECIMAL(20,6) NOT NULL,\n    \"gross\" DECIMAL(20,6) NOT NULL,\n    \"deductions\" DECIMAL(20,6) NOT NULL,\n    \"net\" DECIMAL(20,6) NOT NULL,\n    \"moveId\" INTEGER,\n    \"raw\" JSONB NOT NULL,\n    \"checksum\" TEXT NOT NULL,\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n\n    CONSTRAINT \"HistoricalPayslip_pkey\" PRIMARY KEY (\"id\")\n)",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "table",
    "table": "HistoricalPayslipLine",
    "name": "HistoricalPayslipLine",
    "sql": "CREATE TABLE \"HistoricalPayslipLine\" (\n    \"id\" TEXT NOT NULL,\n    \"payslipId\" TEXT NOT NULL,\n    \"externalId\" INTEGER NOT NULL,\n    \"code\" TEXT NOT NULL,\n    \"name\" TEXT NOT NULL,\n    \"category\" TEXT NOT NULL,\n    \"amount\" DECIMAL(20,6) NOT NULL,\n    \"quantity\" DECIMAL(20,6) NOT NULL,\n    \"rate\" DECIMAL(20,6) NOT NULL,\n    \"total\" DECIMAL(20,6) NOT NULL,\n    \"raw\" JSONB NOT NULL,\n\n    CONSTRAINT \"HistoricalPayslipLine_pkey\" PRIMARY KEY (\"id\")\n)",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "index",
    "table": "OdooMigrationJob",
    "name": "OdooMigrationJob_source_status_idx",
    "sql": "CREATE INDEX \"OdooMigrationJob_source_status_idx\" ON \"OdooMigrationJob\"(\"source\", \"status\")",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "index",
    "table": "OdooMigrationError",
    "name": "OdooMigrationError_jobId_status_idx",
    "sql": "CREATE INDEX \"OdooMigrationError_jobId_status_idx\" ON \"OdooMigrationError\"(\"jobId\", \"status\")",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "index",
    "table": "OdooMigrationError",
    "name": "OdooMigrationError_jobId_entity_externalId_key",
    "sql": "CREATE UNIQUE INDEX \"OdooMigrationError_jobId_entity_externalId_key\" ON \"OdooMigrationError\"(\"jobId\", \"entity\", \"externalId\")",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "index",
    "table": "OdooSourceRecord",
    "name": "OdooSourceRecord_source_entity_status_idx",
    "sql": "CREATE INDEX \"OdooSourceRecord_source_entity_status_idx\" ON \"OdooSourceRecord\"(\"source\", \"entity\", \"status\")",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "index",
    "table": "OdooSourceRecord",
    "name": "OdooSourceRecord_source_entity_externalId_key",
    "sql": "CREATE UNIQUE INDEX \"OdooSourceRecord_source_entity_externalId_key\" ON \"OdooSourceRecord\"(\"source\", \"entity\", \"externalId\")",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "index",
    "table": "OdooLoanInstallment",
    "name": "OdooLoanInstallment_loanId_dueDate_remotePaid_idx",
    "sql": "CREATE INDEX \"OdooLoanInstallment_loanId_dueDate_remotePaid_idx\" ON \"OdooLoanInstallment\"(\"loanId\", \"dueDate\", \"remotePaid\")",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "index",
    "table": "OdooLoanInstallment",
    "name": "OdooLoanInstallment_loanId_externalId_key",
    "sql": "CREATE UNIQUE INDEX \"OdooLoanInstallment_loanId_externalId_key\" ON \"OdooLoanInstallment\"(\"loanId\", \"externalId\")",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "index",
    "table": "HistoricalPayrollRun",
    "name": "HistoricalPayrollRun_source_period_companyOdooId_externalRu_key",
    "sql": "CREATE UNIQUE INDEX \"HistoricalPayrollRun_source_period_companyOdooId_externalRu_key\" ON \"HistoricalPayrollRun\"(\"source\", \"period\", \"companyOdooId\", \"externalRunId\")",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "index",
    "table": "HistoricalPayslip",
    "name": "HistoricalPayslip_employeeId_fromDate_idx",
    "sql": "CREATE INDEX \"HistoricalPayslip_employeeId_fromDate_idx\" ON \"HistoricalPayslip\"(\"employeeId\", \"fromDate\")",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "index",
    "table": "HistoricalPayslip",
    "name": "HistoricalPayslip_source_odooPayslipId_key",
    "sql": "CREATE UNIQUE INDEX \"HistoricalPayslip_source_odooPayslipId_key\" ON \"HistoricalPayslip\"(\"source\", \"odooPayslipId\")",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "index",
    "table": "HistoricalPayslipLine",
    "name": "HistoricalPayslipLine_payslipId_externalId_key",
    "sql": "CREATE UNIQUE INDEX \"HistoricalPayslipLine_payslipId_externalId_key\" ON \"HistoricalPayslipLine\"(\"payslipId\", \"externalId\")",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "index",
    "table": "Loan",
    "name": "Loan_odooSource_odooLoanModel_odooLoanId_key",
    "sql": "CREATE UNIQUE INDEX \"Loan_odooSource_odooLoanModel_odooLoanId_key\" ON \"Loan\"(\"odooSource\", \"odooLoanModel\", \"odooLoanId\")",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "constraint",
    "table": "OdooMigrationError",
    "name": "OdooMigrationError_jobId_fkey",
    "sql": "ALTER TABLE \"OdooMigrationError\" ADD CONSTRAINT \"OdooMigrationError_jobId_fkey\" FOREIGN KEY (\"jobId\") REFERENCES \"OdooMigrationJob\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "constraint",
    "table": "OdooLoanInstallment",
    "name": "OdooLoanInstallment_loanId_fkey",
    "sql": "ALTER TABLE \"OdooLoanInstallment\" ADD CONSTRAINT \"OdooLoanInstallment_loanId_fkey\" FOREIGN KEY (\"loanId\") REFERENCES \"Loan\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "constraint",
    "table": "HistoricalPayslip",
    "name": "HistoricalPayslip_runId_fkey",
    "sql": "ALTER TABLE \"HistoricalPayslip\" ADD CONSTRAINT \"HistoricalPayslip_runId_fkey\" FOREIGN KEY (\"runId\") REFERENCES \"HistoricalPayrollRun\"(\"id\") ON DELETE RESTRICT ON UPDATE CASCADE",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "constraint",
    "table": "HistoricalPayslipLine",
    "name": "HistoricalPayslipLine_payslipId_fkey",
    "sql": "ALTER TABLE \"HistoricalPayslipLine\" ADD CONSTRAINT \"HistoricalPayslipLine_payslipId_fkey\" FOREIGN KEY (\"payslipId\") REFERENCES \"HistoricalPayslip\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "index",
    "table": "OdooMigrationJob",
    "name": "OdooMigrationJob_active_source_key",
    "sql": "CREATE UNIQUE INDEX \"OdooMigrationJob_active_source_key\" ON \"OdooMigrationJob\"(\"source\") WHERE \"status\" IN ('PENDING','RUNNING','PAUSED')",
    "migration": "202611050003_odoo_historical_migration"
  },
  {
    "kind": "constraint",
    "table": "OdooLoanInstallment",
    "name": "OdooLoanInstallment_positive_amount",
    "sql": "ALTER TABLE \"OdooLoanInstallment\" ADD CONSTRAINT \"OdooLoanInstallment_positive_amount\" CHECK (\"amount\" > 0)",
    "migration": "202611050003_odoo_historical_migration"
  }
] as const;

export const migrationChecksums = {"202611050001_self_service_lifecycle": "220741bd3603616566948632f76501c2cdca4058d0b2dbc389f123ae191cfbcf", "202611050002_payroll_compensation": "5182626dff653c795af2ea2714b8a714520ec7a67fd7b1d84786cc9075ff418b", "202611050003_odoo_historical_migration": "8a42595d96725ea094b215cc453d0381e8de6e0a3333cd5424b435f908400d38"} as const;
