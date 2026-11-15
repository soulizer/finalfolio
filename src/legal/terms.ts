export type TermsLanguage = 'en' | 'zh-CN';

type TermsBlock =
  | {
      type: 'paragraph';
      text: string;
    }
  | {
      type: 'list';
      items: string[];
    };

export type TermsSection = {
  title: string;
  blocks: TermsBlock[];
};

export type TermsDocument = {
  language: TermsLanguage;
  title: string;
  shortTitle: string;
  intro: string[];
  sections: TermsSection[];
  riskNoticeTitle: string;
  riskNoticeBody: string;
  agreementLabel: string;
  acceptanceHeading: string;
  acceptanceBody: string;
  acceptButtonLabel: string;
  continueButtonLabel: string;
  signInButtonLabel: string;
  acceptedSummaryLabel: string;
};

export const CURRENT_TOS_VERSION = '2026-03-28';

const TERMS_BY_LANGUAGE: Record<TermsLanguage, TermsDocument> = {
  en: {
    language: 'en',
    title: 'Terms of Service',
    shortTitle: 'TOS',
    intro: [
      'Welcome to FinalFolio ("FinalFolio", "this site", or "the service").',
      'These Terms of Service form an agreement between you and the operator of FinalFolio regarding your access to, registration for, login to, upload to, editing in, storage in, publication through, and use of this service. Please read these terms carefully before you register, sign in, or continue using the service. By checking the agreement box and registering, signing in, or continuing to use the service, you confirm that you have read, understood, and accepted all of these terms.',
      'If you do not agree with any part of these terms, stop registering for and using the service immediately.',
    ],
    sections: [
      {
        title: '1. Service description',
        blocks: [
          {
            type: 'paragraph',
            text: 'FinalFolio is an online service for uploading images, organizing content, creating electronic album or magazine-style pages, and presenting, editing, and managing those projects.',
          },
          {
            type: 'paragraph',
            text: 'Features may include, without limitation:',
          },
          {
            type: 'list',
            items: [
              'user registration, sign-in, and account verification',
              'image upload, storage, display, and management',
              'project creation, editing, saving, export, and sharing',
              'admin governance, personal content management, preferences, and related controls',
            ],
          },
          {
            type: 'paragraph',
            text: 'FinalFolio may adjust, add, reduce, suspend, or terminate any feature at any time as product and operational needs change. The service does not promise that every current feature will remain available indefinitely.',
          },
        ],
      },
      {
        title: '2. Account registration and use',
        blocks: [
          {
            type: 'list',
            items: [
              'You must provide true, accurate, complete, and current account information when registering for and using the service.',
              'You are responsible for safeguarding your account, password, verification codes, login state, and related credentials, and for all actions taken under your account.',
              'You may not impersonate another person, share or sell your account, or attack, interfere with, bypass, or abuse registration, login, verification, upload, export, access control, or any other site function.',
              'If you discover unauthorized account use, a security issue, or any abnormal activity, you must notify the site operator immediately.',
            ],
          },
        ],
      },
      {
        title: '3. User content and rights warranty',
        blocks: [
          {
            type: 'list',
            items: [
              'You are solely responsible for all content you upload, publish, edit, save, display, or distribute through FinalFolio, including images, text, titles, notes, templates, and project content ("User Content").',
              'You represent and warrant that you own the necessary rights in the User Content or have obtained sufficient, valid authorization to use it.',
              'You may not upload, publish, store, or distribute unlawful, infringing, harmful, or improper content, including content that violates law or regulation, harms national security or public order, is obscene, violent, fraudulent, hateful, insulting, or defamatory, infringes intellectual property, portrait, privacy, reputation, trade-secret, or other lawful rights, or contains malware, phishing links, or other threats to system security.',
              'You may not upload images or other content containing private information, sensitive personal information, or anything else unsuitable for public circulation.',
            ],
          },
          {
            type: 'paragraph',
            text: 'This includes, without limitation:',
          },
          {
            type: 'list',
            items: [
              'identity documents, passports, driver licenses, social-security cards, bank cards, or similar records',
              'home addresses, phone numbers, email addresses, license plates, itineraries, or location traces',
              'private photos of other people taken, stored, or shared without their consent',
              'content involving minors’ privacy, medical information, financial information, biometric data, or other sensitive material',
              'any other content whose disclosure could expose you or others to risk, loss, harassment, or harm',
            ],
          },
        ],
      },
      {
        title: '4. Special risk notice: storage and access risk for uploaded content',
        blocks: [
          {
            type: 'list',
            items: [
              'FinalFolio provides ordinary internet storage, processing, and access capabilities. It is not designed as an encrypted custody service for private material, sensitive information, confidential data, or other high-security content.',
              'Uploading content to FinalFolio does not create any extra confidentiality commitment or end-to-end encryption protection for that content.',
              'The service does not currently promise special privacy-focused encryption treatment for user uploads.',
              'Technically, uploaded resources may in some circumstances become publicly accessible, directly accessible, indirectly accessible, cached, or obtainable through configuration, links, paths, sharing, referencing, or similar mechanisms.',
              'You must not upload any image, document, or information that you do not want to become public, exposed, or obtainable by a third party.',
              'If you upload private information, sensitive personal information, trade secrets, unpublished material, or any other content unsuitable for this service, and that causes disclosure, access, distribution, download, caching, referencing, loss, dispute, complaint, claim, or liability, you are generally responsible for the consequences yourself.',
              'To the extent permitted by law, FinalFolio is not responsible for privacy leaks or related harm caused by your own uploads, mistaken uploads, misconfiguration, mistaken sharing, mistaken publication, mistaken referencing, violation of these terms, or failure to assess the risks involved.',
              'If mandatory law provides otherwise, or if damage is directly caused by FinalFolio’s intentional misconduct or gross negligence, applicable law will control.',
            ],
          },
        ],
      },
      {
        title: '5. Platform handling rights',
        blocks: [
          {
            type: 'paragraph',
            text: 'To protect platform security, legal compliance, service operations, and the rights of other users, FinalFolio may, in its own judgment, take measures with respect to content or accounts, including without limitation:',
          },
          {
            type: 'list',
            items: [
              'reviewing, intercepting, limiting, deleting, delisting, or blocking user content',
              'restricting uploads, access, export, sharing, login, or other functions',
              'suspending, freezing, or banning accounts',
              'retaining or deleting related data, logs, and operation records',
              'providing relevant information to regulators, courts, or other authorized authorities and cooperating with investigations when necessary',
            ],
          },
          {
            type: 'paragraph',
            text: 'When FinalFolio takes such measures, it does not automatically assume a duty to explain each reason or provide compensation unless required by law.',
          },
        ],
      },
      {
        title: '6. Intellectual property',
        blocks: [
          {
            type: 'list',
            items: [
              'The site itself and its software, interface, design, structure, code, trademarks, branding, copy, features, and arrangement are owned by FinalFolio or the relevant rights holders.',
              'Ownership in User Content remains with you or the original rights holder. However, to the extent necessary to operate the service technically, store, display, transmit, adapt, back up, debug, review, manage risk, and operate the platform, you grant FinalFolio a necessary, non-exclusive license, with the ability to sublicense related technical service providers where required.',
              'Without prior written consent from FinalFolio or the relevant rights holder, no one may copy, scrape, mirror, reverse engineer, resell, or otherwise misuse the site or its content or services.',
            ],
          },
        ],
      },
      {
        title: '7. Service availability and disclaimer',
        blocks: [
          {
            type: 'list',
            items: [
              'FinalFolio will try to keep the service stable, but does not guarantee uninterrupted availability, error-free operation, absence of delay, absence of vulnerabilities, or complete fitness for your expectations.',
              'To the extent permitted by law, FinalFolio is not liable for interruption, abnormal data, failed access, lost content, display errors, unavailable resources, or other losses caused by third-party network, cloud, object-storage, CDN, data-center, or DNS failures; hacking, malware, malicious traffic, system upgrades, maintenance, migration, disaster, or force majeure; your own devices, environment, browser, network, configuration, or mistakes; or risks caused by your upload of unlawful, infringing, private, sensitive, or otherwise improper content.',
              'Except where mandatory law provides otherwise, FinalFolio is not liable for indirect, incidental, punitive, profit-related, opportunity-related, or goodwill-related losses arising from your use of the service.',
            ],
          },
        ],
      },
      {
        title: '8. User breach liability',
        blocks: [
          {
            type: 'list',
            items: [
              'If you violate these terms, law, regulation, or a third party’s lawful rights and that leads to complaints, claims, penalties, losses, expenses, or liability for FinalFolio, other users, or any third party, you are responsible for resolving the matter and bearing all resulting responsibility.',
              'If FinalFolio suffers loss as a result, you must compensate FinalFolio for all losses, including reasonable legal fees, filing fees, preservation fees, investigation fees, notarization fees, travel costs, and similar expenses.',
            ],
          },
        ],
      },
      {
        title: '9. Changes to these terms and to the service',
        blocks: [
          {
            type: 'list',
            items: [
              'FinalFolio may revise these terms in response to business development, legal or regulatory change, risk-control requirements, or product adjustment.',
              'Updated terms may be announced through site notices, page prompts, registration or login flows, or any other reasonable notice method.',
              'If you continue using the service after the terms are updated, you are deemed to have accepted the revised version.',
            ],
          },
        ],
      },
      {
        title: '10. Governing law and dispute resolution',
        blocks: [
          {
            type: 'list',
            items: [
              'The formation, effectiveness, interpretation, performance, and dispute resolution of these terms are governed by the laws of the People’s Republic of China.',
              'Any dispute arising out of or relating to these terms or the service should first be resolved through consultation. If consultation fails, either party may file suit with the court of competent jurisdiction in the place where the site operator is located.',
            ],
          },
        ],
      },
      {
        title: '11. Miscellaneous',
        blocks: [
          {
            type: 'list',
            items: [
              'Section titles are for convenience only and do not affect the legal meaning of the clauses themselves.',
              'If any provision of these terms is held invalid or unenforceable, the remaining provisions remain effective.',
              'If you have any question about these terms, contact us through the contact method published on the site.',
            ],
          },
        ],
      },
    ],
    riskNoticeTitle: 'Risk notice',
    riskNoticeBody:
      'FinalFolio is not an appropriate confidential storage tool for private photos or sensitive material. Uploads do not receive extra encryption protection, and technical access paths may still expose them publicly. Do not upload unlawful content, private images, sensitive personal information, or any material whose disclosure risk you are unwilling to bear. If you upload such content anyway and it is disclosed, shared, or causes loss, you are responsible for the consequences.',
    agreementLabel: 'I agree to the Terms of Service and understand the upload and storage risk notice.',
    acceptanceHeading: 'Accept the Terms of Service to continue',
    acceptanceBody:
      'This account was created before the current Terms of Service requirement took effect, or it has not yet accepted the current version. Review the terms below and accept them before using account, editor, upload, or admin features.',
    acceptButtonLabel: 'Accept terms and continue',
    continueButtonLabel: 'Continue',
    signInButtonLabel: 'Sign in',
    acceptedSummaryLabel: 'You have already accepted the current Terms of Service.',
  },
  'zh-CN': {
    language: 'zh-CN',
    title: '服务条款',
    shortTitle: 'TOS',
    intro: [
      '欢迎使用 FinalFolio（以下简称“本网站”或“本服务”）。',
      '本协议是你与 FinalFolio 运营方之间就你访问、注册、登录、上传、编辑、存储、发布和使用本网站相关功能所订立的协议。请你在注册、登录或使用本服务前，认真阅读并充分理解本协议全部内容。你勾选同意并注册、登录或继续使用本服务，即视为你已阅读、理解并接受本协议全部内容。',
      '如果你不同意本协议的任何内容，请立即停止注册或使用本服务。',
    ],
    sections: [
      {
        title: '一、服务说明',
        blocks: [
          {
            type: 'list',
            items: [
              'FinalFolio 是一个用于上传图片、组织内容、制作电子相册/杂志式页面并进行展示、编辑、管理的在线服务。',
              '本网站提供的功能可能包括但不限于：用户注册、登录、账号验证；图片上传、存储、展示与管理；项目创建、编辑、保存、导出与分享；管理后台、个人内容管理、偏好设置等。',
              '本网站有权根据产品运营需要，随时调整、增加、减少、中止或终止部分功能，无需对所有功能长期保持不变作出承诺。',
            ],
          },
        ],
      },
      {
        title: '二、账号注册与使用',
        blocks: [
          {
            type: 'list',
            items: [
              '你在注册和使用本服务时，应提供真实、准确、完整、最新的账号信息。',
              '你应妥善保管账号、密码、验证码、登录状态及相关凭证，并对以你账号进行的一切操作承担责任。',
              '你不得冒用他人身份注册或使用本服务，不得共享、出租、出借、出售账号，也不得以任何方式攻击、干扰、绕过、滥用本网站的注册、登录、验证、上传、导出、访问控制或其他功能。',
              '如你发现账号被未经授权使用、存在安全漏洞或异常情况，应立即通知本网站运营方。',
            ],
          },
        ],
      },
      {
        title: '三、用户上传内容与权利保证',
        blocks: [
          {
            type: 'list',
            items: [
              '你通过本网站上传、发布、编辑、保存、展示或传播的所有内容，包括但不限于图片、文字、标题、说明、模板、项目内容等（以下简称“用户内容”），均应由你自行负责。',
              '你保证你对所上传内容拥有合法权利，或已经取得充分、必要、有效的授权。',
              '你不得上传、发布、存储、传播任何违法、违规、侵权或不当内容，包括但不限于违反法律法规、危害国家安全、淫秽色情、暴力血腥、赌博诈骗、仇恨侮辱、诽谤、侵犯他人知识产权、肖像权、隐私权、名誉权、商业秘密或其他合法权益，以及含有恶意程序、木马、病毒、钓鱼链接或其他危害系统安全的内容。',
              '你不得上传包含隐私信息、个人敏感信息或其他不适合公开传播的图片或内容。',
            ],
          },
          {
            type: 'paragraph',
            text: '包括但不限于：',
          },
          {
            type: 'list',
            items: [
              '身份证、护照、驾驶证、社保卡、银行卡等证件信息；',
              '家庭住址、手机号、邮箱、车牌、行程、定位轨迹等个人信息；',
              '未经他人同意拍摄、保存或传播的私人照片；',
              '涉及未成年人隐私、医疗信息、财务信息、生物特征等敏感内容；',
              '其他一旦泄露可能对你本人或他人造成风险、损失、骚扰或侵害的内容。',
            ],
          },
        ],
      },
      {
        title: '四、特别风险提示：上传内容的存储与访问风险',
        blocks: [
          {
            type: 'list',
            items: [
              '本网站提供的是常规互联网内容存储、处理与访问能力，并非为隐私内容、敏感信息、机密资料或高安全等级数据设计的加密保管服务。',
              '你应明确知悉：你上传到本网站的图片和其他内容，不会因上传至本网站而获得任何额外的专属保密承诺或端到端加密保护。',
              '本网站当前不承诺对用户上传内容提供额外的、专门面向隐私保护的加密处理。',
              '从技术实现上看，用户上传的资源在特定条件下可能被公开访问、直接访问、间接访问、缓存访问或因配置、链接、路径、分享、引用等方式被第三方获取。',
              '因此，你不得将任何你不愿公开、泄露或被第三方获取的图片、资料或信息上传到本网站。',
              '若你自行上传了包含隐私信息、个人敏感信息、商业秘密、未公开资料或其他不适宜上传至本网站的内容，因此导致该等信息泄露、被访问、被传播、被下载、被缓存、被引用或造成任何损失、纠纷、风险、索赔、投诉或责任，原则上由你自行承担全部后果。',
              '对于因用户自身上传、误传、错误配置、错误分享、错误公开、错误引用、违反本协议或未充分判断风险而引发的隐私泄露或相关损害，本网站在法律允许的范围内不承担责任。',
              '但如果法律法规另有强制性规定，或者损害系因本网站故意或重大过失直接造成，则依照适用法律处理。',
            ],
          },
        ],
      },
      {
        title: '五、平台处理权利',
        blocks: [
          {
            type: 'paragraph',
            text: '为维护平台安全、合法合规运营及其他用户权益，本网站有权根据自身判断，对用户内容或账号采取相应措施，包括但不限于：',
          },
          {
            type: 'list',
            items: [
              '审核、拦截、限制、删除、下架、屏蔽用户内容；',
              '限制上传、访问、导出、分享、登录或其他功能；',
              '暂停、冻结、封禁账号；',
              '保留或删除相关数据、日志和操作记录；',
              '在必要时向监管机关、司法机关或其他有权机构提供相关信息并配合调查。',
            ],
          },
          {
            type: 'paragraph',
            text: '本网站采取上述措施时，不当然承担向用户逐项说明原因或补偿的义务；法律另有规定的除外。',
          },
        ],
      },
      {
        title: '六、知识产权',
        blocks: [
          {
            type: 'list',
            items: [
              '本网站本身及其软件、界面、设计、结构、代码、商标、标识、文案、功能编排等相关权利，归本网站或相关权利人所有。',
              '用户上传内容的权利仍归用户或原权利人所有；但为实现本服务的技术运行、存储、展示、传输、适配、备份、排障、审核、风控与运营所必需之目的，用户授予本网站必要的、非独占的、可再许可给关联技术服务方的使用许可。',
              '未经本网站或相关权利人书面同意，任何人不得擅自复制、抓取、镜像、反向工程、二次销售或以其他方式不当使用本网站内容及服务。',
            ],
          },
        ],
      },
      {
        title: '七、服务可用性与免责',
        blocks: [
          {
            type: 'list',
            items: [
              '本网站将尽力维持服务稳定，但不保证服务始终不中断、无错误、无延迟、无漏洞或完全符合用户预期。',
              '对于因第三方网络、云服务、对象存储、CDN、机房、域名解析故障，黑客攻击、病毒、木马、恶意流量、系统升级、维护、迁移、灾害或不可抗力，用户自身设备、环境、网络、浏览器、配置、误操作等问题，以及用户上传违法、侵权、隐私、敏感或不当内容所引发的风险和后果导致的服务中断、数据异常、访问失败、内容丢失、显示错误、资源不可用或其他损失，本网站在法律允许范围内不承担责任。',
              '本网站不对用户因使用本服务所产生的任何间接损失、附带损失、惩罚性损失、利润损失、机会损失、商誉损失承担责任；法律另有强制规定的除外。',
            ],
          },
        ],
      },
      {
        title: '八、用户违约责任',
        blocks: [
          {
            type: 'list',
            items: [
              '若你违反本协议、法律法规或第三方合法权益，导致本网站、其他用户或任何第三方遭受投诉、索赔、处罚、损失、支出或责任，你应负责妥善解决，并承担因此产生的全部责任。',
              '如因此给本网站造成损失，你还应赔偿本网站因此遭受的全部损失，包括但不限于律师费、诉讼费、保全费、调查费、公证费、差旅费及其他合理支出。',
            ],
          },
        ],
      },
      {
        title: '九、协议变更与服务变更',
        blocks: [
          {
            type: 'list',
            items: [
              '本网站有权根据业务发展、法律法规变化、风控要求或产品调整，对本协议内容进行修改。',
              '修改后的协议可通过网站公告、页面提示、注册/登录流程提示或其他合理方式通知用户。',
              '协议修改后，如你继续使用本服务，即视为你接受更新后的协议。',
            ],
          },
        ],
      },
      {
        title: '十、法律适用与争议解决',
        blocks: [
          {
            type: 'list',
            items: [
              '本协议的订立、生效、解释、履行及争议解决，适用中华人民共和国法律。',
              '因本协议或本服务引起的任何争议，双方应优先协商解决；协商不成的，任一方可向本网站运营方所在地有管辖权的人民法院提起诉讼。',
            ],
          },
        ],
      },
      {
        title: '十一、其他',
        blocks: [
          {
            type: 'list',
            items: [
              '本协议中的标题仅为阅读方便，不影响条款本身的法律含义。',
              '如本协议部分条款被认定无效或不可执行，不影响其他条款的效力。',
              '如你对本协议有任何疑问，请通过本网站公示的联系方式与我们联系。',
            ],
          },
        ],
      },
    ],
    riskNoticeTitle: '风险提示',
    riskNoticeBody:
      'FinalFolio 不适合作为隐私图片或敏感资料的保密存储工具。你上传的图片不享有额外加密保护，且在技术上存在被公开访问的可能。请勿上传任何违法内容、隐私图片、敏感个人信息或你不愿承担泄露风险的内容。若你自行上传此类内容并导致泄露、传播或损失，责任由你自行承担。',
    agreementLabel: '我已阅读并同意《服务条款》，并理解上传与存储风险提示。',
    acceptanceHeading: '继续使用前请先同意服务条款',
    acceptanceBody: '此账号创建于当前 TOS 要求生效之前，或尚未接受当前版本。请先阅读并同意以下条款，再继续使用账户、编辑器、上传或管理功能。',
    acceptButtonLabel: '同意条款并继续',
    continueButtonLabel: '继续',
    signInButtonLabel: '登录',
    acceptedSummaryLabel: '你已经同意当前版本的服务条款。',
  },
};

export function normalizeTermsLanguage(value: string | null | undefined): TermsLanguage {
  if (!value) {
    return 'en';
  }

  const nextValue = value.trim().toLowerCase();
  if (nextValue === 'zh' || nextValue === 'zh-cn' || nextValue === 'zh-hans') {
    return 'zh-CN';
  }

  return 'en';
}

export function getTermsDocument(language: string | null | undefined) {
  return TERMS_BY_LANGUAGE[normalizeTermsLanguage(language)];
}

export function getPageLanguage() {
  if (typeof window === 'undefined') {
    return 'en';
  }

  try {
    return window.localStorage.getItem('finalfolio-locale') === 'zh' ? 'zh-CN' : 'en';
  } catch {
    return 'en';
  }
}

export function buildTermsPath(nextPath?: string | null) {
  if (typeof nextPath === 'string' && nextPath.startsWith('/') && !nextPath.startsWith('//')) {
    return `/terms?next=${encodeURIComponent(nextPath)}`;
  }

  return '/terms';
}

export function redirectToPath(path: string, { replace = false }: { replace?: boolean } = {}) {
  if (typeof window === 'undefined') {
    return false;
  }

  if (replace) {
    window.location.replace(path);
  } else {
    window.location.assign(path);
  }

  return true;
}

export function redirectToTerms(nextPath?: string | null, options?: { replace?: boolean }) {
  return redirectToPath(buildTermsPath(nextPath), options);
}
