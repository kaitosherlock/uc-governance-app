# 02 — Identity Groups Provisioning Guide

In Unity Catalog, row filters, column masks, and ABAC policies evaluate group membership using the built-in function `is_account_group_member('group_name')`.
Because Unity Catalog groups cannot be created using standard SQL `CREATE` statements, they must be provisioned via the **Databricks CLI**, the **Account / Workspace SCIM API**, or the **Databricks Admin UI**.

---

## 1. Demo Groups Overview

All demonstration groups are explicitly prefixed with `gov_demo_` to guarantee zero collision with enterprise identities:

| Group Name | Persona Description | Target Privileges / Masking Behavior |
|---|---|---|
| `gov_demo_admins` | Governance & Metastore Admins | Full unmasked visibility, policy management, bypasses restrictions |
| `gov_demo_stewards` | Data Stewards & Custodians | Metadata tagging, unmasked SSN preview (last 4 digits), audit |
| `gov_demo_analysts` | Reporting & BI Analysts | PII emails masked to domain, phone masked, amounts rounded, active records only |
| `gov_demo_auditors` | Financial & Compliance Auditors | Full claim amounts visible for compliance, all regions visible, SSN masked |
| `gov_demo_support_emea` | Regional Support Specialists | Strictly restricted by row filter to `region = 'EMEA'` records only |

---

## 2. Option A: Provisioning via Databricks CLI (Recommended)

Make sure you have the Databricks CLI (v0.200.0 or higher) configured with appropriate credentials.

### Account-Level Groups (Best Practice for Multi-Workspace UC)
If your organization manages identities centrally at the Databricks Account level (`https://accounts.cloud.databricks.com`):

```bash
# 1. Create the five account groups
databricks account groups create --display-name "gov_demo_admins"
databricks account groups create --display-name "gov_demo_stewards"
databricks account groups create --display-name "gov_demo_analysts"
databricks account groups create --display-name "gov_demo_auditors"
databricks account groups create --display-name "gov_demo_support_emea"

# 2. Assign the groups to your target workspace (replace <workspace-id>)
databricks account workspace-assignment update <workspace-id> \
  --permissions "USER" \
  --group-names '["gov_demo_admins","gov_demo_stewards","gov_demo_analysts","gov_demo_auditors","gov_demo_support_emea"]'
```

### Workspace-Level Groups (Standard Workspace Admin)
If you are a Workspace Admin without Account Admin rights:

```bash
databricks groups create --display-name "gov_demo_admins"
databricks groups create --display-name "gov_demo_stewards"
databricks groups create --display-name "gov_demo_analysts"
databricks groups create --display-name "gov_demo_auditors"
databricks groups create --display-name "gov_demo_support_emea"
```

PowerShell equivalent:
```powershell
$groups = @("gov_demo_admins", "gov_demo_stewards", "gov_demo_analysts", "gov_demo_auditors", "gov_demo_support_emea")
foreach ($g in $groups) {
    databricks groups create --display-name $g
}
```

---

## 3. Option B: Provisioning via Workspace UI

1. Open your Databricks workspace.
2. In the top right corner, click your profile icon and select **Settings**.
3. Under **Workspace settings**, navigate to **Identity and access > Groups**.
4. Click **Add Group**, choose **Create new group**, enter the name (e.g., `gov_demo_admins`), and click **Add**.
5. Repeat for all 5 groups.

---

## 4. Persona Testing: Assigning Your User to Test Views

To experience cell-level masking and row-filtering dynamically as different personas:

1. In **Settings > Identity and access > Groups**, open the group you wish to test (e.g., `gov_demo_analysts`).
2. Add your current Databricks username/email into that group.
3. Open a Databricks SQL query window and query:
   ```sql
   SELECT current_user(), is_account_group_member('gov_demo_analysts');
   ```
4. Query `demo_governance.curated.policyholders` or `demo_governance.curated.claims`.
5. Notice how columns like `email`, `phone`, and `claim_amount` automatically change between masked, rounded, and full values depending on which group you belong to.
6. To switch persona, remove yourself from `gov_demo_analysts` and add yourself to `gov_demo_support_emea`. Re-run the query to observe regional filtering.

---

## 5. Teardown / Cleanup of Groups

When tearing down the demo, remove the demo groups to keep your workspace clean:

```bash
databricks groups delete --group-id <group-id-for-gov_demo_admins>
databricks groups delete --group-id <group-id-for-gov_demo_stewards>
databricks groups delete --group-id <group-id-for-gov_demo_analysts>
databricks groups delete --group-id <group-id-for-gov_demo_auditors>
databricks groups delete --group-id <group-id-for-gov_demo_support_emea>
```
*(Or delete them from the Settings > Identity and access > Groups UI).*
