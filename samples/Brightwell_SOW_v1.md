--- Page 1 ---
STATEMENT OF WORK
Patient Booking Portal

Client: Brightwell Dental Group ("Brightwell")
Vendor: Lotus Dev Studio ("Vendor")
Client contact: Priya Raman, Director of Operations (projects@brightwelldental.example)
Version 1

--- Page 2 ---
1. Purpose
Brightwell runs twelve dental clinics and takes most bookings by phone. Brightwell wants
patients to book, move and cancel appointments online, and wants front-desk staff to see
every clinic's schedule in one place.

2. Fees and payment
2.1 The total fixed fee for this engagement is $72,000 (USD).
2.2 Fees are billed by milestone as set out in Section 5.
2.3 Each invoice is payable within 30 days of the invoice date (Net 30).
2.4 Vendor may pause work on the next milestone while an invoice is more than 10 days overdue.

--- Page 3 ---
3. Scope
3.1 Responsive patient web portal: search clinics, choose a dentist and time, book, move
and cancel appointments.
3.2 Staff dashboard showing the schedule for all twelve clinics, with filters by clinic and dentist.
3.3 Two-way sync with Brightwell's practice management system (DentaCore) so that booked
times never overlap.
3.4 Appointment confirmations and reminders by email and SMS.
3.5 Online deposits for new-patient appointments.

--- Page 4 ---
3.6 Out of scope: insurance claims, clinical records, native mobile apps, and migration of
historical appointment data older than 12 months.

4. Team and responsibilities
4.1 Vendor provides a project lead, a UX designer, two engineers and a QA engineer.
4.2 Brightwell provides a product owner who attends a weekly review and answers questions
within two business days.
4.3 Brightwell provides DentaCore sandbox credentials no later than November 30, 2026.

--- Page 5 ---
5. Payment schedule
5.1 M1 — Discovery and UX design. November 16, 2026 to November 27, 2026. Fee: $8,000.
5.2 M2 — Patient booking flow. November 30, 2026 to December 25, 2026. Fee: $18,000.
5.3 M3 — DentaCore sync and staff dashboard. December 28, 2026 to January 29, 2027. Fee: $22,000.
5.4 M4 — Reminders and online deposits. February 1, 2027 to February 26, 2027. Fee: $16,000.
5.5 M5 — Launch and 30-day support. March 1, 2027 to March 26, 2027. Fee: $8,000.

--- Page 6 ---
6. Acceptance criteria
6.1 M1 is accepted when (a) Brightwell's Director of Operations approves in writing a
clickable prototype of the patient booking flow, and (b) the design is intuitive and easy
for patients to use.
6.2 M2 is accepted when (a) a patient can book, move and cancel an appointment end to end
in the staging environment on current versions of Chrome, Safari, Edge and Firefox,
(b) the automated test suite passes with at least 80% line coverage, and (c) the portal
meets the page speed requirement in Section 8.1.

--- Page 7 ---
6.3 M3 is accepted when (a) an appointment booked in the portal appears in DentaCore within
60 seconds, and an appointment booked in DentaCore appears in the portal within 60 seconds,
(b) a test of 500 simultaneous booking attempts for the same slot produces zero double
bookings, and (c) the staff dashboard is fast enough for front-desk staff to use during
busy periods.
6.4 M4 is accepted when (a) patients receive a confirmation on booking and a reminder
24 hours before the appointment, by both email and SMS, (b) a new patient can pay a $50
deposit and the payment appears in the staff dashboard, and (c) payment handling follows
industry-standard security practices.

--- Page 8 ---
6.5 M5 is accepted when (a) the portal is live at Brightwell's production domain for all
twelve clinics, (b) the availability requirement in Section 8.2 is met for the 30 days
after launch, and (c) Brightwell's front-desk leads have completed a training session and
signed the handover checklist.

7. Deliverables
7.1 Source code in Brightwell's GitHub organization.
7.2 Staging and production environments in Brightwell's cloud account.
7.3 An administrator guide and a recorded training session.

--- Page 9 ---
8. Performance and security
8.1 Pages shall load quickly on typical patient connections.
8.2 The portal shall be available at least 99.5% of the time, measured monthly by an
external uptime monitor and excluding maintenance windows announced 48 hours ahead.
8.3 Patient data is encrypted in transit and at rest.

9. Expenses
9.1 SMS delivery fees and payment processing fees are billed monthly at cost and are
separate from the milestone fees in Section 5.
9.2 Travel requested by Brightwell is billed at cost with Brightwell's prior written approval.

--- Page 10 ---
10. Change requests
10.1 Changes to scope are agreed in writing and may change fees and dates.
10.2 Support for a second practice management system is not included and would be quoted
as a change request.

11. Term
11.1 This SOW ends when M5 is accepted, unless ended earlier under the master services agreement.

--- Page 11 ---
Signatures
Brightwell Dental Group: ______________________   Date: __________
Lotus Dev Studio: _____________________________   Date: __________
