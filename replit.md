# Fashion Inventory & Invoicing System

## Overview

FashionHub is a comprehensive fashion inventory and invoicing management system built with React, Express.js, and PostgreSQL. The application provides product management with QR code generation, invoice creation and tracking, role-based access control, file uploads via Google Cloud Storage, and communication integrations including email and WhatsApp notifications.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for development and production builds
- **UI Framework**: Radix UI components with shadcn/ui design system
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Form Handling**: React Hook Form with Zod validation
- **Routing**: Wouter for client-side routing
- **File Uploads**: Uppy with Google Cloud Storage integration

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Authentication**: Replit Auth with OpenID Connect integration
- **Session Management**: Express sessions stored in PostgreSQL
- **API Design**: RESTful endpoints with proper error handling and middleware

### Data Storage Solutions
- **Primary Database**: PostgreSQL via Neon serverless
- **ORM**: Drizzle ORM with schema-first approach
- **Migrations**: Drizzle Kit for database migrations
- **File Storage**: Google Cloud Storage for product images and generated PDFs
- **Session Store**: PostgreSQL-backed session storage

### Authentication and Authorization
- **Identity Provider**: Replit Auth (OpenID Connect)
- **Session Management**: Express sessions with PostgreSQL persistence
- **Role-Based Access Control**: Four-tier system (Admin, Manager, Staff, Viewer)
- **Route Protection**: Middleware-based authentication checks
- **Auto-logout**: Unauthorized request handling with automatic re-authentication

### External Dependencies

#### Cloud Services
- **Google Cloud Storage**: Object storage for product images and invoice PDFs
- **Neon Database**: Serverless PostgreSQL hosting
- **Twilio**: WhatsApp messaging integration
- **Gmail/SMTP**: Email service for invoice delivery

#### Key Libraries
- **Database**: `@neondatabase/serverless`, `drizzle-orm`, `drizzle-kit`
- **Authentication**: `openid-client`, `passport`
- **File Processing**: `@uppy/core`, `@uppy/aws-s3`, `@google-cloud/storage`
- **PDF Generation**: `pdfkit` for invoice PDF creation
- **QR Code Generation**: `qrcode` for product QR codes
- **Communication**: `nodemailer` for email, `twilio` for WhatsApp
- **UI Components**: `@radix-ui/*` components, `tailwindcss`
- **Form Validation**: `react-hook-form`, `@hookform/resolvers`, `zod`

#### Development Tools
- **TypeScript**: Full type safety across frontend and backend
- **ESBuild**: Backend bundling for production
- **PostCSS**: CSS processing with Tailwind
- **Replit Integration**: Development environment optimization