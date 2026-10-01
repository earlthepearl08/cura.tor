import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText, Shield } from 'lucide-react';

type Tab = 'tos' | 'privacy';

const Legal = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialTab = (searchParams.get('tab') as Tab) || 'tos';
    const [activeTab, setActiveTab] = useState<Tab>(initialTab);

    return (
        <div className="flex flex-col min-h-screen bg-brand-950 text-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 glass sticky top-0 z-10">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-lg font-semibold gradient-text">Legal</h1>
                <div className="w-10" />
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-4 pb-0">
                <button
                    onClick={() => setActiveTab('tos')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'tos'
                            ? 'bg-brand-500 text-white'
                            : 'glass border border-brand-800 text-slate-400 hover:bg-white/5'
                    }`}
                >
                    <FileText size={14} />
                    Terms of Service
                </button>
                <button
                    onClick={() => setActiveTab('privacy')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'privacy'
                            ? 'bg-brand-500 text-white'
                            : 'glass border border-brand-800 text-slate-400 hover:bg-white/5'
                    }`}
                >
                    <Shield size={14} />
                    Privacy Policy
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto">
                <div className="max-w-lg mx-auto prose-sm text-slate-300">
                    {activeTab === 'tos' ? <TermsOfService /> : <PrivacyPolicy />}
                </div>
            </div>

            <div className="p-4 border-t border-brand-800 text-center">
                <Link to="/accuracy" className="text-xs text-sky-400 hover:text-sky-300 underline-offset-2 hover:underline">
                    Accuracy samples
                </Link>
                <span className="text-xs text-slate-600"> · public before/after extraction examples</span>
            </div>
        </div>
    );
};

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h2 className="text-base font-bold text-white mt-6 mb-2">{children}</h2>
);

const SubTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className="text-sm font-semibold text-slate-200 mt-4 mb-1">{children}</h3>
);

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="text-xs text-slate-400 leading-relaxed mb-3">{children}</p>
);

const Li: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <li className="text-xs text-slate-400 leading-relaxed ml-4 mb-1 list-disc">{children}</li>
);

/* ─────────── TERMS OF SERVICE ─────────── */
const TermsOfService = () => (
    <div>
        <h1 className="text-xl font-bold text-white mb-1">Terms of Service</h1>
        <p className="text-[10px] text-slate-600 mb-6">Last updated: October 1, 2026</p>

        <P>
            Welcome to Cura.tor ("Service"), a business card scanning and contact management application
            operated by Kinmo PW Corporation ("Company", "we", "us", or "our"). By accessing or using
            the Service, you agree to be bound by these Terms of Service ("Terms"). If you do not agree
            to these Terms, do not use the Service.
        </P>

        <SectionTitle>1. Service Description</SectionTitle>
        <P>
            Cura.tor is a web-based application that allows users to digitize business cards and manage
            contact information using optical character recognition (OCR) and artificial intelligence (AI)
            technology. The Service includes:
        </P>
        <ul>
            <Li>Business card scanning via camera or photo upload</Li>
            <Li>AI-powered text extraction and contact parsing</Li>
            <Li>Contact storage and management</Li>
            <Li>Export functionality (vCard, CSV, Excel)</Li>
            <Li>Optional cloud backup via Google Drive</Li>
            <Li>QR code scanning</Li>
            <Li>Log sheet scanning and multi-card batch processing (premium features)</Li>
        </ul>

        <SectionTitle>2. Account Registration</SectionTitle>
        <P>
            To use the Service, you must create an account using Google Sign-In or email and password. By
            creating an account, you represent that you are at least 13 years of age and that the information
            you provide is accurate and complete. You are responsible for maintaining the security of your
            account credentials. Email/password accounts can reset their password via
            the in-app reset flow.
        </P>

        <SectionTitle>3. Service Tiers</SectionTitle>
        <P>The Service is offered in multiple tiers:</P>
        <ul>
            <Li><strong className="text-slate-300">Free:</strong> Limited to 5 scans per month, 25 contact storage, and basic features.</Li>
            <Li><strong className="text-slate-300">Pioneer:</strong> Unlimited scans, 50 contact storage, and access to export and cloud sync features.</Li>
            <Li><strong className="text-slate-300">Pro:</strong> Unlimited scans and storage with access to all features.</Li>
        </ul>
        <P>
            We reserve the right to modify tier benefits, pricing, and limits at any time. Changes to paid
            tiers will be communicated in advance.
        </P>

        <SectionTitle>4. Access Codes</SectionTitle>
        <P>
            Certain features may be unlocked through access codes provided by the Company. Access codes are
            non-transferable and may be revoked at the Company's discretion. Access codes do not constitute
            a purchase and grant no ownership rights.
        </P>

        <SectionTitle>5. Acceptable Use</SectionTitle>
        <P>You agree NOT to:</P>
        <ul>
            <Li>Use the Service for any unlawful purpose or in violation of any applicable laws</Li>
            <Li>Upload content that infringes on third-party intellectual property rights</Li>
            <Li>Attempt to reverse-engineer, decompile, or disassemble the Service</Li>
            <Li>Interfere with or disrupt the Service or its underlying infrastructure</Li>
            <Li>Use automated tools to scrape, copy, or extract data from the Service</Li>
            <Li>Share your account credentials or access codes with unauthorized users</Li>
            <Li>Use the Service to collect personal data without the data subjects' consent</Li>
        </ul>

        <SectionTitle>6. AI and OCR Processing</SectionTitle>
        <P>
            The Service uses Google Gemini and Google Cloud Vision (reached through our hosted API on Vercel)
            to extract text and structure contact fields from card, multi-card, and log-sheet images. A
            device-side OCR fallback may also run in the browser. We do not guarantee error-free extraction;
            you must verify parsed data before relying on it.
        </P>
        <P>
            Scan images are sent for processing as described in our Privacy Policy. We do not operate a
            permanent server-side image archive; optional card images you keep with a contact are stored on
            your device (and in Google Drive App Data if you enable sync).
        </P>

        <SectionTitle>7. Intellectual Property</SectionTitle>
        <P>
            The Service, including its design, code, features, and branding, is the exclusive property of
            Kinmo PW Corporation and is protected by copyright and other intellectual property laws. You
            may not copy, modify, distribute, sell, or lease any part of the Service without prior written
            consent from the Company.
        </P>
        <P>
            You retain ownership of any contact data and images you upload to the Service.
        </P>

        <SectionTitle>8. Data and Storage</SectionTitle>
        <P>
            Personal contact data is primarily stored locally on your device (IndexedDB). Team / organization
            contacts (when you use a workspace) are stored in Firebase Firestore. Account profile and usage
            data are also in Firestore. The Company is not responsible for local data loss from clearing
            browser storage or changing devices. Enable Google Drive backup if you need persistence across devices.
        </P>

        <SectionTitle>9. Third-Party Services</SectionTitle>
        <P>
            The Service depends on subprocessors listed in the Privacy Policy (including Google Gemini and
            Cloud Vision, Firebase/Google, Vercel, Stripe, and optional Google Drive). Their availability and
            terms apply to those portions of the Service.
        </P>

        <SectionTitle>10. Disclaimer of Warranties</SectionTitle>
        <P>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS
            OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES INCLUDING
            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT
            THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
        </P>

        <SectionTitle>11. Limitation of Liability</SectionTitle>
        <P>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, KINMO PW CORPORATION SHALL NOT BE LIABLE FOR
            ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED
            TO LOSS OF DATA, LOSS OF PROFITS, OR BUSINESS INTERRUPTION, ARISING OUT OF OR RELATED TO YOUR USE
            OF THE SERVICE.
        </P>

        <SectionTitle>12. Termination</SectionTitle>
        <P>
            We may suspend or terminate your access to the Service at any time, with or without cause, and
            with or without notice. Upon termination, your right to use the Service ceases immediately. You
            may export your data and, where available in Settings, delete your account as described in the
            Privacy Policy.
        </P>

        <SectionTitle>13. Governing Law</SectionTitle>
        <P>
            These Terms shall be governed by and construed in accordance with the laws of the Republic of the
            Philippines, without regard to its conflict of law provisions. Any disputes arising from these
            Terms shall be subject to the exclusive jurisdiction of the courts located in the Philippines.
        </P>

        <SectionTitle>14. Changes to Terms</SectionTitle>
        <P>
            We reserve the right to modify these Terms at any time. We will notify users of material changes
            through the Service. Your continued use of the Service after changes are posted constitutes
            acceptance of the modified Terms.
        </P>

        <SectionTitle>15. Contact</SectionTitle>
        <P>
            If you have any questions about these Terms, please contact us at:
        </P>
        <P>
            <strong className="text-slate-300">Kinmo PW Corporation</strong><br />
            Email: support@curator-app.com
        </P>
        <P>
            B2B customers needing a data processing agreement can start from our{' '}
            <a href="/dpa.md" target="_blank" rel="noopener noreferrer" className="text-brand-400 underline hover:text-brand-300">
                DPA template stub
            </a>{' '}
            (not legal advice; not a signed contract until countersigned).
        </P>
    </div>
);

/* ─────────── PRIVACY POLICY ─────────── */
const PrivacyPolicy = () => (
    <div>
        <h1 className="text-xl font-bold text-white mb-1">Privacy Policy</h1>
        <p className="text-[10px] text-slate-600 mb-6">Last updated: October 1, 2026</p>

        <P>
            Kinmo PW Corporation ("Company", "we", "us", or "our") operates the Cura.tor application
            ("Service"). This Privacy Policy explains how we collect, use, disclose, and protect your
            information when you use the Service.
        </P>

        <SectionTitle>1. Information We Collect</SectionTitle>

        <SubTitle>1.1 Account Information</SubTitle>
        <P>
            When you create an account with Google Sign-In or email/password, we store identifiers needed to
            run the Service—typically name, email, and (for Google) profile photo URL—in Firebase Auth and
            Firestore, along with your service tier and related account fields.
        </P>

        <SubTitle>1.2 Contact Data</SubTitle>
        <P>
            Contacts you create (from scans, uploads, QR/vCard, or manual entry)—names, phones, emails,
            companies, titles, addresses, notes—are stored in your browser (IndexedDB). If you join a team
            workspace, shared contacts live in Firestore for that organization. If you enable Google Drive
            sync, a backup of personal contacts may be stored in your Drive App Data folder.
        </P>

        <SubTitle>1.3 Scan and Card Images (AI processing)</SubTitle>
        <P>
            When you scan or upload a card, multi-card sheet, or log sheet, the image is sent from your
            browser to our Vercel-hosted API, which forwards it to Google Gemini and/or Google Cloud Vision
            for OCR and field extraction. Those providers process the image to return text/structured
            fields. We do not keep a permanent server-side archive of scan images after the request
            completes; provider logs and retention follow their own terms.
        </P>
        <P>
            If you save a contact with a card image (or attach person/location photos), that image data is
            kept on your device in IndexedDB. Drive sync may omit heavy image fields from the backup file.
            A browser-only OCR fallback may process images on-device without sending them to Gemini/Vision.
        </P>

        <SubTitle>1.4 Usage and Billing Data</SubTitle>
        <P>
            We store scan/usage counters and tier fields in Firestore to enforce plan limits. If you start a
            paid checkout, Stripe processes payment details; we may store Stripe customer/subscription
            identifiers on your user profile when billing fulfillment is configured.
        </P>

        <SectionTitle>2. How We Use Your Information</SectionTitle>
        <P>We use the information we collect to:</P>
        <ul>
            <Li>Provide scanning, parsing, contact storage, export, and team features</Li>
            <Li>Transmit scan images to AI/OCR subprocessors and return extracted fields to you</Li>
            <Li>Authenticate you and enforce tiers, quotas, and (where applicable) subscriptions</Li>
            <Li>Support optional Google Drive backup and account deletion</Li>
            <Li>Operate, secure, and troubleshoot the Service</Li>
        </ul>

        <SectionTitle>3. Subprocessors</SectionTitle>
        <P>
            We use the following subprocessors to run the Service. This is an operational list, not a claim
            of certification or compliance attestation.
        </P>
        <ul>
            <Li>
                <strong className="text-slate-300">Google Gemini</strong> — AI extraction for cards, multi-card,
                and log sheets. Scan images (and prompts) are sent via our API for processing.
            </Li>
            <Li>
                <strong className="text-slate-300">Google Cloud Vision</strong> — OCR path used by the Service
                for text extraction from images sent via our API.
            </Li>
            <Li>
                <strong className="text-slate-300">Firebase / Google</strong> — Authentication, Firestore (account
                profile, usage, team/org data), and related Google infrastructure.
            </Li>
            <Li>
                <strong className="text-slate-300">Google Drive</strong> (optional) — Personal contact backup in
                your Drive App Data folder when you connect sync.
            </Li>
            <Li>
                <strong className="text-slate-300">Vercel</strong> — Hosts the web app and serverless API routes
                that receive scan requests and call Gemini/Vision; also serves static assets.
            </Li>
            <Li>
                <strong className="text-slate-300">Stripe</strong> — Payment checkout and customer portal for paid
                plans; card data is handled by Stripe, not stored in our app database.
            </Li>
        </ul>
        <P>
            Each subprocessor processes data under its own terms and privacy policy. We share data with them
            only as needed to provide the Service.
        </P>

        <SectionTitle>4. Data Storage and Security</SectionTitle>

        <SubTitle>4.1 On your device</SubTitle>
        <P>
            Personal contacts (and optional attached images) live in IndexedDB. Clearing site data, switching
            browsers, or losing the device can delete them unless you exported or enabled Drive sync.
        </P>

        <SubTitle>4.2 Our / cloud systems</SubTitle>
        <P>
            Account and usage records, enterprise requests, and team workspace data are in Firestore.
            Scan images transit Vercel functions to Gemini/Vision for the duration of the request. We do not
            market a separate long-term image vault on our servers.
        </P>

        <SubTitle>4.3 Security</SubTitle>
        <P>
            We use HTTPS in transit, Firebase Auth, and scoped access where applicable. No transmission or
            storage method is perfectly secure; we do not claim absolute security or third-party audit seals
            beyond what those vendors publish themselves.
        </P>

        <SectionTitle>5. Retention and Deletion</SectionTitle>
        <ul>
            <Li>
                <strong className="text-slate-300">Personal contacts:</strong> Kept in IndexedDB until you delete
                them or clear browser storage. Soft-deleted contacts are kept as sync tombstones and purged
                after about 30 days.
            </Li>
            <Li>
                <strong className="text-slate-300">Drive backup:</strong> Remains in your Google Drive App Data
                until you remove it or disconnect sync from Settings.
            </Li>
            <Li>
                <strong className="text-slate-300">Team contacts:</strong> Retained in the organization&apos;s
                Firestore data while the workspace exists; leaving or deleting an account follows team/owner
                rules in the app.
            </Li>
            <Li>
                <strong className="text-slate-300">Account profile:</strong> Kept in Firestore for the life of the
                account. In Settings you can delete your account: we remove your user document and related
                cleanup (org membership / solo-org data, pending invites you sent, enterprise requests you
                opened); the client then deletes your Firebase Auth user. Owner accounts and some team-admin
                cases follow in-app restrictions. Stripe subscription cancellation may not complete
                automatically until billing fulfillment is fully wired—contact us if a charge continues.
            </Li>
            <Li>
                <strong className="text-slate-300">Scan images in AI pipelines:</strong> Not retained by us as a
                permanent archive after processing; Google/Vercel may retain operational logs per their policies.
            </Li>
        </ul>

        <SectionTitle>6. Your Rights</SectionTitle>
        <P>You can:</P>
        <ul>
            <Li><strong className="text-slate-300">Access / correct:</strong> View and edit contacts in the app.</Li>
            <Li><strong className="text-slate-300">Export:</strong> Export via vCard, CSV, or Excel (tier-gated where applicable).</Li>
            <Li><strong className="text-slate-300">Delete contacts:</strong> Delete items in-app (tombstone + ~30-day purge for personal sync).</Li>
            <Li><strong className="text-slate-300">Disconnect Drive:</strong> Disconnect Google Drive from Settings.</Li>
            <Li><strong className="text-slate-300">Delete account:</strong> Use account deletion in Settings when available, or contact us below.</Li>
        </ul>

        <SectionTitle>7. Data Sharing</SectionTitle>
        <P>
            We do not sell your personal information. We share data with the subprocessors in Section 3 to
            operate the Service, and if required by law or to protect our rights.
        </P>

        <SectionTitle>8. Cookies and Local Storage</SectionTitle>
        <P>
            The Service uses browser localStorage/sessionStorage for preferences and session helpers (for
            example Drive tokens). We do not use third-party advertising analytics cookies in the app today.
        </P>

        <SectionTitle>9. Children's Privacy</SectionTitle>
        <P>
            The Service is not directed at children under 13. We do not knowingly collect personal information
            from children under 13. If we learn that we have, we will delete it promptly.
        </P>

        <SectionTitle>10. International Data Transfers</SectionTitle>
        <P>
            Processing may occur on infrastructure outside the Philippines (for example Google and Vercel
            regions). By using the Service you acknowledge that transfers may be necessary to provide AI
            scanning, hosting, auth, and payments.
        </P>

        <SectionTitle>11. Changes to This Policy</SectionTitle>
        <P>
            We may update this Privacy Policy from time to time. Material changes are reflected by updating
            the "Last updated" date. Continued use after changes constitutes acceptance of the updated policy.
        </P>

        <SectionTitle>12. Data Protection Rights (Philippines)</SectionTitle>
        <P>
            Under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173), you have the right to be
            informed, to object, to access, to rectify, to erasure or blocking, and to damages. To exercise
            these rights, use in-app controls where available or contact us below. This section describes
            statutory rights; it is not a certification of NPC registration or a third-party compliance seal.
        </P>

        <SectionTitle>13. Contact</SectionTitle>
        <P>
            Questions about this Privacy Policy or data rights:
        </P>
        <P>
            <strong className="text-slate-300">Kinmo PW Corporation</strong><br />
            Email: support@curator-app.com
        </P>
        <P>
            Early B2B customers: see the{' '}
            <a href="/dpa.md" target="_blank" rel="noopener noreferrer" className="text-brand-400 underline hover:text-brand-300">
                Data Processing Agreement template stub
            </a>{' '}
            (<code className="text-[10px] text-slate-500">DPA.md</code> /{' '}
            <code className="text-[10px] text-slate-500">/dpa.md</code>). Template only — not legal advice.
            It lists subprocessors consistent with this Privacy Policy (Google Gemini, Cloud Vision,
            Firebase/Google, optional Drive, Vercel, Stripe). Request a countersigned copy via the email above.
        </P>
    </div>
);

export default Legal;
