# Bal Nova - Admin Training Guide

## Purpose
This guide trains Admins to operate the Bal Nova Command Center safely and consistently.

## Training Outline
1. Environment and roles
2. Financial Engine overview
3. Finance Ledger workflows
4. Dispatch Tower operations
5. Fleet Command and QC Firewall
6. Customer/Vendor/Reseller/Service Network views
7. System Config management
8. Incident handling checklist

## 1. Environment and Roles
- Confirm you are signed in with an `admin` role.
- Verify data is loading for:
  - Financial Engine
  - Finance Ledger
  - Dispatch Tower

## 2. Financial Engine Overview
Goals:
- Understand revenue, escrow, and tax-safe metrics.
- Learn to switch trend ranges.

Steps:
1. Open **Financial Engine**.
2. Switch **7D / 30D / 90D / All** to verify chart range updates.
3. Review the Tax-Safe Engine panel.

Screenshot:
- `![Financial Engine overview](docs/screenshots/03-financial-engine.png)`

## 3. Finance Ledger Workflows
Goals:
- Review ledger entries and create manual adjustments.

Steps:
1. Open **Finance Ledger**.
2. Filter by type or date if needed.
3. Add a manual adjustment entry.
4. Export CSV for reporting.

Screenshot:
- `![Finance Ledger](docs/screenshots/05-finance-ledger.png)`

## 4. Dispatch Tower Operations
Goals:
- Monitor bay utilization and active requests.

Steps:
1. Open **Dispatch Tower**.
2. Check Bay A and Bay B utilization.
3. Review hot threshold status.
4. Toggle Auto-Hot only if your operations require auto escalation.

Screenshot:
- `![Dispatch Tower](docs/screenshots/04-dispatch-tower.png)`

## 5. Fleet Command and QC Firewall
Goals:
- Monitor throughput and compliance.

Steps:
1. Open **Fleet Command** and review active queue metrics.
2. Open **QC Firewall** and scan audit trails.
3. Confirm last event timestamps are current.

Screenshots:
- `![Fleet Command](docs/screenshots/13-fleet-command.png)`
- `![QC Firewall](docs/screenshots/14-qc-firewall.png)`

## 6. Ecosystem Views
Goals:
- Understand partner signals across the ecosystem.

Steps:
1. Open **Customer Data**.
2. Open **Vendor Network**.
3. Open **Reseller Army**.
4. Open **Service Network**.

Screenshots:
- `![Customer Data](docs/screenshots/15-customer-data.png)`
- `![Vendor Network](docs/screenshots/16-vendor-network.png)`
- `![Reseller Army](docs/screenshots/17-reseller-army.png)`
- `![Service Network](docs/screenshots/18-service-network.png)`

## 7. System Config Management
Goals:
- Manage user accounts and dispatch settings.

Steps:
1. Open **System Config**.
2. Create or update an admin user.
3. Verify bay capacity and hot thresholds.
4. Confirm Auto-Hot is set according to your SOP.

Screenshot:
- `![System Config](docs/screenshots/09-system-config.png)`

## 8. Incident Handling Checklist
When issues happen:
- Confirm DB connectivity.
- Check `/api/finance/ledger` and `/api/orders` responses.
- Verify the user has `admin` role.
- Review recent audit logs for errors.
- Restart the dev server if needed.

---
If you want a tailored runbook for your operations team, we can add SOPs, SLA targets, and escalation trees.
