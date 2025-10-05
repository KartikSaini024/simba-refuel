# Refuel Management System – User Guide

## Overview
This web application streamlines the management of vehicle refueling records for the company with support for multiple branches. It supports staff management, record keeping, PDF reporting, and secure email delivery of daily refuel summaries.

---

## Getting Started

### Login
Access the app using your provided credentials. Roles and permissions are assigned by your administrator.

### Branch Selection
Select your branch from the dropdown to view or manage refuel records specific to your location.

---

## Main Features

### 1. Refuel Record Entry
- Add new refuel records by entering:
  - Vehicle registration  
  - Reservation number  
  - Amount  
  - Receipt photo upload  
- Select the staff member who performed the refueling.  
- Mark whether the record has been added to **RCM (Remote Control Management)**.

---

### 2. Staff Management
- **Admins** can add or remove staff members for each branch.  
- Staff names are used for record attribution and reporting.

---

### 3. Search & Filter
- Search refuel records by:
  - Vehicle registration  
  - Reservation number  
  - Refueled by  
  - RCM status  
  - Date range  
- View results in a sortable table with receipt image previews.

---

### 4. PDF Report Generation
- Generate a **PDF summary** of refuel records for a selected date and branch.  
- Include:
  - Staff who checked the list  
  - Digital signature  
- Download or email the PDF report.

---

### 5. Email Reports
- Send daily refuel reports to designated recipients.  
- Attach PDF summaries and receipt images.  
- Email sending can be tested locally (see below).

---

## Roles & Permissions

### **Admin**
- Add/remove staff members  
- Manage all branches  
- Generate and send PDF/email reports  
- View all refuel records  

### **Staff**
- Add new refuel records  
- Upload receipt images  
- View and search records for their branch  
- Cannot manage staff or send reports  

---

## Receipt Image Handling
- Receipt images are uploaded and stored securely.  
- Preview images directly in the search results table.  
- If an image fails to load, a placeholder is shown.

---

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- express (local backend server for sending emails)

## Notes on Email Sending

### Testing Emails Locally

In `src/components/EmailReportSender.tsx`, there is a comment showing how to switch the API endpoint to your local Express server for testing email sending before deploying to Vercel.  

- By default, the frontend calls the serverless function at `/api/sendReportEmail`.
- To test with your local server (e.g., `http://localhost:5000/api/sendReportEmail`), uncomment or modify the fetch URL in `handleSendEmail` accordingly.
- Make sure your local server (`server.js`) is also running ('node server.js' in cmd line) and the environment variables (`GMAIL_USER` and `GMAIL_PASS`) are set in your `.env` file.
