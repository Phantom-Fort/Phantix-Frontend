/**
 * GraphQL endpoint placeholder for realtime dashboard data.
 *
 * Backend is implementing GraphQL subscriptions for live-updating
 * dashboards (campaign progress, scan job status, discovery jobs).
 *
 * --- PENDING ---
 * Endpoint:   {VITE_API_URL}/graphql
 * Schema:     introspection endpoint
 *
 * Example usage when ready:
 *
 *   import { request, gql } from 'graphql-request'
 *
 *   const CAMPAIGN_LIVE = gql`
 *     subscription OnCampaignProgress($orgId: ID!) {
 *       campaignProgress(orgId: $orgId) {
 *         id  status  currentPhase  currentStepIndex
 *         steps { name status outputSummary }
 *       }
 *     }
 *   `
 *
 *   // WebSocket link for subscriptions:
 *   // ws://{VITE_API_URL}/graphql
 *
 * Until the GraphQL endpoint is available, use REST polling
 * via the usePolling() hook in src/hooks/usePolling.ts
 */

export const GRAPHQL_ENDPOINT = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/graphql`

export const GRAPHQL_PENDING = true
