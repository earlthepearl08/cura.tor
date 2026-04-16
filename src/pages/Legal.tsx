import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
        <p className="text-[10px] text-slate-600 mb-6">Last updated: March 16, 2026</p>

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
            To use the Service, you must create an account using Google Sign-In. By creating an account, you
            represent that you are at least 13 years of age and that the information you provide is accurate
            and complete. You are responsible for maintaining the security of your account credentials.
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
            The Service uses third-party AI and OCR services (including Google Cloud Vision and Google Gemini)
            to process business card images. While we strive for accuracy, we do not guarantee that the
            extracted information will be error-free. You are responsible for verifying the accuracy of all
            parsed contact data before relying on it.
        </P>
        <P>
            Images submitted for scanning are processed in real-time and are not permanently stored on our
            servers. However, they are temporarily transmitted to third-party AI services for processing
            as described in our Privacy Policy.
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
            Contact data is primarily stored locally on your device using browser storage (IndexedDB). The
            Company is not responsible for data loss resulting from browser cache clearing, device changes,
            or other local storage events. We strongly recommend enabling cloud backup for data persistence.
        </P>

        <SectionTitle>9. Third-Party Services</SectionTitle>
        <P>
            The Service integrates with third-party services including Google Cloud Platform, Firebase, and
            Google Drive. Your use of these services is subject to their respective terms and privacy policies.
            We are not responsible for the availability or performance of third-party services.
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
            may export your data before termination using the available export features.
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
            {/* TODO: Replace with real support email before launch */}
            Email: support@curator-app.com
        </P>
    </div>
);

/* ─────────── PRIVACY POLICY ─────────── */
const PrivacyPolicy = () => (
    <div>
        <h1 className="text-xl font-bold text-white mb-1">Privacy Policy</h1>
        <p className="text-[10px] text-slate-600 mb-6">Last updated: March 16, 2026</p>

        <P>
            Kinmo PW Corporation ("Company", "we", "us", or "our") operates the Cura.tor application
            ("Service"). This Privacy Policy explains how we collect, use, disclose, and protect your
            information when you use the Service.
        </P>

        <SectionTitle>1. Information We Collect</SectionTitle>

        <SubTitle>1.1 Account Information</SubTitle>
        <P>
            When you sign in with Google, we receive and store your name, email address, and profile photo
            URL. This information is stored in our Firebase database to manage your account and service tier.
        </P>

        <SubTitle>1.2 Contact Data</SubTitle>
        <P>
            When you scan business cards, upload images, or manually enter contacts, the resulting contact
            information (names, phone numbers, email addresses, companies, job titles, addresses, notes) is
            stored locally on your device using browser storage (IndexedDB). If you enable Google Drive
            sync, this data is also stored in your personal Google Drive account.
        </P>

        <SubTitle>1.3 Images</SubTitle>
        <P>
            Business card images and photos you capture or upload are processed temporarily to extract contact
            information. Images are sent to Google Cloud Vision and Google Gemini AI for processing. Images
            are not permanently stored on our servers after processing is complete.
        </P>

        <SubTitle>1.4 Usage Data</SubTitle>
        <P>
            We track scan counts and usage metrics associated with your account to enforce service tier limits.
            This includes the number of scans performed and your current billing period.
        </P>

        <SubTitle>1.5 Photos (Person and Location)</SubTitle>
        <P>
            If you attach person or location photos to contacts, these images are stored locally on your device
            as base64-encoded data within IndexedDB, and optionally synced to Google Drive if cloud backup is
            enabled.
        </P>

        <SectionTitle>2. How We Use Your Information</SectionTitle>
        <P>We use the information we collect to:</P>
        <ul>
            <Li>Provide and maintain the Service</Li>
            <Li>Process business card images and extract contact information</Li>
            <Li>Manage your account, service tier, and usage limits</Li>
            <Li>Enable data export and cloud backup features</Li>
            <Li>Improve the Service and develop new features</Li>
            <Li>Communicate with you about service updates</Li>
        </ul>

        <SectionTitle>3. Third-Party Services</SectionTitle>
        <P>The Service uses the following third-party services that may process your data:</P>
        <ul>
            <Li><strong className="text-slate-300">Google Cloud Vision API:</strong> Processes business card images for text extraction. Images are transmitted to Google's servers for processing. Subject to Google Cloud's data processing terms.</Li>
            <Li><strong className="text-slate-300">Google Gemini AI:</strong> Processes extracted text to identify and structure contact information. Subject to Google's AI terms of service.</Li>
            <Li><strong className="text-slate-300">Firebase (Google):</strong> Handles user authentication and stores user profile data (tier, usage counts). Subject to Firebase's terms of service.</Li>
            <Li><strong className="text-slate-300">Google Drive:</strong> Optional cloud backup for contact data, stored in your personal Google Drive application data folder. Subject to Google Drive's terms of service.</Li>
        </ul>

        <SectionTitle>4. Data Storage and Security</SectionTitle>

        <SubTitle>4.1 Local Storage</SubTitle>
        <P>
            Contact data is primarily stored in your browser's IndexedDB. This data exists only on your device
            and can be lost if you clear your browser data, switch browsers, or change devices. We strongly
            recommend enabling cloud backup.
        </P>

        <SubTitle>4.2 Cloud Storage</SubTitle>
        <P>
            If you enable Google Drive sync, your contact data is stored as a JSON file in your Google Drive's
            application data folder. This folder is not visible in your main Drive and can only be accessed by
            the Cura.tor application.
        </P>

        <SubTitle>4.3 Server-Side</SubTitle>
        <P>
            User profile data (email, name, tier, scan usage) is stored in Google Firestore. We do not store
            business card images or contact data on our servers. Image processing happens via direct API calls
            to Google Cloud services.
        </P>

        <SubTitle>4.4 Security</SubTitle>
        <P>
            We implement reasonable technical measures to protect your data, including HTTPS encryption for all
            data in transit, OAuth 2.0 for authentication, and scoped API access. However, no method of
            electronic transmission or storage is 100% secure, and we cannot guarantee absolute security.
        </P>

        <SectionTitle>5. Data Retention</SectionTitle>
        <P>
            Your contact data is retained locally until you delete it or clear your browser storage. Cloud-synced
            data is retained in your Google Drive until you disconnect or delete it. Your account profile data
            is retained in Firestore for the duration of your account. Deleted contacts are marked as tombstones
            for sync purposes and are permanently purged after 30 days.
        </P>

        <SectionTitle>6. Your Rights</SectionTitle>
        <P>You have the right to:</P>
        <ul>
            <Li><strong className="text-slate-300">Access:</strong> View all contact data stored in the app at any time.</Li>
            <Li><strong className="text-slate-300">Export:</strong> Export your contact data via vCard, CSV, or Excel formats.</Li>
            <Li><strong className="text-slate-300">Delete:</strong> Delete individual contacts or all data at any time.</Li>
            <Li><strong className="text-slate-300">Disconnect:</strong> Disconnect Google Drive sync and remove cloud-stored data.</Li>
            <Li><strong className="text-slate-300">Account Deletion:</strong> Contact us to request complete account and data deletion.</Li>
        </ul>

        <SectionTitle>7. Data Sharing</SectionTitle>
        <P>
            We do not sell, rent, or trade your personal information to third parties. We share data only with
            the third-party services listed in Section 3, strictly for the purpose of providing the Service.
            We may disclose information if required by law or to protect our legal rights.
        </P>

        <SectionTitle>8. Cookies and Local Storage</SectionTitle>
        <P>
            The Service uses browser localStorage and sessionStorage for preferences (theme, last sync time)
            and session management (Google Drive tokens). We do not use tracking cookies or third-party
            analytics cookies.
        </P>

        <SectionTitle>9. Children's Privacy</SectionTitle>
        <P>
            The Service is not directed at children under 13 years of age. We do not knowingly collect personal
            information from children under 13. If we learn that we have collected information from a child
            under 13, we will delete that information promptly.
        </P>

        <SectionTitle>10. International Data Transfers</SectionTitle>
        <P>
            Your data may be processed by Google Cloud services located outside the Philippines. By using the
            Service, you consent to the transfer of your data to servers in other jurisdictions for processing.
            Google's data processing agreements govern these transfers.
        </P>

        <SectionTitle>11. Changes to This Policy</SectionTitle>
        <P>
            We may update this Privacy Policy from time to time. We will notify users of material changes by
            updating the "Last updated" date. Your continued use of the Service after changes constitutes
            acceptance of the updated policy.
        </P>

        <SectionTitle>12. Data Protection Rights (Philippines)</SectionTitle>
        <P>
            Under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173), you have the right to be
            informed, to object, to access, to rectify, to erasure or blocking, and to damages. If you wish
            to exercise any of these rights, please contact us using the details below.
        </P>

        <SectionTitle>13. Contact</SectionTitle>
        <P>
            If you have questions about this Privacy Policy or wish to exercise your data rights, contact us at:
        </P>
        <P>
            <strong className="text-slate-300">Kinmo PW Corporation</strong><br />
            {/* TODO: Replace with real support email before launch */}
            Email: support@curator-app.com
        </P>
    </div>
);

export default Legal;
