# Huynh Thy Equipment CRM — MVP Overview & Proposal

## 1) Executive Summary
Huynh Thy Equipment CRM is an MVP sales operating system purpose-built for equipment sales. It consolidates customer, product, supplier, and quotation workflows into one place, accelerating quotation turnaround, reducing manual errors from Excel, and giving leadership a clean view of pipeline and revenue performance.

## 2) Business Value for Huynh Thy
- Faster quotation cycle: standardized quotation workflow and one-click PDF generation.
- Quantified speed gain: quotation preparation reduced from ~2 hours to ~5 minutes in the target workflow.
- Error reduction: centralized master data (customers, contacts, products, pricing assumptions) replaces fragmented Excel files.
- Single source of truth: inputs (leads, accounts, products) and outputs (quotations, reports) are connected and auditable.
- Better visibility: KPI dashboard and funnel reporting support management decisions and sales coaching.

## 3) Target Users & Workflow
- Sales / Business Development:
  - Manage accounts, contacts, and leads.
  - Build quotations from product catalog, apply financial parameters, and send finalized PDFs.
- Business Leadership:
  - Monitor pipeline value, win rate, new accounts/leads, and quotation status.
  - Review activity logs and reports to guide priorities.

## 4) Core MVP Modules
- Dashboard: KPI summary (accounts, leads, quotations, win rate, pipeline value).
- Accounts & Contacts: customer/supplier master data.
- Leads: capture, stage tracking, and conversion visibility.
- Products/Equipment: catalog with specs, pricing, and technical data.
- Suppliers: supplier master data and supplier quotes.
- Quotations: build quotes, manage status, generate PDF proposals.
- Financial Calculator: landed cost, financing, margin, VAT, and total pricing.
- Reports: revenue trend and sales funnel.
- Activity Log: audit trail of key actions.
- Settings: company info and default commercial terms.

## 5) Data & AI Capabilities
- Excel-first onboarding: bulk import/export CSV templates for accounts, leads, products, suppliers, and users.
- AI integration: automated translation for professional English quotation text, improving speed and quality in customer-facing documents.
- ERP integration: structured handoff of quotation and customer data to the ERP system.

## 6) System Architecture (MVP)
- Frontend: Preact + Vite + Tailwind (fast, lightweight UI).
- Backend: Node.js (Express) + SQLite for rapid MVP iteration.
- Output generation: PDF quotation rendering with standardized layout.

## 7) Deployment Direction
- Current deployment: on-premise (temporary), aligned with IT policy and data governance.

## 8) Immediate Impact (MVP Phase)
- Reduce quotation preparation time and manual formatting steps.
- Reduce mistakes caused by manual copy/paste across Excel files.
- Create consistent commercial proposals aligned with Huynh Thy standards.
- Provide leadership with real-time pipeline visibility.

## 9) Proposed Next Steps
- MVP rollout to Sales and Business Development teams.
- Confirm deployment model and access control requirements.
- Expand AI support (e.g., product summary, bid text drafting) and integrate with email/ERP if needed.

---
This one-page overview is designed for leadership and sales stakeholders to understand the value and operational flow of the MVP CRM and approve a controlled rollout.
