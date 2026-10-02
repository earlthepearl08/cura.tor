#!/usr/bin/env node
/**
 * One-shot generator: expands synthetic card + log-sheet fixtures to ≥30 / ≥10.
 * Re-runnable; skips ids that already exist. Does not require photos.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CARDS = path.join(ROOT, 'fixtures', 'cards');
const SHEETS = path.join(ROOT, 'fixtures', 'log-sheets');
const MOCKS = path.join(ROOT, 'mocks');

/** Synthetic PH-style contacts — fictional; no real people / logos. */
const CARDS_DATA = [
  {
    id: 'card-001-stacked-logo',
    existing: true,
    contact: {
      name: 'Engr. Maria Santos, REE, PEE',
      company: 'KINMO PW Corporation',
      position: 'Senior Sales Manager',
      phone: ['+63 917 555 1234', '8703-5284'],
      email: ['maria.santos@kinmopw.com'],
      address: 'Main Office: 12th Floor, BGC Tower, Taguig | Branch: Cebu Business Park',
      notes: 'www.kinmopw.com',
    },
    meta: { difficulty: 'hard', tags: ['stacked-logo', 'multi-phone', 'multi-address', 'credentials', 'ph'] },
  },
  {
    id: 'card-002-multi-phone',
    existing: true,
    contact: {
      name: 'Dr. John Lee, MD',
      company: 'Health First Inc.',
      position: 'Medical Director',
      phone: ['+63 2 8888 9999', '0917-222-3333', '8362-5820 (Fax)'],
      email: ['jlee@healthfirst.ph', 'appointments@healthfirst.ph'],
      address: 'Quezon City, Metro Manila',
      notes: 'linkedin.com/in/johnlee-md',
    },
    meta: { difficulty: 'medium', tags: ['multi-phone', 'fax', 'multi-email', 'credentials', 'ph'] },
  },
  {
    id: 'card-003-simple-makati',
    contact: {
      name: 'Paolo Villanueva',
      company: 'Sunrise Logistics Inc.',
      position: 'Operations Manager',
      phone: ['+63 918 100 2000'],
      email: ['paolo.v@sunriselog.ph'],
      address: 'Makati City',
      notes: '',
    },
    meta: { difficulty: 'easy', tags: ['ph', 'simple'] },
  },
  {
    id: 'card-004-atty-credentials',
    contact: {
      name: 'Atty. Beatrice Lim, CPA',
      company: 'Lim & Associates Law',
      position: 'Managing Partner',
      phone: ['+63 2 8899 1122', '0917-444-5566'],
      email: ['blim@limlaw.ph'],
      address: 'Ortigas Center, Pasig',
      notes: 'www.limlaw.ph',
    },
    meta: { difficulty: 'medium', tags: ['credentials', 'multi-phone', 'ph'] },
  },
  {
    id: 'card-005-stacked-acme',
    contact: {
      name: 'Rico Tan',
      company: 'ACME Industries Inc.',
      position: 'VP of Sales & Marketing',
      phone: ['8703-1111', '8703-2222'],
      email: ['rico.tan@acmeind.ph'],
      address: 'Head Office: Alabang, Muntinlupa',
      notes: 'Tagline: Building Tomorrow',
    },
    meta: { difficulty: 'hard', tags: ['stacked-logo', 'multi-phone', 'ph'] },
  },
  {
    id: 'card-006-empty-email',
    contact: {
      name: 'Jun Rivera',
      company: 'Island Coffee Co.',
      position: 'Owner',
      phone: ['0917-333-4444'],
      email: [],
      address: 'Davao City',
      notes: 'Walk-in wholesale',
    },
    meta: { difficulty: 'easy', tags: ['partial-fields', 'ph'] },
  },
  {
    id: 'card-007-multi-email',
    contact: {
      name: 'Sofia Navarro',
      company: 'BrightPath Solutions',
      position: 'Account Executive',
      phone: ['+63 999 888 7777'],
      email: ['sofia@brightpath.ph', 'sales@brightpath.ph'],
      address: 'Cebu City',
      notes: '',
    },
    meta: { difficulty: 'easy', tags: ['multi-email', 'ph'] },
  },
  {
    id: 'card-008-fax-landline',
    contact: {
      name: 'Manuel Cruz',
      company: 'Metro Print Services',
      position: 'Plant Supervisor',
      phone: ['02-8123-9000', '02-8123-9001 (Fax)'],
      email: ['mcruz@metroprint.ph'],
      address: 'Valenzuela City',
      notes: '',
    },
    meta: { difficulty: 'medium', tags: ['fax', 'landline', 'ph'] },
  },
  {
    id: 'card-009-arch-prefix',
    contact: {
      name: 'Arch. Elena Gomez',
      company: 'Horizon Design Studio',
      position: 'Principal Architect',
      phone: ['+63 917 600 7000'],
      email: ['elena@horizondesign.ph'],
      address: 'Main Office: Quezon City | Showroom: BGC',
      notes: 'instagram.com/horizondesignph',
    },
    meta: { difficulty: 'medium', tags: ['credentials', 'multi-address', 'ph'] },
  },
  {
    id: 'card-010-corp-suffix-only-trap',
    contact: {
      name: 'Kevin Ong',
      company: 'Nimbus Cloud Corporation',
      position: 'CTO',
      phone: ['+63 928 111 2222'],
      email: ['kevin.ong@nimbuscloud.ph'],
      address: 'Bonifacio Global City, Taguig',
      notes: 'www.nimbuscloud.ph',
    },
    meta: {
      difficulty: 'hard',
      tags: ['stacked-logo', 'ph'],
      notes: 'Synthetic stacked logo: NIMBUS CLOUD over CORPORATION — expected must be full name not suffix alone.',
    },
  },
  {
    id: 'card-011-jr-suffix',
    contact: {
      name: 'Jose Ramirez Jr.',
      company: 'Ramirez Trading',
      position: 'General Manager',
      phone: ['0918-555-6666'],
      email: ['jose.jr@ramireztrading.com'],
      address: 'Iloilo City',
      notes: '',
    },
    meta: { difficulty: 'easy', tags: ['credentials', 'ph'] },
  },
  {
    id: 'card-012-pipe-phones',
    contact: {
      name: 'Hannah Reyes',
      company: 'Pacific Marine Ltd.',
      position: 'Fleet Coordinator',
      phone: ['+63 32 234 5678', '0917-777-8888'],
      email: ['hannah.r@pacificmarine.ph'],
      address: 'Mandaue City, Cebu',
      notes: '',
    },
    meta: { difficulty: 'medium', tags: ['multi-phone', 'ph'], notes: 'Phones shown as "A | B" on card.' },
  },
  {
    id: 'card-013-mba-suffix',
    contact: {
      name: 'Clara Sy, MBA',
      company: 'Summit Capital Partners',
      position: 'Investment Analyst',
      phone: ['+63 2 7777 1212'],
      email: ['clara.sy@summitcap.ph'],
      address: 'Makati CBD',
      notes: 'linkedin.com/in/clarasy',
    },
    meta: { difficulty: 'easy', tags: ['credentials', 'ph'] },
  },
  {
    id: 'card-014-no-position',
    contact: {
      name: 'Diego Flores',
      company: 'Flores Family Farms',
      position: '',
      phone: ['0919-222-3333'],
      email: ['diego@floresfarms.ph'],
      address: 'Batangas',
      notes: 'Organic produce',
    },
    meta: { difficulty: 'easy', tags: ['partial-fields', 'ph'] },
  },
  {
    id: 'card-015-triple-phone',
    contact: {
      name: 'Iris Mendoza',
      company: 'QuickShip Express Inc.',
      position: 'Customer Success Lead',
      phone: ['+63 917 111 0001', '+63 917 111 0002', '02-8555-1212'],
      email: ['iris.m@quickship.ph'],
      address: 'Pasay City',
      notes: '',
    },
    meta: { difficulty: 'medium', tags: ['multi-phone', 'ph'] },
  },
  {
    id: 'card-016-warehouse-address',
    contact: {
      name: 'Benito Aquino',
      company: 'SteelForm Manufacturing',
      position: 'Plant Manager',
      phone: ['046-430-8899'],
      email: ['baquino@steelform.ph'],
      address: 'Factory: Carmona, Cavite | Warehouse: Laguna Technopark',
      notes: '',
    },
    meta: { difficulty: 'medium', tags: ['multi-address', 'ph'] },
  },
  {
    id: 'card-017-dr-phd',
    contact: {
      name: 'Dr. Amelia Torres, PhD',
      company: 'National Research Labs',
      position: 'Principal Scientist',
      phone: ['+63 2 8123 4567'],
      email: ['atorres@nrl.ph'],
      address: 'UP Diliman, Quezon City',
      notes: '',
    },
    meta: { difficulty: 'easy', tags: ['credentials', 'ph'] },
  },
  {
    id: 'card-018-pte-style',
    contact: {
      name: 'Wei Chen',
      company: 'Apex Trade Pte Ltd',
      position: 'Regional Director',
      phone: ['+65 6123 4567', '+63 917 900 8000'],
      email: ['wei.chen@apextrade.com'],
      address: 'BGC Office: Taguig',
      notes: 'www.apextrade.com',
    },
    meta: { difficulty: 'medium', tags: ['multi-phone', 'ph', 'intl'] },
  },
  {
    id: 'card-019-handwriting-style',
    contact: {
      name: 'Mark Villanueva',
      company: 'Booth Pop-Up PH',
      position: 'Founder',
      phone: ['0917-555-0199'],
      email: [],
      address: '',
      notes: 'met at SMX booth 12',
    },
    meta: { difficulty: 'hard', tags: ['handwriting', 'partial-fields', 'ph'] },
  },
  {
    id: 'card-020-comma-phones',
    contact: {
      name: 'Lourdes Pineda',
      company: 'Pineda Dental Clinic',
      position: 'Clinic Administrator',
      phone: ['02-8899-3344', '0918-200-3000'],
      email: ['info@pinedadental.ph'],
      address: 'San Juan City',
      notes: '',
    },
    meta: { difficulty: 'medium', tags: ['multi-phone', 'ph'], notes: 'Phones comma-separated on one line.' },
  },
  {
    id: 'card-021-holdings-group',
    contact: {
      name: 'Andre Castillo',
      company: 'Verde Holdings Group',
      position: 'Business Development Manager',
      phone: ['+63 999 321 7654'],
      email: ['andre.c@verdeholdings.ph'],
      address: 'Head Office: Cebu Business Park',
      notes: 'facebook.com/verdeholdings',
    },
    meta: { difficulty: 'easy', tags: ['ph'] },
  },
  {
    id: 'card-022-rn-suffix',
    contact: {
      name: 'Nurse Joy Alcantara, RN',
      company: 'CarePlus Medical Center',
      position: 'Charge Nurse',
      phone: ['0917-888-1212'],
      email: ['jalcantara@careplus.ph'],
      address: 'Mandaluyong',
      notes: '',
    },
    meta: { difficulty: 'easy', tags: ['credentials', 'ph'] },
  },
  {
    id: 'card-023-llc-style',
    contact: {
      name: 'Trevor Blake',
      company: 'Harbor Tech LLC',
      position: 'Solutions Architect',
      phone: ['+1 415 555 0198', '+63 917 444 0198'],
      email: ['trevor@harbortech.io'],
      address: 'Branch: Makati',
      notes: 'www.harbortech.io',
    },
    meta: { difficulty: 'medium', tags: ['multi-phone', 'intl', 'ph'] },
  },
  {
    id: 'card-024-empty-company',
    contact: {
      name: 'Gina Morales',
      company: '',
      position: 'Freelance Designer',
      phone: ['0917-666-7777'],
      email: ['gina.morales.design@gmail.com'],
      address: 'Pasig',
      notes: 'portfolio: ginamorales.design',
    },
    meta: { difficulty: 'medium', tags: ['partial-fields', 'ph'] },
  },
  {
    id: 'card-025-iii-suffix',
    contact: {
      name: 'Roberto Santos III',
      company: 'Santos Realty Corporation',
      position: 'Broker',
      phone: ['+63 922 333 4444'],
      email: ['rsantos3@santosrealty.ph'],
      address: 'Main Office: Quezon City | Branch: Antipolo',
      notes: '',
    },
    meta: { difficulty: 'medium', tags: ['credentials', 'stacked-logo', 'multi-address', 'ph'] },
  },
  {
    id: 'card-026-dept-vs-title',
    contact: {
      name: 'Patricia Uy',
      company: 'Northwind Retail Inc.',
      position: 'Marketing Manager',
      phone: ['02-8777-5555'],
      email: ['patricia.uy@northwind.ph'],
      address: 'Ortigas, Pasig',
      notes: '',
    },
    meta: {
      difficulty: 'medium',
      tags: ['ph'],
      notes: 'Card shows Marketing on one line and Manager on next — must combine to position.',
    },
  },
  {
    id: 'card-027-website-only-notes',
    contact: {
      name: 'Owen Garcia',
      company: 'PixelForge Studios',
      position: 'Creative Director',
      phone: ['0917-123-9876'],
      email: ['owen@pixelforge.ph'],
      address: 'Quezon City',
      notes: 'www.pixelforge.ph | behance.net/owengarcia',
    },
    meta: { difficulty: 'easy', tags: ['ph'] },
  },
  {
    id: 'card-028-low-contrast-fields',
    contact: {
      name: 'Tina Bautista',
      company: 'AquaPure Filters Co.',
      position: 'Sales Representative',
      phone: ['0918-777-0101'],
      email: ['tina.b@aquapure.ph'],
      address: 'Pampanga',
      notes: '',
    },
    meta: { difficulty: 'hard', tags: ['low-contrast', 'ph'] },
  },
  {
    id: 'card-029-eng-pee',
    contact: {
      name: 'Engr. Ramon dela Cruz, PEE',
      company: 'VoltEdge Engineering',
      position: 'Project Engineer',
      phone: ['+63 917 222 8899', '02-8333-4455'],
      email: ['rdelacruz@voltedge.ph'],
      address: 'Las Piñas City',
      notes: '',
    },
    meta: { difficulty: 'medium', tags: ['credentials', 'multi-phone', 'ph'] },
  },
  {
    id: 'card-030-trade-show-dense',
    contact: {
      name: 'Michelle Ang',
      company: 'ExpoCraft Philippines Inc.',
      position: 'Event Lead',
      phone: ['+63 917 555 3030', '0917-555-3031'],
      email: ['michelle.ang@expocraft.ph', 'events@expocraft.ph'],
      address: 'Showroom: SMX Convention Center vicinity, Pasay',
      notes: 'Booth A-18 | www.expocraft.ph',
    },
    meta: { difficulty: 'medium', tags: ['multi-phone', 'multi-email', 'ph', 'trade-show'] },
  },
];

const SHEETS_DATA = [
  {
    id: 'sheet-001-ph-signin',
    existing: true,
    entries: [
      {
        name: 'Maria Santos',
        company: 'Acme Corp',
        position: 'Sales Manager',
        phone: ['+63 917 555 1234'],
        email: ['maria.santos@acme.com'],
        address: 'Makati City',
        notes: 'Booth interest',
      },
      {
        name: 'Dr. John Lee, MD',
        company: 'Health First Inc.',
        position: 'Medical Director',
        phone: ['+63 2 8888 9999', '0917-222-3333'],
        email: ['jlee@healthfirst.ph'],
        address: 'Quezon City',
        notes: '',
      },
      {
        name: 'Ana Reyes',
        company: 'KINMO PW Corporation',
        position: 'Procurement Lead',
        phone: ['0918-777-8888'],
        email: ['ana.reyes@kinmopw.com'],
        address: 'Taguig',
        notes: 'Follow up next week',
      },
    ],
    meta: { difficulty: 'medium', handwriting: false, tags: ['ph', 'tabular', 'trade-show', 'signin'] },
  },
  {
    id: 'sheet-002-handwritten-mix',
    existing: true,
    entries: [
      {
        name: 'Carlo Mendoza',
        company: 'Bright Solar PH',
        position: 'Owner',
        phone: ['0917-111-2222'],
        email: [],
        address: 'Batangas',
        notes: 'wants quote',
      },
      {
        name: 'Liza Cruz',
        company: 'Metro Builders Co.',
        position: 'Architect',
        phone: ['02-8123-4567'],
        email: ['liza@metrobuilders.ph'],
        address: '',
        notes: '',
      },
    ],
    meta: { difficulty: 'hard', handwriting: true, tags: ['ph', 'handwriting', 'partial-fields', 'trade-show'] },
  },
  {
    id: 'sheet-003-smx-booth',
    entries: [
      {
        name: 'Paolo Villanueva',
        company: 'Sunrise Logistics Inc.',
        position: 'Operations Manager',
        phone: ['+63 918 100 2000'],
        email: ['paolo.v@sunriselog.ph'],
        address: 'Makati',
        notes: 'Booth 22',
      },
      {
        name: 'Sofia Navarro',
        company: 'BrightPath Solutions',
        position: 'Account Executive',
        phone: ['+63 999 888 7777'],
        email: ['sofia@brightpath.ph'],
        address: 'Cebu',
        notes: '',
      },
      {
        name: 'Jun Rivera',
        company: 'Island Coffee Co.',
        position: 'Owner',
        phone: ['0917-333-4444'],
        email: [],
        address: 'Davao',
        notes: 'sample request',
      },
      {
        name: 'Hannah Reyes',
        company: 'Pacific Marine Ltd.',
        position: 'Fleet Coordinator',
        phone: ['0917-777-8888'],
        email: ['hannah.r@pacificmarine.ph'],
        address: 'Mandaue',
        notes: '',
      },
    ],
    meta: { difficulty: 'medium', handwriting: false, tags: ['ph', 'trade-show', 'tabular'] },
  },
  {
    id: 'sheet-004-handwritten-dense',
    entries: [
      {
        name: 'Mark Villanueva',
        company: 'Booth Pop-Up PH',
        position: 'Founder',
        phone: ['0917-555-0199'],
        email: [],
        address: '',
        notes: 'booth 12',
      },
      {
        name: 'Tina Bautista',
        company: 'AquaPure Filters Co.',
        position: 'Sales Rep',
        phone: ['0918-777-0101'],
        email: ['tina.b@aquapure.ph'],
        address: 'Pampanga',
        notes: '',
      },
      {
        name: 'Diego Flores',
        company: 'Flores Family Farms',
        position: '',
        phone: ['0919-222-3333'],
        email: ['diego@floresfarms.ph'],
        address: 'Batangas',
        notes: 'organic',
      },
    ],
    meta: { difficulty: 'hard', handwriting: true, tags: ['ph', 'handwriting', 'partial-fields'] },
  },
  {
    id: 'sheet-005-cebu-expo',
    entries: [
      {
        name: 'Andre Castillo',
        company: 'Verde Holdings Group',
        position: 'Business Development Manager',
        phone: ['+63 999 321 7654'],
        email: ['andre.c@verdeholdings.ph'],
        address: 'Cebu',
        notes: '',
      },
      {
        name: 'Clara Sy, MBA',
        company: 'Summit Capital Partners',
        position: 'Investment Analyst',
        phone: ['+63 2 7777 1212'],
        email: ['clara.sy@summitcap.ph'],
        address: 'Makati',
        notes: 'interested in Series A',
      },
      {
        name: 'Owen Garcia',
        company: 'PixelForge Studios',
        position: 'Creative Director',
        phone: ['0917-123-9876'],
        email: ['owen@pixelforge.ph'],
        address: 'QC',
        notes: '',
      },
    ],
    meta: { difficulty: 'medium', handwriting: false, tags: ['ph', 'tabular', 'trade-show'] },
  },
  {
    id: 'sheet-006-mixed-print-hand',
    entries: [
      {
        name: 'Iris Mendoza',
        company: 'QuickShip Express Inc.',
        position: 'Customer Success Lead',
        phone: ['+63 917 111 0001'],
        email: ['iris.m@quickship.ph'],
        address: 'Pasay',
        notes: '',
      },
      {
        name: 'Gina Morales',
        company: '',
        position: 'Freelance Designer',
        phone: ['0917-666-7777'],
        email: ['gina.morales.design@gmail.com'],
        address: 'Pasig',
        notes: 'card follow-up',
      },
      {
        name: 'Benito Aquino',
        company: 'SteelForm Manufacturing',
        position: 'Plant Manager',
        phone: ['046-430-8899'],
        email: ['baquino@steelform.ph'],
        address: 'Cavite',
        notes: '',
      },
      {
        name: 'Michelle Ang',
        company: 'ExpoCraft Philippines Inc.',
        position: 'Event Lead',
        phone: ['+63 917 555 3030'],
        email: ['michelle.ang@expocraft.ph'],
        address: 'Pasay',
        notes: 'Booth A-18',
      },
    ],
    meta: { difficulty: 'hard', handwriting: true, tags: ['ph', 'handwriting', 'partial-fields', 'trade-show'] },
  },
  {
    id: 'sheet-007-medical-day',
    entries: [
      {
        name: 'Dr. Amelia Torres, PhD',
        company: 'National Research Labs',
        position: 'Principal Scientist',
        phone: ['+63 2 8123 4567'],
        email: ['atorres@nrl.ph'],
        address: 'QC',
        notes: '',
      },
      {
        name: 'Nurse Joy Alcantara, RN',
        company: 'CarePlus Medical Center',
        position: 'Charge Nurse',
        phone: ['0917-888-1212'],
        email: ['jalcantara@careplus.ph'],
        address: 'Mandaluyong',
        notes: 'training interest',
      },
      {
        name: 'Dr. John Lee, MD',
        company: 'Health First Inc.',
        position: 'Medical Director',
        phone: ['0917-222-3333'],
        email: ['jlee@healthfirst.ph'],
        address: 'QC',
        notes: '',
      },
    ],
    meta: { difficulty: 'medium', handwriting: false, tags: ['ph', 'credentials', 'tabular'] },
  },
  {
    id: 'sheet-008-engineering-meetup',
    entries: [
      {
        name: 'Engr. Ramon dela Cruz, PEE',
        company: 'VoltEdge Engineering',
        position: 'Project Engineer',
        phone: ['+63 917 222 8899'],
        email: ['rdelacruz@voltedge.ph'],
        address: 'Las Piñas',
        notes: '',
      },
      {
        name: 'Engr. Maria Santos, REE, PEE',
        company: 'KINMO PW Corporation',
        position: 'Senior Sales Manager',
        phone: ['+63 917 555 1234'],
        email: ['maria.santos@kinmopw.com'],
        address: 'Taguig',
        notes: 'panel speaker',
      },
      {
        name: 'Kevin Ong',
        company: 'Nimbus Cloud Corporation',
        position: 'CTO',
        phone: ['+63 928 111 2222'],
        email: ['kevin.ong@nimbuscloud.ph'],
        address: 'BGC',
        notes: '',
      },
    ],
    meta: { difficulty: 'medium', handwriting: false, tags: ['ph', 'credentials', 'stacked-logo'] },
  },
  {
    id: 'sheet-009-messy-handwriting',
    entries: [
      {
        name: 'Carlo Mendoza',
        company: 'Bright Solar PH',
        position: 'Owner',
        phone: ['0917-111-2222'],
        email: [],
        address: '',
        notes: 'quote asap',
      },
      {
        name: 'Liza Cruz',
        company: 'Metro Builders Co.',
        position: 'Architect',
        phone: ['02-8123-4567'],
        email: [],
        address: '',
        notes: '',
      },
      {
        name: 'Jose Ramirez Jr.',
        company: 'Ramirez Trading',
        position: 'GM',
        phone: ['0918-555-6666'],
        email: ['jose.jr@ramireztrading.com'],
        address: 'Iloilo',
        notes: 'rice export',
      },
      {
        name: 'Elena Gomez',
        company: 'Horizon Design Studio',
        position: 'Architect',
        phone: ['+63 917 600 7000'],
        email: ['elena@horizondesign.ph'],
        address: 'QC',
        notes: '',
      },
      {
        name: 'Rico Tan',
        company: 'ACME Industries Inc.',
        position: 'VP Sales',
        phone: ['8703-1111'],
        email: ['rico.tan@acmeind.ph'],
        address: 'Alabang',
        notes: '',
      },
    ],
    meta: { difficulty: 'hard', handwriting: true, tags: ['ph', 'handwriting', 'trade-show'] },
  },
  {
    id: 'sheet-010-export-ready',
    entries: [
      {
        name: 'Patricia Uy',
        company: 'Northwind Retail Inc.',
        position: 'Marketing Manager',
        phone: ['02-8777-5555'],
        email: ['patricia.uy@northwind.ph'],
        address: 'Pasig',
        notes: '',
      },
      {
        name: 'Trevor Blake',
        company: 'Harbor Tech LLC',
        position: 'Solutions Architect',
        phone: ['+63 917 444 0198'],
        email: ['trevor@harbortech.io'],
        address: 'Makati',
        notes: 'demo booked',
      },
      {
        name: 'Wei Chen',
        company: 'Apex Trade Pte Ltd',
        position: 'Regional Director',
        phone: ['+63 917 900 8000'],
        email: ['wei.chen@apextrade.com'],
        address: 'BGC',
        notes: '',
      },
      {
        name: 'Roberto Santos III',
        company: 'Santos Realty Corporation',
        position: 'Broker',
        phone: ['+63 922 333 4444'],
        email: ['rsantos3@santosrealty.ph'],
        address: 'QC',
        notes: 'condo leads',
      },
      {
        name: 'Lourdes Pineda',
        company: 'Pineda Dental Clinic',
        position: 'Clinic Administrator',
        phone: ['0918-200-3000'],
        email: ['info@pinedadental.ph'],
        address: 'San Juan',
        notes: '',
      },
      {
        name: 'Manuel Cruz',
        company: 'Metro Print Services',
        position: 'Plant Supervisor',
        phone: ['02-8123-9000'],
        email: ['mcruz@metroprint.ph'],
        address: 'Valenzuela',
        notes: '',
      },
    ],
    meta: { difficulty: 'medium', handwriting: false, tags: ['ph', 'tabular', 'dense'] },
  },
];

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function writeCard(card) {
  const dir = path.join(CARDS, card.id);
  fs.mkdirSync(dir, { recursive: true });
  const expected = {
    ...card.contact,
    _meta: { id: card.id, ...card.meta },
  };
  writeJson(path.join(dir, 'expected.json'), expected);
  writeJson(path.join(MOCKS, `${card.id}.json`), [card.contact]);
  // Synthetic stand-in for a photo — structured text scene, not a copyrighted image.
  writeJson(path.join(dir, 'synthetic.json'), {
    kind: 'calling-card',
    id: card.id,
    description:
      'Synthetic fixture — no photo required. Replace with image.jpg for live Gemini eval.',
    visualLines: [
      card.contact.company,
      card.contact.name,
      card.contact.position,
      (card.contact.phone || []).join(' / '),
      (card.contact.email || []).join(' ; '),
      card.contact.address,
      card.contact.notes,
    ].filter((line) => String(line || '').trim()),
  });
  if (!fs.existsSync(path.join(dir, 'VISUAL.md'))) {
    fs.writeFileSync(
      path.join(dir, 'VISUAL.md'),
      `# ${card.id}\n\nSynthetic fixture (no photo). See \`synthetic.json\` and \`expected.json\`.\n\nAdd \`image.jpg\` later for live Gemini eval — see \`../../HOWTO-REAL-SAMPLES.md\`.\n`
    );
  }
}

function writeSheet(sheet) {
  const dir = path.join(SHEETS, sheet.id);
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'expected.json'), {
    entries: sheet.entries,
    _meta: { id: sheet.id, ...sheet.meta },
  });
  writeJson(path.join(MOCKS, `${sheet.id}.json`), sheet.entries);
  writeJson(path.join(dir, 'synthetic.json'), {
    kind: 'log-sheet',
    id: sheet.id,
    description:
      'Synthetic log-sheet rows — no photo required. Replace with image.jpg for live Gemini eval.',
    columns: ['name', 'company', 'position', 'phone', 'email', 'address', 'notes'],
    rows: sheet.entries,
  });
  if (!fs.existsSync(path.join(dir, 'VISUAL.md'))) {
    fs.writeFileSync(
      path.join(dir, 'VISUAL.md'),
      `# ${sheet.id}\n\nSynthetic PH log sheet (${sheet.entries.length} rows). See \`synthetic.json\`.\n\nAdd \`image.jpg\` later — see \`../../HOWTO-REAL-SAMPLES.md\`.\n`
    );
  }
}

for (const card of CARDS_DATA) writeCard(card);
for (const sheet of SHEETS_DATA) writeSheet(sheet);

console.log(`Wrote ${CARDS_DATA.length} cards and ${SHEETS_DATA.length} log sheets.`);
