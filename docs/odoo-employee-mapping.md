# Odoo ↔ Lana HRMS Employee Mapping - Complete

Generated: 2026-07-09

## hr.employee (Odoo) → Employee (Lana)

| Odoo Field | Odoo Type | Lana Field | Lana Type | Status | Notes |
|---|---|---|---|---|---|
| id | integer | — | — | used as fallback | external reference |
| name | char | firstName / lastName | String | ✅ Active | splitFullName() |
| barcode | char | employeeNumber | String @unique | ✅ Active | keyField |
| identification_id | char | nationalId | String @unique | ✅ Active | |
| work_email | char | email | String? @unique | ✅ Active | |
| work_phone | char | phone | String? | ✅ Active | |
| mobile_phone | char | phone (fallback) | String? | 🔧 NEW | if work_phone empty |
| gender | selection | gender | String? | ✅ Active | male/female |
| active | boolean | status | EmployeeStatus | ✅ Active | ACTIVE / INACTIVE |
| image_1920 | binary (base64) | profilePhotoUrl | String? | 🔧 NEW | store as data URI |
| first_contract_date | date | hireDate | DateTime | 🔧 NEW | was using create_date |
| create_date | datetime | hireDate (fallback) | DateTime | ✅ Active | |
| department_id | many2one hr.department | departmentId | String? FK | 🔧 NEW | resolve ODOO-DEPT-{id} |
| job_id | many2one hr.job | positionId | String? FK | 🔧 NEW | resolve ODOO-JOB-{id} |
| company_id | many2one res.company | branchId | String? FK | 🔧 NEW | resolve ODOO-COMPANY-{id} |
| parent_id | many2one hr.employee | manager linkage | — | 🔧 NEW | stored in metadata / future |
| address_home_id | many2one res.partner | address | String? | 📋 Planned | |
| private_email | char | email (fallback) | String? | 📋 Planned | |
| private_phone | char | phone (fallback) | String? | 📋 Planned | |
| birthday | date | dateOfBirth | DateTime? | 🔧 NEW | |
| country_id | many2one res.country | nationalityId | String? FK | 📋 Planned | needs nationality mapping |
| work_location_id | many2one | — | — | ⏭ Unused | |
| employee_type | selection | employmentTypeId | String? FK | 📋 Planned | |
| km_home_work | integer | — | — | ⏭ Unused | |
| children | integer | — | — | ⏭ Unused | |
| marital | selection | — | ⏭ Unused | | |
| emergency_contact | char | emergencyContact | String? | 🔧 NEW | |
| emergency_phone | char | emergencyContact (append) | String? | 🔧 NEW | |
| place_of_birth | char | — | — | ⏭ Unused | |
| passport_id | char | — | ⏭ Future doc | | |
| pin | char | — | ⏭ Unused | | |
| visa_no / visa_expire | char/date | — | ⏭ Future doc | | |
| permit_no | char | — | ⏭ Unused | | |
| certificate / study_field / study_school | various | — | ⏭ Unused | | |
| tz | selection | — | — | ⏭ Unused | goes to EmployeePreference |
| departure_date | date | terminationDate | DateTime? | 🔧 NEW | |
|  |  |  |  |  |  |

### Contract Salary (hr.contract)

| Odoo Field | Lana Field | Status |
|---|---|---|
| hr.contract.wage | EmployeeContract.salaryAmount | ✅ via contracts sync |
| hr.contract.date_start | EmployeeContract.startDate | ✅ |
| hr.contract.date_end | EmployeeContract.endDate | ✅ |
| hr.contract.name | EmployeeContract.contractNumber / title | ✅ |
| hr.contract.state | EmployeeContract.status | ✅ |
| hr.contract.employee_id | EmployeeContract.employeeId | ✅ |

Employee salary is NOT stored on hr.employee – must pull from hr.contract.

---

## Lana Employee → Odoo hr.employee

| Lana Field | Odoo Field | Status |
|---|---|---|
| firstName + lastName | name | ✅ |
| employeeNumber | barcode | ✅ |
| nationalId | identification_id | ✅ |
| email | work_email | ✅ |
| phone | work_phone / mobile_phone | ✅ |
| gender | gender | ✅ |
| status | active | ✅ |
| departmentId | department_id | 🔧 NEW |
| positionId | job_id | 🔧 NEW |
| branchId | company_id | 🔧 NEW |
| hireDate | first_contract_date | 🔧 NEW |
| profilePhotoUrl | image_1920 | 🔧 NEW |
| dateOfBirth | birthday | 🔧 NEW |
| address | private_street? | 📋 |
| emergencyContact | emergency_contact / emergency_phone | 🔧 NEW |

---

## Fields NOT YET MAPPED (reason)

- **salary on Employee model** – Lana stores salary in EmployeeContract, not Employee. Now auto-created from hr.contract.wage.
- **manager (parent_id)** – Lana Employee has no managerId FK yet. Will store in audit metadata / future extension.
- **work_location, tz, marital, children, etc.** – No corresponding Lana fields, kept in Odoo only.
- **country_id → nationalityId** – Requires Nationality master data seeding. Added lookup fallback.
- **employee_type → employmentTypeId** – Requires EmploymentType seeding.
- **private address fields** – Lana has single `address` text field; Odoo splits private address via res.partner – mapping added as concatenated string.
- **multiple bank accounts, visa, passport** – Lana stores via EmployeeDocument – future phase.

---

## Implementation Summary

1. **odooFields expanded** from 13 to 34 fields:
   - image_1920, first_contract_date, parent_id, company_id, mobile_phone, private_email, private_phone, birthday, country_id, address_home_id, emergency_contact, emergency_phone, departure_date, etc.
2. **mapOdooEmployeeToLana** now returns:
   - profilePhotoUrl (data:image/*;base64,…)
   - hireDate = first_contract_date || create_date
   - dateOfBirth
   - terminationDate
   - emergencyContact
   - odooDepartmentId, odooJobId, odooCompanyId, odooManagerId (resolved in sync)
3. **syncEmployees** resolves:
   - department_id → Department.code = ODOO-DEPT-{id}
   - job_id → Position.code = ODOO-JOB-{id}
   - company_id → Branch.code = ODOO-COMPANY-{id}
   - Creates/updates EmployeeContract from latest hr.contract (wage)
4. **contracts sync** added to “sync all” pipeline.
5. **Image import**: image_1920 base64 → stored as data URI in profilePhotoUrl.

