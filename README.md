# Agentic SDLC Marketplace

A Claude Code plugin marketplace containing the **agentic-sdlc** plugin — a multi-agent SDLC pipeline that takes a plain-language requirement and produces a runnable .NET + React application.

## Pipeline overview

```mermaid
flowchart TD
    User([User<br/>provides requirement])

    subgraph Planning["Planning phase - bidirectional"]
        direction TB
        BA["Business Analyst<br/>drafts req spec"]
        BAV["BA Validator<br/>checks vs raw requirement"]
        UR1{{User review}}
        Arch["Architect<br/>drafts tech spec"]
        ArchV["Architect Validator<br/>checks vs req spec"]
        UR2{{User review}}
        TL["Tech Lead<br/>drafts stories"]
        TLV["Tech Lead Validator<br/>checks vs tech spec"]
        UR3{{User review}}

        BA <-->|"loop until req spec<br/>is complete"| BAV
        BAV --> UR1
        UR1 -- rejects --> BA
        UR1 -- approves --> Arch
        Arch <-->|"loop until tech spec<br/>traces to req spec"| ArchV
        ArchV --> UR2
        UR2 -- rejects --> Arch
        UR2 -- approves --> TL
        TL <-->|"loop until stories<br/>cover tech spec"| TLV
        TLV --> UR3
        UR3 -- rejects --> TL
    end

    Freeze[/"Spec freeze - point of no return<br/>Story dispatch"/]

    subgraph Dev["Development phase - specs frozen"]
        direction LR
        subgraph DotNet[".NET track"]
            direction TB
            DNE[".NET Engineer"]
            DNR[".NET Reviewer"]
            DNTE[".NET Test Engineer"]
            DNTR[".NET Test Reviewer<br/>+ coverage"]
            DNE <-->|loop until clean| DNR
            DNR --> DNTE
            DNTE <-->|loop until passing| DNTR
        end
        subgraph ReactTrack["React track"]
            direction TB
            RE["React Engineer"]
            RR["React Reviewer"]
            RTE["React Test Engineer"]
            RTR["React Test Reviewer<br/>+ coverage"]
            RE <-->|loop until clean| RR
            RR --> RTE
            RTE <-->|loop until passing| RTR
        end
    end

    subgraph DevOps["DevOps phase - make it runnable"]
        direction TB
        DOE["DevOps Engineer<br/>build, wire, package"]
        DOR["DevOps Reviewer<br/>boots app, runs tests<br/>in clean env"]
        DOE <-->|"loop until app builds,<br/>boots, tests pass"| DOR
    end

    Final([Runnable application<br/>builds, boots, tests pass])

    User --> BA
    UR3 -- approves --> Freeze
    Freeze --> DNE
    Freeze --> RE
    DNTR --> DOE
    RTR --> DOE
    DOR -. cross-track bug .-> DNE
    DOR -. cross-track bug .-> RE
    DOR --> Final

    classDef phase fill:#f1efe8,stroke:#5f5e5a
    classDef agent fill:#eeedfe,stroke:#534ab7,color:#3c3489
    classDef gate fill:#faeeda,stroke:#854f0b,color:#633806
    classDef terminal fill:#e8f5e8,stroke:#2d5a2d
    class BA,BAV,Arch,ArchV,TL,TLV,DNE,DNR,DNTE,DNTR,RE,RR,RTE,RTR,DOE,DOR agent
    class UR1,UR2,UR3 gate
    class User,Final terminal
    class Freeze phase
```

## Install

```
/plugin marketplace add ecogs-sys/Agentic.SDLC
/plugin install agentic-sdlc@agentic-sdlc-marketplace
```

See [`plugins/agentic-sdlc/README.md`](plugins/agentic-sdlc/README.md) for usage.

## Repository structure

```
.claude-plugin/
  marketplace.json           ← marketplace manifest
plugins/
  agentic-sdlc/
    .claude-plugin/
      plugin.json            ← plugin manifest (name, version)
    agents/                  ← 16 subagent definitions
    skills/                  ← 8 reusable skill files
    commands/                ← 4 slash commands
    README.md                ← plugin user documentation
CHANGELOG.md
LICENSE
```

## Local development (testing without publishing)

```
/plugin marketplace add .
/plugin install agentic-sdlc@agentic-sdlc-marketplace
```

After making changes:
```
/plugin uninstall agentic-sdlc@agentic-sdlc-marketplace
/plugin install agentic-sdlc@agentic-sdlc-marketplace
```

## Contributing

1. Edit files in `plugins/agentic-sdlc/`.
2. Bump `version` in `plugins/agentic-sdlc/.claude-plugin/plugin.json`.
3. Add an entry to `CHANGELOG.md`.
4. Commit and tag the release (`v0.x.0`).
5. Push to GitHub.
