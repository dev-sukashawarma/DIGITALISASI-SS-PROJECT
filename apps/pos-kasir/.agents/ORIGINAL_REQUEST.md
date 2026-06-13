# Original User Request

## Initial Request — 2026-06-11T07:03:08Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Prepare the POS system for future integration with a facial recognition attendance system. The POS must automatically log in and open the dashboard when a successful attendance check-in occurs on a separate device.

Working directory: c:\Users\AK\Desktop\Project\DIGITALISASI-SS-PROJECT\apps\pos-kasir
Integrity mode: development

## Requirements

### R1. Attendance Waiting Screen
Create a "Waiting for Attendance" page/screen in the POS web application. This screen should actively listen (e.g., via WebSocket or polling) for a remote check-in success event targeted at its specific branch.

### R2. Auto-Login and Dashboard Transition
Upon receiving the check-in success event, the POS system must automatically authenticate the user and seamlessly transition to the main cashier dashboard.

### R3. Display Cashier Information
The dashboard must prominently display the username/label of the cashier who just checked in, along with the corresponding outlet/branch name based on the event payload.

### R4. Mock Event Trigger
Because the actual attendance system is being developed separately, create a simple simulation script (e.g., a Node.js script or curl command guide) to manually trigger the "attendance success" event and test the POS integration.

## Acceptance Criteria

### Auto-Login Verification
- [ ] Launching the POS application initially displays the "Waiting for Attendance" state.
- [ ] Executing the mock event trigger with a mock payload (user and branch data) causes the POS screen to automatically transition to the dashboard without manual interaction on the POS device.
- [ ] The resulting dashboard accurately reflects the cashier's name and branch as provided by the mock payload.
- [ ] The integration mechanism (e.g., API endpoint or WebSocket listener) is clearly documented so the other developer can easily call it when the real attendance system is ready.
