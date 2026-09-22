/**
 * strings.ts — Every user-visible English string in the application.
 *
 * Organised by area. No component may contain a hard-coded English sentence.
 * Object names, principal names, and privilege identifiers are never translated
 * or reworded (they come from data, not from this file).
 */

export const strings = {
  /** Application-wide */
  app: {
    title: "Unity Catalog Governance",
    skipToContent: "Skip to main content",
  },

  /** Left-rail navigation labels */
  nav: {
    primaryNavLabel: "Primary navigation",
    dataAssets: "Data Assets",
    accessManagement: "Access Management",
    policies: "Policies",
    activity: "Activity",
    platform: "Platform",
  },

  /** Context bar labels */
  context: {
    barLabel: "Workspace and identity context",
    barLoadingLabel: "Loading workspace context",
    notConnected: "Workspace context not connected",
    modeLabel: "Mode",
    environmentLabel: "Environment",
    workspaceLabel: "Workspace",
    scopeLabel: "Managed scope",
    actorLabel: "Signed in as",
    executorLabel: "Executor",
    executorSentence:
      "You are requesting this change. It will be executed by the application's service principal {name}.",
    noScope: "No catalogs in scope",
    unknownWorkspace: "Unknown workspace",
    limitationsPrefix: "Limitations:",
    errorDetails: "Technical details",
    actorAriaLabel: "Signed in as {name}",
    executorAriaLabel: "Actions run as {name}",
  },

  /** Common labels */
  common: {
    loading: "Loading…",
    retry: "Retry",
    cancel: "Cancel",
    close: "Close",
    save: "Save",
    confirm: "Confirm",
    back: "Back",
    next: "Next",
    search: "Search",
    noResults: "No results found.",
    copyToClipboard: "Copy to clipboard",
    copied: "Copied",
    notApplicable: "N/A",
    unknown: "Unknown",
    viewDetails: "View details",
    learnMore: "Learn more",
  },

  /** Data assets area */
  assets: {
    title: "Data Assets",
    description: "Browse catalogs, schemas, and objects to inspect governance and access.",
    breadcrumbRoot: "Data Assets",
    breadcrumbAriaLabel: "Asset hierarchy navigation",
    searchLabel: "Search assets",
    searchPlaceholder: "Search catalogs, schemas, and objects…",
    searchClear: "Clear search",
    treeAriaLabel: "Catalog and asset tree",
    catalogsTitle: "Catalogs",
    schemasTitle: "Schemas",
    objectsTitle: "Objects",
    refresh: "Refresh",
    refreshAriaLabel: "Refresh current asset data",
    copyFqn: "Copy fully qualified name",
    copiedFqn: "Copied fully qualified name to clipboard",
    copyLocation: "Copy storage location",
    tabs: {
      overview: "Overview",
      access: "Access",
      tags: "Tags",
      lineage: "Lineage",
      quality: "Quality",
    },
    fields: {
      fullName: "Full Name",
      displayName: "Name",
      securableType: "Securable Type",
      kind: "Object Kind",
      owner: "Owner",
      unassignedOwner: "Unassigned",
      comment: "Description",
      noComment: "No description provided.",
      managed: "Managed Status",
      pipelineManaged: "Pipeline Managed",
      pipelineManagedTrue: "Pipeline managed",
      pipelineManagedFalse: "Directly managed",
      createdAt: "Created",
      createdBy: "Created By",
      updatedAt: "Updated",
      storageLocation: "Storage Location",
      tableType: "Table Type",
      dataSourceFormat: "Data Format",
      viewDefinition: "View Definition",
      rowFilter: "Row Filter",
      columnMask: "Column Mask",
      parent: "Parent Asset",
    },
    columnsTable: {
      title: "Columns",
      position: "Position",
      name: "Column",
      type: "Data Type",
      nullable: "Nullable",
      mask: "Mask",
      tags: "Tags",
      comment: "Comment",
      emptyColumns: "No columns for this object type.",
      sortAsc: "sorted ascending",
      sortDesc: "sorted descending",
      sortNone: "not sorted",
    },
    tags: {
      title: "Tags",
      empty: "No tags assigned.",
      freeForm: "Free-form",
      governed: "Governed",
      system: "System",
    },
    dependencies: {
      title: "Known Dependencies",
      kind: "Kind",
      name: "Dependent Object",
      source: "Source",
      verified: "Verified",
      verifiedTrue: "Verified",
      verifiedFalse: "Unverified",
      empty: "No known dependencies recorded.",
      defaultDisclaimer: "Missing dependency information is not proof that deletion is safe.",
    },
    actions: {
      grant: "Grant",
      revoke: "Revoke",
      editMetadata: "Edit metadata",
      delete: "Delete",
      transferOwnership: "Transfer ownership",
      viewPermissionsAtSource: "View permissions at source",
      allowed: "Permitted",
      notAllowed: "Action not permitted",
    },
    states: {
      idleTitle: "Select a scope to get started",
      idleDescription: "Browse catalogs on the left or use search to find data assets and inspect permissions.",
      emptyCatalogs: "No catalogs visible to the application.",
      emptySchemas: "No schemas visible to the application in this catalog.",
      emptyObjects: "No objects visible to the application in this schema.",
      completenessNotice: "Notice: Metadata visibility is partial or truncated in this scope.",
      limitationsHeading: "Data limitations in current scope:",
      detailsHeading: "Technical details",
      unknownBadge: "Unknown",
    },
    treeNavTitle: "Tree",
    treeShow: "Show catalog tree",
    treeHide: "Hide catalog tree",
    searchResultsFor: "Search results for",
    scopeObjectsInSchema: "Objects in schema {schema}",
    scopeSchemasInCatalog: "Schemas in catalog {catalog}",
    filterByKind: "Filter by kind:",
    allKinds: "All",
    tablesKind: "Tables",
    viewsKind: "Views",
    volumesKind: "Volumes",
    functionsKind: "Functions",
    modelsKind: "Models",
    objectsCount: "{filtered} of {total} objects",
    itemsCount: "{count} items",
    itemCount: "1 item",
    actionsHeading: "Actions",
    expandCatalogAria: "Expand catalog {name}",
    collapseCatalogAria: "Collapse catalog {name}",
    expandSchemaAria: "Expand schema {name}",
    collapseSchemaAria: "Collapse schema {name}",
  },

  /** Access tab and grants */
  access: {
    title: "Access",
    tabLabel: "Access",
    overviewTabLabel: "Overview",
    tabsAriaLabel: "Asset view tabs",
    description: "Inspect direct and inherited privileges on this asset.",
    grantsTable: {
      title: "Grants",
      principal: "Principal",
      principalType: "Type",
      privilege: "Privilege",
      source: "Source",
      actions: "Actions",
      noMatchingGrants: "No grants match the current filters.",
      grantsCount: "{filtered} of {total} grants",
      totalGrants: "{total} grants",
      sortAsc: "sorted ascending",
      sortDesc: "sorted descending",
      sortNone: "not sorted",
      noActions: "No actions available",
    },
    principalKinds: {
      user: "User",
      group: "Group",
      servicePrincipal: "Service Principal",
      unknown: "Unknown",
    },
    sources: {
      direct: "Direct",
      inherited: "Inherited",
      inheritedFrom: "Inherited from {kind}",
      unknown: "Unknown",
    },
    filters: {
      heading: "Filter grants",
      searchPrincipal: "Filter by principal",
      principalPlaceholder: "Filter by principal…",
      allPrivileges: "All privileges",
      privilegeLabel: "Filter by privilege",
      allSources: "All sources",
      sourceLabel: "Filter by source",
      clearFilters: "Clear filters",
      clearFiltersAndShowAll: "Clear filters and show all grants",
      clientSideNotice: "Filtering applies client-side to loaded grants.",
    },
    privileges: {
      SELECT: "Read data",
      MODIFY: "Modify data",
      USE_CATALOG: "Use catalog",
      USE_SCHEMA: "Use schema",
      MANAGE: "Manage permissions",
      ALL_PRIVILEGES: "All applicable privileges",
      EXECUTE: "Execute function or model",
      READ_VOLUME: "Read volume",
      WRITE_VOLUME: "Write volume",
      CREATE_CATALOG: "Create catalog",
      CREATE_SCHEMA: "Create schema",
      CREATE_TABLE: "Create table",
      CREATE_FUNCTION: "Create function",
      CREATE_VOLUME: "Create volume",
      CREATE_MODEL: "Create model",
      CREATE_MATERIALIZED_VIEW: "Create materialized view",
      APPLY_TAG: "Apply tag",
      REFRESH: "Refresh",
    },
  },

  /** UI states */
  states: {
    loading: "Loading data…",
    loadingSkeleton: "Loading",
    empty: "There is nothing here yet. Select a scope or use the navigation to get started.",
    emptyGrants:
      "No grants visible to the application on this object.",
    emptyAssets: "No assets found in this scope.",
    idle: "Select a scope to get started.",
    notImplemented: "This feature is not yet available.",
    notConfigured: "This feature requires additional configuration.",
  },

  /** Error messages */
  errors: {
    generic:
      "Something went wrong. Copy the correlation ID below and contact your administrator to report this failure.",
    networkError:
      "Unable to reach the server. Check your connection and try again.",
    notFound:
      "Not found, or not visible to the application. Verify the name and check that the application has access.",
    forbidden:
      "Your role does not have permission for this action. Ask an access administrator to grant you the required privilege.",
    unauthorized:
      "Your session has expired. Sign in again to continue.",
    modeReadOnly:
      "This instance is in read-only mode. Write operations are not available.",
    rateLimit:
      "Too many requests. Wait a moment, then try again.",
    upstream:
      "An upstream service is unavailable. Try again in a few minutes.",
    correlationPrefix: "Correlation ID:",
    nextStepsPrefix: "Suggested next steps:",
  },

  /** Page headings */
  pages: {
    dataAssets: "Data Assets",
    asset: "Asset",
    accessManagement: "Access Management",
    policies: "Policies",
    activity: "Activity",
    platform: "Platform",
    notFound: "Page not found",
  },

  /**
   * One-line header descriptions — the answer to "what is this section for".
   * Used as the `description` prop on PageHeader. Never duplicate a string
   * from `strings.unavailable`.
   */
  descriptions: {
    dataAssets:
      "Browse catalogs, schemas, and tables to see who can access them.",
    assetDetail:
      "View ownership, access grants, tags, lineage, and quality for a specific asset.",
    accessManagement:
      "Manage grants, revocations, and ownership transfers across your catalog.",
    policies:
      "Define attribute-based access policies, row filters, column masks, and governed tags.",
    activity:
      "Review Databricks audit events, application activity, and governance findings.",
    platform:
      "Manage storage credentials, external locations, workspace bindings, connections, and sharing.",
    notFound:
      "That page does not exist.",
  },

  /**
   * Body text for sections that are not yet built — what the person can do
   * right now and what is missing. Used in the section body, never in the
   * header. Never duplicate a string from `strings.descriptions`.
   */
  unavailable: {
    dataAssets:
      "Asset search and the access table are not available yet. Use the navigation to explore the other sections.",
    assetDetail:
      "The asset detail view is not available yet. Return to Data Assets to browse the catalog tree.",
    accessManagement:
      "The grant queue, access requests, and approval reviews are not available yet. Use Data Assets to view current grants.",
    policies:
      "Policy editing and the attribute-based access rule builder are not available yet. Check back when a later section is enabled.",
    activity:
      "Audit event browsing and governance findings are not available yet. Other sections are available now.",
    platform:
      "Credential management, external location editing, and sharing configuration are not available yet.",
    notFound:
      "Use the navigation on the left to get back to a section you can open.",
  },

  /** Error codes mapping (all 21 ErrorCode values) */
  errorCodes: {
    VALIDATION_FAILED: {
      title: "Validation failed",
      body: "Request body or query parameters failed validation.",
    },
    UNAUTHENTICATED: {
      title: "Sign-in required",
      body: "Sign-in is required through Databricks.",
    },
    IDENTITY_MISMATCH: {
      title: "Identity mismatch",
      body: "Token identity disagrees with forwarded identity headers.",
    },
    FORBIDDEN_ROLE: {
      title: "Forbidden role",
      body: "Your application role does not have permission for this action.",
    },
    FORBIDDEN_SCOPE: {
      title: "Forbidden scope",
      body: "This object is outside the managed scope of this application.",
    },
    MODE_READ_ONLY: {
      title: "Read-only mode",
      body: "This application is currently in read-only mode.",
    },
    INSUFFICIENT_PRIVILEGES: {
      title: "Insufficient privileges",
      body: "The execution identity lacks required Unity Catalog privileges.",
    },
    SOD_VIOLATION: {
      title: "Segregation of duties violation",
      body: "Requester cannot approve their own change, or beneficiary cannot approve.",
    },
    NOT_FOUND: {
      title: "Not found",
      body: "Not found or not visible to the application.",
    },
    PLAN_STALE: {
      title: "Plan stale",
      body: "Observed state changed since preview was generated.",
    },
    PLAN_EXPIRED: {
      title: "Plan expired",
      body: "Plan time-to-live has passed.",
    },
    PLAN_TAMPERED: {
      title: "Plan tampered",
      body: "Plan cryptographic signature verification failed.",
    },
    PLAN_INVALIDATED: {
      title: "Plan invalidated",
      body: "A newer preview has replaced this plan.",
    },
    DUPLICATE_SUBMISSION: {
      title: "Duplicate submission",
      body: "An operation for this plan is already running.",
    },
    RATE_LIMITED: {
      title: "Rate limited",
      body: "Databricks is rate-limiting requests. Try again in a moment.",
    },
    INTERNAL_ERROR: {
      title: "Internal error",
      body: "An unexpected error occurred.",
    },
    NOT_IMPLEMENTED: {
      title: "Not implemented",
      body: "Capability not built in this version.",
    },
    UNSUPPORTED: {
      title: "Unsupported",
      body: "No documented supported mechanism for this operation.",
    },
    NOT_CONFIGURED: {
      title: "Not configured",
      body: "Required backend service or warehouse is not configured.",
    },
    UPSTREAM_UNAVAILABLE: {
      title: "Upstream unavailable",
      body: "Upstream Databricks service is temporarily unavailable.",
    },
    OUTCOME_UNKNOWN: {
      title: "Outcome unknown",
      body: "Operation outcome unknown. Check current state.",
    },
  },
} as const;

export type Strings = typeof strings;
