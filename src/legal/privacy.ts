export type PrivacyBlock =
  | {
      type: 'paragraph';
      text: string;
    }
  | {
      type: 'list';
      items: string[];
    };

export type PrivacySection = {
  title: string;
  blocks: PrivacyBlock[];
};

export type PrivacyDocument = {
  version: string;
  title: string;
  shortTitle: string;
  intro: string[];
  storageNoticeTitle: string;
  storageNoticeBody: string;
  sections: PrivacySection[];
  contactEmail: string;
};

import { SITE_CONTACT_EMAIL } from './contact';

export const CURRENT_PRIVACY_VERSION = '2026-04-01';

const PRIVACY_DOCUMENT: PrivacyDocument = {
  version: CURRENT_PRIVACY_VERSION,
  title: 'Privacy Policy',
  shortTitle: 'Privacy',
  intro: [
    'This Privacy Policy explains what FinalFolio collects, how the service uses that information, and how to request account or data removal.',
    'FinalFolio handles account registration, login sessions, uploaded images, project storage, email verification, password reset flows, and public folio sharing. If you do not agree with this policy, do not continue using the service.',
  ],
  storageNoticeTitle: 'Storage and access notice',
  storageNoticeBody:
    'FinalFolio stores uploads on object storage for product delivery. Public folio links are meant for reading and should be treated as public. A CDN may be added later to accelerate public delivery.',
  sections: [
    {
      title: '1. Information we collect',
      blocks: [
        {
          type: 'list',
          items: [
            'account information such as username, email address, password hash, role, and verification status',
            'login, security, and abuse-prevention data such as session identifiers, IP-based rate-limit records, captcha attempts, and audit events',
            'uploaded files, generated previews, project content, template content, export metadata, and related timestamps',
          ],
        },
      ],
    },
    {
      title: '2. Session cookies and sign-in state',
      blocks: [
        {
          type: 'paragraph',
          text:
            'FinalFolio uses session cookies or equivalent session tokens to keep you signed in, protect account access, and route you to the correct account, editor, or admin area after authentication.',
        },
        {
          type: 'paragraph',
          text:
            'These session records are used for core product access, not for third-party advertising or cross-site behavioral profiling.',
        },
      ],
    },
    {
      title: '3. Uploads, storage, and delivery',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Images and related project assets are stored for editing, preview generation, export, and public folio delivery. FinalFolio currently uses object storage for mirrored asset delivery and may add CDN delivery later for faster public access.',
        },
        {
          type: 'paragraph',
          text:
            'Do not upload private, sensitive, or regulated material that you would not want exposed through a public link, misconfiguration, or operational access path.',
        },
      ],
    },
    {
      title: '4. Email verification and password reset',
      blocks: [
        {
          type: 'paragraph',
          text:
            'When you register, verify an email, or request a password reset, FinalFolio processes your email address, verification or reset tokens, delivery timestamps, and related security events so the service can confirm account ownership and restore access.',
        },
      ],
    },
    {
      title: '5. Backups and retention',
      blocks: [
        {
          type: 'paragraph',
          text:
            'Operational backups, logs, and object-storage mirrors may retain copies of account or project data for disaster recovery, debugging, fraud prevention, and service continuity. Deleted material may remain in backups for a limited operational window before those backups age out.',
        },
      ],
    },
    {
      title: '6. How we use the data',
      blocks: [
        {
          type: 'list',
          items: [
            'operate accounts, sessions, uploads, editor features, exports, and public folio pages',
            'prevent abuse, rate-limit registration and authentication flows, and investigate operational failures',
            'maintain storage, previews, backups, and product administration',
          ],
        },
      ],
    },
    {
      title: '7. Contact, deletion, and account removal',
      blocks: [
        {
          type: 'paragraph',
          text:
            `To request account deletion, uploaded-file deletion, or privacy support, contact FinalFolio at ${SITE_CONTACT_EMAIL}. Requests may require enough account information to verify ownership before destructive action is taken.`,
        },
      ],
    },
  ],
  contactEmail: SITE_CONTACT_EMAIL,
};

export function getPrivacyDocument() {
  return PRIVACY_DOCUMENT;
}
