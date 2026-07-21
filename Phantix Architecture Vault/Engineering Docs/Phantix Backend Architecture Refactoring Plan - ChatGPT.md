> Version: 1.0
> Status: Approved for Development
> Audience: Backend Engineers, Infrastructure Engineers, AI Engineers, Security Engineers
> Last Updated: July 2026

---

# Purpose

As Phantix grows beyond an MVP into a full cybersecurity platform, the current backend architecture must evolve.

The existing implementation is already feature-rich and well designed from a security perspective. However, it has reached the point where business capabilities are beginning to overlap.

This document defines the architectural boundaries that all future development must follow.

---

# Vision

Phantix is **not** being built as a traditional web application.

Phantix is being built as a **Cybersecurity Operating System**.

Like an operating system, the platform consists of independent engines that communicate through well-defined contracts rather than direct implementation dependencies.

Every new feature developed after this document **must belong to an Engine.**

---

# Development Philosophy

## We are NOT building Microservices.

We are building a **Modular Monolith**.

The application will remain:

- One FastAPI application
- One Docker deployment
- One PostgreSQL platform database
- One Redis instance
- One Celery cluster
- One code repository

Internally, however, every business capability must behave as though it could become its own microservice in the future.

---

# Architectural Layers

```
                    Users
                      │
                      ▼
             Presentation Layer
                      │
                      ▼
                 API Gateway
                      │
                      ▼
                Control Plane
                      │
                      ▼
                 Engine Bus
                      │
      ┌───────────────┼────────────────┐
      ▼               ▼                ▼
 Asset Engine   Scanner Engine   Risk Engine
      │               │                │
      ▼               ▼                ▼
 AI Engine     Compliance Engine  Report Engine
      │
      ▼
 Alert Engine
      │
      ▼
 Infrastructure
```

No Engine should directly call another Engine.

All communication must occur through Events or Engine Contracts.

---

# Engine Registry

The following Engines are officially part of the platform.

| Engine | Responsibility |
|---------|---------------|
| Control Plane | Platform management |
| Asset Engine | Asset inventory and discovery |
| Scanner Engine | Scan orchestration |
| Risk Engine | Risk analysis |
| AI Engine | AI analysis |
| Compliance Engine | Compliance frameworks |
| Reporting Engine | Report generation |
| Alert Engine | Notifications |
| Audit Engine | Audit trail |
| Operations Engine | Platform monitoring |

---

# Control Plane

The Control Plane is the administrative brain of Phantix.

It owns:

- Authentication
- Authorization
- JWT
- Organizations
- Organization Users
- Billing
- Licensing
- Notifications
- API Keys
- Customer Setup
- Experience Configuration
- Staff Portal
- Support

The Control Plane **must never**:

- Execute scans
- Calculate risk
- Generate AI reports
- Produce compliance reports
- Store scan findings

It only coordinates.

---

# Asset Engine

The Asset Engine owns every asset discovered by the platform.

Responsibilities:

- Asset CRUD
- Asset Discovery
- Asset Classification
- Asset Relationships
- Asset Tags
- Ownership
- Criticality
- Metadata
- GitHub Integration
- APK Upload
- API Imports
- Domain Inventory
- IP Inventory
- Asset Timeline

This Engine is the single source of truth for assets.

No other Engine may modify Asset records directly.

---

# Scanner Engine

The Scanner Engine is responsible for executing security assessments.

Responsibilities:

- Scan Scheduling
- Scan Queue
- Tool Registry
- Tool Adapters
- Scan Policies
- Scan Workers
- Scan History
- Result Normalization
- Retry Logic
- Resource Limits

Supported tools include:

- Nmap
- Nuclei
- OpenVAS
- Naabu
- Httpx
- Subfinder
- WhatWeb
- Future scanners

The Scanner Engine MUST NOT:

- Generate Reports
- Calculate Risk
- Send Email
- Call AI
- Calculate Compliance

It only scans.

---

# Risk Engine

The Risk Engine converts findings into business risk.

Responsibilities:

- Risk Assessment
- Risk Scoring
- Prioritization
- Treatment Plans
- Approval Workflow
- Residual Risk
- Risk Timeline
- Risk Analytics
- Business Impact
- Risk History

The Risk Engine consumes Scan Findings.

It never invokes scanners directly.

---

# AI Engine

The AI Engine provides intelligent analysis.

Responsibilities:

- Finding Explanation
- Root Cause Analysis
- Remediation
- Attack Path Generation
- Executive Summaries
- Technical Summaries
- Natural Language Search
- RAG
- Prompt Templates
- Threat Intelligence Correlation

The AI Engine runs entirely as background workers.

API requests must never wait for AI completion.

---

# Compliance Engine

The Compliance Engine maps security findings to frameworks.

Supported frameworks include:

- ISO 27001
- ISO 27701
- SOC 2
- PCI DSS
- CIS Controls
- NIST CSF
- NDPR
- Future standards

Responsibilities:

- Control Mapping
- Evidence Collection
- Compliance Status
- Framework Reports
- Gap Analysis
- Policy Mapping

---

# Reporting Engine

The Reporting Engine generates customer deliverables.

Responsibilities:

- Executive Reports
- Technical Reports
- Board Reports
- Compliance Reports
- Audit Reports
- Scheduled Reports
- PDF
- CSV
- JSON
- White Label Reports

This Engine never performs scanning.

---

# Alert Engine

Responsible for all notifications.

Responsibilities:

- Email
- Telegram
- WhatsApp
- Slack
- Microsoft Teams
- Severity Routing
- Retry Queue
- Delivery Tracking
- Notification Templates

Alert rules belong here.

---

# Audit Engine

Responsible for platform accountability.

Responsibilities:

- Immutable Audit Logs
- Approval Records
- Security Events
- Authentication Events
- Administrative Actions
- Export

Nothing outside this Engine writes audit records directly.

---

# Operations Engine

The Operations Engine is internal-only.

Accessible only by Phantix Staff.

Responsibilities:

- Process Monitoring
- Queue Monitoring
- Worker Health
- Database Health
- Redis Health
- Celery Health
- Container Health
- Memory Usage
- Garbage Collection
- Diagnostics

This Engine should eventually become a completely separate deployment.

---

# Infrastructure Layer

Infrastructure provides platform capabilities only.

Contains:

- PostgreSQL
- Redis
- Celery
- Docker
- Object Storage
- Encryption
- Secrets
- Monitoring
- Logging
- Metrics

Infrastructure contains **zero business logic.**

---

# Engine Folder Standard

Every Engine follows the exact same structure.

```
engine_name/

    api/

    services/

    repositories/

    models/

    schemas/

    workers/

    tasks/

    adapters/

    interfaces/

    validators/

    events/

    cache/

    tests/

    docs/
```

No exceptions.

---

# Communication Rules

Engines communicate through Events.

Example:

```
AssetCreated

↓

ScanRequested

↓

ScanCompleted

↓

FindingCreated

↓

RiskCalculated

↓

ComplianceUpdated

↓

AIAnalysisRequested

↓

ReportGenerated

↓

AlertQueued

↓

AuditRecorded
```

Avoid direct Engine-to-Engine method calls.

---

# Event Contracts

All events should be strongly typed.

Examples:

```
AssetCreated

AssetUpdated

ScanRequested

ScanQueued

ScanStarted

ScanCompleted

FindingCreated

RiskCreated

RiskUpdated

TreatmentApproved

ComplianceUpdated

AIRequested

AICompleted

ReportGenerated

AlertQueued

AlertDelivered

AuditRecorded
```

Future integrations should subscribe to events instead of modifying existing Engines.

---

# Shared SDK

Common functionality belongs in a shared SDK.

```
sdk/

    auth/

    database/

    events/

    encryption/

    logging/

    telemetry/

    exceptions/

    constants/

    types/

    utilities/
```

Engines import contracts from the SDK.

Never import another Engine's internal implementation.

---

# Development Rules

## DO

- Keep Engines independent.
- Use dependency injection.
- Publish events.
- Keep business logic inside Engines.
- Write unit tests per Engine.
- Document public Engine APIs.

---

## DO NOT

- Share repositories across Engines.
- Call Engine internals directly.
- Mix business domains.
- Put business logic into Infrastructure.
- Put scanning logic inside the Control Plane.
- Put AI logic inside API endpoints.

---

# Development Environment

Development workflow:

```
Windows Host
    │
    │ Mock Customer Environment
    │
    ▼
WSL Ubuntu
    │
    ├── FastAPI
    ├── PostgreSQL
    ├── Redis
    ├── Celery
    ├── Docker
    └── Event Bus
```

The Windows host simulates a customer environment.

WSL hosts the Phantix platform.

This allows realistic testing of customer connectivity without cloud infrastructure.

---

# Long-Term Deployment Strategy

## Stage 1

Single VPS

Single FastAPI

Single Docker Compose

---

## Stage 2

Dedicated Celery Workers

Dedicated AI Workers

Dedicated Scanner Workers

---

## Stage 3

Separate AI deployment

Separate Scanner deployment

Separate Reporting deployment

---

## Stage 4

Optional Microservice Extraction

Only extract an Engine if:

- It requires independent scaling.
- It has independent deployment requirements.
- It introduces unacceptable resource contention.
- It has a separate engineering team.

---

# Final Engineering Principle

**Optimize for modularity before distribution.**

A well-designed modular monolith with clear Engine boundaries is significantly easier to develop, test, deploy, and maintain than a prematurely distributed system.

Every architectural decision should preserve the ability to extract an Engine into its own service without requiring major refactoring.
