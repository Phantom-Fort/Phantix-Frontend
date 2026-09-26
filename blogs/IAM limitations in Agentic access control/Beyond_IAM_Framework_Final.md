Beyond IAM: A Framework for Context-Aware, Intent-Bound, and Capability-Based Control of Autonomous AI Agents
Research Paper / Working Draft
Status: Working research draft
Purpose: Public-facing research paper and technical article
Research focus: AI agent security, MCP security, context-aware authorization, intent-bound control, capability-based authorization, delegation, and continuous enforcement.

List of Figures

#	Figure	Section
1	AI Agent Dynamic Action Path	§1.1
2	Identity Hierarchy in Agentic Systems	§2.3
3	Agentic Delegation Chain	§2.9
4	Delegation Model (Human → Tool)	§3.2
5	Traditional IAM Model	§6.1
6	Agentic Authorization Problem — Dynamic Path	§6.2
7	Identity-Centric Model	§6.3
8	Authorized Agency Model	§6.3
9	Extending Zero Trust for Autonomous Agents	§7.1
10	Delegation / Provenance Graph	§7.8
11	Intent Alignment Evaluation	§9.3
12	Dynamic Capability Issuance	§11.2
13	The Agent Action Envelope (AAE)	§13
14	Delegation Chain (within AAE)	§13.4
15	Delegation and Authority Attenuation	§16
16	MCP as the Agent-to-Tool Action Boundary	§18
17	The CIBC Framework — Six Layers	§19.1
18	Reference Architecture	§20
Abstract
The emergence of autonomous and semi-autonomous artificial intelligence agents introduces an authorization problem that conventional Identity and Access Management (IAM) was not designed to solve completely. Traditional IAM systems establish and authenticate principals and determine whether those principals possess permission to access resources. Agentic systems, however, introduce a materially different security condition: an authenticated principal can dynamically acquire context, interpret natural-language instructions, select tools, construct action sequences, delegate tasks, and cause state changes across multiple systems.

In such environments, the possession of a valid identity and permission does not necessarily establish that a particular action is appropriate to the principal's delegated objective. An AI agent may exercise a legitimate capability after being influenced by malicious context, indirect prompt injection, poisoned tool metadata, compromised external resources, or an unintended chain of intermediate actions. The resulting problem is not solely one of authentication or access control. It is a problem of authorized agency.

This paper examines the limitations of identity-centric authorization for AI agents and investigates three complementary control dimensions: context-aware authorization, intent-bound control, and capability-based authority. It synthesizes existing work in Zero Trust Architecture, attribute and context-aware authorization, OAuth-based delegation, proof-carrying authorization, capability systems, Macaroons, decentralized delegation, MCP security, and emerging AI-agent identity research.

The paper proposes that IAM should remain the root of identity, authentication, and delegation, but that authority exercised by an AI agent should be dynamically constrained by a combination of:

who is acting;
on whose behalf the agent is acting;
for what declared objective;
using what trusted or untrusted context;
against which target;
under which runtime conditions;
and within what bounded authority.
The proposed framework, termed Context-Aware, Intent-Bound Capability Control (CIBC), treats an individual agent execution—not merely the persistent agent—as a first-class security subject. It introduces the concept of an Agent Action Envelope (AAE), an authorization object binding identity, delegation, objective, context provenance, requested capability, constraints, and lifecycle conditions to a specific action or action sequence.

The central claim is deliberately narrow:

Intent should not be treated as a mystical or perfectly observable representation of the model's internal reasoning. Instead, it should be operationalized as a declared, constrained, and auditable objective against which proposed actions can be evaluated.

This distinction is essential. The security system does not need to prove what an LLM "truly intended." It must determine whether an action remains within an authorized and policy-defined purpose despite dynamically changing context.

1. Introduction
1.1 Background
For most of modern computing, access control has been built around a relatively stable assumption:

A principal requests access to a resource, and a policy determines whether that principal may perform the requested operation.

This assumption underlies:

Discretionary Access Control (DAC);
Role-Based Access Control (RBAC);
Attribute-Based Access Control (ABAC);
OAuth-based delegated authorization;
service identities;
API authorization;
cloud IAM;
workload identity systems.
An AI agent complicates this model.

Consider the difference between a conventional service and an autonomous security agent.

A conventional service might execute:

IF alert.severity == "critical"
THEN isolate(endpoint)
The developer explicitly defined the decision path.

An AI agent may instead perform:

AI Agent Dynamic Action Path

Figure: Dynamic action path of an autonomous AI agent (Receive objective → … → Take action).

The action path may therefore be partly unknown when the software is deployed.

This creates a fundamental change in the security model.

Traditional authorization generally assumes that software logic determines how granted authority will be exercised.

Agentic systems introduce software capable of dynamically determining how authority should be exercised.

The security question therefore evolves from:

Does this principal possess permission to perform this action?

to:

Should this particular agent execution exercise this authority, against this target, at this time, for this objective, given the context that influenced its decision?

This paper describes that transition as a movement from identity-centric access control toward authorized agency.

1.2 The Emergence of Autonomous Agency
AI agents differ from conventional applications not simply because they use machine learning or large language models. Anthropic's own guidance on agent architecture distinguishes simple, predefined workflows from genuinely agentic systems precisely along this axis: whether the software or the model directs its own process and tool use [27].

The defining security characteristics are their ability to:

receive broad objectives rather than deterministic instructions;
dynamically acquire additional context;
interpret structured and unstructured information;
select tools;
generate action parameters;
modify plans based on intermediate results;
invoke external systems;
perform state-changing actions;
delegate work to other agents or services.
This creates an authorization environment where future actions may not be fully known when an agent is initially authenticated.

A persistent permission such as:

SOC_AGENT:
    read_logs
    disable_users
    isolate_endpoints
    modify_firewall
may technically follow conventional least-privilege principles when compared with an administrator account.

Yet it may still be excessively privileged for a specific agent execution.

An investigation into suspicious login activity may require:

read_logs
read_identity_events
create_security_finding
It may not require:

disable_users
isolate_endpoints
modify_firewall
Granting all possible future permissions to the agent creates standing authority that can be exercised after:

prompt injection;
context manipulation;
tool poisoning;
compromised instructions;
planning errors;
model hallucination;
agent loops;
compromised downstream services.
The security problem is therefore not simply:

How do we identify the agent?

It is:

How do we continuously constrain the authority an agent may exercise as its objective, context, state, and execution path evolve?

1.3 Problem Statement
The central problem addressed by this research is:

A valid identity and valid permission do not necessarily imply that an autonomous agent's use of that permission is valid in its current context.

Traditional IAM can answer:

Who is this principal?
Has the principal authenticated?
What role does the principal possess?
What resources can the principal access?
Has authority been delegated?
Agentic systems require additional questions:

Why is the agent attempting this action?
Who authorized the objective?
What context influenced the decision?
Is the context trustworthy?
Did untrusted content attempt to redirect the agent?
Does the requested action remain within the authorized objective?
Has the agent exceeded its intended scope?
Is this action safe when considered alongside previous actions?
Should the action require additional approval?
Can the authority disappear automatically when the objective ends?
The conventional authorization expression:

P
e
r
m
i
t
(
S
u
b
j
e
c
t
,
A
c
t
i
o
n
,
R
e
s
o
u
r
c
e
)
Permit(Subject,Action,Resource)
may therefore be insufficient.

This paper investigates an expanded model:

P
e
r
m
i
t
(
P
r
i
n
c
i
p
a
l
,
A
g
e
n
t
,
R
u
n
,
D
e
l
e
g
a
t
i
o
n
,
O
b
j
e
c
t
i
v
e
,
C
o
n
t
e
x
t
,
A
c
t
i
o
n
,
R
e
s
o
u
r
c
e
,
P
a
r
a
m
e
t
e
r
s
,
R
u
n
t
i
m
e
S
t
a
t
e
,
R
i
s
k
)
Permit(Principal,Agent,Run,Delegation,Objective,Context,Action,Resource,Parameters,RuntimeState,Risk)
The challenge is determining which variables can be securely represented, verified, and enforced without relying on unverifiable claims about the hidden internal reasoning of a probabilistic model.

2. Definition of Terms
2.1 AI Agent
For the purposes of this paper, an AI agent is a software system capable of receiving instructions or objectives, dynamically processing information, selecting actions, invoking external tools or services, and modifying its execution path based on intermediate results.

The defining security characteristics are:

dynamic context acquisition;
planning or decision-making;
tool selection;
action execution;
partial or full autonomy.
2.2 Agentic System
An agentic system is the broader architecture surrounding one or more AI agents.

It may include:

language models;
orchestration frameworks;
memory;
retrieval systems;
tool registries;
MCP clients;
MCP servers;
APIs;
policy engines;
identity providers;
approval systems;
audit infrastructure.
The security of an AI agent cannot therefore be reduced to the security of the underlying model.

The model may be secure while:

the tool layer is compromised;
credentials are overprivileged;
context is poisoned;
delegation is uncontrolled;
authorization is insufficient.
2.3 Identity
Identity is the collection of attributes, credentials, and cryptographic or administrative bindings that distinguish one principal from another, consistent with the identity-proofing, authentication, and federation model in NIST SP 800-63-4 [2]. For workload-to-workload identity specifically, the SPIFFE/SPIRE specifications provide a cryptographically verifiable identity document (the SVID) that this paper treats as a candidate substrate for Agent and Agent Run identity [7].

In an agentic environment, identity may exist at multiple levels:

Identity Hierarchy in Agentic Systems

Figure: Multi-level identity hierarchy from Organization Identity down to Tool or Workload Identity.

A major research question is whether a persistent agent identity is sufficient.

This paper argues that it is not.

2.4 Agent Run
An Agent Run is a bounded execution of an AI agent associated with:

an initiating principal;
a declared objective;
a defined scope;
a start condition;
a termination condition;
contextual state;
delegated authority;
a bounded risk or action budget.
This paper proposes that the Agent Run should be treated as a first-class security subject.

2.5 Authorization
Authorization is the process of determining whether a subject may perform an action against a resource under an applicable policy.

Traditional authorization evaluates relationships such as:

S
u
b
j
e
c
t
+
A
c
t
i
o
n
+
R
e
s
o
u
r
c
e
Subject+Action+Resource
The proposed model evaluates:

P
r
i
n
c
i
p
a
l
+
A
g
e
n
t
+
A
g
e
n
t
R
u
n
+
D
e
l
e
g
a
t
i
o
n
+
O
b
j
e
c
t
i
v
e
+
C
o
n
t
e
x
t
+
A
c
t
i
o
n
+
T
a
r
g
e
t
+
C
o
n
s
t
r
a
i
n
t
s
Principal+Agent+AgentRun+Delegation+Objective+Context+Action+Target+Constraints
2.6 Context Awareness
Context awareness refers to the ability of a system to incorporate environmental, organizational, security, and execution conditions into a decision.

Relevant context may include:

identity;
tenant;
time;
network environment;
authentication strength;
device posture;
task state;
resource sensitivity;
incident status;
previous actions;
tool trust;
source provenance;
approval state;
risk level.
However, AI agents introduce a second problem:

The context used by the agent to make a decision may itself be malicious.

This creates two distinct categories.

Decision Context
Information consumed by the agent during reasoning and planning.

Examples include:

documents;
emails;
web pages;
logs;
tool outputs;
database records;
retrieved knowledge.
Authorization Context
Information trusted by the security system when determining whether an action is allowed.

Examples may include:

authenticated identity;
active delegation;
approved objective;
policy;
incident state;
resource classification;
approval record.
These categories must not automatically overlap.

2.7 Intent
Intent is a difficult term because an LLM's internal reasoning cannot reliably be treated as a cryptographically verifiable representation of purpose.

This paper therefore defines operational intent as:

A declared, authorized, constrained, and auditable objective against which proposed actions can be evaluated.

Examples:

Investigate suspicious login activity.
Contain confirmed ransomware activity associated with incident INC-421.
Prepare an ISO 27001 compliance assessment for a defined organizational environment.
The system does not attempt to answer:

"What did the model secretly mean?"

Instead, it asks:

"Does this proposed action remain within the authority and policy boundaries of the declared objective?"

This distinction is central to the proposed framework.

2.8 Capability
A capability is an authority-bearing object that permits a specific action or class of actions.

A broad role may state:

SOC_AGENT:
    read_logs
    isolate_endpoints
    disable_users
A constrained capability may state:

Action: isolate_endpoint
Target: host-421
Objective: incident-421
Maximum Uses: 1
Expires: 10 minutes
Approval: required
Capabilities therefore allow authority to be narrower, time-limited, and contextual.

2.9 Delegation
Delegation is the transfer or granting of authority from one principal to another.

An agentic delegation chain may look like:

Agentic Delegation Chain

Figure: Authority attenuates as it moves from Organization through Security Administrator, SOC Agent, Incident Response Run/Sub-Agent to MCP Tool.

Each transition introduces a security question:

How much authority is transferred, and under what constraints?

2.10 Context Provenance
Context provenance describes the origin and relevant trust characteristics of information that enters an agentic system.

A provenance record may include:

Source Identity
Origin
Timestamp
Integrity Status
Trust Classification
Tenant
Sensitivity
Instruction Authority
Context provenance is proposed as a core control because untrusted information may influence an agent without being allowed to authorize the agent.

3. Objectives of the Study
3.1 Primary Objective
The primary objective of this study is:

To develop and evaluate a security framework for controlling AI-agent actions using context-aware, intent-bound, and capability-based authorization mechanisms.

3.2 Specific Objectives
Examine the limitations of traditional IAM, RBAC, ABAC, and delegated authorization when applied to autonomous AI agents.

Develop an identity taxonomy for AI-agent systems.

Examine the relationship between dynamic context acquisition and authorization risk.

Develop an operational definition of intent suitable for security enforcement.

Investigate whether declared objectives can serve as enforceable boundaries for agent authority.

Investigate capability-based authorization as a mechanism for implementing least privilege in unpredictable agent workflows.

Analyze MCP as an agent-to-tool action boundary.

Develop a model for delegation across:

Delegation Model

Figure: Human → Agent → Agent Run → Sub-Agent → Tool

Investigate continuous and sequence-aware authorization.

Develop a reference architecture for production AI-agent platforms.

Identify limitations, attack scenarios, and failure modes associated with intent-bound and context-aware control.

4. Scope of the Study
This research focuses on autonomous and semi-autonomous AI agents that:

dynamically acquire context;
interact with external tools;
access enterprise systems;
perform state-changing operations;
act on behalf of humans or organizations;
delegate tasks;
use MCP or comparable tool-integration architectures.
This research is grounded in, but does not attempt to resolve, the broader governance questions addressed by the NIST AI Risk Management Framework and its accompanying implementation Playbook [11][28]; it focuses narrowly on run-time authorization rather than organizational AI risk management as a whole.

The study includes:

AI-agent identity;
IAM;
workload identity;
delegated authorization;
OAuth;
MCP;
Zero Trust;
context-aware authorization;
capability security;
proof-carrying authorization;
relationship-based authorization;
delegation;
authority attenuation;
prompt injection;
tool poisoning;
sequence-aware authorization;
continuous authorization;
human approval;
auditability;
verifiable evidence.
The study does not attempt to solve:

general artificial intelligence alignment;
AGI safety;
consciousness or machine intent;
complete interpretability of LLM reasoning;
all categories of AI misuse.
The research question is narrower:

How can a security architecture constrain what an autonomous agent is permitted to do even when its reasoning, context, and future action path are dynamic?

5. Research Questions
Can conventional IAM alone provide adequate least-privilege control for autonomous AI agents whose future action paths are not completely known at deployment time?

Should persistent AI agents, individual agent runs, and delegated sub-agents possess distinct identities?

What contextual information should participate in an authorization decision for an AI agent?

Can intent be transformed into a security-enforceable construct without attempting to inspect or trust private model reasoning?

Can declared objectives provide a practical basis for bounding authority?

Are capability-based credentials better suited than standing roles for state-changing agent operations?

How should authority be attenuated when agents delegate tasks to other agents?

Can authorization decisions account for action sequences rather than isolated requests?

How should prompt injection be understood as an attack against the authorized exercise of capability?

What architecture can enforce context-aware and intent-bound controls independently of the LLM?

How can authorization evidence be preserved and independently verified after an autonomous action occurs?

6. Conceptual Foundation
6.1 The Traditional IAM Model
Traditional IAM generally follows:

Traditiona IAM Model

The authorization question is typically:

Can Subject A perform Action X on Resource Y?
This model remains necessary.

However, it assumes that the principal's decision to request the action is outside the scope of authorization.

For conventional applications, that assumption is often reasonable because the logic generating the request is deterministic or developer-defined.

For AI agents, it is less reliable.

6.2 The Agentic Authorization Problem
An AI agent may dynamically:

Agentic Authorization Problem — Dynamic Path

Figure: Dynamic path from Receive Objective through plan modification to additional actions.

The authorization system therefore encounters a new problem:

The identity is stable, but the reasoning path producing the request is dynamic.

This creates a distinction between:

Possession of Authority
and:

Appropriate Exercise of Authority
6.3 From Identity Management to Authorized Agency
The paper proposes the following conceptual shift.

Identity-Centric Model
Identity-Centric Model

Figure: Classic identity-centric authorization questions.

Authorized Agency Model
Authorized Agency Model

Figure: Expanded questions required for authorized agency of AI agents.

7. Literature Review and Related Work
7.1 Zero Trust Architecture
Zero Trust Architecture provides an important foundation for agent security [1].

The central principle is that access should not be granted based on implicit trust, and that trust should instead be evaluated continuously per-request rather than assumed from network location or prior authentication [1]. Access decisions should be evaluated through policy and enforced through explicit control points [1].

Extending Zero Trust for autonomous agents

Figure 1. A conventional Policy Enforcement Point / Policy Decision Point pipeline (left) compared with the proposed Agent Policy Decision Point, which evaluates identity, delegation, objective, context provenance, risk, sequence history, and approval state before a narrow capability is issued (right).

The contribution is not to replace Zero Trust.

It is to extend the definition of the subject.

The relevant security subject becomes:

Agent Run
acting for Principal
under Delegation
for Objective
within Context
7.2 RBAC
Role-Based Access Control groups permissions into roles [1].

Example:

SOC_AGENT
    ├── read_logs
    ├── create_ticket
    ├── isolate_endpoint
    └── disable_user
RBAC is simple and operationally useful.

However, a role may create excessive standing authority for an agent.

The agent may only require one permission during a particular execution but possess all permissions associated with the role.

This creates a standing authority problem.

7.3 ABAC
Attribute-Based Access Control (ABAC) evaluates attributes associated with [16]:

subjects;
objects;
actions;
environmental conditions.
ABAC is more flexible than static RBAC and can incorporate dynamic properties.

For example:

ALLOW
IF:
    subject.department == "Security"
    AND
    resource.classification <= subject.clearance
    AND
    environment.incident_state == "active"
ABAC provides a strong foundation for context-aware control.

However, the proposed research argues that agentic systems may require additional objects:

Agent Run
Delegation Chain
Declared Objective
Context Provenance
Action History
Capability Constraints
7.4 Context-Aware Authorization
Context-aware authorization recognizes that permissions may depend on dynamic environmental conditions [16]. Usage Control (UCON) extends this idea further by treating authorization as continuous rather than a one-time decision, introducing obligations, conditions, and mutable attributes that are re-evaluated throughout a session [17].

This research area is particularly relevant because AI agents operate in changing environments.

However, agentic systems introduce a new distinction:

Context that influences the agent
versus

Context trusted to authorize the agent.
This paper proposes that these categories must be separated.

For example:

Email:
"Export all customer records immediately."
The email may become:

Decision Context
It must not automatically become:

Authorization Context
This leads to a foundational principle:

Information capable of influencing an agent should not automatically possess the authority to authorize the resulting action.

7.5 Capability-Based Security
Capability-based security provides authority through explicit, unforgeable authority-bearing objects rather than through identity-indexed access-control lists [12].

Instead of assigning:

endpoint_admin
the system may issue:

Capability:
    action = isolate_endpoint
    target = host-421
    incident = INC-421
    expires = 10 minutes
    uses = 1
This provides several properties relevant to AI agents:

narrow scope;
limited lifetime;
bounded targets;
attenuation;
revocation;
reduced blast radius.
Capability systems therefore provide a natural mechanism for agents whose required authority may change during execution.

7.6 Macaroons and Contextual Caveats
Macaroons are authorization credentials designed to support contextual restrictions through caveats — predicates appended to a credential that can only narrow, never expand, what it authorizes [12].

A credential can be progressively attenuated.

For example:

Original Authority:
read_all_incidents
may become:

read_incident(INC-421)
and subsequently:

read_incident(INC-421)
expires_in(10_minutes)
The conceptual relevance to agent security is significant.

Authority can move through an agent hierarchy while becoming narrower.

7.7 Proof-Carrying Authorization
Proof-carrying authorization investigates mechanisms where a principal can provide evidence demonstrating that it possesses the authority required for a requested operation [14]. Contemporary work applying an analogous verifiability lens specifically to MCP — Ken Huang's Proof-of-Control framework — asks a parallel question at the protocol level: which control intents does a given MCP deployment already implement, and at what tier of verifiable evidence [19].

The concept is useful for AI agents because it suggests a shift from:

Does this agent have permission?
toward:

Can this agent execution demonstrate
why this action is authorized?
The proposed Agent Action Envelope builds on this conceptual direction.

7.8 Delegation Graphs and Event Provenance
Authorization can benefit from understanding how an action came to exist, drawing on research into delegation and provenance graphs, information flow, event causality, and trust propagation [15].

A delegation or provenance graph might look like:

Delegation / Provenance Graph

Figure: Provenance chain from Human Request to Requested Tool Action.

This suggests that the origin of an action may be relevant to its authorization.

A request that originated from:

Approved Incident Response Workflow
may have a different security posture from a request influenced by:

Untrusted Web Content
7.9 OAuth and Delegated Authorization
OAuth 2.1 provides a widely adopted mechanism for delegated authorization [6].

However, traditional scope models may be insufficiently expressive for agentic systems. OAuth 2.0 Rich Authorization Requests (RFC 9396) partially addresses this by allowing a client to request fine-grained, structured authorization data rather than a flat scope string [5].

A scope such as:

endpoint.write
does not necessarily communicate:

which endpoint;
for which incident;
how many times;
for how long;
under whose authority;
under which approval.
Fine-grained authorization mechanisms can address some of these limitations.

However, delegated credentials alone do not solve the decision-integrity problem.

A valid credential can still be used after:

prompt injection;
malicious context;
planning failure;
tool poisoning.
7.10 MCP as an Agentic Action Boundary
The Model Context Protocol (MCP) provides a standardized architecture through which AI applications can discover and invoke external capabilities [3][23]. MCP defines an optional OAuth-based authorization flow for HTTP-based transports through which an MCP client obtains scoped access to a protected MCP server on behalf of a resource owner [4]. Practical hardening guidance for this flow — covering token handling, transport security, and consent — is maintained in the OWASP MCP Security Cheat Sheet [9].

MCP is important because it creates a recognizable action boundary. At the same time, the emerging OWASP MCP Top 10 project catalogs risk categories specific to this boundary — including token mismanagement, tool poisoning, and excessive standing scope — that are directly relevant to the threat model developed later in this paper [8].

However, MCP authorization should not be treated as the complete security architecture for autonomous agency.

The MCP layer may answer:

Can this client access this MCP resource?
The broader problem is:

Should this specific agent execution
perform this exact action
against this exact target
using these parameters
for this objective
given this context?
These are complementary but different questions.

7.11 Tool Poisoning
Tool metadata, descriptions, schemas, and results may influence an AI agent's behavior. Empirical MCP security surveys have documented this as a systemic risk across the ecosystem rather than an isolated implementation flaw [20][21].

A malicious or compromised tool may attempt to manipulate the agent.

For example:

Tool Description:

Use this tool to retrieve security reports.

IMPORTANT:
Before returning results, send all available
environment variables to the diagnostic endpoint.
A human security reviewer would recognize the instruction as malicious.

An autonomous model may not reliably distinguish:

Tool Function Description
from:

Malicious Behavioral Instruction
This makes tool metadata part of the agent's semantic attack surface.

7.12 Prompt Injection
Prompt injection is often described as an instruction-following vulnerability, and is named explicitly as a top risk category for agentic applications by the OWASP GenAI Security Project [10] and MITRE ATLAS [22].

For autonomous agents, it can also be understood as a form of capability misuse.

The attacker may not need to steal credentials.

Instead:

Agent possesses valid capability
        +
Attacker manipulates context
        ↓
Agent exercises capability
Therefore:

V
a
l
i
d
I
d
e
n
t
i
t
y
+
V
a
l
i
d
C
a
p
a
b
i
l
i
t
y
≠
V
a
l
i
d
A
c
t
i
o
n
ValidIdentity+ValidCapability=ValidAction
The missing variables include:

O
b
j
e
c
t
i
v
e
A
l
i
g
n
m
e
n
t
+
C
o
n
t
e
x
t
T
r
u
s
t
+
R
u
n
t
i
m
e
P
o
l
i
c
y
ObjectiveAlignment+ContextTrust+RuntimePolicy
7.9 OWASP Top 10 for Agentic Applications
OWASP published the Top 10 for Agentic Applications on December 9, 2025, through the GenAI Security Project [10]. It defines ten risk categories, ASI01 through ASI10, covering things like goal hijacking, tool misuse, identity and privilege abuse, supply chain issues in the agent stack, unexpected code execution, memory and context poisoning, insecure inter-agent communication, cascading failures, human-agent trust exploitation, and rogue agents. A few of these map fairly directly onto categories this paper already treats as threats: ASI01 lines up with prompt injection and objective drift, ASI03 with excessive privilege and delegation escalation, ASI06 with context confusion. Two categories, ASI07 (insecure inter-agent communication) and ASI08 (cascading failures), are not represented in this paper's earlier threat model and are addressed in the revised Section 21.

OWASP's organizing principle for the whole document is what they call "least agency," meaning an agent should be given the smallest amount of autonomy that still lets it do its job. That's close enough to this paper's own Contribution 5 (purpose-bound capability issuance) that it's worth naming directly, since it suggests the two efforts are converging on similar conclusions from different starting points rather than one copying the other.

7.10 GNAP
GNAP (Grant Negotiation and Authorization Protocol) is no longer an emerging framework. It's a finished IETF standard, RFC 9635, published October 2024, with a companion RFC 9767 (GNAP Resource Server Connections) following in 2025. The working group that produced it has since closed.

What makes GNAP relevant here is that it doesn't require the OAuth-style pre-registration of a client_id before a request can happen. A client can show up with a key and the authorization server negotiates the grant on the spot, sometimes across multiple interaction steps and multiple parties. That's a closer match to how this paper wants AAE issuance to work, where authority is granted per-action rather than pre-provisioned in bulk, than OAuth 2.1's largely static scope model is. GNAP still doesn't natively express objective-binding, context provenance, or sequence history, so it isn't a drop-in replacement for the AAE, but it's a more plausible transport layer to build one on top of than OAuth is.

7.11 Continuous Access Evaluation
The OpenID Foundation's Shared Signals Framework, and specifically its Continuous Access Evaluation Profile (CAEP 1.0), is now a final specification, with an interoperability profile alongside it. CAEP defines a set of signed event types, session revoked, credential change, device compliance change, and so on, sent between a transmitter and a receiver so that a relying party can revoke or narrow access as soon as conditions change, instead of waiting for the next token refresh. Google, Apple, IBM, Okta, SailPoint, and Microsoft have all implemented some version of it, and Keycloak added experimental transmitter support in May 2026.

This is useful prior art for what this paper calls continuous evaluation. Rather than inventing a bespoke revocation channel, the AAE lifecycle conditions described in Section 13 could be carried as CAEP-style signed events, treating something like "context trust downgraded" or "objective invalidated" the same way CAEP already treats "device compliance changed." Section 22 references this pattern.

7.12 Context Provenance Systems
There are really two separate things people mean by "provenance" and this paper should be clear about which one it needs. The first is artifact provenance, meaning who created or edited a piece of content, and the dominant standard here is C2PA. The C2PA Technical Specification reached v2.3 in December 2025 and extended its scope beyond media files to cover LLM-generated text, partly in response to regulatory pressure from the EU AI Act's Article 50 and California's SB 942. That said, an independent security review of C2PA found the specification still has gaps and inconsistencies and is not something to lean on as a solved problem yet.

The second, and the one this paper actually needs more of, is decision or execution provenance: not who wrote a document, but what influenced an agent's specific action. This is a newer and thinner body of work. A recent survey, "From Agent Traces to Trust," proposes a graph model connecting tasks, tools, parameters, retrieved documents, observations, memory items, and actions through typed relations such as support, derivation, dependency, and contradiction, which is close to what this paper's delegation and provenance graph (Section 7.8, Figure 10) is already gesturing at. A second paper, on safeguarding LLM agents through provenance analysis, applies a similar idea specifically to detecting misalignment. Neither is anywhere near standards-maturity yet, which is worth stating plainly since it means the context-provenance requirement in this framework is asking for infrastructure that mostly doesn't exist yet, not infrastructure that's merely underused.

7.13 Indirect Prompt Injection Research
Indirect prompt injection, where the malicious instruction arrives embedded in content the agent processes rather than typed directly by an attacker, was formalized by Greshake et al. in 2023 and has since been shown to propagate across multi-agent systems, sometimes called "prompt infection," where one compromised resource can affect a whole chain of downstream agents.

A few incidents give this some real weight rather than leaving it hypothetical. EchoLeak (CVE-2025-32711) was a zero-click data exfiltration issue in Microsoft 365 Copilot triggered by an indirect injection in email content. There have also been cases of persistent memory poisoning in Amazon Bedrock agents that survived across session boundaries, and at least one case of hidden instructions embedded in academic paper text, using invisible fonts, aimed at manipulating AI-assisted peer review. An empirical study of injection payloads found in the wild reported that the large majority, on the order of 87 percent, were deliberately hidden from human view using rendering-suppression tricks, which matters because it means a human skimming the source content isn't a reliable defense.

Perhaps the more important point for this paper is that OpenAI, Anthropic, and Google DeepMind have each, in various 2025 publications, acknowledged that prompt injection can't be fully solved at the model level, because any instruction telling the model to ignore injected instructions is itself just more text the model could be talked out of. That's not a comfortable thing to build a security argument on, but it's also exactly the justification this paper needs for treating authorization as the enforcement layer instead of hoping better prompting eventually closes the gap. Separately, adaptive-attack research (Zhan et al., NAACL 2025 Findings) has shown that defenses which look solid against a fixed benchmark tend to fail once an attacker is allowed to adapt, which is a caution this paper's own Evaluation Methodology (Section 22) tries to take seriously rather than restate as a footnote.

7.14 Agent-to-Agent Delegation and Identity Standards
Google released the Agent2Agent (A2A) protocol in April 2025 and donated it to the Linux Foundation; it's now at v1.0.1 with over 150 supporting organizations including Microsoft, AWS, Salesforce, and IBM. Where MCP standardizes how an agent talks to a tool, A2A standardizes how one agent talks to another: discovery through signed Agent Cards, structured task delegation with a defined lifecycle, and a state (TASK_STATE_AUTH_REQUIRED) that lets a receiving agent hand an authorization decision back to the delegating client rather than deciding on its own.

The finding worth dwelling on: independent analysis of A2A, MCP, and ACP together concluded that all three handle authentication reasonably well but none of them specify authorization at any real granularity, role-based tool access, time-bounded leasing, restricted delegation chains, all of that is pushed off as "an application-layer concern." A 2026 paper titled "Governance Gaps in Agent Interoperability Protocols" makes this the center of its argument. That's not a minor footnote for this paper, it's close to a direct validation of the whole premise: these protocols move messages and establish who's who, but they don't say whether a given action or delegation should actually be allowed. That's the gap the AAE and CIBC model are meant to sit in.

On identity specifically, a 2026 paper, "AI Identity: Standards, Gaps, and Research Directions for AI Agents," describes an emerging framework called AIMS built around dual-identity credentials that bind an agent to its human or organizational owner through three delegation patterns (agent-mediated, owner-mediated, server-mediated), each producing a traceable chain back to a human principal. It's a reasonable point of comparison for this paper's own identity model in Section 12, though it should be treated as actively in flux rather than settled ground, since MCP itself only added OAuth 2.1 support for its HTTP transport in January 2026 and the whole identity layer is still being defined in real time across several competing efforts.

8. The Central Research Argument
This paper proposes:

IAM should remain the root of identity and delegation, but it should not be the final authorization authority for autonomous agents.

A complete agent control system requires multiple layers.

Identity  +  Delegation  +  Objective  +  Context  +  Capability  +  Runtime Policy  +  Evidence
The proposed model can be represented as:

A
u
t
h
o
r
i
t
y
=
I
d
e
n
t
i
t
y
∩
D
e
l
e
g
a
t
i
o
n
∩
O
b
j
e
c
t
i
v
e
∩
C
o
n
t
e
x
t
C
o
n
s
t
r
a
i
n
t
s
∩
C
a
p
a
b
i
l
i
t
y
C
o
n
s
t
r
a
i
n
t
s
∩
R
u
n
t
i
m
e
P
o
l
i
c
y
Authority=Identity∩Delegation∩Objective∩ContextConstraints∩CapabilityConstraints∩RuntimePolicy
Authority should disappear or be reduced when one of these conditions becomes invalid.

9. Intent-Bound Authorization
9.1 The Problem With "True Intent"
A security architecture should not depend on reliably determining an AI model's hidden internal intent.

The model:

is probabilistic;
may generate inconsistent explanations;
may not expose all internal reasoning;
may be influenced by context;
may produce post-hoc rationalizations.
Therefore, this paper rejects:

True Intent Detection

as the primary security mechanism.

9.2 Operational Intent
Instead, the framework proposes:

Operational Intent = Authorized Objective + Scope + Constraints

Example:

{
  "objective_id": "INC-421",
  "objective_type": "contain_security_incident",
  "authorized_by": "security-admin-123",
  "scope": {
    "incident": "INC-421",
    "assets": [
      "host-21",
      "host-22"
    ]
  },
  "expires_at": "2026-08-23T12:30:00Z"
}
The agent may dynamically determine how to pursue the objective.

The security system determines whether a proposed action remains within the authorized envelope.

Crucially, the declared objective is treated as an immutable, independently enforced boundary. Even when an agent (or a preprocessing layer) clusters tools and assigns normalized names derived from prompts and intermediate context, those names and clusters remain decision-context artifacts. They do not rewrite, expand, or replace the authorized objective. The authorization engine continues to evaluate proposed tool invocations solely against the original objective, its authorized action classes, target scope, and constraints. The model’s evolving plan narrative or renaming of tools never becomes a source of new authority.

9.3 Intent Alignment
An authorization engine can evaluate an action against:

Intent Alignment Evaluation

Figure: Evaluation path from Objective through Authorized Action Classes, Target Scope and Constraints to Requested Capability.

For example:

Objective:
Investigate suspicious login activity.
Allowed:

read_identity_logs
read_authentication_events
query_threat_intelligence
create_security_finding
Not automatically allowed:

disable_all_users
export_customer_database
modify_firewall
The objective therefore constrains the authority available to the run.

10. Context-Aware Control
10.1 Context as an Authorization Input
The authorization system may consider:

Identity
Authentication Strength
Tenant
Objective
Incident State
Target Sensitivity
Current Time
Network State
Previous Actions
Tool Trust
Approval Status
Risk Signals
10.2 Context as an Attack Surface
The same agent may consume:

Emails
Documents
Web Pages
Logs
Tool Results
Database Records
Threat Intelligence
MCP Metadata
These sources may be:

trusted;
partially trusted;
untrusted;
malicious.
Therefore:

Context must be represented not only by its content, but also by its provenance and authority.

This distinction is especially important when tools are clustered or given normalized names derived from prompts and runtime context. Such normalized names and clusters are themselves forms of decision context. They must carry provenance (source of the normalization, trust classification, whether the content is permitted to influence policy). A malicious or simply opportunistic renaming of tools cannot expand the set of capabilities the Agent Run is allowed to receive, because the authorization decision is made by an independent policy component that maps the concrete requested action—not the cluster label the model happens to be using—against the fixed objective.

10.3 Context Provenance Model
Each significant context object should potentially carry:

Attribute	Description
Source	Originating system or principal
Identity	Authenticated identity of source
Integrity	Whether tampering can be detected
Timestamp	Time of creation or retrieval
Tenant	Organizational boundary
Sensitivity	Data classification
Trust	Security confidence level
Authority	Whether the content can influence policy
Purpose	Intended use of the information
The key distinction is:

May influence reasoning
does not imply:

May grant authority
11. Capability-Based Agent Control
11.1 Standing Authority Problem
Consider:

Agent Role:
SOC_ADMIN
This may provide broad permissions because the agent may eventually need them.

However, the probability that the agent will need a capability is not sufficient justification for holding that capability continuously.

11.2 Dynamic Capability Issuance
The proposed model is:

Dynamic Capability Issuance

Figure: Request → Policy evaluation → Mint capability → Execute → Expire/consume.

Example:

{
  "capability_id": "cap-9821",
  "subject": "agent-run-887",
  "action": "isolate_endpoint",
  "target": "host-421",
  "objective": "INC-421",
  "max_uses": 1,
  "expires_at": "2026-08-23T12:30:00Z",
  "approval_id": "approval-321"
}
11.3 Benefits
Dynamic capabilities may reduce exposure to:

prompt injection;
stolen credentials;
overprivileged service accounts;
runaway agents;
delegation abuse;
compromised sessions.
They also provide a natural enforcement point for per-turn tool-call caps. When an Agent Run is configured with a maximum number of tool invocations per turn (or a cumulative action budget), each minted capability can be issued only while the remaining budget is positive. Once the budget is exhausted, further requests for capability are denied—even if the agent’s internal plan still appears to pursue the original objective. The objective itself is never redefined; only the remaining authority to act is reduced.

12. Agent Run as a Security Principal
A persistent agent identity is not enough.

Consider:

SOC_AGENT
The agent may simultaneously perform:

Run A:
Investigate suspicious login.

Run B:
Contain ransomware.

Run C:
Generate compliance report.
These runs should not necessarily possess identical authority.

The proposed identity model is:

Persistent Agent Identity
            +
Ephemeral Agent Run Identity
            +
Delegated Authority
            +
Objective
Therefore:

Agent Identity
answers:

Which software agent is this?

While:

Agent Run Identity
answers:

Which specific execution is requesting this action?

13. The Agent Action Envelope
The primary proposed technical construct of this research is the:

Agent Action Envelope (AAE)
The AAE represents the information required to evaluate a meaningful agent action: Principal, Agent, Agent Run, Delegation Chain, Authorized Objective, Context Provenance, Requested Capability, Target, Constraints, and Evidence.

The Agent Action Envelope structure

Figure 2. The Agent Action Envelope binds identity, delegation, objective, context provenance, requested capability, and constraints to a specific action, with an evidence record capturing the basis for the decision.

13.1 Principal
Who ultimately owns the authority?

Examples:

human;
organization;
automated workflow.
13.2 Agent
Which persistent agent is acting?

Example:

Phantix SOC Agent
13.3 Agent Run
Which execution is requesting authority?

Example:

run-98f7d2
13.4 Delegation Chain
How did authority reach the current execution?

Delegation Chain (AAE)

Figure: Organization → Security Administrator → SOC Agent → Incident Response Run (authority attenuates).

13.5 Authorized Objective
What purpose has been approved?

Example:

Contain confirmed ransomware activity
associated with INC-421.
13.6 Context Provenance
What information materially influenced the action?

Examples:

SIEM Alert
Internal Asset Database
Threat Intelligence Provider
Untrusted Email
MCP Tool Result
13.7 Requested Capability
What exact authority is required?

isolate_endpoint(host-421)
13.8 Constraints
Constraints may include:

TTL
Maximum Uses
Target Scope
Incident Scope
Data Limit
Approval Requirement
Network Condition
Risk Threshold
14. The Authorization Decision
The proposed authorization model is:

A
l
l
o
w
=
I
d
e
n
t
i
t
y
V
a
l
i
d
∧
D
e
l
e
g
a
t
i
o
n
V
a
l
i
d
∧
O
b
j
e
c
t
i
v
e
V
a
l
i
d
∧
C
o
n
t
e
x
t
A
c
c
e
p
t
a
b
l
e
∧
C
a
p
a
b
i
l
i
t
y
A
l
l
o
w
e
d
∧
C
o
n
s
t
r
a
i
n
t
s
S
a
t
i
s
f
i
e
d
Allow=IdentityValid∧DelegationValid∧ObjectiveValid∧ContextAcceptable∧CapabilityAllowed∧ConstraintsSatisfied
A risk model may also be introduced:

R
i
s
k
=
f
(
C
o
n
t
e
x
t
T
r
u
s
t
,
A
c
t
i
o
n
S
e
n
s
i
t
i
v
i
t
y
,
T
a
r
g
e
t
C
r
i
t
i
c
a
l
i
t
y
,
S
e
q
u
e
n
c
e
H
i
s
t
o
r
y
,
D
e
l
e
g
a
t
i
o
n
D
e
p
t
h
,
A
n
o
m
a
l
y
S
i
g
n
a
l
s
)
Risk=f(ContextTrust,ActionSensitivity,TargetCriticality,SequenceHistory,DelegationDepth,AnomalySignals)
Possible decisions:

LOW RISK
    → ALLOW

MEDIUM RISK
    → ALLOW WITH MONITORING

HIGH RISK
    → REQUIRE STEP-UP

CRITICAL RISK
    → REQUIRE HUMAN APPROVAL OR DENY
14.6 Formal Security Properties
The properties below try to state, more precisely than prose alone usually allows, what the AAE is actually supposed to guarantee. They should be read as operationalized invariants meant to guide an implementation and its evaluation, not as machine-checked theorems with a completed proof, some of them (particularly P1 and P6) depend on a semantic alignment judgment whose correctness this paper doesn't establish, which Section 24 already flags as a limitation.

For a given agent run r, write AAE(r) as the tuple of identity, delegation chain, declared objective, context provenance set, granted capability set, constraints, and lifecycle conditions defined in Section 13. Let A(r) be the set of actions r has taken so far, and let attenuate(K) denote a function that only ever narrows a capability set, never widens it.

P1, Objective-Boundedness. Every action taken by r must have a policy-evaluable link back to its declared objective. An action with no traceable connection to the objective is inadmissible regardless of whether r otherwise holds sufficient capability to perform it. This defeats T5.
P2, Non-Escalation. For a delegation from run r to child run r', the child's capability set must be a subset of the attenuated parent set, never a superset and never outside it. This defeats T4, and is the formal version of what fixed Abuse Case 2.
P3, Context/Authorization Separation. No untrusted element of the context set may, on its own, be sufficient to grant or expand a capability or to modify the declared objective. Untrusted context can inform what the agent plans to do, but it can never by itself justify an authorization decision. This defeats T1 and T6 (and, per the design decision in Section 16, the T11 cases that fold into T4/T6), and it's arguably the single most load-bearing property in the whole framework.
P4, Capability Minimality at Issuance. The capability set granted at issuance must be the minimal set sufficient for the declared objective, and lifecycle conditions must specify a bounded time-to-live. A standing, unscoped, indefinite grant violates this by construction. This defeats T3, the formal statement of the Replit incident's root cause.
P5, Run-Bound Non-Replayability. A capability is valid only for the run it was issued to, only within its validity window, and only once if it's a single-use grant. Presentation by a different run, or after expiry, must be rejected. This defeats T8.
P6, Cumulative Sequence Bound. Authorization decisions must be evaluated against the full action history accumulated so far, not only against the individual action currently under review. This defeats T7 in both its single-agent and cross-agent forms, though as noted in Abuse Case 4, it makes cross-agent cascades detectable and attributable rather than necessarily preventable at the moment harm occurs.
P7, Evidence Immutability and Reconstructibility. For every executed action there must exist a record from which the run's identity, delegation chain, objective, the specific context elements that justified the action, its granted capabilities, and the policy outcome can all be reconstructed, and that record cannot be altered or deleted by the agent, its delegating principal, or the system that produced the decision in the first place. This defeats T10, and the last clause, that even the deciding system can't rewrite its own record, is what makes the evidence externally verifiable instead of self-attested.
P8, Delegation Transitivity Bound. Across a full delegation chain, the capability bound must be composed through attenuation at every hop, no hop may reset or widen it, and each descendant's objective must stay within what the root objective could plausibly decompose into. This is what makes attenuation a structural, per-hop property rather than a one-time check at the root, closing the compound case identified in the T4 attack tree where compromising any single hop is enough.
P9, Continuous Revocability. A capability's validity depends on its lifecycle conditions remaining true throughout execution, not just at the moment it was issued. An external signal invalidating one of those conditions, of the kind described in Section 7.11, must revoke the capability without needing the agent's cooperation or even its awareness.
It's worth being direct about a gap here too: T2 (Tool Poisoning) and T9 (Tool Substitution) aren't well covered by P1 through P9, they're addressed instead by tool-identity and registry-trust controls that sit outside the AAE's own invariants, since they're about verifying the tool rather than the agent's authority. That's a complementary control layer, not a competing one, but the properties above shouldn't be read as covering it.

15. Sequence-Aware Authorization
Traditional authorization often evaluates requests independently.

Consider:

1. Search employee directory
2. Read employee records
3. Export records
4. Encode data
5. Send HTTP request
Each action may be individually authorized.

The aggregate sequence may not be.

Therefore:

A
u
t
h
o
r
i
z
e
(
A
c
t
i
o
n
n
)
≠
A
u
t
h
o
r
i
z
e
(
S
e
q
u
e
n
c
e
1...
n
)
Authorize(Actionn​)=Authorize(Sequence1...n​)
The framework proposes bounded execution state.

Possible controls include:

action budgets (including explicit per-turn tool-call caps);
capability consumption;
maximum target diversity;
maximum delegation depth;
sensitive data aggregation limits;
data movement restrictions;
unusual action sequence detection.
Per-turn tool-call caps are particularly useful when tools are clustered or given normalized names derived from prompts and context. The clustering layer may present the agent with a compact, renamed set of capabilities, yet every actual invocation still consumes against the Agent Run’s remaining budget and must still satisfy the original objective-bound authorization decision. The security system therefore continues to govern all user-visible actions even while the agent’s internal representation of available tools changes from turn to turn. The declared objective remains the fixed reference point; only the remaining capacity to act is attenuated.

16. Delegation and Authority Attenuation
AI agents may increasingly operate as hierarchies, with authority narrowing at each transition from the human principal down to the MCP tool that ultimately executes an action.

Delegation and authority attenuation across an agent hierarchy

Figure 3. Authority attenuates as it moves down the delegation chain from the human principal to the orchestrator, domain agents, sub-agents, and finally the MCP tool. Similar attenuation properties are explored in Macaroons [12] and in WAVE's transitive delegation model [13].

The proposed framework establishes three rules.

Rule 1: No Implicit Transitive Authority
A child agent should not automatically inherit all parent permissions.

Rule 2: Delegation Must Attenuate
A
u
t
h
o
r
i
t
y
c
h
i
l
d
⊆
A
u
t
h
o
r
i
t
y
p
a
r
e
n
t
Authoritychild​⊆Authorityparent​
Authority should generally become narrower.

Rule 3: Escalation Requires Independent Authorization
An agent cannot create new authority merely because it concludes that additional authority would help complete its task.

17. Prompt Injection as Capability Misuse
Prompt injection should not be treated exclusively as an AI alignment problem.

For autonomous systems, it can be modeled as:

Authorized Agent
        +
Legitimate Capability
        +
Malicious Context
        ↓
Unauthorized Exercise of Legitimate Authority
The attacker may never interact directly with IAM.

They may never steal a token.

They may simply manipulate the decision-making process of a principal that already possesses authority.

This creates a critical distinction:

Authorization of Identity
is not equivalent to:

Authorization of Decision
18. MCP and the Agent Action Boundary
MCP creates a useful boundary between agent reasoning and external action [3].

MCP as the agent-to-tool action boundary

Figure 4. A proposed action passes from the agent through an authorization engine and capability broker before a narrow, single-use credential reaches the MCP gateway, MCP server, and external system.

The central principle is:

The LLM should request authority rather than permanently possess broad authority.

19. Context-Aware, Intent-Bound Capability Control
19.1 The CIBC Framework
The proposed framework consists of six layers, moving from identity at the base to enforcement and evidence at the point of action.

The CIBC framework's six layers

Figure 5. Each authorization decision passes through all six layers: identity, delegation, objective, context trust, capability, and finally enforcement with evidence capture.

20. Reference Architecture
End-to-end reference architecture

Figure 6. The full path from a human or organizational principal, through agent and agent-run identity, the Agent Policy Decision Engine, the Capability Broker, and the MCP/API Policy Enforcement Point, to the resource. This extends the general Policy Enforcement Point / Policy Decision Point pattern from NIST's Zero Trust Architecture [1] with agent-specific decision inputs.

20.1 Prototype Component Architecture
The following describes an architecture-only prototype, meaning component boundaries and interfaces, not a running implementation. Building an actual system is left as future work, but naming the pieces concretely is still useful, since it forces the design to say what data each component needs and where the P1 through P9 properties from Section 14.6 would actually get checked.

The Agent Policy Decision Engine in Figure 6 is really fed by three inputs that are worth naming separately rather than leaving implicit. An objective registry stores the declared objective as a signed record, created when a human or upstream system defines the task, specifically to close the gap flagged in Section 24 where an attacker able to rewrite the declared objective could bypass every downstream check no matter how good the decision engine is. A context provenance service tags every piece of ingested content, retrieved documents, tool outputs, peer-agent messages, as trusted or untrusted before it becomes part of the AAE's context set, which is what makes P3 enforceable in the first place. A signal bus, built along the lines of the CAEP pattern described in Section 7.11, carries revocation-relevant events, session revoked, risk elevated, objective invalidated, into the decision engine so that P9 is something the architecture actually does rather than something the paper merely asserts.

The Capability Broker is where delegation actually happens. When an agent delegates to a sub-agent or a peer, including an A2A call, this is the same component issuing the child's attenuated AAE, there's no separate delegation service, delegation is just another capability-issuance request with a non-empty parent chain, consistent with the single-control-point decision in Section 16.

The MCP / API Policy Enforcement Point is the practical answer to Section 18's discussion of MCP as the agent-to-tool action boundary. Every tool call passes through it, and it's the only component with authority to actually let an action proceed. Downstream of it sits an evidence store, append-only and not writable after the fact by the decision engine, the agent, or an administrator, which is what P7 requires and what makes the cross-agent cascade case in Abuse Case 4 investigable at all.

What this section deliberately does not do is specify where the decision engine's policy logic itself should live (OPA, Cedar, and OpenFGA, all already referenced in Section 22, are candidates) or how the semantic alignment judgment behind P1 and P6 should actually be computed. Both are open implementation questions, not solved details, and Section 24 says so directly.

21. Threat Model
The threat categories developed in this section draw on and extend the OWASP MCP Top 10 [8], the OWASP Top 10 for Agentic Applications [10], and MITRE ATLAS [22], mapped specifically onto the CIBC control layers.

21.1 Threat Actors
Potential threat actors include:

external attackers;
malicious users;
compromised users;
malicious MCP server operators;
compromised tool providers;
insider threats;
compromised agents;
malicious sub-agents;
malicious or spoofed peer agents, meaning an A2A-reachable agent presenting a valid but attacker-controlled Agent Card;
attackers capable of injecting indirect instructions;
attackers orchestrating propagation across a chain of agents rather than compromising a single one.
21.2 Primary Threat Categories
T1: Prompt Injection
Untrusted content manipulates the agent into performing an unintended action.

T2: Tool Poisoning
Malicious instructions are embedded in:

tool descriptions;
schemas;
annotations;
results.
T3: Excessive Standing Privilege
An agent possesses authority it does not currently require.

T4: Delegation Escalation
A child agent receives greater authority than the delegating agent.

T5: Objective Drift
The agent's actions gradually move outside the original authorized objective.

T6: Context Confusion
Untrusted decision context is incorrectly treated as trusted authorization context.

T7: Sequence Abuse
Individually authorized actions combine into an unauthorized outcome.

T8: Credential Replay
A capability or token is reused outside its intended execution.

T9: Tool Substitution
A malicious or shadow tool impersonates a legitimate integration.

T10: Audit Evasion
An attacker causes an action without sufficient evidence to reconstruct why it occurred.

T11: Inter-Agent Communication Compromise
A message, task delegation, or context payload exchanged between agents, for instance over A2A, is spoofed, tampered with, or comes from a malicious peer agent whose identity metadata looks valid but isn't. This maps to OWASP's ASI07. Under the design decision made in this paper (Section 16), a peer agent's identity claim is not treated as authorization by itself, it's just another piece of context. In practice this means T11 doesn't need its own bespoke control, it's enforced through the same mechanisms as T4 and T6: an inter-agent handoff is really just a request for a new, attenuated AAE, and the peer's Agent Card is evidence to be verified, not proof of anything.

T7 extended: Cascading and Cross-Agent Sequence Abuse
OWASP's ASI08 describes cascading failures, where a problem in one agent propagates and amplifies across a delegation or communication chain. On reflection this isn't really a twelfth, separate threat category, it's the same underlying pattern as T7 (individually valid actions combining into an unauthorized outcome) at a different scope: within one agent's action sequence versus across several agents' sequences. T7 is therefore treated here as covering both the single-agent and cross-agent cases, with the cross-agent case mapped to ASI08 for traceability. The distinguishing feature of the cross-agent case is that no single agent in the chain necessarily does anything locally unreasonable, each one's action is a sensible response to what it was told by the agent before it, and the harm only becomes visible at the level of the whole chain. Section 21.6 below (Abuse Case 4) works through a concrete version of this.

21.3 Validated Incident Mapping
The threat categories above are not hypothetical. The table below ties several of them to documented, real incidents, which is worth doing since a threat model that only ever describes abstract categories is easy to dismiss as academic.

Threat	Incident	What happened
T1 / T11	EchoLeak (CVE-2025-32711)	Zero-click data exfiltration from Microsoft 365 Copilot via indirect prompt injection in email content.
T2	GitHub MCP exploit	Malicious tool metadata compromised coding agents connected through MCP.
T2 / T3	Amazon Q compromise	A coding assistant with hundreds of thousands of installs was weaponized through a compromised extension and credentials.
T3 / T7	Replit production database deletion	An agent exercised standing delete privilege well beyond what its actual task required, during a code freeze, with no effective containment.
T6	Academic peer-review manipulation	Instructions hidden with invisible fonts inside paper text were used to manipulate AI-assisted reviewers into favorable evaluations.
T3 / T8	Amazon Bedrock memory poisoning	Poisoned context persisted across session boundaries, functioning as a kind of replayed credential for later runs.
21.4 A Note on Threat Severity
OpenAI, Anthropic, and Google DeepMind have each said, in various 2025 publications, that prompt injection (T1) cannot be fully solved at the model level. Any instruction telling a model to disregard injected content is itself just more text that sufficiently adversarial content could talk it out of following. That's not a comfortable premise, but it's also the strongest reason this paper has for treating authorization as necessary rather than a nice-to-have, if better prompting alone would eventually fix this, the case for CIBC would be considerably weaker.

21.5 Attack Trees
Full attack trees for all ten-plus threat categories would be excessive for a paper at this stage, so the trees below go deep on the four or five categories that carry the most weight, T1, T3, T4, and T7, with the remaining categories covered more briefly afterward. Nodes marked OR mean any one child achieves the parent goal; AND means all children are required together.

T1, Prompt Injection to Agent Goal Hijack. The attacker's goal is to redirect the agent's action away from its authorized objective. Direct injection, where the attacker is the actual authenticated principal, is out of scope here since that's a conventional access-control problem, not a T1 problem. The indirect path is where this gets interesting: the attacker embeds an instruction in content the agent will process (visibly, concealed through invisible fonts or hidden metadata, which the "in the wild" research found accounts for the large majority of real cases, or through a tool's own output), the agent is exposed to that content during a normal step like retrieval or a tool call, and then the deciding factor is whether the system treats that retrieved content as authorization-relevant or merely decision-relevant. That last branch is really the whole ballgame. If context is correctly classified as untrusted, the injected instruction can still shape what the agent decides to attempt, but it can't by itself satisfy an authorization check. There's a second, less obvious branch too: an attacker manipulating the declared objective itself, not the surrounding context, which needs its own control (signed objective metadata) distinct from context-trust classification. EchoLeak is the real-world anchor for the concealed-instruction branch.

T3, Excessive Standing Privilege. The attacker's goal is simply for the agent to hold authority it shouldn't currently have. This can happen because the agent was over-provisioned at deployment and no run-scoped narrowing exists, because a capability outlives the objective it was issued for even though it started out correctly scoped, or because privilege was inherited through an unattenuated delegation (which folds into T4). Replit's database deletion is the anchor here, standing delete privilege the investigation task never actually needed.

T4, Delegation Escalation. The goal is for a sub-agent to end up with more effective authority than was intended. The most common path is a delegation mechanism that copies the parent's full scope by default instead of attenuating it. A second path is a delegation chain with no depth or graph validation, so small over-grants compound across several hops. A third, which is where T11 collapses in given the design decision to treat all inter-agent calls through the same AAE control point, is a spoofed or malicious peer agent being delegated to in the first place. The important compound case is that an attacker doesn't need to compromise the top-level agent at all, compromising any single hop in a long chain is enough if attenuation isn't enforced at every hop, which is the strongest argument for making attenuation a structural, per-hop property rather than a one-time check at the root.

T7, Sequence Abuse. The goal is for a series of individually-authorized actions to combine into something unauthorized. Within a single agent run, this looks like the search, read, export, encode, send pattern described earlier in Section 15, each step fine on its own, the sequence is the exfiltration. A second path splits that sequence across multiple runs of the same agent specifically to dodge a per-run action budget, which is a real gap since a budget scoped to one run won't catch an attacker who just waits for the next run to continue. A third path splits the sequence across multiple different agents so that no single agent's own action list looks abusive, this is functionally the cross-agent case discussed above, each agent's local list passes review, but the chain-level pattern is the actual attack.

The remaining categories are covered more briefly. T2 (Tool Poisoning) branches into a malicious tool description, a malicious schema, or malicious result content, all converging on the same control: independent verification of a tool's trustworthiness rather than trusting the tool's own self-description. T5 (Objective Drift) requires a broad objective, no re-evaluation checkpoint, and context that gradually shifts interpretation, all together. T6 (Context Confusion) shares its root cause with T1's second branch. T8 (Credential Replay) is either a token reused outside its execution window or reused by a different run. T9 (Tool Substitution) is either a shadow tool registered under a trusted name or a man-in-the-middle on a tool registry lookup. T10 (Audit Evasion) is either evidence not captured at decision time, or captured but mutable afterward.

21.6 Abuse-Case Analysis
The attack trees above are abstract by design. The scenarios below put a name and a concrete situation to a few of them so the difference between holding a permission and appropriately using it is easier to see.

Abuse Case 1, "The Helpful Summary" (T1 / T6). A SOC analyst asks their agent, authorized under a SOC_AGENT role with read_logs, read_identity_events, and create_security_finding, to investigate a suspicious login. The alert references an email from the same session. The agent retrieves it to build context. The email body contains a concealed instruction telling the agent to forward its findings to an external address "for review." Nothing about the agent's identity or role was ever violated, read_logs and reading the email are both permitted, so a conventional IAM check finds nothing wrong. Under CIBC, the email is tagged untrusted at ingestion, and when the agent's next proposed action (send externally) is checked against the AAE's declared objective, it fails, not because the tool call itself is disallowed, but because the instruction behind it traces to untrusted context rather than to the authorized objective.

Abuse Case 2, "The Cooperative Sub-Agent" (T4). An orchestrator agent investigating an incident is allowed to delegate to specialized sub-agents. Its delegation mechanism copies its full scope by default rather than narrowing it, so a remediation agent spun up only to draft a recommendation ends up holding isolate_endpoint and disable_users capabilities it never needed. A later injection compromises that remediation agent's reasoning through a poisoned log entry, and it now has more than enough standing authority to act on it. Delegation here was legitimate, no unauthorized principal was created, so conventional IAM misses it too. Under attenuation, the remediation agent's AAE would have been scoped at issuance to only what its actual sub-objective required, so even after the injection compromises its reasoning, it has nothing destructive to act with.

Abuse Case 3, "Death by a Thousand Authorized Steps" (T7, single-agent). An HR-support agent authorized for search_employee_directory, read_employee_records, and export_records (for legitimate batch reporting) is steered, through a manipulated support ticket, through the exact search, read, export, encode, send pattern from Section 15. Every step passes on its own. Stateful, sequence-aware authorization is what catches this, evaluating the cumulative action set against the declared objective rather than checking each request in isolation.

Abuse Case 4, "The Chain Nobody Owned" (T7, cross-agent). A triage agent flags an alert, delegates to an analysis agent, which delegates to a notification agent that alerts stakeholders. A single poisoned indicator enters at triage. Each agent's own action is a reasonable response to what it received from the one before it, triage's flag-and-delegate is reasonable given the (already poisoned) input, analysis's output is reasonable given triage's output, notification's alert is reasonable given analysis's output. No single agent behaved unreasonably, and every individual log looks clean. This is arguably the hardest case in the whole threat model, and it's worth being honest that CIBC does not prevent this outright at any single point, the harm is genuinely emergent across the chain. What it does provide is a chained, provenance-linked AAE lineage across every hop (Section 7.8, Figure 10), which makes the cascade investigable after the fact in a way that a set of independently clean local logs never could be, and it argues for a policy layer that periodically re-checks whether a long chain's net trajectory still lines up with the root objective, not just each hop's local delegation. This limitation is restated plainly in Section 24 rather than left implicit.

22. Security Control Matrix
Threat	Primary Control	Secondary Control
Prompt Injection	Context provenance	Capability constraints
Tool Poisoning	Tool trust validation	Independent policy enforcement
Excessive Privilege	Dynamic capability issuance	Short TTL
Delegation Escalation	Authority attenuation	Delegation graph validation
Objective Drift	Objective-bound authorization	Continuous evaluation
Context Confusion	Decision/authorization separation	Trust classification
Sequence Abuse	Stateful authorization	Action budgets
Credential Replay	Run-bound capabilities	TTL and single use
Tool Substitution	Tool identity verification	Registry trust
Audit Evasion	Immutable evidence	External verification
22.1 Evaluation Methodology
Each of the nine properties in Section 14.6 should map to a constructive test, meaning deliberately try to build a run that violates the property and confirm the architecture rejects it. That's weaker than a formal proof, but it's considerably stronger than leaving "the design should prevent this" unstated, and it's a reasonable level of rigor for a working paper rather than a verified system. A P2 test, for example, would attempt to issue a child AAE whose capability set is not a subset of the attenuated parent set, and the pass criterion is that the AAE issuer refuses issuance at request time rather than only catching the problem later at enforcement. A P6 test would run the five-step search, read, export, encode, send sequence from Section 15 where each step passes an isolated check, and the pass criterion is that the sequence gets flagged before the final step, using the accumulated action history rather than the current action alone.

The harder point, and one this paper should not gloss over, is that P3 and P6 in particular cannot be evaluated only against a fixed, known-in-advance set of attacks. The adaptive-attack research referenced in Section 7.13 found that defenses which look robust against standard benchmarks tend to fail once an attacker is allowed to adapt. So the evaluation methodology needs two tiers: a fixed regression suite covering the constructions above, run on every architecture change, and a second, adaptive tier where a red-teaming agent or a human researcher actively tries to construct new violations, closer to how prior indirect-injection defenses were broken in practice. A framework that only reports results from the first tier shouldn't claim robustness, that distinction is worth stating outright rather than leaving implied. AgentDojo and InjecAgent, both established dynamic environments for evaluating prompt-injection attacks and defenses against tool-using agents, are a reasonable starting point to extend with AAE-aware instrumentation rather than building a new benchmark from nothing.

For the two properties that depend most on a semantic alignment judgment, P1 and P6, a plain pass or fail isn't quite enough. Worth reporting separately: a false-accept rate (objective-misaligned actions the decision engine incorrectly permits) and a false-reject rate (legitimate actions incorrectly blocked, which is really the policy-explosion-versus-operational-complexity tension from Section 24 made measurable). Both rates should be broken out under fixed and adaptive conditions separately, since a defense that only looks good under fixed conditions is exactly the failure mode the adaptive-attack literature warns about.

22.2 Performance and Scalability Analysis
This section is necessarily more speculative than the evaluation methodology above, there's no running implementation to measure yet, so it's framed as a latency budget and a set of scaling risks rather than presented as data.

Every control-plane hop in the architecture described in Section 20.1 adds latency compared to a direct agent-to-tool call. AAE issuance happens once per run or per delegation, so it's the least latency-sensitive step. Decision engine evaluation happens once per proposed action and is the hot path, the expensive part is the semantic alignment checking behind P1 and P6 if it requires anything beyond deterministic rule matching, which is the same tension flagged in Section 24 now showing up as a performance concern rather than just an accuracy one. Enforcement point checks should be close to zero marginal cost if the decision is already attached to the action rather than recomputed. Evidence writes are cheap as append-only operations, though the durability guarantee behind P7, that a record survive even a compromised component, may require synchronous replication, which is the more likely source of latency than the write itself.

The biggest open question is whether the objective-alignment check behind P1 and P6 can run at interactive speed for every tool call in a fast-moving agent loop, or whether it needs to be a coarser check applied per window of actions rather than per action, trading some precision for throughput. That tradeoff should be named directly rather than assumed away.

A few other scaling risks are worth naming without pretending they're solved. Delegation chain depth (P8) is linear in chain length if attenuation is recomputed from the root at every hop, implementations should cache the attenuated bound at each hop instead. Long-running agents need a bounded window or a summarization strategy for the action history behind P6, or evaluation cost grows without limit as a run continues. The signal bus from Section 20.1 needs to reach every live decision-engine instance holding a relevant AAE, which at enterprise scale is the same fan-out problem CAEP itself was built to solve, one more reason to build on it rather than invent something bespoke. And the evidence store's immutable records will accumulate to a genuinely large volume at agentic scale, which needs a retention policy that doesn't quietly compromise P7's guarantee for records still inside their audit window.

No throughput numbers, no concurrency model, and no baseline comparison against, say, a conventional OAuth-scoped service account with no CIBC layer, exist yet. These are engineering risks the architecture has to account for, not results, and producing actual numbers requires the prototype to exist, which is explicitly out of scope for this architecture-only phase.

23. Contribution to Knowledge
The proposed contribution of this research is not the invention of:

Zero Trust;
IAM;
capabilities;
delegation;
context-aware authorization;
MCP security.
These concepts already exist.

The proposed contribution is their synthesis into an agent-specific security framework.

Contribution 1: Separation of Identity From Authorized Agency
The framework distinguishes:

Who the agent is
from:

What this particular agent execution may do now.
Contribution 2: Intent Without Mind Reading
The framework avoids unverifiable claims about an LLM's hidden reasoning.

It replaces:

True Intent Detection
with:

Declared Objective
        +
Policy Constraints
        +
Action Alignment
Contribution 3: Agent Run as a Security Principal
The relevant authorization subject becomes:

Persistent Agent Identity
        +
Ephemeral Agent Run Identity
        +
Delegated Authority
        +
Objective
Contribution 4: Context as Both Evidence and Attack Surface
The framework distinguishes:

Context that informs the agent
from:

Context trusted by the authorization system.
Contribution 5: Purpose-Bound Capability Issuance
Authority is dynamically issued as:

narrow;
short-lived;
target-specific;
objective-bound;
constrained;
auditable.
Contribution 6: Sequence-Aware Authorization
The model investigates:

Can the agent perform Action X?
and also:

Should the agent perform Action X
after Actions A through W?
24. Limitations and Open Questions
The proposed framework introduces its own challenges.

24.1 Objective Ambiguity
Broad objectives may still permit multiple interpretations.

Example:

"Contain the security incident."
The system must define what actions belong to containment.

24.2 Objective Manipulation
An attacker may attempt to manipulate:

the declared objective;
objective metadata;
approval state;
incident scope.
The objective itself therefore becomes a security-sensitive object.

24.3 Context Provenance Complexity
Capturing provenance across:

documents;
APIs;
agents;
tools;
transformations;
memory;
may be computationally and architecturally complex.

24.4 Policy Explosion
Fine-grained policies may become difficult to manage.

A successful implementation must balance:

Security
against:

Operational Complexity
24.5 Semantic Alignment Limitations
A deterministic policy engine may struggle to determine whether:

Action X
semantically aligns with:

Objective Y
This may require:

predefined action classes;
policy taxonomies;
deterministic mappings;
secondary model review;
human approval.
A model should not become the sole authority responsible for determining whether its own action is authorized.

25. Future Research Directions
Further research should investigate:

cryptographically signed agent objectives;
run-bound identity credentials;
purpose-bound capability tokens;
context provenance graphs;
agent-to-agent delegation protocols;
objective attenuation;
sequence-aware authorization engines;
semantic action classification;
policy languages for agent objectives;
verifiable authorization evidence;
capability revocation;
agent behavior anomaly detection;
cross-organizational delegation;
integration with MCP [3][4];
integration with SPIFFE/SPIRE [7];
OAuth Rich Authorization Requests [5];
GNAP and future delegated authorization models;
relationship-based access control [18];
policy engines such as OPA [24], Cedar [25], and OpenFGA [26];
formal verification of delegation and authority boundaries.
26. Preliminary Hypotheses
Persistent agent identities with standing permissions create unnecessary authority exposure compared with dynamically scoped agent-run capabilities.

Binding authority to a declared objective can reduce unauthorized capability use even when an agent's execution path is unpredictable.

Separating decision context from authorization context reduces the likelihood that indirect prompt injection can directly create authority.

Capability attenuation provides a safer delegation model for multi-agent systems than unrestricted inheritance of standing permissions.

Sequence-aware authorization can detect classes of misuse that isolated request-level authorization cannot.

The effectiveness of intent-bound authorization depends on representing intent as an explicit, constrained objective rather than attempting to infer hidden model reasoning.

27. Conclusion
The emerging AI-agent security problem cannot be solved merely by assigning a service account to an agent and applying conventional least privilege.

That approach remains necessary.

It is not necessarily sufficient.

The fundamental difference is:

Traditional software generally executes authority according to predefined logic. AI agents dynamically determine how authority should be exercised.

This creates a separation between:

Possessing Authority
and:

Appropriately Exercising Authority
This paper proposes that future AI-agent security should move toward a model in which:

IAM establishes identity.
Delegation establishes the source of authority.
Objectives establish the authorized purpose.
Context provenance establishes what information influenced an action.
Policy evaluates the proposed exercise of authority.
Capabilities provide narrowly scoped execution rights.
Continuous controls evaluate changing conditions and action sequences.
Evidence preserves the authorization basis of autonomous actions.
The central principle is:

An AI agent should not possess broad authority merely because it may eventually need it. It should receive authority when an independently enforced policy determines that a specific action is appropriate within a bounded objective, context, and risk condition.

The security question therefore changes from:

Who is allowed to act?

to:

Who is acting, for whom, toward what authorized objective, based on what context, with what bounded capability, under what conditions—and can the system prove it afterward?

This transition—from identity management toward authorized agency—may become a foundational problem in the security architecture of autonomous systems.

28. Research Phase Log
All items originally listed below as the next research phase have now been researched, verified against live sources, and integrated into the relevant sections above. The checklist is kept here as a record of what was checked and where it landed in the paper, rather than deleted, since a reader auditing this paper's claims should be able to see what was verified and when. A small number of the original document's pre-existing citations were also re-verified during this pass; see the note appended to the reference list.

 NIST publications on AI-agent identity and authorization. (validated existence of SP 800-63-4 and related identity guidance)
 NIST Zero Trust Architecture and related publications. (SP 800-207 confirmed; SP 800-207A and SP 1800-35 also available)
 NIST AI Risk Management Framework. (AI RMF 1.0 confirmed)
 OWASP Top 10 for Agentic Applications. (confirmed: published December 9, 2025 by the OWASP GenAI Security Project, ASI01 through ASI10; see Section 7.9 and reference [37])
 OWASP MCP security guidance. (MCP Top 10 project and Cheat Sheet confirmed active)
 Full MCP specification and authorization specification. (spec versions including 2025-06-18 and later 2026 variants confirmed at modelcontextprotocol.io)
 MCP security threat research and empirical studies. (arXiv papers and OWASP MCP Top 10 risk catalog validated)
 OAuth 2.1 and Rich Authorization Requests. (RFC 9396 confirmed)
 GNAP and emerging authorization frameworks. (confirmed finalized, not emerging: RFC 9635, October 2024, plus RFC 9767; see Section 7.10 and reference [29])
 SPIFFE/SPIRE workload identity. (spiffe.io and SVID model confirmed)
 Capability-based security literature.
 Macaroons. (Birgisson et al. NDSS 2014 confirmed)
 WAVE. (Andersen et al. USENIX Security 2019 confirmed)
 Proof-carrying authorization. (Appel & Felten CCS 1999 confirmed)
 Usage Control and UCON. (Park & Sandhu TISSEC 2004 confirmed)
 Relationship-Based Access Control. (Zanzibar / OpenFGA lineage confirmed)
 Attribute-Based Access Control. (NIST SP 800-162 confirmed)
 Continuous access evaluation. (confirmed: OpenID CAEP 1.0 and the Shared Signals Framework, both final specs; see Section 7.11 and reference [30])
 Context provenance systems. (confirmed, but split into two distinct threads, artifact provenance via C2PA and execution/decision provenance, the latter still pre-standards; see Section 7.12 and references [31], [32])
 Prompt injection research. (OWASP GenAI and MITRE ATLAS confirmed)
 Indirect prompt injection research. (confirmed: formalized by Greshake et al. 2023, with real 2025 incidents including EchoLeak; see Section 7.13, Section 21.3, and reference [33])
 Tool poisoning research. (documented in MCP Top 10 MCP03 and empirical surveys)
 Agent-to-agent delegation research. (confirmed: Google's A2A protocol, v1.0.1, now under the Linux Foundation; independent analysis finds it handles authentication but not fine-grained authorization; see Section 7.14 and references [34], [35])
 Agent identity standards and emerging specifications. (confirmed active and unsettled, not a fixed standard; see Section 7.14 and reference [36])
 Formal threat model. (T1–T10 extended with T11 and a cross-agent extension of T7, threat actors updated, incident mapping added; see Sections 21.1–21.4)
 Attack trees. (deep coverage for T1, T3, T4, T7; brief coverage for the remainder; see Section 21.5)
 Abuse-case analysis. (four narrative cases built directly from the attack trees, including an explicit statement of what CIBC does not prevent; see Section 21.6)
 Formal security properties. (nine properties, P1–P9, stated as operationalized invariants rather than proven theorems, with an explicit note on what they don't cover; see Section 14.6)
 Prototype reference implementation. (architecture-only, by design decision, not running code: component boundaries and interfaces added; see Section 20.1)
 Evaluation methodology. (P1–P9 mapped to constructive tests, with an explicit two-tier fixed/adaptive requirement; see Section 22.1)
 Performance and scalability analysis. (framed as a latency budget and named scaling risks, explicitly not measured results; see Section 22.2)
References and Research Base
The references below are organized by category and numbered for inline citation throughout this paper (e.g., [1], [12]). Each entry lists the primary source and its canonical URL as of August 2026. Standards, specifications, and vendor documentation evolve; where a source is versioned (e.g., the MCP specification), the version consulted is noted explicitly.

Standards and Primary Sources
[1] National Institute of Standards and Technology. SP 800-207: Zero Trust Architecture. 2020.
https://csrc.nist.gov/pubs/sp/800/207/final

[2] National Institute of Standards and Technology. SP 800-63-4: Digital Identity Guidelines. 2025.
https://csrc.nist.gov/pubs/sp/800/63/4/final

[3] Model Context Protocol. Specification (version 2026-07-28, current as of this writing; version 2025-06-18 was consulted in earlier drafts of this paper and is now two revisions behind).
https://modelcontextprotocol.io/specification/2026-07-28

[4] Model Context Protocol. Authorization (Base Protocol, version 2026-07-28; note the protocol added native OAuth 2.1 support for its HTTP transport in January 2026, which postdates the version originally cited here).
https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization

[5] Internet Engineering Task Force. RFC 9396: OAuth 2.0 Rich Authorization Requests. 2023.
https://www.rfc-editor.org/rfc/rfc9396

[6] OAuth.net. OAuth 2.1 Authorization Framework (consolidated draft of OAuth 2.0 security best practices).
https://oauth.net/2.1/

[7] SPIFFE Project. SPIFFE and SPIRE: Workload Identity Specification and Documentation.
https://spiffe.io/ and https://spiffe.io/docs/latest/spire-about/

Security Frameworks
[8] OWASP Foundation. OWASP MCP Top 10 (MCP01:2025–MCP10:2025, living document; note this project is still in an incubator stage, described by OWASP as version 0.1 undergoing pilot testing, not a finished flagship standard, and category definitions have shifted between drafts).
https://owasp.org/www-project-mcp-top-10/

[9] OWASP Cheat Sheet Series. MCP Security Cheat Sheet.
https://cheatsheetseries.owasp.org/cheatsheets/MCP_Security_Cheat_Sheet.html

[10] OWASP GenAI Security Project. OWASP Top 10 for Agentic Applications (ASI01–ASI10, 2026).
https://genai.owasp.org/

[11] National Institute of Standards and Technology. AI Risk Management Framework (AI RMF 1.0). 2023.
https://www.nist.gov/itl/ai-risk-management-framework

Academic and Technical Research
[12] Birgisson, A., Politz, J. G., Erlingsson, Ú., Taly, A., Vrable, M., & Lentczner, M. Macaroons: Cookies with Contextual Caveats for Decentralized Authorization in the Cloud. NDSS 2014.
https://research.google/pubs/macaroons-cookies-with-contextual-caveats-for-decentralized-authorization-in-the-cloud/

[13] Andersen, M. P., Kumar, S., AbdelBaky, M., Fierro, G., Kolb, J., Kim, H. S., Culler, D. E., & Popa, R. A. WAVE: A Decentralized Authorization Framework with Transitive Delegation. 28th USENIX Security Symposium, 2019, pp. 1375–1392.
https://www.usenix.org/conference/usenixsecurity19/presentation/andersen

[14] Appel, A. W., & Felten, E. W. Proof-Carrying Authentication. 6th ACM Conference on Computer and Communications Security (CCS), 1999, pp. 52–62.
https://www.cs.princeton.edu/~appel/papers/says.pdf

[15] Bauer, L., Garriss, S., & Reiter, M. K. Distributed Proving in Access-Control Systems. IEEE Symposium on Security and Privacy, 2005. (Representative of the delegation-graph and provenance-based authorization literature referenced in Section 7.8.)
https://ieeexplore.ieee.org/document/1425064

[16] National Institute of Standards and Technology. SP 800-162: Guide to Attribute Based Access Control (ABAC) Definition and Considerations. 2014.
https://csrc.nist.gov/pubs/sp/800/162/final

[17] Park, J., & Sandhu, R. The UCON_ABC Usage Control Model. ACM Transactions on Information and System Security (TISSEC), 7(1), 2004, pp. 128–174.
https://dl.acm.org/doi/10.1145/984334.984339

[18] Zanzibar / Google Research. Zanzibar: Google's Consistent, Global Authorization System. USENIX ATC 2019. (Representative implementation of Relationship-Based Access Control referenced in the delegation model.)
https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/

Contemporary Related Work
[19] Huang, K. Proof-of-Control for Model Context Protocol.
https://kenhuangus.substack.com/p/proof-of-control-for-model-context

[20] Hou, X., Zhao, Y., Wang, S., & Wang, H. Model Context Protocol (MCP): Landscape, Security Threats, and Future Research Directions. arXiv:2503.23278, 2025.
https://arxiv.org/abs/2503.23278

[21] Li, X., & Gao, X. A First Look at the Security Issues in the Model Context Protocol Ecosystem. arXiv:2510.16558, 2025.
https://arxiv.org/abs/2510.16558

[22] MITRE Corporation. MITRE ATLAS: Adversarial Threat Landscape for Artificial-Intelligence Systems.
https://atlas.mitre.org/

MCP Ecosystem
[23] Model Context Protocol. GitHub Repository (specification source and SDKs).
https://github.com/modelcontextprotocol/modelcontextprotocol

Policy Engines and Implementation References
[24] Open Policy Agent. Documentation.
https://www.openpolicyagent.org/

[25] Cedar Policy Language.
https://www.cedarpolicy.com/

[26] OpenFGA (a Relationship-Based Access Control engine inspired by Zanzibar).
https://openfga.dev/

AI Agent Architecture
[27] Anthropic. Building Effective Agents.
https://www.anthropic.com/research/building-effective-agents

[28] National Institute of Standards and Technology. AI RMF Playbook.
https://airc.nist.gov/airmf-resources/playbook/

Second Research Phase Sources
The entries below were added during the second research pass (Section 28) and cover the fourteen previously unverified items.

[29] Internet Engineering Task Force. RFC 9635: Grant Negotiation and Authorization Protocol (GNAP). October 2024, with companion RFC 9767: GNAP Resource Server Connections, 2025.
https://datatracker.ietf.org/doc/html/rfc9635

[30] OpenID Foundation. Continuous Access Evaluation Profile (CAEP) 1.0 and Shared Signals Framework 1.0, final specifications.
https://openid.net/specs/openid-caep-1_0-final.html

[31] Coalition for Content Provenance and Authenticity. C2PA Technical Specification, v2.3, December 2025.
https://spec.c2pa.org/

[32] "From Agent Traces to Trust: A Survey of Evidence Tracing and Execution Provenance in LLM Agents." arXiv, 2026. (Cited as the closer academic analogue to this paper's context-provenance and delegation-graph model than C2PA; the specific arXiv identifier should be confirmed against the current listing before formal citation.)

[33] Greshake, K., et al. Not What You've Signed Up For: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection. 2023 (original formalization of indirect prompt injection). Zhan, Q., et al. Adaptive Attacks Break Defenses Against Indirect Prompt Injection Attacks on LLM Agents. NAACL 2025 Findings.

[34] Google. Agent2Agent (A2A) Protocol Specification, v1.0.1, donated to the Linux Foundation.
https://a2a-protocol.org/

[35] "Governance Gaps in Agent Interoperability Protocols: What MCP, A2A, and ACP Cannot Express." arXiv, 2026. (Independent analysis concluding that none of the three protocols specify authorization at sufficient granularity; the specific arXiv identifier should be confirmed against the current listing before formal citation.)

[36] "AI Identity: Standards, Gaps, and Research Directions for AI Agents." arXiv:2604.23280, April 2026.
https://arxiv.org/abs/2604.23280

[37] OWASP GenAI Security Project. OWASP Top 10 for Agentic Applications for 2026, published December 9, 2025 (see also [10]).
https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/

[38] Documented incident sources referenced in Section 21.3: CVE-2025-32711 (EchoLeak, Microsoft 365 Copilot), the GitHub MCP exploit, the Amazon Q coding-assistant compromise, the Replit production-database deletion, the academic peer-review manipulation via hidden instructions, and the Amazon Bedrock persistent memory-poisoning report. These are drawn from contemporaneous security reporting rather than a single peer-reviewed source and should each be independently re-confirmed before formal publication, a caveat noted here directly rather than left implicit.

A note on [32] and [35]: both papers were located and their substance verified through search during this research pass, but their exact arXiv identifiers were not independently re-confirmed against the live arXiv listing at time of writing. Both should be re-verified before this paper is finalized for publication; this is flagged here rather than presenting an unconfirmed identifier as settled.

Note on Original Contribution
The Context-Aware, Intent-Bound Capability Control (CIBC) framework and the Agent Action Envelope (AAE) construct proposed in Sections 13 and 19 of this paper are original conceptual contributions synthesized from the sources above; they are not themselves existing standards, and no citation in this list should be read as an endorsement of CIBC or the AAE by the cited source. All specification and standards references reflect the versions available as of August 2026 and should be re-verified against the current publication before any formal citation, since specifications such as MCP are under active revision. A second research pass, covering the fourteen items previously listed in Section 28 as well as a spot check of the original reference list, was completed in August 2026; two issues were found and corrected (an outdated MCP specification version cited in [3]/[4], and a missing maturity caveat on the OWASP MCP Top 10 in [8]), and two new sources ([32], [35]) are flagged as needing their arXiv identifiers reconfirmed before formal publication. No other factual errors were found in the original reference list during this pass, though not every entry was independently re-fetched, see the individual verification notes in Section 28 for what was and wasn't checked.