# Simba Car Hire - Refuel Management System

A comprehensive web application for managing vehicle refueling operations, staff management, and generating professional PDF reports.

## Features

- **Refuel Record Management**: Add, edit, and track vehicle refueling records
- **Staff Management**: Manage staff members and their roles
- **PDF Report Generation**: Create professional PDF reports with digital signatures
- **RCM Integration**: Track which records have been added to RCM system
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Built with shadcn/ui components and Tailwind CSS

## Technologies Used

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS
- **PDF Generation**: jsPDF + jspdf-autotable
- **Date Handling**: date-fns
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/bun
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repository-url>
   cd simba-refuel
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   bun install
   ```

3. **Start development server**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   bun dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173` (or the port shown in your terminal)

## Usage Guide

### Adding Refuel Records

1. Navigate to the main page
2. Fill out the refuel form with:
   - Reservation number
   - Vehicle registration
   - Fuel amount
   - Staff member who refueled
   - RCM status (if added to RCM system)
3. Click "Add Record" to save

### Managing Staff

1. Go to the Staff Management section
2. Add new staff members with their names
3. Edit or remove existing staff as needed

### Generating PDF Reports

1. Ensure you have refuel records in the system
2. Select who checked/verified the list
3. Optionally draw a digital signature
4. Click "Generate PDF Report"
5. The PDF will download automatically with:
   - Company branding
   - Professional table formatting
   - Summary statistics
   - Digital signature (if provided)

### RCM Status Tracking

- Records marked as "Added to RCM" will show ✓ Yes
- Records not in RCM will show ❌ No
- PDF reports include RCM count summaries

## Project Structure

```
src/
├── components/          # React components
│   ├── PDFGenerator.tsx    # PDF generation logic
│   ├── RefuelForm.tsx      # Refuel record form
│   ├── RefuelTable.tsx     # Records display table
│   ├── StaffManagement.tsx # Staff management interface
│   └── ui/                 # shadcn/ui components
├── types/              # TypeScript type definitions
├── hooks/              # Custom React hooks
├── lib/                # Utility functions
└── assets/             # Images and static files
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory, ready for deployment.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software for Simba Car Hire.

## Support

For technical support or questions, please contact the development team or create an issue in the repository.
