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

export type PrivacyLanguage = 'en' | 'zh-CN';

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

const PRIVACY_DOCUMENT_EN: PrivacyDocument = {
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

const PRIVACY_DOCUMENT_ZH: PrivacyDocument = {
  version: CURRENT_PRIVACY_VERSION,
  title: '隐私政策',
  shortTitle: '隐私',
  intro: [
    '本隐私政策说明 FinalFolio 收集哪些信息、服务如何使用这些信息，以及如何申请删除账户或数据。',
    'FinalFolio 处理账户注册、登录会话、上传图片、项目存储、邮箱验证、密码重置流程以及公开作品集分享。如果你不同意本政策，请勿继续使用本服务。',
  ],
  storageNoticeTitle: '存储与访问提示',
  storageNoticeBody:
    'FinalFolio 将上传内容存储在对象存储上用于产品交付。公开作品集链接用于阅读，应视为公开内容。后续可能加入 CDN 以加速公开访问。',
  sections: [
    {
      title: '1. 我们收集的信息',
      blocks: [
        {
          type: 'list',
          items: [
            '账户信息，例如用户名、邮箱地址、密码哈希、角色和验证状态',
            '登录、安全和防滥用数据，例如会话标识、基于 IP 的限流记录、验证码尝试记录和审计事件',
            '上传的文件、生成的预览、项目内容、模板内容、导出元数据及相关时间戳',
          ],
        },
      ],
    },
    {
      title: '2. 会话 Cookie 与登录状态',
      blocks: [
        {
          type: 'paragraph',
          text:
            'FinalFolio 使用会话 Cookie 或等效的会话令牌来保持你的登录状态、保护账户访问，并在认证后把你带到正确的账户、编辑器或后台区域。',
        },
        {
          type: 'paragraph',
          text:
            '这些会话记录用于核心产品访问，不用于第三方广告或跨站行为画像。',
        },
      ],
    },
    {
      title: '3. 上传、存储与交付',
      blocks: [
        {
          type: 'paragraph',
          text:
            '图片和相关项目资产会为编辑、预览生成、导出和公开作品集交付而存储。FinalFolio 目前使用对象存储进行镜像资产交付，后续可能增加 CDN 交付以加快公开访问。',
        },
        {
          type: 'paragraph',
          text:
            '请勿上传你不希望通过公开链接、配置失误或运维访问途径暴露的私密、敏感或受监管内容。',
        },
      ],
    },
    {
      title: '4. 邮箱验证与密码重置',
      blocks: [
        {
          type: 'paragraph',
          text:
            '当你注册、验证邮箱或申请密码重置时，FinalFolio 会处理你的邮箱地址、验证或重置令牌、投递时间戳及相关安全事件，以便服务确认账户归属并恢复访问。',
        },
      ],
    },
    {
      title: '5. 备份与保留',
      blocks: [
        {
          type: 'paragraph',
          text:
            '运维备份、日志和对象存储镜像可能会为灾难恢复、问题排查、防欺诈和服务连续性而保留账户或项目数据的副本。已删除内容可能会在有限的运维窗口内保留在备份中，直至备份到期清理。',
        },
      ],
    },
    {
      title: '6. 数据的使用方式',
      blocks: [
        {
          type: 'list',
          items: [
            '运营账户、会话、上传、编辑器功能、导出和公开作品集页面',
            '防止滥用，对注册和认证流程限流，并排查运维故障',
            '维护存储、预览、备份和产品管理',
          ],
        },
      ],
    },
    {
      title: '7. 联系、删除与账户注销',
      blocks: [
        {
          type: 'paragraph',
          text:
            `如需申请删除账户、删除上传文件或获取隐私支持，请通过 ${SITE_CONTACT_EMAIL} 联系 FinalFolio。在执行删除操作前，可能需要提供足够的账户信息以验证归属。`,
        },
      ],
    },
  ],
  contactEmail: SITE_CONTACT_EMAIL,
};

const PRIVACY_BY_LANGUAGE: Record<PrivacyLanguage, PrivacyDocument> = {
  en: PRIVACY_DOCUMENT_EN,
  'zh-CN': PRIVACY_DOCUMENT_ZH,
};

export function normalizePrivacyLanguage(value: string | null | undefined): PrivacyLanguage {
  if (!value) {
    return 'en';
  }

  const nextValue = value.trim().toLowerCase();
  if (nextValue === 'zh' || nextValue === 'zh-cn' || nextValue === 'zh-hans') {
    return 'zh-CN';
  }

  return 'en';
}

export function getPrivacyDocument(language?: string | null) {
  return PRIVACY_BY_LANGUAGE[normalizePrivacyLanguage(language ?? getPageLanguage())];
}

function getPageLanguage() {
  if (typeof window === 'undefined') {
    return 'en';
  }

  try {
    return window.localStorage.getItem('finalfolio-locale') === 'zh' ? 'zh-CN' : 'en';
  } catch {
    return 'en';
  }
}
