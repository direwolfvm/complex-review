# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains the database schema for the Permit Intelligence Center (PIC), a system for tracking NEPA (National Environmental Policy Act) environmental review processes, permits, and authorizations. The schema is designed for Supabase (PostgreSQL).

The SQL schema is derived from [GSA-TTS/pic-standards](https://github.com/GSA-TTS/pic-standards/tree/main/src/database) tag v1.2.0.

## Database Setup

1. Apply `database-schema/prod.sql` to create the initial schema
2. Apply `database-schema/schema-v1.0.0-to-1.2.0.sql` for v1.2.0 updates
3. Import CSV exports into corresponding tables (`decision_element`, `legal_structure`, `process_model`)
4. Create a Supabase storage bucket named `permit-documents`
5. Configure Row Level Security (RLS) policies - RLS is disabled by default

## Schema Architecture

**Core Entities:**
- `project` - Activities/decisions requiring NEPA review, with location and sponsor info
- `process_instance` - Specific environmental reviews, permits, or authorizations tied to projects
- `process_model` - Templates defining process workflows (BPMN) and screening criteria
- `document` - Environmental documents (EIS, EA, etc.) with metadata, TOC, and summaries

**Decision Framework:**
- `decision_element` - Conditions/criteria for process decisions, including spatial screening
- `process_decision_payload` - Responses and evaluation results for decision elements
- `legal_structure` - Laws, regulations, and policies governing processes

**Supporting Entities:**
- `case_event` - Milestones within NEPA reviews
- `engagement` - Public meetings, comment periods, consultations
- `comment` - Public/stakeholder feedback on documents
- `gis_data` / `gis_data_element` - Location-based data attached to any entity
- `user_role` - Access control definitions

**Key Relationships:**
- Projects contain multiple process instances
- Process instances link to a process model template
- Documents, case events, and engagements belong to process instances
- Decision elements belong to process models; payloads link elements to specific projects/processes
- GIS data can attach to any major entity via parent_*_id foreign keys

**Common Fields (added in v1.2.0):**
All tables include data provenance fields: `data_source_agency`, `data_source_system`, `record_owner_agency`, `data_record_version`, `last_updated`, `retrieved_timestamp`
