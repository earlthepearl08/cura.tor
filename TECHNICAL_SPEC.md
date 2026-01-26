# Calling Card Scanner PWA - Technical Specification

## Document Version: 1.0
## Date: January 21, 2026

---

## 1. Executive Summary

### 1.1 Project Overview
A Progressive Web Application (PWA) designed for scanning, extracting, and managing contact information from business/calling cards. The application prioritizes mobile-first design while maintaining full desktop functionality.

### 1.2 Core Objectives
- Scan business cards using device camera (mobile)
- Upload single or bulk images (mobile & desktop)
- Extract contact data using OCR (Tesseract.js)
- Parse and structure extracted text into defined fields
- Store contacts locally using IndexedDB
- Export data to CSV and Excel formats

### 1.3 Target Platforms
- **Primary**: Mobile browsers (iOS Safari, Android Chrome)
- **Secondary**: Desktop browsers (Chrome, Firefox, Safari, Edge)

---

## 2. Technology Stack

### 2.1 Frontend Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI Framework |
| Vite | 5.x | Build Tool & Dev Server |
| TypeScript | 5.x | Type Safety |
| TailwindCSS | 3.x | Styling |
| React Router | 6.x | Navigation |

### 2.2 PWA Technologies
| Technology | Purpose |
|------------|---------|
| Workbox | Service Worker Management |
| Web App Manifest | Installability |
| Cache API | Offline Asset Caching |

### 2.3 Core Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| tesseract.js | 5.x | OCR Engine |
| idb | 8.x | IndexedDB Wrapper |
| xlsx (SheetJS) | 0.20.x | Excel Export |
| react-webcam | 7.x | Camera Access |
| react-dropzone | 14.x | Drag & Drop Upload |

---

## 3. Data Models

### 3.1 Contact Entity
```typescript
interface Contact {
  id: string;                    // UUID
  createdAt: Date;               // Timestamp of creation
  updatedAt: Date;               // Timestamp of last update

  // Extracted Fields
  name: string;
  position: string;
  company: string;
  phone: string[];               // Array for multiple numbers
  email: string[];               // Array for multiple emails
  address: string;

  // Metadata
  rawText: string;               // Original OCR output
  imageData: string;             // Base64 encoded original image
  confidence: number;            // OCR confidence score (0-100)
  isVerified: boolean;           // User has reviewed/edited
}
```

### 3.2 Scan Session Entity
```typescript
interface ScanSession {
  id: string;                    // UUID
  createdAt: Date;
  contacts: Contact[];           // Batch of contacts from bulk upload
  status: 'processing' | 'completed' | 'partial';
  totalCards: number;
  processedCards: number;
}
```

### 3.3 App Settings Entity
```typescript
interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  defaultExportFormat: 'csv' | 'xlsx';
  autoSaveEnabled: boolean;
  cameraResolution: 'low' | 'medium' | 'high';
  language: string;              // OCR language (default: 'eng')
}
```

---

## 4. Application Architecture

### 4.1 Project Structure
```
src/
├── main.tsx                     # App entry point
├── App.tsx                      # Root component with routing
├── vite-env.d.ts
│
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Navigation.tsx
│   │   ├── MobileNav.tsx
│   │   └── Layout.tsx
│   │
│   ├── scanner/
│   │   ├── CameraCapture.tsx    # Camera viewfinder & capture
│   │   ├── ImagePreview.tsx     # Preview before processing
│   │   ├── ProcessingOverlay.tsx # Loading state during OCR
│   │   └── ScannerView.tsx      # Main scanner container
│   │
│   ├── upload/
│   │   ├── DropZone.tsx         # Drag & drop area
│   │   ├── FileInput.tsx        # Traditional file input
│   │   ├── BulkUploadQueue.tsx  # Queue management for bulk
│   │   └── UploadView.tsx       # Main upload container
│   │
│   ├── contacts/
│   │   ├── ContactCard.tsx      # Individual contact display
│   │   ├── ContactList.tsx      # List/grid of contacts
│   │   ├── ContactEditor.tsx    # Edit contact fields
│   │   ├── ContactDetail.tsx    # Full contact view
│   │   └── ContactsView.tsx     # Main contacts container
│   │
│   ├── extraction/
│   │   ├── ExtractedDataForm.tsx # Display & edit extracted data
│   │   ├── FieldConfidence.tsx   # Show confidence per field
│   │   └── ReviewView.tsx        # Review extracted data
│   │
│   ├── export/
│   │   ├── ExportModal.tsx      # Export options dialog
│   │   ├── FormatSelector.tsx   # CSV/Excel toggle
│   │   └── ExportProgress.tsx   # Bulk export progress
│   │
│   └── common/
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Modal.tsx
│       ├── Toast.tsx
│       ├── LoadingSpinner.tsx
│       └── EmptyState.tsx
│
├── hooks/
│   ├── useCamera.ts             # Camera access & permissions
│   ├── useOCR.ts                # Tesseract.js integration
│   ├── useContacts.ts           # Contact CRUD operations
│   ├── useExport.ts             # Export functionality
│   ├── useIndexedDB.ts          # Database operations
│   └── usePWA.ts                # PWA install prompt
│
├── services/
│   ├── ocr/
│   │   ├── tesseractService.ts  # OCR processing
│   │   └── textParser.ts        # Extract structured data
│   │
│   ├── storage/
│   │   ├── indexedDBService.ts  # IndexedDB operations
│   │   └── migrations.ts        # DB schema migrations
│   │
│   └── export/
│       ├── csvExporter.ts       # CSV generation
│       └── excelExporter.ts     # XLSX generation
│
├── utils/
│   ├── imageProcessing.ts       # Image resize, crop, enhance
│   ├── validation.ts            # Email, phone validation
│   ├── uuid.ts                  # ID generation
│   └── dateFormatter.ts
│
├── context/
│   ├── ContactsContext.tsx      # Global contact state
│   ├── SettingsContext.tsx      # App settings
│   └── ToastContext.tsx         # Notification system
│
├── pages/
│   ├── HomePage.tsx             # Landing/dashboard
│   ├── ScanPage.tsx             # Camera scanner
│   ├── UploadPage.tsx           # File upload
│   ├── ContactsPage.tsx         # Contact list
│   ├── SettingsPage.tsx         # App settings
│   └── NotFoundPage.tsx
│
├── styles/
│   └── globals.css              # Tailwind imports + custom
│
└── types/
    └── index.ts                 # TypeScript type definitions

public/
├── manifest.json                # PWA manifest
├── sw.js                        # Service worker
├── icons/
│   ├── icon-72x72.png
│   ├── icon-96x96.png
│   ├── icon-128x128.png
│   ├── icon-144x144.png
│   ├── icon-152x152.png
│   ├── icon-192x192.png
│   ├── icon-384x384.png
│   └── icon-512x512.png
└── screenshots/
    ├── mobile-screenshot.png
    └── desktop-screenshot.png
```

### 4.2 Component Hierarchy
```
App
├── Layout
│   ├── Header
│   │   └── Navigation (desktop)
│   │
│   ├── Main Content (Routes)
│   │   ├── HomePage
│   │   │   ├── QuickActions (Scan/Upload buttons)
│   │   │   └── RecentContacts
│   │   │
│   │   ├── ScanPage
│   │   │   └── ScannerView
│   │   │       ├── CameraCapture
│   │   │       ├── ImagePreview
│   │   │       ├── ProcessingOverlay
│   │   │       └── ReviewView
│   │   │           └── ExtractedDataForm
│   │   │
│   │   ├── UploadPage
│   │   │   └── UploadView
│   │   │       ├── DropZone
│   │   │       ├── FileInput
│   │   │       ├── BulkUploadQueue
│   │   │       └── ReviewView (per image)
│   │   │
│   │   ├── ContactsPage
│   │   │   └── ContactsView
│   │   │       ├── ContactList
│   │   │       │   └── ContactCard[]
│   │   │       ├── ContactDetail
│   │   │       └── ContactEditor
│   │   │
│   │   └── SettingsPage
│   │
│   └── MobileNav (bottom navigation)
│
├── ExportModal (global)
└── Toast (global notifications)
```

---

## 5. Core Features Specification

### 5.1 Camera Scanning (Mobile Primary)

#### 5.1.1 Camera Access
```typescript
// Camera configuration
const cameraConfig = {
  facingMode: 'environment',      // Rear camera
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  aspectRatio: { ideal: 16/9 }
};
```

#### 5.1.2 Capture Flow
1. User opens scanner
2. Request camera permission (if not granted)
3. Display live viewfinder
4. User aligns card within frame guides
5. User taps capture button
6. Image is captured and previewed
7. User confirms or retakes
8. OCR processing begins
9. Extracted data displayed for review
10. User edits if needed and saves

#### 5.1.3 Image Enhancement
- Auto-contrast adjustment
- Edge detection for card boundaries
- Perspective correction (stretch to rectangle)
- Resize to optimal OCR dimensions (300 DPI equivalent)

### 5.2 File Upload (Mobile & Desktop)

#### 5.2.1 Single Upload
- Click/tap to open file picker
- Drag and drop (desktop)
- Accept: `.jpg`, `.jpeg`, `.png`, `.webp`, `.heic`
- Max file size: 10MB

#### 5.2.2 Bulk Upload
- Multi-file selection
- Drag and drop multiple files
- Queue management UI showing:
  - Total files
  - Processing progress
  - Completed count
  - Failed items (with retry option)
- Process files sequentially to prevent memory issues
- Option to pause/resume queue

### 5.3 OCR Processing

#### 5.3.1 Tesseract.js Configuration
```typescript
const ocrConfig = {
  lang: 'eng',                    // Language
  oem: Tesseract.OEM.LSTM_ONLY,   // OCR Engine Mode
  psm: Tesseract.PSM.AUTO,        // Page Segmentation Mode
  tessedit_char_whitelist: '',    // Allow all characters
  preserve_interword_spaces: '1'
};
```

#### 5.3.2 Processing Pipeline
1. Load image
2. Preprocess (grayscale, threshold)
3. Run Tesseract recognition
4. Extract raw text
5. Parse structured data
6. Calculate confidence scores

### 5.4 Text Parsing & Data Extraction

#### 5.4.1 Field Detection Strategies

**Email Detection**
```typescript
const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
```

**Phone Detection**
```typescript
const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
```

**Address Detection**
- Look for patterns: street numbers, city names, postal codes
- Multi-line context analysis
- Common keywords: "St.", "Ave.", "Road", "Floor", etc.

**Name Detection**
- Typically first line or largest text
- Exclude emails, phones, company names
- Proper noun capitalization patterns

**Position/Title Detection**
- Common titles database matching
- Keywords: "Manager", "Director", "CEO", etc.
- Usually near name or company

**Company Detection**
- Look for "Inc.", "Ltd.", "LLC", "Corp."
- Largest text block after name
- Logo area OCR

#### 5.4.2 Parsing Algorithm
```typescript
interface ParseResult {
  field: 'name' | 'position' | 'company' | 'phone' | 'email' | 'address';
  value: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
}

function parseBusinessCard(rawText: string): ParseResult[] {
  // 1. Normalize text (trim, consistent line breaks)
  // 2. Extract emails (high confidence - regex)
  // 3. Extract phones (high confidence - regex)
  // 4. Extract address (medium confidence - heuristics)
  // 5. Extract company (medium confidence - pattern matching)
  // 6. Extract position (medium confidence - title database)
  // 7. Extract name (remaining prominent text)
  // 8. Return all results with confidence scores
}
```

### 5.5 Data Storage (IndexedDB)

#### 5.5.1 Database Schema
```typescript
// Database: CardScannerDB
// Version: 1

// Object Stores:
const schema = {
  contacts: {
    keyPath: 'id',
    indexes: [
      { name: 'createdAt', keyPath: 'createdAt' },
      { name: 'company', keyPath: 'company' },
      { name: 'name', keyPath: 'name' }
    ]
  },
  sessions: {
    keyPath: 'id',
    indexes: [
      { name: 'createdAt', keyPath: 'createdAt' },
      { name: 'status', keyPath: 'status' }
    ]
  },
  settings: {
    keyPath: 'key'
  }
};
```

#### 5.5.2 CRUD Operations
```typescript
// Create
async function addContact(contact: Contact): Promise<string>;

// Read
async function getContact(id: string): Promise<Contact | undefined>;
async function getAllContacts(): Promise<Contact[]>;
async function searchContacts(query: string): Promise<Contact[]>;

// Update
async function updateContact(id: string, updates: Partial<Contact>): Promise<void>;

// Delete
async function deleteContact(id: string): Promise<void>;
async function deleteAllContacts(): Promise<void>;
```

### 5.6 Export Functionality

#### 5.6.1 CSV Export
```typescript
function exportToCSV(contacts: Contact[]): string {
  const headers = ['Name', 'Position', 'Company', 'Phone', 'Email', 'Address'];
  const rows = contacts.map(c => [
    c.name,
    c.position,
    c.company,
    c.phone.join('; '),
    c.email.join('; '),
    c.address
  ]);

  return [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
}
```

#### 5.6.2 Excel Export
```typescript
import * as XLSX from 'xlsx';

function exportToExcel(contacts: Contact[]): Blob {
  const worksheet = XLSX.utils.json_to_sheet(contacts.map(c => ({
    Name: c.name,
    Position: c.position,
    Company: c.company,
    Phone: c.phone.join('; '),
    Email: c.email.join('; '),
    Address: c.address
  })));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');

  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
```

#### 5.6.3 Download Trigger
```typescript
function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

---

## 6. PWA Configuration

### 6.1 Web App Manifest
```json
{
  "name": "Card Scanner",
  "short_name": "CardScan",
  "description": "Scan business cards and extract contact information",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/mobile-screenshot.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ],
  "categories": ["business", "productivity", "utilities"]
}
```

### 6.2 Service Worker Strategy
```javascript
// Cache-first for static assets
// Network-first for API calls (if any future cloud features)
// Stale-while-revalidate for Tesseract worker files

const CACHE_NAME = 'card-scanner-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // JS bundles
  // CSS bundles
  // Icons
];

// Pre-cache Tesseract language data
const TESSERACT_ASSETS = [
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd.wasm.js',
  'https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz'
];
```

---

## 7. User Interface Specifications

### 7.1 Design System

#### 7.1.1 Color Palette
```css
:root {
  /* Primary */
  --primary-50: #eff6ff;
  --primary-500: #3b82f6;
  --primary-600: #2563eb;
  --primary-700: #1d4ed8;

  /* Neutral */
  --gray-50: #f9fafb;
  --gray-100: #f3f4f6;
  --gray-500: #6b7280;
  --gray-900: #111827;

  /* Semantic */
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
}
```

#### 7.1.2 Typography
```css
/* Headings: Inter */
/* Body: Inter */
/* Monospace: JetBrains Mono (for emails, phones) */

--font-size-xs: 0.75rem;    /* 12px */
--font-size-sm: 0.875rem;   /* 14px */
--font-size-base: 1rem;     /* 16px */
--font-size-lg: 1.125rem;   /* 18px */
--font-size-xl: 1.25rem;    /* 20px */
--font-size-2xl: 1.5rem;    /* 24px */
```

#### 7.1.3 Spacing Scale
```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
```

### 7.2 Mobile Layout (Primary)

#### 7.2.1 Screen Dimensions
- Design for 375px width (iPhone SE/Mini)
- Scale up to 428px (iPhone Pro Max)
- Safe area insets for notched devices

#### 7.2.2 Navigation
- Bottom tab bar with 4 items:
  - Home (dashboard)
  - Scan (camera)
  - Upload (file upload)
  - Contacts (list)
- Settings accessible from header

#### 7.2.3 Touch Targets
- Minimum 44x44px touch targets
- Adequate spacing between interactive elements

### 7.3 Desktop Layout (Secondary)

#### 7.3.1 Breakpoints
```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
```

#### 7.3.2 Layout
- Sidebar navigation (left)
- Main content area (center)
- Max content width: 1200px
- Card grid for contacts (2-4 columns)

---

## 8. Performance Requirements

### 8.1 Load Time Targets
| Metric | Target | Measurement |
|--------|--------|-------------|
| First Contentful Paint | < 1.5s | Lighthouse |
| Largest Contentful Paint | < 2.5s | Lighthouse |
| Time to Interactive | < 3.5s | Lighthouse |
| First Input Delay | < 100ms | Core Web Vitals |
| Cumulative Layout Shift | < 0.1 | Core Web Vitals |

### 8.2 Bundle Size Targets
| Asset | Target Size |
|-------|-------------|
| Initial JS bundle | < 100KB (gzipped) |
| CSS bundle | < 20KB (gzipped) |
| Tesseract worker | Lazy loaded |

### 8.3 OCR Performance
- Single card processing: < 5 seconds
- Bulk processing: < 8 seconds per card
- Memory usage: < 200MB peak

---

## 9. Security Considerations

### 9.1 Data Privacy
- All data stored locally on device
- No data transmitted to external servers
- Camera access requires explicit permission
- No analytics or tracking

### 9.2 Input Validation
- Sanitize all user inputs
- Validate file types before processing
- Limit file sizes to prevent DoS

### 9.3 Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  connect-src 'self' https://tessdata.projectnaptha.com;
  worker-src 'self' blob:;
">
```

---

## 10. Testing Strategy

### 10.1 Unit Tests
- Service functions (OCR, parsing, export)
- Utility functions
- Custom hooks
- Jest + React Testing Library

### 10.2 Integration Tests
- Full scan flow
- Bulk upload flow
- Export flow
- Playwright

### 10.3 E2E Tests
- Mobile device testing (BrowserStack)
- PWA installation
- Offline functionality

### 10.4 Test Coverage Targets
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

---

## 11. Implementation Phases

### Phase 1: Foundation
**Deliverables:**
- [ ] Project initialization (Vite + React + TypeScript)
- [ ] PWA configuration (manifest, service worker)
- [ ] Base UI components (Button, Input, Modal, Toast)
- [ ] Layout components (Header, Navigation, Layout)
- [ ] Routing setup
- [ ] TailwindCSS configuration
- [ ] IndexedDB service setup

### Phase 2: Core Capture
**Deliverables:**
- [ ] Camera access hook
- [ ] Camera capture component
- [ ] Image preview component
- [ ] File upload (single) component
- [ ] Drag and drop zone
- [ ] Image preprocessing utilities

### Phase 3: OCR Integration
**Deliverables:**
- [ ] Tesseract.js integration
- [ ] OCR processing hook
- [ ] Processing overlay/progress UI
- [ ] Text parsing service
- [ ] Field extraction algorithms
- [ ] Confidence scoring

### Phase 4: Data Management
**Deliverables:**
- [ ] Contact CRUD operations
- [ ] Contact list component
- [ ] Contact detail view
- [ ] Contact editor component
- [ ] Search/filter functionality
- [ ] Extracted data review form

### Phase 5: Bulk & Export
**Deliverables:**
- [ ] Bulk upload queue
- [ ] Queue management UI
- [ ] CSV export service
- [ ] Excel export service
- [ ] Export modal
- [ ] File download utility

### Phase 6: Polish & Deploy
**Deliverables:**
- [ ] Responsive design refinement
- [ ] Offline mode testing
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] Cross-browser testing
- [ ] Production deployment

---

## 12. File Naming Conventions

### 12.1 Components
- PascalCase: `ContactCard.tsx`
- Suffix with type: `ContactCard.tsx`, `ContactCard.test.tsx`

### 12.2 Hooks
- camelCase with 'use' prefix: `useCamera.ts`

### 12.3 Services
- camelCase with 'Service' suffix: `ocrService.ts`

### 12.4 Utilities
- camelCase: `imageProcessing.ts`

### 12.5 Types
- PascalCase for interfaces: `Contact`, `ScanSession`

---

## 13. Git Workflow

### 13.1 Branch Strategy
```
main              # Production
├── develop       # Development integration
├── feature/*     # New features
├── bugfix/*      # Bug fixes
└── release/*     # Release preparation
```

### 13.2 Commit Message Format
```
type(scope): description

[optional body]

Types: feat, fix, docs, style, refactor, test, chore
```

---

## 14. Deployment

### 14.1 Hosting Options
- **Recommended**: Vercel (automatic PWA optimization)
- **Alternative**: Netlify, Firebase Hosting

### 14.2 Build Command
```bash
npm run build
```

### 14.3 Environment Variables
```env
VITE_APP_VERSION=1.0.0
VITE_TESSERACT_LANG=eng
```

---

## 15. Future Enhancements (Out of Scope)

The following features are documented for potential future development:

1. **Cloud Sync** - Firebase/Supabase integration for cross-device sync
2. **AI Enhancement** - Claude/OpenAI API for improved field extraction
3. **Multiple Languages** - Additional OCR language support
4. **Contact Groups** - Organize contacts into categories
5. **QR Code Support** - Scan QR codes on business cards
6. **vCard Export** - Export to .vcf format
7. **Direct Share** - Share to phone contacts
8. **Duplicate Detection** - Warn when similar contact exists
9. **Business Card Templates** - Recognize common card layouts
10. **API Integration** - LinkedIn lookup, email verification

---

## Appendix A: Tesseract.js Loading Strategy

```typescript
// Lazy load Tesseract only when needed
let tesseractWorker: Tesseract.Worker | null = null;

export async function getOCRWorker(): Promise<Tesseract.Worker> {
  if (tesseractWorker) {
    return tesseractWorker;
  }

  const { createWorker } = await import('tesseract.js');

  tesseractWorker = await createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
    logger: (m) => console.log(m),
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd.wasm.js',
  });

  return tesseractWorker;
}
```

---

## Appendix B: Phone Number Parsing Examples

```typescript
const testNumbers = [
  '+1 (555) 123-4567',      // US format
  '+44 20 7946 0958',       // UK format
  '+63 917 123 4567',       // PH format
  '(02) 8123-4567',         // Landline
  '09171234567',            // Local mobile
];

// All should be detected and normalized
```

---

## Appendix C: Sample Business Card OCR Output

**Input Image**: Standard business card

**Raw OCR Output**:
```
ACME CORPORATION

JOHN DOE
Senior Software Engineer

john.doe@acme.com
+1 (555) 123-4567
www.acme.com

123 Business Ave, Suite 100
San Francisco, CA 94102
```

**Parsed Result**:
```json
{
  "name": "John Doe",
  "position": "Senior Software Engineer",
  "company": "Acme Corporation",
  "phone": ["+1 (555) 123-4567"],
  "email": ["john.doe@acme.com"],
  "address": "123 Business Ave, Suite 100, San Francisco, CA 94102"
}
```

---

*End of Technical Specification*
