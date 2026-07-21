# Phantix API Endpoint Catalog

**Generated from live FastAPI app route table.** Total routes: **326**.

Base URL: `{API_BASE}` (e.g. `https://staging.phantix.site` or `http://localhost:8000`)
API prefix: `/api/v1`
OpenAPI: `GET /docs` · `GET /openapi.json` (if mounted) · runtime inventory: `GET /status`

## Surfaces

| Surface | Audience | Count |
|---------|----------|------:|
| `public` | see FE guides | 5 |
| `org_setup` | see FE guides | 14 |
| `platform` | see FE guides | 213 |
| `application` | see FE guides | 5 |
| `staff_admin` | see FE guides | 89 |

---

## Public

| Method | Path | Summary | Tags |
|--------|------|---------|------|
| `GET` | `/api/v1/status` | status_v1 | ops |
| `GET` | `/docs` | swagger_ui_html |  |
| `GET` | `/health` | Cheap liveness for load balancers / orchestrators. Does not probe dependencies. | ops |
| `GET` | `/redoc` | redoc_html |  |
| `GET` | `/status` | Full operational status: DB, Redis, migrations, tools, engines, routes. | ops |

## Org Setup

| Method | Path | Summary | Tags |
|--------|------|---------|------|
| `POST` | `/api/v1/organizations/login` | login_for_access_token | control-plane, organizations |
| `POST` | `/api/v1/organizations/login/mfa` | login_mfa_verify | control-plane, organizations |
| `GET` | `/api/v1/organizations/me/setup` | get_organization_setup | control-plane, organizations |
| `POST` | `/api/v1/organizations/me/setup/cac` | submit_cac_details | control-plane, organizations |
| `POST` | `/api/v1/organizations/me/setup/complete` | complete_organization_setup | control-plane, organizations |
| `POST` | `/api/v1/organizations/me/setup/identity` | update_setup_identity | control-plane, organizations |
| `POST` | `/api/v1/organizations/me/setup/otp/send` | send_setup_otp | control-plane, organizations |
| `POST` | `/api/v1/organizations/me/setup/otp/verify` | verify_setup_otp | control-plane, organizations |
| `POST` | `/api/v1/organizations/me/setup/privacy/accept` | accept_privacy_notice | control-plane, organizations |
| `POST` | `/api/v1/organizations/me/setup/verify/domain/check` | check_domain_verification | control-plane, organizations |
| `POST` | `/api/v1/organizations/me/setup/verify/domain/start` | start_domain_verification | control-plane, organizations |
| `POST` | `/api/v1/organizations/me/setup/verify/manual-review` | request_manual_company_review | control-plane, organizations |
| `GET` | `/api/v1/organizations/privacy` | public_privacy_notice | control-plane, organizations |
| `POST` | `/api/v1/organizations/register` | register_organization | control-plane, organizations |

## Platform

| Method | Path | Summary | Tags |
|--------|------|---------|------|
| `GET` | `/api/v1/ai/settings` | get_org_ai_settings | ai |
| `PUT` | `/api/v1/ai/settings` | update_org_ai_settings | ai |
| `GET` | `/api/v1/ai/usage` | get_org_ai_usage | ai |
| `GET` | `/api/v1/alerts/events` | list_alert_events | alert-engine, alerts |
| `POST` | `/api/v1/alerts/events/{event_id}/process` | process_one | alert-engine, alerts |
| `GET` | `/api/v1/alerts/settings` | get_alert_settings | alert-engine, alerts |
| `PUT` | `/api/v1/alerts/settings` | Configure **client** alert SMTP (separate from Phantix registration OTP SMTP). | alert-engine, alerts |
| `POST` | `/api/v1/alerts/test` | test_alert | alert-engine, alerts |
| `GET` | `/api/v1/asset-tags` | list_tags | asset-engine, asset-tags |
| `POST` | `/api/v1/asset-tags` | create_tag | asset-engine, asset-tags |
| `GET` | `/api/v1/asset-tags/assets/{asset_id}` | list_tags_for_asset | asset-engine, asset-tags |
| `POST` | `/api/v1/asset-tags/assets/{asset_id}/assign` | assign_tag | asset-engine, asset-tags |
| `DELETE` | `/api/v1/asset-tags/assets/{asset_id}/{tag_id}` | unassign_tag | asset-engine, asset-tags |
| `DELETE` | `/api/v1/asset-tags/{tag_id}` | delete_tag | asset-engine, asset-tags |
| `GET` | `/api/v1/assets` | list_assets | asset-engine, assets |
| `POST` | `/api/v1/assets` | create_asset | asset-engine, assets |
| `GET` | `/api/v1/assets/discovery/jobs` | list_discovery_jobs | asset-engine, assets |
| `POST` | `/api/v1/assets/discovery/jobs` | create_discovery_job | asset-engine, assets |
| `GET` | `/api/v1/assets/discovery/jobs/{job_id}` | get_discovery_job | asset-engine, assets |
| `POST` | `/api/v1/assets/discovery/jobs/{job_id}/run` | run_discovery_job | asset-engine, assets |
| `POST` | `/api/v1/assets/import/api` | import_api_spec | asset-engine, assets |
| `POST` | `/api/v1/assets/import/github` | import_github_repos | asset-engine, assets |
| `GET` | `/api/v1/assets/integrations/github` | list_github_integrations | asset-engine, assets |
| `POST` | `/api/v1/assets/integrations/github` | upsert_github_integration | asset-engine, assets |
| `POST` | `/api/v1/assets/upload/apk` | Accept an APK upload, store it on the platform, run static inventory analysis, | asset-engine, assets |
| `DELETE` | `/api/v1/assets/{asset_id}` | delete_asset | asset-engine, assets |
| `GET` | `/api/v1/assets/{asset_id}` | get_asset | asset-engine, assets |
| `PATCH` | `/api/v1/assets/{asset_id}` | update_asset | asset-engine, assets |
| `POST` | `/api/v1/assets/{asset_id}/apk/reanalyze` | reanalyze_apk_asset | asset-engine, assets |
| `POST` | `/api/v1/assets/{asset_id}/verify` | verify_asset | asset-engine, assets |
| `GET` | `/api/v1/audit/control-roles` | get_control_roles | audit-engine, audit |
| `PUT` | `/api/v1/audit/control-roles` | Assign dual-control by organization user ids (preferred). | audit-engine, audit |
| `GET` | `/api/v1/audit/events` | list_audit_events | audit-engine, audit |
| `POST` | `/api/v1/audit/events` | create_audit_event | audit-engine, audit |
| `GET` | `/api/v1/audit/events/{event_id}` | get_audit_event | audit-engine, audit |
| `GET` | `/api/v1/audit/export` | export_audit_trail | audit-engine, audit |
| `GET` | `/api/v1/audit/pending` | list_pending_actions | audit-engine, audit |
| `POST` | `/api/v1/audit/pending` | initiate_pending_action | audit-engine, audit |
| `POST` | `/api/v1/audit/pending/{pending_id}/authorize` | authorize_pending | audit-engine, audit |
| `POST` | `/api/v1/audit/pending/{pending_id}/reject` | reject_pending | audit-engine, audit |
| `GET` | `/api/v1/billing/payments` | list_my_payments | control-plane, billing |
| `GET` | `/api/v1/billing/payments/{payment_id}` | get_my_payment | control-plane, billing |
| `POST` | `/api/v1/billing/payments/{payment_id}/pay` | pay_invoice | control-plane, billing |
| `GET` | `/api/v1/billing/pricing` | Example: monthly ₦1,000 → first month ₦500 (50% off), then ₦1,000/month. | control-plane, billing |
| `POST` | `/api/v1/billing/subscribe` | subscribe | control-plane, billing |
| `GET` | `/api/v1/billing/subscription` | get_my_subscription | control-plane, billing |
| `POST` | `/api/v1/billing/subscription/cancel` | cancel_subscription | control-plane, billing |
| `POST` | `/api/v1/compliance/admin/seed` | reload_seeds | compliance-engine |
| `GET` | `/api/v1/compliance/assessments` | list_assessments_api | compliance-engine |
| `POST` | `/api/v1/compliance/assessments` | Run a merged assessment: questionnaire self-attestation + asset/scan posture. | compliance-engine |
| `GET` | `/api/v1/compliance/assessments/{assessment_id}/results` | get_assessment_results | compliance-engine |
| `GET` | `/api/v1/compliance/connectors` | list_evidence_connectors | compliance-engine |
| `PUT` | `/api/v1/compliance/connectors/{connector_id}/config` | put_connector_config | compliance-engine |
| `GET` | `/api/v1/compliance/evidence` | list_evidence_api | compliance-engine |
| `POST` | `/api/v1/compliance/evidence` | create_evidence | compliance-engine |
| `POST` | `/api/v1/compliance/evidence/collect` | collect_evidence | compliance-engine |
| `GET` | `/api/v1/compliance/evidence/summary` | evidence_summary_api | compliance-engine |
| `DELETE` | `/api/v1/compliance/evidence/{evidence_id}` | delete_evidence_api | compliance-engine |
| `GET` | `/api/v1/compliance/frameworks` | list_frameworks_api | compliance-engine |
| `GET` | `/api/v1/compliance/frameworks/{framework_id}` | get_framework_api | compliance-engine |
| `GET` | `/api/v1/compliance/gaps` | gap_analysis | compliance-engine |
| `POST` | `/api/v1/compliance/map` | map_findings_api | compliance-engine |
| `GET` | `/api/v1/compliance/profile` | get_profile | compliance-engine |
| `PUT` | `/api/v1/compliance/profile` | put_profile | compliance-engine |
| `GET` | `/api/v1/compliance/questionnaire/answers` | list_questionnaire_answers_audit | compliance-engine |
| `PUT` | `/api/v1/compliance/questionnaire/answers` | submit_questionnaire_answer | compliance-engine |
| `GET` | `/api/v1/compliance/questionnaire/progress` | questionnaire_progress | compliance-engine |
| `GET` | `/api/v1/compliance/questionnaire/questions` | list_questionnaire_questions | compliance-engine |
| `POST` | `/api/v1/compliance/questionnaire/rebuild` | rebuild_questionnaire | compliance-engine |
| `POST` | `/api/v1/compliance/questionnaire/session` | start_questionnaire_session | compliance-engine |
| `GET` | `/api/v1/compliance/recommendations` | framework_recommendations | compliance-engine |
| `GET` | `/api/v1/compliance/status` | compliance_status | compliance-engine |
| `GET` | `/api/v1/db-connections` | list_db_connections | control-plane, customer-db-connections |
| `POST` | `/api/v1/db-connections` | create_db_connection | control-plane, customer-db-connections |
| `GET` | `/api/v1/db-connections/connection-option-hints` | Document that connections need more than username/password. | control-plane, customer-db-connections |
| `GET` | `/api/v1/db-connections/drivers` | Show which DB engines have live-probe drivers installed vs optional. | control-plane, customer-db-connections |
| `GET` | `/api/v1/db-connections/primary-security-storage` | get_primary_security_storage | control-plane, customer-db-connections |
| `POST` | `/api/v1/db-connections/provision` | Placeholder for optional Phantix-hosted dedicated security DB. | control-plane, customer-db-connections |
| `DELETE` | `/api/v1/db-connections/{connection_id}` | delete_db_connection | control-plane, customer-db-connections |
| `GET` | `/api/v1/db-connections/{connection_id}` | get_db_connection | control-plane, customer-db-connections |
| `PUT` | `/api/v1/db-connections/{connection_id}` | update_db_connection | control-plane, customer-db-connections |
| `POST` | `/api/v1/db-connections/{connection_id}/bootstrap` | bootstrap_connection_schema | control-plane, customer-db-connections |
| `GET` | `/api/v1/db-connections/{connection_id}/status` | get_connection_status | control-plane, customer-db-connections |
| `POST` | `/api/v1/db-connections/{connection_id}/test` | test_db_connection | control-plane, customer-db-connections |
| `GET` | `/api/v1/engines` | list_all_engines | engines |
| `GET` | `/api/v1/engines/_meta/summary` | engines_summary | engines |
| `GET` | `/api/v1/engines/ai/status` | AI Engine Phase 1–2: governance foundation + core agents. | ai-engine |
| `POST` | `/api/v1/engines/compliance/admin/seed` | reload_seeds | compliance-engine |
| `GET` | `/api/v1/engines/compliance/assessments` | list_assessments_api | compliance-engine |
| `POST` | `/api/v1/engines/compliance/assessments` | Run a merged assessment: questionnaire self-attestation + asset/scan posture. | compliance-engine |
| `GET` | `/api/v1/engines/compliance/assessments/{assessment_id}/results` | get_assessment_results | compliance-engine |
| `GET` | `/api/v1/engines/compliance/connectors` | list_evidence_connectors | compliance-engine |
| `PUT` | `/api/v1/engines/compliance/connectors/{connector_id}/config` | put_connector_config | compliance-engine |
| `GET` | `/api/v1/engines/compliance/evidence` | list_evidence_api | compliance-engine |
| `POST` | `/api/v1/engines/compliance/evidence` | create_evidence | compliance-engine |
| `POST` | `/api/v1/engines/compliance/evidence/collect` | collect_evidence | compliance-engine |
| `GET` | `/api/v1/engines/compliance/evidence/summary` | evidence_summary_api | compliance-engine |
| `DELETE` | `/api/v1/engines/compliance/evidence/{evidence_id}` | delete_evidence_api | compliance-engine |
| `GET` | `/api/v1/engines/compliance/frameworks` | list_frameworks_api | compliance-engine |
| `GET` | `/api/v1/engines/compliance/frameworks/{framework_id}` | get_framework_api | compliance-engine |
| `GET` | `/api/v1/engines/compliance/gaps` | gap_analysis | compliance-engine |
| `POST` | `/api/v1/engines/compliance/map` | map_findings_api | compliance-engine |
| `GET` | `/api/v1/engines/compliance/profile` | get_profile | compliance-engine |
| `PUT` | `/api/v1/engines/compliance/profile` | put_profile | compliance-engine |
| `GET` | `/api/v1/engines/compliance/questionnaire/answers` | list_questionnaire_answers_audit | compliance-engine |
| `PUT` | `/api/v1/engines/compliance/questionnaire/answers` | submit_questionnaire_answer | compliance-engine |
| `GET` | `/api/v1/engines/compliance/questionnaire/progress` | questionnaire_progress | compliance-engine |
| `GET` | `/api/v1/engines/compliance/questionnaire/questions` | list_questionnaire_questions | compliance-engine |
| `POST` | `/api/v1/engines/compliance/questionnaire/rebuild` | rebuild_questionnaire | compliance-engine |
| `POST` | `/api/v1/engines/compliance/questionnaire/session` | start_questionnaire_session | compliance-engine |
| `GET` | `/api/v1/engines/compliance/recommendations` | framework_recommendations | compliance-engine |
| `GET` | `/api/v1/engines/compliance/status` | compliance_status | compliance-engine |
| `GET` | `/api/v1/engines/reporting/status` | reporting_engine_status | reporting-engine |
| `GET` | `/api/v1/engines/{engine_id}` | get_one_engine | engines |
| `GET` | `/api/v1/logs` | org_list_logs | operations-engine, org-logs |
| `POST` | `/api/v1/logs` | org_create_log | operations-engine, org-logs |
| `GET` | `/api/v1/logs/issues/{issue_id}` | org_issue_timeline | operations-engine, org-logs |
| `GET` | `/api/v1/openapi.json` | openapi |  |
| `GET` | `/api/v1/org-users` | list_org_users | control-plane, organization-users |
| `POST` | `/api/v1/org-users` | Create user. Bootstrap (pre dual-control) via company JWT; else initiator/authorizer session. | control-plane, organization-users |
| `POST` | `/api/v1/org-users/auth/login` | Passwordless login for any registered organization user. | control-plane, organization-users |
| `POST` | `/api/v1/org-users/auth/login/device` | Second factor when signing in from a new browser/device with an active session. | control-plane, organization-users |
| `POST` | `/api/v1/org-users/auth/login/mfa` | Verify the domain-email OTP. | control-plane, organization-users |
| `POST` | `/api/v1/org-users/auth/logout` | org_user_dual_control_logout | control-plane, organization-users |
| `GET` | `/api/v1/org-users/auth/me` | org_user_session_me | control-plane, organization-users |
| `GET` | `/api/v1/org-users/dual-control` | get_dual_control_assignment | control-plane, organization-users |
| `PUT` | `/api/v1/org-users/dual-control` | Example: | control-plane, organization-users |
| `GET` | `/api/v1/org-users/me/permissions` | my_permissions | control-plane, organization-users |
| `GET` | `/api/v1/org-users/roles` | list_rbac_roles | control-plane, organization-users |
| `DELETE` | `/api/v1/org-users/{user_id}` | deactivate_org_user | control-plane, organization-users |
| `GET` | `/api/v1/org-users/{user_id}` | get_org_user | control-plane, organization-users |
| `PATCH` | `/api/v1/org-users/{user_id}` | patch_org_user | control-plane, organization-users |
| `GET` | `/api/v1/organizations/companies/{company_id}/service-key` | get_company_service_key | control-plane, platform-service-keys |
| `POST` | `/api/v1/organizations/companies/{company_id}/service-key` | rotate_company_service_key | control-plane, platform-service-keys |
| `GET` | `/api/v1/organizations/me` | read_current_organization | control-plane, organizations |
| `PUT` | `/api/v1/organizations/me` | update_current_organization | control-plane, organizations |
| `GET` | `/api/v1/organizations/me/companies` | list_companies | control-plane, platform-service-keys |
| `POST` | `/api/v1/organizations/me/companies` | create_company | control-plane, platform-service-keys |
| `GET` | `/api/v1/organizations/me/experience` | get_my_experience | control-plane, organizations |
| `GET` | `/api/v1/organizations/me/identity` | get_platform_identity | control-plane, platform-service-keys |
| `GET` | `/api/v1/organizations/me/login-links` | list_login_links | control-plane, platform-service-keys |
| `DELETE` | `/api/v1/organizations/me/logo` | delete_organization_logo | control-plane, organizations |
| `POST` | `/api/v1/organizations/me/logo` | Store company logo used on report cover pages and footers. | control-plane, organizations |
| `PUT` | `/api/v1/organizations/me/preferred-services` | Change which services shape this org's product experience. | control-plane, organizations |
| `GET` | `/api/v1/organizations/me/service-key` | get_my_service_key | control-plane, platform-service-keys |
| `POST` | `/api/v1/organizations/me/service-key` | create_or_rotate_my_service_key | control-plane, platform-service-keys |
| `DELETE` | `/api/v1/organizations/me/service-key/{key_id}` | revoke_my_service_key | control-plane, platform-service-keys |
| `GET` | `/api/v1/organizations/me/service-keys` | list_my_service_keys | control-plane, platform-service-keys |
| `DELETE` | `/api/v1/organizations/me/users/{user_id}/device` | clear_user_device | control-plane, platform-service-keys |
| `POST` | `/api/v1/organizations/me/users/{user_id}/login-link` | create_login_link | control-plane, platform-service-keys |
| `GET` | `/api/v1/organizations/services-catalog` | Catalog from admin-editable experience configs (what preferred_services unlock). | control-plane, organizations |
| `GET` | `/api/v1/reports` | list_reports | reporting-engine, reports |
| `POST` | `/api/v1/reports` | create_report | reporting-engine, reports |
| `POST` | `/api/v1/reports/export` | ad_hoc_export | reporting-engine, reports |
| `GET` | `/api/v1/reports/tracker` | list_tracker | reporting-engine, reports |
| `PATCH` | `/api/v1/reports/tracker/{finding_key}` | patch_tracker | reporting-engine, reports |
| `GET` | `/api/v1/reports/{report_id}` | get_report | reporting-engine, reports |
| `GET` | `/api/v1/reports/{report_id}/download` | download_report | reporting-engine, reports |
| `GET` | `/api/v1/risks` | list_risks | risk-engine, risks |
| `GET` | `/api/v1/risks/export` | export_risks | risk-engine, risks |
| `GET` | `/api/v1/risks/prioritized` | list_prioritized_risks | risk-engine, risks |
| `POST` | `/api/v1/risks/treatments/{treatment_id}/approve` | approve_treatment | risk-engine, risks |
| `POST` | `/api/v1/risks/treatments/{treatment_id}/complete` | complete_treatment | risk-engine, risks |
| `POST` | `/api/v1/risks/treatments/{treatment_id}/reject` | reject_treatment | risk-engine, risks |
| `POST` | `/api/v1/risks/treatments/{treatment_id}/submit` | submit_treatment | risk-engine, risks |
| `GET` | `/api/v1/risks/{risk_id}` | get_risk | risk-engine, risks |
| `PATCH` | `/api/v1/risks/{risk_id}` | patch_risk | risk-engine, risks |
| `GET` | `/api/v1/risks/{risk_id}/assessments` | list_assessments | risk-engine, risks |
| `GET` | `/api/v1/risks/{risk_id}/history` | risk_history | risk-engine, risks |
| `GET` | `/api/v1/risks/{risk_id}/treatments` | list_treatments | risk-engine, risks |
| `POST` | `/api/v1/risks/{risk_id}/treatments` | create_treatment | risk-engine, risks |
| `GET` | `/api/v1/scans/jobs` | list_jobs | scanner-engine, scans |
| `POST` | `/api/v1/scans/jobs` | create_scan_job | scanner-engine, scans |
| `GET` | `/api/v1/scans/jobs/active` | get_active_job | scanner-engine, scans |
| `GET` | `/api/v1/scans/jobs/{job_id}` | get_job | scanner-engine, scans |
| `POST` | `/api/v1/scans/jobs/{job_id}/cancel` | Cancel an active scan job for this organization. | scanner-engine, scans |
| `POST` | `/api/v1/scans/jobs/{job_id}/run` | run_job | scanner-engine, scans |
| `GET` | `/api/v1/scans/results` | list_results | scanner-engine, scans |
| `GET` | `/api/v1/scans/yaml/catalog` | Catalog of Nettacker-style YAML checks auto-discovered from scans/. | scanner-engine, scans |
| `GET` | `/api/v1/search` | Search Elasticsearch indices for this organization only. | operations-engine, search |
| `GET` | `/api/v1/search/status` | search_status | operations-engine, search |
| `GET` | `/api/v1/support/tickets` | list_my_tickets | control-plane, support-customer |
| `POST` | `/api/v1/support/tickets` | submit_ticket | control-plane, support-customer |
| `GET` | `/api/v1/support/tickets/{ticket_id}` | get_my_ticket | control-plane, support-customer |
| `POST` | `/api/v1/support/tickets/{ticket_id}/messages` | reply_my_ticket | control-plane, support-customer |
| `GET` | `/api/v1/tools/catalog` | org_tool_catalog | control-plane, tools-client |
| `GET` | `/api/v1/tools/my-tools` | my_tools | control-plane, tools-client |
| `POST` | `/api/v1/tools/request` | request_tool | control-plane, tools-client |
| `POST` | `/api/v1/tools/subscribe` | Paid tooling subscription (separate from platform membership). | control-plane, tools-client |
| `GET` | `/api/v1/tools/subscriptions` | my_tool_subscriptions | control-plane, tools-client |
| `POST` | `/api/v1/vapt/approvals/{request_id}/decide` | Only assigned initiator/authorizer with authenticator session may decide. | vapt-engine, vapt |
| `GET` | `/api/v1/vapt/campaigns` | list_campaigns | vapt-engine, vapt |
| `POST` | `/api/v1/vapt/campaigns` | create_campaign | vapt-engine, vapt |
| `GET` | `/api/v1/vapt/campaigns/{campaign_id}` | get_campaign | vapt-engine, vapt |
| `GET` | `/api/v1/vapt/campaigns/{campaign_id}/approvals` | list_campaign_approvals | vapt-engine, vapt |
| `POST` | `/api/v1/vapt/campaigns/{campaign_id}/cancel` | cancel_campaign | vapt-engine, vapt |
| `GET` | `/api/v1/vapt/campaigns/{campaign_id}/findings` | list_findings | vapt-engine, vapt |
| `POST` | `/api/v1/vapt/campaigns/{campaign_id}/pause` | pause_campaign | vapt-engine, vapt |
| `POST` | `/api/v1/vapt/campaigns/{campaign_id}/resume` | resume_campaign | vapt-engine, vapt |
| `POST` | `/api/v1/vapt/campaigns/{campaign_id}/start` | start_campaign | vapt-engine, vapt |
| `GET` | `/api/v1/vapt/correlation-rules` | list_rules | vapt-engine, vapt |
| `GET` | `/api/v1/vapt/mining/candidates` | list_mined_candidates | vapt-engine, vapt |
| `POST` | `/api/v1/vapt/plan` | Analyze org profile + asset inventory and return a recommended campaign plan. | vapt-engine, vapt-orchestrator |
| `POST` | `/api/v1/vapt/plan/execute` | execute_plan_endpoint | vapt-engine, vapt-orchestrator |
| `GET` | `/api/v1/vapt/plan/{plan_id}` | get_plan | vapt-engine, vapt-orchestrator |
| `GET` | `/api/v1/vapt/procedures` | list_procedures | vapt-engine, vapt |
| `GET` | `/api/v1/vapt/procedures/{procedure_key}` | get_procedure | vapt-engine, vapt |
| `GET` | `/api/v1/vapt/schedules` | list_org_schedules | vapt-engine, vapt |
| `POST` | `/api/v1/vapt/schedules` | create_org_schedule | vapt-engine, vapt |
| `POST` | `/api/v1/vapt/schedules/{schedule_id}/blackout` | add_blackout | vapt-engine, vapt |
| `GET` | `/api/v1/vapt/settings` | get_settings | vapt-engine, vapt |
| `PUT` | `/api/v1/vapt/settings` | put_settings | vapt-engine, vapt |
| `GET` | `/docs/oauth2-redirect` | swagger_ui_redirect |  |

## Application

| Method | Path | Summary | Tags |
|--------|------|---------|------|
| `POST` | `/api/v1/app/auth/challenge` | app_login_challenge | control-plane, application-access |
| `GET` | `/api/v1/app/auth/me` | Validate dual tokens and return tenant-safe identity. | control-plane, application-access |
| `POST` | `/api/v1/app/auth/mfa` | app_login_mfa | control-plane, application-access |
| `POST` | `/api/v1/app/auth/password` | app_login_password | control-plane, application-access |
| `POST` | `/api/v1/app/auth/resolve-key` | Validate pk_live_* service key; return company id/slug (no secrets). | control-plane, application-access |

## Staff Admin

| Method | Path | Summary | Tags |
|--------|------|---------|------|
| `POST` | `/api/v1/admin/ai/activate` | Seed prompts + enable DeepSeek on all org AI settings when key is present. | admin-ai |
| `GET` | `/api/v1/admin/ai/audit-logs` | admin_audit_logs | admin-ai |
| `POST` | `/api/v1/admin/ai/consensus/test` | Dry-run coordinator against provided evidence (uses mock/real providers). | admin-ai |
| `GET` | `/api/v1/admin/ai/costs` | admin_costs | admin-ai |
| `GET` | `/api/v1/admin/ai/data-scopes` | Platform catalog of max evidence fields the AI may receive (cannot exceed). | admin-ai |
| `PUT` | `/api/v1/admin/ai/data-scopes/{prompt_key}` | Set data allowlist for a prompt (new version; cannot exceed catalog). | admin-ai |
| `GET` | `/api/v1/admin/ai/prompts` | admin_list_prompts | admin-ai |
| `POST` | `/api/v1/admin/ai/prompts` | Create a new prompt version (optionally activate as default). | admin-ai |
| `GET` | `/api/v1/admin/ai/prompts/{prompt_key}` | admin_get_prompt | admin-ai |
| `PATCH` | `/api/v1/admin/ai/prompts/{prompt_key}` | Modify the active prompt by creating a new version (immutable history). | admin-ai |
| `POST` | `/api/v1/admin/ai/prompts/{prompt_key}/activate` | Set an existing version as the default active prompt. | admin-ai |
| `GET` | `/api/v1/admin/ai/settings` | admin_global_ai_info | admin-ai |
| `GET` | `/api/v1/admin/billing/pricing-preview` | pricing_preview | control-plane, admin-billing |
| `POST` | `/api/v1/admin/billing/run-renewals` | Cron-friendly: creates pending renewal payments when period ends. | control-plane, admin-billing |
| `GET` | `/api/v1/admin/billing/settings` | get_billing_settings | control-plane, admin-billing |
| `PUT` | `/api/v1/admin/billing/settings` | Set monthly list price in Naira. Yearly is auto-calculated as | control-plane, admin-billing |
| `GET` | `/api/v1/admin/bus/events` | list_event_catalog | engine-bus, engine-bus |
| `GET` | `/api/v1/admin/clients` | list_clients | control-plane, admin-clients |
| `GET` | `/api/v1/admin/clients/{client_id}` | get_client | control-plane, admin-clients |
| `PATCH` | `/api/v1/admin/clients/{client_id}` | patch_client | control-plane, admin-clients |
| `GET` | `/api/v1/admin/clients/{client_id}/connections` | client_connections | control-plane, admin-clients |
| `GET` | `/api/v1/admin/clients/{client_id}/experience` | client_experience | control-plane, admin-clients |
| `POST` | `/api/v1/admin/clients/{client_id}/verification/manual-review` | Staff resolves pending manual company verification for an organization. | control-plane, admin-clients |
| `GET` | `/api/v1/admin/compliance/frameworks` | Platform catalog for the admin portal. Includes seed + admin-uploaded frameworks. | control-plane, admin-compliance |
| `POST` | `/api/v1/admin/compliance/frameworks` | Add a new framework to the **global** catalog (or update an existing one). | control-plane, admin-compliance |
| `POST` | `/api/v1/admin/compliance/frameworks/upload` | Multipart upload of the same JSON schema used by seed files. | control-plane, admin-compliance |
| `GET` | `/api/v1/admin/compliance/frameworks/{framework_id}` | admin_get_framework | control-plane, admin-compliance |
| `PATCH` | `/api/v1/admin/compliance/frameworks/{framework_id}` | admin_set_framework_active | control-plane, admin-compliance |
| `GET` | `/api/v1/admin/compliance/frameworks/{framework_id}/questions` | admin_list_questions_for_framework | control-plane, admin-compliance |
| `GET` | `/api/v1/admin/compliance/questionnaire/questions` | admin_list_questionnaire_questions | control-plane, admin-compliance |
| `POST` | `/api/v1/admin/compliance/questionnaire/questions` | Create a question curated by a GRC expert. Linked to one or more frameworks. | control-plane, admin-compliance |
| `DELETE` | `/api/v1/admin/compliance/questionnaire/questions/{question_id}` | admin_deactivate_questionnaire_question | control-plane, admin-compliance |
| `GET` | `/api/v1/admin/compliance/questionnaire/questions/{question_id}` | admin_get_questionnaire_question | control-plane, admin-compliance |
| `PATCH` | `/api/v1/admin/compliance/questionnaire/questions/{question_id}` | Edit prompt, frameworks, help text, etc. Marks the question as expert-managed. | control-plane, admin-compliance |
| `POST` | `/api/v1/admin/compliance/questionnaire/rebuild` | admin_rebuild_questionnaire | control-plane, admin-compliance |
| `POST` | `/api/v1/admin/compliance/seed` | Re-import ``seed/frameworks/*.json`` into the platform DB. Does not delete admin uploads. | control-plane, admin-compliance |
| `GET` | `/api/v1/admin/dashboard/stats` | admin_dashboard_stats | control-plane, admin-clients |
| `POST` | `/api/v1/admin/discovery/nmap/preview` | preview_nmap_command | control-plane, admin-discovery |
| `GET` | `/api/v1/admin/discovery/settings` | get_discovery_settings | control-plane, admin-discovery |
| `PUT` | `/api/v1/admin/discovery/settings` | Configure the real Nmap binary and **admin-specified scanning flags**. | control-plane, admin-discovery |
| `GET` | `/api/v1/admin/experience-services` | list_experience_services | control-plane, admin-experience |
| `POST` | `/api/v1/admin/experience-services` | create_experience_service | control-plane, admin-experience |
| `POST` | `/api/v1/admin/experience-services/seed` | Populate DB from code defaults once. After that, edit via admin API only. | control-plane, admin-experience |
| `DELETE` | `/api/v1/admin/experience-services/{service_key}` | delete_experience_service | control-plane, admin-experience |
| `GET` | `/api/v1/admin/experience-services/{service_key}` | get_experience_service | control-plane, admin-experience |
| `PATCH` | `/api/v1/admin/experience-services/{service_key}` | patch_experience_service | control-plane, admin-experience |
| `PUT` | `/api/v1/admin/experience-services/{service_key}` | Update modules, nav, widgets, onboarding for a service without code deploy. | control-plane, admin-experience |
| `GET` | `/api/v1/admin/logs` | staff_list_logs | operations-engine, developer-logs |
| `POST` | `/api/v1/admin/logs` | staff_create_log | operations-engine, developer-logs |
| `GET` | `/api/v1/admin/logs/issues/{issue_id}` | staff_issue_timeline | operations-engine, developer-logs |
| `GET` | `/api/v1/admin/scanner-tools` | list_scanner_tools | admin-scanner, scanner-engine |
| `POST` | `/api/v1/admin/scanner-tools/update` | update_scanner_tools | admin-scanner, scanner-engine |
| `POST` | `/api/v1/admin/scanner-tools/wordlists/ensure` | ensure_wordlists | admin-scanner, scanner-engine |
| `POST` | `/api/v1/admin/server/optimize` | Apply safe in-process optimisations: | operations-engine, admin-server |
| `GET` | `/api/v1/admin/server/overview` | Full operational picture of this API process and related workers: | operations-engine, admin-server |
| `GET` | `/api/v1/admin/server/processes` | server_processes | operations-engine, admin-server |
| `GET` | `/api/v1/admin/server/recommendations` | server_recommendations | operations-engine, admin-server |
| `GET` | `/api/v1/admin/server/resources` | server_resources | operations-engine, admin-server |
| `GET` | `/api/v1/admin/server/runtime` | server_runtime | operations-engine, admin-server |
| `GET` | `/api/v1/admin/support/tickets` | admin_list_tickets | control-plane, admin-support |
| `GET` | `/api/v1/admin/support/tickets/{ticket_id}` | admin_get_ticket | control-plane, admin-support |
| `PATCH` | `/api/v1/admin/support/tickets/{ticket_id}` | admin_update_ticket | control-plane, admin-support |
| `POST` | `/api/v1/admin/support/tickets/{ticket_id}/messages` | admin_reply_ticket | control-plane, admin-support |
| `GET` | `/api/v1/admin/tooling/provisions` | admin_list_provisions | control-plane, admin-tooling |
| `POST` | `/api/v1/admin/tooling/provisions` | admin_create_provision | control-plane, admin-tooling |
| `PATCH` | `/api/v1/admin/tooling/provisions/{provision_id}` | admin_patch_provision | control-plane, admin-tooling |
| `GET` | `/api/v1/admin/tooling/stats` | tooling_stats | control-plane, admin-tooling |
| `GET` | `/api/v1/admin/tooling/tools` | admin_list_tools | control-plane, admin-tooling |
| `POST` | `/api/v1/admin/tooling/tools` | admin_create_tool | control-plane, admin-tooling |
| `POST` | `/api/v1/admin/tooling/tools/seed` | admin_seed_tools | control-plane, admin-tooling |
| `DELETE` | `/api/v1/admin/tooling/tools/{tool_id}` | admin_delete_tool | control-plane, admin-tooling |
| `GET` | `/api/v1/admin/tooling/tools/{tool_id}` | admin_get_tool | control-plane, admin-tooling |
| `PATCH` | `/api/v1/admin/tooling/tools/{tool_id}` | admin_patch_tool | control-plane, admin-tooling |
| `POST` | `/api/v1/admin/vapt/correlation-rules` | admin_upsert_rule | vapt-engine, admin-vapt |
| `GET` | `/api/v1/admin/vapt/correlation-rules/builtin` | admin_list_builtin_rules | vapt-engine, admin-vapt |
| `POST` | `/api/v1/admin/vapt/procedures` | admin_upsert_procedure | vapt-engine, admin-vapt |
| `GET` | `/api/v1/admin/vapt/schedules` | admin_list_schedules | vapt-engine, admin-vapt |
| `POST` | `/api/v1/admin/vapt/schedules` | admin_create_schedule | vapt-engine, admin-vapt |
| `DELETE` | `/api/v1/admin/vapt/schedules/{schedule_id}` | admin_delete_schedule | vapt-engine, admin-vapt |
| `GET` | `/api/v1/admin/vapt/schedules/{schedule_id}` | admin_get_schedule | vapt-engine, admin-vapt |
| `PATCH` | `/api/v1/admin/vapt/schedules/{schedule_id}` | admin_patch_schedule | vapt-engine, admin-vapt |
| `POST` | `/api/v1/admin/vapt/schedules/{schedule_id}/pause-until` | admin_pause_until | vapt-engine, admin-vapt |
| `POST` | `/api/v1/admin/vapt/schedules/{schedule_id}/run-now` | admin_run_now | vapt-engine, admin-vapt |
| `POST` | `/api/v1/admin/vapt/schedules/{schedule_id}/skip-next` | admin_skip_next | vapt-engine, admin-vapt |
| `GET` | `/api/v1/staff` | list_staff | control-plane, staff-auth |
| `POST` | `/api/v1/staff` | create_staff_user | control-plane, staff-auth |
| `POST` | `/api/v1/staff/login` | staff_login | control-plane, staff-auth |
| `GET` | `/api/v1/staff/me` | staff_me | control-plane, staff-auth |
| `PATCH` | `/api/v1/staff/{staff_id}` | update_staff_user | control-plane, staff-auth |
